import {
    escapeMarkdownText,
    panelFrame,
    type MessageBlock,
    type MessageView,
} from "../discord-messages/message-view"
import type { CalendarPanelCopy } from "./panel-copy"
import { shortDate } from "./result-panel"

/**
 * The calendar panel (L3-12..18, L3-B07): "Nejbližší akce" with the next
 * match highlighted, compact rows "date · time · type · linked title", a
 * link to the Logi calendar and "Časy v tvém pásmu" in the footer. A type is
 * a word, not a coloured square; announcements show their native Discord
 * channel mention rather than a raw message URL.
 */
export type CalendarEntry = {
    id: string
    title: string
    /** "Trénink", "Přátelák", "ECL, 3. kolo"; null for manual calendar items. */
    typeWord: string | null
    startAt: string
    endAt: string
    allDay: boolean
    /** The announcement in Discord, when the bot has posted one. */
    url: string | null
    /** Sign-ups close ("přihlášky do so 10. 10. · 19:30"). */
    signupUntil: string | null
    /** Event category key for the settings filter; null for manual items. */
    category: string | null
    /** A clan event (match or training), not a manual calendar item. */
    event: boolean
    /** Show the end time too ("19:00–21:00"): trainings and timed items. */
    range: boolean
}

export const CALENDAR_PANEL_ROWS = 10

/**
 * The entries the panel shows: upcoming (not ended), ordered by start, and —
 * when categories are chosen in settings — only events of those categories
 * (manual calendar items always show).
 */
export function calendarPanelEntries(
    entries: readonly CalendarEntry[],
    input: { now: number; categories: readonly string[] }
): CalendarEntry[] {
    const wanted = new Set(input.categories.map((value) => value.toLowerCase()))
    return entries
        .filter((entry) => Date.parse(entry.endAt) >= input.now)
        .filter(
            (entry) =>
                !wanted.size ||
                !entry.event ||
                wanted.has((entry.category ?? "").toLowerCase())
        )
        .slice()
        .sort(
            (a, b) =>
                Date.parse(a.startAt) - Date.parse(b.startAt) ||
                a.title.localeCompare(b.title)
        )
}

const unix = (value: string) => Math.floor(Date.parse(value) / 1000)
const channelMention = (url: string | null) => {
    const match = url?.match(
        /^https:\/\/(?:ptb\.|canary\.)?discord\.com\/channels\/\d+\/(\d+)(?:\/\d+)?(?:[?#].*)?$/
    )
    return match ? `<#${match[1]}>` : null
}

const eventTitle = (title: string, url: string | null) =>
    [escapeMarkdownText(title), channelMention(url)].filter(Boolean).join(" · ")

export type CalendarPanelInput = {
    copy: CalendarPanelCopy
    locale: string
    timeZone: string
    clanName: string
    entries: readonly CalendarEntry[]
    now: number
    /** The Logi calendar page ("Otevřít kalendář"). */
    calendarUrl: string | null
    /** When the shown plan last changed. */
    updatedAt: number
    accentColor: string | null
    title?: string | null
}

function rowDate(entry: CalendarEntry, input: CalendarPanelInput) {
    const start = shortDate(entry.startAt, input.locale, input.timeZone)
    if (!entry.allDay) return start
    // An all-day item ends at the next midnight; show its last day.
    const end = shortDate(
        Date.parse(entry.endAt) - 1,
        input.locale,
        input.timeZone
    )
    return end && end !== start ? `${start} – ${end}` : start
}

function row(entry: CalendarEntry, input: CalendarPanelInput) {
    const time = entry.allDay
        ? input.copy.allDay
        : `<t:${unix(entry.startAt)}:t>${
              entry.range && Date.parse(entry.endAt) > Date.parse(entry.startAt)
                  ? `–<t:${unix(entry.endAt)}:t>`
                  : ""
          }`
    return [
        `**${rowDate(entry, input)}**`,
        time,
        entry.typeWord ? escapeMarkdownText(entry.typeWord) : null,
        eventTitle(entry.title, entry.url),
    ]
        .filter(Boolean)
        .join(" · ")
}

export function calendarPanelView(input: CalendarPanelInput): MessageView {
    const { copy } = input
    const entries = input.entries
    // "Další:" is the next match (L3-13); a training only when no match is planned.
    const next =
        entries.find((entry) => entry.event && entry.category !== "training") ??
        entries.find((entry) => entry.event) ??
        null
    const rest = entries
        .filter((entry) => entry !== next)
        .slice(0, CALENDAR_PANEL_ROWS)
    const content: MessageBlock[] = []
    if (next) {
        const when = [
            `${shortDate(next.startAt, input.locale, input.timeZone)} · <t:${unix(next.startAt)}:t>`,
            copy.relative(`<t:${unix(next.startAt)}:R>`),
            next.signupUntil && Date.parse(next.signupUntil) > input.now
                ? copy.signupUntil(
                      `${shortDate(next.signupUntil, input.locale, input.timeZone)} · <t:${unix(next.signupUntil)}:t>`
                  )
                : null,
        ]
            .filter(Boolean)
            .join(" · ")
        content.push({
            kind: "fields",
            items: [
                {
                    title: copy.next.replace(/:$/, ""),
                    text: `**${eventTitle(
                        [
                            next.title,
                            next.typeWord?.trim() !== next.title.trim()
                                ? next.typeWord
                                : null,
                        ]
                            .filter(Boolean)
                            .join(" · "),
                        next.url
                    )}**\n${when}`,
                },
            ],
        })
    }
    if (rest.length)
        content.push({
            kind: "text",
            markdown: rest.map((entry) => row(entry, input)).join("\n"),
        })
    if (!entries.length) content.push({ kind: "text", markdown: copy.empty })
    return panelFrame({
        accentColor: input.accentColor,
        label: copy.label(input.clanName),
        title: input.title?.trim() || copy.title,
        content,
        actions: input.calendarUrl
            ? [[{ kind: "link", url: input.calendarUrl, label: copy.open }]]
            : [],
        updatedAt: input.updatedAt,
        footerNotes: [copy.timesNote],
    })
}
