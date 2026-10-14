/**
 * The direct messages of a match (board L2) as {@link MessageView}s: the
 * sign-up and attendance reminders, the replies that arrive in the same DM,
 * the roster change DM, the match recap and the training result. Every DM
 * is the clan card with the weekday in its schedule, no server password and
 * the footer "Klan <Název> · Nastavit zprávy". Pure; copy, names and links
 * come in.
 */

import {
    escapeMarkdownText,
    type DirectMessageFooter,
    type MessageBlock,
    type MessageButton,
    type MessageChip,
    type MessageView,
} from "./message-view"
import {
    categoryChip,
    channelMention,
    matchSidesLine,
    type MatchTeamText,
    sideKind,
    weekdayDate,
    weekdayDateAt,
} from "./match-text"
import { attendanceButtonIds, showAssignmentButton } from "./roster-message"
import type { RosterPlayerChange } from "../rosters/roster-update-summary"
import type { DirectMessageCopy, RosterMessageCopy } from "./match-copy"
import { discordTimestamp, fillTemplate } from "./format"
import { calendarDayOffset } from "./calendar-day"
import { chipText } from "./message-layout"

type DmCopy = DirectMessageCopy & { locale: string }
type RosterCopy = RosterMessageCopy & { locale: string }

const oneLine = (value: string) => value.replace(/[\s\p{Cc}]+/gu, " ").trim()
const joinParts = (parts: Array<string | undefined>) =>
    parts.filter((part): part is string => Boolean(part)).join(" · ")

/** Where a DM's footer points: the clan's name and the account's DM settings. */
export type DmFrame = {
    clanName: string
    settingsUrl?: string
    timeZone: string
}

function dmFooter(frame: DmFrame): DirectMessageFooter {
    return {
        kind: "dm",
        clanName: frame.clanName,
        ...(frame.settingsUrl ? { settingsUrl: frame.settingsUrl } : {}),
    }
}

export type DmEvent = {
    id: string
    /** "VLK vs ROG". */
    title: string
    category?: { label: string; color?: string | null }
    teams?: readonly MatchTeamText[]
    side?: string | null
    mapLabel?: string
    registrationEnd: string
    meetingStart: string
    gameStart: string
    meetingChannelId?: string
    /**
     * The clan's Discord server. A DM click has no server, so the DM's
     * attendance and "Zobrazit zařazení" buttons name it: a click after the
     * match is gone still answers in the clan language (L1-B19, L2-B01).
     */
    guildId?: string
}

/** "ne 11. 10. · sraz 19:30 · start 20:00", with the relative time when asked. */
export function dmSchedule(
    event: Pick<DmEvent, "meetingStart" | "gameStart">,
    copy: DmCopy,
    timeZone: string,
    withRelative = false
) {
    const date = weekdayDate(event.gameStart, copy.locale, timeZone)
    const meeting = discordTimestamp(event.meetingStart, "t")
    const start = discordTimestamp(event.gameStart, "t")
    if (!date || !meeting || !start) return undefined
    return joinParts([
        fillTemplate(copy.schedule, { date, meeting, start }),
        withRelative ? discordTimestamp(event.meetingStart, "R") : undefined,
    ])
}

const SENT_BY_LEADERS = (copy: DmCopy): MessageBlock => ({
    kind: "text",
    markdown: `-# ${copy.sentByLeaders}`,
})

// --- Sign-up reminder (L2-06..15) ----------------------------------------

/**
 * "Připomínka přihlášky": the match, its sides, start and facts, the
 * sign-up deadline, why the DM came and the sign-up buttons that answer in
 * the same DM.
 */
