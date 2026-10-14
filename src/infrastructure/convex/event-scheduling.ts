import {
    getAttendanceReminderDueAt,
    getSignupReminderDueAt,
    resolveAttendanceReminderHours,
    resolveSignupReminderStatuses,
} from "@/domain/events/scheduled-job-policy"
import { announcementRefreshTimes } from "@/domain/events/announcement-state"
import type { MutationCtx } from "../../../convex/_generated/server"
import type { Id } from "../../../convex/_generated/dataModel"
import { lastSignupReminderAt } from "./signup-reminder-state"

const EVENT_CONCLUSION_RESERVE_MS = 15 * 60 * 1000

/** Replaces an event's pending schedule after a successful upsert. */
export async function refreshEventSchedule(
    ctx: MutationCtx,
    eventId: Id<"events">
) {
    const event = await ctx.db.get(eventId)
    const historical = Boolean(
        event &&
        new Date(event.gameEnd).getTime() < Date.now() - 7 * 24 * 60 * 60 * 1000
    )
    if (!event || historical) return

    const nowDate = new Date()
    const now = nowDate.toISOString()
    const existingJobs = await ctx.db
        .query("eventScheduleJobs")
        .withIndex("eventId", (q) => q.eq("eventId", event._id))
        .collect()
    await Promise.all(existingJobs.map((job) => ctx.db.delete(job._id)))
    // A draft is never announced, so it has no deadlines until it is published.
    if (event.isDraft === true) return
    const lastReminderAt = await lastSignupReminderAt(
        ctx,
        event,
        nowDate.getTime()
    )
    const startAtMs = Math.max(
        new Date(event.registrationEnd).getTime(),
        new Date(event.meetingStart).getTime() - 24 * 60 * 60 * 1000
    )
    const deadlines = [
        ...(event.registrationStart
            ? [["registration-start", event.registrationStart] as const]
            : []),
        ["close-registration", event.registrationEnd],
        ["start-event", new Date(startAtMs).toISOString()],
        ...(event.createSquadVoiceChannels
            ? [["create-squad-voice-channels", event.meetingStart] as const]
            : []),
        [
            "conclude-event",
            new Date(
                new Date(event.gameEnd).getTime() + EVENT_CONCLUSION_RESERVE_MS
            ).toISOString(),
        ],
        // The announcement card changes at the meeting and at the start
        // without any stored change; redraw it then (board L1-B03).
        ...announcementRefreshTimes(event, nowDate).map(
            (dueAt) => ["refresh-announcement", dueAt] as const
        ),
        ...resolveAttendanceReminderHours(
            event.attendanceReminderHours
        ).flatMap((hours) => {
            const dueAt = getAttendanceReminderDueAt(
                event.meetingStart,
                hours,
                nowDate
            )
            return dueAt ? [["attendance-reminder", dueAt] as const] : []
        }),
        ...(() => {
            const dueAt = getSignupReminderDueAt(
                event.createdAt,
                event.registrationEnd,
                nowDate,
                false,
                event.registrationStart,
                lastReminderAt
            )
            return event.kind === "match" &&
                resolveSignupReminderStatuses(event.signupReminderStatuses)
                    .length > 0 &&
                dueAt
                ? [["signup-reminder", dueAt] as const]
                : []
        })(),
    ] as const
    await Promise.all(
        deadlines
            .filter(
                ([, dueAt]) =>
                    Number.isFinite(new Date(dueAt).getTime()) &&
                    new Date(dueAt).getTime() >= nowDate.getTime()
            )
            .map(([kind, dueAt]) =>
                ctx.db.insert("eventScheduleJobs", {
                    eventId: event._id,
                    kind,
                    dueAt,
                    status: "pending",
                    attempts: 0,
                    createdAt: now,
                    updatedAt: now,
                })
            )
    )
}
