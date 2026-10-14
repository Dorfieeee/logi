import {
    action,
    internalAction,
    internalQuery,
    mutation,
    query,
    type ActionCtx,
} from "./_generated/server"
import {
    filterByGameScope,
    resolveGameScope,
    type GameId,
} from "../src/domain/games/game"
import { playerStatProfile } from "../src/domain/player-stats/game-metrics"
import { assertInternalSecret, internalAuthSecret } from "./discord_shared"
import { authorizeDashboardAdmin, dashboardActor } from "./dashboardActor"
import { canonicalJson } from "../src/domain/game-data/canonical-json"
import { assertSessionGateway } from "./dashboardSessionStore"
import type { MutationCtx } from "./_generated/server"
import type { Doc } from "./_generated/dataModel"
import { api, internal } from "./_generated/api"
import { v } from "convex/values"

const gameIdValidator = v.string()

type Snapshot = {
    eventId: string
    gameId?: GameId
    playedAt: string
    label: string
    combat: number
    offense: number
    support: number
    kills: number
    deaths: number
    points: number
    kd: number
    cashDelta?: number | null
}
const limitMatchesPerGame = <T extends { gameId?: GameId }>(matches: T[]) => {
    const counts = new Map<GameId, number>()
    return matches.filter((match) => {
        const gameId = resolveGameScope(match.gameId)
        const count = counts.get(gameId) ?? 0
        counts.set(gameId, count + 1)
        return count < 10
    })
}
const number = (value: unknown) =>
    Number.isFinite(Number(value)) ? Number(value) : 0
const whole = (value: number) => Math.round(value)
const clanPoints = (
    event: {
        eventResult?: {
            outcome: "victory" | "defeat" | "draw"
            score: { sideA: number; sideB: number }
        }
    },
    rows?: Array<{ team: { side: string } }>,
    raw?: { result: { axis: number; allied: number } }
) => {
    const score = event.eventResult?.score
    if (!score && raw && rows?.length) {
        const axisCount = rows.filter(
            (row) => row.team.side.toLowerCase() === "axis"
        ).length
        const alliedCount = rows.filter(
            (row) =>
                row.team.side.toLowerCase() === "allies" ||
                row.team.side.toLowerCase() === "allied"
        ).length
        return axisCount >= alliedCount ? raw.result.axis : raw.result.allied
    }
    if (!score) return 0
    if (event.eventResult?.outcome === "victory")
        return Math.max(score.sideA, score.sideB)
    if (event.eventResult?.outcome === "defeat")
        return Math.min(score.sideA, score.sideB)
    return score.sideA
}

/**
 * Stores a history row only when its matches changed: a match import or a
 * refresh recomputes every row it touches, and most come out the same.
 * Convex keeps a new version of a row on every write.
 */
async function storeGuildHistory(
    ctx: MutationCtx,
    guildId: string,
    existing: Doc<"guildPerformanceHistory"> | null,
    matches: Doc<"guildPerformanceHistory">["matches"],
    updatedAt: string
) {
    if (existing && canonicalJson(existing.matches) === canonicalJson(matches))
        return false
    if (existing) await ctx.db.patch(existing._id, { matches, updatedAt })
    else
        await ctx.db.insert("guildPerformanceHistory", {
            guildId,
            matches,
            updatedAt,
        })
    return true
}
async function storePlayerHistory(
    ctx: MutationCtx,
    guildId: string,
    userId: string,
    existing: Doc<"playerPerformanceHistory"> | null,
    matches: Doc<"playerPerformanceHistory">["matches"],
    updatedAt: string
) {
    if (existing && canonicalJson(existing.matches) === canonicalJson(matches))
        return false
    if (existing) await ctx.db.patch(existing._id, { matches, updatedAt })
    else
        await ctx.db.insert("playerPerformanceHistory", {
            guildId,
            userId,
            matches,
            updatedAt,
        })
    return true
}

