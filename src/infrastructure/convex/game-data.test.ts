import { collectSessions } from "../../application/game-data/collect-sessions"
import { warconMatchDetail, warconServerId } from "../testing/warcon"
import * as publicApiReads from "../../../convex/publicApiReads"
import * as history from "../../../convex/gameDataHistory"
import { readWarconSession } from "../game-data/warcon"
import * as gameData from "../../../convex/gameData"
import test, { type TestContext } from "node:test"
import assert from "node:assert/strict"

type Row = { _id: string } & Record<string, unknown>
class Database {
    tables: Record<string, Row[]> = {
        apiKeys: [
            {
                _id: "key",
                keyHash: "hash",
                guildId: "guild-a",
                readAccess: {
                    resources: ["server-snapshots", "integration-health"],
                    gameIds: ["wardogs"],
                },
            },
        ],
    }
    query(table: string) {
        let indexName = ""
        const checks: Array<(row: Row) => boolean> = []
        const index = {
            eq: (key: string, value: unknown) => {
                checks.push((row) => row[key] === value)
                return index
            },
            gte: (key: string, value: number) => {
                checks.push(
                    (row) =>
                        typeof row[key] === "number" &&
                        (row[key] as number) >= value
                )
                return index
            },
            lte: (key: string, value: number) => {
                checks.push(
                    (row) =>
                        typeof row[key] === "number" &&
                        (row[key] as number) <= value
                )
                return index
            },
        }
        const rows = () =>
            (this.tables[table] ?? []).filter((row) =>
                checks.every((check) => check(row))
            )
        const query = {
            withIndex: (name: string, fn: (q: typeof index) => unknown) => {
                indexName = name
                fn(index)
                return query
            },
            unique: async () => rows()[0] ?? null,
            first: async () => rows()[0] ?? null,
            collect: async () => rows(),
            take: async (n: number) => {
                const selected = rows()
                // Convex index reads default to ascending index order, across tenants.
                if (indexName === "nextAttemptAt")
                    selected.sort(
                        (a, b) =>
                            Number(a.nextAttemptAt) - Number(b.nextAttemptAt)
                    )
                return selected.slice(0, n)
            },
            paginate: async () => ({
                page: rows(),
                continueCursor: "",
                isDone: true,
            }),
        }
        return query
    }
    async get(id: string) {
        return (
            Object.values(this.tables)
                .flat()
                .find((row) => row._id === id) ?? null
        )
    }
    normalizeId(table: string, id: string) {
        return this.tables[table]?.some((row) => row._id === id) ? id : null
    }
    async insert(table: string, value: Record<string, unknown>) {
        const id = `${table}-${(this.tables[table] ?? []).length}`
        ;(this.tables[table] ??= []).push({ _id: id, ...value })
        return id
    }
    async patch(id: string, value: Record<string, unknown>) {
        Object.assign((await this.get(id))!, value)
    }
}

