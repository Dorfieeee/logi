import { emptyTacticalPlan } from "../../domain/events/tactical-plan"
import * as commands from "../../../convex/websiteEventCommands"
import { testContext, invoke } from "./testing/database"
import { test, type TestContext } from "node:test"
import assert from "node:assert/strict"

const secret = "isolated-command-test-secret"
const subject = "123456789012345678"
const guildId = "223456789012345678"
const role = "323456789012345678"
const sid = "s".repeat(43)
const fields = {
    kind: "match" as const,
    name: "Synthetic three-faction friendly",
    map: "Synthetic Map",
    registrationEnd: "2030-01-01T17:00:00Z",
    meetingStart: "2030-01-01T18:00:00Z",
    gameStart: "2030-01-01T18:30:00Z",
    gameEnd: "2030-01-01T20:00:00Z",
}
const input = {
    secret,
    keyHash: "a".repeat(64),
    actorTokenHash: "b".repeat(64),
    gameId: "wardogs",
    idempotencyKey: "operation-one-0001",
    command: { operation: "create", event: fields },
}

function fixture(t: TestContext) {
    const previous = {
        secret: process.env.INTERNAL_AUTH_SECRET,
        enabled: process.env.LOGI_SSO_ENABLED,
    }
    process.env.INTERNAL_AUTH_SECRET = secret
    process.env.LOGI_SSO_ENABLED = "true"
    t.after(() => {
        if (previous.secret === undefined)
            delete process.env.INTERNAL_AUTH_SECRET
        else process.env.INTERNAL_AUTH_SECRET = previous.secret
        if (previous.enabled === undefined) delete process.env.LOGI_SSO_ENABLED
        else process.env.LOGI_SSO_ENABLED = previous.enabled
    })
    let now = Date.now()
    t.mock.method(Date, "now", () => now)
    const ctx = testContext()
    ctx.db.seed("users", {
        _id: "users:actor",
        discordId: subject,
        name: "Synthetic actor",
        avatar: "",
        sessionVersion: 0,
    })
    ctx.db.seed("guilds", {
        _id: "guilds:one",
        discordId: guildId,
        enabledGames: ["wardogs", "hell_let_loose"],
        adminIds: [],
        memberIds: [],
        mercenaryIds: [],
    })
    ctx.db.seed("dashboardSessions", {
        _id: "dashboardSessions:one",
        sid,
        subject,
        userRecordId: "users:actor",
        userSessionVersion: 0,
        createdAt: now,
        expiresAt: now + 3600_000,
    })
    ctx.db.seed("ssoApplications", {
        _id: "ssoApplications:one",
        guildId: "guilds:one",
        clientId: "fixture-client",
        clientSecretHash: "c".repeat(64),
    })
    ctx.db.seed("ssoAccessTokens", {
        _id: "ssoAccessTokens:one",
        tokenHash: input.actorTokenHash,
        applicationRecordId: "ssoApplications:one",
        clientId: "fixture-client",
        clientSecretHash: "c".repeat(64),
        userId: subject,
        userRecordId: "users:actor",
        sessionId: sid,
        scope: "openid profile",
        expiresAt: now + 3600_000,
    })
    ctx.db.seed("apiKeys", {
        _id: "apiKeys:one",
        guildId,
        keyHash: input.keyHash,
        readAccess: { resources: ["event-summaries"], gameIds: ["wardogs"] },
        writeAccess: { resources: ["event-commands"], gameIds: ["wardogs"] },
    })
    ctx.db.seed("websiteEventPolicies", {
        _id: "websiteEventPolicies:one",
        applicationRecordId: "ssoApplications:one",
        apiKeyId: "apiKeys:one",
        guildId,
        enabled: true,
        games: [{ gameId: "wardogs", roleIds: [role] }],
        version: "1",
        updatedBy: subject,
        updatedAt: new Date(now).toISOString(),
    })
    ctx.db.seed("membershipGuilds", {
        _id: "membershipGuilds:one",
        guildId,
        epoch: "3",
        revision: "10",
        epochRevision: "8",
    })
    ctx.db.seed("memberObservations", {
        _id: "memberObservations:one",
        guildId,
        discordUserId: subject,
        state: "present",
        roleIds: [role],
        observedAt: new Date(now).toISOString(),
        receivedAt: new Date(now).toISOString(),
        epoch: "3",
        revision: "10",
        unavailable: false,
    })
    return {
        ctx,
        advance: (ms: number) => {
            now += ms
        },
        run: (patch: Record<string, unknown> = {}) =>
            invoke(commands.execute, ctx, { ...input, ...patch }),
    }
}

