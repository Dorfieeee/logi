import {
    escapeMarkdownText,
    panelFrame,
    type MessageBlock,
    type MessageView,
} from "../discord-messages/message-view"
import { categoryChipTone } from "../discord-messages/match-announcement"
import type { CalendarPanelCopy } from "./panel-copy"

/**
 * The calendar panel (L3-12..18, L3-B07): upcoming events grouped by local
 * day. Each compact row is its category-colour marker, title and local time
 * range, followed by a link to the Logi calendar and "Časy v tvém pásmu" in
 * the footer.
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
    /** Dashboard category colour, rendered as the closest Discord chip tone. */
    categoryColor?: string | null
    /** Localized map and mode, when this is a game event. */
    mapLabel?: string | null
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
const eventTitle = (title: string) => escapeMarkdownText(title)

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

function dayParts(entry: CalendarEntry, input: CalendarPanelInput) {
    const date = new Date(entry.startAt)
    const options: Intl.DateTimeFormatOptions = {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: input.timeZone,
    }
    try {
        return new Intl.DateTimeFormat(input.locale, options).formatToParts(
            date
        )
    } catch {
        return new Intl.DateTimeFormat("en", {
            ...options,
            timeZone: "UTC",
        }).formatToParts(date)
    }
}

function dayKey(entry: CalendarEntry, input: CalendarPanelInput) {
    return dayParts(entry, input)
        .filter(
            (part) =>
                part.type === "year" ||
                part.type === "month" ||
                part.type === "day"
        )
        .map((part) => part.value)
        .join("-")
}

function dayLabel(entry: CalendarEntry, input: CalendarPanelInput) {
    return dayParts(entry, input)
        .map((part) => part.value)
        .join("")
        .replace(/,$/, "")
}

function rowTime(entry: CalendarEntry, input: CalendarPanelInput) {
    if (entry.allDay) return input.copy.allDay
    const start = `<t:${unix(entry.startAt)}:t>`
    return entry.range && Date.parse(entry.endAt) > Date.parse(entry.startAt)
        ? `${start} – <t:${unix(entry.endAt)}:t>`
        : start
}

function rowMarker(entry: CalendarEntry) {
    const markers = {
        success: "🟢",
        warning: "🟡",
        danger: "🔴",
        neutral: "⚪",
        info: "🔵",
    } as const
    return markers[categoryChipTone(entry.categoryColor)]
}

function groupedRows(
    entries: readonly CalendarEntry[],
    input: CalendarPanelInput
) {
    const groups = new Map<
        string,
        { label: string; entries: CalendarEntry[] }
    >()
    for (const entry of entries.slice(0, CALENDAR_PANEL_ROWS)) {
        const key = dayKey(entry, input)
        const group = groups.get(key)
        if (group) group.entries.push(entry)
        else
            groups.set(key, { label: dayLabel(entry, input), entries: [entry] })
    }
    return [...groups.values()].map((group) => ({
        kind: "text" as const,
        markdown: [
            `**${escapeMarkdownText(group.label)}**`,
            ...group.entries.map(
                (entry) =>
                    `${rowMarker(entry)} **${eventTitle(entry.title)}** · ${rowTime(entry, input)}`
            ),
        ].join("\n"),
    }))
}

export function calendarPanelView(input: CalendarPanelInput): MessageView {
    const { copy } = input
    const entries = input.entries
    const content: MessageBlock[] = groupedRows(entries, input)
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
