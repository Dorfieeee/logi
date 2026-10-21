/**
 * The published roster in Discord (board L1 1.11 and 1.12): the roster
 * message with its photo and the text roster under it (variant A) or the
 * photo only (variant B), the private squad view behind "Zobrazit
 * soupisku", the whole text roster for very large rosters, "Moje zařazení"
 * and the change digest. Every card is a {@link MessageView}, so the bot
 * posts and the publish dialog previews the same thing. Pure; the copy and
 * every name come in.
 */

import {
    DISCORD_MESSAGE_LIMITS,
    escapeMarkdownText,
    pageButtons,
    type MessageBlock,
    type MessageButton,
    type MessageMedia,
    type MessageView,
} from "./message-view"
import {
    channelMention,
    noticeArrivalTime,
    playerName,
    weekdayDate,
    weekdayDateAt,
} from "./match-text"
import {
    layoutMessageView,
    layoutTextLength,
    type MessageLayoutOptions,
} from "./message-layout"
import type { RosterPlayerChange } from "../rosters/roster-update-summary"
import { discordTimestamp, findSquadLeader, fillTemplate } from "./format"
import type { RosterMessageCopy } from "./match-copy"

/** How the roster message looks: photo with the text roster, or photo only. */
export const ROSTER_MESSAGE_VARIANTS = ["photo_text", "photo"] as const
export type RosterMessageVariant = (typeof ROSTER_MESSAGE_VARIANTS)[number]
export const DEFAULT_ROSTER_MESSAGE_VARIANT: RosterMessageVariant = "photo_text"

export function isRosterMessageVariant(
    value: unknown
): value is RosterMessageVariant {
    return (
        typeof value === "string" &&
        (ROSTER_MESSAGE_VARIANTS as readonly string[]).includes(value)
    )
}

export type RosterCardPlayer = {
    id?: string
    customName?: string
    roleName?: string
    ack: boolean
    confirmed?: boolean
    note?: string
}

export type RosterCardSquad = {
    name: string
    group: string
    order: number
    players: RosterCardPlayer[]
}

export type RosterCardRoster = {
    squads: RosterCardSquad[]
    reservePlayerIds: string[]
    notAttendingPlayerIds?: string[]
    reserveAttendances?: Array<{
        userId: string
        ack: boolean
        confirmed?: boolean
    }>
}

/** A clan group; squads are grouped by their root group, in its order. */
export type RosterCardGroup = {
    id: string
    name: string
    order?: number
    parentId?: string | null
}

export type RosterCardEvent = {
    id: string
    /** The plain match title, "VLK vs ROG" (see `matchTitle`). */
    title: string
    /** The match category, "Přátelák"; none for trainings. */
    category?: string
    /** "Foy · den", already escaped. */
    mapLabel?: string
    registrationEnd: string
    meetingStart: string
    gameStart: string
    meetingChannelId?: string
    server?: string
    serverPassword?: string
    /** Late and absence notices; only the arrival time is ever shown. */
    notices?: Array<{ userId: string; reason: string }>
    /**
     * The clan's Discord server. "Moje zařazení" can arrive in a DM, so its
     * attendance buttons name the server (see {@link eventCustomId}).
     */
    guildId?: string
}

/** What every roster card needs besides the roster. */
export type RosterCardContext = {
    copy: RosterMessageCopy & { locale: string }
    timeZone: string
    /** Display names by Discord ID. */
    names: Readonly<Record<string, string>>
    groups?: readonly RosterCardGroup[]
    /** "Otevřít soupisku": the public roster page. */
    rosterUrl: string
    /** "Now" for the meeting phase; explicit so builders stay deterministic. */
    now: number
}

// --- Roles ---------------------------------------------------------------

const ROLE_RULES: Array<{
    pattern: RegExp
    short: string
    symbol: string
}> = [
    {
        pattern: /^(squad\s*leader|officer|sl|velitel)$/,
        short: "SL",
        symbol: "≡",
    },
    { pattern: /^tank\s*commander$|^tc$/, short: "TC", symbol: "≡" },
    { pattern: /^commander$|^cmd$/, short: "Commander", symbol: "✪" },
    { pattern: /^(machine\s*gunner|mg|kulometčík)$/, short: "MG", symbol: "⁑" },
    { pattern: /^(anti[\s-]*tank|at)$/, short: "AT", symbol: "⇡" },
    { pattern: /^(automatic\s*rifleman|ar)$/, short: "AR", symbol: "⁂" },
    { pattern: /^(crewman|crew)$/, short: "Crew", symbol: "⚙" },
    { pattern: /^(medic|zdravotník)$/, short: "Medic", symbol: "+" },
    { pattern: /^support$/, short: "Support", symbol: "◎" },
    { pattern: /^(rifleman|infantry)$/, short: "Rifleman", symbol: "✕" },
    { pattern: /^engineer$/, short: "Engineer", symbol: "⚒" },
    { pattern: /^assault$/, short: "Assault", symbol: "⚔" },
    { pattern: /^spotter$/, short: "Spotter", symbol: "◉" },
    { pattern: /^sniper$/, short: "Sniper", symbol: "⌖" },
    { pattern: /^(artillery|arty)$/, short: "Artillery", symbol: "✸" },
    { pattern: /^(gunner|driver)$/, short: "", symbol: "⚙" },
]

