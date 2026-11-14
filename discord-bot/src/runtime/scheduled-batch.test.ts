import { runScheduledBatch, type ScheduledClaim } from "./scheduled-batch"
import assert from "node:assert/strict"
import test from "node:test"

const jobs: ScheduledClaim[] = ["a", "b"].map((id) => ({
    id,
    eventId: id,
    kind: "attendance-reminder",
    claimVersion: 1,
}))

test("lost claims cannot reconcile or dispatch stale reminder work", async () => {
    const reconciled: string[] = []
    const result = await runScheduledBatch(jobs, {
        renew: async (claims) =>
            claims.filter((job) => job.id !== "a").map((job) => job.id),
        reconcile: async (job) => {
            reconciled.push(job.id)
            return { changedEventIds: [], scoreEventIds: [] }
        },
        complete: async () => false,
        release: async () => {
            throw new Error("unexpected release")
        },
        failed: () => {},
    })
    assert.deepEqual(reconciled, ["b"])
    assert.deepEqual(result.attendanceReminderEventIds, [])
    assert.deepEqual(result.changedEventIds, [])
})

test("one release failure cannot strand the rest of the claimed batch", async () => {
    const failures: unknown[] = []
    const result = await runScheduledBatch(jobs, {
        renew: async (claims) => claims.map((job) => job.id),
        reconcile: async (job) => {
            if (job.id === "a") throw new Error("reconcile unavailable")
            return { changedEventIds: [], scoreEventIds: ["score"] }
        },
        complete: async () => true,
        release: async () => {
            throw new Error("release unavailable")
        },
        failed: (error) => {
            failures.push(error)
        },
    })
    assert.deepEqual(result.attendanceReminderEventIds, ["b"])
    assert.deepEqual(result.scoreEventIds, ["score"])
    assert.equal(failures.length, 2)
})

test("completion receives only the scheduled-job result fields", async () => {
    let completion: unknown
    await runScheduledBatch([jobs[0]], {
        renew: async (claims) => claims.map((job) => job.id),
        reconcile: async () =>
            Object.assign(
                { changedEventIds: ["changed"], scoreEventIds: ["score"] },
                { continueCursor: null, isDone: true }
            ),
        complete: async (_job, result) => {
            completion = result
            return true
        },
        release: async () => {},
        failed: () => {},
    })
    assert.deepEqual(completion, {
        changedEventIds: ["changed"],
        scoreEventIds: ["score"],
    })
})

test("the heartbeat covers queued claims while a slow first reconciliation runs", async (t) => {
    t.mock.timers.enable({ apis: ["setInterval"] })
    let finish!: () => void
    const active = new Promise<void>((resolve) => {
        finish = resolve
    })
    const renewed: string[][] = []
    const batch = runScheduledBatch(jobs, {
        renew: async (claims) => {
            const ids = claims.map((job) => job.id)
            renewed.push(ids)
            return ids
        },
        reconcile: async (job) => {
            if (job.id === "a") await active
            return { changedEventIds: [], scoreEventIds: [] }
        },
        complete: async () => true,
        release: async () => {},
        failed: () => {},
    })
    await Promise.resolve()
    await Promise.resolve()
    t.mock.timers.tick(30_001)
    await Promise.resolve()
    await Promise.resolve()
    assert.ok(renewed.some((ids) => ids.join() === "a,b"))
    finish()
    await batch
    const calls = renewed.length
    t.mock.timers.tick(60_000)
    assert.equal(renewed.length, calls)
})
