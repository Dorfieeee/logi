import { paginationOptsValidator } from "convex/server"

import { query, type QueryCtx } from "./_generated/server"
import type { Doc, Id } from "./_generated/dataModel"
import { v } from "convex/values"

import {
    isPublicPlayerDiscordSubject,
    publicPlayerIdentityBinding,
} from "../src/domain/player-stats/public-identity"
import {
    getGuildByDiscordId,
    getGuildDiscordId,
    getUserByIdentifier,
    getUserStableId,
} from "./identity"
import {
    matchesGameScope,
    resolveGameScope,
    type GameSelection,
} from "../src/domain/games/game"
import {
    filterCollection,
    paginateCollection,
} from "../src/domain/shared/collection-query"
import { selectPlayerMatchWindow } from "../src/domain/player-stats/match-window"
import { groupPlayerClans } from "../src/domain/player-stats/clan-memberships"
import { playerMetricKind } from "../src/domain/player-stats/game-metrics"
import { assertInternalSecret } from "./discord_shared"

const gameIdValidator = v.string()

function sortedMatches<T extends Record<string, unknown>>(matches: T[]): T[] {
    return [...matches].sort(
        (left, right) =>
            new Date(String(right.endedAt ?? right.importedAt)).getTime() -
            new Date(String(left.endedAt ?? left.importedAt)).getTime()
    )
}

function hasPublicPlayerStats(
    event: Doc<"events"> | null,
    collected?: boolean
) {
    return Boolean(
        event &&
        event.kind !== "training" &&
        playerMetricKind(event.gameId) &&
        (event.matchStatsId ||
            (collected &&
                event.reviewedResult &&
                event.reviewedResult.status !== "provisional"))
    )
}

/** A player's public matches, newest first: only matches of real (non
 * training) events that still have their imported match statistics. */
async function loadPublicPlayerMatches(
    ctx: Pick<QueryCtx, "db">,
    userId: string
) {
    const statDocs = await ctx.db
        .query("playerStats")
        .withIndex("userId", (q) => q.eq("userId", userId))
        .collect()
    const candidateMatches = statDocs.flatMap((doc) =>
        Object.entries(doc.matches).map(([eventId, match]) => ({
            eventId,
            ...match,
        }))
    )
    return sortedMatches(
        (
            await Promise.all(
                candidateMatches.map(async (match) => {
                    const event = await ctx.db.get(
                        match.eventId as Id<"events">
                    )
                    return hasPublicPlayerStats(event, match.collected)
                        ? { ...match, gameId: resolveGameScope(event?.gameId) }
                        : null
                })
            )
        ).filter((match): match is NonNullable<typeof match> => Boolean(match))
    )
}

async function toPublicMatchSummary(
    ctx: Pick<QueryCtx, "db">,
    match: Record<string, unknown> & { eventId: string }
) {
    const event = await ctx.db.get(match.eventId as Id<"events">)
    return {
        eventId: match.eventId,
        name: event?.name ?? "Match",
        endedAt: String(match.endedAt ?? event?.gameEnd ?? match.importedAt),
        mapName: typeof match.mapName === "string" ? match.mapName : undefined,
        kills: Number(match.kills ?? 0),
        deaths: Number(match.deaths ?? 0),
        killDeathRatio: Number(match.killDeathRatio ?? 0),
        gameId: resolveGameScope(event?.gameId),
        ...(event?.gameId === "wardogs"
            ? {
                  cashDelta:
                      typeof match.cashDelta === "number"
                          ? match.cashDelta
                          : null,
              }
            : {
                  offense: Number(match.offense ?? 0),
                  defense: Number(match.defense ?? 0),
                  support: Number(match.support ?? 0),
              }),
    }
}

/** Public, intentionally limited player data. Never add Discord IDs, notes,
 * platform identifiers, assignment details, or unpublished roster data here. */
