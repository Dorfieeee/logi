import { account, linkSteam, history } from "../../../convex/discordPlayerStats"
import { invoke, testContext } from "./testing/database"
import { historyRecord } from "../testing/game-history"
import assert from "node:assert/strict"
import test from "node:test"

process.env.INTERNAL_AUTH_SECRET = "dev-internal-auth-secret"
const guildId = "111111111111111111",
    requesterId = "222222222222222222",
    steamId = "76561198199051397"
const args = () => ({
    secret: "dev-internal-auth-secret",
    guildId,
    requesterId,
    observedAt: Date.now(),
})
function setup() {
    const ctx = testContext()
    ctx.db.seed("discordConfigs", { _id: "config", guildId })
    return ctx
}

test("statistics use exact Discord binding and never adopt a colliding imported identifier", async () => {
    const ctx = setup()
    ctx.db.seed("users", {
        _id: "import",
        id: requesterId,
        discordId: "333333333333333333",
        platformIds: [`steam:${steamId}`],
    })
    assert.deepEqual(
        (await invoke(account, ctx, { ...args(), targetId: requesterId }))
            .steamIds,
        []
    )
    await assert.rejects(
        invoke(linkSteam, ctx, {
            ...args(),
            steamId,
            name: "Applicant",
            expectedSteamIds: [],
        }),
        /identity_conflict/
    )
    assert.equal(ctx.db.tables.users[0].discordId, "333333333333333333")
})
test("late Steam registration is self-only, preserves other platforms, and cannot claim another player's ID", async () => {
    const ctx = setup()
    ctx.db.seed("users", {
        _id: "own",
        id: requesterId,
        discordId: requesterId,
        platformIds: ["xbox:keep-me"],
    })
    await invoke(linkSteam, ctx, {
        ...args(),
        steamId,
        name: "Applicant",
        expectedSteamIds: [],
    })
    assert.deepEqual(ctx.db.tables.users[0].platformIds, [
        "xbox:keep-me",
        `steam:${steamId}`,
    ])
    assert.equal(ctx.db.tables.userAssignments?.length ?? 0, 0)
    assert.equal(ctx.db.tables.platformIdentityLinks?.length ?? 0, 0)
    await assert.rejects(
        invoke(linkSteam, ctx, {
            ...args(),
            requesterId: "444444444444444444",
            steamId,
            name: "Other",
            expectedSteamIds: [],
        }),
        /already_linked/
    )
    await assert.rejects(
        invoke(linkSteam, ctx, {
            ...args(),
            steamId: "76561198000000001",
            name: "Applicant",
            expectedSteamIds: [],
        }),
        /link_changed/
    )
})
test("stats reject stale gateway membership, bad secret, and another unconfigured guild", async () => {
    const ctx = setup()
    for (const override of [
        { observedAt: Date.now() - 11_000 },
        { secret: "wrong" },
        { guildId: "999999999999999999" },
    ])
        await assert.rejects(
            invoke(account, ctx, {
                ...args(),
                targetId: requesterId,
                ...override,
            })
        )
})
test("bot history reads stay in the guild, omit other players, and reject a changing revision", async () => {
    const ctx = setup(),
        r = historyRecord()
    r.guildId = guildId
    r.session.players[0].platformId = steamId
    ctx.db.seed("serverGameHistory", {
        ...r,
        gameId: undefined,
        provider: undefined,
        _id: r.id,
        endedAt: r.session.endedAt,
    })
    ctx.db.seed("serverGameHistory", {
        ...r,
        gameId: undefined,
        provider: undefined,
        _id: "foreign",
        guildId: "other",
        endedAt: r.session.endedAt,
    })
    ctx.db.seed("serverGameHistoryHeads", {
        _id: "head",
        guildId,
        revision: "1",
        lastCollectedAt: r.collectedAt,
    })
    const input = { ...args(), steamId, cursor: null, filters: {} }
    assert.equal((await invoke(history, ctx, input)).items.length, 1)
    assert.deepEqual(
        (await invoke(history, ctx, { ...input, steamId: "76561198000000001" }))
            .items,
        []
    )
    assert.equal(
        (await invoke(history, ctx, { ...input, revision: "0" })).resetRequired,
        true
    )
})
