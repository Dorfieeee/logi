import { canAcceptSignups, isEventCancelledBeforeMeeting } from "./status"
import type { EventKind, EventStatus } from "./types"

/**
 * The states of the one announcement card a match keeps in `#oznameni` from
 * the announcement to the result (board L1, rule L1-B03):
 *
 * Přihlášky otevřené → (Skupina plná) → Přihlášky uzavřené → Soupiska
 * zveřejněna → Začíná → Hraje se → Odehráno, or Zrušeno when the match was
 * ended before its meeting. "Skupina plná" is the open state with a full
 * capped group; the card names those groups instead of changing state.
 */
export const ANNOUNCEMENT_STATES = [
    "open",
    "closed",
    "roster",
    "starting",
    "playing",
    "played",
    "cancelled",
] as const
export type AnnouncementState = (typeof ANNOUNCEMENT_STATES)[number]

export type AnnouncementStateEvent = {
    kind?: EventKind
    status?: EventStatus
    registrationEnd: string
    meetingStart: string
    gameStart: string
    concludedAt?: string
}

const at = (value: string | undefined) =>
    value ? Date.parse(value) : Number.NaN

/**
 * The card state now. Sign-ups follow the stored status (the same rule the
 * sign-up buttons enforce); the meeting and the start follow the clock,
 * because nothing in the stored status changes at those moments. A concluded
 * match is "cancelled" when it was ended before its meeting (L1-60), else
 * "played".
 */
export function deriveAnnouncementState(input: {
    event: AnnouncementStateEvent
    rosterPublished: boolean
    now: Date
}): AnnouncementState {
    const { event, now } = input
    if (event.status === "concluded")
        return isEventCancelledBeforeMeeting(event) ? "cancelled" : "played"
    if (canAcceptSignups(event, now)) return "open"
    const time = now.getTime()
    const gameStart = at(event.gameStart)
    const meetingStart = at(event.meetingStart)
    if (Number.isFinite(gameStart) && time >= gameStart) return "playing"
    if (Number.isFinite(meetingStart) && time >= meetingStart) return "starting"
    return input.rosterPublished && (event.kind ?? "match") === "match"
        ? "roster"
        : "closed"
}

/**
 * Times after `now` at which the card changes state without any stored
 * change: the meeting ("Začíná") and the start ("Hraje se"). The scheduler
 * redraws the card at each of them.
 */
export function announcementRefreshTimes(
    event: Pick<AnnouncementStateEvent, "meetingStart" | "gameStart">,
    now: Date
): string[] {
    return [event.meetingStart, event.gameStart].filter((value) => {
        const time = at(value)
        return Number.isFinite(time) && time > now.getTime()
    })
}

/** One button of the announcement; the bot and the preview label them. */
export type AnnouncementAction =
    | "signup"
    | "editSignup"
    | "decline"
    | "calendar"
    | "assignment"
    | "openRoster"
    | "confirm"
    | "late"
    | "attendanceDecline"
    | "match"

/**
 * The buttons of each state, in rows (L1-B04): open 5 (sign up, edit,
 * decline, sign-ups, calendar); closed 2; roster published 5; starting 4;
 * playing none; played one link to the match; cancelled none. A start
 * without a published roster has nothing to confirm, so it keeps only the
 * sign-up list.
 */
export function announcementActions(
    state: AnnouncementState,
    options: {
        kind?: EventKind
        rosterPublished: boolean
        /** A public match page exists. */
        hasMatchPage: boolean
    }
): AnnouncementAction[][] {
    switch (state) {
        case "open":
            return [["signup", "editSignup", "decline"], ["calendar"]]
        case "closed":
            return [["calendar"]]
        case "roster":
            return [
                ["confirm", "late", "attendanceDecline"],
                ["assignment", "openRoster", "calendar"],
            ]
        case "starting":
            return options.rosterPublished &&
                (options.kind ?? "match") === "match"
                ? [["confirm", "late", "attendanceDecline"], ["assignment"]]
                : []
        case "playing":
        case "cancelled":
            return []
        case "played":
            return options.hasMatchPage ? [["match"]] : []
    }
}

/**
 * Capped groups with no free place, in the order given: "Tanky a Recon jsou
 * plné" on the card (L1-28, L1-B05).
 */
export function fullSignupGroups<
    T extends { name: string; count: number; max?: number },
>(groups: readonly T[]): T[] {
    return groups.filter(
        (group) => group.max !== undefined && group.count >= group.max
    )
}
