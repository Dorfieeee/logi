import {
    archiveProviderHistory,
    readHistoryRecord,
} from "../../../convex/gameHistoryStore"
import type { MutationCtx, QueryCtx } from "../../../convex/_generated/server"
import { hllHistoryRecord, historyRecord } from "../testing/game-history"
import { readSyncRecord } from "../../../convex/integrationChanges"
import type { Doc } from "../../../convex/_generated/dataModel"
import { hllPage } from "../../../convex/gameHistoryBackfill"
import { invoke, testContext } from "./testing/database"
import assert from "node:assert/strict"
import test from "node:test"

function fixture(count = 12) {
    const ctx = testContext()
    const source = {
        ref: "hll",
        guildId: "guild-a",
        gameId: "hell_let_loose",
        provider: "hll_crcon",
        providerServerId: "1",
        origin: "https://crcon.example.test",
        secretRef: null,
    }
    ctx.db.seed("gameDataConnections", {
        _id: "gameDataConnections:hll",
        ...source,
        enabled: true,
        generation: 3,
        sourceFingerprint: JSON.stringify(source),
    })
    ctx.db.seed("serverGameHistoryHeads", {
        _id: "serverGameHistoryHeads:legacy",
        guildId: "guild-a",
        revision: "70",
        lastCollectedAt: "2026-10-03T12:00:00Z",
    })
    for (let index = 0; index < count; index++) {
        const session = hllHistoryRecord().session
        session.externalId = String(index + 1)
        ctx.db.seed("gameSessions", {
            _id: `gameSessions:${index}`,
            connectionId: "gameDataConnections:hll",
            guildId: "guild-a",
            gameId: "hell_let_loose",
            externalId: session.externalId,
            session,
            complete: true,
            sourceGeneration: 3,
            fetchedAt: index,
            updatedAt: "2026-10-03T12:00:00Z",
        })
    }
    return ctx
}

test("HLL retained backfill is dry by default, bounded, resumable and idempotent with independent revisions", async () => {
    const ctx = fixture()
    const first = await invoke(hllPage, ctx, {
        guildId: "guild-a",
        cursor: null,
    })
    assert.deepEqual(first, {
        scanned: 10,
        eligible: 10,
        archived: 0,
        skipped: 0,
        nextCursor: "10",
    })
    assert.equal(
        Object.keys(ctx.db.tables).includes("serverGameHistory"),
        false
    )
    const applied = await invoke(hllPage, ctx, {
        guildId: "guild-a",
        cursor: null,
        apply: true,
    })
    assert.equal(applied.archived, 10)
    const final = await invoke(hllPage, ctx, {
        guildId: "guild-a",
        cursor: applied.nextCursor,
        apply: true,
    })
    assert.deepEqual(final, {
        scanned: 2,
        eligible: 2,
        archived: 2,
        skipped: 0,
        nextCursor: null,
    })
    assert.equal(ctx.db.tables.serverGameHistory.length, 12)
    assert.equal(ctx.db.tables.serverGameHistoryHeads[0].revision, "70")
    assert.equal(
        ctx.db.tables.serverGameHistoryHeads.find(
            (row) => row.gameId === "hell_let_loose"
        )!.revision,
        "12"
    )
    await invoke(hllPage, ctx, {
        guildId: "guild-a",
        cursor: null,
        apply: true,
    })
    assert.equal(ctx.db.tables.serverGameHistory.length, 12)
    assert.equal(ctx.db.tables.serverGameHistoryHeads[1].revision, "12")
    const id = ctx.db.tables.serverGameHistory[0]._id
    assert.equal(
        await readHistoryRecord(
            ctx as unknown as QueryCtx,
            "guild-a",
            id,
            "wardogs"
        ),
        null
    )
    assert.equal(
        (await readHistoryRecord(
            ctx as unknown as QueryCtx,
            "guild-a",
            id,
            "hell_let_loose"
        ))!.provider,
        "hll_crcon"
    )
    assert.equal(
        await readHistoryRecord(
            ctx as unknown as QueryCtx,
            "another-guild",
            id,
            "hell_let_loose"
        ),
        null
    )
})