export async function rebuildGuildPerformanceHistory(
    ctx: MutationCtx,
    guildId: string,
    includePlayers = true,
    gameId?: GameId
) {
    const events = (
        await ctx.db
            .query("events")
            .withIndex("guildId", (q) => q.eq("guildId", guildId))
            .collect()
    )
        .filter(
            (event) =>
                event.kind !== "training" &&
                (event.matchStatsId ||
                    (event.gameId === "wardogs" &&
                        event.reviewedResult &&
                        event.reviewedResult.status !== "provisional")) &&
                (!gameId || resolveGameScope(event.gameId) === gameId)
        )
        .sort(
            (a, b) =>
                new Date(b.eventResult?.endedAt ?? b.gameEnd).getTime() -
                new Date(a.eventResult?.endedAt ?? a.gameEnd).getTime()
        )
    const guildEvents = limitMatchesPerGame(events)
    const eventById = new Map(events.map((event) => [String(event._id), event]))
    const assignments = await ctx.db
        .query("userAssignments")
        .withIndex("serverId", (q) => q.eq("serverId", guildId))
        .collect()
    const clanUserIds = new Set(
        assignments.map((assignment) => assignment.userId)
    )
    const [stats, playerStatsByUser] = await Promise.all([
        Promise.all(
            guildEvents.map((event) =>
                ctx.db
                    .query("matchStats")
                    .withIndex("eventId", (q) => q.eq("eventId", event._id))
                    .unique()
            )
        ),
        Promise.all(
            [...clanUserIds].map((userId) =>
                ctx.db
                    .query("playerStats")
                    .withIndex("userId", (q) => q.eq("userId", userId))
                    .collect()
            )
        ),
    ])
    const playerDocs = playerStatsByUser.flat()
    const userByPlatformId = new Map(
        playerDocs
            .filter((doc) => doc.userId)
            .map((doc) => [doc.id, doc.userId!])
    )
    const guildMatches: Snapshot[] = []
    for (let index = 0; index < guildEvents.length; index++) {
        const event = guildEvents[index]!
        const eventGameId = resolveGameScope(event.gameId)
        const eventClanUserIds = new Set(
            filterByGameScope(assignments, eventGameId).map(
                (assignment) => assignment.userId
            )
        )
        if (eventGameId === "wardogs") {
            const playerRows = playerDocs
                .filter((doc) => doc.userId && eventClanUserIds.has(doc.userId))
                .flatMap((doc) =>
                    doc.matches[event._id] ? [doc.matches[event._id]!] : []
                )
            if (playerRows.length) {
                const kills = playerRows.reduce(
                    (sum, row) => sum + row.kills,
                    0
                )
                const deaths = playerRows.reduce(
                    (sum, row) => sum + row.deaths,
                    0
                )
                guildMatches.push({
                    eventId: String(event._id),
                    gameId: "wardogs",
                    playedAt: playerRows[0]!.endedAt ?? event.gameEnd,
                    label: event.name,
                    combat: 0,
                    offense: 0,
                    support: 0,
                    points: 0,
                    kills: kills / playerRows.length,
                    deaths: deaths / playerRows.length,
                    kd: deaths ? kills / deaths : kills,
                    cashDelta: playerRows.every(
                        (row) => typeof row.cashDelta === "number"
                    )
                        ? playerRows.reduce(
                              (sum, row) => sum + (row.cashDelta ?? 0),
                              0
                          ) / playerRows.length
                        : null,
                })
            }
            continue
        }
        const rows = (stats[index]?.raw.player_stats ?? []).filter((row) =>
            eventClanUserIds.has(userByPlatformId.get(row.player_id) ?? "")
        )
        if (!rows.length) continue
        const total = rows.reduce(
            (sum, row) => ({
                combat: sum.combat + number(row.combat),
                offense: sum.offense + number(row.offense),
                support: sum.support + number(row.support),
                kills: sum.kills + number(row.kills),
                deaths: sum.deaths + number(row.deaths),
            }),
            { combat: 0, offense: 0, support: 0, kills: 0, deaths: 0 }
        )
        guildMatches.push({
            eventId: String(event._id),
            gameId: event.gameId,
            playedAt: event.eventResult?.endedAt ?? event.gameEnd,
            label: event.name,
            combat: whole(total.combat / rows.length),
            offense: whole(total.offense / rows.length),
            support: whole(total.support / rows.length),
            kills: whole(total.kills / rows.length),
            deaths: whole(total.deaths / rows.length),
            points: clanPoints(event, rows, stats[index]?.raw),
            kd:
                whole(
                    (total.deaths ? total.kills / total.deaths : total.kills) *
                        100
                ) / 100,
        })
    }
    const now = new Date().toISOString()
    const guildExisting = await ctx.db
        .query("guildPerformanceHistory")
        .withIndex("guildId", (q) => q.eq("guildId", guildId))
        .unique()
    const nextGuildMatches = gameId
        ? [
              ...(guildExisting?.matches.filter(
                  (match) => resolveGameScope(match.gameId) !== gameId
              ) ?? []),
              ...guildMatches,
          ]
        : guildMatches
    await storeGuildHistory(ctx, guildId, guildExisting, nextGuildMatches, now)
    if (!includePlayers)
        return { guildMatches: guildMatches.length, players: 0 }
    const playerMatches = new Map<string, Map<string, Snapshot>>()
    for (const doc of playerDocs) {
        if (!doc.userId || !clanUserIds.has(doc.userId)) continue
        const matches =
            playerMatches.get(doc.userId) ?? new Map<string, Snapshot>()
        for (const [eventId, match] of Object.entries(doc.matches)) {
            const event = eventById.get(eventId)
            if (!event) continue
            const kills = number(match.kills),
                deaths = number(match.deaths)
            matches.set(eventId, {
                eventId,
                gameId: event.gameId,
                playedAt:
                    event.eventResult?.endedAt ??
                    event.gameEnd ??
                    match.endedAt ??
                    match.importedAt,
                label: event.name,
                combat: 0,
                offense: whole(number(match.offense)),
                support: whole(number(match.support)),
                ...(event.gameId === "wardogs"
                    ? { cashDelta: match.cashDelta ?? null }
                    : {}),
                kills: whole(kills),
                deaths: whole(deaths),
                points: clanPoints(event),
                kd: whole((deaths ? kills / deaths : kills) * 100) / 100,
            })
        }
        playerMatches.set(doc.userId, matches)
    }
    for (const userId of clanUserIds) {
        const matchesByEvent = playerMatches.get(userId) ?? new Map()
        const matches = [...matchesByEvent.values()].sort(
            (a, b) =>
                new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime()
        )
        const limitedMatches = limitMatchesPerGame(matches)
        const existing = await ctx.db
            .query("playerPerformanceHistory")
            .withIndex("guildId_userId", (q) =>
                q.eq("guildId", guildId).eq("userId", userId)
            )
            .unique()
        const nextMatches = gameId
            ? [
                  ...(existing?.matches.filter(
                      (match) => resolveGameScope(match.gameId) !== gameId
                  ) ?? []),
                  ...limitedMatches,
              ]
            : limitedMatches
        await storePlayerHistory(
            ctx,
            guildId,
            userId,
            existing,
            nextMatches,
            now
        )
    }
    return { guildMatches: guildMatches.length, players: clanUserIds.size }
}

