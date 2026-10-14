import { wardogsPlayerMetrics } from "../src/domain/player-stats/collected-metrics"
import type { ResultRevision } from "../src/domain/match-results/result-revision"
import { canonicalJson } from "../src/domain/game-data/canonical-json"
import { storeWardogsMatchReport } from "./wardogsMatchReportStore"
import { getUserByIdentifier, getUserStableId } from "./identity"
import type { MutationCtx } from "./_generated/server"
import { internalAuthSecret } from "./discord_shared"
import { queueEventRecaps } from "./matchRecapStore"
import type { Doc } from "./_generated/dataModel"
import { internal } from "./_generated/api"

/** Reviewed sources are immutable. Never backfill metrics from a changed source. */
export async function saveCollectedPlayerStats(
    ctx: MutationCtx,
    event: Doc<"events">,
    revision: ResultRevision,
    previous: ResultRevision | null = null,
    options: { queueRecaps?: boolean; refreshPerformance?: boolean } = {}
) {
    if (event.gameId !== "wardogs" || revision.status === "provisional")
        return { players: 0, matchedPlayers: 0, changed: false }
    const links = [
        ...new Map(
            revision.sessionLinks.map((link) => [link.sessionId, link])
        ).values(),
    ]
    const sessions = await Promise.all(
        links.map(async (link) => {
            const id = ctx.db.normalizeId("gameSessions", link.sessionId)
            const row = id ? await ctx.db.get(id) : null
            if (
                !row ||
                row.guildId !== event.guildId ||
                row.gameId !== "wardogs" ||
                !row.session.complete ||
                row.session.sourceDigest !== link.sourceDigest
            )
                throw new Error(
                    "Reviewed player-stat source is unavailable or changed."
                )
            return row.session
        })
    )
    const players = wardogsPlayerMetrics(sessions)
    const assignments = await ctx.db
        .query("userAssignments")
        .withIndex("serverId", (q) => q.eq("serverId", event.guildId))
        .collect()
    const users = (
        await Promise.all(
            [...new Set(assignments.map((a) => a.userId))].map((id) =>
                getUserByIdentifier(ctx, id)
            )
        )
    ).filter((user) => user !== null)
    const sourceUrl = `warcon:${links
        .map((link) => link.sessionId)
        .sort()
        .join(",")}`
    const ids = new Set([
        ...players.map((p) => p.platformId),
        ...(previous?.players
            .filter((p) => p.platform === "steam")
            .map((p) => p.platformId) ?? []),
    ])
    const profileIds = new Map<string, string>()
    let changed = false
    let matchedPlayers = 0
    for (const platformId of ids) {
        const id = `wardogs:${event.guildId}:steam:${platformId}`
        const doc = await ctx.db
            .query("playerStats")
            .withIndex("id", (q) => q.eq("id", id))
            .unique()
        const player = players.find((p) => p.platformId === platformId)
        if (!player) {
            if (doc?.matches[event._id]?.collected) {
                const matches = { ...doc.matches }
                delete matches[event._id]
                await ctx.db.patch(doc._id, {
                    matches,
                    updatedAt: revision.createdAt,
                })
                changed = true
            }
            continue
        }
        const proof = revision.players.find(
            (p) => p.platform === "steam" && p.platformId === platformId
        )?.logiUserId
        // Matching a self-declared exact platform ID records statistics only. It
        // never changes verified identity, result attribution or membership.
        const candidates = users.filter((user) =>
            user.platformIds?.includes(platformId)
        )
        const userId =
            proof ??
            (candidates.length === 1
                ? getUserStableId(candidates[0]!)
                : undefined)
        if (userId) {
            matchedPlayers++
            profileIds.set(`steam:${platformId}`, userId)
        }
        const deaths = player.deaths
        const match = {
            gameId: "wardogs",
            collected: true,
            sourceUrl,
            importedAt: revision.createdAt,
            endedAt:
                sessions
                    .map((s) => s.endedAt)
                    .filter((t): t is string => t !== null)
                    .sort()
                    .at(-1) ?? event.gameEnd,
            mapId: sessions.map((s) => s.externalId).join(","),
            mapName: sessions
                .map((s) => s.map)
                .filter(Boolean)
                .join(" / "),
            playerName: player.name,
            ...(userId ? { userId } : {}),
            team: player.faction,
            kills: player.kills,
            deaths,
            killDeathRatio: deaths ? player.kills / deaths : player.kills,
            cashDelta: player.cashDelta,
            // Legacy storage fields; Wardogs presentation and DTOs exclude them.
            offense: 0,
            defense: 0,
            support: 0,
        }
        if (
            doc &&
            canonicalJson(doc.matches[event._id]) === canonicalJson(match) &&
            doc.userId === userId
        )
            continue
        const matches = { ...(doc?.matches ?? {}), [event._id]: match }
        const values = {
            userId,
            latestName: player.name,
            matches,
            updatedAt: revision.createdAt,
        }
        if (doc) await ctx.db.patch(doc._id, values)
        else await ctx.db.insert("playerStats", { id, ...values })
        changed = true
    }
    const reportChanged = await storeWardogsMatchReport(
        ctx,
        event,
        revision,
        sessions,
        profileIds
    )
    if (options.queueRecaps !== false) await queueEventRecaps(ctx, event._id)
    if (changed || reportChanged || options.refreshPerformance)
        await ctx.scheduler.runAfter(
            0,
            internal.performanceHistory.refreshInBackground,
            {
                secret: internalAuthSecret(),
                guildId: event.guildId,
                gameId: "wardogs",
            }
        )
    return { players: players.length, matchedPlayers, changed }
}