test("Warcon archive survives collector disable and credential rotation, replaces corrections and rejects reused identities", async (t) => {
    const ctx = fixture(t)
    const warcon = {
        ...source,
        provider: "wardogs_warcon",
        providerServerId: warconServerId,
    }
    process.env.LOGI_GAME_DATA_SOURCES = JSON.stringify([warcon])
    const detail = warconMatchDetail()
    const session = await readWarconSession(
        warcon as Parameters<typeof readWarconSession>[0],
        "7",
        {
            get: async () => ({ status: 200, etag: null, body: detail }),
        }
    )
    const commit = async (value = session) => {
        await handler(gameData.configure)(ctx, {
            secret: "synthetic-data-secret",
            guildId: source.guildId,
            sourceRef: source.ref,
            enabled: true,
        })
        const claim = (await handler(history.claimNext)(ctx, {})) as {
            runId: string
            generation: number
            fence: number
        }
        return handler(history.commit)(ctx, {
            ...claim,
            result: {
                session: value,
                progress: { page: 1, pendingIds: [], nextPage: null },
                completed: true,
            },
        })
    }
    await commit()
    assert.equal(ctx.db.tables.serverGameHistory?.length, 1)
    const originalId = ctx.db.tables.serverGameHistory[0]._id
    assert.equal(ctx.db.tables.serverGameHistory[0].revision, "1")
    await commit()
    assert.equal(ctx.db.tables.serverGameHistory.length, 1)
    assert.equal(
        ctx.db.tables.serverGameHistory[0].revision,
        "1",
        "unchanged reads don't invent revisions"
    )
    await commit({
        ...session,
        warcon: { ...session.warcon!, winner: "Alpha" },
        sourceDigest: "f".repeat(64),
    })
    assert.equal(ctx.db.tables.serverGameHistory[0]._id, originalId)
    assert.equal(ctx.db.tables.serverGameHistory[0].revision, "2")
    await handler(gameData.configure)(ctx, {
        secret: "synthetic-data-secret",
        guildId: source.guildId,
        sourceRef: source.ref,
        enabled: false,
    })
    assert.equal(ctx.db.tables.serverGameHistory.length, 1)
    process.env.LOGI_GAME_DATA_SOURCES = JSON.stringify([
        { ...warcon, secretRef: "LOGI_GAME_DATA_ROTATED_TOKEN" },
    ])
    await commit()
    assert.equal(
        ctx.db.tables.serverGameHistory.length,
        1,
        "credential changes preserve source identity"
    )
    await assert.rejects(
        () => commit({ ...session, startedAt: "2026-10-01T11:00:00.000Z" }),
        /identity conflict/i
    )
    assert.equal(ctx.db.tables.serverGameHistory[0]._id, originalId)
    process.env.LOGI_GAME_DATA_SOURCES = JSON.stringify([
        { ...warcon, origin: "https://other-source.test" },
    ])
    await commit()
    assert.equal(
        ctx.db.tables.serverGameHistory.length,
        2,
        "a different provider origin has its own match identity"
    )
    assert.notEqual(
        ctx.db.tables.serverGameHistory[0].sourceId,
        ctx.db.tables.serverGameHistory[1].sourceId
    )
})
const source = {
    ref: "wdg",
    guildId: "guild-a",
    gameId: "wardogs",
    provider: "wardogs_rcon",
    providerServerId: "one",
    origin: "https://example.test",
    secretRef: "LOGI_GAME_DATA_WDG_TOKEN",
    allowedAddresses: [],
}
function handler(fn: unknown) {
    return (
        fn as {
            _handler: (
                ctx: unknown,
                args: Record<string, unknown>
            ) => Promise<unknown>
        }
    )._handler
}
function fixture(t: TestContext) {
    const previous = {
        catalog: process.env.LOGI_GAME_DATA_SOURCES,
        secret: process.env.INTERNAL_AUTH_SECRET,
    }
    process.env.LOGI_GAME_DATA_SOURCES = JSON.stringify([source])
    process.env.INTERNAL_AUTH_SECRET = "synthetic-data-secret"
    t.after(() => {
        for (const [key, value] of [
            ["LOGI_GAME_DATA_SOURCES", previous.catalog],
            ["INTERNAL_AUTH_SECRET", previous.secret],
        ]) {
            if (value === undefined) delete process.env[key!]
            else process.env[key!] = value
        }
    })
    return { db: new Database(), scheduler: { runAfter: async () => null } }
}

test("configuration cannot bind another tenant or accept a browser-supplied origin", async (t) => {
    const ctx = fixture(t)
    await assert.rejects(
        handler(gameData.configure)(ctx, {
            secret: "wrong",
            guildId: "guild-a",
            sourceRef: "wdg",
            enabled: true,
        }),
        /Unauthorized/
    )
    await assert.rejects(
        handler(gameData.configure)(ctx, {
            secret: "synthetic-data-secret",
            guildId: "guild-b",
            sourceRef: "wdg",
            enabled: true,
        }),
        /source/i
    )
    await handler(gameData.configure)(ctx, {
        secret: "synthetic-data-secret",
        guildId: "guild-a",
        sourceRef: "wdg",
        enabled: true,
    })
    const listed = await handler(gameData.listConnections)(ctx, {
        secret: "synthetic-data-secret",
        guildId: "guild-a",
    })
    assert.ok(JSON.stringify(listed).includes('"enabled":true'))
    assert.equal(
        JSON.stringify(listed).includes("LOGI_GAME_DATA_WDG_TOKEN"),
        false
    )
    assert.equal(JSON.stringify(listed).includes("https://example.test"), false)
})

test("atomic claim excludes a concurrent worker; disable fences the old success", async (t) => {
    const ctx = fixture(t)
    await handler(gameData.configure)(ctx, {
        secret: "synthetic-data-secret",
        guildId: "guild-a",
        sourceRef: "wdg",
        enabled: true,
    })
    const first = (await handler(gameData.claimNext)(ctx, {})) as {
        id: string
        generation: number
        fence: number
    }
    assert.ok(first)
    assert.equal(await handler(gameData.claimNext)(ctx, {}), null)
    await handler(gameData.configure)(ctx, {
        secret: "synthetic-data-secret",
        guildId: "guild-a",
        sourceRef: "wdg",
        enabled: false,
    })
    assert.equal(
        await handler(gameData.finishSnapshot)(ctx, {
            id: first.id,
            generation: first.generation,
            fence: first.fence,
            result: {
                errorCategory: null,
                nextAttemptAt: Date.now() + 60_000,
                observation: {
                    observedAt: new Date().toISOString(),
                    providerUpdatedAt: null,
                    displayName: "Fixture",
                    state: "online",
                    map: null,
                    players: 0,
                    capacity: 100,
                    providerInstanceId: null,
                    scores: [],
                    capabilities: ["server_snapshot"],
                },
            },
        }),
        false
    )
    assert.equal(ctx.db.tables.gameDataConnections[0].observation, null)
})