export function signupReminderView(input: {
    event: DmEvent
    ids: { signUp: string; decline: string }
    announcementUrl?: string
    sentByLeaders?: boolean
    copy: DmCopy
    rosterCopy: RosterCopy
    frame: DmFrame
    emoji?: Parameters<typeof matchSidesLine>[0]["emoji"]
}): MessageView {
    const { event, copy, frame } = input
    const sides = matchSidesLine({
        teams: event.teams,
        side: event.side,
        factions: input.rosterCopy.factions,
        emoji: input.emoji,
    })
    const date = weekdayDate(event.gameStart, copy.locale, frame.timeZone)
    const time = discordTimestamp(event.gameStart, "t")
    const meeting = discordTimestamp(event.meetingStart, "t")
    const facts = joinParts([
        event.mapLabel,
        meeting
            ? fillTemplate(input.rosterCopy.common.meeting, { time: meeting })
            : undefined,
    ])
    const deadline = weekdayDateAt(
        event.registrationEnd,
        copy.locale,
        frame.timeZone,
        input.rosterCopy.common.dateAt
    )
    const chip: MessageChip = {
        label: copy.signupReminder.deadlineChip,
        tone: "warning",
    }
    const buttons: MessageButton[] = [
        {
            kind: "action",
            id: input.ids.signUp,
            label: copy.signupReminder.signUp,
            style: "success",
        },
        {
            kind: "action",
            id: input.ids.decline,
            label: copy.signupReminder.decline,
            style: "danger",
        },
        ...(input.announcementUrl && /^https?:\/\//.test(input.announcementUrl)
            ? [
                  {
                      kind: "link" as const,
                      url: input.announcementUrl,
                      label: copy.signupReminder.openAnnouncement,
                  },
              ]
            : []),
    ]
    return {
        accent: "clan",
        header: {
            label: copy.signupReminder.label,
            title: event.title,
            chips: categoryChip(event.category),
        },
        blocks: [
            ...(sides ? [{ kind: "text" as const, markdown: sides }] : []),
            ...(date && time
                ? [
                      {
                          kind: "text" as const,
                          markdown: joinParts([
                              `**${date} · ${time}**`,
                              discordTimestamp(event.gameStart, "R"),
                          ]),
                      },
                  ]
                : []),
            ...(facts
                ? [{ kind: "meta" as const, lines: [{ text: facts }] }]
                : []),
            ...(deadline
                ? [
                      {
                          kind: "text" as const,
                          markdown: joinParts([
                              chipText(chip),
                              deadline,
                              discordTimestamp(event.registrationEnd, "R"),
                          ]),
                      },
                  ]
                : []),
            { kind: "text", markdown: copy.signupReminder.body },
            ...(input.sentByLeaders ? [SENT_BY_LEADERS(copy)] : []),
            { kind: "separator", divider: true, spacing: "small" },
            { kind: "buttons", buttons },
        ],
        footer: dmFooter(frame),
    }
}

// --- Attendance reminder (L2-16..27) -------------------------------------

export type DmPlace =
    | { kind: "squad"; squad: string; role?: string; leader?: string }
    | { kind: "reserve" }

function placeLine(place: DmPlace | undefined, copy: DmCopy) {
    if (!place) return undefined
    if (place.kind === "reserve") {
        const [head, ...rest] = copy.attendanceReminder.reserve.split(" · ")
        return joinParts([`**${head}**`, ...rest])
    }
    const squad = joinParts([
        escapeMarkdownText(oneLine(place.squad)),
        place.role ? escapeMarkdownText(oneLine(place.role)) : undefined,
    ])
    return joinParts([
        `**${squad}**`,
        place.leader
            ? fillTemplate(copy.attendanceReminder.squadLeader, {
                  name: place.leader,
              })
            : undefined,
    ])
}

/**
 * "Připomínka docházky": "Zítra hraješ VLK vs ROG" (today, tomorrow or just
 * the match), the weekday schedule, the player's place and the confirm,
 * running-late and cannot-come buttons. A manual reminder adds the relative
 * time and "Připomínku poslalo velení z Logi."
 */
export function attendanceReminderView(input: {
    event: Pick<
        DmEvent,
        "id" | "title" | "meetingStart" | "gameStart" | "guildId"
    >
    place?: DmPlace
    now: number
    sentByLeaders?: boolean
    copy: DmCopy
    frame: DmFrame
}): MessageView {
    const { event, copy, frame } = input
    const day = calendarDayOffset(
        Date.parse(event.gameStart),
        input.now,
        frame.timeZone
    )
    const title = fillTemplate(
        day === 0
            ? copy.attendanceReminder.titleToday
            : day === 1
              ? copy.attendanceReminder.titleTomorrow
              : copy.attendanceReminder.title,
        { match: event.title }
    )
    const schedule = dmSchedule(
        event,
        copy,
        frame.timeZone,
        Boolean(input.sentByLeaders)
    )
    const place = placeLine(input.place, copy)
    return {
        accent: "clan",
        header: { label: copy.attendanceReminder.label, title },
        blocks: [
            ...(schedule
                ? [{ kind: "meta" as const, lines: [{ text: schedule }] }]
                : []),
            ...(place ? [{ kind: "text" as const, markdown: place }] : []),
            { kind: "text", markdown: copy.attendanceReminder.body },
            ...(input.sentByLeaders ? [SENT_BY_LEADERS(copy)] : []),
            { kind: "separator", divider: true, spacing: "small" },
            {
                kind: "buttons",
                buttons: [
                    {
                        kind: "action",
                        id: attendanceButtonIds.confirm(
                            event.id,
                            event.guildId
                        ),
                        label: copy.attendanceReminder.confirm,
                        style: "primary",
                    },
                    {
                        kind: "action",
                        id: attendanceButtonIds.late(event.id, event.guildId),
                        label: copy.attendanceReminder.late,
                        style: "secondary",
                    },
                    {
                        kind: "action",
                        id: attendanceButtonIds.decline(
                            event.id,
                            event.guildId
                        ),
                        label: copy.attendanceReminder.decline,
                        style: "danger",
                    },
                ],
            },
        ],
        footer: dmFooter(frame),
    }
}

