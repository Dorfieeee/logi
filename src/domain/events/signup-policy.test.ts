import assert from "node:assert/strict"
import test from "node:test"

import { toggleSignup } from "./signup-policy"
import { SIGNUP_NOT_ATTENDING } from "./types"

test("toggleSignup adds an attending participant", () => {
    const result = toggleSignup({
        participants: [],
        event: {
            kind: "match",
            registrationEnd: "2026-01-01T10:00:00.000Z",
            status: "registration",
        },
        userId: "user-1",
        group: "INF",
        now: new Date("2026-01-01T09:00:00.000Z"),
        membershipStatus: "member",
    })

    assert.equal(result.participants.length, 1)
    assert.equal(result.participants[0]?.status, "attending")
    assert.equal(result.signUps[0]?.group, "INF")
})

test("toggleSignup keeps an unchanged signup on repeated clicks", () => {
    const now = new Date("2026-01-01T09:00:00.000Z")
    const first = toggleSignup({
        participants: [],
        event: {
            kind: "match",
            registrationEnd: "2026-01-01T10:00:00.000Z",
            status: "registration",
        },
        userId: "user-1",
        group: "INF",
        now,
        membershipStatus: "member",
    })

    const second = toggleSignup({
        participants: first.participants,
        event: {
            kind: "match",
            registrationEnd: "2026-01-01T10:00:00.000Z",
            status: "registration",
        },
        userId: "user-1",
        group: "INF",
        now,
        membershipStatus: "member",
    })

    assert.deepEqual(second.participants, [
        {
            userId: "user-1",
            status: "attending",
            group: "INF",
            updatedAt: "2026-01-01T09:00:00.000Z",
            completed: undefined,
        },
    ])
})

test("toggleSignup rejects closed signups", () => {
    assert.throws(
        () =>
            toggleSignup({
                participants: [],
                event: {
                    kind: "match",
                    registrationEnd: "2026-01-01T10:00:00.000Z",
                    status: "closed",
                },
                userId: "user-1",
                group: "INF",
                now: new Date("2026-01-01T10:30:00.000Z"),
                membershipStatus: "member",
            }),
        /Signups are closed/
    )
})

test("toggleSignup allows training signups during starting before registration end", () => {
    const result = toggleSignup({
        participants: [],
        event: {
            kind: "training",
            registrationEnd: "2026-01-01T12:00:00.000Z",
            status: "starting",
        },
        userId: "user-1",
        group: "INF",
        now: new Date("2026-01-01T11:30:00.000Z"),
    })

    assert.deepEqual(result.signUps, [{ userId: "user-1", group: "INF" }])
})

test("toggleSignup allows an unassigned Discord user when the match opts in", () => {
    const result = toggleSignup({
        participants: [],
        event: {
            kind: "match",
            registrationEnd: "2026-01-01T12:00:00.000Z",
            status: "registration",
            allowNonMembersSignup: true,
        },
        userId: "guest-1",
        group: null,
        now: new Date("2026-01-01T09:00:00.000Z"),
        membershipStatus: null,
    })

    assert.equal(result.participants[0]?.status, "attending")
    assert.equal(result.participants[0]?.group, null)
})

test("toggleSignup switches an attending player to a different group and preserves completion", () => {
    const result = toggleSignup({
        participants: [
            {
                userId: "user-1",
                status: "attending",
                group: "ARM",
                completed: "passed",
                updatedAt: "2026-01-01T08:00:00.000Z",
            },
        ],
        event: {
            kind: "match",
            registrationEnd: "2026-01-01T12:00:00.000Z",
            status: "registration",
        },
        userId: "user-1",
        group: "INF",
        now: new Date("2026-01-01T09:00:00.000Z"),
        membershipStatus: "member",
    })

    assert.deepEqual(result.participants, [
        {
            userId: "user-1",
            status: "attending",
            group: "INF",
            completed: "passed",
            updatedAt: "2026-01-01T09:00:00.000Z",
        },
    ])
})

test("toggleSignup keeps a not-attending selection on repeated clicks", () => {
    const first = toggleSignup({
        participants: [],
        event: {
            kind: "match",
            registrationEnd: "2026-01-01T12:00:00.000Z",
            status: "registration",
        },
        userId: "user-1",
        group: SIGNUP_NOT_ATTENDING,
        now: new Date("2026-01-01T09:00:00.000Z"),
        membershipStatus: "member",
    })

    assert.deepEqual(first.participants, [
        {
            userId: "user-1",
            status: "not_attending",
            group: null,
            updatedAt: "2026-01-01T09:00:00.000Z",
            completed: undefined,
        },
    ])

    const second = toggleSignup({
        participants: first.participants,
        event: {
            kind: "match",
            registrationEnd: "2026-01-01T12:00:00.000Z",
            status: "registration",
        },
        userId: "user-1",
        group: SIGNUP_NOT_ATTENDING,
        now: new Date("2026-01-01T09:05:00.000Z"),
        membershipStatus: "member",
    })

    assert.deepEqual(second.participants, [
        {
            userId: "user-1",
            status: "not_attending",
            group: null,
            updatedAt: "2026-01-01T09:05:00.000Z",
            completed: undefined,
        },
    ])
})

test("toggleSignup rejects match signups for disallowed membership statuses", () => {
    assert.throws(
        () =>
            toggleSignup({
                participants: [],
                event: {
                    kind: "match",
                    allowedSignupStatuses: ["reserve_member"],
                    registrationEnd: "2026-01-01T10:00:00.000Z",
                    status: "registration",
                },
                userId: "user-1",
                group: "INF",
                now: new Date("2026-01-01T09:00:00.000Z"),
                membershipStatus: "member",
            }),
        /membership status is not allowed/i
    )
})
