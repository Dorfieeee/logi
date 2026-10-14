import { readWardogsMatchReport } from "./wardogsMatchReportStore"
import { allowsApiKeyRead } from "../src/domain/api/key-access"
import { assertInternalSecret } from "./discord_shared"
import { query } from "./_generated/server"
import { v } from "convex/values"
export const get = query({
    args: {
        secret: v.string(),
        eventId: v.id("events"),
        guildId: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        return readWardogsMatchReport(ctx, args.eventId, args.guildId)
    },
})
export const getForKey = query({
    args: { secret: v.string(), keyHash: v.string(), eventId: v.id("events") },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const key = await ctx.db
            .query("apiKeys")
            .withIndex("keyHash", (q) => q.eq("keyHash", args.keyHash))
            .unique()
        if (
            !key ||
            key.revokedAt ||
            !allowsApiKeyRead(key.readAccess, "matches", "wardogs")
        )
            return null
        return readWardogsMatchReport(ctx, args.eventId, key.guildId)
    },
})