function ruleOf(role: string) {
    const key = role.trim().toLowerCase()
    return ROLE_RULES.find((rule) => rule.pattern.test(key))
}

const oneLine = (value: string) => value.replace(/[\s\p{Cc}]+/gu, " ").trim()

/** The role as the text roster writes it: "SL", "MG", "AT", "TC", "Crew", … */
export function roleShortName(role: string | null | undefined) {
    const value = role?.trim()
    if (!value) return undefined
    const rule = ruleOf(value)
    return rule?.short || oneLine(value)
}

/** A small monochrome sign for a role in the private views. */
export function roleSymbol(role: string | null | undefined) {
    const value = role?.trim()
    return (value && ruleOf(value)?.symbol) || "•"
}

// --- Sections ------------------------------------------------------------

export type RosterSection = { title: string; squads: RosterCardSquad[] }

/**
 * Squads grouped by root group, with each section positioned by its first
 * squad's saved order so that dashboard section moves also reach Discord.
 */
export function rosterSections(
    squads: readonly RosterCardSquad[],
    groups: readonly RosterCardGroup[] = []
): RosterSection[] {
    const byOrder = (left: RosterCardSquad, right: RosterCardSquad) =>
        left.order - right.order
    const sortedGroups = [...groups].sort(
        (left, right) => (left.order ?? 0) - (right.order ?? 0)
    )
    const byId = new Map(sortedGroups.map((group) => [group.id, group]))
    const rootOf = (name: string) => {
        let group = sortedGroups.find((item) => item.name === name)
        const seen = new Set<string>()
        while (group?.parentId && byId.has(group.parentId)) {
            if (seen.has(group.id)) break
            seen.add(group.id)
            group = byId.get(group.parentId)
        }
        return group
    }
    const sections = new Map<string, RosterSection>()
    const order: string[] = []
    for (const root of sortedGroups.filter((group) => !group.parentId)) {
        sections.set(`group:${root.id}`, { title: root.name, squads: [] })
        order.push(`group:${root.id}`)
    }
    for (const squad of [...squads].sort(byOrder)) {
        const root = rootOf(squad.group)
        const key = root ? `group:${root.id}` : `name:${squad.group}`
        if (!sections.has(key)) {
            sections.set(key, { title: squad.group, squads: [] })
            order.push(key)
        }
        sections.get(key)!.squads.push(squad)
    }
    return order
        .map((key) => sections.get(key)!)
        .filter((section) => section.squads.length > 0)
        .sort((a, b) => a.squads[0].order - b.squads[0].order)
}

const filledOf = (squad: RosterCardSquad) =>
    squad.players.filter((player) => player.id || player.customName?.trim())
        .length

/** "18 z 22 míst": filled squad slots of all slots. */
export function rosterSlotCounts(roster: RosterCardRoster) {
    return {
        filled: roster.squads.reduce((sum, squad) => sum + filledOf(squad), 0),
        total: roster.squads.reduce(
            (sum, squad) => sum + squad.players.length,
            0
        ),
    }
}

function header(text: string, locale: string) {
    let upper: string
    try {
        upper = text.toLocaleUpperCase(locale)
    } catch {
        upper = text.toUpperCase()
    }
    return `-# **${escapeMarkdownText(oneLine(upper))}**`
}

/** "F1 · SL Rex_CZ · Medic Medvěd · … · Rifleman —": one line per squad. */
export function squadLine(
    squad: RosterCardSquad,
    names: Readonly<Record<string, string>>
) {
    const slots = squad.players.map((player) => {
        const role = roleShortName(player.roleName)
        const name = playerName(player, names)
        return [role ? escapeMarkdownText(role) : undefined, name ?? "—"]
            .filter(Boolean)
            .join(" ")
    })
    return [`**${escapeMarkdownText(oneLine(squad.name))}**`, ...slots].join(
        " · "
    )
}

/**
 * The text roster under the photo: one block per section ("VELENÍ" and its
 * squads), then reserves and players who are not coming.
 */