export const listClanUserIds = query({
    args: { secret: v.string(), guildId: v.string() },
    handler: async (ctx, args) => {
        if (args.secret !== internalAuthSecret())
            throw new Error("Unauthorized.")
        return [
            ...new Set(
                (
                    await ctx.db
                        .query("userAssignments")
                        .withIndex("serverId", (q) =>
                            q.eq("serverId", args.guildId)
                        )
                        .collect()
                ).map((assignment) => assignment.userId)
            ),
        ]
    },
})
export const refreshGuildOnly = mutation({
    args: { secret: v.string(), guildId: v.string(), gameId: gameIdValidator },
    handler: async (ctx, args) => {
        if (args.secret !== internalAuthSecret())
            throw new Error("Unauthorized.")
        return rebuildGuildPerformanceHistory(
            ctx,
            args.guildId,
            false,
            args.gameId
        )
    },
})
export const refreshPlayerForGuild = mutation({
    args: {
        secret: v.string(),
        guildId: v.string(),
        userId: v.string(),
        gameId: gameIdValidator,
    },
    handler: async (ctx, args) => {
        if (args.secret !== internalAuthSecret())
            throw new Error("Unauthorized.")
        const [events, docs] = await Promise.all([
            ctx.db
                .query("events")
                .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
                .collect(),
            ctx.db
                .query("playerStats")
                .withIndex("userId", (q) => q.eq("userId", args.userId))
                .collect(),
        ])
        const eventById = new Map(
            events
                .filter(
                    (event) =>
                        event.kind !== "training" &&
                        (event.matchStatsId ||
                            (event.gameId === "wardogs" &&
                                event.reviewedResult &&
                                event.reviewedResult.status !==
                                    "provisional")) &&
                        resolveGameScope(event.gameId) === args.gameId
                )
                .map((event) => [String(event._id), event])
        )
        const matches = new Map<string, Snapshot>()
        for (const doc of docs)
            for (const [eventId, match] of Object.entries(doc.matches)) {
                const event = eventById.get(eventId)
                if (!event) continue
                const kills = number(match.kills),
                    deaths = number(match.deaths)
                matches.set(eventId, {
                    eventId,
                    gameId: event.gameId,
                    playedAt: event.eventResult?.endedAt ?? event.gameEnd,
                    label: event.name,
                    combat: 0,
                    offense: whole(number(match.offense)),
                    support: whole(number(match.support)),
                    ...(event.gameId === "wardogs"
                        ? { cashDelta: match.cashDelta ?? null }
                        : {}),
                    kills: whole(kills),
                    deaths: whole(deaths),
                    points: clanPoints(event),
                    kd: whole((deaths ? kills / deaths : kills) * 100) / 100,
                })
            }
        const history = [...matches.values()].sort(
            (a, b) =>
                new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime()
        )
        const limitedHistory = limitMatchesPerGame(history)
        const existing = await ctx.db
            .query("playerPerformanceHistory")
            .withIndex("guildId_userId", (q) =>
                q.eq("guildId", args.guildId).eq("userId", args.userId)
            )
            .unique()
        const nextMatches = [
            ...(existing?.matches.filter(
                (match) => resolveGameScope(match.gameId) !== args.gameId
            ) ?? []),
            ...limitedHistory,
        ]
        await storePlayerHistory(
            ctx,
            args.guildId,
            args.userId,
            existing,
            nextMatches,
            new Date().toISOString()
        )
        return { matches: limitedHistory.length }
    },
})
/**
 * The workspace members who played one imported match: the scoreboard's
 * player IDs, through their statistics rows, to linked users assigned in
 * the workspace. Only their histories can change with that import.
 */
