import assert from "node:assert/strict"
import test from "node:test"

import { seedDashboardActor, actorFixture } from "./testing/dashboard-actor"
import { isApiKeyReadAccess } from "../../../src/domain/api/key-access"
import * as publicApiReads from "../../../convex/publicApiReads"
import * as apiKeyAuth from "../../../convex/apiKeyAuth"
import * as publicApi from "../../../convex/publicApi"

process.env.INTERNAL_AUTH_SECRET = "dev-internal-auth-secret"

type Document = Record<string, unknown> & { _id: string }
const readAccess = {
    resources: ["events", "rosters", "matches"],
    gameIds: ["wardogs"],
}

/** Isolated persistence fixture; production Convex handlers enforce the policy. */
class Database {
    writes = 0
    tables: Record<string, Document[]> = {
        apiKeys: [
            { _id: "key", guildId: "guild-a", keyHash: "hash", readAccess },
        ],
        guilds: [
            { _id: "guild-record", discordId: "guild-a", name: "Fixture" },
        ],
        events: [
            this.event("hll", "guild-a"),
            this.event("wardogs", "guild-a", "wardogs"),
            this.event("other", "guild-b", "wardogs"),
        ],
        rosters: [
            {
                _id: "roster",
                guildId: "guild-a",
                eventId: "wardogs",
                squads: [],
                reservePlayerIds: [],
            },
        ],
        matchStats: [
            {
                _id: "match",
                guildId: "guild-a",
                eventId: "wardogs",
                gameId: "wardogs",
                matchId: "opaque-session",
                raw: {},
            },
        ],
        apiIdempotencyKeys: [
            {
                _id: "cached",
                guildId: "guild-a",
                key: "replay",
                methodPath: "cached-path",
                bodyHash: "body",
                status: 200,
                responseBody: "cached write response",
                expiresAt: Number.MAX_SAFE_INTEGER,
            },
        ],
    }
    private event(id: string, guildId: string, gameId?: string): Document {
        return {
            _id: id,
            guildId,
            gameId,
            name: id,
            registrationEnd: "2030-01-01T00:00:00.000Z",
            meetingStart: "2030-01-01T01:00:00.000Z",
            gameEnd: "2030-01-01T02:00:00.000Z",
        }
    }
    query(table: string) {
        const predicates: Array<(doc: Document) => boolean> = []
        const index = {
            eq: (field: string, value: unknown) => {
                predicates.push((doc) => doc[field] === value)
                return index
            },
        }
        const rows = () =>
            (this.tables[table] ?? []).filter((doc) =>
                predicates.every((predicate) => predicate(doc))
            )
        const filter = {
            field: (field: string) => field,
            eq: (field: string, value: unknown) => (doc: Document) =>
                doc[field] === value,
            gte: (field: string, value: string) => (doc: Document) =>
                typeof doc[field] === "string" && doc[field] >= value,
        }
        const query = {
            withIndex: (
                _name: string,
                select: (q: typeof index) => unknown
            ) => {
                select(index)
                return query
            },
            filter: (
                select: (q: typeof filter) => (doc: Document) => boolean
            ) => {
                predicates.push(select(filter))
                return query
            },
            unique: async () => rows()[0] ?? null,
            first: async () => rows()[0] ?? null,
            collect: async () => rows(),
            paginate: async ({
                cursor,
                numItems,
            }: {
                cursor: string | null
                numItems: number
            }) => {
                const offset = Number(cursor ?? 0)
                const page = rows().slice(offset, offset + numItems)
                return {
                    page,
                    isDone: offset + page.length >= rows().length,
                    continueCursor: String(offset + page.length),
                }
            },
        }
        return query
    }
    async get(id: string) {
        return (
            Object.values(this.tables)
                .flat()
                .find((doc) => doc._id === id) ?? null
        )
    }
    normalizeId(table: string, id: string) {
        return this.tables[table]?.some((doc) => doc._id === id) ? id : null
    }
    async patch(id: string, value: Record<string, unknown>) {
        this.writes++
        Object.assign((await this.get(id))!, value)
    }
    async insert(table: string, value: Record<string, unknown>) {
        this.writes++
        const id = `${table}-new`
        ;(this.tables[table] ??= []).push({ _id: id, ...value })
        return id
    }
    async delete(id: string) {
        this.writes++
        for (const [table, rows] of Object.entries(this.tables))
            this.tables[table] = rows.filter((doc) => doc._id !== id)
    }
}

