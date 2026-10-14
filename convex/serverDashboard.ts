import { query } from "./_generated/server"
import { v } from "convex/values"

import {
    getGuildDiscordId,
    getUserByIdentifier,
    getUserDiscordId,
    getUserStableId,
} from "./identity"
import { resultFaction } from "../src/domain/match-results/result-sides"
import { matchesGameScope } from "../src/domain/games/game"
import { internalAuthSecret } from "./discord_shared"

function reviewedOutcome(event: {
    side?: string
    reviewedResult?: {
        participants: Array<{ id: string; label: string; score: number | null }>
    }
}) {
    const faction = resultFaction(event.side)
    const scores = event.reviewedResult?.participants ?? []
    const ours = scores.find(
        (participant) =>
            faction &&
            (resultFaction(participant.id) === faction ||
                resultFaction(participant.label) === faction)
    )?.score
    const others = scores
        .filter((participant) => participant.score !== null)
        .filter(
            (participant) =>
                !faction ||
                (resultFaction(participant.id) !== faction &&
                    resultFaction(participant.label) !== faction)
        )
        .map((participant) => participant.score!)
    if (ours === null || ours === undefined || !others.length) return "draw"
    const opponent = Math.max(...others)
    return ours > opponent ? "victory" : ours < opponent ? "defeat" : "draw"
}

export const getRecentMatchSummaryInternal = query({
    args: {
        secret: v.string(),
        serverId: v.id("guilds"),
        gameScope: v.optional(v.union(v.literal("all"), v.string())),
    },
    handler: async (ctx, args) => {
        if (args.secret !== internalAuthSecret())
            throw new Error("Unauthorized.")

        const server = await ctx.db.get(args.serverId)
        if (!server) return null

        const guildId = getGuildDiscordId(server)
        const recentEvents = (
            await ctx.db
                .query("events")
                .withIndex("guildId", (q) => q.eq("guildId", guildId))
                .collect()
        )
            .filter(
                (event) =>
                    event.kind !== "training" &&
                    ((event.matchStatsId && event.eventResult) ||
                        (event.gameId === "wardogs" &&
                            event.wardogsReportId &&
                            event.reviewedResult &&
                            event.reviewedResult.status !== "provisional")) &&
                    matchesGameScope(event.gameId, args.gameScope)
            )
            .sort(
                (left, right) =>
                    new Date(
                        right.eventResult?.endedAt ?? right.gameEnd
                    ).getTime() -
                    new Date(
                        left.eventResult?.endedAt ?? left.gameEnd
                    ).getTime()
            )
            .slice(0, 10)
        const eventsById = new Map(
            recentEvents.map((event) => [String(event._id), event])
        )
        const recentMatches = recentEvents.map((event) => {
            const reviewed = event.reviewedResult
            const scores = event.eventResult
                ? [event.eventResult.score.sideA, event.eventResult.score.sideB]
                : (reviewed?.participants.map(
                      (participant) => participant.score
                  ) ?? [])
            return {
                id: String(event._id),
                name: event.name,
                endedAt:
                    event.eventResult?.endedAt ??
                    reviewed?.reviewedAt ??
                    event.gameEnd,
                outcome: event.eventResult?.outcome ?? reviewedOutcome(event),
                scores,
            }
        })

        const wins = recentMatches.filter(
            (match) => match.outcome === "victory"
        ).length
        const losses = recentMatches.filter(
            (match) => match.outcome === "defeat"
        ).length
        const decided = wins + losses
        const [statDocs, rosters, matchStats, assignments] = await Promise.all([
            ctx.db.query("playerStats").collect(),
            Promise.all(
                recentMatches.map((match) =>
                    ctx.db
                        .query("rosters")
                        .withIndex("eventId", (q) =>
                            q.eq("eventId", match.id as never)
                        )
                        .unique()
                )
            ),
            Promise.all(
                recentMatches.map((match) =>
                    ctx.db
                        .query("matchStats")
                        .withIndex("eventId", (q) =>
                            q.eq("eventId", match.id as never)
                        )
                        .unique()
                )
            ),
            ctx.db
                .query("userAssignments")
                .withIndex("serverId", (q) => q.eq("serverId", guildId))
                .collect(),
        ])
        const userIdByPlatformPlayerId = new Map(
            statDocs
                .filter((doc) => doc.userId)
                .map((doc) => [doc.id, doc.userId!])
        )
        const topPlayerTotals = new Map<
            string,
            { name: string; matches: number; kills: number; deaths: number }
        >()
        for (const match of matchStats) {
            for (const player of match?.raw.player_stats ?? []) {
                const playerId =
                    userIdByPlatformPlayerId.get(player.player_id) ??
                    `platform:${player.player_id}`
                const total = topPlayerTotals.get(playerId) ?? {
                    name: player.player,
                    matches: 0,
                    kills: 0,
                    deaths: 0,
                }
                total.matches += 1
                total.kills += player.kills
                total.deaths += player.deaths
                topPlayerTotals.set(playerId, total)
            }
        }
        const rosteredUserIds = new Set(
            assignments.map((assignment) => assignment.userId)
        )
        for (const match of recentMatches) {
            const event = eventsById.get(match.id)
            if (!event || event.gameId !== "wardogs") continue
            for (const doc of statDocs) {
                if (!doc.userId || !rosteredUserIds.has(doc.userId)) continue
                const player = doc.matches[event._id]
                if (!player) continue
                const total = topPlayerTotals.get(doc.userId) ?? {
                    name: doc.latestName ?? "Player",
                    matches: 0,
                    kills: 0,
                    deaths: 0,
                }
                total.matches += 1
                total.kills += player.kills
                total.deaths += player.deaths
                topPlayerTotals.set(doc.userId, total)
            }
        }
        const topPlayers = await Promise.all(
            [...topPlayerTotals.entries()]
                .sort(
                    ([, left], [, right]) =>
                        right.kills - left.kills || right.matches - left.matches
                )
                .slice(0, 5)
                .map(async ([playerId, totals]) => {
                    const user = playerId.startsWith("platform:")
                        ? null
                        : await getUserByIdentifier(ctx, playerId)
                    const playerIdentifiers = new Set([
                        playerId,
                        user ? getUserStableId(user) : "",
                        user ? getUserDiscordId(user) : "",
                    ])
                    const roles = rosters.flatMap(
                        (roster) =>
                            roster?.squads.flatMap((squad) =>
                                squad.players
                                    .filter(
                                        (player) =>
                                            player.id &&
                                            playerIdentifiers.has(player.id)
                                    )
                                    .map((player) => ({
                                        name: player.roleName ?? "Role",
                                        icon: player.roleIcon,
                                    }))
                            ) ?? []
                    )
                    const uniqueRoles = [
                        ...new Map(
                            roles.map((role) => [
                                `${role.name}:${role.icon ?? ""}`,
                                role,
                            ])
                        ).values(),
                    ]
                    const guildNickname = [
                        guildId,
                        server.discordId,
                        server.id,
                        String(server._id),
                    ]
                        .map((identifier) =>
                            identifier
                                ? user?.nicknames?.[identifier]?.trim()
                                : undefined
                        )
                        .find((nickname): nickname is string =>
                            Boolean(nickname)
                        )
                    return {
                        id: playerId,
                        name: guildNickname || user?.name || totals.name,
                        matches: totals.matches,
                        kills: totals.kills,
                        deaths: totals.deaths,
                        roles: uniqueRoles,
                    }
                })
        )

        return {
            recentMatches,
            wins,
            losses,
            winRate: decided ? wins / decided : 0,
            topPlayers,
        }
    },
})