test("actor command creates exactly one native event, schedules it and returns the committed change revision", async (t) => {
    const f = fixture(t)
    const result = await f.run()
    assert.equal(result.data.operation, "create")
    assert.equal(result.data.guildId, guildId)
    assert.equal(result.data.replayed, false)
    const event = f.ctx.db.tables.events[0]
    assert.equal(event.name, fields.name)
    assert.equal(event.gameId, "wardogs")
    assert.equal(event.guildId, guildId)
    assert.equal(event.pingClan, false)
    assert.equal(event.createForumChannel, false)
    assert.ok(f.ctx.db.tables.eventScheduleJobs.length > 0)
    assert.equal(
        result.data.revision,
        f.ctx.db.tables.integrationHeads[0].revision
    )
    const receipt = f.ctx.db.tables.websiteEventCommandReceipts[0]
    assert.equal(receipt.subject, subject)
    assert.equal(receipt.clientId, "fixture-client")
    assert.equal(receipt.eventId, event._id)
    assert.equal(receipt.bodyHash.length, 64)
    const retry = await f.run()
    assert.equal(retry.data.eventId, result.data.eventId)
    assert.equal(retry.data.receiptId, result.data.receiptId)
    assert.equal(retry.data.replayed, true)
    assert.equal(f.ctx.db.tables.events.length, 1)
    assert.equal(f.ctx.db.tables.websiteEventCommandReceipts.length, 1)
})

test("actor event commands persist a Wardogs plan through editor reads and clear it explicitly", async (t) => {
    const f = fixture(t)
    const plan = emptyTacticalPlan("bakurani")
    const created = await f.run({
        command: {
            operation: "create",
            event: {
                ...fields,
                map: "bakurani",
                timeOfDay: "night",
                tacticalPlan: plan,
            },
        },
    })
    const editor = await invoke(commands.readEditor, f.ctx, {
        secret,
        keyHash: input.keyHash,
        actorTokenHash: input.actorTokenHash,
        gameId: "wardogs",
        eventId: created.data.eventId,
    })
    assert.deepEqual(editor.data.event.tacticalPlan, plan)
    assert.equal(editor.data.event.timeOfDay, "night")
    const updated = await f.run({
        idempotencyKey: "clear-plan-command-001",
        command: {
            operation: "update",
            eventId: created.data.eventId,
            expectedRevision: created.data.revision,
            event: {
                ...fields,
                map: "bakurani",
                timeOfDay: "",
                tacticalPlan: null,
            },
        },
    })
    assert.equal(updated.data.operation, "update")
    assert.equal(f.ctx.db.tables.events[0].tacticalPlan, undefined)
    assert.equal(f.ctx.db.tables.events[0].timeOfDay, undefined)
})

test("actor deletion checks current role and revision, removes the native event and replays its receipt", async (t) => {
    const f = fixture(t)
    const created = await f.run()
    const deleting = {
        idempotencyKey: "delete-event-0001",
        command: {
            operation: "delete",
            eventId: created.data.eventId,
            expectedRevision: created.data.revision,
        },
    }
    assert.deepEqual(
        await f.run({
            ...deleting,
            command: { ...deleting.command, expectedRevision: "0" },
        }),
        { error: { code: "revision_conflict" } }
    )
    await f.ctx.db.patch("memberObservations:one", { roleIds: [] })
    assert.deepEqual(await f.run(deleting), {
        error: { code: "membership_denied" },
    })
    assert.ok(await f.ctx.db.get(created.data.eventId))
    await f.ctx.db.patch("memberObservations:one", { roleIds: [role] })
    const deleted = await f.run(deleting)
    assert.equal(deleted.data.operation, "delete")
    assert.equal(await f.ctx.db.get(created.data.eventId), null)
    assert.equal(f.ctx.db.tables.eventScheduleJobs.length, 0)
    assert.notEqual(deleted.data.revision, created.data.revision)
    assert.equal((await f.run(deleting)).data.replayed, true)
    await f.ctx.db.patch("memberObservations:one", { roleIds: [] })
    assert.deepEqual(await f.run(deleting), {
        error: { code: "membership_denied" },
    })
})

