import assert from "node:assert/strict"
import test from "node:test"

import {
    announcementActions,
    announcementRefreshTimes,
    deriveAnnouncementState,
    fullSignupGroups,
    type AnnouncementState,
    type AnnouncementStateEvent,
} from "./announcement-state"

const event: AnnouncementStateEvent = {
    kind: "match",
    status: "registration",
    registrationEnd: "2026-10-10T17:30:00.000Z",
    meetingStart: "2026-10-11T17:30:00.000Z",
    gameStart: "2026-10-11T18:00:00.000Z",
}

const at = (iso: string) => new Date(iso)
const state = (
    patch: Partial<AnnouncementStateEvent>,
    now: string,
    rosterPublished = false
) =>
    deriveAnnouncementState({
        event: { ...event, ...patch },
        rosterPublished,
        now: at(now),
    })

test("the card follows the board's states from sign-ups to the result (L1-B03)", () => {
    assert.equal(state({}, "2026-10-05T16:00:00.000Z"), "open")
    assert.equal(
        state({ status: "closed" }, "2026-10-10T18:00:00.000Z"),
        "closed"
    )
    assert.equal(
        state({ status: "closed" }, "2026-10-10T18:00:00.000Z", true),
        "roster"
    )
    assert.equal(
        state({ status: "starting" }, "2026-10-11T13:00:00.000Z", true),
        "roster"
    )
    assert.equal(
        state({ status: "starting" }, "2026-10-11T17:35:00.000Z", true),
        "starting"
    )
    assert.equal(
        state({ status: "starting" }, "2026-10-11T18:05:00.000Z", true),
        "playing"
    )
    assert.equal(
        state(
            { status: "concluded", concludedAt: "2026-10-11T20:15:00.000Z" },
            "2026-10-11T20:20:00.000Z",
            true
        ),
        "played"
    )
})

test("a match ended before its meeting is cancelled, with no new stored status (L1-60)", () => {
    assert.equal(
        state(
            { status: "concluded", concludedAt: "2026-10-09T10:00:00.000Z" },
            "2026-10-12T10:00:00.000Z"
        ),
        "cancelled"
    )
    // Without the conclusion time it reads as played.
    assert.equal(
        state({ status: "concluded" }, "2026-10-09T10:00:00.000Z"),
        "played"
    )
})

test("sign-ups follow the stored status; a training still open after the start stays open", () => {
    assert.equal(state({}, "2026-10-11T18:05:00.000Z"), "open")
    assert.equal(
        state(
            {
                kind: "training",
                status: "starting",
                registrationEnd: "2026-10-11T17:50:00.000Z",
            },
            "2026-10-11T17:40:00.000Z"
        ),
        "open"
    )
    // A training has no roster to publish.
    assert.equal(
        state(
            { kind: "training", status: "closed" },
            "2026-10-10T18:00:00.000Z",
            true
        ),
        "closed"
    )
})

const counts = (rows: string[][]) => rows.flat().length

test("each state has the board's button set (L1-B04)", () => {
    const options = {
        kind: "match" as const,
        rosterPublished: true,
        hasMatchPage: true,
    }
    const expected: Record<AnnouncementState, number> = {
        open: 4,
        closed: 1,
        roster: 6,
        starting: 4,
        playing: 0,
        played: 1,
        cancelled: 0,
    }
    for (const [name, count] of Object.entries(expected))
        assert.equal(
            counts(announcementActions(name as AnnouncementState, options)),
            count,
            name
        )
    assert.deepEqual(announcementActions("open", options), [
        ["signup", "editSignup", "decline"],
        ["calendar"],
    ])
    assert.deepEqual(announcementActions("roster", options), [
        ["confirm", "late", "attendanceDecline"],
        ["assignment", "openRoster", "calendar"],
    ])
    assert.deepEqual(announcementActions("starting", options), [
        ["confirm", "late", "attendanceDecline"],
        ["assignment"],
    ])
    assert.deepEqual(announcementActions("played", options), [["match"]])
})

test("without a match page or roster the card offers what still works", () => {
    assert.deepEqual(
        announcementActions("played", {
            kind: "match",
            rosterPublished: true,
            hasMatchPage: false,
        }),
        []
    )
    assert.deepEqual(
        announcementActions("starting", {
            kind: "match",
            rosterPublished: false,
            hasMatchPage: false,
        }),
        []
    )
})

test("the card is redrawn at the meeting and at the start, never in the past", () => {
    assert.deepEqual(
        announcementRefreshTimes(event, at("2026-10-05T16:00:00.000Z")),
        [event.meetingStart, event.gameStart]
    )
    assert.deepEqual(
        announcementRefreshTimes(event, at("2026-10-11T17:40:00.000Z")),
        [event.gameStart]
    )
    assert.deepEqual(
        announcementRefreshTimes(event, at("2026-10-11T19:00:00.000Z")),
        []
    )
})

test("full groups are the capped groups without a free place (L1-28, L1-B05)", () => {
    assert.deepEqual(
        fullSignupGroups([
            { name: "Pěchota", count: 15 },
            { name: "Tanky", count: 6, max: 6 },
            { name: "Recon", count: 2, max: 2 },
            { name: "Arty", count: 0, max: 1 },
        ]).map((group) => group.name),
        ["Tanky", "Recon"]
    )
})
