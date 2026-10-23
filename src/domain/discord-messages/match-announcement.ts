/**
 * The match announcement card in `#oznameni` (board L1 1.0–1.8): one message
 * from the announcement to the result, edited in place. Its state is a chip
 * inside the card, the bar keeps the clan colour and the category is a chip
 * next to the title (L1-02, L1-07). The bot sends this view through the
 * message kit and the dashboard previews the same view, so the new-match flow
 * shows exactly what the bot posts.
 */

import {
    announcementActions,
    type AnnouncementAction,
    type AnnouncementState,
} from "@/domain/events/announcement-state"
import type { PanelFactionEmoji } from "@/domain/discord-publications/panel-presentation"
import { SIGNUP_NOT_ATTENDING, TRAINING_ATTEND } from "@/domain/events/types"
import { resolveClanOutcome, type ClanOutcome } from "./match-result"

import {
    escapeMarkdownText,
    type ChipTone,
    type MessageBlock,
    type MessageButton,
    type MessageChip,
    type MessageMedia,
    type MessageView,
} from "./message-view"
import { formatGroupCount, type SignupGroupCount } from "./signup-counts"
import { attendanceButtonIds, rosterButtonIds } from "./roster-message"
import type { MatchAnnouncementCopy } from "./match-announcement-copy"
import { discordTimestamp, fillTemplate } from "./format"
import { categoryChip, sidesRow } from "./match-text"

export { categoryChipTone } from "./match-text"

/** The facts every match card (announcement, replies, sign-up list) names. */
export type MatchCardEvent = {
    kind: "match" | "training"
    eventId: string
    guildId: string
    name: string
    category?: { label: string; color?: string | null } | null
    /** Assigned teams by slot with their stored side ("Allies", "Valkyra"). */
    teams: ReadonlyArray<{ code: string; side: string | null }>
    /** The clan's side when the match has no teams. */
    side?: string | null
    /** Markdown-safe map label, "Foy · den". */
    mapLabel?: string | null
    /** A training's server name (never its password, L1-03). */
    server?: string | null
    meetingStart: string
    gameStart: string
    gameEnd?: string | null
    registrationEnd: string
    /** The clan's time zone, for the weekday of a date. */
    timeZone: string
    /** The clan language's Intl locale (`cs-CZ`). */
    locale: string
    factionEmoji?: PanelFactionEmoji
    signupRestriction?: string | null
    attendeeRole?: string | null
}

export type AnnouncementCounts = {
    groups: readonly SignupGroupCount[]
    /** Attending without a group: reserves of full groups or general sign-ups. */
    withoutGroup: number
    /** Everyone attending, groups and reserves together. */
    total: number
    declined: number
    /** The match offers a sign-up without a group. */
    generalSignup?: boolean
}

/** The compact, public sign-up roster drawn directly in an announcement. */
export type AnnouncementSignupRoster = {
    groups: ReadonlyArray<{
        name: string
        /** A configured Discord emoji, or a colour-circle fallback. */
        icon: string
        names: readonly string[]
    }>
    declined: readonly string[]
}

export type AnnouncementResult = {
    outcome: ClanOutcome | null
    /** The clan's score first when the clan is known, else as reviewed. */
    scores: [number | null, number | null] | null
    reviewer?: string | null
}

export type AnnouncementViewInput = {
    event: MatchCardEvent
    state: AnnouncementState
    counts: AnnouncementCounts
    /** Roster places and reserves once it is published. */
    roster?: {
        players: number
        reserves: number
        /** The roster channel (`#info-akce`); none when the card is the roster. */
        channelId?: string | null
        /** The roster picture when this card doubles as the roster (L1-43). */
        image?: MessageMedia | null
    } | null
    /** Confirmations from the meeting on ("Potvrzeno 15 z 18"). */
    confirmation?: {
        confirmed: number
        total: number
        late: number
        cannotCome: number
    } | null
    /** Long-form event briefing, written in Discord-compatible Markdown. */
    description?: string | null
    notes?: string | null
    meetingChannelId?: string | null
    forumChannelId?: string | null
    result?: AnnouncementResult | null
    resultsChannelId?: string | null
    /** A Discord scheduled event exists, so a cancellation names it. */
    scheduledEvent?: boolean
    thumbnail?: MessageMedia | null
    /** The event's full-width briefing/embed image, below the sign-up roster. */
    image?: MessageMedia | null
    signupRoster?: AnnouncementSignupRoster | null
    links: { calendar: string; roster?: string | null; match?: string | null }
    copy: MatchAnnouncementCopy
}