export function rosterTextBlocks(
    roster: RosterCardRoster,
    context: Pick<RosterCardContext, "copy" | "names" | "groups">
): string[] {
    const { copy, names } = context
    const blocks = rosterSections(roster.squads, context.groups).map(
        (section) =>
            [
                header(section.title, copy.locale),
                ...section.squads.map((squad) => squadLine(squad, names)),
            ].join("\n")
    )
    const people = (ids: readonly string[]) =>
        ids
            .map((id) => playerName({ id }, names))
            .filter((name): name is string => Boolean(name))
    const reserves = people(roster.reservePlayerIds)
    const absent = people(roster.notAttendingPlayerIds ?? [])
    const tail = [
        reserves.length
            ? [`**${copy.common.reserves}**`, ...reserves].join(" · ")
            : undefined,
        absent.length
            ? [`**${copy.common.notAttending}**`, ...absent].join(" · ")
            : undefined,
    ].filter((line): line is string => Boolean(line))
    if (tail.length) blocks.push(tail.join("\n"))
    return blocks
}

// --- Shared lines --------------------------------------------------------

function meetingStarted(event: RosterCardEvent, now: number) {
    const meeting = Date.parse(event.meetingStart)
    return Number.isFinite(meeting) && now >= meeting
}

function gameStarted(event: RosterCardEvent, now: number) {
    const start = Date.parse(event.gameStart)
    return Number.isFinite(start) && now >= start
}

/** "sraz 19:30 v kanálu 🔊 Sraz", or "sraz běží v kanálu 🔊 Sraz" while it runs. */
function meetingPhrase(
    event: RosterCardEvent,
    context: Pick<RosterCardContext, "copy" | "now">,
    running = false
) {
    const channel = channelMention(event.meetingChannelId)
    if (running && channel && meetingStarted(event, context.now))
        return fillTemplate(context.copy.common.meetingRunning, { channel })
    const time = discordTimestamp(event.meetingStart, "t")
    if (!time) return undefined
    return channel
        ? fillTemplate(context.copy.common.meetingInChannel, { time, channel })
        : fillTemplate(context.copy.common.meeting, { time })
}

function capitalize(value: string, locale: string) {
    return value ? value[0]!.toLocaleUpperCase(locale) + value.slice(1) : value
}

function joinParts(parts: Array<string | undefined>) {
    return parts.filter((part): part is string => Boolean(part)).join(" · ")
}

function leaderPhrase(
    squad: RosterCardSquad | undefined,
    context: Pick<RosterCardContext, "copy" | "names">,
    except?: RosterCardPlayer
) {
    const leader = squad ? findSquadLeader(squad.players) : undefined
    if (!leader || leader === except) return undefined
    const name = playerName(leader, context.names)
    return name
        ? fillTemplate(context.copy.common.squadLeader, { name })
        : undefined
}

/** "Velitel čety Rex_CZ · sraz běží v kanálu 🔊 Sraz · start ve 20:00". */
function squadMeta(
    event: RosterCardEvent,
    squad: RosterCardSquad | undefined,
    context: RosterCardContext,
    except?: RosterCardPlayer
) {
    const start = discordTimestamp(event.gameStart, "t")
    const line = joinParts([
        leaderPhrase(squad, context, except),
        meetingPhrase(event, context, true),
        start
            ? fillTemplate(context.copy.common.startAt, { time: start })
            : undefined,
    ])
    return line ? capitalize(line, context.copy.locale) : undefined
}

function matchLabel(event: RosterCardEvent) {
    return event.title
}

function titledMatch(event: RosterCardEvent) {
    return joinParts([event.title, event.category])
}

// --- The roster message (L1-97..105) -------------------------------------

export type RosterMessageInput = {
    event: RosterCardEvent
    roster: RosterCardRoster
    variant: RosterMessageVariant
    /** The roster photo: an attachment of the message or its public URL. */
    image: MessageMedia
    /** When the roster was published, for "Zveřejněno ne 11. 10. v 15:10". */
    publishedAt?: string
}

/**
 * `<prefix><event>`, or `<prefix><event>:<guild>` for a button a DM carries
 * (and the form it opens): a DM click has no server, so when the match is
 * gone the server in the ID still gives the clan language (L1-B19, L2-B01),
 * like `signup-picker:<event>:<guild>`. Cards in the server keep the short
 * form. Read back with {@link parseEventButtonId}.
 */
export function eventCustomId(
    prefix: string,
    eventId: string,
    guildId?: string
) {
    return guildId ? `${prefix}${eventId}:${guildId}` : `${prefix}${eventId}`
}

/**
 * The event and, when the ID names one, the Discord server of an attendance
 * or "Zobrazit zařazení" button (or its form). Buttons in DMs sent before
 * the server was added have none; a value that is not a Discord ID is
 * ignored.
 */
