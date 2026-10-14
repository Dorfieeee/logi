import {
    ProviderError,
    providerSessionSchema,
    type DataSource,
    type GameDataProvider,
    type ProviderHttp,
    type ProviderKillEvent,
} from "../../domain/game-data/contracts"
import {
    warconReadSchema,
    warconFreshness,
    type WarconRead,
} from "../../domain/game-data/warcon-contracts"
import {
    warconPath,
    warconQuerySchema,
    type WarconQuery,
} from "../../domain/game-data/warcon-query"
import { classifyWarconOutcome } from "../../domain/game-data/warcon-history-facts"
import { sampleScoreTimeline } from "../../domain/match-reports/wardogs"
import { createHash } from "node:crypto"
import { z } from "zod"

const envelope = z.object({ ok: z.literal(true) })
function record(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value))
        throw new ProviderError("invalid_response")
    return value as Record<string, unknown>
}
export async function readWarcon(
    source: DataSource,
    input: WarconQuery,
    http: ProviderHttp,
    now: () => number
): Promise<WarconRead> {
    const parsedInput = warconQuerySchema.safeParse(input)
    if (source.provider !== "wardogs_warcon" || !parsedInput.success)
        throw new ProviderError("configuration")
    const query = parsedInput.data
    if (query.view === "career") {
        // Warcon aggregates career over every visible server, even on this server URL.
        const servers = await http.get("/api/servers")
        const scope = z
            .object({
                ok: z.literal(true),
                servers: z.array(z.object({ id: z.string() })).max(1000),
            })
            .safeParse(servers.body)
        if (!scope.success) throw new ProviderError("invalid_response")
        if (
            scope.data.servers.length !== 1 ||
            scope.data.servers[0].id !== source.providerServerId
        )
            throw new ProviderError("configuration")
    }
    const response = await http.get(warconPath(source.providerServerId, query))
    if (response.status === 404 && query.view === "match")
        return { view: "match", data: null }
    if (response.status !== 200 || !envelope.safeParse(response.body).success)
        throw new ProviderError("invalid_response")
    const body = record(response.body)
    let data: unknown = body
    if (query.view === "live") {
        const live = record(record(body.live)[source.providerServerId])
        data = {
            ...live,
            freshness: warconFreshness(
                typeof live.statusAt === "string" ? live.statusAt : null,
                now(),
                live.ok === true
            ),
            playersFreshness: warconFreshness(
                typeof live.playersAt === "string" ? live.playersAt : null,
                now(),
                live.ok === true
            ),
        }
    } else if (query.view === "career") data = body.career
    else if (
        [
            "catalog",
            "rotation",
            "health",
            "capabilities",
            "experiences",
            "alternators",
        ].includes(query.view)
    ) {
        if (body.action !== query.view)
            throw new ProviderError("invalid_response")
        data = body.result
    }
    const parsed = warconReadSchema.safeParse({ view: query.view, data })
    if (!parsed.success) throw new ProviderError("invalid_response")
    const result = parsed.data
    if (result.view === "live") {
        if (
            result.data.serverId !== source.providerServerId ||
            [
                result.data.statusAt,
                result.data.playersAt,
                result.data.observedAt,
            ].some((t) => t !== null && Date.parse(t) > now() + 5000)
        )
            throw new ProviderError("invalid_response")
    } else if (
        result.view === "match" &&
        query.view === "match" &&
        result.data &&
        String(result.data.match.id) !== query.matchId
    )
        throw new ProviderError("invalid_response")
    else if (
        result.view === "matches" &&
        query.view === "matches" &&
        (result.data.page !== query.page ||
            result.data.pageSize !== 50 ||
            result.data.pages !==
                Math.max(1, Math.ceil(result.data.total / 50)))
    )
        throw new ProviderError("invalid_response")
    else if (result.view === "leaderboard" && query.view === "leaderboard") {
        if (
            Object.entries(query).some(
                ([key, value]) =>
                    key !== "view" && record(result.data.query)[key] !== value
            )
        )
            throw new ProviderError("invalid_response")
    } else if (
        result.view === "analytics" &&
        query.view === "analytics" &&
        result.data.range !== query.range
    )
        throw new ProviderError("invalid_response")
    else if (
        result.view === "players" &&
        query.view === "players" &&
        result.data.players.length > query.limit
    )
        throw new ProviderError("invalid_response")
    else if (
        result.view === "kills" &&
        query.view === "kills" &&
        result.data.kills.length > query.limit
    )
        throw new ProviderError("invalid_response")
    else if (
        result.view === "career" &&
        result.data.last.some((m) => m.serverId !== source.providerServerId)
    )
        throw new ProviderError("invalid_response")
    return result
}