function summaryDatabase() {
    const db = new Database()
    db.tables.apiKeys[0].readAccess = {
        resources: ["event-summaries", "match-summaries"],
        gameIds: ["wardogs"],
    }
    Object.assign(db.tables.events[1], {
        kind: "match",
        status: "concluded",
        gameStart: "2030-01-01T01:15:00.000Z",
        updatedAt: "2026-09-28T10:00:00.000Z",
        serverPassword: "PRIVATE",
        description: "Private tactics",
        notes: "Private notes",
        signUps: [{ userId: "private-user" }],
        participants: [{ userId: "private-user", status: "attending" }],
        futurePrivateField: "Never automatically expose a new persisted field",
    })
    return db
}

test("summary-only credentials can be provisioned without granting raw records or writes", async () => {
    const db = summaryDatabase()
    await assert.doesNotReject(
        invoke(publicApi.createKey, db, {
            guildId: "guild-a",
            name: "Summary reader",
            keyPrefix: "fixture",
            readAccess: db.tables.apiKeys[0].readAccess,
        })
    )
    for (const resource of ["events", "matches", "users", "assignments"]) {
        assert.equal(
            await invoke(publicApiReads.getClanResourcePage, db, {
                resource,
                game: "wardogs",
                limit: 25,
                cursor: null,
            }),
            null
        )
    }
    const denied = (await invoke(publicApi.mutateClanEvent, db, {
        idempotencyKey: "replay",
        methodPath: "cached-path",
        bodyHash: "body",
    })) as { status: number }
    assert.equal(denied.status, 403)
})

test("each summary resource requires its own grant, independent of raw resource grants", async () => {
    const db = summaryDatabase()
    for (const granted of [
        "events",
        "matches",
        "event-summaries",
        "match-summaries",
    ]) {
        db.tables.apiKeys[0].readAccess = {
            resources: [granted],
            gameIds: ["wardogs"],
        }
        for (const resource of ["event-summaries", "match-summaries"]) {
            const page = await invoke(publicApiReads.getClanResourcePage, db, {
                resource,
                game: "wardogs",
                limit: 25,
                cursor: null,
            })
            const detail = await invoke(publicApiReads.getClanResource, db, {
                resource,
                id: "wardogs",
            })
            if (granted === resource) {
                assert.ok(page)
                assert.ok(detail)
            } else {
                assert.equal(page, null)
                assert.equal(detail, null)
            }
        }
    }
})

test("event summary pages preserve empty cursors and return only allowlisted fields", async () => {
    const db = summaryDatabase()
    const args = {
        resource: "event-summaries",
        game: "wardogs",
        limit: 1,
        cursor: null,
    }
    const first = (await invoke(
        publicApiReads.getClanResourcePage,
        db,
        args
    )) as {
        items: unknown[]
        nextCursor: string
    }
    assert.deepEqual(first, { items: [], nextCursor: "1", limit: 1 })
    const second = await invoke(publicApiReads.getClanResourcePage, db, {
        ...args,
        cursor: first.nextCursor,
    })
    assert.deepEqual(second, {
        items: [
            {
                id: "wardogs",
                guildId: "guild-a",
                gameId: "wardogs",
                title: "wardogs",
                kind: "match",
                status: "concluded",
                startsAt: "2030-01-01T01:15:00.000Z",
                endsAt: "2030-01-01T02:00:00.000Z",
                updatedAt: "2026-09-28T10:00:00.000Z",
                matchTeams: null,
            },
        ],
        nextCursor: null,
        limit: 1,
    })
})