test("snapshot claims preserve oldest-due tenant order, poll/backoff boundaries and tick cutoff", async (t) => {
    const ctx = fixture(t)
    let now = Date.now()
    const tickStartedAt = now
    t.mock.method(Date, "now", () => now)
    const sources = [
        { ...source, ref: "a-later" },
        { ...source, ref: "b-oldest", guildId: "guild-b" },
        { ...source, ref: "a-backoff" },
        { ...source, ref: "b-long-poll", guildId: "guild-b" },
        { ...source, ref: "a-paused" },
    ]
    process.env.LOGI_GAME_DATA_SOURCES = JSON.stringify(sources)
    for (const entry of sources)
        await handler(gameData.configure)(ctx, {
            secret: "synthetic-data-secret",
            guildId: entry.guildId,
            sourceRef: entry.ref,
            enabled: true,
        })
    const rows = ctx.db.tables.gameDataConnections
    Object.assign(rows[0], { nextAttemptAt: now - 10_000 })
    Object.assign(rows[1], { nextAttemptAt: now - 30_000 })
    Object.assign(rows[2], {
        nextAttemptAt: now + 300_000,
        errorCategory: "rate_limited",
    })
    Object.assign(rows[3], { nextAttemptAt: now + 3_600_000 })
    Object.assign(rows[4], {
        nextAttemptAt: null,
        errorCategory: "unauthorized",
    })
    const first = (await handler(gameData.claimNext)(ctx, {
        tickStartedAt,
    })) as { id: string; generation: number; fence: number }
    const second = (await handler(gameData.claimNext)(ctx, {
        tickStartedAt,
    })) as typeof first
    assert.equal(
        first.id,
        rows[1]._id,
        "another tenant's older source is served first"
    )
    assert.equal(second.id, rows[0]._id)
    assert.equal(
        await handler(gameData.claimNext)(ctx, { tickStartedAt }),
        null,
        "in-flight leases and future attempts remain excluded"
    )
    await handler(gameData.finishSnapshot)(ctx, {
        ...first,
        result: { errorCategory: null, nextAttemptAt: now + 60_000 },
    })
    await handler(gameData.finishSnapshot)(ctx, {
        ...second,
        result: { errorCategory: "timeout", nextAttemptAt: now + 5_000 },
    })
    now += 10_000
    assert.equal(
        await handler(gameData.claimNext)(ctx, { tickStartedAt }),
        null,
        "a five-second retry cannot repeat within its original tick"
    )
    const retry = (await handler(gameData.claimNext)(ctx, {})) as typeof first
    assert.equal(
        retry.id,
        second.id,
        "a later tick may honor the elapsed retry delay"
    )
    assert.equal(
        await handler(gameData.claimNext)(ctx, {
            tickStartedAt: now + 86_400_000,
        }),
        null,
        "a future cutoff cannot bypass current poll/backoff or lease boundaries"
    )
    assert.equal(rows[2].nextAttemptAt, tickStartedAt + 300_000)
    assert.equal(rows[3].nextAttemptAt, tickStartedAt + 3_600_000)
    assert.equal(rows[4].nextAttemptAt, null)
})

test("snapshot storage failure leaves its claim leased for later fenced recovery", async (t) => {
    const ctx = fixture(t)
    let now = Date.now()
    t.mock.method(Date, "now", () => now)
    await handler(gameData.configure)(ctx, {
        secret: "synthetic-data-secret",
        guildId: source.guildId,
        sourceRef: source.ref,
        enabled: true,
    })
    const claim = (await handler(gameData.claimNext)(ctx, {})) as {
        id: string
        generation: number
        fence: number
    }
    const row = ctx.db.tables.gameDataConnections[0]
    const leaseUntil = row.leaseUntil
    const failure = new Error("synthetic storage failure")
    const failedPatch = t.mock.method(ctx.db, "patch", async () => {
        throw failure
    })
    await assert.rejects(
        handler(gameData.finishSnapshot)(ctx, {
            ...claim,
            result: { errorCategory: null, nextAttemptAt: Date.now() + 60_000 },
        }),
        (error) => error === failure
    )
    assert.equal(row.leaseUntil, leaseUntil)
    assert.equal(row.fence, claim.fence)
    assert.equal(await handler(gameData.claimNext)(ctx, {}), null)
    failedPatch.mock.restore()
    now = Number(leaseUntil) + 1
    const recovered = (await handler(gameData.claimNext)(
        ctx,
        {}
    )) as typeof claim
    assert.equal(recovered.id, claim.id)
    assert.equal(recovered.fence, claim.fence + 1)
    assert.equal(
        await handler(gameData.finishSnapshot)(ctx, {
            ...claim,
            result: { errorCategory: null, nextAttemptAt: now + 60_000 },
        }),
        false,
        "the failed run cannot finish after a recovery claim supersedes it"
    )
})

