import { withIntegrationChanges } from "../../../convex/integrationMutation"
import { recordImportedResult } from "../../../convex/eventResultStore"
import type { MutationCtx } from "../../../convex/_generated/server"
import { invoke, spyReads, testContext } from "./testing/database"
import * as publicApiReads from "../../../convex/publicApiReads"
import * as links from "../../../convex/platformIdentityLinks"
import * as feed from "../../../convex/integrationChanges"
import * as results from "../../../convex/eventResults"
import assert from "node:assert/strict"
import test from "node:test"
const secret = (process.env.INTERNAL_AUTH_SECRET = "dev-internal-auth-secret")
const scores = [
    { id: "axis", label: "Axis", score: 0 },
    { id: "allied", label: "Allies", score: null },
]
const base = {
    secret,
    guildId: "guild",
    gameId: "hell_let_loose",
    eventId: "events:a",
    actorId: "staff",
}
function fixture() {
    const ctx = testContext()
    ctx.db.seed("guilds", {
        _id: "guilds:a",
        discordId: "guild",
        adminIds: ["staff"],
        adminAccessOverrides: {},
    })
    ctx.db.seed("users", {
        _id: "users:a",
        discordId: "player",
        id: "stable-player",
    })
    ctx.db.seed("events", {
        _id: "events:a",
        guildId: "guild",
        gameId: "hell_let_loose",
        kind: "match",
        name: "Fixture",
        registrationEnd: "2026-09-29T07:00:00Z",
        meetingStart: "2026-09-29T08:00:00Z",
        gameEnd: "2026-09-29T09:00:00Z",
    })
    ctx.db.seed("gameDataConnections", {
        _id: "gameDataConnections:a",
        guildId: "guild",
        gameId: "hell_let_loose",
        provider: "hll_crcon",
    })
    ctx.db.seed("gameSessions", {
        _id: "gameSessions:a",
        guildId: "guild",
        gameId: "hell_let_loose",
        connectionId: "gameDataConnections:a",
        externalId: "1",
        fetchedAt: 1,
        updatedAt: "2026-09-29T10:00:00Z",
        session: {
            externalId: "1",
            startedAt: null,
            endedAt: null,
            complete: true,
            map: "Foy",
            participants: scores,
            sourceDigest: "a".repeat(64),
            players: [
                {
                    platform: "steam",
                    platformId: "76561198000000001",
                    metrics: {},
                },
            ],
        },
    })
    ctx.db.seed("platformIdentityLinks", {
        _id: "platformIdentityLinks:a",
        platform: "steam",
        platformId: "76561198000000001",
        userRecordId: "users:a",
        discordUserId: "player",
        logiUserId: "stable-player",
        method: "steam_openid",
        verifiedAt: 1,
        revokedAt: null,
        active: true,
    })
    ctx.db.seed("apiKeys", {
        _id: "apiKeys:a",
        guildId: "guild",
        keyHash: "key",
        readAccess: {
            resources: ["result-summaries"],
            gameIds: ["hell_let_loose"],
        },
    })
    return ctx
}
const stage = (ctx: ReturnType<typeof fixture>, extra = {}) =>
    invoke(results.review, ctx, {
        ...base,
        command: {
            action: "stage",
            expectedRevision: 0,
            sessionLinks: ["gameSessions:a"],
        },
        ...extra,
    })
const confirm = (ctx: ReturnType<typeof fixture>, expectedRevision = 1) =>
    invoke(results.review, ctx, {
        ...base,
        command: { action: "confirm", expectedRevision },
    })