test("same command key with changed body conflicts and foreign scope/actor cannot discover its receipt", async (t) => {
    const f = fixture(t)
    await f.run()
    assert.deepEqual(
        await f.run({
            command: {
                operation: "create",
                event: { ...fields, name: "Changed" },
            },
        }),
        { error: { code: "idempotency_conflict" } }
    )
    assert.deepEqual(await f.run({ gameId: "hell_let_loose" }), {
        error: { code: "insufficient_scope" },
    })
    assert.deepEqual(await f.run({ actorTokenHash: "d".repeat(64) }), {
        error: { code: "unauthorized" },
    })
    assert.equal(f.ctx.db.tables.events.length, 1)
})

for (const [name, table, patch, expected] of [
    [
        "central session revoked",
        "dashboardSessions",
        { revokedAt: 1 },
        "unauthorized",
    ],
    [
        "account generation changed",
        "users",
        { sessionVersion: 1 },
        "unauthorized",
    ],
    ["SSO token revoked", "ssoAccessTokens", { revokedAt: 1 }, "unauthorized"],
    [
        "app secret rotated",
        "ssoApplications",
        { clientSecretHash: "e".repeat(64) },
        "unauthorized",
    ],
    ["service key revoked", "apiKeys", { revokedAt: "now" }, "unauthorized"],
    [
        "write grant removed",
        "apiKeys",
        { writeAccess: undefined },
        "insufficient_scope",
    ],
    [
        "policy disabled",
        "websiteEventPolicies",
        { enabled: false },
        "policy_denied",
    ],
    [
        "policy app replaced",
        "websiteEventPolicies",
        { applicationRecordId: "ssoApplications:other" },
        "policy_denied",
    ],
    [
        "role removed",
        "memberObservations",
        { roleIds: [] },
        "membership_denied",
    ],
    [
        "member left",
        "memberObservations",
        { state: "left", roleIds: [] },
        "membership_denied",
    ],
    [
        "guild epoch changed",
        "membershipGuilds",
        { epoch: "4" },
        "membership_stale",
    ],
] as const)
    test(`receipt replay rechecks authority after ${name}`, async (t) => {
        const f = fixture(t)
        await f.run()
        Object.assign(f.ctx.db.tables[table][0], patch)
        assert.deepEqual(await f.run(), { error: { code: expected } })
        assert.equal(f.ctx.db.tables.events.length, 1)
    })

test("stale/future observations fail even when receivedAt is recent; no login/admin fallback", async (t) => {
    const f = fixture(t)
    f.advance(60_001)
    f.ctx.db.tables.memberObservations[0].receivedAt = new Date(
        Date.now()
    ).toISOString()
    f.ctx.db.tables.guilds[0].adminIds = [subject]
    assert.deepEqual(await f.run(), { error: { code: "membership_stale" } })
    f.ctx.db.tables.memberObservations[0].observedAt = new Date(
        Date.now() + 1000
    ).toISOString()
    assert.deepEqual(await f.run(), { error: { code: "membership_stale" } })
    assert.equal(f.ctx.db.tables.events?.length ?? 0, 0)
})

