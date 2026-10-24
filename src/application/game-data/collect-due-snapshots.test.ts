import { collectDueSnapshots } from "./collect-due-snapshots"
import assert from "node:assert/strict"
import test from "node:test"

type Connection = { id: string }

test("one tick collects at most ten distinct connections with two provider reads in flight", async () => {
    let next = 0
    let active = 0
    let peak = 0
    const ids: string[] = []
    const processed = await collectDueSnapshots({
        now: () => 100_000,
        claim: async (cutoff) => {
            assert.equal(cutoff, 100_000)
            return { id: String(++next) }
        },
        collect: async (connection) => {
            ids.push(connection.id)
            active++
            peak = Math.max(peak, active)
            await new Promise((resolve) => setImmediate(resolve))
            active--
        },
    })
    assert.equal(processed, 10)
    assert.equal(next, 10)
    assert.equal(new Set(ids).size, 10)
    assert.equal(peak, 2)
})

test("empty due work performs no collection and does not loop", async () => {
    let claims = 0
    assert.equal(
        await collectDueSnapshots<Connection>({
            now: () => 100_000,
            claim: async () => {
                claims++
                return null
            },
            collect: async () => {
                assert.fail("nothing was claimed")
            },
        }),
        0
    )
    assert.ok(claims <= 2)
})

test("the twenty-second start budget stops new claims while finishing already claimed work", async () => {
    let now = 100_000
    let claims = 0
    const cutoffs: number[] = []
    const processed = await collectDueSnapshots({
        now: () => now,
        claim: async (cutoff) => {
            cutoffs.push(cutoff)
            return { id: String(++claims) }
        },
        collect: async () => {
            await Promise.resolve()
            now += 10_000
        },
    })
    assert.equal(processed, 2)
    assert.equal(claims, 2)
    assert.deepEqual(cutoffs, [100_000, 100_000])
})

test("a repeated source claim is rejected instead of collecting it twice in one tick", async () => {
    let collected = 0
    await assert.rejects(
        collectDueSnapshots({
            now: () => 100_000,
            claim: async () => ({ id: "same-source" }),
            collect: async () => {
                collected++
            },
        }),
        /Duplicate snapshot claim/
    )
    assert.equal(collected, 1)
})

test("storage failure stops claiming, waits for the other in-flight source and rejects the action", async () => {
    let claims = 0
    let finished = false
    let release!: () => void
    const pending = new Promise<void>((resolve) => {
        release = resolve
    })
    const failure = new Error("synthetic storage failure")
    const run = collectDueSnapshots({
        now: () => 100_000,
        claim: async () => ({ id: String(++claims) }),
        collect: async (connection) => {
            if (connection.id === "1") throw failure
            await pending
            finished = true
        },
    })
    await new Promise((resolve) => setImmediate(resolve))
    assert.equal(claims, 2)
    assert.equal(finished, false)
    release()
    await assert.rejects(run, (error) => error === failure)
    assert.equal(finished, true)
    assert.equal(claims, 2)
})

test("overlapping ticks use atomic claims, respect retry/poll times and preserve oldest-due tenant order", async () => {
    const now = 100_000
    const rows = [
        { id: "tenant-a-later", next: 90_000, lease: 0 },
        { id: "tenant-b-oldest", next: 70_000, lease: 0 },
        { id: "tenant-a-middle", next: 80_000, lease: 0 },
        { id: "tenant-c-backoff", next: now + 300_000, lease: 0 },
        { id: "tenant-a-long-poll", next: now + 3_600_000, lease: 0 },
        { id: "tenant-b-paused", next: null, lease: 0 },
    ]
    const collected: string[] = []
    const ports = {
        now: () => now,
        claim: async (cutoff: number) => {
            const row = rows
                .filter(
                    (value) =>
                        value.next !== null &&
                        value.next <= cutoff &&
                        value.lease <= now
                )
                .sort((a, b) => a.next! - b.next!)[0]
            if (!row) return null
            row.lease = now + 60_000
            row.next = now + 60_000
            return { id: row.id }
        },
        collect: async (connection: Connection) => {
            collected.push(connection.id)
            await new Promise((resolve) => setImmediate(resolve))
            const row = rows.find((value) => value.id === connection.id)!
            row.lease = 0
            row.next = now + 60_000
        },
    }
    const processed = await Promise.all([
        collectDueSnapshots(ports),
        collectDueSnapshots(ports),
    ])
    assert.equal(
        processed.reduce((total, count) => total + count, 0),
        3
    )
    assert.deepEqual(collected, [
        "tenant-b-oldest",
        "tenant-a-middle",
        "tenant-a-later",
    ])
    assert.equal(new Set(collected).size, 3)
    assert.equal(await collectDueSnapshots(ports), 0)
})
