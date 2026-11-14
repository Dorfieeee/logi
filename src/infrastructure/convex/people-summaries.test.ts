import { withIntegrationChanges } from "../../../convex/integrationMutation"
import { projectPlayerFacts } from "../../../convex/peopleProjection"
import { warconMatchDetail, warconServerId } from "../testing/warcon"
import { PEOPLE_RESOURCES } from "../../domain/api/people-summaries"
import type { DataSource } from "../../domain/game-data/contracts"
import { invoke, spyReads, testContext } from "./testing/database"
import { peopleGeneration } from "../../../convex/peopleChanges"
import * as summaries from "../../../convex/peopleSummaries"
import * as feed from "../../../convex/integrationChanges"
import { readHllSession } from "../game-data/hll-sessions"
import { readWarconSession } from "../game-data/warcon"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

process.env.INTERNAL_AUTH_SECRET = "synthetic-people-secret"
const guildId = "910000000000000001",
    discordId = "910000000000000002",
    now = "2026-10-03T10:00:00.000Z"
const args = {
    secret: "synthetic-people-secret",
    keyHash: "reader",
    gameId: "wardogs",
    resource: "member-summaries",
}

test("large player projections overlap reads with bounded concurrency", async (t) => {
    const ctx = fixture()
    const session = ctx.db.tables.gameSessions[0]
    session.session.players = Array.from({ length: 24 }, (_, index) => ({
        platform: "steam",
        platformId: `unknown-${index}`,
        metrics: {},
    }))
    let active = 0,
        peak = 0,
        reads = 0
    const query = ctx.db.query.bind(ctx.db)
    t.mock.method(ctx.db, "query", (table: string) => {
        const result = query(table)
        if (table === "platformIdentityLinks") {
            const take = result.take
            result.take = async (limit: number) => {
                active++
                reads++
                peak = Math.max(peak, active)
                await new Promise<void>((resolve) => setImmediate(resolve))
                try {
                    return await take(limit)
                } finally {
                    active--
                }
            }
        }
        return result
    })
    const result = await invoke(feed.readSyncRecord, ctx, {
        ...args,
        resource: "player-stat-summaries",
        id: session._id,
    })
    assert.deepEqual(result.data.players, [])
    assert.equal(reads, 24)
    assert.equal(peak, 8)
    assert.equal(active, 0)
})

