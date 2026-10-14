import { fetchMutation, fetchQuery } from "convex/nextjs"
import { makeFunctionReference } from "convex/server"

import { matchesGameScope, type GameScope } from "@/domain/games/game"
import type { EventRecord, PlayerMatchStats } from "@/types/domain"
import { appCacheTags, cachedRead } from "@/lib/cache-tags"
import { getInternalAuthSecret } from "@/lib/env"

const listPlayerStatsForUserReference = makeFunctionReference<"query">(
    "playerStats:listForUser"
)
const upsertPlayerMatchesReference = makeFunctionReference<"mutation">(
    "playerStats:upsertMatches"
)
const listUserIdsForEventsReference = makeFunctionReference<"query">(
    "playerStats:listUserIdsForEvents"
)
const dedupeMatchesForEventsReference = makeFunctionReference<"mutation">(
    "playerStats:dedupeMatchesForEvents"
)

type PlayerStatsDoc = {
    id: string
    userId?: string
    latestName?: string
    updatedAt: string
    matches: Record<string, Omit<PlayerMatchStats, "eventId">>
}

export type PlayerStatsSummary = {
    totalMatches: number
    lastTenMatches: number
    averages: {
        cashDelta: number | null
        kills: number
        killDeathRatio: number
        deaths: number
        offense: number
        defense: number
        support: number
    }
}

export async function savePlayerMatchStats(input: {
    entries: Array<{
        id: string
        userId?: string
        latestName: string
        eventId: string
        match: Omit<PlayerMatchStats, "eventId">
    }>
}) {
    if (input.entries.length === 0) {
        return { ok: true, count: 0 }
    }

    return await fetchMutation(upsertPlayerMatchesReference, {
        secret: getInternalAuthSecret(),
        entries: input.entries as never,
    })
}

export async function getPlayerStatsDocs(userId: string) {
    return (await fetchQuery(listPlayerStatsForUserReference, {
        secret: getInternalAuthSecret(),
        userId,
    })) as PlayerStatsDoc[]
}

export async function getPlayerStatsUserIdsForEvents(eventIds: string[]) {
    if (eventIds.length === 0) {
        return [] as string[]
    }

    return (await fetchQuery(listUserIdsForEventsReference, {
        secret: getInternalAuthSecret(),
        eventIds,
    })) as string[]
}

export async function dedupePlayerStatsForEvents(eventIds: string[]) {
    if (eventIds.length === 0) {
        return {
            affectedUserIds: [] as string[],
            duplicateMatchesRemoved: 0,
            docsDeleted: 0,
            docsPatched: 0,
        }
    }

    return (await fetchMutation(dedupeMatchesForEventsReference, {
        secret: getInternalAuthSecret(),
        eventIds,
    })) as {
        affectedUserIds: string[]
        duplicateMatchesRemoved: number
        docsDeleted: number
        docsPatched: number
    }
}

export async function getPlayerStatsDocsCached(userId: string) {
    return await cachedRead(
        ["player-stats-docs", userId],
        [appCacheTags.playerStats(userId)],
        () => getPlayerStatsDocs(userId),
        604800
    )
}

export async function getPlayerStatsSummaryCached(
    userId: string,
    events: EventRecord[]
) {
    return await cachedRead(
        [
            "player-stats-summary",
            userId,
            events.map((event) => `${event.id}:${event.updatedAt}`).join(","),
        ],
        [appCacheTags.playerStats(userId)],
        async () => {
            const docs = await getPlayerStatsDocs(userId)
            return buildPlayerStatsSummary(
                sortPlayerMatches(
                    flattenPlayerMatches(docs),
                    new Map(events.map((event) => [event.id, event]))
                )
            )
        },
        604800
    )
}

export function flattenPlayerMatches(
    docs: PlayerStatsDoc[]
): PlayerMatchStats[] {
    const matchesByKey = new Map<string, PlayerMatchStats>()

    for (const doc of docs) {
        for (const [eventId, match] of Object.entries(doc.matches)) {
            const candidate: PlayerMatchStats = {
                eventId,
                ...match,
            }
            const dedupeKey = buildMatchDedupeKey(candidate)
            const existing = matchesByKey.get(dedupeKey)

            if (!existing || shouldPreferPlayerMatch(candidate, existing)) {
                matchesByKey.set(dedupeKey, candidate)
            }
        }
    }

    return [...matchesByKey.values()]
}

