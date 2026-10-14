import { mutation, query } from "./_generated/server"
import { internalAuthSecret } from "./discord_shared"
import { v } from "convex/values"

function assertInternalSecret(secret: string) {
    if (secret !== internalAuthSecret()) {
        throw new Error("Unauthorized.")
    }
}

const playerMatchStats = v.object({
    sourceUrl: v.string(),
    gameId: v.optional(v.string()),
    cashDelta: v.optional(v.union(v.number(), v.null())),
    collected: v.optional(v.boolean()),
    importedAt: v.string(),
    endedAt: v.optional(v.string()),
    mapId: v.string(),
    mapName: v.optional(v.string()),
    playerName: v.string(),
    userId: v.optional(v.string()),
    team: v.string(),
    kills: v.number(),
    killDeathRatio: v.number(),
    deaths: v.number(),
    offense: v.number(),
    defense: v.number(),
    support: v.number(),
})

function buildPerformanceSummary(
    matches: Array<{
        kills: number
        killDeathRatio: number
        deaths: number
        offense: number
        defense: number
        support: number
    }>
) {
    const divisor = matches.length || 1
    const totals = matches.reduce(
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
        matchesPlayed: matches.length,
        averages: {
            kills: totals.kills / divisor,
            killDeathRatio: totals.killDeathRatio / divisor,
            deaths: totals.deaths / divisor,
            offense: totals.offense / divisor,
            defense: totals.defense / divisor,
            support: totals.support / divisor,
        },
    }
}

function normalizeDoc<T extends { _id: unknown }>(doc: T) {
    return {
        ...doc,
        id: String(doc._id),
    }
}

function isUnknownPlayerName(value: string | undefined) {
    const normalized = value?.trim().toLowerCase()
    return !normalized || normalized === "unknown"
}

