import { gwlMatchSchema, gwlSlotSchema } from "../src/domain/gwl/contracts"
import { internalMutation } from "./integrationMutation"
import { slotMatches } from "../src/domain/gwl/mapping"
import { internalQuery } from "./_generated/server"
import { getGuildByDiscordId } from "./identity"
import { v } from "convex/values"

export const reserve = internalMutation({
    args: { keyHash: v.string() },
    handler: async (ctx, args) => {
        const now = Date.now(),
            window = Math.floor(now / 60_000)
        for (const [key, limit] of [
            ["address", 180],
            [`key:${args.keyHash}`, 90],
        ] as const) {
            const row = await ctx.db
                .query("gwlBudgets")
                .withIndex("key", (q) => q.eq("key", key))
                .unique()
            if (row?.window === window && row.count >= limit)
                return { ok: false, retryAt: (window + 1) * 60000 + 1000 }
        }
        for (const key of ["address", `key:${args.keyHash}`]) {
            const row = await ctx.db
                .query("gwlBudgets")
                .withIndex("key", (q) => q.eq("key", key))
                .unique()
            if (row)
                await ctx.db.patch(row._id, {
                    window,
                    count: row.window === window ? row.count + 1 : 1,
                })
            else await ctx.db.insert("gwlBudgets", { key, window, count: 1 })
        }
        return { ok: true, retryAt: 0 }
    },
})
export const records = internalQuery({
    args: { guildId: v.string() },
    handler: (ctx, args) =>
        ctx.db
            .query("leagueAutoImportFixtures")
            .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
            .take(1000),
})
export const cache = internalQuery({
    args: { configId: v.id("leagueAutoImportSettings"), path: v.string() },
    handler: (ctx, args) =>
        ctx.db
            .query("gwlReadCache")
            .withIndex("resource", (q) =>
                q.eq("configId", args.configId).eq("path", args.path)
            )
            .unique(),
})
export const cachePut = internalMutation({
    args: {
        configId: v.id("leagueAutoImportSettings"),
        path: v.string(),
        revision: v.number(),
        etag: v.string(),
        body: v.string(),
    },
    handler: async (ctx, args) => {
        const old = await ctx.db
            .query("gwlReadCache")
            .withIndex("resource", (q) =>
                q.eq("configId", args.configId).eq("path", args.path)
            )
            .unique()
        if (old) await ctx.db.patch(old._id, args)
        else await ctx.db.insert("gwlReadCache", args)
    },
})
export const flag = internalMutation({
    args: { guildId: v.string(), fixtureId: v.string(), issue: v.string() },
    handler: async (ctx, args) => {
        const row = await ctx.db
            .query("leagueAutoImportFixtures")
            .withIndex("identity", (q) =>
                q.eq("guildId", args.guildId).eq("fixtureId", args.fixtureId)
            )
            .unique()
        if (row)
            await ctx.db.patch(row._id, {
                issue: args.issue,
                updatedAt: Date.now(),
                cachePending: true,
            })
    },
})
/** Promote a slot binding in the same transaction; uncertain transitions never guess. */
export const promote = internalMutation({
    args: { configId: v.id("leagueAutoImportSettings"), matchJson: v.string() },
    handler: async (ctx, args) => {
        const config = await ctx.db.get(args.configId)
        if (!config?.enabled || config.provider !== "gwl" || config.testMode)
            return false
        const match = gwlMatchSchema.parse(JSON.parse(args.matchJson))
        const rows = await ctx.db
            .query("leagueAutoImportFixtures")
            .withIndex("guildId", (q) => q.eq("guildId", config.guildId))
            .take(1000)
        if (rows.some((r) => r.fixtureId === match.number)) return true
        const candidates = rows.filter(
            (r) =>
                r.slotJson &&
                slotMatches(gwlSlotSchema.parse(JSON.parse(r.slotJson)), match)
        )
        if (candidates.length > 1) {
            for (const row of candidates)
                await ctx.db.patch(row._id, {
                    issue: "ambiguous_slot_transition",
                    updatedAt: Date.now(),
                })
            return false
        }
        const row = candidates[0]
        if (!row) return true
        if (!row.eventId) return false
        const event = await ctx.db.get(row.eventId)
        const clan = await getGuildByDiscordId(ctx, config.guildId)
        const aliases = [
            config.guildId,
            ...(clan ? [String(clan._id), ...(clan.id ? [clan.id] : [])] : []),
        ]
        if (!event || event.hostEventId || !aliases.includes(event.guildId))
            return false
        await ctx.db.patch(row._id, {
            fixtureId: match.number,
            matchJson: args.matchJson,
            cachePending: true,
            updatedAt: Date.now(),
        })
        await ctx.db.patch(event._id, {
            wardogsFixtureUrl: `https://gwl.gg/matches/${match.number}`,
            updatedAt: new Date().toISOString(),
        })
        return true
    },
})
export const remember = internalMutation({
    args: {
        guildId: v.string(),
        fixtureId: v.string(),
        slotJson: v.optional(v.string()),
        matchJson: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const row = await ctx.db
            .query("leagueAutoImportFixtures")
            .withIndex("identity", (q) =>
                q.eq("guildId", args.guildId).eq("fixtureId", args.fixtureId)
            )
            .unique()
        if (!row) return
        await ctx.db.patch(row._id, {
            ...(args.slotJson ? { slotJson: args.slotJson } : {}),
            ...(args.matchJson ? { matchJson: args.matchJson } : {}),
            updatedAt: Date.now(),
        })
    },
})
