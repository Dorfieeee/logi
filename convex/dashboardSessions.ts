import {
    DASHBOARD_SESSION_TTL_MS,
    isDiscordSubject,
    isSsoOpaqueValue,
} from "../src/domain/identity/sso-policy"
import {
    activeDashboardSession,
    assertSessionGateway,
    invalidateUserSessions,
} from "./dashboardSessionStore"
import { normalizeUserDoc } from "../src/infrastructure/convex/server-read-model"
import { mutation, query, internalMutation } from "./_generated/server"
import { v } from "convex/values"

export const create = mutation({
    args: { secret: v.string(), subject: v.string(), sid: v.string() },
    handler: async (ctx, args) => {
        assertSessionGateway(args.secret)
        if (!isDiscordSubject(args.subject) || !isSsoOpaqueValue(args.sid))
            throw new Error("Invalid session.")
        const user = await ctx.db
            .query("users")
            .withIndex("discordId", (q) => q.eq("discordId", args.subject))
            .unique()
        if (!user || user.discordId !== args.subject)
            throw new Error("Linked account required.")
        if (
            await ctx.db
                .query("dashboardSessions")
                .withIndex("sid", (q) => q.eq("sid", args.sid))
                .unique()
        )
            throw new Error("Session exists.")
        const now = Date.now()
        if (user.firstSignedInAt === undefined)
            await ctx.db.patch(user._id, { firstSignedInAt: now })
        const expiresAt = now + DASHBOARD_SESSION_TTL_MS
        await ctx.db.insert("dashboardSessions", {
            sid: args.sid,
            subject: args.subject,
            userRecordId: user._id,
            userSessionVersion: user.sessionVersion ?? 0,
            createdAt: now,
            expiresAt,
        })
        return {
            sid: args.sid,
            subject: args.subject,
            userRecordId: String(user._id),
            createdAt: now,
            expiresAt,
        }
    },
})

const binding = {
    secret: v.string(),
    sid: v.string(),
    subject: v.string(),
    userRecordId: v.string(),
}
export const validate = query({
    args: binding,
    handler: async (ctx, args) => {
        assertSessionGateway(args.secret)
        const current = await activeDashboardSession(
            ctx,
            args.sid,
            args.subject,
            args.userRecordId
        )
        return current
            ? {
                  createdAt: current.session.createdAt,
                  expiresAt: current.session.expiresAt,
              }
            : null
    },
})
export const getUser = query({
    args: binding,
    handler: async (ctx, args) => {
        assertSessionGateway(args.secret)
        const current = await activeDashboardSession(
            ctx,
            args.sid,
            args.subject,
            args.userRecordId
        )
        return current ? normalizeUserDoc(current.user) : null
    },
})
export const revoke = mutation({
    args: { ...binding, allSessions: v.boolean() },
    handler: async (ctx, args) => {
        assertSessionGateway(args.secret)
        const current = await activeDashboardSession(
            ctx,
            args.sid,
            args.subject,
            args.userRecordId
        )
        if (!current) return
        if (args.allSessions)
            await invalidateUserSessions(ctx, current.user._id)
        else await ctx.db.patch(current.session._id, { revokedAt: Date.now() })
    },
})
export const prune = internalMutation({
    args: {},
    handler: async (ctx) => {
        for (const table of [
            "dashboardSessions",
            "ssoAuthorizationCodes",
            "ssoAccessTokens",
        ] as const) {
            const expired = await ctx.db
                .query(table)
                .withIndex("expiresAt", (q) =>
                    q.lt("expiresAt", Date.now() - 86400_000)
                )
                .take(250)
            for (const row of expired) await ctx.db.delete(row._id)
        }
    },
})
