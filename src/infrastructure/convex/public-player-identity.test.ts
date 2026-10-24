import { publicPlayerIdentityBinding } from "../../domain/player-stats/public-identity"
import { invoke, testContext, spyReads } from "./testing/database"
import { getPlayer } from "../../../convex/publicProfiles"
import assert from "node:assert/strict"
import test from "node:test"

const subject = "100000000000000001"
const secret = "synthetic-public-player-secret"
function fixture() {
    const ctx = testContext()
    ctx.db.seed("users", {
        _id: "users:native",
        id: "native-import-id",
        discordId: subject,
        name: "Native player",
        avatar: "",
        updatedAt: "2026-10-25T00:00:00Z",
    })
    ctx.db.seed("users", {
        _id: "users:shadow",
        id: subject,
        discordId: "100000000000000002",
        name: "Legacy shadow",
        avatar: "",
        updatedAt: "2026-10-25T00:00:00Z",
    })
    ctx.db.seed("events", {
        _id: "events:public",
        name: "Synthetic public match",
        gameId: "hell_let_loose",
        gameEnd: "2026-10-24T20:00:00Z",
        matchStatsId: "matchStats:public",
    })
    for (const [userId, kills] of [
        ["native-import-id", 2],
        [subject, 999],
    ] as const)
        ctx.db.seed("playerStats", {
            _id: `playerStats:${userId}`,
            id: userId,
            userId,
            matches: {
                "events:public": {
                    importedAt: "2026-10-24T20:00:00Z",
                    endedAt: "2026-10-24T20:00:00Z",
                    kills,
                    deaths: 1,
                    killDeathRatio: kills,
                    offense: 0,
                    defense: 0,
                    support: 0,
                },
            },
        })
    return ctx
}

test("explicit Discord lookup cannot select a colliding legacy imported ID; default legacy lookup remains unchanged", async (t) => {
    const previous = process.env.INTERNAL_AUTH_SECRET
    process.env.INTERNAL_AUTH_SECRET = secret
    t.after(() => {
        if (previous === undefined) delete process.env.INTERNAL_AUTH_SECRET
        else process.env.INTERNAL_AUTH_SECRET = previous
    })
    const ctx = fixture(),
        args = { secret, playerId: subject, game: "hell_let_loose" }
    const legacy = await invoke(getPlayer, ctx, args)
    assert.equal(legacy.stats.kills, 999)
    assert.equal(Object.keys(legacy).includes("identityBinding"), false)
    const exact = await invoke(getPlayer, ctx, {
        ...args,
        identifierKind: "discord",
    })
    assert.equal(exact.stats.kills, 2)
    assert.equal(exact.name, "Native player")
    assert.equal(
        exact.identityBinding,
        await publicPlayerIdentityBinding("users:native", subject)
    )
    assert.equal(Object.keys(exact).includes("discordId"), false)
    assert.equal(JSON.stringify(exact).includes("users:native"), false)
    assert.equal(
        await invoke(getPlayer, ctx, {
            ...args,
            identifierKind: "discord",
            playerId: "native-import-id",
        }),
        null
    )
    await assert.rejects(
        invoke(getPlayer, ctx, {
            ...args,
            identifierKind: "discord",
            secret: "wrong",
        }),
        /Unauthorized/
    )
})

test("explicit Discord lookup fails closed for missing or duplicate exact accounts without an imported-ID fallback", async (t) => {
    const previous = process.env.INTERNAL_AUTH_SECRET
    process.env.INTERNAL_AUTH_SECRET = secret
    t.after(() => {
        if (previous === undefined) delete process.env.INTERNAL_AUTH_SECRET
        else process.env.INTERNAL_AUTH_SECRET = previous
    })
    const ctx = fixture(),
        args = {
            secret,
            playerId: subject,
            game: "hell_let_loose",
            identifierKind: "discord",
        }
    await ctx.db.delete("users:native")
    const reads = spyReads(ctx)
    assert.equal(await invoke(getPlayer, ctx, args), null)
    assert.deepEqual(reads, [{ table: "users", index: "discordId" }])
    ctx.db.seed("users", { _id: "users:one", discordId: subject })
    ctx.db.seed("users", { _id: "users:two", discordId: subject })
    assert.equal(await invoke(getPlayer, ctx, args), null)
})
