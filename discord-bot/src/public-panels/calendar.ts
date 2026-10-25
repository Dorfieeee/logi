import {
    calendarPanelEntries,
    calendarPanelView,
    type CalendarEntry,
} from "../../../src/domain/discord-publications/calendar-panel"
import { panelImageCopy } from "../../../src/domain/discord-publications/panel-image-copy"
import type { MessageView } from "../../../src/domain/discord-messages/message-view"
import { getPanelMessages } from "../../../src/lib/clan-language/panels"
import { expandCalendarItems } from "../../../src/lib/calendar-items"
import type { CalendarItem, SyncPayload } from "../types"
import { eventMapLabel } from "../events/match-context"

/**
 * The calendar panel (L3-12..18) from the guild sync data: clan events and
 * manual calendar items, the next match highlighted, titles linking to the
 * match's announcement in Discord (never Google Calendar), filtered by the
 * categories chosen in settings (L3-B07).
 */
export function calendarEntriesFromPayload(
    payload: Pick<
        SyncPayload,
        "config" | "events" | "calendarItems" | "syncStates"
    > & { guild: Pick<SyncPayload["guild"], "eventCategories"> },
    now: number
): CalendarEntry[] {
    const copy = getPanelMessages(payload.config.defaultLanguage).calendarPanel
    const categories = Array.isArray(payload.guild.eventCategories)
        ? payload.guild.eventCategories
        : []
    const states = Array.isArray(payload.syncStates) ? payload.syncStates : []
    const link = (eventId: string) => {
        const state = states.find((entry) => entry.eventId === eventId)
        return state?.announcementChannelId && state.announcementMessageId
            ? `https://discord.com/channels/${payload.config.guildId}/${state.announcementChannelId}/${state.announcementMessageId}`
            : null
    }
    const events: CalendarEntry[] = (
        Array.isArray(payload.events) ? payload.events : []
    )
        .filter((event) => event.status !== "concluded" && !event.isDraft)
        .map((event) => {
            const category =
                event.kind === "training"
                    ? "training"
                    : (event.matchType ?? "match")
            const label =
                event.kind === "training"
                    ? copy.training
                    : (categories.find(
                          (item) =>
                              item.id.toLowerCase() ===
                              event.matchType?.toLowerCase()
                      )?.label ??
                      event.matchType?.trim() ??
                      copy.match)
            const categoryColor =
                event.kind === "training"
                    ? (categories.find(
                          (item) => item.id.toLowerCase() === "training"
                      )?.color ?? null)
                    : (categories.find(
                          (item) =>
                              item.id.toLowerCase() ===
                              event.matchType?.toLowerCase()
                      )?.color ?? null)
            // L3-14: "ECL, 3. kolo" for a competition fixture with a round.
            const round =
                event.kind !== "training" &&
                typeof event.competitionRound === "number" &&
                Number.isInteger(event.competitionRound) &&
                event.competitionRound > 0
                    ? event.competitionRound
                    : null
            return {
                id: event.id,
                title: event.name,
                typeWord:
                    round !== null
                        ? copy.withRound(label, String(round))
                        : label,
                startAt: event.gameStart,
                endAt: event.gameEnd,
                allDay: false,
                url: link(event.id),
                signupUntil: event.registrationEnd ?? null,
                category,
                categoryColor,
                mapLabel: eventMapLabel(event, payload.config.defaultLanguage),
                event: true,
                range: event.kind === "training",
            }
        })
    const items: CalendarEntry[] = expandCalendarItems(
        (Array.isArray(payload.calendarItems)
            ? payload.calendarItems
            : []) as CalendarItem[] as never,
        new Date(now - 24 * 60 * 60 * 1000),
        new Date(now + 366 * 24 * 60 * 60 * 1000)
    ).map((item) => ({
        id: item.id,
        title: item.title,
        typeWord:
            item.label?.trim() && item.label.trim() !== item.title.trim()
                ? item.label.trim()
                : null,
        startAt: item.startAt,
        endAt: item.endAt,
        allDay: item.allDay,
        url: null,
        signupUntil: null,
        category: null,
        categoryColor: item.color,
        mapLabel: null,
        event: false,
        range: !item.allDay,
    }))
    return [...events, ...items]
}

/** When the shown plan last changed (the footer's "Aktualizováno"). */
export function calendarUpdatedAt(
    payload: Pick<SyncPayload, "config" | "events" | "calendarItems">,
    entries: readonly CalendarEntry[]
) {
    const ids = new Set(entries.map((entry) => entry.id))
    const times = [
        Date.parse(payload.config.updatedAt),
        ...(payload.events ?? [])
            .filter((event) => ids.has(event.id))
            .map((event) => Date.parse(event.updatedAt)),
        ...(payload.calendarItems ?? []).map((item) =>
            Date.parse((item as { updatedAt?: string }).updatedAt ?? "")
        ),
    ].filter(Number.isFinite)
    return times.length ? Math.max(...times) : Date.now()
}

export function buildCalendarPanelView(
    payload: Pick<
        SyncPayload,
        "config" | "events" | "calendarItems" | "syncStates"
    > & {
        guild: Pick<SyncPayload["guild"], "eventCategories" | "id" | "name">
    },
    input: {
        now: number
        siteUrl: string
        categories: readonly string[]
        title?: string | null
        accentColor?: string | null
    }
): MessageView {
    const language = payload.config.defaultLanguage
    const entries = calendarPanelEntries(
        calendarEntriesFromPayload(payload, input.now),
        { now: input.now, categories: input.categories }
    )
    const locale = ["cs", "de"].includes(language) ? language : "en"
    let calendarUrl: string | null = null
    try {
        calendarUrl = new URL(
            `/${locale}/dashboard/servers/${encodeURIComponent(payload.guild.id)}/calendar`,
            input.siteUrl
        ).href
        if (!/^https?:/.test(calendarUrl)) calendarUrl = null
    } catch {
        calendarUrl = null
    }
    return calendarPanelView({
        copy: getPanelMessages(language).calendarPanel,
        locale: panelImageCopy(language).locale,
        timeZone: payload.config.timezone,
        clanName: payload.guild.name,
        entries,
        categories: (payload.guild.eventCategories ?? []).filter(
            (category) =>
                !input.categories.length ||
                input.categories.some(
                    (id) => id.toLowerCase() === category.id.toLowerCase()
                )
        ),
        now: input.now,
        calendarUrl,
        updatedAt: calendarUpdatedAt(payload, entries),
        accentColor: input.accentColor ?? null,
        title: input.title ?? null,
    })
}
