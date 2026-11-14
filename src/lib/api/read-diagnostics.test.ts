import { createReadDiagnostics } from "./read-diagnostics"
import assert from "node:assert/strict"
import test from "node:test"

test("read diagnostics aggregate idle polling by resource without retaining credentials or raw errors", async () => {
    let time = 0
    const reports: Record<string, unknown>[] = []
    const observe = createReadDiagnostics(
        () => time,
        (sample) => reports.push(sample)
    )
    const scope = {
        operation: "sync-record",
        resource: "roster-summaries",
        gameId: "wardogs",
        keyHash: "private-key-hash",
    }
    assert.equal(
        await observe(scope, async () => {
            time += 800
            return "ok"
        }),
        "ok"
    )
    const error = new Error("private backend details")
    await assert.rejects(
        observe(scope, async () => {
            throw error
        }),
        (value) => value === error
    )
    time = 61_000
    await observe(scope, async () => null)
    assert.equal(reports[0].outcome, "slow")
    assert.equal(reports[1].outcome, "error")
    assert.equal(reports[2].count, 2)
    assert.equal(reports[2].failures, 1)
    assert.equal(reports[2].maxMs, 800)
    assert.equal(reports[2].meanMs, 400)
    assert.match(String(reports[2].keyFingerprint), /^[a-f0-9]{12}$/)
    assert.doesNotMatch(
        JSON.stringify(reports),
        /private-key-hash|private backend details/
    )
})