test("explicit session/event link freezes provisional data; confirm/correction append with CAS", async () => {
    const ctx = fixture()
    const provisional = await stage(ctx)
    assert.equal(provisional.status, "provisional")
    assert.equal(provisional.players[0].logiUserId, "stable-player")
    const confirmed = await confirm(ctx)
    assert.equal(confirmed.status, "confirmed")
    await assert.rejects(confirm(ctx), /conflict/i)
    await ctx.db.patch("gameSessions:a", {
        session: {
            ...(await ctx.db.get("gameSessions:a"))?.session,
            participants: [{ ...scores[0], score: 99 }, scores[1]],
            sourceDigest: "b".repeat(64),
        },
    })
    assert.equal(
        ctx.db.tables.eventResultRevisions.find((r) => r.version === 2)!
            .revision.participants[0].score,
        0
    )
    const corrected = await invoke(results.review, ctx, {
        ...base,
        command: {
            action: "correct",
            expectedRevision: 2,
            sessionLinks: ["gameSessions:a"],
            reason: "Reviewed provider correction",
        },
    })
    assert.equal(corrected.status, "corrected")
    assert.equal(corrected.participants[0].score, 99)
    assert.equal(ctx.db.tables.eventResultRevisions.length, 3)
})
test("confirmation rejects changed sources and reevaluates unlinked proof", async () => {
    const ctx = fixture()
    await stage(ctx)
    await invoke(links.unlink, ctx, { secret, discordUserId: "player" })
    assert.equal((await confirm(ctx)).players[0].logiUserId, null)
    const changed = fixture()
    await stage(changed)
    await changed.db.patch("gameSessions:a", {
        session: {
            ...(await changed.db.get("gameSessions:a"))?.session,
            sourceDigest: "b".repeat(64),
        },
    })
    await assert.rejects(confirm(changed), /changed/i)
})
test("cross-tenant, cross-game and revoked actor cannot stage or confirm", async () => {
    for (const patch of [
        { guildId: "other" },
        { gameId: "wardogs" },
        { actorId: "outsider" },
    ])
        await assert.rejects(stage(fixture(), patch))
    const ctx = fixture()
    await stage(ctx)
    await ctx.db.patch("guilds:a", {
        adminIds: [],
        adminAccessOverrides: { staff: false },
    })
    await assert.rejects(confirm(ctx), /Forbidden/)
    const otherSession = fixture()
    await otherSession.db.patch("gameSessions:a", { guildId: "other" })
    await assert.rejects(stage(otherSession))
})
test("reimport cannot overwrite confirmed revision or its public projection", async () => {
    const ctx = fixture()
    await stage(ctx)
    await confirm(ctx)
    await recordImportedResult(
        ctx as unknown as MutationCtx,
        "events:a" as never,
        { sideA: "A", sideB: "B", score: { sideA: 999, sideB: 0 } }
    )
    assert.equal(ctx.db.tables.eventResultRevisions.length, 2)
    assert.equal(
        (await ctx.db.get("events:a"))?.reviewedResult.participants[0].score,
        0
    )
})

test("legacy import without participant labels remains compatible without creating a review", async () => {
    const ctx = fixture()
    await recordImportedResult(
        ctx as unknown as MutationCtx,
        "events:a" as never,
        {
            sideA: "",
            sideB: "B",
            score: { sideA: 0, sideB: 0 },
        }
    )
    assert.equal(ctx.db.tables.eventResultRevisions?.length ?? 0, 0)
    assert.equal((await ctx.db.get("events:a"))?.reviewedResult, undefined)
})
test("new scoped result summaries enforce guild/game grants and exclude private review data", async () => {
    const ctx = fixture()
    await stage(ctx)
    await confirm(ctx)
    const read = {
        secret,
        keyHash: "key",
        resource: "result-summaries",
        id: "events:a",
    }
    const summary = await invoke(publicApiReads.getClanResource, ctx, read)
    assert.equal(summary.resultState, "confirmed")
    assert.equal(JSON.stringify(summary).includes("stable-player"), false)
    assert.equal(JSON.stringify(summary).includes("76561198000000001"), false)
    await ctx.db.patch("apiKeys:a", {
        readAccess: {
            resources: ["match-summaries"],
            gameIds: ["hell_let_loose"],
        },
    })
    assert.equal(await invoke(publicApiReads.getClanResource, ctx, read), null)
    await ctx.db.patch("apiKeys:a", {
        readAccess: { resources: ["result-summaries"], gameIds: ["wardogs"] },
    })
    assert.equal(await invoke(publicApiReads.getClanResource, ctx, read), null)
})

test("reviewed result participates in transactional changes, refetch and deletion tombstones", async () => {
    const ctx = fixture()
    await stage(ctx)
    await confirm(ctx)
    const query = {
        secret,
        keyHash: "key",
        gameId: "hell_let_loose",
        resource: "result-summaries",
        id: "events:a",
    }
    const refetch = await invoke(feed.readSyncRecord, ctx, query)
    assert.equal(refetch.data.resultState, "confirmed")
    assert.equal(refetch.operation, "upsert")
    assert.ok(BigInt(refetch.revision) > BigInt(0))
    const page = await invoke(publicApiReads.getClanResourcePage, ctx, {
        secret,
        keyHash: "key",
        resource: "result-summaries",
        game: "hell_let_loose",
        cursor: null,
        limit: 10,
    })
    assert.equal(page.items[0].result.participants[0].score, 0)
    assert.equal(page.items[0].result.participants[1].score, null)
    await withIntegrationChanges(
        ctx as unknown as MutationCtx,
        async (tracked) => {
            await tracked.db.delete("events:a" as never)
        }
    )
    assert.equal(await invoke(feed.readSyncRecord, ctx, query), null)
})

