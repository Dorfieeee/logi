import {
    linkedSteamIds,
    parseSteamId,
} from "../src/domain/player-stats/player-stats"
import { retainedHistoryGame } from "../src/domain/game-data/history-rules"
import { historyFiltersSchema } from "../src/domain/game-data/history"
import { historyHead, projectHistory } from "./gameHistoryStore"
import { assertSessionGateway } from "./dashboardSessionStore"
import type { QueryCtx } from "./_generated/server"
import { mutation } from "./integrationMutation"
import { query } from "./_generated/server"
import { v } from "convex/values"

const scope = {
    secret: v.string(),
    guildId: v.string(),
    requesterId: v.string(),
    observedAt: v.number(),
}
type Scope = {
    secret: string
    guildId: string
    requesterId: string
    observedAt: number
}
/** The trusted Discord gateway supplies bounded-age membership evidence for each call. */
async function authorize(ctx: Pick<QueryCtx, "db">, args: Scope) {
    assertSessionGateway(args.secret)
    if (
        !/^\d{17,20}$/.test(args.guildId) ||
        !/^\d{17,20}$/.test(args.requesterId) ||
        !Number.isSafeInteger(args.observedAt) ||
        Date.now() - args.observedAt > 10_000 ||
        args.observedAt > Date.now() + 1000
    )
        throw new Error("stale_member")
    const config = await ctx.db
        .query("discordConfigs")
        .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
        .unique()
    if (!config) throw new Error("unconfigured_guild")
    return config
}
function exactUser(ctx: Pick<QueryCtx, "db">, id: string) {
    if (!/^\d{17,20}$/.test(id)) throw new Error("invalid_member")
    return ctx.db
        .query("users")
        .withIndex("discordId", (q) => q.eq("discordId", id))
        .unique()
}

export const account = query({
    args: { ...scope, targetId: v.string() },
    handler: async (ctx, args) => {
        const config = await authorize(ctx, args),
            user = await exactUser(ctx, args.targetId)
        return {
            steamIds: linkedSteamIds(user?.platformIds ?? []),
            name: user?.name ?? null,
            language: config.defaultLanguage ?? "en",
        }
    },
})

export const linkSteam = mutation({
    args: {
        ...scope,
        steamId: v.string(),
        name: v.string(),
        expectedSteamIds: v.array(v.string()),
    },
    handler: async (ctx, args) => {
        await authorize(ctx, args)
        const steamId = parseSteamId(args.steamId)
        if (!steamId || steamId !== args.steamId)
            throw new Error("invalid_steam")
        const user = await exactUser(ctx, args.requesterId)
        if (!user) {
            const collision = await ctx.db
                .query("users")
                .withIndex("id", (q) => q.eq("id", args.requesterId))
                .unique()
            if (collision) throw new Error("identity_conflict")
        }
        const current = linkedSteamIds(user?.platformIds ?? []).sort()
        if (
            JSON.stringify(current) !==
            JSON.stringify([...new Set(args.expectedSteamIds)].sort())
        )
            throw new Error("link_changed")
        const verified = await ctx.db
            .query("platformIdentityLinks")
            .withIndex("platform_platformId_active", (q) =>
                q
                    .eq("platform", "steam")
                    .eq("platformId", steamId)
                    .eq("active", true)
            )
            .unique()
        if (verified && verified.discordUserId !== args.requesterId)
            throw new Error("already_linked")
        // The legacy array has no unique index. Bound the compatibility check and
        // fail closed instead of silently skipping records in a large installation.
        const users = await ctx.db.query("users").take(5001)
        if (users.length > 5000) throw new Error("link_review_required")
        if (
            users.some(
                (row) =>
                    row._id !== user?._id &&
                    linkedSteamIds(row.platformIds ?? []).includes(steamId)
            )
        )
            throw new Error("already_linked")
        const now = new Date().toISOString(),
            platformIds = [
                ...(user?.platformIds ?? []).filter(
                    (id) => parseSteamId(id) === null
                ),
                `steam:${steamId}`,
            ]
        if (user) await ctx.db.patch(user._id, { platformIds, updatedAt: now })
        else
            await ctx.db.insert("users", {
                id: args.requesterId,
                discordId: args.requesterId,
                name: args.name.trim().slice(0, 200) || "Player",
                avatar: "https://cdn.discordapp.com/embed/avatars/0.png",
                platformIds,
                managedGuildIds: [],
                mercenaryGuildIds: [],
                isStreamer: false,
                score: 0,
                scores: {},
                createdAt: now,
                updatedAt: now,
            })
        return { steamId }
    },
})

export const history = query({
    args: {
        ...scope,
        steamId: v.optional(v.string()),
        cursor: v.union(v.string(), v.null()),
        revision: v.optional(v.string()),
        filters: v.object({
            sourceId: v.optional(v.string()),
            from: v.optional(v.string()),
            until: v.optional(v.string()),
        }),
    },
    handler: async (ctx, args) => {
        await authorize(ctx, args)
        if (
            args.steamId !== undefined &&
            parseSteamId(args.steamId) !== args.steamId
        )
            throw new Error("invalid_steam")
        if (
            args.cursor !== null &&
            (!args.revision || args.cursor.length > 8192)
        )
            throw new Error("invalid_cursor")
        const filters = historyFiltersSchema.parse(args.filters),
            head = await historyHead(ctx, args.guildId),
            revision = head?.revision ?? "0"
        if (args.revision !== undefined && args.revision !== revision)
            return { resetRequired: true as const }
        const from = filters.from ?? "0000",
            until = filters.until ?? "9999"
        const rows = filters.sourceId
            ? ctx.db
                  .query("serverGameHistory")
                  .withIndex("guildId_sourceId_endedAt", (q) =>
                      q
                          .eq("guildId", args.guildId)
                          .eq("sourceId", filters.sourceId!)
                          .gte("endedAt", from)
                          .lt("endedAt", until)
                  )
            : ctx.db
                  .query("serverGameHistory")
                  .withIndex("guildId_gameId_endedAt", (q) =>
                      q
                          .eq("guildId", args.guildId)
                          .eq("gameId", undefined)
                          .gte("endedAt", from)
                          .lt("endedAt", until)
                  )
        const page = await rows.order("desc").paginate({
            cursor: args.cursor,
            numItems: 20,
            maximumRowsRead: 20,
        })
        const items = page.page
            .filter((row) => retainedHistoryGame(row) === "wardogs")
            .map(projectHistory)
            .map((row) =>
                args.steamId
                    ? {
                          ...row,
                          session: {
                              ...row.session,
                              players: row.session.players.filter(
                                  (p) =>
                                      p.platform === "steam" &&
                                      p.platformId === args.steamId
                              ),
                          },
                      }
                    : row
            )
            .filter((row) => !args.steamId || row.session.players.length)
        return {
            items,
            revision,
            nextCursor: page.isDone ? null : page.continueCursor,
            lastCollectedAt: head?.lastCollectedAt ?? null,
        }
    },
})