test("HLL backfill fences source generations, malformed sessions, foreign connections and other games", async () => {
    const ctx = fixture(7),
        rows = ctx.db.tables.gameSessions
    rows[0].sourceGeneration = 2
    delete rows[1].sourceGeneration
    rows[2].complete = false
    rows[3].session.startedAt = null
    rows[4].externalId = "different"
    rows[5].connectionId = "gameDataConnections:foreign"
    ctx.db.seed("gameDataConnections", {
        ...ctx.db.tables.gameDataConnections[0],
        _id: "gameDataConnections:foreign",
        guildId: "another-guild",
    })
    ctx.db.seed("gameSessions", {
        ...rows[6],
        _id: "gameSessions:wdg",
        gameId: "wardogs",
        session: historyRecord().session,
    })
    ctx.db.seed("gameSessions", {
        ...rows[6],
        _id: "gameSessions:foreign",
        guildId: "another-guild",
    })
    const result = await invoke(hllPage, ctx, {
        guildId: "guild-a",
        cursor: null,
        apply: true,
    })
    assert.deepEqual(result, {
        scanned: 7,
        eligible: 1,
        archived: 1,
        skipped: 6,
        nextCursor: null,
    })
    assert.equal(ctx.db.tables.serverGameHistory.length, 1)
    assert.equal(ctx.db.tables.serverGameHistory[0].externalId, "7")
    assert.equal(ctx.scheduler.calls.length, 0)
})

test("backfill source/start identity conflicts abort the page without replacing retained facts", async () => {
    const ctx = fixture(1)
    const row = ctx.db.tables.gameDataConnections[0]
    const source = JSON.parse(row.sourceFingerprint)
    row.sourceFingerprint = JSON.stringify({ ...source, providerServerId: "2" })
    await assert.rejects(
        invoke(hllPage, ctx, { guildId: "guild-a", cursor: null }),
        /source identity conflict/
    )
    ctx.db.tables.gameDataConnections[0].sourceFingerprint =
        JSON.stringify(source)
    await invoke(hllPage, ctx, {
        guildId: "guild-a",
        cursor: null,
        apply: true,
    })
    const before = structuredClone(ctx.db.tables.serverGameHistory)
    ctx.db.tables.gameSessions[0].session.startedAt = "2026-10-02T10:00:00Z"
    await assert.rejects(
        invoke(hllPage, ctx, { guildId: "guild-a", cursor: null, apply: true }),
        /match identity conflict/
    )
    assert.deepEqual(ctx.db.tables.serverGameHistory, before)
})

test("collector archival pairs game/provider and retains HLL facts independently of subsequent source disable", async () => {
    const ctx = fixture(0),
        connection = ctx.db.tables
            .gameDataConnections[0] as unknown as Doc<"gameDataConnections">
    const session = hllHistoryRecord().session
    const id = await archiveProviderHistory(
        ctx as unknown as MutationCtx,
        connection,
        session
    )
    assert.ok(id)
    connection.enabled = false
    const retained = await readHistoryRecord(
        ctx as unknown as QueryCtx,
        "guild-a",
        String(id),
        "hell_let_loose"
    )
    assert.deepEqual(retained!.session, session)
    assert.equal(retained!.session.warcon, undefined)
    assert.equal(retained!.session.players[0].result, undefined)
    await assert.rejects(
        archiveProviderHistory(
            ctx as unknown as MutationCtx,
            { ...connection, gameId: "wardogs" },
            session
        ),
        /game identity conflict/
    )
    await assert.rejects(
        archiveProviderHistory(
            ctx as unknown as MutationCtx,
            connection,
            historyRecord().session
        ),
        /Invalid retained provider/
    )
    assert.equal(
        await archiveProviderHistory(
            ctx as unknown as MutationCtx,
            connection,
            { ...session, complete: false }
        ),
        undefined
    )
    assert.equal(ctx.db.tables.serverGameHistory.length, 1)
    const undated = { ...session, startedAt: null }
    assert.equal(
        await archiveProviderHistory(
            ctx as unknown as MutationCtx,
            connection,
            undated
        ),
        undefined
    )
    await assert.rejects(
        archiveProviderHistory(ctx as unknown as MutationCtx, connection, {
            ...undated,
            warcon: historyRecord().session.warcon,
        }),
        /Invalid retained provider/
    )
    await assert.rejects(
        archiveProviderHistory(
            ctx as unknown as MutationCtx,
            {
                ...connection,
                sourceFingerprint: JSON.stringify({ ref: "foreign" }),
            },
            undated
        ),
        /source identity conflict/
    )
})

