import assert from "node:assert/strict"
import test from "node:test"

import {
    getSignupReminderDueAt,
    resolveSignupReminderStatuses,
} from "./scheduled-job-policy"

test("schedules the first signup reminder 24 hours after match creation", () => {
    assert.equal(
        getSignupReminderDueAt(
            "2026-01-01T10:00:00.000Z",
            "2026-01-03T10:00:00.000Z",
            new Date("2026-01-01T11:00:00.000Z")
        ),
        "2026-01-02T10:00:00.000Z"
    )
})

test("does not schedule a signup reminder after registration ends", () => {
    assert.equal(
        getSignupReminderDueAt(
            "2026-01-01T10:00:00.000Z",
            "2026-01-02T09:00:00.000Z",
            new Date("2026-01-01T11:00:00.000Z")
        ),
        null
    )
})

test("reschedules an edited open match for the next daily reminder", () => {
    assert.equal(
        getSignupReminderDueAt(
            "2026-01-01T10:00:00.000Z",
            "2026-01-05T10:00:00.000Z",
            new Date("2026-01-03T10:00:00.000Z")
        ),
        "2026-01-04T10:00:00.000Z"
    )
})

test("schedules an overdue first reminder immediately for an open match", () => {
    assert.equal(
        getSignupReminderDueAt(
            "2026-01-01T10:00:00.000Z",
            "2026-01-03T10:00:00.000Z",
            new Date("2026-01-02T11:00:00.000Z"),
            true
        ),
        "2026-01-02T11:00:00.000Z"
    )
})

test("uses regular members as the default for legacy matches", () => {
    assert.deepEqual(resolveSignupReminderStatuses(undefined), ["member"])
    assert.deepEqual(resolveSignupReminderStatuses([]), [])
})

test("restart backfill waits a full 24 hours after the previous reminder", () => {
    for (const minutes of [0, 3, 6, 9, 15]) {
        assert.equal(
            getSignupReminderDueAt(
                "2026-10-10T10:00:00.000Z",
                "2026-10-15T18:00:00.000Z",
                new Date(
                    Date.parse("2026-10-13T12:00:00.000Z") + minutes * 60_000
                ),
                true,
                undefined,
                "2026-10-13T12:00:00.000Z"
            ),
            "2026-10-14T12:00:00.000Z"
        )
    }
})

test("no repeat is backfilled in the final six hours of registration", () => {
    assert.equal(
        getSignupReminderDueAt(
            "2026-10-10T10:00:00.000Z",
            "2026-10-13T18:00:00.000Z",
            new Date("2026-10-13T12:03:00.000Z"),
            true,
            undefined,
            "2026-10-13T12:00:00.000Z"
        ),
        null
    )
})

test("an overdue next reminder is eligible at the 24-hour boundary", () => {
    assert.equal(
        getSignupReminderDueAt(
            "2026-10-10T10:00:00.000Z",
            "2026-10-16T18:00:00.000Z",
            new Date("2026-10-14T12:00:00.000Z"),
            true,
            undefined,
            "2026-10-13T12:00:00.000Z"
        ),
        "2026-10-14T12:00:00.000Z"
    )
})

test("a delayed announcement counts the first sign-up reminder from the announcement", () => {
    assert.equal(
        getSignupReminderDueAt(
            "2026-01-01T10:00:00.000Z",
            "2026-01-06T10:00:00.000Z",
            new Date("2026-01-01T11:00:00.000Z"),
            false,
            "2026-01-03T18:00:00.000Z"
        ),
        "2026-01-04T18:00:00.000Z"
    )
    // An announcement before creation (or none) keeps the creation time.
    assert.equal(
        getSignupReminderDueAt(
            "2026-01-01T10:00:00.000Z",
            "2026-01-03T10:00:00.000Z",
            new Date("2026-01-01T11:00:00.000Z"),
            false,
            "2025-12-30T10:00:00.000Z"
        ),
        "2026-01-02T10:00:00.000Z"
    )
})
