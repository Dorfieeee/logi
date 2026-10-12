import assert from "node:assert/strict"
import test from "node:test"

import type {
    WebsiteEventActor,
    WebsiteEventCommand,
    WebsiteEventError,
    WebsiteEventReceipt,
} from "@/domain/events/website-command"

import {
    executeWebsiteEventCommand,
    type WebsiteCommandEvent,
    type WebsiteEventCommandPorts,
} from "./website-event-command"

const actor: WebsiteEventActor = {
    subject: "123456789012345678",
    clientId: "fixture-client",
    applicationRecordId: "ssoApplications:one",
    apiKeyId: "apiKeys:one",
    guildId: "223456789012345678",
}
const now = Date.parse("2029-12-31T12:00:00Z")
const stored: WebsiteCommandEvent = {
    id: "events:one",
    guildId: actor.guildId,
    gameId: "wardogs",
    revision: "7",
    kind: "match",
    status: "registration",
    registrationEnd: "2030-01-01T17:00:00Z",
    meetingStart: "2030-01-01T18:00:00Z",
    gameEnd: "2030-01-01T20:00:00Z",
}
const refresh = {
    operation: "refresh_match_team",
    eventId: stored.id,
    expectedRevision: stored.revision,
    teamId: "teamDirectory:alpha",
}
const bodyHash = "f".repeat(64)

test("actor-backed deletion works for concluded matches, enforces revision and replays after the row is gone", async () => {
    const command = {
        operation: "delete" as const,
        eventId: stored.id,
        expectedRevision: "7",
    }
    const f = fakes({ event: { ...stored, status: "concluded" } })
    const result = await f.run(command)
    assert.ok("data" in result)
    assert.equal(f.applied[0]?.operation, "delete")
    const conflict = fakes()
    assert.deepEqual(
        await conflict.run({ ...command, expectedRevision: "6" }),
        { error: { code: "revision_conflict" } }
    )
    assert.equal(conflict.applied.length, 0)
    if (!("data" in result)) return
    const replay = fakes({
        event: null,
        prior: { bodyHash, receipt: result.data },
    })
    assert.deepEqual(await replay.run(command), {
        data: { ...result.data, replayed: true },
    })
    assert.equal(replay.applied.length, 0)
    assert.deepEqual(
        await fakes({ event: { ...stored, guildId: "other" } }).run(command),
        { error: { code: "not_found" } }
    )
})

function fakes(
    options: {
        event?: WebsiteCommandEvent | null
        apply?:
            { eventId: string; revision: string } | { error: WebsiteEventError }
        prior?: { bodyHash: string; receipt: WebsiteEventReceipt }
    } = {}
) {
    const applied: WebsiteEventCommand[] = []
    const recorded: unknown[][] = []
    const ports: WebsiteEventCommandPorts = {
        authorize: async () => ({ actor }),
        receipt: async () => options.prior ?? null,
        event: async () =>
            options.event === undefined ? stored : options.event,
        apply: async (_actor, _game, command) => {
            applied.push(command)
            return options.apply ?? { eventId: stored.id, revision: "8" }
        },
        record: async (...args) => {
            recorded.push(args)
            return "websiteEventCommandReceipts:one"
        },
        now: () => now,
    }
    const run = (
        command: unknown = refresh,
        idempotencyKey = "refresh-key-00001"
    ) =>
        executeWebsiteEventCommand(ports, {
            gameId: "wardogs",
            command,
            idempotencyKey,
            bodyHash,
        })
    return { applied, recorded, run }
}

test("a team refresh follows update rules: expected revision, receipt and refresh operation", async () => {
    const f = fakes()
    assert.deepEqual(await f.run(), {
        data: {
            eventId: stored.id,
            revision: "8",
            receiptId: "websiteEventCommandReceipts:one",
            guildId: actor.guildId,
            gameId: "wardogs",
            operation: "refresh_match_team",
            replayed: false,
        },
    })
    assert.equal(f.applied.length, 1)
    assert.equal(f.recorded[0]?.[4], "refresh_match_team")

    const stale = fakes()
    assert.deepEqual(await stale.run({ ...refresh, expectedRevision: "6" }), {
        error: { code: "revision_conflict" },
    })
    assert.equal(stale.applied.length, 0)

    const missing = fakes({ event: null })
    assert.deepEqual(await missing.run(), { error: { code: "not_found" } })
    assert.equal(missing.applied.length, 0)
})

test("trainings and concluded matches are rejected before any write; a started match can still refresh", async () => {
    const training = fakes({ event: { ...stored, kind: "training" } })
    assert.deepEqual(await training.run(), {
        error: { code: "invalid_match_teams" },
    })
    const concluded = fakes({ event: { ...stored, status: "concluded" } })
    assert.deepEqual(await concluded.run(), {
        error: { code: "invalid_match_teams" },
    })
    assert.equal(training.applied.length + concluded.applied.length, 0)

    // After meeting start but before conclusion the refresh window is open.
    const started = fakes({
        event: {
            ...stored,
            status: "starting",
            meetingStart: "2029-12-31T11:00:00Z",
            registrationEnd: "2029-12-31T10:00:00Z",
            gameEnd: "2029-12-31T14:00:00Z",
        },
    })
    assert.equal("data" in (await started.run()), true)
    assert.equal(started.applied.length, 1)
})

test("a rejected team selection returns its code and records no receipt", async () => {
    const f = fakes({ apply: { error: "invalid_match_teams" } })
    const update = {
        operation: "update",
        eventId: stored.id,
        expectedRevision: stored.revision,
        event: {
            kind: "match",
            name: "Fixture",
            registrationEnd: stored.registrationEnd,
            meetingStart: stored.meetingStart,
            gameStart: "2030-01-01T18:30:00Z",
            gameEnd: stored.gameEnd,
            matchTeams: [
                { teamId: "teamDirectory:foreign", slot: "a", side: null },
            ],
        },
    }
    assert.deepEqual(await f.run(update, "update-key-000001"), {
        error: { code: "invalid_match_teams" },
    })
    assert.equal(f.applied.length, 1)
    assert.equal(f.recorded.length, 0)
})

test("a replayed refresh returns the original receipt; a changed body under the same key conflicts", async () => {
    const receipt: WebsiteEventReceipt = {
        eventId: stored.id,
        guildId: actor.guildId,
        gameId: "wardogs",
        revision: "8",
        operation: "refresh_match_team",
        receiptId: "websiteEventCommandReceipts:one",
        replayed: false,
    }
    const replay = fakes({ prior: { bodyHash, receipt } })
    assert.deepEqual(await replay.run(), {
        data: { ...receipt, replayed: true },
    })
    const conflict = fakes({
        prior: { bodyHash: "e".repeat(64), receipt },
    })
    assert.deepEqual(await conflict.run(), {
        error: { code: "idempotency_conflict" },
    })
    assert.equal(replay.applied.length + conflict.applied.length, 0)
})