test("summary detail checks tenant, game, document type and current revocation", async () => {
    const db = summaryDatabase()
    for (const id of ["hll", "other", "roster", "match", "missing"]) {
        assert.equal(
            await invoke(publicApiReads.getClanResource, db, {
                resource: "event-summaries",
                id,
            }),
            null
        )
    }
    const result = (await invoke(publicApiReads.getClanResource, db, {
        resource: "event-summaries",
        id: "wardogs",
    })) as Record<string, unknown>
    assert.ok(result, "a granted event summary must be returned")
    assert.equal(result.id, "wardogs")
    assert.equal("serverPassword" in result, false)
    assert.ok(await invoke(apiKeyAuth.authenticateKey, db))
    await invoke(publicApi.revokeKey, db, { guildId: "guild-a", keyId: "key" })
    assert.equal(
        await invoke(publicApiReads.getClanResource, db, {
            resource: "event-summaries",
            id: "wardogs",
        }),
        null
    )
})

test("summary incremental pages include timestamp ties and retain tenant/game filters", async () => {
    const db = summaryDatabase()
    db.tables.events.push({ ...db.tables.events[1], _id: "tied" })
    const args = {
        resource: "event-summaries",
        game: "wardogs",
        updatedSince: "2026-09-28T10:00:00.000Z",
        limit: 1,
        cursor: null,
    }
    const first = (await invoke(
        publicApiReads.getClanResourcePage,
        db,
        args
    )) as {
        items: Array<{ id: string }>
        nextCursor: string
    }
    assert.ok(first, "a granted incremental summary page must be returned")
    assert.deepEqual(
        first.items.map((item) => item.id),
        ["wardogs"]
    )
    const second = (await invoke(publicApiReads.getClanResourcePage, db, {
        ...args,
        cursor: first.nextCursor,
    })) as { items: Array<{ id: string }>; nextCursor: null }
    assert.deepEqual(
        second.items.map((item) => item.id),
        ["tied"]
    )
    assert.equal(second.nextCursor, null)
})

test("match summaries preserve unknown results despite raw telemetry and concluded status", async () => {
    const db = summaryDatabase()
    assert.deepEqual(
        await invoke(publicApiReads.getClanResource, db, {
            resource: "match-summaries",
            id: "wardogs",
        }),
        {
            id: "wardogs",
            eventId: "wardogs",
            guildId: "guild-a",
            gameId: "wardogs",
            title: "wardogs",
            updatedAt: "2026-09-28T10:00:00.000Z",
            resultState: "unknown",
            result: null,
            matchTeams: null,
        }
    )
})

test("match summaries expose imported scores as provisional without source URLs or player data", async () => {
    const db = summaryDatabase()
    db.tables.events[1].eventResult = {
        sourceUrl: "https://private.example.invalid/import?credential=private",
        mapId: "fixture-map",
        mapName: "Fixture map",
        sideA: "Allies",
        sideB: "Axis",
        score: { sideA: 0, sideB: 5 },
        outcome: "defeat",
        importedAt: "2026-09-28T09:59:00.000Z",
        privateFutureResult: "not for the API",
    }
    assert.deepEqual(
        await invoke(publicApiReads.getClanResource, db, {
            resource: "match-summaries",
            id: "wardogs",
        }),
        {
            id: "wardogs",
            eventId: "wardogs",
            guildId: "guild-a",
            gameId: "wardogs",
            title: "wardogs",
            updatedAt: "2026-09-28T10:00:00.000Z",
            resultState: "provisional",
            result: {
                mapId: "fixture-map",
                mapName: "Fixture map",
                sideA: "Allies",
                sideB: "Axis",
                score: { sideA: 0, sideB: 5 },
                outcome: "defeat",
                endedAt: null,
                provenance: {
                    type: "event_result_import",
                    importedAt: "2026-09-28T09:59:00.000Z",
                },
            },
            matchTeams: null,
        }
    )
})

