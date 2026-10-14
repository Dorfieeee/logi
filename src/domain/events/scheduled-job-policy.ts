import type { EventStatus } from "./types"

const HISTORICAL_EVENT_AGE_MS = 7 * 24 * 60 * 60 * 1000
export const SIGNUP_REMINDER_INTERVAL_MS = 24 * 60 * 60 * 1000

/** Hours before the meeting when unconfirmed roster players get a DM. */
export const ATTENDANCE_REMINDER_OFFSETS = [24, 18, 12, 6] as const

/**
 * Supported offsets, largest first; anything else is dropped. Undefined stays
 * undefined (legacy events remind at every offset) and [] turns reminders off.
 */
export function normalizeAttendanceReminderHours(
    hours: readonly number[] | undefined
): number[] | undefined {
    if (hours === undefined) return undefined
    return ATTENDANCE_REMINDER_OFFSETS.filter((offset) =>
        hours.includes(offset)
    )
}

/** The offsets an event reminds at. */
export function resolveAttendanceReminderHours(
    hours: readonly number[] | undefined
): number[] {
    return (
        normalizeAttendanceReminderHours(hours) ?? [
            ...ATTENDANCE_REMINDER_OFFSETS,
        ]
    )
}

export function resolveSignupReminderStatuses(
    statuses: Array<"recruit" | "member" | "reserve_member"> | undefined
) {
    // Events created before this preference was introduced have no stored
    // value. Preserve the documented default for them; an explicit empty
    // array continues to mean that reminders are disabled.
    return statuses === undefined ? (["member"] as const) : statuses
}

/**
 * The next sign-up reminder (board L2-15, L2-B04): once a day from the day
 * after the announcement until sign-ups close. A match announced later than
 * it was created (`registrationStart`) counts from the announcement.
 */
export function getSignupReminderDueAt(
    createdAt: string,
    registrationEnd: string,
    now: Date,
    scheduleOverdueImmediately = false,
    announcedAt?: string,
    lastReminderAt?: string
): string | null {
    const createdAtMs = new Date(createdAt).getTime()
    const registrationEndMs = new Date(registrationEnd).getTime()
    if (
        !Number.isFinite(createdAtMs) ||
        !Number.isFinite(registrationEndMs) ||
        registrationEndMs <= now.getTime()
    ) {
        return null
    }
    const announcedAtMs = announcedAt ? new Date(announcedAt).getTime() : NaN
    const firstDueAtMs =
        Math.max(
            createdAtMs,
            Number.isFinite(announcedAtMs) ? announcedAtMs : createdAtMs
        ) + SIGNUP_REMINDER_INTERVAL_MS
    if (firstDueAtMs >= registrationEndMs) return null

    const lastReminderMs = lastReminderAt ? Date.parse(lastReminderAt) : NaN
    if (Number.isFinite(lastReminderMs)) {
        const dueAtMs = Math.max(
            firstDueAtMs,
            lastReminderMs + SIGNUP_REMINDER_INTERVAL_MS,
            now.getTime()
        )
        return dueAtMs < registrationEndMs
            ? new Date(dueAtMs).toISOString()
            : null
    }

    const dueAtMs =
        firstDueAtMs > now.getTime() || scheduleOverdueImmediately
            ? Math.max(firstDueAtMs, now.getTime())
            : now.getTime() + 24 * 60 * 60 * 1000
    return dueAtMs < registrationEndMs ? new Date(dueAtMs).toISOString() : null
}

export function getAttendanceReminderDueAt(
    meetingStart: string,
    offsetHours: number,
    now: Date
): string | null {
    const meetingStartMs = new Date(meetingStart).getTime()
    if (!Number.isFinite(meetingStartMs) || meetingStartMs <= now.getTime()) {
        return null
    }

    const scheduledAtMs = meetingStartMs - offsetHours * 60 * 60 * 1000
    if (scheduledAtMs > now.getTime()) {
        return new Date(scheduledAtMs).toISOString()
    }

    // A reschedule inside the 24-hour window must still notify the roster.
    // Later reminder windows are intentionally not backfilled all at once.
    return offsetHours === 24 ? now.toISOString() : null
}

export function shouldDiscardScheduledJob(input: {
    eventStatus?: EventStatus
    gameEnd: string
    now: Date
    /** Drafts are never announced, so none of their deadlines may run. */
    isDraft?: boolean
}): boolean {
    if (input.eventStatus === "concluded" || input.isDraft === true) {
        return true
    }

    const gameEndMs = new Date(input.gameEnd).getTime()
    return (
        Number.isFinite(gameEndMs) &&
        gameEndMs < input.now.getTime() - HISTORICAL_EVENT_AGE_MS
    )
}

export function isExpiredScheduledJobClaim(
    claimedAt: string | undefined,
    now: Date
): boolean {
    if (!claimedAt) {
        return true
    }

    const claimedAtMs = new Date(claimedAt).getTime()
    return (
        !Number.isFinite(claimedAtMs) ||
        claimedAtMs < now.getTime() - 5 * 60 * 1000
    )
}
