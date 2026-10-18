/**
 * The match announcement in the bot (board L1 1.0–1.8): turns a synced event
 * into the domain card (`src/domain/discord-messages/match-announcement.ts`)
 * and the message the kit sends, with the role ping above the card on the
 * first post only. Rosters, the forum and DMs have their own builders.
 */

import { createHash } from "node:crypto"

import {
    AttachmentBuilder,
    MessageFlags,
    TextDisplayBuilder,
    type MessageCreateOptions,
} from "discord.js"

import {
    announcementPingLine,
    buildAnnouncementView,
    matchCardFullTitle,
    type AnnouncementCounts,
    type AnnouncementSignupRoster,
    type AnnouncementResult,
    type MatchCardEvent,
} from "../../../src/domain/discord-messages/match-announcement"
import {
    deriveAnnouncementState,
    type AnnouncementState,
} from "../../../src/domain/events/announcement-state"
import {
    countSignups,
    readSignupGroupLimits,
} from "../../../src/domain/discord-messages/signup-counts"
import type {
    DiscordConfig,
    EventRecord,
    Group,
    Roster,
    SyncPayload,
} from "../types"
import {
    buildDiscordMessageLink,
    buildPublicMatchUrl,
    buildPublicRosterUrl,
} from "../utils"
import type { PanelFactionEmoji } from "../../../src/domain/discord-publications/panel-presentation"
import {
    buildCalendarLink,
    plainText,
} from "../../../src/domain/events/calendar-link"
import { getAnnouncementMessages } from "../../../src/lib/clan-language/announcements"
import { panelMapKey } from "../../../src/domain/discord-publications/panel-graphics"
import type { MessageMedia } from "../../../src/domain/discord-messages/message-view"
import { formatDiscordMarkdown } from "../../../src/lib/discord-markdown"
import { getEventMessages } from "../../../src/lib/clan-language/events"
import { resolveGameScope } from "../../../src/domain/games/game"
import { builtInMapImage } from "../public-panels/assets"
import { SIGNUP_NOT_ATTENDING } from "../constants"
import { messagePayload } from "../ui/message-kit"
import { formatMapLabel } from "../map-label"

/** Notes keep room for the rest of the card within Discord's 4,000 characters. */
const NOTES_LIMIT = 1_800

const SLOT_ORDER: Record<string, number> = { a: 0, b: 1, c: 2 }

/** Roles the first post pings: the clan role or the match's own roles (L1-B02). */
export function getAnnouncementPingRoleIds(
    payload: Pick<SyncPayload, "config">,
    event: Pick<EventRecord, "pingMode" | "pingRoleIds" | "pingClan">
) {
    const roleIds =
        event.pingMode === "roles"
            ? (event.pingRoleIds ?? [])
            : event.pingMode === "clan" ||
                (event.pingMode === undefined && event.pingClan)
              ? payload.config.clanRoleId
                  ? [payload.config.clanRoleId]
                  : []
              : []

    return [...new Set(roleIds.map((roleId) => roleId.trim()).filter(Boolean))]
}

export function findEventCategory(
    categories: SyncPayload["guild"]["eventCategories"] | undefined,
    matchType?: string
) {
    const id = matchType?.trim().toLowerCase()
    if (!id || !Array.isArray(categories)) return undefined
    return categories.find(
        (category) => category.id.trim().toLowerCase() === id
    )
}