export function parseEventButtonId(
    customId: string,
    prefix: string
): { eventId: string; guildId?: string } {
    const [eventId = "", guildId = ""] = customId
        .slice(prefix.length)
        .split(":")
    return /^\d{17,20}$/.test(guildId) ? { eventId, guildId } : { eventId }
}

/** The custom IDs of the roster buttons. */
export const rosterButtonIds = {
    assignment: (eventId: string, guildId?: string) =>
        eventCustomId("roster-assignment:", eventId, guildId),
    squads: (eventId: string) => `roster-squads:${eventId}`,
    squadSelect: (eventId: string) => `roster-squads-select:${eventId}`,
    full: (eventId: string, page = 1) => `roster-full:${eventId}:${page}`,
} as const

/**
 * "Zobrazit zařazení": the one primary action of roster cards. In a DM the
 * button also names the clan's server.
 */
export function showAssignmentButton(
    eventId: string,
    copy: RosterMessageCopy,
    guildId?: string,
    style: "primary" | "secondary" = "primary"
): MessageButton {
    return {
        kind: "action",
        id: rosterButtonIds.assignment(eventId, guildId),
        label: copy.common.showAssignment,
        style,
    }
}

function openRosterButton(url: string, copy: RosterMessageCopy): MessageButton {
    return { kind: "link", url, label: copy.common.openRoster }
}

function rosterMessageFrame(
    input: RosterMessageInput,
    context: RosterCardContext,
    text: string[] | "too_long"
): MessageView {
    const { event, roster, copy } = { ...input, copy: context.copy }
    const when = discordWeekdayDateTime(event.gameStart, context)
    const counts = rosterSlotCounts(roster)
    const title = escapeMarkdownText(
        fillTemplate(copy.message.title, { match: titledMatch(event) })
    )
    const meta = joinParts([
        event.mapLabel,
        meetingPhrase(event, context),
        counts.total
            ? fillTemplate(copy.message.slots, {
                  filled: String(counts.filled),
                  total: String(counts.total),
              })
            : undefined,
    ])
    const published = weekdayDateAt(
        input.publishedAt,
        copy.locale,
        context.timeZone,
        copy.common.dateAt
    )
    return {
        accent: "clan",
        blocks: [
            { kind: "text", markdown: `### ${joinParts([title, when])}` },
            ...(meta
                ? [{ kind: "meta" as const, lines: [{ text: meta }] }]
                : []),
            { kind: "gallery", items: [input.image] },
            ...(Array.isArray(text)
                ? text.map((markdown) => ({ kind: "text" as const, markdown }))
                : []),
            { kind: "separator", divider: true, spacing: "small" },
            {
                kind: "buttons",
                buttons: [
                    {
                        kind: "action",
                        id: attendanceButtonIds.confirm(event.id),
                        label: copy.message.confirmAttendance,
                        style: "success",
                    },
                    {
                        kind: "action",
                        id: attendanceButtonIds.late(event.id),
                        label: copy.message.runningLate,
                        style: "secondary",
                    },
                    {
                        kind: "action",
                        id: attendanceButtonIds.decline(event.id),
                        label: copy.message.cannotAttend,
                        style: "danger",
                    },
                ],
            },
            {
                kind: "buttons",
                buttons: [
                    showAssignmentButton(
                        event.id,
                        copy,
                        undefined,
                        "secondary"
                    ),
                    {
                        kind: "action",
                        id: rosterButtonIds.squads(event.id),
                        label: copy.message.showRoster,
                        style: "secondary",
                    },
                    ...(text === "too_long"
                        ? [
                              {
                                  kind: "action" as const,
                                  id: rosterButtonIds.full(event.id),
                                  label: copy.message.showFullRoster,
                                  style: "secondary" as const,
                              },
                          ]
                        : []),
                    openRosterButton(context.rosterUrl, copy),
                ],
            },
        ],
        footer: {
            kind: "managed",
            notes: published
                ? [fillTemplate(copy.message.published, { time: published })]
                : [],
        },
    }
}

function discordWeekdayDateTime(value: string, context: RosterCardContext) {
    const date = weekdayDate(value, context.copy.locale, context.timeZone)
    const time = discordTimestamp(value, "t")
    return date && time ? `${date} · ${time}` : undefined
}

/**
 * The roster message in the roster channel. Variant A puts the whole text
 * roster under the photo; when it would not fit Discord's 4,000 characters
 * the message keeps only the photo and offers "Zobrazit celou soupisku".
 * Variant B is the photo only; its text lives behind "Zobrazit soupisku".
 */