// --- Replies in the same DM (L2-28..34) ----------------------------------

/** The divider the board draws above a DM's footer (L2-28..34, L2-52). */
const FOOTER_DIVIDER: MessageBlock = {
    kind: "separator",
    divider: true,
    spacing: "small",
}

/**
 * A reply card. In a DM it is a normal message with a divider and the DM
 * footer; in the server it is private (Discord adds "Tuto zprávu vidíte
 * jen vy").
 */
function reply(
    input: { title: string; blocks: MessageBlock[] },
    where: { dm: boolean; frame?: DmFrame }
): MessageView {
    const frame = where.dm ? where.frame : undefined
    return {
        accent: "clan",
        ...(where.dm ? {} : { ephemeral: true }),
        header: { title: input.title },
        blocks: frame ? [...input.blocks, FOOTER_DIVIDER] : input.blocks,
        ...(frame ? { footer: dmFooter(frame) } : {}),
    }
}

/** "Účast potvrzena · Uvidíme se v ne 11. 10. v 19:30 v kanálu 🔊 Sraz." */
export function attendanceConfirmedReply(input: {
    event: Pick<DmEvent, "meetingStart" | "meetingChannelId">
    copy: DmCopy
    dateAt: string
    timeZone: string
    dm: boolean
    frame?: DmFrame
}): MessageView {
    const { copy } = input
    const date = weekdayDateAt(
        input.event.meetingStart,
        copy.locale,
        input.timeZone,
        input.dateAt
    )
    const channel = channelMention(input.event.meetingChannelId)
    const body = date
        ? channel
            ? fillTemplate(copy.replies.confirmedBody, { date, channel })
            : fillTemplate(copy.replies.confirmedBodyNoChannel, { date })
        : undefined
    return reply(
        {
            title: copy.replies.confirmedTitle,
            blocks: body ? [{ kind: "text", markdown: body }] : [],
        },
        input
    )
}

/** A short reply card: a title and one sentence. */
export function simpleReply(input: {
    title: string
    body?: string
    dm: boolean
    frame?: DmFrame
}): MessageView {
    return reply(
        {
            title: input.title,
            blocks: input.body ? [{ kind: "text", markdown: input.body }] : [],
        },
        input
    )
}

/** "Zápas už začal": confirming or excusing after the start is refused. */
export function matchStartedReply(input: {
    copy: DmCopy
    dm: boolean
    frame?: DmFrame
}) {
    return simpleReply({
        title: input.copy.replies.startedTitle,
        body: input.copy.replies.startedBody,
        dm: input.dm,
        frame: input.frame,
    })
}

/** "Velení ví, že přijdeš později" with the typed text as a quote. */
export function lateNoticeSavedReply(input: {
    text: string
    copy: DmCopy
    dm: boolean
    frame?: DmFrame
}): MessageView {
    const quote = oneLine(input.text).slice(0, 500)
    return reply(
        {
            title: input.copy.replies.lateSavedTitle,
            blocks: quote
                ? [{ kind: "text", markdown: `> ${escapeMarkdownText(quote)}` }]
                : [],
        },
        input
    )
}

