import {
    getAttendanceReminderDueAt,
    getSignupReminderDueAt,
    isExpiredScheduledJobClaim,
    resolveAttendanceReminderHours,
    resolveSignupReminderStatuses,
    shouldDiscardScheduledJob,
} from "../src/domain/events/scheduled-job-policy"
import { lastSignupReminderAt } from "../src/infrastructure/convex/signup-reminder-state"
import { announcementRefreshTimes } from "../src/domain/events/announcement-state"
import { internalAuthSecret } from "./discord_shared"
import { mutation } from "./_generated/server"
import { v } from "convex/values"

function assertSecret(secret: string) {
    if (secret !== internalAuthSecret()) throw new Error("Unauthorized.")
}
const EVENT_CONCLUSION_RESERVE_MS = 15 * 60 * 1000

export const claimDue = mutation({
    args: { secret: v.string(), limit: v.optional(v.number()) },
    handler: async (ctx, args) => {
        assertSecret(args.secret)
        const now = new Date()
        const nowIso = now.toISOString()
        const limit = Math.max(1, Math.min(args.limit ?? 25, 100))
        // Inspect a larger page so stale rows cannot starve an event whose deadline is due now.
        const candidates = await ctx.db
            .query("eventScheduleJobs")
            .withIndex("status_dueAt", (q) =>
                q.eq("status", "pending").lte("dueAt", nowIso)
            )
            .take(500)
        const claimed: Array<{
            id: string
            eventId: string
            kind:
                | "close-registration"
                | "registration-start"
                | "start-event"
                | "create-squad-voice-channels"
                | "conclude-event"
                | "attendance-reminder"
                | "signup-reminder"
                | "refresh-announcement"
        }> = []

        for (const job of candidates) {
            const event = await ctx.db.get(job.eventId)
            if (
                !event ||
                shouldDiscardScheduledJob({
                    eventStatus: event.status,
                    gameEnd: event.gameEnd,
                    now,
                    isDraft: event.isDraft,
                })
            ) {
                await ctx.db.delete(job._id)
                continue
            }
            if (job.kind === "signup-reminder") {
                const lastAt = await lastSignupReminderAt(
                    ctx,
                    event,
                    now.getTime()
                )
                if (lastAt) {
                    const dueAt = getSignupReminderDueAt(
                        event.createdAt,
                        event.registrationEnd,
                        now,
                        true,
                        event.registrationStart,
                        lastAt
                    )
                    if (!dueAt) {
                        await ctx.db.delete(job._id)
                        continue
                    }
                    if (dueAt > nowIso) {
                        await ctx.db.patch(job._id, {
                            dueAt,
                            updatedAt: nowIso,
                        })
                        continue
                    }
                }
            }
            if (claimed.length >= limit) continue
            await ctx.db.patch(job._id, {
                status: "processing",
                attempts: job.attempts + 1,
                claimedAt: nowIso,
                updatedAt: nowIso,
            })
            claimed.push({
                id: String(job._id),
                eventId: String(job.eventId),
                kind: job.kind,
            })
        }

        return claimed
    },
})

export const complete = mutation({
    args: { secret: v.string(), jobId: v.id("eventScheduleJobs") },
    handler: async (ctx, args) => {
        assertSecret(args.secret)
        const job = await ctx.db.get(args.jobId)
        await ctx.db.delete(args.jobId)
        if (job?.kind !== "signup-reminder") return

        const event = await ctx.db.get(job.eventId)
        const now = new Date()
        if (
            !event ||
            event.kind !== "match" ||
            !resolveSignupReminderStatuses(event.signupReminderStatuses)
                .length ||
            event.status !== "registration"
        ) {
            return
        }
        const registrationEndMs = new Date(event.registrationEnd).getTime()
        const dueAt = new Date(now.getTime() + 24 * 60 * 60 * 1000)
        if (
            !Number.isFinite(registrationEndMs) ||
            dueAt.getTime() >= registrationEndMs
        ) {
            return
        }
        const nowIso = now.toISOString()
        await ctx.db.insert("eventScheduleJobs", {
            eventId: event._id,
            kind: "signup-reminder",
            dueAt: dueAt.toISOString(),
            status: "pending",
            attempts: 0,
            createdAt: nowIso,
            updatedAt: nowIso,
        })
    },
})

export const release = mutation({
    args: { secret: v.string(), jobId: v.id("eventScheduleJobs") },
    handler: async (ctx, args) => {
        assertSecret(args.secret)
        await ctx.db.patch(args.jobId, {
            status: "pending",
            claimedAt: undefined,
            updatedAt: new Date().toISOString(),
        })
    },
})