test("revision conflict prevents overwrite; update preserves private native Discord fields", async (t) => {
    const f = fixture(t)
    const created = await f.run()
    const event = f.ctx.db.tables.events[0]
    Object.assign(event, {
        serverPassword: "synthetic-private",
        announcementChannelId: "native-channel",
        requiredRoleIds: ["native-role"],
    })
    const update = {
        operation: "update",
        eventId: created.data.eventId,
        expectedRevision: "0",
        event: { ...fields, name: "Updated in web" },
    }
    assert.deepEqual(
        await f.run({ idempotencyKey: "update-command-0001", command: update }),
        { error: { code: "revision_conflict" } }
    )
    assert.equal(event.name, fields.name)
    const result = await f.run({
        idempotencyKey: "update-command-0001",
        command: { ...update, expectedRevision: created.data.revision },
    })
    assert.equal(result.data.operation, "update")
    assert.equal(f.ctx.db.tables.events.length, 1)
    assert.equal(event.name, "Updated in web")
    assert.equal(event.serverPassword, "synthetic-private")
    assert.equal(event.announcementChannelId, "native-channel")
    assert.deepEqual(event.requiredRoleIds, ["native-role"])
    assert.notEqual(result.data.revision, created.data.revision)
    const editor = await invoke(commands.readEditor, f.ctx, {
        secret,
        keyHash: input.keyHash,
        actorTokenHash: input.actorTokenHash,
        gameId: "wardogs",
        eventId: event._id,
    })
    assert.equal(editor.data.event.name, "Updated in web")
    assert.equal(editor.data.revision, result.data.revision)
    assert.equal(JSON.stringify(editor).includes("synthetic-private"), false)
    assert.equal(JSON.stringify(editor).includes("native-role"), false)
})

test("cancel uses existing pre-meeting conclusion, skips scores, clears pending schedule and emits a new revision", async (t) => {
    const f = fixture(t)
    const created = await f.run()
    const result = await f.run({
        idempotencyKey: "cancel-command-0001",
        command: {
            operation: "cancel",
            eventId: created.data.eventId,
            expectedRevision: created.data.revision,
        },
    })
    assert.equal(result.data.operation, "cancel")
    const event = f.ctx.db.tables.events[0]
    assert.equal(event.status, "concluded")
    assert.equal(event.scoreResolution, "skipped")
    assert.equal(f.ctx.db.tables.eventScheduleJobs.length, 0)
    assert.notEqual(result.data.revision, created.data.revision)
    assert.equal(event.eventResult, undefined)
})

test("final receipt failure rolls back native event, schedule and all emitted changes", async (t) => {
    const f = fixture(t)
    const insert = f.ctx.db.insert.bind(f.ctx.db)
    t.mock.method(
        f.ctx.db,
        "insert",
        async (table: string, value: Record<string, unknown>) => {
            if (table === "websiteEventCommandReceipts")
                throw new Error("synthetic transaction failure")
            return insert(table, value)
        }
    )
    await assert.rejects(f.run(), /transaction failure/)
    for (const table of [
        "events",
        "eventScheduleJobs",
        "websiteEventCommandReceipts",
    ])
        assert.equal(f.ctx.db.tables[table]?.length ?? 0, 0)
})

test("configuration requires a current dashboard admin and a restricted key; disabled policy removes write grant", async (t) => {
    const f = fixture(t)
    const args = {
        secret,
        sid,
        workspaceId: "guilds:one",
        applicationRecordId: "ssoApplications:one",
        apiKeyId: "apiKeys:one",
        policy: {
            enabled: true,
            games: [{ gameId: "wardogs", roleIds: [role] }],
        },
    }
    assert.deepEqual(await invoke(commands.configurePolicy, f.ctx, args), {
        error: { code: "policy_denied" },
    })
    f.ctx.db.tables.guilds[0].adminIds = [subject]
    assert.deepEqual(
        await invoke(commands.configurePolicy, f.ctx, {
            ...args,
            workspaceId: "guilds:foreign",
        }),
        { error: { code: "policy_denied" } }
    )
    assert.equal(
        (await invoke(commands.configurePolicy, f.ctx, args)).data.enabled,
        true
    )
    assert.equal(
        (
            await invoke(commands.configurePolicy, f.ctx, {
                ...args,
                policy: { ...args.policy, enabled: false },
            })
        ).data.enabled,
        false
    )
    assert.equal(f.ctx.db.tables.apiKeys[0].writeAccess, undefined)
    assert.deepEqual(await f.run(), { error: { code: "insufficient_scope" } })
    delete f.ctx.db.tables.apiKeys[0].readAccess
    assert.deepEqual(await invoke(commands.configurePolicy, f.ctx, args), {
        error: { code: "policy_denied" },
    })
})