/** The state chip and its dot colour (L1-09). */
export function announcementStateChip(
    state: AnnouncementState,
    copy: MatchAnnouncementCopy
): MessageChip {
    const tones: Record<AnnouncementState, ChipTone> = {
        open: "success",
        closed: "neutral",
        roster: "info",
        starting: "warning",
        playing: "success",
        played: "neutral",
        cancelled: "danger",
    }
    return { label: copy.states[state], tone: tones[state] }
}

/**
 * "VLK vs ROG" from the team codes, the event name otherwise; a training is
 * "Trénink · …" unless its name already says so (L1-11, L1-62).
 */
export function matchCardTitle(
    event: Pick<MatchCardEvent, "kind" | "name" | "teams" | "locale">,
    copy: MatchAnnouncementCopy
) {
    const name = event.name.replace(/[\s\p{Cc}]+/gu, " ").trim()
    if (event.kind === "training") {
        const word = copy.card.training
        return name
            .toLocaleLowerCase(event.locale)
            .includes(word.toLocaleLowerCase(event.locale))
            ? name
            : `${word} · ${name}`
    }
    const codes = event.teams
        .map((team) => team.code.replace(/[\s\p{Cc}]+/gu, " ").trim())
        .filter(Boolean)
    return codes.length >= 2 ? codes.join(` ${copy.card.versus} `) : name
}

/** "VLK vs ROG · Přátelák": the title with the category, for plain contexts. */
export function matchCardFullTitle(
    event: Pick<
        MatchCardEvent,
        "kind" | "name" | "teams" | "locale" | "category"
    >,
    copy: MatchAnnouncementCopy
) {
    const title = matchCardTitle(event, copy)
    const category = event.category?.label.trim()
    return event.kind === "match" && category && category !== title
        ? `${title} · ${category}`
        : title
}

/**
 * The sides row (L1-12): "`VLK` Spojenci ★  vs  `ROG` Osa ✚". Without teams
 * the clan's own side. The forum post and the DMs draw the same row through
 * the same function (L1-130).
 */
export function matchSidesLine(
    event: MatchCardEvent,
    copy: MatchAnnouncementCopy
) {
    if (event.kind !== "match") return undefined
    return sidesRow({
        teams: event.teams,
        side: event.side,
        factions: copy.card.factions,
        emoji: event.factionEmoji,
        versus: copy.card.versus,
    })
}

/** One localized Discord date/time timestamp; Discord supplies the weekday. */
export function weekdayTime(
    _event: Pick<MatchCardEvent, "locale" | "timeZone">,
    iso: string
) {
    return discordTimestamp(iso, "f") ?? ""
}

/** "so 10. 10. v 19:30": a closed deadline as a date at a time (L1-71, L1-95). */
export function weekdayAt(
    _event: Pick<MatchCardEvent, "locale" | "timeZone">,
    iso: string,
    _copy: MatchAnnouncementCopy
) {
    void _copy
    return discordTimestamp(iso, "f") ?? ""
}

/** "Tanky a Recon" in the clan language. */
export function joinNames(
    names: readonly string[],
    copy: MatchAnnouncementCopy
) {
    if (names.length <= 1) return names.join("")
    return `${names.slice(0, -1).join(", ")}${copy.card.and}${names[names.length - 1]}`
}