export function rosterMessageView(
    input: RosterMessageInput,
    context: RosterCardContext,
    layout: MessageLayoutOptions
): MessageView {
    if (input.variant === "photo") return rosterMessageFrame(input, context, [])
    const full = rosterMessageFrame(
        input,
        context,
        rosterTextBlocks(input.roster, context)
    )
    const fits =
        layoutTextLength(layoutMessageView(full, layout)) <=
        DISCORD_MESSAGE_LIMITS.totalText
    return fits ? full : rosterMessageFrame(input, context, "too_long")
}

/** The user mentions above the roster card ("Označit zařazené hráče"). */
export function rosterMentionIds(roster: RosterCardRoster) {
    return [
        ...new Set(
            roster.squads.flatMap((squad) =>
                squad.players.flatMap((player) =>
                    player.id && /^\d{17,20}$/.test(player.id)
                        ? [player.id]
                        : []
                )
            )
        ),
    ]
}

// --- "Zobrazit soupisku" (L1-106..111) -----------------------------------

const RESERVES_OPTION = "reserves"

function statusText(
    acknowledged: boolean,
    userId: string | undefined,
    event: RosterCardEvent,
    copy: RosterMessageCopy
) {
    const notice = userId
        ? event.notices?.find((item) => item.userId === userId)
        : undefined
    const time = notice ? noticeArrivalTime(notice.reason) : undefined
    return joinParts([
        acknowledged ? copy.squadView.confirmed : copy.squadView.pending,
        notice
            ? time
                ? fillTemplate(copy.squadView.late, { time })
                : copy.squadView.lateNoTime
            : undefined,
    ])
}

function squadRows(
    squad: RosterCardSquad,
    event: RosterCardEvent,
    context: RosterCardContext
) {
    const { copy } = context
    return squad.players.map((player) => {
        const role = player.roleName?.trim()
            ? escapeMarkdownText(oneLine(player.roleName))
            : copy.common.noRole
        const name = playerName(player, context.names)
        return joinParts([
            `${roleSymbol(player.roleName)} ${role}`,
            name
                ? `**${name}** ${statusText(player.ack || Boolean(player.confirmed), player.id, event, copy)}`
                : copy.squadView.openSlot,
        ])
    })
}

function reserveRows(
    roster: RosterCardRoster,
    event: RosterCardEvent,
    context: RosterCardContext
) {
    const attendance = new Map(
        (roster.reserveAttendances ?? []).map((item) => [item.userId, item])
    )
    return roster.reservePlayerIds.map((id) => {
        const name = playerName({ id }, context.names) ?? ""
        const entry = attendance.get(id)
        return `**${name}** ${statusText(Boolean(entry?.ack || entry?.confirmed), id, event, context.copy)}`
    })
}

function squadOptionLabel(squad: RosterCardSquad, copy: RosterMessageCopy) {
    return fillTemplate(copy.squadView.option, {
        squad: oneLine(squad.name),
        group: oneLine(squad.group),
        filled: String(filledOf(squad)),
        total: String(squad.players.length),
    }).slice(0, DISCORD_MESSAGE_LIMITS.selectOptionText)
}

/**
 * The private squad view: one squad (or the reserves) with every slot, its
 * role, its player and whether they confirmed, plus a select of all squads.
 * Works for both variants; for variant B it is the only text roster.
 */
export function rosterSquadView(input: {
    event: RosterCardEvent
    roster: RosterCardRoster
    /** The chosen squad's index in the order shown, or "reserves". */
    selected?: number | typeof RESERVES_OPTION
    context: RosterCardContext
}): MessageView {
    const { event, roster, context } = input
    const { copy } = context
    const squads = rosterSections(roster.squads, context.groups).flatMap(
        (section) => section.squads
    )
    const selected =
        input.selected === RESERVES_OPTION
            ? RESERVES_OPTION
            : Math.min(
                  Math.max(0, Math.floor(Number(input.selected ?? 0)) || 0),
                  Math.max(0, squads.length - 1)
              )
    const squad =
        selected === RESERVES_OPTION ? undefined : squads[selected as number]
    const reservesTitle = fillTemplate(copy.squadView.reservesTitle, {
        count: String(roster.reservePlayerIds.length),
    })
    const title = squad ? squadOptionLabel(squad, copy) : reservesTitle
    const rows = squad
        ? squadRows(squad, event, context)
        : reserveRows(roster, event, context)
    const meta = squadMeta(event, squad, context)
    const options = [
        ...squads.map((item, index) => ({
            value: String(index),
            label: squadOptionLabel(item, copy),
            default: selected === index,
        })),
        {
            value: RESERVES_OPTION,
            label: reservesTitle,
            default: selected === RESERVES_OPTION,
        },
    ].slice(0, DISCORD_MESSAGE_LIMITS.selectOptions)
    return {
        accent: "clan",
        ephemeral: true,
        header: {
            label: fillTemplate(copy.squadView.label, {
                match: matchLabel(event),
            }),
            title,
        },
        blocks: [
            ...(meta
                ? [{ kind: "meta" as const, lines: [{ text: meta }] }]
                : []),
            {
                kind: "select",
                select: {
                    id: rosterButtonIds.squadSelect(event.id),
                    placeholder: fillTemplate(
                        copy.squadView.selectPlaceholder,
                        {
                            squad: title,
                        }
                    ).slice(0, DISCORD_MESSAGE_LIMITS.selectPlaceholder),
                    options,
                },
            },
            rows.length
                ? { kind: "list", items: rows }
                : { kind: "text", markdown: copy.squadView.noReserves },
            { kind: "separator", divider: true, spacing: "small" },
        ],
        footer: {
            kind: "managed",
            notes: [copy.squadView.legend],
            managed: false,
        },
    }
}