export const getPlayer = query({
    args: {
        secret: v.string(),
        playerId: v.string(),
        game: v.optional(v.string()),
        identifierKind: v.optional(v.literal("discord")),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        let user: Doc<"users"> | null
        if (args.identifierKind === "discord") {
            if (!isPublicPlayerDiscordSubject(args.playerId)) return null
            const matches = await ctx.db
                .query("users")
                .withIndex("discordId", (q) => q.eq("discordId", args.playerId))
                .take(2)
            user = matches.length === 1 ? matches[0] : null
        } else user = await getUserByIdentifier(ctx, args.playerId)
        if (!user) return null

        const userId = getUserStableId(user)
        const allMatches = await loadPublicPlayerMatches(ctx, userId)
        const games = [...new Set(allMatches.map((match) => match.gameId))]
        const gameId = args.game ?? games[0] ?? "hell_let_loose"
        const matches = allMatches.filter((match) => match.gameId === gameId)
        if (!matches.length) return null

        const assignments = await ctx.db
            .query("userAssignments")
            .withIndex("userId", (q) => q.eq("userId", userId))
            .collect()
        const clans = (
            await Promise.all(
                groupPlayerClans(assignments).map(async (membership) => {
                    const guild = await getGuildByDiscordId(
                        ctx,
                        membership.serverId
                    )
                    return guild
                        ? {
                              id: getGuildDiscordId(guild),
                              name: guild.name,
                              avatar: guild.avatar,
                              gameIds: membership.gameIds,
                          }
                        : null
                })
            )
        ).filter((clan): clan is NonNullable<typeof clan> => clan !== null)

        const recentMatches = await Promise.all(
            matches
                .slice(0, 30)
                .map(async (match) => await toPublicMatchSummary(ctx, match))
        )

        const totals = matches.reduce<{ kills: number; deaths: number }>(
            (sum, match) => ({
                kills: sum.kills + Number(match.kills ?? 0),
                deaths: sum.deaths + Number(match.deaths ?? 0),
            }),
            { kills: 0, deaths: 0 }
        )
        return {
            id: userId,
            ...(args.identifierKind === "discord"
                ? {
                      identityBinding: await publicPlayerIdentityBinding(
                          String(user._id),
                          args.playerId
                      ),
                  }
                : {}),
            name: user.name,
            avatar: user.avatar,
            clans,
            gameId,
            games,
            stats: {
                cashDelta:
                    gameId === "wardogs"
                        ? matches.every(
                              (match) => typeof match.cashDelta === "number"
                          )
                            ? matches.reduce(
                                  (sum, match) => sum + (match.cashDelta ?? 0),
                                  0
                              )
                            : null
                        : undefined,
                matches: matches.length,
                kills: totals.kills,
                deaths: totals.deaths,
                kd: totals.deaths ? totals.kills / totals.deaths : totals.kills,
            },
            recentMatches,
            updatedAt: user.updatedAt,
        }
    },
})

/** One public match of a player and the ten older matches it is compared
 * with. Unlike `getPlayer`, which lists only the latest 30 matches, this finds
 * the match anywhere in the player's history, so every match linked from a
 * public match page resolves. Same public field limits as `getPlayer`. */
export const getPlayerMatch = query({
    args: { secret: v.string(), playerId: v.string(), eventId: v.string() },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const user = await getUserByIdentifier(ctx, args.playerId)
        if (!user) return null

        const userId = getUserStableId(user)
        const event = await ctx.db.get(args.eventId as Id<"events">)
        const window = selectPlayerMatchWindow(
            (await loadPublicPlayerMatches(ctx, userId)).filter(
                (match) => match.gameId === resolveGameScope(event?.gameId)
            ),
            args.eventId,
            10
        )
        if (!window) return null

        return {
            player: { id: userId, name: user.name, avatar: user.avatar },
            match: await toPublicMatchSummary(ctx, window.match),
            previousMatches: await Promise.all(
                window.previous.map(
                    async (match) => await toPublicMatchSummary(ctx, match)
                )
            ),
        }
    },
})

