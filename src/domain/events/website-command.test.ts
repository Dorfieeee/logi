import {
    allowsWebsiteEventWrite,
    canonicalWebsiteCommand,
    websiteEventCommandSchema,
    websiteEventSchemaError,
    websiteEventEditorSchema,
    websiteEventMembershipError,
    websiteEventReceiptSchema,
    websiteEventStateError,
} from "./website-command"
import {
    eligibleWebsiteEventKeys,
    websiteEventPolicyApplicationsSchema,
} from "./website-command"
import { emptyTacticalPlan } from "./tactical-plan"
import assert from "node:assert/strict"
import test from "node:test"

const event = {
    kind: "match" as const,
    name: "Three-faction friendly",
    registrationEnd: "2030-01-01T17:00:00Z",
    meetingStart: "2030-01-01T18:00:00Z",
    gameStart: "2030-01-01T18:30:00Z",
    gameEnd: "2030-01-01T20:00:00Z",
}
test("website event commands round-trip planned Wardogs zones and reject mismatched maps", () => {
    const fields = {
        ...event,
        map: "ozeti",
        timeOfDay: "night",
        tacticalPlan: emptyTacticalPlan("ozeti"),
    }
    const command = websiteEventCommandSchema.parse({
        operation: "create",
        event: fields,
    })
    assert.deepEqual(command, { operation: "create", event: fields })
    assert.equal(
        websiteEventCommandSchema.safeParse({
            operation: "create",
            event: { ...fields, map: "bakurani" },
        }).success,
        false
    )
    assert.equal(
        websiteEventCommandSchema.safeParse({
            operation: "create",
            event: { ...fields, tacticalPlan: null },
        }).success,
        true
    )
})
test("website event commands accept native schedule fields, reject implicit admin/Discord/score fields and invalid timelines", () => {
    assert.equal(
        websiteEventCommandSchema.safeParse({ operation: "create", event })
            .success,
        true
    )
    for (const field of [
        "serverPassword",
        "requiredRoleIds",
        "rewardRoleIds",
        "announcementChannelId",
        "pingClan",
        "eventResult",
        "actorId",
    ])
        assert.equal(
            websiteEventCommandSchema.safeParse({
                operation: "create",
                event: { ...event, [field]: "untrusted" },
            }).success,
            false
        )
    assert.equal(
        websiteEventCommandSchema.safeParse({
            operation: "create",
            event: { ...event, gameStart: "2030-01-01T16:00:00Z" },
        }).success,
        false
    )
    assert.equal(
        websiteEventCommandSchema.safeParse({
            operation: "update",
            eventId: "one",
            expectedRevision: "01",
            event,
        }).success,
        false
    )
    assert.equal(
        websiteEventCommandSchema.safeParse({
            operation: "create",
            gameId: "wardogs",
            event,
        }).success,
        false
    )
})
test("write permission is explicit and game scoped; legacy/read-only keys fail closed", () => {
    for (const access of [
        undefined,
        null,
        {},
        { resources: ["event-summaries"], gameIds: ["wardogs"] },
        { resources: ["event-commands"], gameIds: ["hell_let_loose"] },
    ])
        assert.equal(allowsWebsiteEventWrite(access, "wardogs"), false)
    assert.equal(
        allowsWebsiteEventWrite(
            { resources: ["event-commands"], gameIds: ["wardogs"] },
            "wardogs"
        ),
        true
    )
})
test("membership requires current epoch and an observed permitted role, never a later received timestamp", () => {
    const now = Date.parse("2026-10-02T12:00:00Z")
    const observation = {
        state: "present",
        roleIds: ["333333333333333333"],
        observedAt: "2026-10-02T11:59:10Z",
        epoch: "3",
    }
    const input = {
        now,
        epoch: "3",
        allowedRoles: ["333333333333333333"],
        observation,
    }
    assert.equal(websiteEventMembershipError(input), null)
    assert.equal(
        websiteEventMembershipError({ ...input, now: now + 11_000 }),
        "membership_stale"
    )
    assert.equal(
        websiteEventMembershipError({ ...input, epoch: "4" }),
        "membership_stale"
    )
    assert.equal(
        websiteEventMembershipError({
            ...input,
            observation: { ...observation, observedAt: "2026-10-02T12:00:01Z" },
        }),
        "membership_stale"
    )
    assert.equal(
        websiteEventMembershipError({
            ...input,
            observation: { ...observation, unavailable: true },
        }),
        "membership_stale"
    )
    assert.equal(
        websiteEventMembershipError({ ...input, allowedRoles: [] }),
        "membership_denied"
    )
    assert.equal(
        websiteEventMembershipError({
            ...input,
            observation: { ...observation, state: "left" },
        }),
        "membership_denied"
    )
})
test("cancellation is only pre-meeting conclusion; no historical creation or kind changes", () => {
    const cancel = {
        operation: "cancel" as const,
        eventId: "one",
        expectedRevision: "0",
    }
    assert.equal(
        websiteEventStateError(
            cancel,
            { ...event, status: "starting" },
            Date.parse("2030-01-01T17:30:00Z")
        ),
        null
    )
    assert.equal(
        websiteEventStateError(
            cancel,
            { ...event, status: "starting" },
            Date.parse(event.meetingStart)
        ),
        "invalid_state"
    )
    assert.equal(
        websiteEventStateError(
            cancel,
            { ...event, status: "concluded" },
            Date.parse("2030-01-01T17:30:00Z")
        ),
        "invalid_state"
    )
    assert.equal(
        websiteEventStateError(
            { operation: "create", event },
            null,
            Date.parse("2031-01-01T00:00:00Z")
        ),
        "invalid_state"
    )
    assert.equal(
        websiteEventStateError(
            {
                ...cancel,
                operation: "update",
                event: { ...event, kind: "training" },
            },
            event,
            0
        ),
        "invalid_state"
    )
})
test("canonical command digest input binds game and semantic body, independent of JSON key ordering", () => {
    const a = websiteEventCommandSchema.parse({ operation: "create", event })
    const b = websiteEventCommandSchema.parse({
        event: Object.fromEntries(Object.entries(event).reverse()),
        operation: "create",
    })
    assert.equal(
        canonicalWebsiteCommand("wardogs", a),
        canonicalWebsiteCommand("wardogs", b)
    )
    assert.notEqual(
        canonicalWebsiteCommand("wardogs", a),
        canonicalWebsiteCommand("hell_let_loose", a)
    )
})