/** Parses the squad select value. */
export function parseSquadSelection(value: string | undefined) {
    if (value === RESERVES_OPTION) return RESERVES_OPTION
    const index = Number(value)
    return Number.isInteger(index) && index >= 0 ? index : 0
}

/**
 * The whole text roster as a private paged reply, behind "Zobrazit celou
 * soupisku" when it is too long for the roster message.
 */
export function rosterFullView(input: {
    event: RosterCardEvent
    roster: RosterCardRoster
    page: number
    context: RosterCardContext
    paging: { previous: string; next: string }
}): MessageView {
    const { event, context } = input
    const blocks = rosterTextBlocks(input.roster, context)
    // Each page keeps well under the message limit with its frame.
    const budget = 3_000
    const pages: string[][] = [[]]
    let size = 0
    for (const block of blocks.flatMap((text) =>
        text.length > budget ? text.split("\n") : [text]
    )) {
        if (size + block.length > budget && pages.at(-1)!.length) {
            pages.push([])
            size = 0
        }
        pages.at(-1)!.push(block)
        size += block.length
    }
    const count = pages.length
    const page = Math.min(Math.max(1, Math.floor(input.page) || 1), count)
    return {
        accent: "clan",
        ephemeral: true,
        header: {
            label: fillTemplate(context.copy.squadView.label, {
                match: matchLabel(event),
            }),
            title: context.copy.squadView.fullTitle,
        },
        blocks: [
            ...pages[page - 1]!.map((markdown) => ({
                kind: "text" as const,
                markdown,
            })),
            { kind: "separator", divider: true, spacing: "small" },
            ...(count > 1
                ? [
                      {
                          kind: "buttons" as const,
                          buttons: pageButtons({
                              page,
                              pages: count,
                              id: (target) =>
                                  rosterButtonIds.full(event.id, target),
                              previousLabel: input.paging.previous,
                              nextLabel: input.paging.next,
                          }),
                      },
                  ]
                : []),
        ],
        footer: { kind: "managed", page: { page, pages: count } },
    }
}

// --- "Moje zařazení" (L1-112..119) ---------------------------------------

/**
 * The custom IDs of the attendance buttons; the buttons a DM carries also
 * name the clan's server.
 */
export const attendanceButtonIds = {
    confirm: (eventId: string, guildId?: string) =>
        eventCustomId("attendance-confirm:", eventId, guildId),
    late: (eventId: string, guildId?: string) =>
        eventCustomId("attendance-late:", eventId, guildId),
    decline: (eventId: string, guildId?: string) =>
        eventCustomId("attendance-decline:", eventId, guildId),
} as const

/** Inline code that survives backticks inside the password. */
function inlineCode(value: string) {
    const text = oneLine(value)
    return text.includes("`") ? `\`\` ${text} \`\`` : `\`${text}\``
}

/** "Server **VLK Scrim** · heslo `k7-sraz`": the only place with the password. */
function serverLine(
    event: RosterCardEvent,
    copy: RosterMessageCopy & { locale: string }
) {
    const server = event.server?.trim()
    const password = event.serverPassword?.trim()
    const line = joinParts([
        server
            ? fillTemplate(copy.assignment.server, {
                  server: `**${escapeMarkdownText(oneLine(server))}**`,
              })
            : undefined,
        password
            ? fillTemplate(copy.assignment.password, {
                  password: inlineCode(password),
              })
            : undefined,
    ])
    return line ? capitalize(line, copy.locale) : undefined
}

export type MyAssignment =
    | { kind: "not_published" }
    | { kind: "not_on_roster" }
    | { kind: "reserve"; acknowledged: boolean }
    | {
          kind: "squad"
          squad: RosterCardSquad
          player: RosterCardPlayer
          acknowledged: boolean
      }