export const getMatch = query({
    args: { secret: v.string(), eventId: v.id("events") },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const [event, match] = await Promise.all([
            ctx.db.get(args.eventId),
            ctx.db
                .query("matchStats")
                .withIndex("eventId", (q) => q.eq("eventId", args.eventId))
                .unique(),
        ])
        if (!event || !match || event.matchStatsId !== match._id) return null
        const [stats, users] = await Promise.all([
            ctx.db.query("playerStats").collect(),
            ctx.db.query("users").collect(),
        ])
        const linkedPlayerIds = new Map(
            stats.flatMap((stat) =>
                // The stats document's ID is the persistent in-game platform
                // ID, so its user link is valid across all of that player's
                // matches, including older imported results.
                stat.userId ? [[stat.id, stat.userId] as const] : []
            )
        )
        // A recently linked platform ID may predate the stats import's userId
        // backfill. Resolve it directly as well, so public match links work
        // as soon as the player account is linked.
        const userIdByPlatformId = new Map(
            users.flatMap((user) =>
                (user.platformIds ?? []).map((platformId) => [
                    platformId.trim().toLowerCase(),
                    getUserStableId(user),
                ])
            )
        )
        for (const player of match.raw.player_stats) {
            const userId = userIdByPlatformId.get(
                player.player_id.trim().toLowerCase()
            )
            if (userId) linkedPlayerIds.set(player.player_id, userId)
        }
        // Older imports may have retained an obsolete platform-ID format.
        // Their per-event player name remains an exact, event-scoped link.
        const userIdByMatchPlayerName = new Map(
            stats.flatMap((stat) => {
                const playerMatch = stat.matches[String(args.eventId)]
                return stat.userId && playerMatch?.playerName
                    ? [[playerMatch.playerName, stat.userId] as const]
                    : []
            })
        )
        for (const player of match.raw.player_stats) {
            const userId = userIdByMatchPlayerName.get(player.player)
            if (userId) linkedPlayerIds.set(player.player_id, userId)
        }
        return {
            ...match,
            id: String(match._id),
            eventId: String(event._id),
            eventName: event.name,
            thumbnailUrl: event.thumbnailUrl,
            clanResult: event.eventResult
                ? {
                      clanLabel: event.eventResult.sideA,
                      opponentLabel: event.eventResult.sideB,
                      clanScore: event.eventResult.score.sideA,
                      opponentScore: event.eventResult.score.sideB,
                  }
                : undefined,
            linkedPlayerIds: Object.fromEntries(linkedPlayerIds),
        }
    },
})

export const getClan = query({
    args: { secret: v.string(), guildId: v.string() },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const guild = await getGuildByDiscordId(ctx, args.guildId)
        if (!guild) return null
        const guildId = getGuildDiscordId(guild)
        const [assignments, events] = await Promise.all([
            ctx.db
                .query("userAssignments")
                .withIndex("serverId", (q) => q.eq("serverId", guildId))
                .collect(),
            ctx.db
                .query("events")
                .withIndex("guildId", (q) => q.eq("guildId", guildId))
                .collect(),
        ])
        const activeMembers = assignments.filter(
            (assignment) => assignment.status === "active"
        )
        const memberCount = new Set([
            ...activeMembers.map((assignment) => assignment.userId),
            ...guild.memberIds,
        ]).size
        if (memberCount < 1) return null
        const recordedEvents = events.filter(
            (event) => event.kind !== "training" && event.matchStatsId
        )
        const recentMatches = (
            await Promise.all(
                recordedEvents
                    .sort(
                        (left, right) =>
                            new Date(right.gameEnd).getTime() -
                            new Date(left.gameEnd).getTime()
                    )
                    .slice(0, 12)
                    .map(async (event) => {
                        const match = await ctx.db
                            .query("matchStats")
                            .withIndex("eventId", (q) =>
                                q.eq("eventId", event._id)
                            )
                            .unique()
                        const category = guild.eventCategories?.find(
                            (item) => item.id === event.matchType
                        )
                        return match
                            ? {
                                  eventId: String(event._id),
                                  name: event.name,
                                  gameEnd: event.gameEnd,
                                  mapName: match.raw.map.pretty_name,
                                  score: match.raw.result,
                                  outcome: event.eventResult?.outcome,
                                  category: category?.label ?? event.matchType,
                              }
                            : null
                    })
            )
        ).filter((match): match is NonNullable<typeof match> => Boolean(match))
        const decidedMatches = recordedEvents.filter(
            (event) =>
                event.eventResult?.outcome === "victory" ||
                event.eventResult?.outcome === "defeat"
        )
        const wins = recordedEvents.filter(
            (event) => event.eventResult?.outcome === "victory"
        ).length
        return {
            id: guildId,
            name: guild.name,
            avatar: guild.avatar,
            description: guild.description,
            memberCount,
            stats: {
                matches: recordedEvents.length,
                wins,
                winRate: decidedMatches.length
                    ? wins / decidedMatches.length
                    : 0,
            },
            recentMatches,
            updatedAt: guild.updatedAt,
        }
    },
})