test("only live restricted keys with supported games may carry a command policy", () => {
    const keys = eligibleWebsiteEventKeys([
        {
            id: "k1",
            name: "Website commands",
            readAccess: {
                resources: ["event-summaries"],
                gameIds: [
                    "wardogs",
                    "hell_let_loose_vietnam",
                    "hell_let_loose",
                ],
            },
        },
        { id: "k2", name: "Legacy unrestricted" },
        {
            id: "k3",
            name: "Revoked",
            revokedAt: "2026-10-01T00:00:00.000Z",
            readAccess: {
                resources: ["event-summaries"],
                gameIds: ["wardogs"],
            },
        },
        {
            id: "k4",
            name: "Vietnam only",
            readAccess: {
                resources: ["event-summaries"],
                gameIds: ["hell_let_loose_vietnam"],
            },
        },
        {
            id: "k5",
            name: "Malformed access",
            readAccess: { resources: [], gameIds: ["wardogs"] },
        },
    ])
    assert.deepEqual(keys, [
        {
            id: "k1",
            name: "Website commands",
            gameIds: ["wardogs", "hell_let_loose"],
        },
    ])
    assert.ok(
        websiteEventPolicyApplicationsSchema.safeParse([
            { id: "app_1", clientId: "logi_abc", name: "Valkyria", extra: 1 },
        ]).success
    )
    assert.ok(
        !websiteEventPolicyApplicationsSchema.safeParse([
            { id: "bad id", clientId: "logi_abc", name: "Valkyria" },
        ]).success
    )
})

const matchTeams = [
    { teamId: "teamDirectory:alpha", slot: "a" as const, side: "Valkyra" },
    { teamId: "teamDirectory:bravo", slot: "b" as const, side: null },
]
const refresh = {
    operation: "refresh_match_team" as const,
    eventId: "one",
    expectedRevision: "4",
    teamId: "teamDirectory:alpha",
}

test("team selections are IDs, slots and sides only; refresh names one team under an expected revision", () => {
    for (const operation of [
        { operation: "create", event: { ...event, matchTeams } },
        {
            operation: "update",
            eventId: "one",
            expectedRevision: "4",
            event: { ...event, matchTeams: [] },
        },
        refresh,
    ])
        assert.equal(
            websiteEventCommandSchema.safeParse(operation).success,
            true
        )
    for (const selection of [
        [{ ...matchTeams[0], snapshot: { name: "Forged" } }],
        [{ ...matchTeams[0], slot: "d" }],
        [{ teamId: "teamDirectory:alpha", slot: "a" }],
        [
            ...matchTeams,
            { teamId: "teamDirectory:c", slot: "c", side: null },
            { teamId: "teamDirectory:d", slot: "c", side: null },
        ],
    ])
        assert.equal(
            websiteEventCommandSchema.safeParse({
                operation: "create",
                event: { ...event, matchTeams: selection },
            }).success,
            false
        )
    for (const command of [
        { ...refresh, teamId: "" },
        { ...refresh, expectedRevision: undefined },
        { ...refresh, matchTeams },
    ])
        assert.equal(
            websiteEventCommandSchema.safeParse(command).success,
            false
        )
    assert.equal(
        websiteEventReceiptSchema.safeParse({
            eventId: "one",
            guildId: "123456789012345678",
            gameId: "wardogs",
            revision: "5",
            operation: "refresh_match_team",
            receiptId: "receipt-one",
            replayed: false,
        }).success,
        true
    )
})