const logoUrl = (id: string) =>
    `https://logi.test/api/image-assets/${id.repeat(32)}.png`
function seedTeams(f: ReturnType<typeof fixture>) {
    for (const id of ["a", "b"])
        f.ctx.db.seed("imageAssets", {
            _id: `imageAssets:${id}`,
            guildId,
            kind: "team-logo",
            publicId: id.repeat(32),
            storageId: `storage:${id}`,
            contentType: "image/png",
            width: 512,
            height: 512,
            bytes: 1000,
            sha256: id.repeat(64),
            publicUrl: logoUrl(id),
            state: "ready",
            createdAt: "2026-10-01T00:00:00.000Z",
            createdBy: subject,
        })
    const team = (id: string, patch: Record<string, unknown> = {}) => ({
        _id: `teamDirectory:${id}`,
        guildId,
        gameId: "wardogs",
        name: id[0].toUpperCase() + id.slice(1),
        shortCode: null,
        logoAssetId: null,
        normalizedName: id,
        searchText: id,
        archivedAt: null,
        revision: 1,
        createdAt: "2026-10-01T00:00:00.000Z",
        updatedAt: "2026-10-01T00:00:00.000Z",
        createdBy: subject,
        updatedBy: subject,
        ...patch,
    })
    f.ctx.db.seed(
        "teamDirectory",
        team("alpha", { shortCode: "ALP", logoAssetId: "imageAssets:a" })
    )
    f.ctx.db.seed("teamDirectory", team("bravo"))
    f.ctx.db.seed(
        "teamDirectory",
        team("archived", { archivedAt: "2026-10-02T00:00:00.000Z" })
    )
    f.ctx.db.seed("teamDirectory", team("hll", { gameId: "hell_let_loose" }))
    return (id: string) =>
        f.ctx.db.tables.teamDirectory.find(
            (row) => row._id === `teamDirectory:${id}`
        )!
}
const selection = [
    { teamId: "teamDirectory:alpha", slot: "a", side: "Valkyra" },
    { teamId: "teamDirectory:bravo", slot: "c", side: null },
]
const editorFor = (
    f: ReturnType<typeof fixture>,
    eventId: string
): Promise<{
    data: {
        revision: string
        event: Record<string, unknown>
        matchTeams: Array<Record<string, unknown>> | null
        canEdit: boolean
        canCancel: boolean
    }
}> =>
    invoke(commands.readEditor, f.ctx, {
        secret,
        keyHash: input.keyHash,
        actorTokenHash: input.actorTokenHash,
        gameId: "wardogs",
        eventId,
    })
const eventReferences = (f: ReturnType<typeof fixture>, eventId: string) =>
    (f.ctx.db.tables.imageAssetReferences ?? []).filter(
        (row) => row.owner === "event" && row.ownerId === eventId
    )