export const warconProvider: GameDataProvider = {
    readSnapshot: async (source, http, now) => {
        const read = await readWarcon(source, { view: "live" }, http, now)
        if (read.view !== "live") throw new ProviderError("invalid_response")
        const live = read.data
        return {
            observation: {
                observedAt:
                    live.statusAt === null || Date.parse(live.statusAt) > now()
                        ? new Date(now()).toISOString()
                        : new Date(live.statusAt).toISOString(),
                providerUpdatedAt: live.statusAt
                    ? new Date(live.statusAt).toISOString()
                    : null,
                displayName: live.status?.serverName || null,
                state:
                    live.ok &&
                    live.status !== null &&
                    live.freshness === "fresh"
                        ? "online"
                        : "unknown",
                map: live.status?.map || null,
                players: live.status?.playerCount ?? null,
                capacity: live.status?.maxPlayers ?? null,
                providerInstanceId: live.gameServerId || null,
                scores:
                    live.status?.scores.map((s) => ({
                        id: s.name,
                        label: s.name,
                        score: s.score,
                    })) ?? [],
                capabilities: ["server_snapshot", "match_history"],
            },
        }
    },
}

export async function readWarconSessionPage(
    source: DataSource,
    page: number,
    http: ProviderHttp
) {
    const result = await readWarcon(
        source,
        { view: "matches", page },
        http,
        Date.now
    )
    if (result.view !== "matches") throw new ProviderError("invalid_response")
    return {
        ids: result.data.matches
            .filter((m) => m.endedAt !== null)
            .map((m) => String(m.id)),
        nextPage: page < result.data.pages ? page + 1 : null,
    }
}
export async function readWarconSession(
    source: DataSource,
    id: string,
    http: ProviderHttp
) {
    const result = await readWarcon(
        source,
        { view: "match", matchId: id },
        http,
        Date.now
    )
    if (result.view !== "match" || !result.data)
        throw new ProviderError("invalid_response")
    const value = result.data
    return providerSessionSchema.parse({
        externalId: id,
        startedAt: new Date(value.match.startedAt).toISOString(),
        endedAt: value.match.endedAt
            ? new Date(value.match.endedAt).toISOString()
            : undefined,
        complete: true,
        map: value.match.map,
        participants:
            value.match.finalScores?.map((s) => ({
                id: s.name,
                label: s.name,
                score: s.score,
            })) ??
            value.factions.map((f) => ({
                id: f.name,
                label: f.name,
                score: null,
            })),
        sourceDigest: createHash("sha256")
            .update(JSON.stringify(value))
            .digest("hex"),
        warcon: {
            schemaVersion: 1,
            winner: value.match.winner?.trim() || null,
            outcome: classifyWarconOutcome(
                value.match.winner?.trim() || null,
                value.match.finalScores
            ),
            hasFeed: value.hasFeed,
            scoreTimeline: sampleScoreTimeline(value.timeline),
            mode: value.match.experiences,
            lighting: value.match.lighting,
            factions: value.factions.map((f) => ({
                name: f.name,
                colorHex: f.colorHex || null,
            })),
        },
        players: value.lines.map((p) => ({
            platform: "steam",
            platformId: p.steamId,
            name: p.name,
            faction: p.faction,
            result: p.result,
            metrics: {
                seconds: p.seconds,
                kills: p.kills,
                deaths: p.deaths,
                cashDelta: p.cashDelta,
                headshots: value.hasFeed ? p.headshots : null,
                teamKills: value.hasFeed ? p.teamKills : null,
                suicides: value.hasFeed ? p.suicides : null,
                vehicleKills: value.hasFeed ? p.vehicleKills : null,
                longestM: value.hasFeed ? p.longestM : null,
                killStreak: value.hasFeed ? p.killStreak : null,
                deathStreak: value.hasFeed ? p.deathStreak : null,
            },
        })),
    })
}

/** Read every retained feed event for one completed game with Warcon's stable cursor. */
export async function readWarconKillFeed(
    source: DataSource,
    matchId: string,
    http: ProviderHttp
): Promise<ProviderKillEvent[]> {
    const events: ProviderKillEvent[] = []
    const seen = new Set<string>()
    let before: string | undefined
    let beforeTime: number | undefined
    for (;;) {
        const result = await readWarcon(
            source,
            {
                view: "kills",
                match: matchId,
                limit: 200,
                ...(before ? { before, beforeTime } : {}),
            },
            http,
            Date.now
        )
        if (result.view !== "kills" || !result.data.configured) return []
        const page = result.data.kills
        for (const kill of page) {
            if (seen.has(kill.eventId)) continue
            seen.add(kill.eventId)
            events.push({
                eventId: kill.eventId,
                ts: kill.ts,
                map: kill.map,
                eventTime: kill.eventTime,
                killer: kill.killer
                    ? { name: kill.killer.name, faction: kill.killer.faction }
                    : null,
                victim: {
                    name: kill.victim.name,
                    faction: kill.victim.faction,
                },
                cause: kill.cause,
                distanceM: kill.distanceM,
                headshot: kill.headshot,
                suicide: kill.suicide,
                teamKill: kill.teamKill,
                tags: kill.tags,
            })
        }
        if (page.length < 200 || events.length >= (result.data.total ?? 0))
            return events
        const last = page.at(-1)
        if (!last || (last.ts === before && last.eventTime === beforeTime))
            throw new ProviderError("invalid_response")
        before = last.ts
        beforeTime = last.eventTime
    }
}