/** "Velení ví, že nedorazíš · Tvoje místo v F1 obsadí někdo ze záloh. …" */
export function declineSavedReply(input: {
    squad?: string
    alreadySaved?: boolean
    copy: DmCopy
    dm: boolean
    frame?: DmFrame
}): MessageView {
    const { copy } = input
    const squad = input.squad?.trim()
    return simpleReply({
        title: input.alreadySaved
            ? copy.replies.declineAlreadyTitle
            : copy.replies.declineSavedTitle,
        body: squad
            ? fillTemplate(copy.replies.declineSavedBody, {
                  squad: escapeMarkdownText(oneLine(squad)),
              })
            : copy.replies.declineSavedBodyReserve,
        dm: input.dm,
        frame: input.frame,
    })
}

/** The forms behind "Přijdu později" and "Nemůžu", in the clan language. */
export function attendanceModalCopy(
    kind: "late" | "decline",
    matchTitle: string,
    copy: DmCopy
) {
    const r = copy.replies
    return kind === "late"
        ? {
              title: fillTemplate(r.lateModalTitle, { match: matchTitle }),
              label: r.lateLabel,
              placeholder: r.latePlaceholder,
              required: true,
          }
        : {
              title: fillTemplate(r.declineModalTitle, { match: matchTitle }),
              label: r.declineLabel,
              placeholder: r.declinePlaceholder,
              required: false,
          }
}

// --- Roster change DM (L2-35..40) ----------------------------------------

/**
 * One DM per player with all their changes: on the roster, off it (into
 * the reserves), another squad, another role, or a move and a role change
 * together. A player without a role reads "bez role".
 */
export function rosterChangeDmView(input: {
    event: Pick<
        DmEvent,
        "id" | "title" | "meetingStart" | "gameStart" | "guildId"
    >
    change: RosterPlayerChange
    /** The leader of the player's new squad, already escaped. */
    leader?: string
    rosterUrl: string
    copy: DmCopy
    rosterCopy: RosterCopy
    frame: DmFrame
}): MessageView {
    const { change, copy, rosterCopy, frame } = input
    const c = copy.rosterChange
    const role = (value: string | undefined) =>
        value ? escapeMarkdownText(oneLine(value)) : rosterCopy.common.noRole
    const squad = (value: string | undefined) =>
        escapeMarkdownText(oneLine(value ?? ""))
    const leader = input.leader
        ? fillTemplate(c.squadLeader, { name: input.leader })
        : undefined
    let title: string
    let line: string | undefined
    let removed = false
    if (change.removed) {
        removed = true
        title = c.removedTitle
        const place = change.before?.role
            ? `${squad(change.before.squad)} (${role(change.before.role)})`
            : squad(change.before?.squad)
        line = fillTemplate(c.removedBody, { place })
    } else if (change.added) {
        title = c.addedTitle
        line = joinParts([
            `**${joinParts([squad(change.after?.squad), change.after?.role ? role(change.after.role) : undefined])}**`,
            leader,
        ])
    } else if (change.moved) {
        title = fillTemplate(c.movedTitle, {
            squad: oneLine(change.after!.squad),
        })
        line = joinParts([
            `**${squad(change.before?.squad)} → ${squad(change.after?.squad)}**`,
            change.roleChanged
                ? `**${role(change.before?.role)} → ${role(change.after?.role)}**`
                : fillTemplate(c.roleStays, { role: role(change.after?.role) }),
            leader,
        ])
    } else {
        title = fillTemplate(c.roleTitle, {
            role: change.after?.role
                ? oneLine(change.after.role)
                : rosterCopy.common.noRole,
        })
        line = joinParts([
            `**${role(change.before?.role)} → ${role(change.after?.role)}**`,
            fillTemplate(c.squadStays, { squad: squad(change.after?.squad) }),
            leader,
        ])
    }
    const schedule = dmSchedule(input.event, copy, frame.timeZone, true)
    const reserveLine =
        change.removed && change.toReserves
            ? placeLine({ kind: "reserve" }, copy)
            : undefined
    return {
        accent: "clan",
        header: {
            label: fillTemplate(c.label, { match: input.event.title }),
            title,
        },
        blocks: [
            ...(schedule
                ? [{ kind: "meta" as const, lines: [{ text: schedule }] }]
                : []),
            ...(line ? [{ kind: "text" as const, markdown: line }] : []),
            ...(reserveLine
                ? [{ kind: "text" as const, markdown: reserveLine }]
                : []),
            { kind: "separator", divider: true, spacing: "small" },
            {
                kind: "buttons",
                buttons: [
                    removed && !change.toReserves
                        ? {
                              kind: "link",
                              url: input.rosterUrl,
                              label: c.openRoster,
                          }
                        : {
                              ...showAssignmentButton(
                                  input.event.id,
                                  rosterCopy,
                                  input.event.guildId
                              ),
                              label: c.showAssignment,
                          },
                ],
            },
        ],
        footer: dmFooter(frame),
    }
}