test("match summary pages skip training events without losing continuation", async () => {
    const db = summaryDatabase()
    db.tables.events[1].kind = "training"
    db.tables.events.push({
        ...db.tables.events[1],
        _id: "later-match",
        kind: "match",
    })
    assert.equal(
        await invoke(publicApiReads.getClanResource, db, {
            resource: "match-summaries",
            id: "wardogs",
        }),
        null
    )
    const page = (await invoke(publicApiReads.getClanResourcePage, db, {
        resource: "match-summaries",
        game: "wardogs",
        limit: 2,
        cursor: null,
    })) as { items: unknown[]; nextCursor: string }
    assert.ok(page, "a filtered match summary page must retain its cursor")
    assert.deepEqual(page.items, [])
    assert.equal(page.nextCursor, "2")
    const next = (await invoke(publicApiReads.getClanResourcePage, db, {
        resource: "match-summaries",
        game: "wardogs",
        limit: 2,
        cursor: page.nextCursor,
    })) as { items: Array<{ id: string }> }
    assert.deepEqual(
        next.items.map((item) => item.id),
        ["later-match"]
    )
})

function invoke(
    value: unknown,
    db: Database,
    args: Record<string, unknown> = {}
) {
    const management = [
        publicApi.createKey,
        publicApiReads.listKeys,
        publicApi.revokeKey,
    ].includes(value as never)
    if (management && !db.tables.dashboardSessions) seedDashboardActor(db)
    return (
        value as {
            _handler: (
                ctx: { db: Database },
                args: Record<string, unknown>
            ) => Promise<unknown>
        }
    )._handler(
        { db },
        {
            secret: "dev-internal-auth-secret",
            keyHash: "hash",
            ...(management ? { actor: actorFixture } : {}),
            ...args,
        }
    )
}

test("key creation persists read access and listing/authentication expose policy without hashes", async () => {
    const db = new Database()
    await invoke(publicApi.createKey, db, {
        guildId: "guild-a",
        name: "Reader",
        keyPrefix: "logi_fixture",
        readAccess,
    })
    assert.deepEqual(db.tables.apiKeys.at(-1)?.readAccess, readAccess)
    const keys = (await invoke(publicApiReads.listKeys, db, {
        guildId: "guild-a",
    })) as Array<Record<string, unknown>>
    assert.deepEqual(keys[0].readAccess, readAccess)
    assert.equal("keyHash" in keys[0], false)
    assert.deepEqual(await invoke(apiKeyAuth.authenticateKey, db), {
        guildId: "guild-a",
        lastUsedAt: null,
        readAccess,
    })
})

test("key access validation rejects empty, duplicate, and unsupported permissions", () => {
    for (const access of [
        { resources: [], gameIds: ["wardogs"] },
        { resources: ["events"], gameIds: [] },
        { resources: ["settings"], gameIds: ["wardogs"] },
        { resources: ["events"], gameIds: ["all"] },
        { resources: ["events", "events"], gameIds: ["wardogs"] },
        { resources: ["events"], gameIds: ["wardogs", "wardogs"] },
    ]) {
        assert.equal(isApiKeyReadAccess(access), false)
    }
})

test("legacy keys retain cross-game reads and completed write replay", async () => {
    const db = new Database()
    delete db.tables.apiKeys[0].readAccess
    assert.deepEqual(await invoke(apiKeyAuth.authenticateKey, db), {
        guildId: "guild-a",
        lastUsedAt: null,
    })
    const page = (await invoke(publicApiReads.getClanResourcePage, db, {
        resource: "events",
        game: "all",
        limit: 25,
        cursor: null,
    })) as { items: Array<{ id: string }> }
    assert.deepEqual(
        page.items.map((item) => item.id),
        ["hll", "wardogs"]
    )
    assert.deepEqual(
        await invoke(publicApi.mutateClanEvent, db, {
            idempotencyKey: "replay",
            methodPath: "cached-path",
            bodyHash: "body",
        }),
        { status: 200, body: "cached write response" }
    )
})