/** The facts every card of a match shows, in the clan language. */
export function matchCardEventOf(input: {
    config: Pick<DiscordConfig, "guildId" | "timezone" | "defaultLanguage">
    event: EventRecord
    categories?: SyncPayload["guild"]["eventCategories"]
    /** The match's category when it is already known. */
    category?: { label: string; color?: string | null } | null
    factionEmoji?: PanelFactionEmoji
}): MatchCardEvent {
    const { event } = input
    const messages = getEventMessages(input.config.defaultLanguage)
    const category =
        event.kind === "match"
            ? (input.category ??
              findEventCategory(input.categories, event.matchType))
            : undefined
    const categoryLabel =
        event.kind === "match"
            ? (category?.label ?? event.matchType)?.trim()
            : undefined
    return {
        kind: event.kind,
        eventId: event.id,
        guildId: event.guildId || input.config.guildId,
        name: event.name,
        category: categoryLabel
            ? { label: categoryLabel, color: category?.color ?? null }
            : null,
        teams:
            event.kind === "match"
                ? [...(event.matchTeams ?? [])]
                      .sort(
                          (left, right) =>
                              (SLOT_ORDER[left.slot] ?? 9) -
                              (SLOT_ORDER[right.slot] ?? 9)
                      )
                      .map((team) => ({
                          code:
                              team.snapshot.shortCode?.trim() ||
                              team.snapshot.name,
                          side: team.side,
                      }))
                : [],
        side: event.side ?? null,
        mapLabel:
            event.kind === "match"
                ? (formatMapLabel(event.map, event.gameId, messages) ?? null)
                : null,
        server: event.kind === "training" ? (event.server ?? null) : null,
        meetingStart: event.meetingStart,
        gameStart: event.gameStart,
        registrationEnd: event.registrationEnd,
        timeZone: input.config.timezone,
        locale: messages.locale,
        factionEmoji: input.factionEmoji,
    }
}

/** Sign-up counts for the card: groups, reserves and who is not coming. */
export function announcementCountsOf(
    event: EventRecord,
    groups: readonly Group[]
): AnnouncementCounts {
    const participants = event.participants.length
        ? event.participants
        : event.signUps.map((signUp) => ({
              userId: signUp.userId,
              status:
                  signUp.group === SIGNUP_NOT_ATTENDING
                      ? ("not_attending" as const)
                      : ("attending" as const),
              group: signUp.group ?? null,
          }))
    const counts = countSignups({
        groups:
            event.kind === "match"
                ? groups.map((group) => ({ id: group.id, name: group.name }))
                : [],
        offeredGroupIds: event.signupGroupIds ?? null,
        signups: participants
            .filter((participant) => participant.status === "attending")
            .map((participant) => ({ group: participant.group })),
        limits: readSignupGroupLimits(
            (event as { signupGroupLimits?: unknown }).signupGroupLimits
        ),
    })
    return {
        groups: counts.groups,
        withoutGroup: counts.withoutGroup,
        total: counts.total,
        declined: participants.filter(
            (participant) => participant.status === "not_attending"
        ).length,
        generalSignup: Boolean(event.useGeneralSignup),
    }
}

function groupIcon(group: Group) {
    if (group.discordEmoji?.trim()) return group.discordEmoji.trim()
    const hex = group.color.replace("#", "")
    const value = Number.parseInt(hex, 16)
    if (!/^[0-9a-f]{6}$/i.test(hex) || !Number.isFinite(value)) return "⚪"
    const red = (value >> 16) & 255
    const green = (value >> 8) & 255
    const blue = value & 255
    if (Math.max(red, green, blue) - Math.min(red, green, blue) < 28)
        return "⚪"
    if (red >= green && red >= blue) return green > blue + 35 ? "🟠" : "🔴"
    if (green >= red && green >= blue) return blue > red + 35 ? "🔵" : "🟢"
    return "🔵"
}

/** Public roster for the card: offered groups and declined players by name. */
export function announcementSignupRosterOf(
    event: EventRecord,
    groups: readonly Group[],
    names: Readonly<Record<string, string>> = {},
    locale = "en"
): AnnouncementSignupRoster {
    const offered = event.signupGroupIds ? new Set(event.signupGroupIds) : null
    const visibleGroups = groups.filter(
        (group) => !offered || offered.has(group.id)
    )
    const groupIdByName = new Map(
        visibleGroups.map((group) => [group.name, group.id])
    )
    const byGroup = new Map(
        visibleGroups.map((group) => [group.id, [] as string[]])
    )
    const declined: string[] = []
    const participants = event.participants.length
        ? event.participants
        : event.signUps.map((signUp) => ({
              userId: signUp.userId,
              status:
                  signUp.group === SIGNUP_NOT_ATTENDING
                      ? ("not_attending" as const)
                      : ("attending" as const),
              group: signUp.group ?? null,
          }))
    for (const participant of participants) {
        const name =
            names[participant.userId]?.trim() || `<@${participant.userId}>`
        if (participant.status === "not_attending") {
            declined.push(name)
            continue
        }
        const groupId = byGroup.has(participant.group ?? "")
            ? participant.group!
            : groupIdByName.get(participant.group ?? "")
        if (groupId) byGroup.get(groupId)!.push(name)
    }
    const compare = new Intl.Collator(locale, { sensitivity: "base" }).compare
    return {
        groups: visibleGroups.map((group) => ({
            name: group.name,
            icon: groupIcon(group),
            names: (byGroup.get(group.id) ?? []).sort(compare),
        })),
        declined: declined.sort(compare),
    }
}

