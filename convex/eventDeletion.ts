import { authorizeDashboardAdmin, dashboardActor } from "./dashboardActor"
import { deleteEventInTransaction } from "./eventDeletionStore"
import { assertInternalSecret } from "./discord_shared"
import { mutation } from "./integrationMutation"
import { getGuildDiscordId } from "./identity"
import { query } from "./_generated/server"
import { v } from "convex/values"

export const remove = mutation({
    args: {
        secret: v.string(),
        serverId: v.id("guilds"),
        eventId: v.id("events"),
        actor: dashboardActor,
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const server = await ctx.db.get(args.serverId)
        if (!server) throw new Error("Server not found.")
        const guildId = getGuildDiscordId(server)
        await authorizeDashboardAdmin(ctx, { ...args, guildId })
        return deleteEventInTransaction(ctx, args.eventId, guildId)
    },
})

export const pending = query({
    args: { secret: v.string() },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const now = new Date().toISOString()
        const pending = await ctx.db
            .query("eventDeletionRequests")
            .withIndex("status_nextAttemptAt", (q) =>
                q.eq("status", "pending").lte("nextAttemptAt", now)
            )
            .take(20)
        const abandoned = await ctx.db
            .query("eventDeletionRequests")
            .withIndex("status_nextAttemptAt", (q) =>
                q.eq("status", "processing").lte("nextAttemptAt", now)
            )
            .take(20)
        return [...pending, ...abandoned].map((row) => String(row._id))
    },
})

export const claim = mutation({
    args: { secret: v.string(), requestId: v.id("eventDeletionRequests") },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const row = await ctx.db.get(args.requestId)
        const now = new Date().toISOString()
        if (!row || row.status === "failed" || row.nextAttemptAt > now)
            return null
        const leaseUntil = new Date(Date.now() + 300_000).toISOString()
        await ctx.db.patch(row._id, {
            status: "processing",
            attempts: row.attempts + 1,
            leaseUntil,
            nextAttemptAt: leaseUntil,
        })
        return { ...row, leaseUntil }
    },
})

export const finish = mutation({
    args: {
        secret: v.string(),
        requestId: v.id("eventDeletionRequests"),
        leaseUntil: v.string(),
        error: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const row = await ctx.db.get(args.requestId)
        if (
            !row ||
            row.status !== "processing" ||
            row.leaseUntil !== args.leaseUntil
        )
            return
        if (!args.error) {
            await ctx.db.delete(row._id)
            return
        }
        await ctx.db.patch(row._id, {
            status: row.attempts >= 10 ? "failed" : "pending",
            error: args.error.slice(0, 300),
            leaseUntil: undefined,
            nextAttemptAt: new Date(
                Date.now() + Math.min(3_600_000, 30_000 * 2 ** row.attempts)
            ).toISOString(),
        })
    },
})