export const listClans = query({
    args: {
        secret: v.string(),
        paginationOpts: paginationOptsValidator,
        game: v.optional(gameIdValidator),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        // Filter before paging: otherwise recently-created ghost competition teams
        // can fill an entire page and hide eligible real clans behind it.
        const guilds = (await ctx.db.query("guilds").collect()).sort(
            (left, right) => right._creationTime - left._creationTime
        )
        const eligible = (
            await Promise.all(
                guilds.map(async (guild) => {
                    const [assignments, events] = await Promise.all([
                        ctx.db
                            .query("userAssignments")
                            .withIndex("serverId", (q) =>
                                q.eq("serverId", getGuildDiscordId(guild))
                            )
                            .collect(),
                        ctx.db
                            .query("events")
                            .withIndex("guildId", (q) =>
                                q.eq("guildId", getGuildDiscordId(guild))
                            )
                            .collect(),
                    ])
                    const memberCount = new Set([
                        ...assignments
                            .filter(
                                (assignment) => assignment.status === "active"
                            )
                            .map((assignment) => assignment.userId),
                        ...guild.memberIds,
                    ]).size
                    const hasPublicMatch = events.some(
                        (event) =>
                            event.kind !== "training" &&
                            event.matchStatsId &&
                            matchesGameScope(event.gameId, args.game)
                    )
                    return memberCount >= 1 && hasPublicMatch
                        ? {
                              id: getGuildDiscordId(guild),
                              name: guild.name,
                              avatar: guild.avatar,
                              description: guild.description,
                              memberCount,
                          }
                        : null
                })
            )
        ).filter((guild): guild is NonNullable<typeof guild> => Boolean(guild))
        const offset = args.paginationOpts.cursor
            ? Number(args.paginationOpts.cursor)
            : 0
        const page = eligible.slice(
            offset,
            offset + args.paginationOpts.numItems
        )
        const nextOffset = offset + page.length
        return {
            page,
            isDone: nextOffset >= eligible.length,
            continueCursor:
                nextOffset >= eligible.length ? "" : String(nextOffset),
        }
    },
})

/** Finds public clans with a result-backed match in the selected game. */
export const searchClans = query({
    args: {
        secret: v.string(),
        term: v.string(),
        paginationOpts: paginationOptsValidator,
        game: gameIdValidator,
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const term = args.term.trim().toLocaleLowerCase()
        if (term.length < 2)
            return { page: [], isDone: true, continueCursor: "" }
        const result = await ctx.db
            .query("guilds")
            .withSearchIndex("name", (q) => q.search("name", term))
            .paginate(args.paginationOpts)
        const page = (
            await Promise.all(
                result.page.map(async (guild) => {
                    const [assignments, events] = await Promise.all([
                        ctx.db
                            .query("userAssignments")
                            .withIndex("serverId", (q) =>
                                q.eq("serverId", getGuildDiscordId(guild))
                            )
                            .collect(),
                        ctx.db
                            .query("events")
                            .withIndex("guildId", (q) =>
                                q.eq("guildId", getGuildDiscordId(guild))
                            )
                            .collect(),
                    ])
                    const memberCount = new Set([
                        ...assignments
                            .filter(
                                (assignment) => assignment.status === "active"
                            )
                            .map((assignment) => assignment.userId),
                        ...guild.memberIds,
                    ]).size
                    const hasPublicMatch = events.some(
                        (event) =>
                            event.kind !== "training" &&
                            event.matchStatsId &&
                            matchesGameScope(event.gameId, args.game)
                    )
                    return memberCount >= 1 && hasPublicMatch
                        ? {
                              id: getGuildDiscordId(guild),
                              name: guild.name,
                              avatar: guild.avatar,
                              description: guild.description,
                              memberCount,
                          }
                        : null
                })
            )
        ).filter((guild): guild is NonNullable<typeof guild> => Boolean(guild))
        return { ...result, page }
    },
})

/** Platform-wide public match history. A match is public only after the event
 * points at its imported result; this intentionally excludes planned and
 * partially imported matches. */
