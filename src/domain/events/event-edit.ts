import type { EventParticipant, EventStatus } from "./types"

/** Published events remain editable so managers can correct historical details. */
export type EventEditability = "editable" | "draft"

export function eventEditability(
    event: {
        isDraft?: boolean
        status?: EventStatus
        registrationEnd: string
        meetingStart: string
        gameEnd: string
    },
    _now: Date
): EventEditability {
    return event.isDraft === true ? "draft" : "editable"
}

export type EventSeriesRole =
    { kind: "source" } | { kind: "occurrence"; sourceId: string } | null

/**
 * The event's place in a weekly series: the match that carries the
 * recurrence, one of the dates generated from it, or none. Monthly
 * recurrences are labels only (Logi does not generate them) and count as none.
 */
export function eventSeriesRole(event: {
    recurrence?: { frequency: string }
    recurrenceSeriesId?: string
}): EventSeriesRole {
    if (event.recurrenceSeriesId)
        return { kind: "occurrence", sourceId: event.recurrenceSeriesId }
    return event.recurrence?.frequency === "weekly" ? { kind: "source" } : null
}

/** Players signed up (attending) in total and per group name, as the announcement counts them. */
export function signupCounts(
    participants: ReadonlyArray<Pick<EventParticipant, "status" | "group">>
) {
    const byGroup: Record<string, number> = {}
    let total = 0
    for (const participant of participants) {
        if (participant.status !== "attending") continue
        total += 1
        if (participant.group)
            byGroup[participant.group] = (byGroup[participant.group] ?? 0) + 1
    }
    return { total, byGroup }
}
