import {
    assertInternalSecret,
    calendarCategoriesValidator,
    membershipSettingsValidator,
    gameOverridesValidator,
    messageStyleValidator,
    normalizeConfigDoc,
    playerStatsServerValidator,
    statsSettingsValidator,
    ticketSettingsValidator,
} from "./discord_shared"
import { normalizeMessageStyle } from "../src/domain/discord-messages/message-style"
import { discordConfigPatch } from "../src/domain/workspaces/discord-config-patch"
import { managedRolePolicy } from "../src/domain/membership/managed-roles"
import { getGuildById, getGuildDiscordId } from "./identity"
import { mutation, query } from "./_generated/server"
import { GAME_IDS } from "../src/domain/games/game"
import { v } from "convex/values"

export const getConfigByGuild = query({
    args: {
        secret: v.string(),
        guildId: v.id("guilds"),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const guild = await getGuildById(ctx, args.guildId)
        if (!guild) {
            return null
        }
        const config = await ctx.db
            .query("discordConfigs")
            .withIndex("guildId", (q) =>
                q.eq("guildId", getGuildDiscordId(guild))
            )
            .unique()

        return config ? normalizeConfigDoc(config) : null
    },
})

export const getConfigByDiscordGuildId = query({
    args: {
        secret: v.string(),
        guildId: v.string(),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const config = await ctx.db
            .query("discordConfigs")
            .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
            .unique()

        return config ? normalizeConfigDoc(config) : null
    },
})

const clearableId = v.optional(v.union(v.string(), v.null()))

/**
 * Saves the clan colour and icon density of every bot message (Discord
 * messages settings). The style replaces the stored one; invalid values are
 * dropped, so a missing colour means Logi amber. Its own function keeps
 * `upsertConfig`'s arguments unchanged for older deployments.
 */
export const setMessageStyle = mutation({
    args: {
        secret: v.string(),
        guildId: v.id("guilds"),
        messageStyle: messageStyleValidator,
    },
    handler: async (ctx, { secret, guildId, messageStyle }) => {
        assertInternalSecret(secret)
        const guild = await getGuildById(ctx, guildId)
        if (!guild) throw new Error("Server not found.")
        const guildDiscordId = getGuildDiscordId(guild)
        const style = normalizeMessageStyle(messageStyle)
        const now = new Date().toISOString()
        const existing = await ctx.db
            .query("discordConfigs")
            .withIndex("guildId", (q) => q.eq("guildId", guildDiscordId))
            .unique()
        if (existing) {
            await ctx.db.patch(existing._id, {
                messageStyle: style,
                updatedAt: now,
            })
            return String(existing._id)
        }
        return String(
            await ctx.db.insert("discordConfigs", {
                guildId: guildDiscordId,
                timezone: "UTC",
                defaultLanguage: "en",
                calendarCategories: [],
                messageStyle: style,
                createdAt: now,
                updatedAt: now,
            })
        )
    },
})

/**
 * Saves the settings a dashboard page submits. Omitted fields keep their stored
 * values, so pages that own different settings cannot erase each other's work;
 * `null` clears a single Discord ID.
 */
export const upsertConfig = mutation({
    args: {
        secret: v.string(),
        guildId: v.id("guilds"),
        timezone: v.optional(v.string()),
        defaultLanguage: v.optional(
            v.union(v.literal("en"), v.literal("cs"), v.literal("de"))
        ),
        announcementsChannelId: clearableId,
        eventInfoChannelId: clearableId,
        eventResultsChannelId: clearableId,
        errorsChannelId: clearableId,
        calendarChannelId: clearableId,
        calendarCategories: v.optional(calendarCategoriesValidator),
        forumCategoryId: clearableId,
        meetingChannelId: clearableId,
        squadVoiceCategoryId: clearableId,
        clanRoleId: clearableId,
        dashboardAdminRoleId: clearableId,
        playerStatsServers: v.optional(v.array(playerStatsServerValidator)),
        ticketSettings: v.optional(ticketSettingsValidator),
        membershipSettings: v.optional(membershipSettingsValidator),
        statsSettings: v.optional(statsSettingsValidator),
        gameOverrides: v.optional(gameOverridesValidator),
    },
    handler: async (ctx, { secret, guildId, ...input }) => {
        assertInternalSecret(secret)

        const guild = await getGuildById(ctx, guildId)
        if (!guild) {
            throw new Error("Server not found.")
        }
        const guildDiscordId = getGuildDiscordId(guild)

        const now = new Date().toISOString()
        const updates = discordConfigPatch(input)

        const existing = await ctx.db
            .query("discordConfigs")
            .withIndex("guildId", (q) => q.eq("guildId", guildDiscordId))
            .unique()

        const merged = { ...existing, ...updates }
        for (const gameId of GAME_IDS) managedRolePolicy(merged, gameId)

        if (existing) {
            await ctx.db.patch(existing._id, { ...updates, updatedAt: now })
            return String(existing._id)
        }

        const configId = await ctx.db.insert("discordConfigs", {
            ...updates,
            guildId: guildDiscordId,
            timezone: input.timezone ?? "UTC",
            defaultLanguage: input.defaultLanguage ?? "en",
            calendarCategories: updates.calendarCategories ?? [],
            createdAt: now,
            updatedAt: now,
        })

        return String(configId)
    },
})