test("commands capture team snapshots on create, preserve them when omitted and clear them with []", async (t) => {
    const f = fixture(t)
    seedTeams(f)
    const create = {
        operation: "create",
        event: { ...fields, matchTeams: selection },
    }
    const created = await f.run({ command: create })
    assert.equal(created.data.operation, "create")
    const event = f.ctx.db.tables.events[0]
    assert.deepEqual(
        event.matchTeams.map(
            (entry: {
                teamId: string
                slot: string
                side: string | null
                snapshot: { name: string; logoAssetId: string | null }
            }) => [
                entry.slot,
                entry.side,
                entry.snapshot.name,
                entry.snapshot.logoAssetId,
            ]
        ),
        [
            ["a", "Valkyra", "Alpha", "imageAssets:a"],
            ["c", null, "Bravo", null],
        ]
    )
    assert.deepEqual(
        eventReferences(f, event._id).map((row) => row.assetId),
        ["imageAssets:a"]
    )
    // The same assignments listed in another order replay the receipt.
    const replay = await f.run({
        command: {
            ...create,
            event: { ...fields, matchTeams: [...selection].reverse() },
        },
    })
    assert.equal(replay.data.replayed, true)
    assert.equal(replay.data.receiptId, created.data.receiptId)

    const editor = await editorFor(f, event._id)
    assert.deepEqual(editor.data.event.matchTeams, selection)
    assert.deepEqual(editor.data.matchTeams, [
        {
            teamId: "teamDirectory:alpha",
            slot: "a",
            side: "Valkyra",
            name: "Alpha",
            shortCode: "ALP",
            logoUrl: logoUrl("a"),
            teamRevision: 1,
            capturedAt: event.matchTeams[0].snapshot.capturedAt,
        },
        {
            teamId: "teamDirectory:bravo",
            slot: "c",
            side: null,
            name: "Bravo",
            shortCode: null,
            logoUrl: null,
            teamRevision: 1,
            capturedAt: event.matchTeams[1].snapshot.capturedAt,
        },
    ])
    assert.equal(JSON.stringify(editor).includes("imageAssets:"), false)

    const saved = structuredClone(event.matchTeams)
    const omitted = await f.run({
        idempotencyKey: "update-omitted-0001",
        command: {
            operation: "update",
            eventId: event._id,
            expectedRevision: editor.data.revision,
            event: { ...fields, name: "Renamed without teams" },
        },
    })
    assert.equal(omitted.data.operation, "update")
    assert.equal(event.name, "Renamed without teams")
    assert.deepEqual(event.matchTeams, saved)

    // Round-tripping the editor's inputs keeps the captured snapshots.
    const roundTrip = await editorFor(f, event._id)
    await f.run({
        idempotencyKey: "update-roundtrip-01",
        command: {
            operation: "update",
            eventId: event._id,
            expectedRevision: roundTrip.data.revision,
            event: roundTrip.data.event,
        },
    })
    assert.deepEqual(event.matchTeams, saved)

    const cleared = await f.run({
        idempotencyKey: "update-cleared-0001",
        command: {
            operation: "update",
            eventId: event._id,
            expectedRevision: (await editorFor(f, event._id)).data.revision,
            event: { ...fields, matchTeams: [] },
        },
    })
    assert.equal(cleared.data.replayed, false)
    assert.deepEqual(event.matchTeams, [])
    assert.equal(eventReferences(f, event._id).length, 0)
    assert.deepEqual((await editorFor(f, event._id)).data.matchTeams, [])
    assert.equal(f.ctx.db.tables.websiteEventCommandReceipts.length, 4)
})

test("archived, cross-game, unknown and duplicate selections return invalid_match_teams and write nothing", async (t) => {
    const f = fixture(t)
    seedTeams(f)
    for (const matchTeams of [
        [{ teamId: "teamDirectory:archived", slot: "a", side: null }],
        [{ teamId: "teamDirectory:hll", slot: "a", side: null }],
        [{ teamId: "teamDirectory:unknown", slot: "a", side: null }],
        [{ teamId: "teamDirectory:alpha", slot: "a", side: "Allies" }],
        [
            { teamId: "teamDirectory:alpha", slot: "a", side: "Valkyra" },
            { teamId: "teamDirectory:bravo", slot: "b", side: "Valkyra" },
        ],
    ])
        assert.deepEqual(
            await f.run({
                command: {
                    operation: "create",
                    event: { ...fields, matchTeams },
                },
            }),
            { error: { code: "invalid_match_teams" } }
        )
    assert.deepEqual(
        await f.run({
            command: {
                operation: "create",
                event: { ...fields, kind: "training", matchTeams: selection },
            },
        }),
        { error: { code: "invalid_match_teams" } }
    )
    for (const table of [
        "events",
        "eventScheduleJobs",
        "websiteEventCommandReceipts",
        "imageAssetReferences",
    ])
        assert.equal(f.ctx.db.tables[table]?.length ?? 0, 0, table)

    // A rejected update leaves the event and its saved selection unchanged,
    // and its key stays usable for the corrected command.
    const created = await f.run({
        command: {
            operation: "create",
            event: { ...fields, matchTeams: selection },
        },
    })
    const event = f.ctx.db.tables.events[0]
    const saved = structuredClone(event.matchTeams)
    const update = {
        operation: "update",
        eventId: created.data.eventId,
        expectedRevision: created.data.revision,
        event: {
            ...fields,
            name: "Should not apply",
            matchTeams: [
                { teamId: "teamDirectory:foreign", slot: "a", side: null },
            ],
        },
    }
    assert.deepEqual(
        await f.run({ idempotencyKey: "update-foreign-0001", command: update }),
        { error: { code: "invalid_match_teams" } }
    )
    assert.equal(event.name, fields.name)
    assert.deepEqual(event.matchTeams, saved)
    assert.equal(f.ctx.db.tables.websiteEventCommandReceipts.length, 1)
    const corrected = await f.run({
        idempotencyKey: "update-foreign-0001",
        command: { ...update, event: { ...update.event, matchTeams: [] } },
    })
    assert.equal(corrected.data.operation, "update")
    assert.deepEqual(event.matchTeams, [])
})