/** Where a player is on the published roster. */
export function findMyAssignment(
    roster: (RosterCardRoster & { published?: boolean }) | null | undefined,
    userId: string
): MyAssignment {
    if (!roster || roster.published === false) return { kind: "not_published" }
    for (const squad of roster.squads) {
        const player = squad.players.find((item) => item.id === userId)
        if (player)
            return {
                kind: "squad",
                squad,
                player,
                acknowledged: player.ack || Boolean(player.confirmed),
            }
    }
    if (roster.reservePlayerIds.includes(userId)) {
        const entry = roster.reserveAttendances?.find(
            (item) => item.userId === userId
        )
        return {
            kind: "reserve",
            acknowledged: Boolean(entry?.ack || entry?.confirmed),
        }
    }
    return { kind: "not_on_roster" }
}

/**
 * The private "Moje zařazení": squad and role, squad leader, meeting and
 * start, the leaders' note, the server with its password and the attendance
 * buttons. "Potvrdím účast" opens with the meeting; "Přijdu později" works
 * until the game starts. Reserves and players off the roster get their own
 * cards.
 */
export function myAssignmentView(input: {
    event: RosterCardEvent
    assignment: MyAssignment
    context: RosterCardContext
}): MessageView {
    const { event, assignment, context } = input
    const { copy } = context
    const label = fillTemplate(copy.assignment.label, {
        match: matchLabel(event),
    })
    if (assignment.kind === "not_published")
        return {
            accent: "clan",
            ephemeral: true,
            header: { label, title: copy.assignment.notPublishedTitle },
            blocks: [
                { kind: "text", markdown: copy.assignment.notPublishedBody },
            ],
        }
    if (assignment.kind === "not_on_roster")
        return {
            accent: "clan",
            ephemeral: true,
            header: { label, title: copy.assignment.notOnRosterTitle },
            blocks: [
                {
                    kind: "text",
                    markdown: fillTemplate(copy.assignment.notOnRosterBody, {
                        date:
                            weekdayDateAt(
                                event.registrationEnd,
                                copy.locale,
                                context.timeZone,
                                copy.common.dateAt
                            ) ?? "",
                    }),
                },
            ],
        }
    const started = gameStarted(event, context.now)
    const confirmOpen =
        !started &&
        meetingStarted(event, context.now) &&
        !assignment.acknowledged
    const buttons: MessageButton[] = [
        ...(confirmOpen
            ? [
                  {
                      kind: "action" as const,
                      id: attendanceButtonIds.confirm(event.id, event.guildId),
                      label: copy.assignment.confirm,
                      style: "primary" as const,
                  },
              ]
            : []),
        ...(started
            ? []
            : [
                  {
                      kind: "action" as const,
                      id: attendanceButtonIds.late(event.id, event.guildId),
                      label: copy.assignment.late,
                      style: "secondary" as const,
                  },
              ]),
    ]
    const server = serverLine(event, copy)
    const tail: MessageBlock[] = [
        ...(server ? [{ kind: "text" as const, markdown: server }] : []),
        ...(buttons.length
            ? [
                  {
                      kind: "separator" as const,
                      divider: true,
                      spacing: "small" as const,
                  },
                  { kind: "buttons" as const, buttons },
              ]
            : []),
    ]
    const footer = event.serverPassword?.trim()
        ? {
              kind: "managed" as const,
              notes: [copy.assignment.footer],
              managed: false,
          }
        : undefined
    if (assignment.kind === "reserve") {
        const date = weekdayDateAt(
            event.meetingStart,
            copy.locale,
            context.timeZone,
            copy.common.dateAt
        )
        const channel = channelMention(event.meetingChannelId)
        const relative = discordTimestamp(event.meetingStart, "R")
        const meeting = date
            ? joinParts([
                  channel
                      ? fillTemplate(copy.assignment.reserveMeeting, {
                            date,
                            channel,
                        })
                      : fillTemplate(copy.assignment.reserveMeetingNoChannel, {
                            date,
                        }),
                  relative,
              ])
            : undefined
        return {
            accent: "clan",
            ephemeral: true,
            header: { label, title: copy.assignment.reserveTitle },
            blocks: [
                ...(meeting
                    ? [{ kind: "meta" as const, lines: [{ text: meeting }] }]
                    : []),
                { kind: "text", markdown: copy.assignment.reserveBody },
                ...tail,
            ],
            footer,
        }
    }
    const { squad, player } = assignment
    const role = player.roleName?.trim()
    const title = joinParts([
        oneLine(squad.name),
        role ? oneLine(role) : undefined,
    ])
    const meta = squadMeta(event, squad, context, player)
    const note = player.note?.trim()
    return {
        accent: "clan",
        ephemeral: true,
        header: {
            label,
            title: role ? `${roleSymbol(role)} ${title}` : title,
        },
        blocks: [
            ...(meta
                ? [{ kind: "meta" as const, lines: [{ text: meta }] }]
                : []),
            ...(note
                ? [
                      {
                          kind: "text" as const,
                          markdown: `> ${fillTemplate(
                              copy.assignment.leaderNote,
                              {
                                  note: escapeMarkdownText(oneLine(note)),
                              }
                          )}`,
                      },
                  ]
                : []),
            ...tail,
        ],
        footer,
    }
}