/** "**Přihlášeno 17** · Pěchota 12 · Tanky 4/6 · Recon 1/2" (L1-17, L1-29, L1-34). */
export function announcementCountsLine(
    input: {
        kind: "match" | "training"
        state: AnnouncementState
        counts: AnnouncementCounts
    },
    copy: MatchAnnouncementCopy
) {
    const { counts } = input
    const open = input.state === "open"
    const groups = input.kind === "match" ? counts.groups : []
    const signedUp = groups.length
        ? counts.total - counts.withoutGroup
        : counts.total
    const parts = [
        `**${fillTemplate(copy.card.signedUp, { count: String(signedUp) })}**`,
        ...groups.map((group) => {
            const name = escapeMarkdownText(group.name)
            if (!open) return `${name} ${group.count}`
            const text = formatGroupCount({ ...group, name })
            return group.max !== undefined && group.count >= group.max
                ? `${text} ${copy.card.full}`
                : text
        }),
    ]
    if (groups.length && counts.withoutGroup)
        parts.push(
            fillTemplate(
                counts.generalSignup
                    ? copy.card.withoutGroup
                    : copy.card.reserves,
                { count: String(counts.withoutGroup) }
            )
        )
    // A match lists who is not coming once sign-ups closed; a training always.
    if (counts.declined && (input.kind === "training" || !open))
        parts.push(
            fillTemplate(copy.card.declined, { count: String(counts.declined) })
        )
    return parts.join(" · ")
}

/** "**Potvrzeno 15 z 18** · přijde později 1 · nepřijde 1" (L1-46). */
export function confirmationLine(
    confirmation: NonNullable<AnnouncementViewInput["confirmation"]>,
    copy: MatchAnnouncementCopy
) {
    return [
        `**${fillTemplate(copy.card.confirmed, {
            confirmed: String(confirmation.confirmed),
            total: String(confirmation.total),
        })}**`,
        ...(confirmation.late
            ? [
                  fillTemplate(copy.card.late, {
                      count: String(confirmation.late),
                  }),
              ]
            : []),
        ...(confirmation.cannotCome
            ? [
                  fillTemplate(copy.card.cannotCome, {
                      count: String(confirmation.cannotCome),
                  }),
              ]
            : []),
    ].join(" · ")
}

/**
 * The announcement's result from a reviewed result: the clan's outcome and
 * its score first when the clan's side names a participant, else the scores
 * as reviewed. Nothing is invented: an unclear outcome shows only the scores.
 */
export function toAnnouncementResult(input: {
    participants: ReadonlyArray<{ label: string; score: number | null }>
    clanSide?: string | null
    imported?: {
        outcome: "victory" | "defeat" | "draw"
        score: { sideA: number; sideB: number }
    } | null
    reviewer?: string | null
}): AnnouncementResult | null {
    const participants = input.participants
    if (!participants.length) return null
    const resolved = resolveClanOutcome({
        participants,
        clanSide: input.clanSide,
        imported: input.imported,
    })
    const clanIndex = resolved?.clanIndex ?? null
    let scores: AnnouncementResult["scores"] = null
    if (clanIndex !== null && participants.length >= 2) {
        const others = participants
            .filter((_, index) => index !== clanIndex)
            .map((participant) => participant.score)
            .filter((score): score is number => score !== null)
        scores = [
            participants[clanIndex]?.score ?? null,
            others.length ? Math.max(...others) : null,
        ]
    } else if (participants.length === 2) {
        scores = [
            participants[0]?.score ?? null,
            participants[1]?.score ?? null,
        ]
    }
    return {
        outcome: resolved?.outcome ?? null,
        scores,
        reviewer: input.reviewer?.trim() || null,
    }
}

