import {
    backfillMissing,
    claimDue,
    complete,
} from "../../../convex/scheduledJobs"
import type { MutationCtx } from "../../../convex/_generated/server"
import { claimSignupRun } from "../../../convex/eventReminders"
import type { Id } from "../../../convex/_generated/dataModel"
import { refreshEventSchedule } from "./event-scheduling"
import { invoke, testContext } from "./testing/database"
import test, { type TestContext } from "node:test"
import assert from "node:assert/strict"

const secret = "synthetic-signup-reminder-secret"
const start = Date.parse("2026-10-13T12:00:00.000Z")
const args = { secret, guildId: "guild-a", eventId: "events:one" }
function fixture(t: TestContext, registrationEnd = "2026-10-13T18:00:00.000Z") {
    const previous = process.env.INTERNAL_AUTH_SECRET
    process.env.INTERNAL_AUTH_SECRET = secret
    t.after(() => {
        if (previous === undefined) delete process.env.INTERNAL_AUTH_SECRET
        else process.env.INTERNAL_AUTH_SECRET = previous
    })
    t.mock.timers.enable({ apis: ["Date"], now: start })
    const ctx = testContext()
    ctx.db.seed("events", {
        _id: args.eventId,
        guildId: args.guildId,
        kind: "match",
        status: "registration",
        createdAt: "2026-10-10T10:00:00.000Z",
        registrationEnd,
        meetingStart: "2026-10-16T18:00:00.000Z",
        gameEnd: "2026-10-16T22:00:00.000Z",
        attendanceReminderHours: [],
    })
    return ctx
}

test("four restarts in the final registration day cannot repeat a claimed signup run", async (t) => {
    const ctx = fixture(t)
    assert.equal(await invoke(claimSignupRun, ctx, args), true)
    for (const minutes of [3, 6, 9, 15]) {
        t.mock.timers.setTime(start + minutes * 60_000)
        await invoke(backfillMissing, ctx, { secret })
        assert.equal(await invoke(claimSignupRun, ctx, args), false)
        assert.equal(
            ctx.db.tables.eventScheduleJobs.filter(
                (job) => job.kind === "signup-reminder"
            ).length,
            0
        )
    }
})

test("a completed job, edits and restarts preserve the next eligible daily time", async (t) => {
    const ctx = fixture(t, "2026-10-16T18:00:00.000Z")
    await invoke(backfillMissing, ctx, { secret })
    const jobs = await invoke(claimDue, ctx, { secret })
    const job = jobs.find(
        (job: { kind: string }) => job.kind === "signup-reminder"
    )
    assert.ok(job)
    await invoke(complete, ctx, { secret, jobId: job.id })
    assert.equal(await invoke(claimSignupRun, ctx, args), true)
    t.mock.timers.setTime(start + 3 * 60_000)
    await refreshEventSchedule(
        ctx as unknown as MutationCtx,
        args.eventId as Id<"events">
    )
    await invoke(backfillMissing, ctx, { secret })
    const reminders = ctx.db.tables.eventScheduleJobs.filter(
        (job) => job.kind === "signup-reminder"
    )
    assert.equal(reminders.length, 1)
    assert.equal(reminders[0].dueAt, "2026-10-14T12:00:00.000Z")
    assert.equal(await invoke(claimSignupRun, ctx, args), false)
    t.mock.timers.setTime(start + 24 * 3600_000)
    assert.equal(await invoke(claimSignupRun, ctx, args), true)
    assert.equal(await invoke(claimSignupRun, ctx, args), false)
})

test("legacy sent outcomes suppress existing duplicate jobs and startup backfill", async (t) => {
    const ctx = fixture(t)
    ctx.db.seed("automaticReminderOutcomes", {
        _id: "automaticReminderOutcomes:one",
        eventId: args.eventId,
        guildId: args.guildId,
        kind: "signup",
        runKey: "2026-10-13",
        sentAt: new Date(start - 3 * 60_000).toISOString(),
        recipientIds: ["player"],
        failedUserIds: [],
    })
    ctx.db.seed("eventScheduleJobs", {
        _id: "eventScheduleJobs:duplicate",
        eventId: args.eventId,
        kind: "signup-reminder",
        status: "pending",
        dueAt: new Date(start).toISOString(),
        attempts: 0,
    })
    assert.deepEqual(await invoke(claimDue, ctx, { secret }), [])
    await invoke(backfillMissing, ctx, { secret })
    assert.equal(await invoke(claimSignupRun, ctx, args), false)
    assert.equal(
        ctx.db.tables.eventScheduleJobs.filter(
            (job) => job.kind === "signup-reminder"
        ).length,
        0
    )
})

test("signup run claims enforce authentication, guild scope and event eligibility", async (t) => {
    const ctx = fixture(t)
    await assert.rejects(
        invoke(claimSignupRun, ctx, { ...args, secret: "invalid" }),
        /Unauthorized/
    )
    assert.equal(
        await invoke(claimSignupRun, ctx, { ...args, guildId: "guild-b" }),
        false
    )
    for (const patch of [
        { isDraft: true },
        { status: "closed" },
        { signupReminderStatuses: [] },
        { registrationEnd: new Date(start).toISOString() },
    ]) {
        const original = structuredClone(ctx.db.tables.events[0])
        await ctx.db.patch(args.eventId, patch)
        assert.equal(await invoke(claimSignupRun, ctx, args), false)
        ctx.db.tables.events[0] = original
    }
})