test("present malformed policies fail closed and legacy HLL records require an HLL grant", async () => {
    const db = new Database()
    for (const policy of [null, {}, { resources: ["events"], gameIds: [] }]) {
        db.tables.apiKeys[0].readAccess = policy
        assert.equal(
            await invoke(publicApiReads.getClanResource, db, {
                resource: "events",
                id: "hll",
            }),
            null
        )
        const result = (await invoke(publicApi.mutateClanEvent, db, {
            idempotencyKey: "replay",
            methodPath: "cached-path",
            bodyHash: "body",
        })) as { status: number }
        assert.equal(result.status, 403)
    }
    db.tables.apiKeys[0].readAccess = {
        resources: ["events"],
        gameIds: ["hell_let_loose"],
    }
    const result = (await invoke(publicApiReads.getClanResource, db, {
        resource: "events",
        id: "hll",
    })) as { gameId: string }
    assert.equal(result.gameId, "hell_let_loose")
    assert.equal(
        await invoke(publicApiReads.getClanResource, db, {
            resource: "events",
            id: "wardogs",
        }),
        null
    )
    db.tables.events[0].gameId = null
    assert.equal(
        await invoke(publicApiReads.getClanResource, db, {
            resource: "events",
            id: "hll",
        }),
        null
    )
})

for (const [name, mutation] of Object.entries({
    article: publicApi.mutateClanArticle,
    event: publicApi.mutateClanEvent,
    signup: publicApi.mutateClanEventSignup,
    group: publicApi.mutateClanGroup,
    preset: publicApi.mutateClanPreset,
    roster: publicApi.mutateClanRoster,
    assignment: publicApi.mutateClanAssignment,
    calendar: publicApi.mutateClanCalendarItem,
    settings: publicApi.mutateClanSettings,
})) {
    test(`read-only key denies ${name} writes before idempotent replay or side effects`, async () => {
        const db = new Database()
        const result = (await invoke(mutation, db, {
            idempotencyKey: "replay",
            methodPath: "cached-path",
            bodyHash: "body",
        })) as { status: number; body: string }
        assert.equal(result.status, 403)
        assert.equal(JSON.parse(result.body).error.code, "insufficient_scope")
        assert.equal(db.writes, 0)
    })
}

test("resource and game scopes are enforced by direct backend page calls", async () => {
    for (const [resource, game] of [
        ["events", "hell_let_loose"],
        ["groups", "wardogs"],
        ["events", "all"],
        ["events", ["wardogs", "hell_let_loose"]],
    ]) {
        assert.equal(
            await invoke(publicApiReads.getClanResourcePage, new Database(), {
                resource,
                game,
                limit: 25,
                cursor: null,
            }),
            null
        )
    }
})

test("explicit Wardogs pages continue across empty HLL pages and isolate tenants", async () => {
    const db = new Database()
    const page = { resource: "events", game: "wardogs", limit: 1, cursor: null }
    const first = (await invoke(
        publicApiReads.getClanResourcePage,
        db,
        page
    )) as {
        items: unknown[]
        nextCursor: string
    }
    assert.deepEqual(first.items, [])
    assert.equal(first.nextCursor, "1")
    const second = (await invoke(publicApiReads.getClanResourcePage, db, {
        ...page,
        cursor: first.nextCursor,
    })) as { items: Array<{ id: string }>; nextCursor: string | null }
    assert.deepEqual(
        second.items.map((item) => item.id),
        ["wardogs"]
    )
    assert.equal(second.nextCursor, null)
})