test("roster references reuse alias lookups within a projection and refresh on the next read", async () => {
    const ctx = fixture()
    const reads = spyReads(ctx)
    const query = { ...args, resource: "roster-summaries", id: "rosters:one" }
    const first = await invoke(feed.readSyncRecord, ctx, query)
    assert.equal(first.data.squads[0].slots[0].identityState, "resolved")
    // Three identity aliases, with both imported and Discord namespaces checked.
    assert.equal(reads.filter((read) => read.table === "users").length, 6)
    await ctx.db.delete("userAssignments:one")
    const second = await invoke(feed.readSyncRecord, ctx, query)
    assert.equal(second.data.squads[0].slots[0].identityState, "unresolved")
})
function fixture() {
    const ctx = testContext()
    ctx.db.seed("apiKeys", {
        _id: "apiKeys:reader",
        keyHash: "reader",
        guildId,
        readAccess: {
            resources: [...PEOPLE_RESOURCES],
            gameIds: ["wardogs", "hell_let_loose"],
        },
    })
    ctx.db.seed("users", {
        _id: "users:one",
        id: "imported-one",
        discordId,
        name: "Synthetic member",
        avatar: "",
        note: "private-note",
        platformIds: ["76561190000000001"],
    })
    ctx.db.seed("userAssignments", {
        _id: "userAssignments:one",
        serverId: guildId,
        gameId: "wardogs",
        userId: "imported-one",
        type: "member",
        status: "active",
        paused: false,
        pausedNote: "private-paused",
        primaryGroupId: "groups:one",
        secondaryGroupIds: ["groups:foreign"],
        updatedAt: now,
    })
    ctx.db.seed("groups", {
        _id: "groups:one",
        guildId,
        gameId: "wardogs",
        name: "Alpha",
        discordRoleId: "private-role",
    })
    ctx.db.seed("groups", {
        _id: "groups:foreign",
        guildId: "910000000000000009",
        gameId: "wardogs",
        name: "foreign",
    })
    ctx.db.seed("events", {
        _id: "events:one",
        guildId,
        gameId: "wardogs",
        name: "Synthetic event",
        gameEnd: now,
        updatedAt: now,
        participants: [
            {
                userId: "imported-one",
                status: "attending",
                completed: "passed",
            },
        ],
        absenceNotices: [{ userId: "imported-one", reason: "private-reason" }],
    })
    ctx.db.seed("rosters", {
        _id: "rosters:one",
        eventId: "events:one",
        published: true,
        updatedAt: now,
        squads: [
            {
                name: "Alpha",
                players: [
                    { id: "imported-one", ack: true, note: "private-slot" },
                    { customName: "private-guest", ack: false },
                ],
            },
        ],
        reservePlayerIds: [],
        notAttendingPlayerIds: [],
    })
    ctx.db.seed("gameDataConnections", {
        _id: "gameDataConnections:one",
        guildId,
        gameId: "wardogs",
        enabled: true,
        generation: 1,
        provider: "wardogs_warcon",
    })
    ctx.db.seed("gameSessions", {
        _id: "gameSessions:one",
        connectionId: "gameDataConnections:one",
        guildId,
        gameId: "wardogs",
        externalId: "round-one",
        sourceGeneration: 1,
        fetchedAt: Date.parse(now),
        updatedAt: now,
        session: {
            externalId: "round-one",
            startedAt: now,
            endedAt: now,
            complete: true,
            map: null,
            participants: [],
            sourceDigest: "a".repeat(64),
            players: [
                {
                    platform: "steam",
                    platformId: "76561190000000001",
                    metrics: { kills: 8, deaths: 3, cashDelta: -100 },
                },
                {
                    platform: "steam",
                    platformId: "76561190000000002",
                    metrics: { kills: 9 },
                },
            ],
        },
    })
    ctx.db.seed("platformIdentityLinks", {
        _id: "platformIdentityLinks:one",
        platform: "steam",
        platformId: "76561190000000001",
        userRecordId: "users:one",
        discordUserId: discordId,
        logiUserId: "imported-one",
        active: true,
        method: "steam_openid",
        revokedAt: null,
        verifiedAt: Date.parse("2026-01-01T00:00:00.000Z"),
    })
    return ctx
}
const get = (
    ctx: ReturnType<typeof fixture>,
    resource = "member-summaries",
    id = "userAssignments:one",
    patch = {}
) => invoke(summaries.get, ctx, { ...args, resource, id, ...patch })
const changed = async (
    ctx: ReturnType<typeof fixture>,
    change: Parameters<typeof withIntegrationChanges>[1]
) => withIntegrationChanges(ctx as never, change)
const start = (ctx: ReturnType<typeof fixture>) =>
    invoke(feed.readChanges, ctx, {
        ...args,
        resources: [...PEOPLE_RESOURCES],
        limit: 100,
        startNow: true,
    })
const poll = (ctx: ReturnType<typeof fixture>, generation: string) =>
    invoke(feed.readChanges, ctx, {
        ...args,
        resources: [...PEOPLE_RESOURCES],
        limit: 100,
        afterRevision: "0",
        issuedAt: Date.now(),
        peopleScopeVersion: generation,
    })