test("refresh re-captures one assigned team with audit, change feed, receipt and replay", async (t) => {
    const f = fixture(t)
    const team = seedTeams(f)
    const created = await f.run({
        command: {
            operation: "create",
            event: { ...fields, matchTeams: selection },
        },
    })
    const event = f.ctx.db.tables.events[0]
    Object.assign(team("alpha"), {
        name: "Alpha Prime",
        shortCode: "APX",
        logoAssetId: "imageAssets:b",
        revision: 2,
    })
    // Directory edits never rewrite saved snapshots by themselves.
    assert.equal(event.matchTeams[0].snapshot.name, "Alpha")
    const refresh = {
        operation: "refresh_match_team",
        eventId: created.data.eventId,
        expectedRevision: "0",
        teamId: "teamDirectory:alpha",
    }
    assert.deepEqual(
        await f.run({ idempotencyKey: "refresh-alpha-0001", command: refresh }),
        { error: { code: "revision_conflict" } }
    )
    assert.equal(event.matchTeams[0].snapshot.name, "Alpha")

    const command = { ...refresh, expectedRevision: created.data.revision }
    const refreshed = await f.run({
        idempotencyKey: "refresh-alpha-0001",
        command,
    })
    assert.equal(refreshed.data.operation, "refresh_match_team")
    assert.equal(refreshed.data.replayed, false)
    assert.notEqual(refreshed.data.revision, created.data.revision)
    assert.deepEqual(
        {
            name: event.matchTeams[0].snapshot.name,
            shortCode: event.matchTeams[0].snapshot.shortCode,
            logoAssetId: event.matchTeams[0].snapshot.logoAssetId,
            teamRevision: event.matchTeams[0].snapshot.teamRevision,
            side: event.matchTeams[0].side,
        },
        {
            name: "Alpha Prime",
            shortCode: "APX",
            logoAssetId: "imageAssets:b",
            teamRevision: 2,
            side: "Valkyra",
        }
    )
    assert.equal(event.matchTeams[1].snapshot.name, "Bravo")
    assert.deepEqual(
        eventReferences(f, event._id).map((row) => row.assetId),
        ["imageAssets:b"]
    )
    const audit = f.ctx.db.tables.teamDirectoryAudit
    assert.equal(audit.length, 1)
    assert.equal(audit[0].operation, "snapshot_refresh")
    assert.equal(audit[0].actor, subject)
    assert.equal(audit[0].eventId, event._id)
    assert.equal(audit[0].teamId, "teamDirectory:alpha")
    const receipt = f.ctx.db.tables.websiteEventCommandReceipts.at(-1)!
    assert.equal(receipt.operation, "refresh_match_team")
    assert.equal(receipt.revision, refreshed.data.revision)

    const replay = await f.run({
        idempotencyKey: "refresh-alpha-0001",
        command,
    })
    assert.equal(replay.data.replayed, true)
    assert.equal(replay.data.receiptId, refreshed.data.receiptId)
    assert.equal(f.ctx.db.tables.teamDirectoryAudit.length, 1)

    // A team that is not assigned, or no longer active, cannot be refreshed.
    for (const [key, teamId] of [
        ["refresh-unassigned1", "teamDirectory:foreign"],
        ["refresh-archived-01", "teamDirectory:bravo"],
    ] as const) {
        if (teamId === "teamDirectory:bravo")
            team("bravo").archivedAt = "2026-10-03T00:00:00.000Z"
        assert.deepEqual(
            await f.run({
                idempotencyKey: key,
                command: {
                    ...refresh,
                    teamId,
                    expectedRevision: refreshed.data.revision,
                },
            }),
            { error: { code: "invalid_match_teams" } }
        )
    }
    assert.equal(event.matchTeams[1].snapshot.name, "Bravo")
    assert.equal(f.ctx.db.tables.teamDirectoryAudit.length, 1)

    // Unlike an update, a refresh stays available after meeting start until
    // the match concludes.
    const minutes = (value: number) =>
        new Date(Date.now() + value * 60_000).toISOString()
    Object.assign(event, {
        registrationEnd: minutes(-20),
        meetingStart: minutes(-10),
        gameStart: minutes(-5),
        gameEnd: minutes(60),
    })
    const started = await f.run({
        idempotencyKey: "refresh-started-001",
        command: { ...command, expectedRevision: refreshed.data.revision },
    })
    assert.equal(started.data.operation, "refresh_match_team")
    assert.equal(started.data.replayed, false)
    assert.equal(f.ctx.db.tables.teamDirectoryAudit.length, 2)

    // Historical refreshes remain explicit, audited and revision-checked.
    event.status = "concluded"
    const historical = await f.run({
        idempotencyKey: "refresh-concluded01",
        command: { ...command, expectedRevision: started.data.revision },
    })
    assert.equal(historical.data.operation, "refresh_match_team")
    assert.equal(event.status, "concluded")
    assert.equal(f.ctx.db.tables.teamDirectoryAudit.length, 3)
    assert.equal(f.ctx.db.tables.websiteEventCommandReceipts.length, 4)
    const editor = await editorFor(f, String(event._id))
    assert.equal(editor.data.canEdit, true)
    assert.equal(editor.data.canCancel, false)
})

