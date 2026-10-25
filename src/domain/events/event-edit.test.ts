import assert from "node:assert/strict"
import test from "node:test"

import { eventEditability, eventSeriesRole, signupCounts } from "./event-edit"

const schedule = {
    registrationEnd: "2026-10-10T17:30:00.000Z",
    meetingStart: "2026-10-11T17:30:00.000Z",
    gameEnd: "2026-10-11T19:30:00.000Z",
}

test("a published event stays editable after it concludes", () => {
    const before = new Date("2026-10-09T10:00:00.000Z")
    assert.equal(
        eventEditability({ ...schedule, status: "registration" }, before),
        "editable"
    )
    // Closed sign-ups and the starting phase still allow fixes.
    assert.equal(
        eventEditability(
            { ...schedule, status: "closed" },
            new Date("2026-10-11T10:00:00.000Z")
        ),
        "editable"
    )
    assert.equal(
        eventEditability({ ...schedule, status: "concluded" }, before),
        "editable"
    )
    // 15 minutes after the end it counts as concluded before the bot says so.
    assert.equal(
        eventEditability(
            { ...schedule, status: "starting" },
            new Date("2026-10-11T19:45:00.000Z")
        ),
        "editable"
    )
    assert.equal(
        eventEditability({ ...schedule, isDraft: true }, before),
        "draft"
    )
})

test("series roles: the source, a generated date, monthly labels and none", () => {
    assert.deepEqual(eventSeriesRole({ recurrence: { frequency: "weekly" } }), {
        kind: "source",
    })
    assert.deepEqual(eventSeriesRole({ recurrenceSeriesId: "events:1" }), {
        kind: "occurrence",
        sourceId: "events:1",
    })
    assert.equal(
        eventSeriesRole({ recurrence: { frequency: "monthly_date" } }),
        null
    )
    assert.equal(eventSeriesRole({}), null)
})

test("sign-up counts take attending players, per group name", () => {
    assert.deepEqual(
        signupCounts([
            { status: "attending", group: "Tanky" },
            { status: "attending", group: "Tanky" },
            { status: "attending", group: null },
            { status: "not_attending", group: "Tanky" },
        ]),
        { total: 3, byGroup: { Tanky: 2 } }
    )
    assert.deepEqual(signupCounts([]), { total: 0, byGroup: {} })
})