test("directory uses immutable records, exact scope and minimized groups without private data", async () => {
    const ctx = fixture(),
        row = await get(ctx)
    assert.equal(row.identityId, "users:one")
    assert.equal(row.id, "userAssignments:one")
    assert.equal(row.discordSubject, discordId)
    assert.deepEqual(row.groups, [
        { id: "groups:one", name: "Alpha", primary: true },
    ])
    assert.equal(JSON.stringify(row).includes("private"), false)
    assert.equal(
        await get(ctx, undefined, undefined, { gameId: "hell_let_loose" }),
        null
    )
    await ctx.db.patch("users:one", { discordId: undefined })
    assert.equal((await get(ctx)).discordSubject, null)
})
test("legacy/full keys, revoked keys, unrelated grants and wrong guilds fail closed", async () => {
    for (const patch of [
        { readAccess: undefined },
        { revokedAt: now },
        {
            readAccess: {
                resources: ["event-summaries"],
                gameIds: ["wardogs"],
            },
        },
        { guildId: "910000000000000009" },
    ]) {
        const ctx = fixture()
        await ctx.db.patch("apiKeys:reader", patch)
        assert.equal(await get(ctx), null)
    }
    await assert.rejects(
        get(fixture(), undefined, undefined, { secret: "wrong" }),
        /Unauthorized/
    )
})
test("alias collisions and duplicate scoped assignments never attach a member to guessed identity", async () => {
    const ctx = fixture()
    ctx.db.seed("users", {
        _id: "users:collision",
        discordId: "imported-one",
        name: "Wrong user",
    })
    const row = await get(ctx)
    assert.equal(row.identityState, "conflict")
    assert.equal(row.identityId, null)
    assert.equal(row.displayName, null)
    await ctx.db.delete("users:collision")
    ctx.db.seed("userAssignments", {
        ...ctx.db.tables.userAssignments[0],
        _id: "userAssignments:duplicate",
        userId: discordId,
    })
    assert.equal((await get(ctx)).identityState, "conflict")
})
test("only published rosters expose native acknowledgements, no notes or guest names", async () => {
    const ctx = fixture(),
        row = await get(ctx, "roster-summaries", "rosters:one")
    assert.equal(row.squads[0].slots[0].attendance, "acknowledged")
    assert.equal(row.squads[0].slots[0].identityId, "users:one")
    assert.equal(row.squads[0].slots[1].identityId, null)
    assert.equal(row.eventParticipation[0].completed, "passed")
    assert.equal(JSON.stringify(row).includes("private"), false)
    await changed(ctx, async (tracked) => {
        await tracked.db.patch("rosters:one" as never, { published: false })
    })
    assert.equal(await get(ctx, "roster-summaries", "rosters:one"), null)
    assert.equal(
        await invoke(feed.readSyncRecord, ctx, {
            ...args,
            resource: "roster-summaries",
            id: "rosters:one",
        }),
        null
    )
    await changed(ctx, async (tracked) => {
        await tracked.db.patch("rosters:one" as never, { published: true })
    })
    assert.equal(
        (
            await invoke(feed.readSyncRecord, ctx, {
                ...args,
                resource: "roster-summaries",
                id: "rosters:one",
            })
        ).operation,
        "upsert"
    )
    await changed(ctx, async (tracked) => {
        await tracked.db.delete("rosters:one" as never)
    })
    assert.equal(
        await invoke(feed.readSyncRecord, ctx, {
            ...args,
            resource: "roster-summaries",
            id: "rosters:one",
        }),
        null
    )
})
test("session facts require current verified Steam ownership and preserve unknown metrics", async () => {
    const ctx = fixture(),
        row = await get(ctx, "player-stat-summaries", "gameSessions:one")
    assert.deepEqual(row.coverage, {
        observedPlayers: 2,
        verifiedMembers: 1,
        unlinkedPlayers: 1,
    })
    assert.equal(row.players[0].metrics.cashDelta, -100)
    assert.equal(row.players[0].metrics.headshots, null)
    assert.equal(row.players[0].metrics.combat, null)
    assert.equal(row.players[0].identityId, "users:one")
    assert.equal(JSON.stringify(row).includes("7656119"), false)
    assert.deepEqual(row.eventRefs, [])
    await ctx.db.delete("platformIdentityLinks:one")
    const unverified = await get(
        ctx,
        "player-stat-summaries",
        "gameSessions:one"
    )
    assert.deepEqual(unverified.players, [])
    assert.equal(unverified.coverage.unlinkedPlayers, 2)
    // Legacy platformIds and inferred playerStats.userId intentionally do not restore proof.
})
test("stale source configuration, inactive source and mismatched owner never serve statistics", async () => {
    for (const patch of [
        { sourceGeneration: undefined },
        { sourceGeneration: 2 },
    ]) {
        const ctx = fixture()
        await ctx.db.patch("gameSessions:one", patch)
        assert.equal(
            await get(ctx, "player-stat-summaries", "gameSessions:one"),
            null
        )
    }
    for (const patch of [
        { enabled: false },
        { generation: 2 },
        { guildId: "910000000000000009" },
        { gameId: "hell_let_loose" },
    ]) {
        const ctx = fixture()
        await ctx.db.patch("gameDataConnections:one", patch)
        assert.equal(
            await get(ctx, "player-stat-summaries", "gameSessions:one"),
            null
        )
    }
})
test("duplicate player rows, wrong proof owner and wrong game assignment are unresolved", async () => {
    for (const mutate of [
        (ctx: ReturnType<typeof fixture>) => {
            ctx.db.tables.gameSessions[0].session.players.push(
                ctx.db.tables.gameSessions[0].session.players[0]
            )
        },
        (ctx: ReturnType<typeof fixture>) => {
            ctx.db.tables.platformIdentityLinks[0].discordUserId = "another"
        },
        (ctx: ReturnType<typeof fixture>) => {
            ctx.db.tables.userAssignments[0].gameId = "hell_let_loose"
        },
    ]) {
        const ctx = fixture()
        mutate(ctx)
        assert.deepEqual(
            (await get(ctx, "player-stat-summaries", "gameSessions:one"))
                .players,
            []
        )
    }
})
test("confirmed result association requires exact current scoped revision and source digest", async () => {
    const ctx = fixture(),
        session = ctx.db.tables.gameSessions[0]
    ctx.db.seed("eventResultRevisions", {
        _id: "eventResultRevisions:one",
        eventId: "events:one",
        guildId,
        gameId: "wardogs",
        version: 2,
        revision: {
            status: "confirmed",
            sessionLinks: [
                {
                    sessionId: session._id,
                    sourceDigest: session.session.sourceDigest,
                    complete: true,
                },
            ],
        },
    })
    await changed(ctx, async (tracked) => {
        await tracked.db.patch(
            "events:one" as never,
            {
                reviewedResultGameId: "wardogs",
                reviewedResult: { version: 2, status: "confirmed" },
            } as never
        )
    })
    assert.deepEqual(
        (await get(ctx, "player-stat-summaries", session._id)).eventRefs,
        [{ eventId: "events:one", resultVersion: 2, resultState: "confirmed" }]
    )
    session.session.sourceDigest = "b".repeat(64)
    assert.deepEqual(
        (await get(ctx, "player-stat-summaries", session._id)).eventRefs,
        []
    )
    session.session.sourceDigest = "a".repeat(64)
    await changed(ctx, async (tracked) => {
        await tracked.db.patch("events:one" as never, {
            gameId: "hell_let_loose",
        })
    })
    assert.deepEqual(
        (await get(ctx, "player-stat-summaries", session._id)).eventRefs,
        []
    )
    assert.equal(await get(ctx, "roster-summaries", "rosters:one"), null)
})
test("cross-row user/group/link/event/source dependencies atomically force fresh bootstrap", async () => {
    const edits: Array<[string, Record<string, unknown> | null]> = [
        ["users:one", { name: "Renamed" }],
        ["users:one", { discordId: "910000000000000003" }],
        ["users:one", null],
        ["groups:one", { name: "Renamed group" }],
        ["groups:one", null],
        ["platformIdentityLinks:one", { active: false, revokedAt: Date.now() }],
        ["gameDataConnections:one", { enabled: false }],
        ["gameDataConnections:one", { generation: 2 }],
        ["events:one", { gameId: "hell_let_loose" }],
        ["events:one", null],
        ["userAssignments:one", { paused: true }],
        ["userAssignments:one", null],
    ]
    for (const [id, patch] of edits) {
        const ctx = fixture(),
            before = await start(ctx)
        await changed(ctx, async (tracked) => {
            if (patch === null) await tracked.db.delete(id as never)
            else await tracked.db.patch(id as never, patch as never)
        })
        assert.equal(
            (await poll(ctx, before.peopleScopeVersion)).resetRequired,
            true,
            id
        )
        assert.notEqual(
            await peopleGeneration(ctx as never),
            before.peopleScopeVersion
        )
    }
})
test("bounded list cursors preserve empty scoped pages and reset on dependency changes", async () => {
    const ctx = fixture()
    ctx.db.seed("userAssignments", {
        ...ctx.db.tables.userAssignments[0],
        _id: "userAssignments:hll",
        gameId: "hell_let_loose",
    })
    const first = await invoke(summaries.list, ctx, {
        ...args,
        cursor: null,
        limit: 1,
    })
    assert.equal(first.items.length, 1)
    const second = await invoke(summaries.list, ctx, {
        ...args,
        cursor: first.nextCursor,
        limit: 1,
        peopleScopeVersion: first.peopleScopeVersion,
    })
    assert.equal(second.items.length, 0)
    assert.equal(second.nextCursor, null)
    await changed(ctx, async (tracked) => {
        await tracked.db.patch("users:one" as never, { name: "Renamed" })
    })
    assert.equal(
        (
            await invoke(summaries.list, ctx, {
                ...args,
                cursor: first.nextCursor,
                limit: 1,
                peopleScopeVersion: first.peopleScopeVersion,
            })
        ).resetRequired,
        true
    )
    await assert.rejects(
        invoke(summaries.list, ctx, { ...args, cursor: null, limit: 11 }),
        /Invalid limit/
    )
})
test("session details reflect current source data and disappear on deletion", async () => {
    const ctx = fixture()
    await changed(ctx, async (tracked) => {
        await tracked.db.patch("gameSessions:one" as never, {
            fetchedAt: Date.now(),
        })
    })
    await changed(ctx, async (tracked) => {
        const row = await tracked.db.get("gameSessions:one" as never)
        await tracked.db.patch(
            "gameSessions:one" as never,
            {
                session: {
                    ...(row as { session: object }).session,
                    map: "Foy",
                },
            } as never
        )
    })
    const record = await invoke(feed.readSyncRecord, ctx, {
        ...args,
        resource: "player-stat-summaries",
        id: "gameSessions:one",
    })
    assert.equal(record.operation, "upsert")
    assert.notEqual(record.revision, "0")
    await changed(ctx, async (tracked) => {
        await tracked.db.delete("gameSessions:one" as never)
    })
    assert.equal(
        await invoke(feed.readSyncRecord, ctx, {
            ...args,
            resource: "player-stat-summaries",
            id: "gameSessions:one",
        }),
        null
    )
})
test("new native roster and verified identity mutation entrypoints use the tracked transaction", () => {
    for (const file of [
        "rosters",
        "discordRosters",
        "platformIdentityLinks",
        "groups",
        "userAssignments",
        "players",
        "events",
        "gameData",
        "gameDataHistory",
        "serverSetup",
        "migrations",
        "publicApi",
    ]) {
        const source = readFileSync(`convex/${file}.ts`, "utf8")
        assert.match(
            source,
            /import\s*\{[^}]*\b(?:mutation|internalMutation)\b[^}]*\}\s*from\s*["']\.\/integrationMutation["']/,
            file
        )
    }
})
test("source time remains historical when current identity attribution is checked", async () => {
    const ctx = fixture(),
        projectedAt = Date.parse(now) + 86400000
    const row = await projectPlayerFacts(
        ctx as never,
        ctx.db.tables.gameSessions[0] as never,
        projectedAt
    )
    assert.equal(row?.fetchedAt, now)
    assert.equal(row?.attributionCheckedAt, new Date(projectedAt).toISOString())
})