/** Player-stat rows are account-global; restrict them to this clan's events
 * and selected game before rendering a clan member profile. */
export function filterPlayerMatchesForEvents(
    matches: PlayerMatchStats[],
    events: EventRecord[],
    gameScope: GameScope
) {
    const eventById = new Map(events.map((event) => [event.id, event]))
    return matches.filter((match) => {
        const event = eventById.get(match.eventId)
        return Boolean(event && matchesGameScope(event.gameId, gameScope))
    })
}

function shouldPreferPlayerMatch(
    candidate: PlayerMatchStats,
    existing: PlayerMatchStats
) {
    const candidateUnknown = isUnknownPlayerName(candidate.playerName)
    const existingUnknown = isUnknownPlayerName(existing.playerName)

    if (candidateUnknown !== existingUnknown) {
        return !candidateUnknown
    }

    const candidateEndedAt = new Date(
        candidate.endedAt ?? candidate.importedAt
    ).getTime()
    const existingEndedAt = new Date(
        existing.endedAt ?? existing.importedAt
    ).getTime()
    if (candidateEndedAt !== existingEndedAt) {
        return candidateEndedAt > existingEndedAt
    }

    const candidateImportedAt = new Date(candidate.importedAt).getTime()
    const existingImportedAt = new Date(existing.importedAt).getTime()
    return candidateImportedAt > existingImportedAt
}

function isUnknownPlayerName(value: string | undefined) {
    const normalized = value?.trim().toLowerCase()
    return !normalized || normalized === "unknown"
}

function buildMatchDedupeKey(
    match: Pick<
        PlayerMatchStats,
        | "sourceUrl"
        | "mapId"
        | "endedAt"
        | "kills"
        | "deaths"
        | "offense"
        | "defense"
        | "support"
    >
) {
    const sourceUrl = match.sourceUrl.trim()
    if (sourceUrl) {
        return `source:${sourceUrl}`
    }

    return [
        "fallback",
        match.mapId,
        match.endedAt ?? "",
        match.kills,
        match.deaths,
        match.offense,
        match.defense,
        match.support,
    ].join("|")
}

export function sortPlayerMatches(
    matches: PlayerMatchStats[],
    eventById?: Map<string, EventRecord>
) {
    return [...matches].sort((left, right) => {
        const leftDate =
            eventById?.get(left.eventId)?.gameEnd ??
            left.endedAt ??
            left.importedAt
        const rightDate =
            eventById?.get(right.eventId)?.gameEnd ??
            right.endedAt ??
            right.importedAt
        return new Date(rightDate).getTime() - new Date(leftDate).getTime()
    })
}

export function buildPlayerStatsSummary(
    matches: PlayerMatchStats[]
): PlayerStatsSummary {
    const lastTen = matches.slice(0, 10)
    const divisor = lastTen.length || 1
    const totals = lastTen.reduce(
        (acc, match) => ({
            kills: acc.kills + match.kills,
            killDeathRatio: acc.killDeathRatio + match.killDeathRatio,
            deaths: acc.deaths + match.deaths,
            offense: acc.offense + match.offense,
            defense: acc.defense + match.defense,
            support: acc.support + match.support,
        }),
        {
            kills: 0,
            killDeathRatio: 0,
            deaths: 0,
            offense: 0,
            defense: 0,
            support: 0,
        }
    )

    return {
        totalMatches: matches.length,
        lastTenMatches: lastTen.length,
        averages: {
            cashDelta:
                lastTen.length &&
                lastTen.every((match) => typeof match.cashDelta === "number")
                    ? lastTen.reduce(
                          (sum, match) => sum + (match.cashDelta ?? 0),
                          0
                      ) / divisor
                    : null,
            kills: totals.kills / divisor,
            killDeathRatio: totals.killDeathRatio / divisor,
            deaths: totals.deaths / divisor,
            offense: totals.offense / divisor,
            defense: totals.defense / divisor,
            support: totals.support / divisor,
        },
    }
}