/** Places on a published roster and who confirmed (L1-37, L1-46). */
export function rosterFactsOf(event: EventRecord, roster: Roster) {
    const rostered = roster.squads.flatMap((squad) =>
        squad.players.filter((player) => player.id || player.customName?.trim())
    )
    const confirmable = rostered.filter((player) => player.id)
    const rosteredIds = new Set([
        ...confirmable.map((player) => player.id!),
        ...roster.reservePlayerIds,
    ])
    const notices = (event.absenceNotices ?? []).filter((notice) =>
        rosteredIds.has(notice.userId)
    )
    return {
        players: rostered.length,
        reserves: roster.reservePlayerIds.length,
        confirmation: {
            confirmed: confirmable.filter(
                (player) => player.ack || player.confirmed
            ).length,
            total: confirmable.length,
            late: notices.filter((notice) => notice.kind !== "cannot_come")
                .length,
            cannotCome: notices.filter(
                (notice) => notice.kind === "cannot_come"
            ).length,
        },
    }
}

export type AnnouncementOptions = {
    now?: Date
    factionEmoji?: PanelFactionEmoji
    forumChannelId?: string | null
    /** The roster card's own channel (`#info-akce`), when it has one. */
    rosterChannelId?: string | null
    /** Closed event-info cards show match facts and the roster, not sign-ups. */
    hideSignupRoster?: boolean
    /** The roster picture, when this card doubles as the roster (L1-43). */
    rosterImage?: MessageMedia | null
    thumbnail?: MessageMedia | null
    /** The announcement channel, for the calendar's link back (L1-142). */
    announcementChannelId?: string | null
    clanName?: string | null
    meetingChannelName?: string | null
    /** A Discord scheduled event exists for the match. */
    scheduledEvent?: boolean
    result?: AnnouncementResult | null
    publicMatch?: boolean
    resultsChannelId?: string | null
}

/** The card's state now. */
export function announcementStateOf(
    event: EventRecord,
    roster: Roster | undefined,
    now = new Date()
): AnnouncementState {
    return deriveAnnouncementState({
        event,
        rosterPublished: event.kind === "match" && Boolean(roster?.published),
        now,
    })
}