test("stored HLL and Warcon provider fixtures flow into the same closed people contract", async () => {
    for (const gameId of ["hell_let_loose", "wardogs"] as const) {
        const ctx = fixture()
        const source: DataSource = {
            ref: "synthetic",
            guildId,
            gameId,
            provider: gameId === "wardogs" ? "wardogs_warcon" : "hll_crcon",
            providerServerId: gameId === "wardogs" ? warconServerId : "1",
            origin: "https://provider.example.test",
            secretRef: null,
            allowedAddresses: [],
        }
        const body =
            gameId === "wardogs"
                ? warconMatchDetail()
                : JSON.parse(
                      readFileSync(
                          "src/infrastructure/game-data/fixtures/hll/session.json",
                          "utf8"
                      )
                  )
        const http = { get: async () => ({ status: 200, body, etag: null }) }
        const session =
            gameId === "wardogs"
                ? await readWarconSession(source, "7", http)
                : await readHllSession(source, "42", http)
        assert.ok(session)
        Object.assign(ctx.db.tables.gameDataConnections[0], {
            gameId,
            provider: source.provider,
        })
        Object.assign(ctx.db.tables.gameSessions[0], {
            gameId,
            session,
            externalId: session.externalId,
        })
        ctx.db.tables.userAssignments[0].gameId = gameId
        ctx.db.tables.platformIdentityLinks[0].platformId =
            session.players[0].platformId
        const result = await get(
            ctx,
            "player-stat-summaries",
            "gameSessions:one",
            { gameId }
        )
        assert.equal(result.players.length, 1)
        assert.equal(
            result.players[0].metrics.kills,
            session.players[0].metrics.kills
        )
        assert.equal(
            result.players[0].metrics.cashDelta,
            gameId === "wardogs" ? session.players[0].metrics.cashDelta : null
        )
        assert.equal(
            result.players[0].metrics.combat,
            gameId === "hell_let_loose"
                ? session.players[0].metrics.combat
                : null
        )
        assert.equal(
            JSON.stringify(result).includes(session.players[0].platformId),
            false
        )
    }
})