export const matchClanUserIds = internalQuery({
    args: { guildId: v.string(), eventId: v.id("events") },
    handler: async (ctx, args): Promise<string[]> => {
        const stats = await ctx.db
            .query("matchStats")
            .withIndex("eventId", (q) => q.eq("eventId", args.eventId))
            .unique()
        if (!stats || stats.guildId !== args.guildId) return []
        const linked = new Set<string>()
        for (const playerId of new Set(
            stats.raw.player_stats.map((row) => row.player_id)
        ))
            for (const doc of await ctx.db
                .query("playerStats")
                .withIndex("id", (q) => q.eq("id", playerId))
                .take(10))
                if (doc.userId) linked.add(doc.userId)
        const members: string[] = []
        for (const userId of linked)
            if (
                await ctx.db
                    .query("userAssignments")
                    .withIndex("serverId_userId", (q) =>
                        q.eq("serverId", args.guildId).eq("userId", userId)
                    )
                    .first()
            )
                members.push(userId)
        return members.sort()
    },
})
type RefreshResult = { guildMatches: number; players: number }
/** The workspace history, then each given player's (every member's without a list). */
async function refreshHistories(
    ctx: ActionCtx,
    args: {
        guildId: string
        gameId: string
    },
    players?: string[]
): Promise<RefreshResult> {
    const access = { ...args, secret: internalAuthSecret() }
    const guild: RefreshResult = await ctx.runMutation(
        api.performanceHistory.refreshGuildOnly,
        access
    )
    const userIds: string[] =
        players ??
        (await ctx.runQuery(api.performanceHistory.listClanUserIds, access))
    for (const userId of userIds)
        await ctx.runMutation(api.performanceHistory.refreshPlayerForGuild, {
            ...access,
            userId,
        })
    return { ...guild, players: userIds.length }
}
/**
 * After a match import (`matchStats:upsertForEvent`): the workspace history
 * and the histories of the players in that match. Without `eventId` every
 * member's history is rebuilt.
 */