test("snapshot and health reads enforce key resource, game, tenant and revocation in Convex", async (t) => {
    const ctx = fixture(t)
    await handler(gameData.configure)(ctx, {
        secret: "synthetic-data-secret",
        guildId: "guild-a",
        sourceRef: "wdg",
        enabled: true,
    })
    const id = ctx.db.tables.gameDataConnections[0]._id
    const input = {
        secret: process.env.INTERNAL_AUTH_SECRET ?? "",
        keyHash: "hash",
        resource: "server-snapshots",
        game: "wardogs",
        cursor: null,
        limit: 25,
    }
    const page = (await handler(publicApiReads.getClanResourcePage)(
        ctx,
        input
    )) as {
        items: Array<Record<string, unknown>>
    }
    assert.equal(page.items.length, 1)
    assert.equal(page.items[0].players, null)
    ctx.db.tables.gameDataConnections[0].updatedAt = "2030-01-01T00:00:00.000Z"
    const tied = (await handler(publicApiReads.getClanResourcePage)(ctx, {
        ...input,
        updatedSince: "2030-01-01T00:00:00Z",
    })) as { items: unknown[] }
    assert.equal(
        tied.items.length,
        1,
        "inclusive timestamp ties compare instants, not ISO formatting"
    )
    assert.equal(
        await handler(publicApiReads.getClanResourcePage)(ctx, {
            ...input,
            game: "hell_let_loose",
        }),
        null
    )
    ctx.db.tables.apiKeys[0].readAccess = {
        resources: ["integration-health"],
        gameIds: ["wardogs"],
    }
    assert.equal(
        await handler(publicApiReads.getClanResource)(ctx, {
            secret: input.secret,
            keyHash: "hash",
            resource: "server-snapshots",
            id,
        }),
        null
    )
    ctx.db.tables.apiKeys[0].guildId = "guild-b"
    assert.equal(
        await handler(publicApiReads.getClanResource)(ctx, {
            secret: input.secret,
            keyHash: "hash",
            resource: "integration-health",
            id,
        }),
        null
    )
    ctx.db.tables.apiKeys[0].revokedAt = "2030-01-01T00:00:00Z"
    assert.equal(
        await handler(publicApiReads.getClanResourcePage)(ctx, {
            ...input,
            resource: "integration-health",
        }),
        null
    )
})

test("history upserts session and checkpoint atomically, keeps connection identities separate and fences disable", async (t) => {
    const ctx = fixture(t)
    const hll = {
        ...source,
        ref: "hll",
        gameId: "hell_let_loose",
        provider: "hll_crcon",
        providerServerId: "1",
    }
    process.env.LOGI_GAME_DATA_SOURCES = JSON.stringify([
        hll,
        { ...hll, ref: "hll-two", providerServerId: "2" },
    ])
    const configure = (ref: string, enabled: boolean) =>
        handler(gameData.configure)(ctx, {
            secret: "synthetic-data-secret",
            guildId: "guild-a",
            sourceRef: ref,
            enabled,
        })
    await configure("hll", true)
    const claim = (await handler(history.claimNext)(ctx, {})) as {
        runId: string
        generation: number
        fence: number
    }
    assert.ok(claim)
    const session = {
        externalId: "42",
        startedAt: null,
        endedAt: null,
        complete: false,
        map: null,
        participants: [],
        players: [],
        sourceDigest: "a".repeat(64),
    }
    const result = {
        session,
        progress: { page: 2, pendingIds: [], nextPage: null },
        completed: false,
    }
    const input = {
        runId: claim.runId,
        generation: claim.generation,
        fence: claim.fence,
        result,
    }
    assert.equal(await handler(history.commit)(ctx, input), true)
    assert.equal(ctx.db.tables.gameSessions.length, 1)
    assert.equal(
        (ctx.db.tables.gameDataHistoryRuns[0].progress as { page: number })
            .page,
        2
    )
    assert.equal(
        await handler(history.commit)(ctx, input),
        false,
        "same claim cannot commit twice"
    )
    await configure("hll", true)
    const again = (await handler(history.claimNext)(ctx, {})) as typeof claim
    await handler(history.commit)(ctx, {
        ...input,
        generation: again.generation,
        fence: again.fence,
    })
    assert.equal(ctx.db.tables.gameSessions.length, 1, "reimport is an upsert")
    await configure("hll", false)
    await configure("hll-two", true)
    const other = (await handler(history.claimNext)(ctx, {})) as typeof claim
    await handler(history.commit)(ctx, {
        ...input,
        runId: other.runId,
        generation: other.generation,
        fence: other.fence,
    })
    assert.equal(
        ctx.db.tables.gameSessions.length,
        2,
        "same external ID belongs to a different connection"
    )
    await configure("hll-two", true)
    const late = (await handler(history.claimNext)(ctx, {})) as typeof claim
    await configure("hll-two", false)
    assert.equal(
        await handler(history.commit)(ctx, {
            ...input,
            runId: late.runId,
            generation: late.generation,
            fence: late.fence,
        }),
        false
    )
})

