import { rankSourceCandidates } from "./source-candidates"
import assert from "node:assert/strict"
import test from "node:test"

const session = (id: string, startedAt: string, endedAt: string) => ({
    id,
    session: { startedAt, endedAt },
})

test("source candidates prefer games overlapping the scheduled event window", () => {
    const rows = [
        session("far", "2026-11-08T10:00:00.000Z", "2026-11-08T11:00:00.000Z"),
        session("near", "2026-11-08T19:55:00.000Z", "2026-11-08T21:55:00.000Z"),
        session(
            "overlap",
            "2026-11-08T20:30:00.000Z",
            "2026-11-08T22:30:00.000Z"
        ),
    ]
    assert.deepEqual(
        rankSourceCandidates(rows, {
            gameStart: "2026-11-08T20:00:00.000Z",
            gameEnd: "2026-11-08T22:00:00.000Z",
        }).map((row) => row.id),
        ["near", "overlap", "far"]
    )
})

test("source candidates are capped at ten and never select a source themselves", () => {
    const rows = Array.from({ length: 12 }, (_, index) =>
        session(
            String(index),
            `2026-11-08T${String(index).padStart(2, "0")}:00:00.000Z`,
            `2026-11-08T${String(index + 1).padStart(2, "0")}:00:00.000Z`
        )
    )
    assert.equal(
        rankSourceCandidates(rows, {
            gameStart: "2026-11-08T20:00:00.000Z",
            gameEnd: "2026-11-08T22:00:00.000Z",
        }).length,
        10
    )
})