test("detail lookups deny another game, tenant and ungranted resources", async () => {
    const db = new Database()
    for (const [resource, id] of [
        ["events", "hll"],
        ["events", "other"],
        ["groups", "wardogs"],
    ]) {
        assert.equal(
            await invoke(publicApiReads.getClanResource, db, { resource, id }),
            null
        )
    }
    const result = (await invoke(publicApiReads.getClanResource, db, {
        resource: "events",
        id: "wardogs",
    })) as { id: string }
    assert.equal(result.id, "wardogs")
})

test("roster detail scope is derived from its parent even with a direct guild field", async () => {
    const db = new Database()
    const result = (await invoke(publicApiReads.getClanResource, db, {
        resource: "rosters",
        id: "roster",
    })) as { gameId: string }
    assert.equal(result.gameId, "wardogs")
    db.tables.events.find((event) => event._id === "wardogs")!.gameId =
        "hell_let_loose"
    assert.equal(
        await invoke(publicApiReads.getClanResource, db, {
            resource: "rosters",
            id: "roster",
        }),
        null
    )
})

test("match lookups check both event and match ownership/game", async () => {
    const db = new Database()
    assert.ok(
        await invoke(publicApiReads.getClanMatchByEvent, db, {
            eventId: "wardogs",
        })
    )
    db.tables.matchStats[0].guildId = "guild-b"
    assert.equal(
        await invoke(publicApiReads.getClanMatchByEvent, db, {
            eventId: "wardogs",
        }),
        null
    )
    db.tables.matchStats[0].guildId = "guild-a"
    db.tables.matchStats[0].gameId = "hell_let_loose"
    assert.equal(
        await invoke(publicApiReads.getClanMatchByEvent, db, {
            eventId: "wardogs",
        }),
        null
    )
})

test("scoped readers cannot use guild-wide metadata, settings, users or performance routes", async () => {
    for (const query of [
        publicApiReads.getClanMeta,
        publicApiReads.getClanSettings,
        publicApiReads.getClanUser,
        publicApiReads.getClanPerformanceHistory,
    ]) {
        assert.equal(
            await invoke(query, new Database(), {
                userId: "member",
                game: "wardogs",
            }),
            null
        )
    }
})

test("revocation is tenant-bound and blocks a resource read after prior authentication", async () => {
    const db = new Database()
    seedDashboardActor(db)
    db.tables.guilds.push({
        _id: "guild-b-record",
        discordId: "guild-b",
        adminIds: [actorFixture.subject],
    })
    assert.ok(await invoke(apiKeyAuth.authenticateKey, db))
    await assert.rejects(
        invoke(publicApi.revokeKey, db, { guildId: "guild-b", keyId: "key" }),
        /not found/i
    )
    await invoke(publicApi.revokeKey, db, { guildId: "guild-a", keyId: "key" })
    assert.equal(await invoke(apiKeyAuth.authenticateKey, db), null)
    assert.equal(
        await invoke(publicApiReads.getClanResourcePage, db, {
            resource: "events",
            game: "wardogs",
            limit: 25,
            cursor: null,
        }),
        null
    )
})

test("authentication never writes; a key's use is recorded once per interval", async () => {
    const db = new Database()
    assert.ok(await invoke(apiKeyAuth.authenticateKey, db))
    assert.equal(db.writes, 0)
    assert.equal(await invoke(apiKeyAuth.recordKeyUse, db), true)
    assert.equal(db.writes, 1)
    assert.equal(typeof db.tables.apiKeys[0].lastUsedAt, "string")
    assert.equal(await invoke(apiKeyAuth.recordKeyUse, db), false)
    assert.equal(db.writes, 1)
    await invoke(publicApi.revokeKey, db, { guildId: "guild-a", keyId: "key" })
    assert.equal(await invoke(apiKeyAuth.recordKeyUse, db), false)
})
