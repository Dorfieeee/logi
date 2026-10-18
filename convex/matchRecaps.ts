import { mutation, query, type QueryCtx } from "./_generated/server"
import type { Doc } from "./_generated/dataModel"
import { v } from "convex/values"

import { calculateMatchRecapBaseline } from "../src/domain/match-results/match-recap-baseline"
import { canReceiveMatchRecap } from "../src/domain/match-results/match-recap-notifications"
import { internalAuthSecret } from "./discord_shared"
import { queueEventRecaps } from "./matchRecapStore"
import { getUserByIdentifier } from "./identity"

function assertSecret(secret: string) {
    if (secret !== internalAuthSecret()) throw new Error("Unauthorized.")
}

async function currentRecipient(ctx: QueryCtx, recap: Doc<"matchRecaps">) {
    if (
        recap.status !== "pending" ||
        !recap.userRecordId ||
        !recap.discordUserId ||
        !/^\d{17,20}$/.test(recap.discordUserId)
    )
        return null
    const user = await ctx.db.get(recap.userRecordId)
    if (
        !user ||
        user.discordId !== recap.discordUserId ||
        !canReceiveMatchRecap(user.matchRecapNotificationsEnabled)
    )
        return null
    const current = await getUserByIdentifier(ctx, recap.userId)
    return current?._id === user._id ? recap.discordUserId : null
}

async function pendingDelivery(
    ctx: QueryCtx,
    recap: Doc<"matchRecaps">,
    event: Doc<"events">
) {
    if (event.gameId === "wardogs") {
        if (
            !event.wardogsReportId ||
            !event.reviewedResult ||
            event.reviewedResult.status !== "confirmed" ||
            recap.resultVersion !== event.reviewedResult.version ||
            !Number.isFinite(Date.parse(event.reviewedResult.reviewedAt ?? ""))
        )
            return null
        const panels = await ctx.db
            .query("discordPublicPanels")
            .withIndex("guildId", (q) => q.eq("guildId", event.guildId))
            .collect()
        const panel = panels.find(
            (panel) =>
                panel.kind === "results" &&
                panel.gameId === "wardogs" &&
                panel.enabled
        )
        if (panel) {
            const key = `panel:${panel._id}:result:${event._id}`
            const publication = await ctx.db
                .query("discordPublications")
                .withIndex("guild_key", (q) =>
                    q.eq("guildId", event.guildId).eq("key", key)
                )
                .unique()
            if (
                !publication?.messageId ||
                publication.channelId !== panel.channelId ||
                publication.error ||
                (publication.lastSuccessAt ?? 0) <
                    Date.parse(event.reviewedResult.reviewedAt ?? "")
            )
                return null
        }
    }
    const discordUserId = await currentRecipient(ctx, recap)
    if (!discordUserId) return null
    const stats = await ctx.db
        .query("playerStats")
        .withIndex("userId", (q) => q.eq("userId", recap.userId))
        .collect()
    const current = stats
        .map((stat) => stat.matches[String(event._id)])
        .find(Boolean)
    if (!current) return null
    return {
        recapId: recap._id,
        userId: recap.userId,
        discordUserId,
        eventName: event.name,
        mapName: current.mapName,
        kills: current.kills,
        deaths: current.deaths,
        kd: current.killDeathRatio,
        ...(event.gameId === "wardogs"
            ? { cashDelta: current.cashDelta ?? null }
            : {}),
        previousTen: recap.previousTen,
    }
}

/** Queues one recap only for a person who both played in a squad slot and has
 * a linked player-stat row for this event. */
export const queueForPublishedResult = mutation({
    args: {
        secret: v.string(),
        eventId: v.id("events"),
        baselines: v.array(
            v.object({
                userId: v.string(),
                matches: v.number(),
                kills: v.number(),
                deaths: v.number(),
                kd: v.number(),
                cashDelta: v.optional(v.union(v.number(), v.null())),
            })
        ),
    },
    handler: async (ctx, args) => {
        assertSecret(args.secret)
        return queueEventRecaps(ctx, args.eventId, args.baselines)
    },
})

