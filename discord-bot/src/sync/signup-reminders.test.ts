import assert from "node:assert/strict"
import test from "node:test"

import type { Client } from "discord.js"

import {
    isSignupReminderRecipient,
    processSignupReminders,
} from "./signup-reminders"
import type { AutomaticReminderOutcome } from "./reminder-outcomes"
import type { SyncPayload } from "../types"

test("who a scheduled sign-up reminder reached is recorded for the match page (L2-64)", async () => {
    const recorded: AutomaticReminderOutcome[] = []
    const sent: string[] = []
    const member = (userId: string) => ({
        userId,
        type: "member",
        status: "active",
        gameId: "hell_let_loose",
    })
    const payload = {
        config: {
            id: "config-1",
            guildId: "200000000000000001",
            timezone: "Europe/Prague",
            defaultLanguage: "cs",
            calendarCategories: [],
            updatedAt: "2026-10-01T10:00:00.000Z",
        },
        guild: { name: "Vlci", eventCategories: [] },
        syncStates: [],
        events: [
            {
                id: "event-1",
                kind: "match",
                status: "registration",
                gameId: "hell_let_loose",
                name: "Liga",
                participants: [
                    { userId: "100000000000000003", status: "attending" },
                ],
                registrationEnd: "2026-10-10T17:30:00.000Z",
                meetingStart: "2026-10-11T17:30:00.000Z",
                gameStart: "2026-10-11T18:00:00.000Z",
            },
        ],
        assignments: [
            member("100000000000000001"),
            member("100000000000000001"),
            member("100000000000000002"),
            member("100000000000000003"),
        ],
    } as unknown as SyncPayload
    const client = {
        users: {
            fetch: async (id: string) => ({
                send: async () => {
                    if (id === "100000000000000002")
                        throw Object.assign(new Error("Cannot send"), {
                            code: 50007,
                        })
                    sent.push(id)
                },
            }),
        },
    } as unknown as Client
    await processSignupReminders(client, payload, new Set(["event-1"]), {
        record: async (outcome) => {
            recorded.push(outcome)
        },
        now: () => Date.parse("2026-10-09T08:00:00.000Z"),
        claim: async () => true,
    })
    // The member who already answered gets nothing.
    assert.deepEqual(sent, ["100000000000000001"])
    assert.deepEqual(recorded, [
        {
            guildId: "200000000000000001",
            eventId: "event-1",
            kind: "signup",
            runKey: "2026-10-09",
            sentUserIds: ["100000000000000001"],
            failedUserIds: ["100000000000000002"],
        },
    ])
    await processSignupReminders(client, payload, new Set(["event-1"]), {
        claim: async () => false,
        record: async () => {
            throw new Error("A suppressed run must not be recorded")
        },
    })
    assert.deepEqual(sent, ["100000000000000001"])
    await assert.rejects(
        processSignupReminders(client, payload, new Set(["event-1"]), {
            claim: async () => {
                throw new Error("Backend unavailable")
            },
        }),
        /Backend unavailable/
    )
    assert.deepEqual(sent, ["100000000000000001"])
})

test("signup reminders include legacy memberships for Hell Let Loose events", () => {
    assert.equal(
        isSignupReminderRecipient({
            assignment: {
                userId: "user-1",
                type: "member",
                status: "active",
            },
            eventGameId: "hell_let_loose",
            recipientStatuses: new Set(["member"]),
            respondedUserIds: new Set(),
        }),
        true
    )
})

test("signup reminders exclude legacy memberships from non-HLL events", () => {
    assert.equal(
        isSignupReminderRecipient({
            assignment: {
                userId: "user-1",
                type: "member",
                status: "active",
            },
            eventGameId: "hell_let_loose_vietnam",
            recipientStatuses: new Set(["member"]),
            respondedUserIds: new Set(),
        }),
        false
    )
})
