import assert from "node:assert/strict"
import test from "node:test"

import { attendanceAnswerWindow, isOnRoster } from "./attendance-window"

const gameStart = "2026-10-11T18:00:00.000Z"
const before = Date.parse("2026-10-11T17:00:00.000Z")
const after = Date.parse("2026-10-11T18:01:00.000Z")

test("a published roster can be acknowledged before the reminder window and closes at the game start", () => {
    assert.equal(
        attendanceAnswerWindow({ status: "closed", gameStart }, before),
        "open"
    )
    assert.equal(
        attendanceAnswerWindow({ status: "starting", gameStart }, before),
        "open"
    )
    assert.equal(
        attendanceAnswerWindow({ status: "starting", gameStart }, after),
        "started"
    )
    assert.equal(
        attendanceAnswerWindow({ status: "concluded", gameStart }, before),
        "started"
    )
})

test("squad players and reserves are on the roster", () => {
    const roster = {
        squads: [{ players: [{ id: "a" }, { id: null }] }],
        reservePlayerIds: ["b"],
    }
    assert.equal(isOnRoster(roster, "a"), true)
    assert.equal(isOnRoster(roster, "b"), true)
    assert.equal(isOnRoster(roster, "c"), false)
    assert.equal(isOnRoster(null, "a"), false)
})