function shouldPreferMatch(
    candidate: {
        playerName: string
        importedAt: string
        endedAt?: string
    },
    existing: {
        playerName: string
        importedAt: string
        endedAt?: string
    }
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

function buildMatchDedupeKey(match: {
    sourceUrl: string
    mapId: string
    endedAt?: string
    kills: number
    deaths: number
    offense: number
    defense: number
    support: number
}) {
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

export const upsertMatches = mutation({
    args: {
        secret: v.string(),
        entries: v.array(
            v.object({
                id: v.string(),
                userId: v.optional(v.string()),
                latestName: v.string(),
                eventId: v.string(),
                match: playerMatchStats,
            })
        ),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const affectedUserIds = new Set<string>()

        for (const entry of args.entries) {
            const existing = await ctx.db
                .query("playerStats")
                .withIndex("id", (q) => q.eq("id", entry.id))
                .unique()

            const matches = {
                ...(existing?.matches ?? {}),
                [entry.eventId]: entry.match,
            }
            const updatedAt = new Date().toISOString()

            if (existing) {
                await ctx.db.patch(existing._id, {
                    userId: entry.userId ?? existing.userId,
                    latestName: entry.latestName,
                    matches,
                    updatedAt,
                })
                if (entry.userId ?? existing.userId) {
                    affectedUserIds.add((entry.userId ?? existing.userId)!)
                }
                continue
            }

            await ctx.db.insert("playerStats", {
                id: entry.id,
                userId: entry.userId,
                latestName: entry.latestName,
                matches,
                updatedAt,
            })
            if (entry.userId) {
                affectedUserIds.add(entry.userId)
            }
        }

        for (const userId of affectedUserIds) {
            const relatedStats = await ctx.db
                .query("playerStats")
                .withIndex("userId", (q) => q.eq("userId", userId))
                .collect()

            const matches = relatedStats.flatMap((doc) =>
                Object.values(doc.matches)
            )
            const performance = buildPerformanceSummary(matches)
            const user = await ctx.db
                .query("users")
                .withIndex("id", (q) => q.eq("id", userId))
                .unique()

            if (!user) {
                continue
            }

            await ctx.db.patch(user._id, {
                performance,
                updatedAt: new Date().toISOString(),
            })
        }

        return { ok: true, count: args.entries.length }
    },
})

export const listForUser = query({
    args: {
        secret: v.string(),
        userId: v.string(),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const docs = await ctx.db
            .query("playerStats")
            .withIndex("userId", (q) => q.eq("userId", args.userId))
            .collect()

        return docs.map(normalizeDoc)
    },
})

export const listUserIdsForEvents = query({
    args: {
        secret: v.string(),
        eventIds: v.array(v.string()),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const eventIdSet = new Set(args.eventIds)
        const docs = await ctx.db.query("playerStats").collect()
        const userIds = new Set<string>()

        for (const doc of docs) {
            if (!doc.userId) {
                continue
            }

            if (
                Object.keys(doc.matches).some((eventId) =>
                    eventIdSet.has(eventId)
                )
            ) {
                userIds.add(doc.userId)
            }
        }

        return [...userIds]
    },
})

export const dedupeMatchesForEvents = mutation({
    args: {
        secret: v.string(),
        eventIds: v.array(v.string()),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)

        const targetEventIds = new Set(args.eventIds)
        if (targetEventIds.size === 0) {
            return {
                affectedUserIds: [] as string[],
                duplicateMatchesRemoved: 0,
                docsDeleted: 0,
                docsPatched: 0,
            }
        }

        const docs = await ctx.db.query("playerStats").collect()
        const winners = new Map<
            string,
            { docId: string; match: (typeof docs)[number]["matches"][string] }
        >()
        const affectedUserIds = new Set<string>()

        for (const doc of docs) {
            if (!doc.userId) {
                continue
            }

            for (const [eventId, match] of Object.entries(doc.matches)) {
                if (!targetEventIds.has(eventId)) {
                    continue
                }

                const key = `${doc.userId}::${buildMatchDedupeKey(match)}`
                const existing = winners.get(key)
                if (!existing || shouldPreferMatch(match, existing.match)) {
                    winners.set(key, { docId: String(doc._id), match })
                }
            }
        }

        let duplicateMatchesRemoved = 0
        let docsDeleted = 0
        let docsPatched = 0

        for (const doc of docs) {
            if (!doc.userId) {
                continue
            }

            let changed = false
            const nextMatches = { ...doc.matches }

            for (const eventId of Object.keys(doc.matches)) {
                if (!targetEventIds.has(eventId)) {
                    continue
                }

                const winner = winners.get(
                    `${doc.userId}::${buildMatchDedupeKey(doc.matches[eventId]!)}`
                )
                if (!winner || winner.docId === String(doc._id)) {
                    continue
                }

                delete nextMatches[eventId]
                duplicateMatchesRemoved += 1
                changed = true
                affectedUserIds.add(doc.userId)
            }

            if (!changed) {
                continue
            }

            if (Object.keys(nextMatches).length === 0) {
                await ctx.db.delete(doc._id)
                docsDeleted += 1
            } else {
                await ctx.db.patch(doc._id, {
                    matches: nextMatches,
                    updatedAt: new Date().toISOString(),
                })
                docsPatched += 1
            }
        }

        for (const userId of affectedUserIds) {
            const relatedStats = await ctx.db
                .query("playerStats")
                .withIndex("userId", (q) => q.eq("userId", userId))
                .collect()

            const matches = relatedStats.flatMap((doc) =>
                Object.values(doc.matches)
            )
            const performance = buildPerformanceSummary(matches)
            const user = await ctx.db
                .query("users")
                .withIndex("id", (q) => q.eq("id", userId))
                .unique()

            if (!user) {
                continue
            }

            await ctx.db.patch(user._id, {
                performance,
                updatedAt: new Date().toISOString(),
            })
        }

        return {
            affectedUserIds: [...affectedUserIds],
            duplicateMatchesRemoved,
            docsDeleted,
            docsPatched,
        }
    },
})