export const refreshInBackground = internalAction({
    args: {
        secret: v.string(),
        guildId: v.string(),
        gameId: gameIdValidator,
        eventId: v.optional(v.id("events")),
    },
    handler: async (ctx, args): Promise<RefreshResult> => {
        if (args.secret !== internalAuthSecret())
            throw new Error("Unauthorized.")
        if (!playerStatProfile(args.gameId))
            throw new Error("This game does not collect player statistics.")
        const target = { guildId: args.guildId, gameId: args.gameId }
        return await refreshHistories(
            ctx,
            target,
            args.eventId
                ? await ctx.runQuery(
                      internal.performanceHistory.matchClanUserIds,
                      { guildId: args.guildId, eventId: args.eventId }
                  )
                : undefined
        )
    },
})
/** The dashboard check of `refreshForDashboard`: a current clan admin's session. */
export const authorizeRefresh = internalQuery({
    args: { secret: v.string(), guildId: v.string(), actor: dashboardActor },
    handler: async (ctx, args) => {
        await authorizeDashboardAdmin(ctx, args)
    },
})
/**
 * "Refresh performance history" in Settings → Imports: rebuilds the
 * workspace history and every member's for one game. The web route checks
 * the clan-admin right; this action checks it again from the dashboard
 * session (`authorizeDashboardAdmin`) before it reads or writes anything.
 */
export const refreshForDashboard = action({
    args: {
        secret: v.string(),
        guildId: v.string(),
        gameId: gameIdValidator,
        actor: dashboardActor,
    },
    handler: async (ctx, args): Promise<RefreshResult> => {
        assertSessionGateway(args.secret)
        if (!playerStatProfile(args.gameId))
            throw new Error("This game does not collect player statistics.")
        await ctx.runQuery(internal.performanceHistory.authorizeRefresh, {
            secret: args.secret,
            guildId: args.guildId,
            actor: args.actor,
        })
        return await refreshHistories(ctx, {
            guildId: args.guildId,
            gameId: args.gameId,
        })
    },
})
function normalizeHistory<
    T extends {
        matches: Array<
            Omit<Snapshot, "offense" | "points" | "kd"> &
                Partial<Pick<Snapshot, "offense" | "points" | "kd">>
        >
    },
>(history: T | null) {
    return (
        history && {
            ...history,
            matches: history.matches.map((match) => ({
                ...match,
                offense: match.offense ?? 0,
                points: match.points ?? 0,
                kd:
                    match.kd ??
                    (match.deaths ? match.kills / match.deaths : match.kills),
            })),
        }
    )
}
export const getGuild = query({
    args: {
        secret: v.string(),
        guildId: v.string(),
        gameScope: v.optional(v.union(v.literal("all"), gameIdValidator)),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const history = normalizeHistory(
            await ctx.db
                .query("guildPerformanceHistory")
                .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
                .unique()
        )
        return (
            history && {
                ...history,
                matches: filterByGameScope(history.matches, args.gameScope),
            }
        )
    },
})
export const getPlayer = query({
    args: {
        secret: v.string(),
        guildId: v.string(),
        userId: v.string(),
        gameScope: v.optional(v.union(v.literal("all"), gameIdValidator)),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const history = normalizeHistory(
            await ctx.db
                .query("playerPerformanceHistory")
                .withIndex("guildId_userId", (q) =>
                    q.eq("guildId", args.guildId).eq("userId", args.userId)
                )
                .unique()
        )
        return (
            history && {
                ...history,
                matches: filterByGameScope(history.matches, args.gameScope),
            }
        )
    },
})
export const getPlayers = query({
    args: {
        secret: v.string(),
        guildId: v.string(),
        userIds: v.array(v.string()),
        gameScope: v.optional(v.union(v.literal("all"), gameIdValidator)),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const rows = await Promise.all(
            [...new Set(args.userIds)].map((userId) =>
                ctx.db
                    .query("playerPerformanceHistory")
                    .withIndex("guildId_userId", (q) =>
                        q.eq("guildId", args.guildId).eq("userId", userId)
                    )
                    .unique()
            )
        )
        return Object.fromEntries(
            rows
                .filter((row): row is NonNullable<typeof row> => Boolean(row))
                .map((row) => [
                    row.userId,
                    filterByGameScope(
                        normalizeHistory(row)!.matches,
                        args.gameScope
                    ),
                ])
        )
    },
})
