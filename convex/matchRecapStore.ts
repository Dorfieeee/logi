import { calculateMatchRecapBaseline } from "../src/domain/match-results/match-recap-baseline"
import { canReceiveMatchRecap } from "../src/domain/match-results/match-recap-notifications"
import { getUserByIdentifier, getUserStableId } from "./identity"
import { resolveGameScope } from "../src/domain/games/game"
import type { MutationCtx } from "./_generated/server"
import type { Id } from "./_generated/dataModel"

type Baseline = {
    userId: string
    matches: number
    kills: number
    deaths: number
    kd: number
    cashDelta?: number | null
}
/** Queue by real roster/account IDs, never infer a Discord recipient from a platform ID. */
export async function queueEventRecaps(
    ctx: MutationCtx,
    eventId: Id<"events">,
    baselines?: readonly Baseline[]
) {
    const event = await ctx.db.get(eventId)
    const roster = await ctx.db
        .query("rosters")
        .withIndex("eventId", (q) => q.eq("eventId", eventId))
        .unique()
    if (
        !event ||
        !roster ||
        (event.gameId === "wardogs"
            ? !event.wardogsReportId ||
              event.reviewedResult?.status !== "confirmed"
            : !event.eventResult)
    )
        return { queued: 0 }
    let queued = 0
    for (const rosterId of new Set(
        roster.squads.flatMap((squad) =>
            squad.players.flatMap((player) => (player.id ? [player.id] : []))
        )
    )) {
        const user = await getUserByIdentifier(ctx, rosterId)
        if (
            !user?.discordId ||
            !/^\d{17,20}$/.test(user.discordId) ||
            !canReceiveMatchRecap(user.matchRecapNotificationsEnabled)
        )
            continue
        const userId = getUserStableId(user)
        const stats = await ctx.db
            .query("playerStats")
            .withIndex("userId", (q) => q.eq("userId", userId))
            .collect()
        const current = stats.map((row) => row.matches[eventId]).find(Boolean)
        if (!current) continue
        const existing = await ctx.db
            .query("matchRecaps")
            .withIndex("eventId_userId", (q) =>
                q.eq("eventId", eventId).eq("userId", userId)
            )
            .unique()
        if (existing) continue
        const previous = stats.flatMap((row) =>
            Object.entries(row.matches)
                .filter(
                    ([id, match]) =>
                        id !== eventId &&
                        resolveGameScope(match.gameId) ===
                            resolveGameScope(event.gameId) &&
                        (!current.endedAt ||
                            (match.endedAt ?? match.importedAt) <
                                current.endedAt)
                )
                .map(([, match]) => match)
        )
        const baseline =
            baselines?.find((row) => row.userId === userId) ??
            calculateMatchRecapBaseline(previous)
        await ctx.db.insert("matchRecaps", {
            eventId,
            ...(event.gameId === "wardogs"
                ? { resultVersion: event.reviewedResult?.version }
                : {}),
            userId,
            userRecordId: user._id,
            discordUserId: user.discordId,
            status: "pending",
            previousTen: baseline.matches
                ? {
                      matches: baseline.matches,
                      kills: baseline.kills,
                      deaths: baseline.deaths,
                      kd: baseline.kd,
                      ...(baseline.cashDelta !== undefined
                          ? { cashDelta: baseline.cashDelta }
                          : {}),
                  }
                : undefined,
            createdAt: new Date().toISOString(),
        })
        queued++
    }
    return { queued }
}
