import { ButtonStyle } from "discord.js"

import {
    getIntlLocaleForClanLanguage,
    isClanLanguage,
} from "../../src/lib/clan-language/core"
import { eventInfoMessageRenderVersion } from "../../src/domain/discord-sync/render-version"
import { getPanelMessages } from "../../src/lib/clan-language/panels"
import { getEventMessages } from "../../src/lib/clan-language/events"
import { plainText } from "../../src/domain/events/calendar-link"

import type { ClanLanguage, DiscordConfig, EventRecord } from "./types"
import { env } from "./environment"

export async function withTimeout<T>(
    operation: Promise<T>,
    timeoutMs: number,
    label: string
): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
        return await Promise.race([
            operation,
            new Promise<T>((_resolve, reject) => {
                timer = setTimeout(
                    () =>
                        reject(
                            new Error(
                                `${label} timed out after ${timeoutMs}ms.`
                            )
                        ),
                    timeoutMs
                )
            }),
        ])
    } finally {
        if (timer) clearTimeout(timer)
    }
}

/**
 * A Google Calendar link for an event outside its announcement (the calendar
 * panel): from the meeting to the end, the description when there is one and
 * "Discord" as the place. Never a channel ID, the game server or the old
 * "Briefing k operaci z Logi" filler (board L1-143). The announcement's own
 * button uses `buildCalendarLink` with the clan, the channel and the times.
 */
export function generateCalendarUrl(
    event: EventRecord,
    language: ClanLanguage
): string {
    const base = "https://calendar.google.com/calendar/render?action=TEMPLATE"
    const title = encodeURIComponent(event.name)
    const messages = getPanelMessages(language)
    const formatTime = (isoStr: string) =>
        new Date(isoStr).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z"

    const start = Number.isFinite(Date.parse(event.meetingStart))
        ? event.meetingStart
        : event.gameStart
    const dates = `${formatTime(start)}/${formatTime(event.gameEnd)}`
    const description = plainText(event.description ?? "")
    const details = description
        ? `&details=${encodeURIComponent(description)}`
        : ""
    const location = encodeURIComponent(messages.calendar.fallbackLocation)

    return `${base}&text=${title}&dates=${dates}${details}&location=${location}`
}

export function buildDiscordMessageLink(
    guildId: string,
    channelId?: string,
    messageId?: string
) {
    if (!channelId) return null
    return messageId
        ? `https://discord.com/channels/${guildId}/${channelId}/${messageId}`
        : `https://discord.com/channels/${guildId}/${channelId}`
}

export function formatEventStatus(
    status: EventRecord["status"],
    language: ClanLanguage
) {
    const messages = getEventMessages(language)
    switch (status) {
        case "registration":
            return messages.statuses.registration
        case "closed":
            return messages.statuses.closed
        case "starting":
            return messages.statuses.starting
        case "concluded":
            return messages.statuses.concluded
    }
}

function buildRosterImageCacheKey(eventId: string, rosterUpdatedAt?: string) {
    const versionSource = rosterUpdatedAt
        ? `${eventId}:${rosterUpdatedAt}`
        : `${eventId}:${Date.now()}`
    return Buffer.from(versionSource).toString("base64url")
}

// Keep signup and other embed-only changes out of this version. They should
// edit the existing Discord message without forcing a new expensive roster PNG.
export function getRosterImageVersion(
    event: EventRecord,
    rosterUpdatedAt?: string
) {
    return JSON.stringify([
        eventInfoMessageRenderVersion,
        rosterUpdatedAt,
        event.name,
        event.map,
        event.side,
        event.meetingStart,
        event.gameStart,
        event.gameEnd,
        event.cap,
        event.notes,
        event.server,
        // The public roster image never shows the server password.
        event.description,
        // Attendance notices change the public roster image's markers.
        event.absenceNotices,
    ])
}

export function buildRosterImageUrl(eventId: string, rosterUpdatedAt?: string) {
    const url = new URL(`/api/discord/roster-image/${eventId}`, env.appSiteUrl)
    url.searchParams.set(
        "cb",
        buildRosterImageCacheKey(eventId, rosterUpdatedAt)
    )
    return url.toString()
}

export function buildPublicRosterUrl(eventId: string, language: ClanLanguage) {
    return new URL(`/${language}/rosters/${eventId}`, env.appSiteUrl).toString()
}

/** Public match page (exists only for matches with linked statistics). */
export function buildPublicMatchUrl(eventId: string, language?: string) {
    const locale = isClanLanguage(language) ? language : "en"
    return new URL(
        `/${locale}/matches/${encodeURIComponent(eventId)}`,
        env.appSiteUrl
    ).toString()
}

export function pickButtonStyle(color: string) {
    const hex = color.replace(/^#/, "").trim()
    const r = parseInt(hex.substring(0, 2), 16)
    const g = parseInt(hex.substring(2, 4), 16)
    const b = parseInt(hex.substring(4, 6), 16)

    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
        return ButtonStyle.Secondary
    }

    const targets = {
        [ButtonStyle.Danger]: { r: 220, g: 38, b: 38 },
        [ButtonStyle.Success]: { r: 22, g: 163, b: 74 },
        [ButtonStyle.Primary]: { r: 37, g: 99, b: 235 },
    }

    let closestStyle = ButtonStyle.Secondary
    let minDistance = Infinity

    for (const [styleStr, target] of Object.entries(targets)) {
        const style = Number(styleStr) as ButtonStyle
        const distance = Math.sqrt(
            Math.pow(r - target.r, 2) +
                Math.pow(g - target.g, 2) +
                Math.pow(b - target.b, 2)
        )

        if (distance < minDistance) {
            minDistance = distance
            closestStyle = style
        }
    }

    const maxRGB = Math.max(r, g, b)
    const minRGB = Math.min(r, g, b)
    const saturation = maxRGB - minRGB

    if (saturation < 30 || minDistance > 160) {
        return ButtonStyle.Secondary
    }

    return closestStyle
}

export function formatInTimezone(
    timestamp: string,
    timezone: string,
    language: ClanLanguage
) {
    return new Intl.DateTimeFormat(getIntlLocaleForClanLanguage(language), {
        timeZone: timezone,
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date(timestamp))
}

export function formatShortDate(
    timestamp: string,
    timezone: string,
    language: ClanLanguage
) {
    return new Intl.DateTimeFormat(getIntlLocaleForClanLanguage(language), {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    })
        .format(new Date(timestamp))
        .replace(/\//g, "-")
}

export function buildForumThreadName(
    config: DiscordConfig,
    event: EventRecord
) {
    return `${event.name} ${formatShortDate(event.gameStart, config.timezone, config.defaultLanguage)}`.slice(
        0,
        100
    )
}

export function slugifyTicketLabel(value: string) {
    const normalized = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")

    return normalized || "ticket"
}