/** "Výhra 4 : 1 · potvrdil Kowalski" (L1-52). */
export function resultLine(
    result: AnnouncementResult,
    copy: MatchAnnouncementCopy
) {
    const score = (value: number | null) =>
        value === null || !Number.isFinite(value) ? "–" : String(value)
    const scores = result.scores
        ? `${score(result.scores[0])} : ${score(result.scores[1])}`
        : undefined
    const head = [
        result.outcome ? copy.card.outcomes[result.outcome] : undefined,
        scores,
    ]
        .filter(Boolean)
        .join(" ")
    if (!head) return undefined
    const reviewer = result.reviewer?.trim()
    return [
        `**${head}**`,
        reviewer
            ? fillTemplate(copy.card.confirmedBy, {
                  name: escapeMarkdownText(reviewer.slice(0, 80)),
              })
            : undefined,
    ]
        .filter(Boolean)
        .join(" · ")
}

/** The custom IDs of the announcement's buttons; the bot routes them. */
export function announcementCustomId(
    action: Exclude<AnnouncementAction, "calendar" | "openRoster" | "match">,
    event: Pick<MatchCardEvent, "eventId" | "guildId" | "kind">
) {
    const { eventId, guildId } = event
    switch (action) {
        case "signup":
            // A training has no groups to choose: the button signs up at once.
            return event.kind === "training"
                ? `signup:${eventId}:${TRAINING_ATTEND}:${guildId}`
                : `signup-picker:${eventId}:${guildId}`
        case "editSignup":
            return `check-signup:${eventId}:${guildId}`
        case "decline":
            return `signup:${eventId}:${encodeURIComponent(SIGNUP_NOT_ATTENDING)}:${guildId}`
        // The roster's own routes (Moje zařazení, confirm, running late).
        case "assignment":
            return rosterButtonIds.assignment(eventId)
        case "confirm":
            return attendanceButtonIds.confirm(eventId)
        case "late":
            return attendanceButtonIds.late(eventId)
        case "attendanceDecline":
            return attendanceButtonIds.decline(eventId)
    }
}

function signupRosterBlocks(
    roster: AnnouncementSignupRoster,
    copy: MatchAnnouncementCopy
): MessageBlock[] {
    const section = (icon: string, name: string, names: readonly string[]) =>
        [
            `**${icon} ${escapeMarkdownText(name)} (${names.length})**`,
            names.length
                ? names.map((entry) => escapeMarkdownText(entry)).join(", ")
                : undefined,
        ]
            .filter(Boolean)
            .join("\n")
    return [
        {
            kind: "text",
            markdown: [
                ...roster.groups.map((group) =>
                    section(group.icon, group.name, group.names)
                ),
                section("❌", copy.card.declinedHeading, roster.declined),
            ].join("\n\n"),
        },
    ]
}

function announcementButton(
    action: AnnouncementAction,
    input: AnnouncementViewInput
): MessageButton | null {
    const { copy, event, links } = input
    const label = copy.buttons[action]
    switch (action) {
        case "calendar":
            return { kind: "link", url: links.calendar, label }
        case "openRoster":
            return links.roster
                ? { kind: "link", url: links.roster, label }
                : null
        case "match":
            return links.match
                ? { kind: "link", url: links.match, label }
                : null
        case "signup":
            return {
                kind: "action",
                id: announcementCustomId(action, event),
                label,
                style: "success",
            }
        case "decline":
        case "attendanceDecline":
            return {
                kind: "action",
                id: announcementCustomId(action, event),
                label,
                style: "danger",
            }
        case "assignment":
            return {
                kind: "action",
                id: announcementCustomId(action, event),
                label,
                style: "secondary",
            }
        case "confirm":
            return {
                kind: "action",
                id: announcementCustomId(action, event),
                label,
                style: "success",
            }
        default:
            return {
                kind: "action",
                id: announcementCustomId(action, event),
                label,
                style: "secondary",
            }
    }
}

/**
 * The announcement card in one state (L1-B03), with the state's buttons
 * (L1-B04). Never the server password (L1-03, L1-B07).
 */