// Called on bot startup. It removes legacy jobs that can never do useful work
// and returns jobs abandoned by a crash to the pending queue.
export const recoverQueue = mutation({
    args: { secret: v.string() },
    handler: async (ctx, args) => {
        assertSecret(args.secret)
        const now = new Date()
        const nowIso = now.toISOString()
        const jobs = await ctx.db.query("eventScheduleJobs").collect()
        let removed = 0
        let released = 0

        for (const job of jobs) {
            const event = await ctx.db.get(job.eventId)
            if (
                !event ||
                shouldDiscardScheduledJob({
                    eventStatus: event.status,
                    gameEnd: event.gameEnd,
                    now,
                    isDraft: event.isDraft,
                })
            ) {
                await ctx.db.delete(job._id)
                removed += 1
            } else if (
                job.status === "processing" &&
                isExpiredScheduledJobClaim(job.claimedAt, now)
            ) {
                await ctx.db.patch(job._id, {
                    status: "pending",
                    claimedAt: undefined,
                    updatedAt: nowIso,
                })
                released += 1
            }
        }

        return { removed, released }
    },
})

// One-time-on-bot-start safety net for events created before durable jobs existed.
export const backfillMissing = mutation({
    args: { secret: v.string() },
    handler: async (ctx, args) => {
        assertSecret(args.secret)
        const nowDate = new Date()
        const now = nowDate.toISOString()
        const events = await ctx.db.query("events").collect()
        let created = 0
        for (const event of events) {
            const historical =
                new Date(event.gameEnd).getTime() <
                Date.now() - 7 * 24 * 60 * 60 * 1000
            if (historical || event.isDraft === true) continue
            const existingJobs = await ctx.db
                .query("eventScheduleJobs")
                .withIndex("eventId", (q) => q.eq("eventId", event._id))
                .collect()
            const startAtMs = Math.max(
                new Date(event.registrationEnd).getTime(),
                new Date(event.meetingStart).getTime() - 24 * 60 * 60 * 1000
            )
            const lastReminderAt = await lastSignupReminderAt(
                ctx,
                event,
                nowDate.getTime()
            )
            const deadlines = [
                ...(event.registrationStart
                    ? [["registration-start", event.registrationStart] as const]
                    : []),
                ["close-registration", event.registrationEnd],
                ["start-event", new Date(startAtMs).toISOString()],
                ...(event.createSquadVoiceChannels
                    ? [
                          [
                              "create-squad-voice-channels",
                              event.meetingStart,
                          ] as const,
                      ]
                    : []),
                [
                    "conclude-event",
                    new Date(
                        new Date(event.gameEnd).getTime() +
                            EVENT_CONCLUSION_RESERVE_MS
                    ).toISOString(),
                ],
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
                    return dueAt
                        ? [["attendance-reminder", dueAt] as const]
                        : []
                }),
                ...(() => {
                    const dueAt = getSignupReminderDueAt(
                        event.createdAt,
                        event.registrationEnd,
                        nowDate,
                        true,
                        event.registrationStart,
                        lastReminderAt
                    )
                    return event.kind === "match" &&
                        resolveSignupReminderStatuses(
                            event.signupReminderStatuses
                        ).length > 0 &&
                        dueAt
                        ? [["signup-reminder", dueAt] as const]
                        : []
                })(),
            ] as const
            for (const [kind, dueAt] of deadlines) {
                // Two announcement redraws share a kind; each has its own time.
                const existing = existingJobs.find(
                    (job) =>
                        job.kind === kind &&
                        (kind !== "refresh-announcement" || job.dueAt === dueAt)
                )
                if (existing) {
                    // Older deployments scheduled conclusion at game end. Move
                    // that durable job into the new reserve window on startup.
                    if (
                        kind === "conclude-event" &&
                        existing.status === "pending" &&
                        existing.dueAt !== dueAt
                    ) {
                        await ctx.db.patch(existing._id, {
                            dueAt,
                            updatedAt: now,
                        })
                    }
                    continue
                }
                if (
                    !Number.isFinite(new Date(dueAt).getTime()) ||
                    new Date(dueAt).getTime() < nowDate.getTime()
                )
                    continue
                await ctx.db.insert("eventScheduleJobs", {
                    eventId: event._id,
                    kind: kind as
                        | "close-registration"
                        | "registration-start"
                        | "start-event"
                        | "create-squad-voice-channels"
                        | "conclude-event"
                        | "attendance-reminder"
                        | "signup-reminder"
                        | "refresh-announcement",
                    dueAt,
                    status: "pending",
                    attempts: 0,
                    createdAt: now,
                    updatedAt: now,
                })
                created += 1
            }
        }
        return { created }
    },
})
