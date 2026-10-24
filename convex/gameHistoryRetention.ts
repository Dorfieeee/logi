import {
    historyRetentionCutoff,
    historyRetentionSettingsSchema,
} from "../src/domain/game-data/history-retention"
import { retainedHistoryGame } from "../src/domain/game-data/history-rules"
import { dashboardActor, authorizeDashboardAdmin } from "./dashboardActor"
import { internalMutation, mutation, query } from "./_generated/server"
import { historyHead, historySettings } from "./gameHistoryStore"
import { nextRevision } from "../src/domain/integrations/change"
import { appendIntegrationChange } from "./integrationChangeLog"
import { internal } from "./_generated/api"
import { v } from "convex/values"

const access = {
    secret: v.string(),
    guildId: v.string(),
    gameId: v.optional(
        v.union(v.literal("wardogs"), v.literal("hell_let_loose"))
    ),
    actor: dashboardActor,
}
/** Deleting is paced so one workspace cannot monopolise a transaction. */
const PRUNE_BATCH = 50

export const read = query({
    args: access,
    handler: async (ctx, args) => {
        await authorizeDashboardAdmin(ctx, args)
        const row = await historySettings(ctx, args.guildId, args.gameId)
        return {
            retentionDays: row?.retentionDays ?? null,
            updatedAt: row?.updatedAt ?? null,
        }
    },
})

/** Dashboard-session configuration only; a shorter window starts pruning at once. */
export const configure = mutation({
    args: { ...access, retentionDays: v.union(v.number(), v.null()) },
    handler: async (ctx, args) => {
        const admin = await authorizeDashboardAdmin(ctx, args)
        const settings = historyRetentionSettingsSchema.parse({
            retentionDays: args.retentionDays,
        })
        const existing = await historySettings(ctx, args.guildId, args.gameId)
        const value = {
            ...settings,
            updatedAt: new Date().toISOString(),
            updatedBy: admin.session.subject,
        }
        if (existing) await ctx.db.patch(existing._id, value)
        else
            await ctx.db.insert("gameHistorySettings", {
                guildId: args.guildId,
                ...(args.gameId === "hell_let_loose"
                    ? { gameId: args.gameId }
                    : {}),
                ...value,
            })
        if (settings.retentionDays !== null)
            await ctx.scheduler.runAfter(
                0,
                internal.gameHistoryRetention.prune,
                {
                    guildId: args.guildId,
                    ...(args.gameId === "hell_let_loose"
                        ? { gameId: args.gameId }
                        : {}),
                }
            )
        return settings
    },
})

/** Removes expired retained games in batches and advances the history revision so
 * consumers rebuild their totals instead of keeping deleted contributions. */
export const prune = internalMutation({
    args: {
        guildId: v.string(),
        gameId: access.gameId,
        cursor: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const gameId = args.gameId ?? "wardogs"
        const cutoff = historyRetentionCutoff(
            await historySettings(ctx, args.guildId, gameId),
            Date.now()
        )
        if (!cutoff) return { deleted: 0 }
        const page = await ctx.db
            .query("serverGameHistory")
            .withIndex("guildId_gameId_endedAt", (q) =>
                q
                    .eq("guildId", args.guildId)
                    .eq("gameId", gameId === "wardogs" ? undefined : gameId)
                    .lt("endedAt", cutoff)
            )
            .paginate({
                cursor: args.cursor ?? null,
                numItems: PRUNE_BATCH,
                maximumRowsRead: PRUNE_BATCH,
                maximumBytesRead: 1_000_000,
            })
        const rows = page.page.filter(
            (row) => retainedHistoryGame(row) === gameId
        )
        for (const row of rows) {
            await ctx.db.delete(row._id)
            await appendIntegrationChange(ctx, {
                guildId: args.guildId,
                gameId,
                resource: "server-game-history",
                id: String(row._id),
                operation: "remove",
            })
        }
        if (rows.length) {
            const head = await historyHead(ctx, args.guildId, gameId)
            if (head)
                await ctx.db.patch(head._id, {
                    revision: nextRevision(head.revision),
                })
            else
                await ctx.db.insert("serverGameHistoryHeads", {
                    guildId: args.guildId,
                    ...(gameId === "hell_let_loose" ? { gameId } : {}),
                    revision: nextRevision("0"),
                    lastCollectedAt: new Date().toISOString(),
                })
        }
        if (!page.isDone)
            await ctx.scheduler.runAfter(
                0,
                internal.gameHistoryRetention.prune,
                {
                    guildId: args.guildId,
                    ...(gameId === "hell_let_loose" ? { gameId } : {}),
                    cursor: page.continueCursor,
                }
            )
        return { deleted: rows.length }
    },
})

export const pruneDue = internalMutation({
    args: {},
    handler: async (ctx) => {
        const rows = await ctx.db.query("gameHistorySettings").take(500)
        for (const row of rows)
            if (row.retentionDays !== null)
                await ctx.scheduler.runAfter(
                    0,
                    internal.gameHistoryRetention.prune,
                    {
                        guildId: row.guildId,
                        ...(row.gameId === "hell_let_loose"
                            ? { gameId: row.gameId }
                            : {}),
                    }
                )
    },
})