test("unfinished session revisit is independent of pagination and crash recovery rewinds a page hint", async (t) => {
    const ctx = fixture(t)
    process.env.LOGI_GAME_DATA_SOURCES = JSON.stringify([
        {
            ...source,
            ref: "hll",
            gameId: "hell_let_loose",
            provider: "hll_crcon",
            providerServerId: "1",
        },
    ])
    await handler(gameData.configure)(ctx, {
        secret: "synthetic-data-secret",
        guildId: "guild-a",
        sourceRef: "hll",
        enabled: true,
    })
    const connectionId = ctx.db.tables.gameDataConnections[0]._id
    await ctx.db.insert("gameSessions", {
        connectionId,
        externalId: "old-unfinished",
        complete: false,
        fetchedAt: 0,
    })
    Object.assign(ctx.db.tables.gameDataHistoryRuns[0], {
        progress: { page: 4, pendingIds: [], nextPage: null },
        leaseUntil: 1,
    })
    const claim = (await handler(history.claimNext)(ctx, {})) as {
        revisitId: string
        progress: { page: number }
    }
    assert.equal(claim.revisitId, "old-unfinished")
    assert.equal(claim.progress.page, 3)
})

test("source changes and expired claims reject writes until a new generation is claimed", async (t) => {
    const ctx = fixture(t)
    const configure = () =>
        handler(gameData.configure)(ctx, {
            secret: "synthetic-data-secret",
            guildId: "guild-a",
            sourceRef: "wdg",
            enabled: true,
        })
    await configure()
    const original = (await handler(gameData.claimNext)(ctx, {})) as {
        id: string
        generation: number
        fence: number
    }
    const result = {
        errorCategory: "timeout",
        nextAttemptAt: Date.now() + 5000,
    }
    process.env.LOGI_GAME_DATA_SOURCES = JSON.stringify([
        { ...source, origin: "https://replacement.example.test" },
    ])
    assert.equal(
        await handler(gameData.finishSnapshot)(ctx, { ...original, result }),
        false
    )
    await configure()
    const next = (await handler(gameData.claimNext)(ctx, {})) as typeof original
    assert.ok(next.generation > original.generation)
    assert.equal(
        await handler(gameData.finishSnapshot)(ctx, { ...original, result }),
        false
    )
    ctx.db.tables.gameDataConnections[0].leaseUntil = Date.now() - 1
    assert.equal(
        await handler(gameData.finishSnapshot)(ctx, { ...next, result }),
        false
    )
    assert.equal(ctx.db.tables.gameDataConnections[0].errorCategory, null)
})

test("a collector run that changes the observation and health allocates no change revision", async (t) => {
    const ctx = fixture(t)
    await handler(gameData.configure)(ctx, {
        secret: "synthetic-data-secret",
        guildId: "guild-a",
        sourceRef: "wdg",
        enabled: true,
    })
    for (const [players, errorCategory] of [
        [10, null],
        [12, "timeout"],
    ] as const) {
        ctx.db.tables.gameDataConnections[0].nextAttemptAt = 0
        ctx.db.tables.gameDataConnections[0].leaseUntil = 0
        const claim = (await handler(gameData.claimNext)(ctx, {})) as {
            id: string
            generation: number
            fence: number
        }
        assert.ok(claim)
        assert.equal(
            await handler(gameData.finishSnapshot)(ctx, {
                ...claim,
                result: {
                    errorCategory,
                    nextAttemptAt: Date.now() + 60_000,
                    observation: {
                        observedAt: new Date().toISOString(),
                        providerUpdatedAt: null,
                        displayName: "Fixture",
                        state: "online",
                        map: null,
                        players,
                        capacity: 100,
                        providerInstanceId: null,
                        scores: [],
                        capabilities: ["server_snapshot"],
                    },
                },
            }),
            true
        )
    }
    assert.equal(
        (
            ctx.db.tables.gameDataConnections[0].observation as {
                players: number
            }
        ).players,
        12
    )
    assert.equal(ctx.db.tables.integrationHeads, undefined)
})