// --- Match recap (L2-41..51) ---------------------------------------------

export type RecapStats = {
    cashDelta?: number | null
    kills: number
    deaths: number
    kd: number
    previous?: {
        matches: number
        kills: number
        deaths: number
        kd: number
        cashDelta?: number | null
    }
}

/** A number in the clan locale ("2,40" in Czech). */
export function formatDecimal(value: number, locale: string, digits: number) {
    return new Intl.NumberFormat(locale, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    }).format(Number.isFinite(value) ? value : 0)
}

/** The custom IDs of the recap buttons; the event carries the clan language. */
export const recapButtonIds = {
    turnOff: (eventId: string) => `match-recap:unsubscribe:${eventId}`,
    turnOn: (eventId: string) => `match-recap:subscribe:${eventId}`,
} as const

/**
 * "Shrnutí zápasu · Hell Let Loose": the match with its category, the date,
 * map and the player's place, the result and side, three numbers, the
 * comparison with earlier matches and the data source. Turned off, the same
 * DM shows "Shrnutí vypnutá" and "Zapnout shrnutí".
 */
export function matchRecapView(input: {
    event: Pick<DmEvent, "id" | "title" | "category" | "gameStart" | "mapLabel">
    gameId?:
        | "hell_let_loose"
        | "hell_let_loose_vietnam"
        | "wardogs"
        | "world_of_warcraft_forever"
    place?: { squad: string; role?: string }
    result?: {
        outcome: "win" | "loss" | "draw"
        score: string
        team?: string
        side?: string
    } | null
    stats: RecapStats
    source?: { server?: string; provider: string }
    /** Generated player-performance card for this match. */
    performanceImage?: string
    statsUrl: string
    settingsUrl?: string
    enabled: boolean
    copy: DmCopy
    rosterCopy: RosterCopy
    frame: DmFrame
}): MessageView {
    const { copy, frame, event, stats } = input
    const r = copy.recap
    const locale = copy.locale
    const date = weekdayDate(event.gameStart, locale, frame.timeZone)
    const meta = joinParts([
        date,
        event.mapLabel,
        input.place
            ? escapeMarkdownText(oneLine(input.place.squad))
            : undefined,
        input.place?.role
            ? escapeMarkdownText(oneLine(input.place.role))
            : undefined,
    ])
    const outcomeChip: MessageChip | undefined = input.result
        ? {
              label: fillTemplate(r.outcome[input.result.outcome], {
                  score: input.result.score,
              }),
              tone:
                  input.result.outcome === "win"
                      ? "success"
                      : input.result.outcome === "loss"
                        ? "danger"
                        : "neutral",
          }
        : undefined
    const sideText = (() => {
        const side = input.result?.side?.trim()
        if (!side) return undefined
        const kind = sideKind(side)
        const sideName = kind
            ? input.rosterCopy.sideAccusative[kind]
            : escapeMarkdownText(oneLine(side))
        const team = input.result?.team?.trim()
        return team
            ? fillTemplate(r.side, {
                  team: escapeMarkdownText(oneLine(team)),
                  side: sideName,
              })
            : sideName
    })()
    const numbers = [
        `${r.kills} **${stats.kills}**`,
        `${r.deaths} **${stats.deaths}**`,
        `${r.kd} **${formatDecimal(stats.kd, locale, 2)}**`,
        ...(input.gameId === "wardogs"
            ? [
                  `${r.money} **${stats.cashDelta == null ? "—" : formatDecimal(stats.cashDelta, locale, 0)}**`,
              ]
            : []),
    ].join(" · ")
    const comparison =
        input.enabled && stats.previous?.matches
            ? fillTemplate(r.comparison, {
                  matches: String(stats.previous.matches),
                  kills: formatDecimal(stats.previous.kills, locale, 1),
                  deaths: formatDecimal(stats.previous.deaths, locale, 1),
                  kd: formatDecimal(stats.previous.kd, locale, 2),
              }) +
              (input.gameId === "wardogs" && stats.previous.cashDelta != null
                  ? ` · ${r.money} ${formatDecimal(stats.previous.cashDelta, locale, 0)}`
                  : "")
            : undefined
    const sourceLine =
        input.enabled && input.source
            ? input.source.server?.trim()
                ? fillTemplate(r.source, {
                      server: escapeMarkdownText(oneLine(input.source.server)),
                      provider: input.source.provider,
                  })
                : fillTemplate(r.sourceNoServer, {
                      provider: input.source.provider,
                  })
            : undefined
    const offChip: MessageChip = { label: r.offChip, tone: "neutral" }
    const buttons: MessageButton[] = input.enabled
        ? [
              { kind: "link", url: input.statsUrl, label: r.viewStats },
              {
                  kind: "action",
                  id: recapButtonIds.turnOff(event.id),
                  label: r.turnOff,
                  style: "secondary",
              },
          ]
        : [
              { kind: "link", url: input.statsUrl, label: r.viewStats },
              {
                  kind: "action",
                  id: recapButtonIds.turnOn(event.id),
                  label: r.turnOn,
                  style: "secondary",
              },
              ...(input.settingsUrl
                  ? [
                        {
                            kind: "link" as const,
                            url: input.settingsUrl,
                            label: r.openSettings,
                        },
                    ]
                  : []),
          ]
    const game = input.gameId
        ? (
              copy.games as Partial<
                  Record<NonNullable<typeof input.gameId>, string>
              >
          )[input.gameId]
        : undefined
    return {
        accent: "clan",
        header: {
            label: game
                ? fillTemplate(r.label, { game })
                : r.label.split(" · ")[0],
            title: event.title,
            chips: categoryChip(event.category),
        },
        blocks: [
            ...(meta
                ? [{ kind: "meta" as const, lines: [{ text: meta }] }]
                : []),
            ...(outcomeChip || sideText
                ? [
                      {
                          kind: "text" as const,
                          markdown: joinParts([
                              outcomeChip ? chipText(outcomeChip) : undefined,
                              sideText,
                          ]),
                      },
                  ]
                : []),
            { kind: "text", markdown: numbers },
            ...(comparison
                ? [{ kind: "text" as const, markdown: comparison }]
                : []),
            ...(sourceLine
                ? [{ kind: "text" as const, markdown: `-# ${sourceLine}` }]
                : []),
            ...(input.enabled && input.performanceImage
                ? [
                      {
                          kind: "gallery" as const,
                          items: [
                              {
                                  url: input.performanceImage,
                                  description: event.title,
                              },
                          ],
                      },
                  ]
                : []),
            ...(input.enabled
                ? []
                : [
                      {
                          kind: "text" as const,
                          markdown: joinParts([chipText(offChip), r.offDetail]),
                      },
                  ]),
            { kind: "separator", divider: true, spacing: "small" },
            { kind: "buttons", buttons },
        ],
        footer: dmFooter(frame),
    }
}