test("native attendance and account unlink writers change the served projection transactionally", async () => {
    const ctx = fixture(),
        before = await start(ctx)
    ctx.db.tables.events[0].status = "starting"
    Object.assign(ctx.db.tables.events[0], {
        registrationEnd: new Date(Date.now() - 3600000).toISOString(),
        meetingStart: new Date(Date.now() - 10000).toISOString(),
        gameStart: new Date(Date.now() + 600000).toISOString(),
        gameEnd: new Date(Date.now() + 3600000).toISOString(),
    })
    ctx.db.tables.rosters[0].squads[0].players[0].ack = false
    const rosters = await import("../../../convex/rosters")
    await invoke(rosters.acknowledgeAttendance, ctx, {
        secret: args.secret,
        guildId,
        eventId: "events:one",
        userId: "imported-one",
    })
    assert.equal(
        (await get(ctx, "roster-summaries", "rosters:one")).squads[0].slots[0]
            .attendance,
        "acknowledged"
    )
    const identities = await import("../../../convex/platformIdentityLinks")
    await invoke(identities.unlink, ctx, {
        secret: args.secret,
        discordUserId: discordId,
    })
    assert.equal(
        (await poll(ctx, before.peopleScopeVersion)).resetRequired,
        true
    )
    assert.deepEqual(
        (await get(ctx, "player-stat-summaries", "gameSessions:one")).players,
        []
    )
})