test("history commit records an unchanged session and its connection at most once a minute, with no feed entry", async (t) => {
    const ctx = fixture(t)
    const hll = {
        ...source,
        ref: "hll",
        gameId: "hell_let_loose",
        provider: "hll_crcon",
        providerServerId: "1",
    }
    process.env.LOGI_GAME_DATA_SOURCES = JSON.stringify([hll])
    await handler(gameData.configure)(ctx, {
        secret: "synthetic-data-secret",
        guildId: "guild-a",
        sourceRef: "hll",
        enabled: true,
    })
    const session = {
        externalId: "42",
        startedAt: null,
        endedAt: null,
        complete: false,
        map: null as string | null,
        participants: [],
        players: [],
        sourceDigest: "a".repeat(64),
    }
    const commit = async (value = session) => {
        const run = ctx.db.tables.gameDataHistoryRuns[0]
        run.nextAttemptAt = 0
        run.leaseUntil = 0
        const claim = (await handler(history.claimNext)(ctx, {})) as {
            runId: string
            generation: number
            fence: number
        }
        assert.ok(claim)
        return handler(history.commit)(ctx, {
            runId: claim.runId,
            generation: claim.generation,
            fence: claim.fence,
            result: {
                session: value,
                progress: { page: 2, pendingIds: [], nextPage: null },
                completed: false,
            },
        })
    }
    const row = () => ctx.db.tables.gameSessions[0]
    const connection = () => ctx.db.tables.gameDataConnections[0]
    assert.equal(await commit(), true)
    const written = {
        fetchedAt: row().fetchedAt,
        updatedAt: row().updatedAt,
        success: connection().historyLastSuccessAt,
    }
    assert.equal(await commit(), true)
    assert.equal(
        row().fetchedAt,
        written.fetchedAt,
        "the row was not rewritten"
    )
    assert.equal(row().updatedAt, written.updatedAt)
    assert.equal(connection().historyLastSuccessAt, written.success)
    // Wall-clock free: the stale values are set explicitly and compared, so
    // the test holds on a slow runner and within a single millisecond alike.
    const staleFetchedAt = Date.now() - 61_000
    const staleSuccess = new Date(staleFetchedAt).toISOString()
    row().fetchedAt = staleFetchedAt
    connection().historyLastSuccessAt = staleSuccess
    assert.equal(await commit(), true)
    assert.ok(
        (row().fetchedAt as number) > staleFetchedAt,
        "a visit is recorded again after a minute"
    )
    assert.equal(
        row().updatedAt,
        written.updatedAt,
        "a visit alone keeps the content stamp"
    )
    assert.notEqual(connection().historyLastSuccessAt, staleSuccess)
    assert.equal(await commit({ ...session, map: "Foy" }), true)
    assert.equal(
        (row().session as { map: string }).map,
        "Foy",
        "changed content is written"
    )
})

/** Counts the documents a handler writes, per table. */
function countWrites(ctx: { db: Database }) {
    const writes: Record<string, number> = {}
    const table = (id: string) => id.slice(0, id.lastIndexOf("-"))
    const { insert, patch } = ctx.db
    ctx.db.insert = async (name, value) => {
        writes[name] = (writes[name] ?? 0) + 1
        return insert.call(ctx.db, name, value)
    }
    ctx.db.patch = async (id, value) => {
        writes[table(id)] = (writes[table(id)] ?? 0) + 1
        return patch.call(ctx.db, id, value)
    }
    return writes
}
const hll = {
    ...source,
    ref: "hll",
    gameId: "hell_let_loose",
    provider: "hll_crcon",
    providerServerId: "1",
}
function completeSession(id: string) {
    return {
        externalId: id,
        startedAt: "2026-10-01T10:00:00.000Z",
        endedAt: "2026-10-01T11:00:00.000Z",
        complete: true,
        map: "Foy" as string | null,
        participants: [],
        players: [],
        sourceDigest: "b".repeat(64),
    }
}
type HistoryClaim = {
    runId: string
    generation: number
    fence: number
    connectionId: string
    progress: { page: number; pendingIds: string[]; nextPage: number | null }
    revisitId: string | null
    fullWalk: boolean
}
async function enableHll(ctx: ReturnType<typeof fixture>) {
    process.env.LOGI_GAME_DATA_SOURCES = JSON.stringify([hll])
    await handler(gameData.configure)(ctx, {
        secret: "synthetic-data-secret",
        guildId: "guild-a",
        sourceRef: "hll",
        enabled: true,
    })
}
/** One collector step against the Convex handlers, with a counting provider fake. */
async function historyStep(
    ctx: ReturnType<typeof fixture>,
    provider: { pages: string[][] },
    calls: { pages: number[]; sessions: string[] }
) {
    ctx.db.tables.gameDataHistoryRuns[0].nextAttemptAt = 0
    const claim = (await handler(history.claimNext)(ctx, {})) as HistoryClaim
    assert.ok(claim)
    const token = {
        runId: claim.runId,
        generation: claim.generation,
        fence: claim.fence,
    }
    const result = await collectSessions(
        claim.progress,
        {
            readPage: async (page) => {
                calls.pages.push(page)
                return {
                    ids: provider.pages[page - 1] ?? [],
                    nextPage: page < provider.pages.length ? page + 1 : null,
                }
            },
            storedComplete: async (ids) =>
                (await handler(history.storedComplete)(ctx, {
                    connectionId: claim.connectionId,
                    generation: claim.generation,
                    externalIds: ids,
                })) as string[],
            readSession: async (id) => {
                calls.sessions.push(id)
                return completeSession(id)
            },
            commit: async (value) =>
                (await handler(history.commit)(ctx, {
                    ...token,
                    result: value,
                })) as boolean,
        },
        { fullWalk: claim.fullWalk }
    )
    return { claim, result }
}
async function historyCycle(
    ctx: ReturnType<typeof fixture>,
    provider: { pages: string[][] }
) {
    const calls = { pages: [] as number[], sessions: [] as string[] }
    const modes: boolean[] = []
    for (let step = 0; step < 20; step++) {
        const { claim, result } = await historyStep(ctx, provider, calls)
        modes.push(claim.fullWalk)
        if (result === "completed") return { calls, modes }
    }
    throw new Error("The cycle did not complete.")
}