// --- Training result (L2-52..53) -----------------------------------------

/**
 * "Výsledek tréninku": the training, its date and "hodnotilo velení", then
 * "Splněno" with the new role, or "Nesplněno" with where to find the next
 * date.
 */
export function trainingResultView(input: {
    title: string
    gameStart: string
    passed: boolean
    /** Role names granted for passing, as plain text. */
    rewardRoles?: string[]
    copy: DmCopy
    frame: DmFrame
}): MessageView {
    const { copy, frame } = input
    const t = copy.training
    const when = joinParts([
        weekdayDate(input.gameStart, copy.locale, frame.timeZone),
        discordTimestamp(input.gameStart, "t"),
        t.evaluated,
    ])
    const chip: MessageChip = input.passed
        ? { label: t.passed, tone: "success" }
        : { label: t.failed, tone: "danger" }
    const roles = (input.rewardRoles ?? [])
        .map((role) => role.trim())
        .filter(Boolean)
    const detail = input.passed
        ? roles.length
            ? fillTemplate(t.newRole, {
                  role: roles
                      .map(
                          (role) => `**@${escapeMarkdownText(oneLine(role))}**`
                      )
                      .join(", "),
              })
            : undefined
        : undefined
    return {
        accent: "clan",
        header: { label: t.label, title: input.title },
        blocks: [
            ...(when
                ? [{ kind: "meta" as const, lines: [{ text: when }] }]
                : []),
            {
                kind: "text",
                markdown: joinParts([chipText(chip), detail]),
            },
            ...(input.passed
                ? []
                : [{ kind: "text" as const, markdown: t.nextDate }]),
            FOOTER_DIVIDER,
        ],
        footer: dmFooter(frame),
    }
}
