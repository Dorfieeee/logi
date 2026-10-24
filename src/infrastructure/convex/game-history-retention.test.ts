import * as retention from "../../../convex/gameHistoryRetention"
import { invoke, testContext } from "./testing/database"
import test, { type TestContext } from "node:test"
import assert from "node:assert/strict"

const now = Date.parse("2026-10-04T12:00:00.000Z")

function fixture(t: TestContext, retentionDays: number | null) {
    t.mock.method(Date, "now", () => now)
    const ctx = testContext()
    ctx.db.seed("gameHistorySettings", {
        _id: "gameHistorySettings:one",
        guildId: "guild",
        retentionDays,
        updatedAt: "2026-10-04T11:00:00.000Z",
        updatedBy: "admin",
    })
    ctx.db.seed("serverGameHistoryHeads", {
        _id: "serverGameHistoryHeads:one",
        guildId: "guild",
        revision: "7",
        lastCollectedAt: "2026-10-04T11:00:00.000Z",
    })
    for (const [id, endedAt, guildId] of [
        ["old-1", "2026-01-01T10:00:00.000Z", "guild"],
        ["old-2", "2026-07-06T11:00:00.000Z", "guild"],
        ["fresh", "2026-10-03T20:00:00.000Z", "guild"],
        ["other", "2026-01-01T10:00:00.000Z", "other-guild"],
    ] as const)
        ctx.db.seed("serverGameHistory", {
            _id: `serverGameHistory:${id}`,
            guildId,
            sourceId: "source",
            externalId: id,
            endedAt,
            revision: "1",
        })
    return ctx
}

test("pruning removes only this workspace's expired games, records deletions and advances the revision", async (t) => {
    const ctx = fixture(t, 90)
    ctx.db.seed("apiKeys", {
        _id: "apiKeys:website",
        guildId: "guild",
        keyHash: "website",
        readAccess: {
            resources: ["server-game-history"],
            gameIds: ["wardogs"],
        },
    })
    const result = await invoke(retention.prune, ctx, { guildId: "guild" })
    assert.deepEqual(result, { deleted: 2 })
    assert.deepEqual(
        ctx.db.tables.serverGameHistory.map((row) => row._id).sort(),
        ["serverGameHistory:fresh", "serverGameHistory:other"]
    )
    assert.equal(ctx.db.tables.serverGameHistoryHeads[0].revision, "8")
    assert.equal(ctx.scheduler.calls.length, 0)
})

test("indefinite retention prunes nothing and leaves the revision alone", async (t) => {
    const ctx = fixture(t, null)
    assert.deepEqual(await invoke(retention.prune, ctx, { guildId: "guild" }), {
        deleted: 0,
    })
    assert.equal(ctx.db.tables.serverGameHistory.length, 4)
    assert.equal(ctx.db.tables.serverGameHistoryHeads[0].revision, "7")
})

test("retention and deletion revisions stay game-scoped; legacy settings govern only Wardogs", async (t) => {
    const ctx = fixture(t, 90)
    ctx.db.seed("serverGameHistory", {
        _id: "serverGameHistory:hll-old",
        guildId: "guild",
        gameId: "hell_let_loose",
        endedAt: "2026-01-01T10:00:00.000Z",
        sourceId: "hll-source",
        revision: "1",
    })
    ctx.db.seed("serverGameHistoryHeads", {
        _id: "serverGameHistoryHeads:hll",
        guildId: "guild",
        gameId: "hell_let_loose",
        revision: "12",
        lastCollectedAt: "2026-10-03T10:00:00Z",
    })
    assert.deepEqual(
        await invoke(retention.prune, ctx, {
            guildId: "guild",
            gameId: "hell_let_loose",
        }),
        { deleted: 0 }
    )
    await invoke(retention.prune, ctx, { guildId: "guild" })
    assert.ok(await ctx.db.get("serverGameHistory:hll-old"))
    assert.equal(
        (await ctx.db.get("serverGameHistoryHeads:hll"))!.revision,
        "12"
    )
    ctx.db.seed("gameHistorySettings", {
        _id: "gameHistorySettings:hll",
        guildId: "guild",
        gameId: "hell_let_loose",
        retentionDays: 90,
        updatedAt: "2026-10-03T10:00:00Z",
        updatedBy: "admin",
    })
    assert.deepEqual(
        await invoke(retention.prune, ctx, {
            guildId: "guild",
            gameId: "hell_let_loose",
        }),
        { deleted: 1 }
    )
    assert.equal(await ctx.db.get("serverGameHistory:hll-old"), null)
    assert.equal(
        (await ctx.db.get("serverGameHistoryHeads:hll"))!.revision,
        "13"
    )
    assert.equal(ctx.db.tables.serverGameHistoryHeads[0].revision, "8")
})

test("the daily sweep schedules a prune only for workspaces with a retention window", async (t) => {
    const ctx = fixture(t, 365)
    ctx.db.seed("gameHistorySettings", {
        _id: "gameHistorySettings:two",
        guildId: "forever",
        retentionDays: null,
        updatedAt: "2026-10-04T11:00:00.000Z",
        updatedBy: "admin",
    })
    await invoke(retention.pruneDue, ctx, {})
    assert.equal(ctx.scheduler.calls.length, 1)
    assert.deepEqual((ctx.scheduler.calls[0] as unknown[])[2], {
        guildId: "guild",
    })
})