test("stored-session lookup names only complete sessions of the current source generation", async (t) => {
    const ctx = fixture(t)
    await enableHll(ctx)
    const connection = ctx.db.tables.gameDataConnections[0]
    const generation = connection.generation as number
    for (const [externalId, complete, sourceGeneration] of [
        ["45", true, generation],
        ["44", true, generation - 1],
        ["43", false, generation],
        ["42", true, undefined],
    ] as const)
        await ctx.db.insert("gameSessions", {
            connectionId: connection._id,
            externalId,
            complete,
            sourceGeneration,
            fetchedAt: 0,
        })
    await ctx.db.insert("gameSessions", {
        connectionId: "gameDataConnections-other",
        externalId: "41",
        complete: true,
        sourceGeneration: generation,
        fetchedAt: 0,
    })
    assert.deepEqual(
        await handler(history.storedComplete)(ctx, {
            connectionId: connection._id,
            generation,
            externalIds: ["45", "44", "43", "42", "41", "40", "45"],
        }),
        ["45"]
    )
    await assert.rejects(
        handler(history.storedComplete)(ctx, {
            connectionId: connection._id,
            generation,
            externalIds: Array.from({ length: 51 }, (_, i) => String(i)),
        }),
        /Too many/
    )
})

test("history walks everything once, then stops at the first stored page until the daily full walk", async (t) => {
    const ctx = fixture(t)
    await enableHll(ctx)
    const run = () => ctx.db.tables.gameDataHistoryRuns[0]
    const first = await historyCycle(ctx, { pages: [["3", "2"], ["1"]] })
    assert.deepEqual(first.modes, [true, true, true], "the first walk is full")
    assert.deepEqual(first.calls.sessions, ["3", "2", "1"])
    const walkedAt = run().lastFullWalkAt as number
    assert.ok(walkedAt > Date.now() - 1_000)
    assert.equal(ctx.db.tables.gameSessions.length, 3)

    const writes = countWrites(ctx)
    const caughtUp = await historyCycle(ctx, { pages: [["3", "2"], ["1"]] })
    assert.deepEqual(caughtUp.modes, [false])
    assert.deepEqual(
        caughtUp.calls,
        { pages: [1], sessions: [] },
        "a caught-up page reads no session"
    )
    assert.deepEqual(
        { ...writes },
        { gameDataHistoryRuns: 2 },
        "only the claim and the commit are written"
    )
    assert.equal(run().lastFullWalkAt, walkedAt)
    assert.equal((run().nextAttemptAt as number) > Date.now() + 200_000, true)

    const added = await historyCycle(ctx, {
        pages: [
            ["5", "4", "3"],
            ["2", "1"],
        ],
    })
    assert.deepEqual(added.calls, { pages: [1, 2], sessions: ["5", "4"] })
    assert.equal(ctx.db.tables.gameSessions.length, 5)
    assert.equal(writes.gameSessions, 2, "two inserts, no rewrite")

    run().lastFullWalkAt = Date.now() - 24 * 60 * 60_000 - 1
    const daily = await historyCycle(ctx, {
        pages: [
            ["5", "4", "3"],
            ["2", "1"],
        ],
    })
    assert.ok(daily.modes.every(Boolean), "a day later the cycle walks all")
    assert.deepEqual(daily.calls.sessions, ["5", "4", "3", "2", "1"])
    assert.equal(writes.gameSessions, 2, "unchanged complete rows stay put")
    assert.ok((run().lastFullWalkAt as number) > Date.now() - 1_000)
})

