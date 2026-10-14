import assert from "node:assert/strict"
import test from "node:test"

import { suggestResultSession } from "./session-pick"

const sessions = [
    { id: "early", startedAt: "2026-10-04T15:00:00.000Z", complete: true },
    { id: "match", startedAt: "2026-10-04T18:02:00.000Z", complete: true },
    { id: "late", startedAt: "2026-10-04T19:40:00.000Z", complete: false },
    { id: "unknown", startedAt: null, complete: true },
]

test("picks the server game that starts closest to the match", () => {
    assert.equal(
        suggestResultSession(sessions, "2026-10-04T18:00:00.000Z")?.id,
        "match"
    )
})

test("ignores games more than three hours away and invalid times", () => {
    assert.equal(suggestResultSession(sessions, "2026-10-05T03:00:00Z"), null)
    assert.equal(suggestResultSession(sessions, "not a date"), null)
    assert.equal(suggestResultSession([], "2026-10-04T18:00:00Z"), null)
})

test("prefers a complete record at the same distance", () => {
    const tied = [
        { id: "partial", startedAt: "2026-10-04T18:10:00Z", complete: false },
        { id: "full", startedAt: "2026-10-04T17:50:00Z", complete: true },
    ]
    assert.equal(suggestResultSession(tied, "2026-10-04T18:00:00Z")?.id, "full")
})

test("suggests a game by its end time when the provider start predates the match", () => {
    const source = {
        id: "match",
        startedAt: "2026-10-07T20:00:00Z",
        endedAt: "2026-10-10T20:00:00Z",
        complete: true,
    }
    assert.equal(
        suggestResultSession(
            [source],
            "2026-10-10T18:00:00Z",
            "2026-10-10T20:00:00Z"
        )?.id,
        "match"
    )
    assert.equal(
        suggestResultSession(
            [source],
            "2026-10-12T18:00:00Z",
            "2026-10-12T20:00:00Z"
        ),
        null
    )
})
