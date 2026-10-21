import assert from "node:assert/strict"
import test from "node:test"

import {
    buildRosterImageUrl,
    generateCalendarUrl,
    getRosterImageVersion,
} from "./utils"
import { boardEvent } from "./events/board-example.fixture"

test("the calendar panel's link runs from the meeting to the end without the old fillers (L1-143)", () => {
    const event = boardEvent({
        description: "Tanky drží střed.\nMikrofon povinný.",
        server: "VLK Scrim",
        meetingChannelId: "444444444444444444",
    })
    const url = new URL(generateCalendarUrl(event, "cs"))
    assert.equal(url.searchParams.get("text"), "VLK vs ROG")
    assert.equal(
        url.searchParams.get("dates"),
        "20261011T173000Z/20261011T200000Z"
    )
    assert.equal(
        url.searchParams.get("details"),
        "Tanky drží střed. Mikrofon povinný."
    )
    assert.equal(url.searchParams.get("location"), "Discord")
    assert.doesNotMatch(url.toString(), /444444444444444444|VLK%20Scrim/)

    const bare = new URL(
        generateCalendarUrl(boardEvent({ description: undefined }), "cs")
    )
    assert.equal(bare.searchParams.has("details"), false)
    assert.doesNotMatch(
        decodeURIComponent(bare.toString()),
        /Briefing k operaci/
    )
})

test("the published roster image keeps its URL for sign-up changes and changes with the roster", () => {
    const event = boardEvent({
        status: "closed",
        updatedAt: "2026-07-29T10:00:00.000Z",
    })
    const rosterUpdatedAt = "2026-07-29T10:00:00.000Z"
    const imageUrl = buildRosterImageUrl(
        event.id,
        getRosterImageVersion(event, rosterUpdatedAt)
    )
    const signupOnly = { ...event, updatedAt: "2026-07-29T10:01:00.000Z" }
    assert.equal(
        buildRosterImageUrl(
            event.id,
            getRosterImageVersion(signupOnly, rosterUpdatedAt)
        ),
        imageUrl
    )
    assert.notEqual(
        buildRosterImageUrl(
            event.id,
            getRosterImageVersion(event, "2026-07-29T10:02:00.000Z")
        ),
        imageUrl
    )
    assert.notEqual(
        buildRosterImageUrl(
            event.id,
            getRosterImageVersion(
                {
                    ...event,
                    absenceNotices: [
                        {
                            userId: "player-1",
                            reason: "Work",
                            createdAt: "2026-07-29T10:03:00.000Z",
                            kind: "late",
                        },
                    ],
                },
                rosterUpdatedAt
            )
        ),
        imageUrl
    )
})