test("reviewed relationship backfill is bounded and overlapping or completed runs do not duplicate it", async () => {
    const ctx = fixture()
    for (let index = 0; index < 30; index++)
        ctx.db.seed("events", {
            _id: `events:backfill-${index}`,
            guildId,
            gameId: "wardogs",
        })
    const first = await invoke(summaries.reconcileResultLinks, ctx)
    assert.deepEqual(first, { processed: 25, complete: false })
    const state = ctx.db.tables.peopleIntegrationState[0],
        run = state.reconciliationRun
    assert.deepEqual(await invoke(summaries.reconcileResultLinks, ctx), {
        processed: 0,
        complete: false,
    })
    assert.deepEqual(
        await invoke(summaries.reconcileResultLinks, ctx, { run: "wrong" }),
        { processed: 0, complete: false }
    )
    assert.deepEqual(
        await invoke(summaries.reconcileResultLinks, ctx, { run }),
        { processed: 6, complete: true }
    )
    assert.deepEqual(
        await invoke(summaries.reconcileResultLinks, ctx, { run }),
        { processed: 0, complete: false }
    )
})

test("after a complete walk the cron walks only the events updated since its start through the updatedAt index, and every event again a day after the last full walk", async (t) => {
    const T0 = Date.parse("2026-10-06T12:00:00.000Z")
    t.mock.timers.enable({ apis: ["Date"], now: T0 })
    const ctx = fixture()
    ctx.db.seed("events", {
        _id: "events:stale",
        guildId,
        gameId: "wardogs",
        updatedAt: "2026-10-01T00:00:00.000Z",
    })
    // A pre-feature row without `updatedAt`: only a full walk reaches it.
    ctx.db.seed("events", { _id: "events:legacy", guildId, gameId: "wardogs" })
    const everyEvent = ctx.db.tables.events.length
    const calls = spyReads(ctx)
    const eventReads = () =>
        calls.filter((call) => call.table === "events").map((c) => c.index)
    const state = () => ctx.db.tables.peopleIntegrationState[0]

    // No watermark yet: the first run walks every event.
    assert.deepEqual(await invoke(summaries.reconcileResultLinks, ctx), {
        processed: everyEvent,
        complete: true,
    })
    assert.deepEqual(eventReads(), [null])
    assert.equal(state().reconciliationSince, "2026-10-06T12:00:00.000Z")
    assert.equal(state().reconciliationFullWalkAt, "2026-10-06T12:00:00.000Z")
    assert.equal(state().reconciliationFull, true)

    // Fifteen minutes later one event changed: only it is walked, through
    // the index, and the watermark moves to this run's start.
    t.mock.timers.setTime(T0 + 15 * 60_000)
    await ctx.db.patch("events:stale", {
        updatedAt: "2026-10-06T12:10:00.000Z",
    })
    calls.length = 0
    assert.deepEqual(await invoke(summaries.reconcileResultLinks, ctx), {
        processed: 1,
        complete: true,
    })
    assert.deepEqual(eventReads(), ["updatedAt"])
    assert.equal(state().reconciliationSince, "2026-10-06T12:15:00.000Z")
    assert.equal(state().reconciliationFullWalkAt, "2026-10-06T12:00:00.000Z")
    assert.equal(state().reconciliationFull, false)

    // Nothing changed since: the incremental run walks nothing.
    t.mock.timers.setTime(T0 + 30 * 60_000)
    calls.length = 0
    assert.deepEqual(await invoke(summaries.reconcileResultLinks, ctx), {
        processed: 0,
        complete: true,
    })
    assert.deepEqual(eventReads(), ["updatedAt"])

    // A day after the last full walk every event is walked again, the
    // legacy row included.
    t.mock.timers.setTime(T0 + 25 * 3_600_000)
    calls.length = 0
    assert.deepEqual(await invoke(summaries.reconcileResultLinks, ctx), {
        processed: everyEvent,
        complete: true,
    })
    assert.deepEqual(eventReads(), [null])
    assert.equal(state().reconciliationFullWalkAt, "2026-10-07T13:00:00.000Z")
    assert.equal(state().reconciliationSince, "2026-10-07T13:00:00.000Z")
})