test("a cycle keeps its walk mode until it ends; a new source generation walks in full", async (t) => {
    const ctx = fixture(t)
    await enableHll(ctx)
    const run = () => ctx.db.tables.gameDataHistoryRuns[0]
    await historyCycle(ctx, { pages: [["2"], ["1"]] })
    const calls = { pages: [] as number[], sessions: [] as string[] }
    const provider = { pages: [["4", "3"], ["2"], ["1"]] }
    let step = await historyStep(ctx, provider, calls)
    assert.equal(step.claim.fullWalk, false)
    step = await historyStep(ctx, provider, calls)
    run().lastFullWalkAt = 0
    step = await historyStep(ctx, provider, calls)
    assert.equal(step.claim.fullWalk, false, "decided at page 1")
    assert.equal(step.result, "completed")
    assert.equal(
        run().lastFullWalkAt,
        0,
        "an incremental cycle is no full walk"
    )
    run().lastFullWalkAt = Date.now()
    await enableHll(ctx)
    assert.equal(run().lastFullWalkAt, undefined)
    const recollected = await historyCycle(ctx, provider)
    assert.ok(recollected.modes.every(Boolean))
    assert.deepEqual(recollected.calls.sessions, ["4", "3", "2", "1"])
})

test("history commit never rewrites a complete, unchanged session", async (t) => {
    const ctx = fixture(t)
    await enableHll(ctx)
    const commit = async (value = completeSession("42")) => {
        const run = ctx.db.tables.gameDataHistoryRuns[0]
        run.nextAttemptAt = 0
        run.leaseUntil = 0
        const claim = (await handler(history.claimNext)(ctx, {})) as {
            runId: string
            generation: number
            fence: number
        }
        return handler(history.commit)(ctx, {
            runId: claim.runId,
            generation: claim.generation,
            fence: claim.fence,
            result: {
                session: value,
                progress: { page: 2, pendingIds: [], nextPage: null },
                completed: false,
            },
        })
    }
    await commit()
    const row = ctx.db.tables.gameSessions[0]
    row.fetchedAt = Date.now() - 10 * 60_000
    const fetchedAt = row.fetchedAt
    const writes = countWrites(ctx)
    await commit()
    assert.equal(writes.gameSessions, undefined, "no visit stamp")
    assert.equal(row.fetchedAt, fetchedAt)
    await commit({ ...completeSession("42"), map: "Carentan" })
    assert.equal(writes.gameSessions, 1, "a change is still written")
    assert.equal((row.session as { map: string }).map, "Carentan")
})

test("Warcon history head records an unchanged game at most every ten minutes", async (t) => {
    const ctx = fixture(t)
    const warcon = {
        ...source,
        provider: "wardogs_warcon",
        providerServerId: warconServerId,
    }
    process.env.LOGI_GAME_DATA_SOURCES = JSON.stringify([warcon])
    await handler(gameData.configure)(ctx, {
        secret: "synthetic-data-secret",
        guildId: source.guildId,
        sourceRef: source.ref,
        enabled: true,
    })
    const session = await readWarconSession(
        warcon as Parameters<typeof readWarconSession>[0],
        "7",
        {
            get: async () => ({
                status: 200,
                etag: null,
                body: warconMatchDetail(),
            }),
        }
    )
    const commit = async (value = session) => {
        const run = ctx.db.tables.gameDataHistoryRuns[0]
        run.nextAttemptAt = 0
        run.leaseUntil = 0
        const claim = (await handler(history.claimNext)(ctx, {})) as {
            runId: string
            generation: number
            fence: number
        }
        return handler(history.commit)(ctx, {
            runId: claim.runId,
            generation: claim.generation,
            fence: claim.fence,
            result: {
                session: value,
                progress: { page: 1, pendingIds: [], nextPage: null },
                completed: true,
            },
        })
    }
    await commit()
    const head = ctx.db.tables.serverGameHistoryHeads[0]
    const first = { ...head }
    const writes = countWrites(ctx)
    await commit()
    assert.equal(writes.serverGameHistoryHeads, undefined, "unchanged digest")
    assert.deepEqual({ ...head }, first)
    head.lastCollectedAt = new Date(Date.now() - 11 * 60_000).toISOString()
    await commit()
    assert.equal(writes.serverGameHistoryHeads, 1, "data-as-of refreshed")
    assert.equal(head.revision, first.revision)
    assert.ok(Date.parse(head.lastCollectedAt as string) > Date.now() - 1_000)
    await commit({
        ...session,
        warcon: { ...session.warcon!, winner: "Alpha" },
        sourceDigest: "f".repeat(64),
    })
    assert.equal(writes.serverGameHistoryHeads, 2, "a new revision is written")
    assert.notEqual(head.revision, first.revision)
})