export const listPendingForEvent = query({
    args: {
        secret: v.string(),
        eventId: v.id("events"),
        deliveryVersion: v.optional(v.literal(2)),
    },
    handler: async (ctx, args) => {
        assertSecret(args.secret)
        // Older bots interpret userId as a Discord subject; never give them this queue.
        if (args.deliveryVersion !== 2) return []
        const [event, recaps] = await Promise.all([
            ctx.db.get(args.eventId),
            ctx.db
                .query("matchRecaps")
                .withIndex("eventId", (q) => q.eq("eventId", args.eventId))
                .collect(),
        ])
        if (!event) return []
        const deliveries = await Promise.all(
            recaps.map((recap) => pendingDelivery(ctx, recap, event))
        )
        return deliveries.filter((delivery) => delivery !== null)
    },
})

export const prepareDelivery = query({
    args: {
        secret: v.string(),
        recapId: v.id("matchRecaps"),
        eventId: v.id("events"),
        discordUserId: v.string(),
    },
    handler: async (ctx, args) => {
        assertSecret(args.secret)
        const recap = await ctx.db.get(args.recapId)
        if (
            !recap ||
            recap.eventId !== args.eventId ||
            recap.discordUserId !== args.discordUserId
        )
            return null
        const event = await ctx.db.get(recap.eventId)
        return event ? pendingDelivery(ctx, recap, event) : null
    },
})

/**
 * A sent recap's numbers again, so "Vypnout shrnutí" / "Zapnout shrnutí"
 * can redraw the same DM (board L2-50). Only the recap's own Discord
 * recipient is answered; internal secret only.
 */
export const recapCard = query({
    args: {
        secret: v.string(),
        eventId: v.string(),
        discordUserId: v.string(),
    },
    handler: async (ctx, args) => {
        assertSecret(args.secret)
        const eventId = ctx.db.normalizeId("events", args.eventId)
        const event = eventId ? await ctx.db.get(eventId) : null
        if (!event) return null
        const recap = (
            await ctx.db
                .query("matchRecaps")
                .withIndex("eventId", (q) => q.eq("eventId", event._id))
                .collect()
        ).find((row) => row.discordUserId === args.discordUserId)
        if (!recap) return null
        const stats = await ctx.db
            .query("playerStats")
            .withIndex("userId", (q) => q.eq("userId", recap.userId))
            .collect()
        const current = stats
            .map((stat) => stat.matches[String(event._id)])
            .find(Boolean)
        if (!current) return null
        return {
            userId: recap.userId,
            mapName: current.mapName,
            kills: current.kills,
            deaths: current.deaths,
            kd: current.killDeathRatio,
            ...(event.gameId === "wardogs"
                ? { cashDelta: current.cashDelta ?? null }
                : {}),
            previousTen: recap.previousTen,
        }
    },
})

export const markSent = mutation({
    args: {
        secret: v.string(),
        recapId: v.id("matchRecaps"),
        discordUserId: v.string(),
    },
    handler: async (ctx, args) => {
        assertSecret(args.secret)
        const recap = await ctx.db.get(args.recapId)
        if (
            recap &&
            recap.status === "pending" &&
            recap.discordUserId === args.discordUserId
        )
            await ctx.db.patch(recap._id, {
                status: "sent",
                sentAt: new Date().toISOString(),
            })
    },
})

export const captureBaselines = query({
    args: {
        secret: v.string(),
        userIds: v.array(v.string()),
    },
    handler: async (ctx, args) => {
        assertSecret(args.secret)
        return await Promise.all(
            args.userIds.map(async (userId) => {
                // Match recap pages read directly from playerStats. Using the
                // same source prevents a delayed or missing derived-history
                // refresh from making the DM claim there is no prior history.
                const playerStats = await ctx.db
                    .query("playerStats")
                    .withIndex("userId", (q) => q.eq("userId", userId))
                    .collect()
                const baseline = calculateMatchRecapBaseline(
                    playerStats.flatMap((stat) => Object.values(stat.matches))
                )
                return {
                    userId,
                    ...baseline,
                }
            })
        )
    },
})