/** The announcement card as the kit's view. */
export function buildAnnouncementCard(
    payload: Pick<
        SyncPayload,
        "config" | "groups" | "guild" | "rosters" | "userDisplayNames"
    >,
    event: EventRecord,
    options: AnnouncementOptions = {}
) {
    const { config } = payload
    const copy = getAnnouncementMessages(config.defaultLanguage)
    const card = matchCardEventOf({
        config,
        event,
        categories: payload.guild.eventCategories,
        factionEmoji: options.factionEmoji,
    })
    const roster = payload.rosters.find(
        (item) => item.eventId === event.id && item.published
    )
    const state = announcementStateOf(event, roster, options.now)
    const rosterFacts =
        roster && event.kind === "match" ? rosterFactsOf(event, roster) : null
    const meetingChannelId =
        event.meetingChannelId?.trim() || config.meetingChannelId?.trim()
    const notes = formatDiscordMarkdown(event.notes || event.description)
    const announcementUrl = options.announcementChannelId
        ? buildDiscordMessageLink(config.guildId, options.announcementChannelId)
        : null
    const view = buildAnnouncementView({
        event: card,
        state,
        counts: announcementCountsOf(event, payload.groups),
        signupRoster: options.hideSignupRoster
            ? null
            : announcementSignupRosterOf(
                  event,
                  payload.groups,
                  payload.userDisplayNames,
                  card.locale
              ),
        roster: rosterFacts
            ? {
                  players: rosterFacts.players,
                  reserves: rosterFacts.reserves,
                  channelId: options.rosterChannelId ?? null,
                  image: options.rosterImage ?? null,
              }
            : null,
        confirmation: rosterFacts?.confirmation ?? null,
        notes:
            notes.length > NOTES_LIMIT
                ? `${notes.slice(0, NOTES_LIMIT - 1)}…`
                : notes,
        meetingChannelId: meetingChannelId ?? null,
        forumChannelId: options.forumChannelId ?? null,
        result: options.result ?? null,
        resultsChannelId: options.resultsChannelId ?? null,
        scheduledEvent: Boolean(options.scheduledEvent),
        thumbnail: options.thumbnail ?? null,
        image: /^https?:\/\//i.test(event.imageUrl?.trim() ?? "")
            ? { url: event.imageUrl!.trim(), description: event.name }
            : null,
        links: {
            calendar: buildCalendarLink({
                kind: event.kind,
                title: matchCardFullTitle(card, copy),
                meetingStart: event.meetingStart,
                gameStart: event.gameStart,
                gameEnd: event.gameEnd,
                mapLabel: card.mapLabel ? plainText(card.mapLabel) : null,
                server: card.server,
                clanName: options.clanName?.trim() || payload.guild?.name,
                meetingChannelName: options.meetingChannelName ?? null,
                announcementUrl,
                locale: card.locale,
                timeZone: config.timezone,
                copy,
            }),
            roster: buildPublicRosterUrl(event.id, config.defaultLanguage),
            match: options.publicMatch
                ? buildPublicMatchUrl(event.id, config.defaultLanguage)
                : null,
        },
        copy,
    })
    return { view, state }
}

/**
 * The map picture top right of the card (L1-15): Logi's own map art as a
 * small attachment, else the image the clan uploaded for the match.
 */
export async function announcementThumbnail(
    event: EventRecord,
    language: string
): Promise<{ media: MessageMedia; file?: AttachmentBuilder } | null> {
    const uploaded = event.thumbnailUrl?.trim()
    if (uploaded && /^https?:\/\//i.test(uploaded))
        return {
            media: {
                url: uploaded,
                description: plainText(event.name).slice(0, 200),
            },
        }
    if (event.kind !== "match") return null
    const game = resolveGameScope(event.gameId)
    const art = await builtInMapImage(
        game,
        panelMapKey(game, event.map),
        "thumb",
        language
    ).catch(() => null)
    if (art) {
        // A stable `logi-panel-…` name lets an edit reuse the attachment the
        // message already has instead of uploading it again.
        const name = `logi-panel-${art.name
            .replace(/\.webp$/, "")
            .replace(/[^a-z0-9-]/g, "-")}-${createHash("sha256")
            .update(art.bytes)
            .digest("hex")
            .slice(0, 12)}.webp`
        return {
            media: {
                url: `attachment://${name}`,
                description: art.description,
            },
            file: new AttachmentBuilder(art.bytes, {
                name,
                description: art.description,
            }),
        }
    }
    return null
}

/**
 * The message the bot sends: the role ping as a line above the card when it
 * pings, then the card. Nobody else is ever pinged.
 */
export function announcementMessage(
    view: ReturnType<typeof buildAnnouncementCard>["view"],
    options: {
        config: Pick<DiscordConfig, "defaultLanguage" | "messageStyle">
        pingRoleIds?: readonly string[]
        files?: AttachmentBuilder[]
    }
): MessageCreateOptions {
    const payload = messagePayload(view, {
        language: options.config.defaultLanguage,
        style: options.config.messageStyle,
    })
    const ping = announcementPingLine(options.pingRoleIds ?? [])
    return {
        components: ping
            ? [new TextDisplayBuilder().setContent(ping), ...payload.components]
            : payload.components,
        flags: MessageFlags.IsComponentsV2,
        files: options.files ?? [],
        allowedMentions: {
            parse: [],
            roles: ping ? [...new Set(options.pingRoleIds)] : [],
        },
    }
}