test("generic event reads cannot bypass the reviewed-result grant or game boundary", async () => {
    const ctx = fixture()
    await stage(ctx)
    await confirm(ctx)
    for (const gameId of ["hell_let_loose", "wardogs"]) {
        await ctx.db.patch("events:a", { gameId })
        await ctx.db.patch("apiKeys:a", {
            readAccess: { resources: ["events"], gameIds: [gameId] },
        })
        assert.equal(
            await invoke(publicApiReads.getClanResource, ctx, {
                secret,
                keyHash: "key",
                resource: "result-summaries",
                id: "events:a",
            }),
            null
        )
        const detail = await invoke(publicApiReads.getClanResource, ctx, {
            secret,
            keyHash: "key",
            resource: "events",
            id: "events:a",
        })
        const page = await invoke(publicApiReads.getClanResourcePage, ctx, {
            secret,
            keyHash: "key",
            resource: "events",
            game: gameId,
            cursor: null,
            limit: 10,
        })
        for (const event of [detail, ...page.items]) {
            assert.equal(event.id, "events:a")
            assert.equal(event.gameId, gameId)
            assert.equal("reviewedResult" in event, false)
            assert.equal("reviewedResultGameId" in event, false)
        }
    }
    await ctx.db.patch("apiKeys:a", {
        readAccess: { resources: ["result-summaries"], gameIds: ["wardogs"] },
    })
    assert.equal(
        (
            await invoke(publicApiReads.getClanResource, ctx, {
                secret,
                keyHash: "key",
                resource: "result-summaries",
                id: "events:a",
            })
        ).result,
        null
    )
    assert.equal(
        (await ctx.db.get("events:a"))?.reviewedResult.status,
        "confirmed"
    )
})

test("clan review list returns staged and reviewed heads for one clan only", async () => {
    const ctx = fixture()
    const list = (args: Record<string, unknown> = {}) =>
        invoke(results.listClanReviews, ctx, {
            secret,
            guildId: "guild",
            ...args,
        })
    assert.deepEqual(await list(), [])
    await stage(ctx)
    assert.deepEqual(await list(), [
        {
            eventId: "events:a",
            status: "provisional",
            origin: "collected",
            participants: scores,
        },
    ])
    // The list carries the head only: no players, sources or reviewers.
    assert.equal(JSON.stringify(await list()).includes("76561198"), false)
    await confirm(ctx)
    assert.equal((await list())[0].status, "confirmed")
    assert.deepEqual(await list({ guildId: "other" }), [])
    await assert.rejects(list({ secret: "wrong" }), /Unauthorized/)
})

test("clan review list skips drafts, trainings and heads of another game scope", async () => {
    const ctx = fixture()
    await stage(ctx)
    const list = () =>
        invoke(results.listClanReviews, ctx, { secret, guildId: "guild" })
    await ctx.db.patch("events:a", { isDraft: true })
    assert.deepEqual(await list(), [])
    await ctx.db.patch("events:a", { isDraft: undefined, kind: "training" })
    assert.deepEqual(await list(), [])
    await ctx.db.patch("events:a", { kind: "match", gameId: "wardogs" })
    assert.deepEqual(await list(), [])
})

test("session picker lists the latest ended games, whatever was recollected last", async () => {
    const ctx = fixture()
    const reads = spyReads(ctx)
    // Collection order and `fetchedAt` disagree with the games' own times:
    // a backfill walks newest first and a recollection stamps old games.
    for (const [id, startedAt, endedAt, fetchedAt] of [
        ["b", "2026-09-28T10:00:00.000Z", "2026-09-28T11:00:00.000Z", 9],
        ["c", "2026-09-29T12:00:00.000Z", null, 2],
        ["d", null, "2026-09-29T09:30:00.000Z", 5],
        ["e", "2026-09-29T08:00:00.000Z", "2026-09-29T09:00:00.000Z", 7],
    ] as const)
        ctx.db.seed("gameSessions", {
            _id: `gameSessions:${id}`,
            guildId: "guild",
            gameId: "hell_let_loose",
            connectionId: "gameDataConnections:a",
            externalId: id,
            fetchedAt,
            updatedAt: "2026-09-29T13:00:00Z",
            session: {
                externalId: id,
                startedAt,
                endedAt,
                complete: endedAt !== null,
                map: "Foy",
                participants: scores,
                sourceDigest: "a".repeat(64),
                players: [],
            },
        })
    const read = await invoke(results.get, ctx, base)
    assert.equal(read.sessions[0].endedAt, "2026-09-29T09:30:00.000Z")
    assert.equal(
        read.sessions.find(
            (session: { id: string }) => session.id === "gameSessions:c"
        ).endedAt,
        null
    )
    assert.deepEqual(
        read.sessions.map((session: { id: string }) => session.id),
        [
            "gameSessions:d",
            "gameSessions:e",
            "gameSessions:b",
            "gameSessions:c",
            "gameSessions:a",
        ],
        "by end time; sessions without an end time last"
    )
    assert.deepEqual(
        reads.find((call) => call.table === "gameSessions"),
        { table: "gameSessions", index: "guildId_gameId_fetchedAt" },
        "bounded by fetch time before the provider end-time sort"
    )
})