export const updateTicketPanelState = mutation({
    args: {
        secret: v.string(),
        guildId: v.string(),
        ticketPanelMessageId: v.optional(v.string()),
        ticketPanelLastConfigUpdatedAt: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)

        const config = await ctx.db
            .query("discordConfigs")
            .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
            .unique()

        if (!config) {
            throw new Error("Discord config not found.")
        }

        await ctx.db.patch(config._id, {
            ticketPanelMessageId: args.ticketPanelMessageId,
            ticketPanelLastConfigUpdatedAt: args.ticketPanelLastConfigUpdatedAt,
        })

        return { ok: true }
    },
})

export const updateMembershipPanelState = mutation({
    args: {
        secret: v.string(),
        guildId: v.string(),
        gameId: v.optional(v.string()),
        membershipPanelMessageId: v.optional(v.string()),
        membershipPanelLastConfigUpdatedAt: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)

        const config = await ctx.db
            .query("discordConfigs")
            .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
            .unique()

        if (!config) {
            throw new Error("Discord config not found.")
        }

        if (args.gameId) {
            await ctx.db.patch(config._id, {
                gameOverrides: {
                    ...config.gameOverrides,
                    [args.gameId]: {
                        ...(config.gameOverrides?.[
                            args.gameId as keyof typeof config.gameOverrides
                        ] ?? {}),
                        membershipPanelMessageId: args.membershipPanelMessageId,
                        membershipPanelLastConfigUpdatedAt:
                            args.membershipPanelLastConfigUpdatedAt,
                    },
                },
            })
        } else {
            await ctx.db.patch(config._id, {
                membershipPanelMessageId: args.membershipPanelMessageId,
                membershipPanelLastConfigUpdatedAt:
                    args.membershipPanelLastConfigUpdatedAt,
            })
        }

        return { ok: true }
    },
})

export const updateCalendarPanelState = mutation({
    args: {
        secret: v.string(),
        guildId: v.string(),
        calendarMessageChannelId: v.optional(v.string()),
        calendarMessageId: v.optional(v.string()),
        calendarMessageLastConfigUpdatedAt: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)

        const config = await ctx.db
            .query("discordConfigs")
            .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
            .unique()

        if (!config) {
            throw new Error("Discord config not found.")
        }

        await ctx.db.patch(config._id, {
            calendarMessageChannelId: args.calendarMessageChannelId,
            calendarMessageId: args.calendarMessageId,
            calendarMessageLastConfigUpdatedAt:
                args.calendarMessageLastConfigUpdatedAt,
        })

        return { ok: true }
    },
})

export const backfillDefaultLanguages = mutation({
    args: {
        secret: v.string(),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)

        const now = new Date().toISOString()
        const guilds = await ctx.db.query("guilds").collect()
        const configs = await ctx.db.query("discordConfigs").collect()
        const configByGuildId = new Map(
            configs.map((config) => [config.guildId, config])
        )

        let patchedCount = 0
        let insertedCount = 0

        for (const config of configs) {
            if (config.defaultLanguage) {
                continue
            }

            await ctx.db.patch(config._id, {
                defaultLanguage: "en",
                updatedAt: now,
            })
            patchedCount += 1
        }

        for (const guild of guilds) {
            if (configByGuildId.has(getGuildDiscordId(guild))) {
                continue
            }

            await ctx.db.insert("discordConfigs", {
                guildId: getGuildDiscordId(guild),
                timezone: "UTC",
                defaultLanguage: "en",
                createdAt: now,
                updatedAt: now,
            })
            insertedCount += 1
        }

        return { patchedCount, insertedCount }
    },
})
