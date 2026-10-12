import {
    HISTORY_FULL_WALK_INTERVAL_MS,
    HISTORY_HEAD_TOUCH_INTERVAL_MS,
    historyFullWalkDue,
    historyTouchDue,
    newestSessionFirst,
    newestEndedSessionFirst,
} from "./history-rules"
import assert from "node:assert/strict"
import test from "node:test"

const now = Date.parse("2026-10-07T12:00:00.000Z")

test("a full history walk is due without one, then a day after the last", () => {
    assert.equal(historyFullWalkDue(undefined, now), true)
    assert.equal(historyFullWalkDue(null, now), true)
    assert.equal(
        historyFullWalkDue(now - HISTORY_FULL_WALK_INTERVAL_MS + 1, now),
        false
    )
    assert.equal(
        historyFullWalkDue(now - HISTORY_FULL_WALK_INTERVAL_MS, now),
        true
    )
})

test("orders result candidates by their end time, not collection time", () => {
    const sessions = [
        { id: "unknown", endedAt: null },
        { id: "older", endedAt: "2026-10-01T19:00:00Z" },
        { id: "newest", endedAt: "2026-10-02T18:00:00Z" },
    ]
    assert.deepEqual(
        sessions.sort(newestEndedSessionFirst).map((session) => session.id),
        ["newest", "older", "unknown"]
    )
})

test("a seen-at stamp is due again after its interval, ISO or ms", () => {
    const tenMinutesAgo = new Date(
        now - HISTORY_HEAD_TOUCH_INTERVAL_MS
    ).toISOString()
    assert.equal(
        historyTouchDue(tenMinutesAgo, now, HISTORY_HEAD_TOUCH_INTERVAL_MS),
        true
    )
    assert.equal(
        historyTouchDue(now - 60_000, now, HISTORY_HEAD_TOUCH_INTERVAL_MS),
        false
    )
    assert.equal(historyTouchDue(now - 60_000, now), true, "a minute default")
    assert.equal(historyTouchDue("not a time", now), true)
})

test("sessions order newest first by start, else end; timeless ones last", () => {
    const sessions = [
        { id: "none", startedAt: null, endedAt: null },
        { id: "old", startedAt: "2026-10-01T10:00:00Z", endedAt: null },
        { id: "ended", startedAt: null, endedAt: "2026-10-02T10:00:00Z" },
        { id: "new", startedAt: "2026-10-03T10:00:00Z", endedAt: null },
    ]
    assert.deepEqual(
        sessions.sort(newestSessionFirst).map((session) => session.id),
        ["new", "ended", "old", "none"]
    )
})