export function buildAnnouncementView(
    input: AnnouncementViewInput
): MessageView {
    const { copy, event, state } = input
    const blocks: MessageBlock[] = []
    const sides = matchSidesLine(event, copy)
    if (sides) blocks.push({ kind: "text", markdown: sides })

    if (state === "cancelled") {
        blocks.push({
            kind: "text",
            markdown: input.scheduledEvent
                ? copy.card.cancelledBody
                : copy.card.cancelledBodyNoEvent,
        })
    } else if (state !== "played") {
        // Notes are an optional short operational addendum. Keep the event
        // description separate so a manager's full briefing is never hidden
        // merely because they also supplied notes.
        for (const markdown of [input.description, input.notes]) {
            if (markdown?.trim())
                blocks.push({ kind: "text", markdown: markdown.trim() })
        }
    }

    const meeting = discordTimestamp(event.meetingStart, "f")
    const end = discordTimestamp(event.gameEnd, "t")
    const registrationEnd = discordTimestamp(event.registrationEnd, "f")
    const fields = [
        meeting
            ? {
                  title: copy.card.time,
                  text: [
                      end ? `${meeting} - ${end}` : meeting,
                      ...(state === "open" && registrationEnd
                          ? [
                                `**${copy.card.registrationEnd}**`,
                                registrationEnd,
                            ]
                          : []),
                  ].join("\n"),
                  ...(input.thumbnail && event.kind === "match"
                      ? { thumbnail: input.thumbnail }
                      : {}),
              }
            : null,
        event.kind === "match" && event.mapLabel?.trim()
            ? { title: copy.card.map, text: event.mapLabel.trim() }
            : null,
        state === "open"
            ? {
                  title: copy.card.signupsRestrictedTo,
                  text: event.signupRestriction?.trim() || copy.card.anyone,
              }
            : null,
        {
            title: copy.card.attendeeRole,
            text: event.attendeeRole?.trim() || copy.card.attendeeRolePending,
        },
    ].filter((field): field is { title: string; text: string } =>
        Boolean(field)
    )
    if (fields.length) blocks.push({ kind: "fields", items: fields })

    if (input.signupRoster && state === "open")
        blocks.push(...signupRosterBlocks(input.signupRoster, copy))

    if (input.image && state !== "played" && state !== "cancelled")
        blocks.push({ kind: "gallery", items: [input.image] })

    const rosterImage = input.roster?.image
    if (
        rosterImage &&
        (state === "roster" || state === "starting" || state === "playing")
    )
        blocks.push({ kind: "gallery", items: [rosterImage] })

    const rows = announcementActions(state, {
        kind: event.kind,
        rosterPublished: Boolean(input.roster),
        hasMatchPage: Boolean(input.links.match),
    })
        .map((row) =>
            row
                .map((action) => announcementButton(action, input))
                .filter((button): button is MessageButton => button !== null)
        )
        .filter((row) => row.length)
    blocks.push({ kind: "separator", divider: true, spacing: "small" })
    for (const buttons of rows) blocks.push({ kind: "buttons", buttons })

    const notes =
        state === "played"
            ? input.resultsChannelId
                ? [
                      fillTemplate(copy.card.resultsFooter, {
                          channel: `<#${input.resultsChannelId}>`,
                      }),
                  ]
                : []
            : state !== "cancelled" &&
                event.kind === "match" &&
                input.forumChannelId
              ? [
                    fillTemplate(copy.card.forumFooter, {
                        channel: `<#${input.forumChannelId}>`,
                    }),
                ]
              : []

    return {
        // One clan colour, whatever the state or category (L1-02).
        accent: "clan",
        header: {
            title: matchCardTitle(event, copy),
            chips: event.kind === "match" ? categoryChip(event.category) : [],
        },
        blocks,
        footer: { kind: "managed", notes },
    }
}

/** The role ping above the card, sent only with the first post (L1-10, L1-25). */
export function announcementPingLine(roleIds: readonly string[]) {
    const unique = [...new Set(roleIds.map((id) => id.trim()).filter(Boolean))]
    return unique.length
        ? unique.map((roleId) => `<@&${roleId}>`).join(" ")
        : undefined
}
