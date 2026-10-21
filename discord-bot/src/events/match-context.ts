/**
 * Turns the bot's sync records into the inputs of the shared roster,
 * forum and DM cards (`src/domain/discord-messages/`): the match title,
 * category, map label and meeting channel of an event, the clan's names and
 * groups, and the DM frame "Klan <Název> · Nastavit zprávy". Discord-free
 * except for resolving member names.
 */

import type { Client, Guild } from "discord.js"

import type {
    RosterCardContext,
    RosterCardEvent,
    RosterCardGroup,
} from "../../../src/domain/discord-messages/roster-message"
import type { DmFrame } from "../../../src/domain/discord-messages/direct-message-views"
import type { DiscordConfig, EventCategory, EventRecord, Group } from "../types"
import { matchTitle } from "../../../src/domain/discord-messages/match-text"
import { getRosterMessages } from "../../../src/lib/clan-language/rosters"
import { formatDiscordMapLabel } from "../../../src/lib/discord-map-label"
import { resolveClanLanguage } from "../../../src/lib/clan-language/core"
import { buildPublicRosterUrl } from "../utils"
import { env } from "../environment"

const normalize = (value?: string | null) => value?.trim().toLowerCase() ?? ""

/** The event's category with its colour; none for trainings. */
export function eventCategory(
    event: Pick<EventRecord, "kind" | "matchType">,
    categories: readonly EventCategory[] | undefined
): { label: string; color?: string } | undefined {
    if (event.kind === "training" || !normalize(event.matchType))
        return undefined
    const found = (categories ?? []).find(
        (category) => normalize(category.id) === normalize(event.matchType)
    )
    const label = found?.label?.trim() || event.matchType?.trim()
    return label ? { label, color: found?.color } : undefined
}

/** "Foy · den" in the clan language. */
export function eventMapLabel(
    event: Pick<EventRecord, "map" | "gameId">,
    language: string | undefined
) {
    return formatDiscordMapLabel(event.map, event.gameId, language)
}

/** The meeting voice channel: the event's own, else the clan's. */
export function meetingChannelOf(
    event: Pick<EventRecord, "meetingChannelId">,
    config: Pick<DiscordConfig, "meetingChannelId">
) {
    return (
        event.meetingChannelId?.trim() ||
        config.meetingChannelId?.trim() ||
        undefined
    )
}

/** An event as the roster cards read it. */
export function rosterCardEvent(
    event: EventRecord,
    config: DiscordConfig,
    categories?: readonly EventCategory[]
): RosterCardEvent {
    return {
        id: event.id,
        title: matchTitle(event),
        category: eventCategory(event, categories)?.label,
        mapLabel: eventMapLabel(event, config.defaultLanguage),
        registrationEnd: event.registrationEnd,
        meetingStart: event.meetingStart,
        gameStart: event.gameStart,
        meetingChannelId: meetingChannelOf(event, config),
        server: event.server,
        serverPassword: event.serverPassword,
        notices: event.absenceNotices?.map((notice) => ({
            userId: notice.userId,
            reason: notice.reason,
            kind: notice.kind,
        })),
        guildId: event.guildId,
    }
}

/** The clan's groups with their order and parent, for the roster sections. */
export function rosterCardGroups(groups: readonly Group[]): RosterCardGroup[] {
    return groups.map((group) => ({
        id: group.id,
        name: group.name,
        order: group.order,
        parentId: group.parentId,
    }))
}

/** Everything the roster cards need besides the roster. */
export function rosterCardContext(input: {
    config: DiscordConfig
    eventId: string
    names: Readonly<Record<string, string>>
    groups?: readonly Group[]
    now?: number
}): RosterCardContext {
    const language = resolveClanLanguage(input.config.defaultLanguage)
    return {
        copy: getRosterMessages(language),
        timeZone: input.config.timezone || "UTC",
        names: input.names,
        groups: input.groups ? rosterCardGroups(input.groups) : undefined,
        rosterUrl: buildPublicRosterUrl(input.eventId, language),
        now: input.now ?? Date.now(),
    }
}

/** The account page section a DM's footer opens ("Můj účet → Zprávy od bota"). */
export function dmSettingsUrl(language: string | undefined) {
    return new URL(
        `/${resolveClanLanguage(language)}/dashboard/settings/user#zpravy-od-bota`,
        env.appSiteUrl
    ).toString()
}

/** The frame of every DM: the clan's name, the settings link and its zone. */
export function dmFrame(
    config: Pick<DiscordConfig, "defaultLanguage" | "timezone">,
    clanName: string
): DmFrame {
    return {
        clanName: clanName.trim() || "Logi",
        settingsUrl: dmSettingsUrl(config.defaultLanguage),
        timeZone: config.timezone || "UTC",
    }
}

/**
 * Display names of members, for cards that show names (never a ping). The
 * current server display name wins over a stored projection; Discord's actual
 * username is the fallback when a display name is unavailable.
 */
export async function memberNames(
    guild: Guild | null | undefined,
    userIds: Iterable<string>,
    known: Readonly<Record<string, string>> = {}
) {
    const ids = [
        ...new Set([...userIds].filter((id) => /^\d{17,20}$/.test(id))),
    ]
    const names: Record<string, string> = { ...known }
    if (!guild || !ids.length) return names
    const members = await guild.members
        .fetch({ user: ids.slice(0, 100) })
        .catch(() => null)
    for (const [id, member] of members ?? []) {
        const name = member.displayName?.trim() || member.user.username?.trim()
        if (name) names[id] = name
    }
    return names
}

/** The guild of an event, also from a DM where the interaction has none. */
export async function eventGuild(client: Client, guildId: string) {
    return await client.guilds.fetch(guildId).catch(() => null)
}