test("the editor carries assignment summaries (null for trainings/legacy) without asset identifiers", () => {
    const editor = {
        eventId: "one",
        guildId: "123456789012345678",
        gameId: "wardogs",
        revision: "4",
        event: { ...event, matchTeams },
        matchTeams: [
            {
                ...matchTeams[0],
                name: "Alpha",
                shortCode: null,
                logoUrl: null,
                teamRevision: 1,
                capturedAt: "2026-10-04T10:00:00.000Z",
            },
        ],
        canEdit: true,
        canCancel: true,
    }
    assert.equal(websiteEventEditorSchema.safeParse(editor).success, true)
    assert.equal(
        websiteEventEditorSchema.safeParse({ ...editor, matchTeams: null })
            .success,
        true
    )
    assert.equal(
        websiteEventEditorSchema.safeParse({
            ...editor,
            matchTeams: undefined,
        }).success,
        false,
        "the summary field is always present"
    )
    assert.equal(
        websiteEventEditorSchema.safeParse({
            ...editor,
            matchTeams: [
                { ...editor.matchTeams[0], logoAssetId: "imageAssets:one" },
            ],
        }).success,
        false
    )
})

test("a snapshot refresh is allowed until the match concludes, never for a training or concluded match", () => {
    const beforeMeeting = Date.parse("2030-01-01T17:30:00Z")
    assert.equal(websiteEventStateError(refresh, event, beforeMeeting), null)
    // Unlike an update, a refresh stays available after meeting start.
    assert.equal(
        websiteEventStateError(refresh, event, Date.parse(event.meetingStart)),
        null
    )
    assert.equal(
        websiteEventStateError(
            {
                operation: "update",
                eventId: "one",
                expectedRevision: "4",
                event: { ...event, name: "Late" },
            },
            event,
            Date.parse(event.meetingStart)
        ),
        "invalid_state"
    )
    assert.equal(
        websiteEventStateError(
            refresh,
            { ...event, kind: "training" },
            beforeMeeting
        ),
        "invalid_match_teams"
    )
    assert.equal(
        websiteEventStateError(
            refresh,
            { ...event, status: "concluded" },
            beforeMeeting
        ),
        "invalid_match_teams"
    )
    // Derived conclusion: the reserve after game end has passed.
    assert.equal(
        websiteEventStateError(
            refresh,
            event,
            Date.parse(event.gameEnd) + 16 * 60_000
        ),
        "invalid_match_teams"
    )
    assert.equal(
        websiteEventStateError(refresh, null, beforeMeeting),
        "invalid_state"
    )
})

test("the command digest binds team selections independent of their listed order", () => {
    const create = (selection: unknown) =>
        websiteEventCommandSchema.parse({
            operation: "create",
            event: { ...event, matchTeams: selection },
        })
    const listed = canonicalWebsiteCommand("wardogs", create(matchTeams))
    assert.equal(
        canonicalWebsiteCommand("wardogs", create([...matchTeams].reverse())),
        listed
    )
    for (const changed of [
        create([{ ...matchTeams[0], side: "Manticore" }, matchTeams[1]]),
        create([matchTeams[0]]),
        create([]),
        websiteEventCommandSchema.parse({ operation: "create", event }),
    ])
        assert.notEqual(canonicalWebsiteCommand("wardogs", changed), listed)
    assert.notEqual(
        canonicalWebsiteCommand("wardogs", refresh),
        canonicalWebsiteCommand("wardogs", {
            ...refresh,
            teamId: "teamDirectory:bravo",
        })
    )
})

test("schema failures inside event.matchTeams are team-assignment errors", () => {
    const issues = (value: unknown) => {
        const parsed = websiteEventCommandSchema.safeParse(value)
        assert.equal(parsed.success, false)
        return parsed.error!.issues
    }
    const event = {
        kind: "match",
        name: "Match",
        registrationEnd: "2030-01-01T17:00:00Z",
        meetingStart: "2030-01-01T18:00:00Z",
        gameStart: "2030-01-01T18:30:00Z",
        gameEnd: "2030-01-01T20:00:00Z",
    }
    const entry = { teamId: "teamDirectory:a", slot: "a", side: null }
    assert.equal(
        websiteEventSchemaError(
            issues({
                operation: "create",
                event: { ...event, matchTeams: [{ ...entry, slot: "d" }] },
            })
        ),
        "invalid_match_teams"
    )
    assert.equal(
        websiteEventSchemaError(
            issues({
                operation: "create",
                event: { ...event, name: "", matchTeams: [entry] },
            })
        ),
        "invalid_request"
    )
    assert.equal(websiteEventSchemaError([]), "invalid_request")
})
