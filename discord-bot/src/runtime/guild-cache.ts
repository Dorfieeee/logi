import type {
    CalendarItem,
    DiscordConfig,
    Group,
    GuildCacheSnapshot,
    GuildRecord,
    SquadPreset,
    TopicPreset,
} from "../types"
import { convex, references } from "../convex"
import { logError, logInfo } from "../log"
import { env } from "../environment"

/**
 * One clan's configuration as the bot keeps it between syncs. Member
 * assignments are not cached: the sign-up reminder reads them when it is
 * due, so the cache subscription does not re-run on every assignment write.
 */
export type GuildRuntimeData = {
    guild: GuildRecord
    config?: DiscordConfig
    groups: Group[]
    calendarItems: CalendarItem[]
    squadPresets: SquadPreset[]
    topicPresets: TopicPreset[]
}

type GuildChangeHandler = (guildIds: string[]) => void

function byGuild<T extends { guildId: string }>(rows: readonly T[]) {
    const grouped = new Map<string, T[]>()
    for (const row of rows) {
        const group = grouped.get(row.guildId)
        if (group) group.push(row)
        else grouped.set(row.guildId, [row])
    }
    return grouped
}

export class GuildCache {
    private runtimeByGuildId = new Map<string, GuildRuntimeData>()
    private signaturesByGuildId = new Map<string, string>()
    private stopped = false
    private unsubscribe?: () => void

    async start(onGuildsChanged: GuildChangeHandler) {
        if (this.stopped) return
        const initialSnapshot = (await convex.query(
            references.listGuildCacheSnapshot,
            {
                secret: env.internalSecret,
            }
        )) as GuildCacheSnapshot
        if (this.stopped) return
        this.applySnapshot(initialSnapshot)
        logInfo("guild-cache", "Loaded initial guild snapshot", {
            guildCount: initialSnapshot.guilds.length,
            configCount: initialSnapshot.configs.length,
        })

        const watch = convex.watchQuery(references.listGuildCacheSnapshot, {
            secret: env.internalSecret,
        })
        this.unsubscribe = watch.onUpdate(() => {
            try {
                const snapshot = watch.localQueryResult() as
                    GuildCacheSnapshot | undefined
                if (!snapshot) {
                    return
                }

                const changedGuildIds = this.applySnapshot(snapshot)
                if (changedGuildIds.length > 0) {
                    logInfo("guild-cache", "Guild snapshot changed", {
                        changedGuildIds,
                        guildCount: snapshot.guilds.length,
                    })
                    onGuildsChanged(changedGuildIds)
                }
            } catch (error) {
                logError(
                    "guild-cache",
                    "Failed to process guild cache update",
                    { error }
                )
            }
        })
    }

    stop() {
        this.stopped = true
        this.unsubscribe?.()
    }

    get(guildId: string) {
        return this.runtimeByGuildId.get(guildId)
    }

    getAllGuildIds() {
        return [...this.runtimeByGuildId.keys()]
    }

    private applySnapshot(snapshot: GuildCacheSnapshot) {
        const nextRuntimeByGuildId = new Map<string, GuildRuntimeData>()
        const configs = byGuild(snapshot.configs)
        const groups = byGuild(snapshot.groups)
        const calendar = byGuild(snapshot.calendarItems)
        const squads = byGuild(snapshot.squadPresets)
        const topics = byGuild(snapshot.topicPresets)

        for (const guild of snapshot.guilds) {
            nextRuntimeByGuildId.set(guild.discordId, {
                guild,
                config: configs.get(guild.discordId)?.[0],
                groups: groups.get(guild.discordId) ?? [],
                calendarItems: calendar.get(guild.discordId) ?? [],
                squadPresets: squads.get(guild.discordId) ?? [],
                topicPresets: topics.get(guild.discordId) ?? [],
            })
        }

        const nextSignaturesByGuildId = new Map<string, string>()
        for (const [guildId, runtime] of nextRuntimeByGuildId) {
            nextSignaturesByGuildId.set(guildId, buildGuildSignature(runtime))
        }

        const changedGuildIds = new Set<string>()
        for (const [guildId, signature] of nextSignaturesByGuildId) {
            if (this.signaturesByGuildId.get(guildId) !== signature) {
                changedGuildIds.add(guildId)
            }
        }

        for (const guildId of this.signaturesByGuildId.keys()) {
            if (!nextSignaturesByGuildId.has(guildId)) {
                changedGuildIds.add(guildId)
            }
        }

        this.runtimeByGuildId = nextRuntimeByGuildId
        this.signaturesByGuildId = nextSignaturesByGuildId

        return [...changedGuildIds]
    }
}

export function hasConfiguredClanDiscordTarget(
    runtime: Pick<GuildRuntimeData, "config" | "groups">
) {
    const config = runtime.config
    if (!config) {
        return false
    }

    const topLevelIds = [
        config.announcementsChannelId,
        config.errorsChannelId,
        config.calendarChannelId,
        config.calendarMessageChannelId,
        config.forumCategoryId,
        config.meetingChannelId,
        config.clanRoleId,
        config.dashboardAdminRoleId,
        config.ticketPanelMessageId,
        config.membershipPanelMessageId,
    ]

    if (
        topLevelIds.some(Boolean) ||
        Object.values(config.gameOverrides ?? {}).some((game) =>
            Boolean(game?.announcementsChannelId)
        )
    ) {
        return true
    }

    if (runtime.groups.some((group) => Boolean(group.discordRoleId))) {
        return true
    }

    const ticketSettings = config.ticketSettings
    if (ticketSettings) {
        if (
            ticketSettings.submitChannelId ||
            ticketSettings.ticketParentChannelId ||
            ticketSettings.categories.some(
                (category) => category.supportRoleIds.length > 0
            )
        ) {
            return true
        }
    }

    const membershipSettings = config.membershipSettings
    if (membershipSettings) {
        if (
            membershipSettings.submitChannelId ||
            membershipSettings.applicationParentChannelId ||
            membershipSettings.categories.some(
                (category) =>
                    category.supportRoleIds.length > 0 ||
                    category.recruitRoleIds.length > 0 ||
                    category.finalRoleIds.length > 0
            )
        ) {
            return true
        }
    }

    return false
}

function buildGuildSignature(runtime: GuildRuntimeData) {
    const configSignature = runtime.config
        ? `${runtime.config.id}:${runtime.config.updatedAt}`
        : "no-config"

    return [
        `${runtime.guild.id}:${runtime.guild.updatedAt}`,
        configSignature,
        runtime.groups
            .map((group) => `${group.id}:${group.updatedAt}`)
            .sort()
            .join(","),
        runtime.calendarItems
            .map((item) => `${item.id}:${item.updatedAt}`)
            .sort()
            .join(","),
        runtime.squadPresets
            .map((preset) => `${preset.id}:${preset.updatedAt}`)
            .sort()
            .join(","),
        runtime.topicPresets
            .map((preset) => `${preset.id}:${preset.updatedAt}`)
            .sort()
            .join(","),
    ].join("|")
}