test("HLL backfill and normal collection never resurrect games outside the HLL retention window", async (t) => {
    t.mock.method(Date, "now", () => Date.parse("2026-10-04T12:00:00Z"))
    const ctx = fixture(1)
    ctx.db.tables.gameSessions[0].session.startedAt = "2026-01-01T10:00:00Z"
    ctx.db.tables.gameSessions[0].session.endedAt = "2026-01-01T11:00:00Z"
    // The Wardogs window cannot suppress HLL retained facts.
    ctx.db.seed("gameHistorySettings", {
        _id: "gameHistorySettings:legacy",
        guildId: "guild-a",
        retentionDays: 90,
    })
    assert.equal(
        (await invoke(hllPage, ctx, { guildId: "guild-a", cursor: null }))
            .eligible,
        1
    )
    ctx.db.seed("gameHistorySettings", {
        _id: "gameHistorySettings:hll",
        guildId: "guild-a",
        gameId: "hell_let_loose",
        retentionDays: 90,
    })
    assert.deepEqual(
        await invoke(hllPage, ctx, {
            guildId: "guild-a",
            cursor: null,
            apply: true,
        }),
        { scanned: 1, eligible: 0, archived: 0, skipped: 1, nextCursor: null }
    )
    assert.equal(
        await archiveProviderHistory(
            ctx as unknown as MutationCtx,
            ctx.db.tables
                .gameDataConnections[0] as unknown as Doc<"gameDataConnections">,
            ctx.db.tables.gameSessions[0].session
        ),
        undefined
    )
    assert.equal(ctx.db.tables.serverGameHistory, undefined)
    assert.equal(ctx.db.tables.serverGameHistoryHeads.length, 1)
})

test("backfill preserves stored observation freshness and sync-records never crosses game grants", async (t) => {
    const prior = process.env.INTERNAL_AUTH_SECRET
    process.env.INTERNAL_AUTH_SECRET = "synthetic-history-secret"
    t.after(() => {
        if (prior === undefined) delete process.env.INTERNAL_AUTH_SECRET
        else process.env.INTERNAL_AUTH_SECRET = prior
    })
    const ctx = fixture(2),
        seenAt = Date.parse("2026-10-02T12:00:00Z")
    ctx.db.tables.gameSessions[0].fetchedAt = seenAt
    ctx.db.tables.gameSessions[1].fetchedAt = seenAt - 60_000
    await invoke(hllPage, ctx, {
        guildId: "guild-a",
        cursor: null,
        apply: true,
    })
    const retained = ctx.db.tables.serverGameHistory[0]
    assert.equal(retained.collectedAt, new Date(seenAt).toISOString())
    assert.equal(
        ctx.db.tables.serverGameHistoryHeads[1].lastCollectedAt,
        new Date(seenAt).toISOString()
    )
    await invoke(hllPage, ctx, {
        guildId: "guild-a",
        cursor: null,
        apply: true,
    })
    assert.equal(
        ctx.db.tables.serverGameHistoryHeads[1].lastCollectedAt,
        new Date(seenAt).toISOString()
    )
    ctx.db.seed("apiKeys", {
        _id: "apiKeys:hll",
        keyHash: "hll-key",
        guildId: "guild-a",
        readAccess: {
            resources: ["server-game-history"],
            gameIds: ["hell_let_loose"],
        },
    })
    const args = {
        secret: "synthetic-history-secret",
        keyHash: "hll-key",
        gameId: "hell_let_loose",
        resource: "server-game-history",
        id: retained._id,
    }
    assert.equal(
        (await invoke(readSyncRecord, ctx, args)).data.gameId,
        "hell_let_loose"
    )
    assert.equal(
        await invoke(readSyncRecord, ctx, { ...args, gameId: "wardogs" }),
        null
    )
    ctx.db.tables.apiKeys[0].readAccess.gameIds = ["wardogs", "hell_let_loose"]
    assert.equal(
        await invoke(readSyncRecord, ctx, { ...args, gameId: "wardogs" }),
        null
    )
    ctx.db.tables.apiKeys[0].revokedAt = "2026-10-02T12:00:00Z"
    assert.equal(await invoke(readSyncRecord, ctx, args), null)
})
