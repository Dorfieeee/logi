import { snapshotDueCutoff } from "./snapshot-rules"
import assert from "node:assert/strict"
import test from "node:test"

test("snapshot cutoff preserves the fixed tick boundary and clamps future input to now", () => {
    assert.equal(snapshotDueCutoff(100_000), 100_000)
    assert.equal(snapshotDueCutoff(100_000, 90_000), 90_000)
    assert.equal(snapshotDueCutoff(100_000, 110_000), 100_000)
    assert.equal(snapshotDueCutoff(100_000, 0), 0)
})

test("invalid snapshot cutoffs cannot enter the due index range", () => {
    for (const cutoff of [NaN, Infinity, -Infinity, -1])
        assert.throws(
            () => snapshotDueCutoff(100_000, cutoff),
            /Invalid snapshot due cutoff/
        )
})