// --- The change digest (L1-120..126) -------------------------------------

function placeText(place: { squad: string; role?: string } | undefined) {
    if (!place) return ""
    return joinParts([
        escapeMarkdownText(oneLine(place.squad)),
        place.role ? escapeMarkdownText(oneLine(place.role)) : undefined,
    ])
}

function roleText(role: string | undefined, copy: RosterMessageCopy) {
    return role ? escapeMarkdownText(oneLine(role)) : copy.common.noRole
}

/** The digest's sections: "Nově na soupisce", "Mimo soupisku", "Přesuny", "Nové role". */
export function rosterChangeSections(
    changes: readonly RosterPlayerChange[],
    names: Readonly<Record<string, string>>,
    copy: RosterMessageCopy
) {
    const name = (userId: string) => playerName({ id: userId }, names) ?? ""
    const c = copy.changes
    const sections = [
        {
            title: c.added,
            lines: changes
                .filter((change) => change.added)
                .map((change) =>
                    fillTemplate(c.addedLine, {
                        name: name(change.userId),
                        place: placeText(change.after),
                    })
                ),
        },
        {
            title: c.removed,
            lines: changes
                .filter((change) => change.removed)
                .map((change) =>
                    fillTemplate(c.removedLine, {
                        name: name(change.userId),
                        place: placeText(change.before),
                    })
                ),
        },
        {
            title: c.moved,
            lines: changes
                .filter((change) => change.moved)
                .map((change) =>
                    fillTemplate(c.movedLine, {
                        name: name(change.userId),
                        from: escapeMarkdownText(oneLine(change.before!.squad)),
                        to: placeText(change.after),
                    })
                ),
        },
        {
            title: c.roles,
            lines: changes
                .filter((change) => change.roleChanged)
                .map((change) =>
                    fillTemplate(c.roleLine, {
                        name: name(change.userId),
                        squad: escapeMarkdownText(oneLine(change.after!.squad)),
                        from: roleText(change.before?.role, copy),
                        to: roleText(change.after?.role, copy),
                    })
                ),
        },
    ]
    return sections.filter((section) => section.lines.length > 0)
}

/**
 * The bot's change digest in the roster channel: one message per match,
 * edited with every re-publish so it lists all changes since the roster was
 * first published.
 */
export function rosterChangesView(input: {
    event: RosterCardEvent
    changes: readonly RosterPlayerChange[]
    editedAt: string
    context: RosterCardContext
}): MessageView {
    const { event, context } = input
    const { copy } = context
    const meeting = discordTimestamp(event.meetingStart, "t")
    const start = discordTimestamp(event.gameStart, "t")
    const date = weekdayDate(event.gameStart, copy.locale, context.timeZone)
    const meta =
        date && meeting && start
            ? fillTemplate(copy.changes.meta, { date, meeting, start })
            : undefined
    const sections = rosterChangeSections(input.changes, context.names, copy)
    // Long digests drop their oldest lines rather than fail.
    const budget = 3_200
    let used = 0
    const blocks: MessageBlock[] = []
    for (const section of sections) {
        const lines: string[] = []
        for (const line of section.lines) {
            if (used + line.length > budget) break
            lines.push(line)
            used += line.length + 1
        }
        if (lines.length)
            blocks.push({
                kind: "text",
                markdown: [`**${section.title}**`, ...lines].join("\n"),
            })
    }
    const edited = weekdayDateAt(
        input.editedAt,
        copy.locale,
        context.timeZone,
        copy.common.dateAt
    )
    return {
        accent: "clan",
        header: {
            label: fillTemplate(copy.changes.label, {
                match: matchLabel(event),
            }),
            title: copy.changes.title,
        },
        blocks: [
            ...(meta
                ? [{ kind: "meta" as const, lines: [{ text: meta }] }]
                : []),
            ...blocks,
            { kind: "separator", divider: true, spacing: "small" },
            {
                kind: "buttons",
                buttons: [
                    showAssignmentButton(event.id, copy),
                    openRosterButton(context.rosterUrl, copy),
                ],
            },
        ],
        footer: {
            kind: "managed",
            notes: edited
                ? [fillTemplate(copy.changes.edited, { time: edited })]
                : [],
        },
    }
}