export const listMatches = query({
    args: {
        secret: v.string(),
        paginationOpts: paginationOptsValidator,
        game: v.optional(v.union(v.literal("all"), v.array(gameIdValidator))),
        filters: v.optional(
            v.array(v.object({ path: v.string(), value: v.string() }))
        ),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        // Game scope is checked against the linked event, so it cannot be
        // expressed by one report index. Page events first so both legacy HLL
        // matches and reviewed Wardogs reports share a bounded match feed.
        // Arbitrary collection filters retain their existing projection-first
        // semantics because they can target computed public fields.
        const requiresProjectionFiltering = Boolean(args.filters?.length)
        const databasePage = requiresProjectionFiltering
            ? null
            : await ctx.db
                  .query("events")
                  .withIndex("gameEnd")
                  .order("desc")
                  .paginate(args.paginationOpts)
        const events =
            databasePage?.page ??
            (await ctx.db
                .query("events")
                .withIndex("gameEnd")
                .order("desc")
                .collect())
        const publicMatches = (
            await Promise.all(
                events.map(async (event) => {
                    if (
                        event.kind === "training" ||
                        !matchesGameScope(
                            event.gameId,
                            args.game as GameSelection | undefined
                        )
                    )
                        return null
                    const guild = await getGuildByDiscordId(ctx, event.guildId)
                    const clan = guild
                        ? {
                              id: getGuildDiscordId(guild),
                              name: guild.name,
                              avatar: guild.avatar,
                          }
                        : null
                    const category =
                        guild?.eventCategories?.find(
                            (item) => item.id === event.matchType
                        )?.label ?? event.matchType
                    if (
                        event.gameId === "wardogs" &&
                        event.wardogsReportId &&
                        event.reviewedResult?.status !== "provisional"
                    ) {
                        const report = await ctx.db.get(event.wardogsReportId)
                        if (
                            !report ||
                            report.guildId !== event.guildId ||
                            report.eventId !== event._id ||
                            report.report.version !==
                                event.reviewedResult?.version
                        )
                            return null
                        return {
                            eventId: String(event._id),
                            gameId: "wardogs",
                            name: event.name,
                            gameEnd: report.report.endedAt ?? event.gameEnd,
                            clan,
                            mapName: report.report.rounds
                                .map((round) => round.map)
                                .filter(Boolean)
                                .join(" / "),
                            score: null,
                            participants: report.report.sides.map((side) => ({
                                name: side.name,
                                score: side.score,
                            })),
                            category,
                        }
                    }
                    if (!event.matchStatsId) return null
                    const match = await ctx.db.get(event.matchStatsId)
                    if (
                        !match ||
                        match.eventId !== event._id ||
                        match.guildId !== event.guildId
                    )
                        return null
                    return {
                        eventId: String(event._id),
                        gameId: resolveGameScope(event.gameId),
                        name: event.name,
                        gameEnd: event.gameEnd,
                        clan,
                        mapName: match.raw.map.pretty_name,
                        score: match.raw.result,
                        outcome: event.eventResult?.outcome,
                        category,
                    }
                })
            )
        ).filter((match): match is NonNullable<typeof match> => match !== null)

        if (databasePage) return { ...databasePage, page: publicMatches }
        const offset = args.paginationOpts.cursor
            ? Number(args.paginationOpts.cursor)
            : 0
        const result = paginateCollection(
            filterCollection(publicMatches, args.filters ?? []),
            Number.isSafeInteger(offset) && offset >= 0 ? offset : 0,
            args.paginationOpts.numItems
        )
        return {
            page: result.page,
            isDone: result.nextOffset === null,
            continueCursor:
                result.nextOffset === null ? "" : String(result.nextOffset),
        }
    },
})

/** Finds only players with at least one result-backed public match. */
export const searchPlayers = query({
    args: {
        secret: v.string(),
        term: v.string(),
        paginationOpts: paginationOptsValidator,
        game: gameIdValidator,
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const term = args.term.trim().toLocaleLowerCase()
        if (term.length < 2)
            return { page: [], isDone: true, continueCursor: "" }
        const result = await ctx.db
            .query("users")
            .withSearchIndex("name", (q) => q.search("name", term))
            .paginate(args.paginationOpts)
        const page = (
            await Promise.all(
                result.page.map(async (user) => {
                    const stats = await ctx.db
                        .query("playerStats")
                        .withIndex("userId", (q) =>
                            q.eq("userId", getUserStableId(user))
                        )
                        .collect()
                    for (const entry of stats) {
                        for (const eventId of Object.keys(entry.matches)) {
                            const event = await ctx.db.get(
                                eventId as Id<"events">
                            )
                            if (
                                hasPublicPlayerStats(
                                    event,
                                    entry.matches[eventId]?.collected
                                ) &&
                                matchesGameScope(event?.gameId, args.game)
                            )
                                return {
                                    id: getUserStableId(user),
                                    name: user.name,
                                    avatar: user.avatar,
                                }
                        }
                    }
                    return null
                })
            )
        ).filter((user): user is NonNullable<typeof user> => Boolean(user))
        return { ...result, page }
    },
})