test("a match created with an explicit [] reads as an empty selection, not a legacy null", async (t) => {
    const f = fixture(t)
    const created = await f.run({
        command: { operation: "create", event: { ...fields, matchTeams: [] } },
    })
    assert.equal(created.data.operation, "create")
    const editor = await editorFor(f, created.data.eventId)
    assert.deepEqual(editor.data.matchTeams, [])
    assert.deepEqual(editor.data.event.matchTeams, [])
})

test("actor API reads and writes forum cleanup and preserves it on an omitted update", async (t) => {
    const f = fixture(t)
    const created = await f.run({
        command: {
            operation: "create",
            event: { ...fields, deleteForumAfterConclusion: false },
        },
    })
    assert.equal(f.ctx.db.tables.events[0].deleteForumAfterConclusion, false)
    const editor = await editorFor(f, created.data.eventId)
    assert.equal(editor.data.event.deleteForumAfterConclusion, false)
    const updated = await f.run({
        idempotencyKey: "enable-cleanup-0001",
        command: {
            operation: "update",
            eventId: created.data.eventId,
            expectedRevision: created.data.revision,
            event: { ...fields, deleteForumAfterConclusion: true },
        },
    })
    assert.equal(updated.data.operation, "update")
    assert.equal(f.ctx.db.tables.events[0].deleteForumAfterConclusion, true)
    const preserved = await f.run({
        idempotencyKey: "preserve-cleanup-0001",
        command: {
            operation: "update",
            eventId: created.data.eventId,
            expectedRevision: updated.data.revision,
            event: { ...fields, name: "Renamed match" },
        },
    })
    assert.equal(preserved.data.operation, "update")
    assert.equal(f.ctx.db.tables.events[0].deleteForumAfterConclusion, true)
})