test("an interrupted run resumes in its own mode so its cursor stays valid", async (t) => {
    const T0 = Date.parse("2026-10-06T12:00:00.000Z")
    t.mock.timers.enable({ apis: ["Date"], now: T0 })
    const ctx = fixture()
    assert.deepEqual(await invoke(summaries.reconcileResultLinks, ctx), {
        processed: ctx.db.tables.events.length,
        complete: true,
    })
    // Thirty changed events: an incremental run needs two pages.
    for (let index = 0; index < 30; index++)
        ctx.db.seed("events", {
            _id: `events:changed-${index}`,
            guildId,
            gameId: "wardogs",
            updatedAt: "2026-10-06T12:05:00.000Z",
        })
    t.mock.timers.setTime(T0 + 15 * 60_000)
    const calls = spyReads(ctx)
    assert.deepEqual(await invoke(summaries.reconcileResultLinks, ctx), {
        processed: 25,
        complete: false,
    })
    const state = ctx.db.tables.peopleIntegrationState[0]
    assert.equal(state.reconciliationFull, false)
    assert.equal(state.reconciliationStartedAt, "2026-10-06T12:15:00.000Z")
    // The continuation never ran and the lease expired: the next cron call
    // finishes the same incremental walk from its cursor.
    t.mock.timers.setTime(T0 + 30 * 60_000)
    assert.deepEqual(await invoke(summaries.reconcileResultLinks, ctx), {
        processed: 5,
        complete: true,
    })
    assert.deepEqual(
        [
            ...new Set(
                calls.filter((c) => c.table === "events").map((c) => c.index)
            ),
        ],
        ["updatedAt"]
    )
    assert.equal(
        ctx.db.tables.peopleIntegrationState[0].reconciliationSince,
        "2026-10-06T12:15:00.000Z"
    )
})
