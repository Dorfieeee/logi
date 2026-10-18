import { invoke, testContext } from "./testing/database"
import * as recaps from "../../../convex/matchRecaps"
import * as players from "../../../convex/players"
import assert from "node:assert/strict"
import test from "node:test"

const secret = (process.env.INTERNAL_AUTH_SECRET = "dev-internal-auth-secret")
const eventId = "events:recap"
const discordUserId = "222222222222222222"
function fixture(userId = "imported-player") {
    const ctx = testContext()
    ctx.db.seed("events", {
        _id: eventId,
        guildId: "guilds:a",
        name: "Synthetic match",
        eventResult: {},
    })
    ctx.db.seed("users", {
        _id: "users:player",
        id: "imported-player",
        discordId: discordUserId,
    })
    ctx.db.seed("rosters", {
        _id: "rosters:a",
        eventId,
        squads: [{ players: [{ id: userId }] }],
    })
    ctx.db.seed("playerStats", {
        _id: "playerStats:a",
        userId,
        matches: {
            [eventId]: {
                kills: 4,
                deaths: 2,
                killDeathRatio: 2,
                mapName: "Foy",
            },
        },
    })
    return ctx
}
const queue = (ctx: ReturnType<typeof fixture>) =>
    invoke(recaps.queueForPublishedResult, ctx, {
        secret,
        eventId,
        baselines: [],
    })
const list = (ctx: ReturnType<typeof fixture>) =>
    invoke(recaps.listPendingForEvent, ctx, {
        secret,
        eventId,
        deliveryVersion: 2,
    })

test("recap queue validator accepts optional nullable cash baselines from captureBaselines", () => {
    const mutation = recaps.queueForPublishedResult
    assert.ok(
        "exportArgs" in mutation && typeof mutation.exportArgs === "function"
    )
    const args = JSON.parse(mutation.exportArgs())
    assert.deepEqual(args.value.baselines.fieldType.value.value.cashDelta, {
        fieldType: {
            type: "union",
            value: [{ type: "number" }, { type: "null" }],
        },
        optional: true,
    })
})

for (const cashDelta of [undefined, null, 125] as const) {
    test(`captured recap baseline round-trips through the queue with cashDelta ${cashDelta}`, async () => {
        const ctx = fixture()
        const current = ctx.db.tables.playerStats[0].matches[eventId]
        delete ctx.db.tables.playerStats[0].matches[eventId]
        ctx.db.tables.playerStats[0].matches.previous = {
            importedAt: "2026-10-17T18:00:00.000Z",
            kills: 35.8,
            deaths: 54.7,
            killDeathRatio: 0.6586666666666667,
            ...(cashDelta === undefined ? {} : { cashDelta }),
        }
        const baselines = await invoke(recaps.captureBaselines, ctx, {
            secret,
            userIds: ["imported-player"],
        })
        ctx.db.tables.playerStats[0].matches[eventId] = current
        assert.deepEqual(
            await invoke(recaps.queueForPublishedResult, ctx, {
                secret,
                eventId,
                baselines,
            }),
            { queued: 1 }
        )
        const { userId: _userId, ...expected } = baselines[0]
        assert.deepEqual(ctx.db.tables.matchRecaps[0].previousTen, expected)
        assert.equal(expected.cashDelta, cashDelta)
    })
}

test("recap queue binds imported players to an explicit Discord account and record", async () => {
    const ctx = fixture()
    assert.deepEqual(await queue(ctx), { queued: 1 })
    const row = ctx.db.tables.matchRecaps[0]
    assert.equal(row.userId, "imported-player")
    assert.equal(row.userRecordId, "users:player")
    assert.equal(row.discordUserId, discordUserId)
    const [delivery] = await list(ctx)
    assert.equal(delivery.userId, "imported-player")
    assert.equal(delivery.discordUserId, discordUserId)
    assert.equal(delivery.recapId, row._id)
})

test("numeric imported IDs without an explicit Discord link cannot receive recaps", async () => {
    const ctx = fixture(discordUserId)
    ctx.db.tables.users[0].id = discordUserId
    delete ctx.db.tables.users[0].discordId
    assert.deepEqual(await queue(ctx), { queued: 0 })
    assert.deepEqual(await list(ctx), [])
})

test("opt-out also blocks a queued player referenced by their Discord alias", async () => {
    const ctx = fixture(discordUserId)
    await queue(ctx)
    ctx.db.tables.users[0].matchRecapNotificationsEnabled = false
    assert.deepEqual(await list(ctx), [])
    const fresh = fixture(discordUserId)
    fresh.db.tables.users[0].matchRecapNotificationsEnabled = false
    assert.deepEqual(await queue(fresh), { queued: 0 })
})

for (const change of ["unlink", "relink", "replace", "opt_out"] as const) {
    test(`pending recap is withheld after ${change}`, async () => {
        const ctx = fixture()
        await queue(ctx)
        const user = ctx.db.tables.users[0]
        if (change === "unlink") delete user.discordId
        if (change === "relink") user.discordId = "333333333333333333"
        if (change === "replace") user._id = "users:replacement"
        if (change === "opt_out") user.matchRecapNotificationsEnabled = false
        assert.deepEqual(await list(ctx), [])
    })
}

test("unbound legacy pending recaps are withheld instead of guessing a recipient", async () => {
    const ctx = fixture()
    ctx.db.seed("matchRecaps", {
        _id: "matchRecaps:legacy",
        eventId,
        userId: "imported-player",
        status: "pending",
    })
    assert.deepEqual(await list(ctx), [])
})

test("notification preference resolves the authenticated Discord subject, not a colliding imported ID", async () => {
    const ctx = fixture()
    ctx.db.seed("users", {
        _id: "users:unrelated",
        id: discordUserId,
        discordId: "333333333333333333",
        matchRecapNotificationsEnabled: true,
    })
    await invoke(players.setMatchRecapNotifications, ctx, {
        secret,
        userId: discordUserId,
        enabled: false,
    })
    assert.equal(ctx.db.tables.users[0].matchRecapNotificationsEnabled, false)
    assert.equal(ctx.db.tables.users[1].matchRecapNotificationsEnabled, true)
})

test("old delivery clients receive no queue and cannot interpret player IDs as Discord IDs", async () => {
    const ctx = fixture()
    await queue(ctx)
    assert.deepEqual(
        await invoke(recaps.listPendingForEvent, ctx, { secret, eventId }),
        []
    )
    assert.equal((await list(ctx)).length, 1)
    assert.deepEqual(await queue(ctx), { queued: 0 })
})

test("delivery preparation checks event, recipient, opt-out and sent state independently of an earlier list", async () => {
    const ctx = fixture()
    await queue(ctx)
    const [candidate] = await list(ctx)
    const args = { secret, eventId, recapId: candidate.recapId, discordUserId }
    assert.equal(
        (await invoke(recaps.prepareDelivery, ctx, args)).userId,
        "imported-player"
    )
    assert.equal(
        await invoke(recaps.prepareDelivery, ctx, {
            ...args,
            eventId: "events:other",
        }),
        null
    )
    assert.equal(
        await invoke(recaps.prepareDelivery, ctx, {
            ...args,
            discordUserId: "333333333333333333",
        }),
        null
    )
    ctx.db.tables.users[0].matchRecapNotificationsEnabled = false
    assert.equal(await invoke(recaps.prepareDelivery, ctx, args), null)
    ctx.db.tables.users[0].matchRecapNotificationsEnabled = true
    await invoke(recaps.markSent, ctx, {
        secret,
        recapId: candidate.recapId,
        discordUserId: "333333333333333333",
    })
    assert.equal(ctx.db.tables.matchRecaps[0].status, "pending")
    await invoke(recaps.markSent, ctx, {
        secret,
        recapId: candidate.recapId,
        discordUserId,
    })
    assert.equal(ctx.db.tables.matchRecaps[0].status, "sent")
    assert.equal(await invoke(recaps.prepareDelivery, ctx, args), null)
    assert.deepEqual(await list(ctx), [])
    await assert.rejects(
        invoke(recaps.prepareDelivery, ctx, { ...args, secret: "wrong" }),
        /Unauthorized/
    )
})

test("a numeric imported account cannot change notification preferences without an explicit Discord link", async () => {
    const ctx = fixture(discordUserId)
    ctx.db.tables.users[0].id = discordUserId
    delete ctx.db.tables.users[0].discordId
    await assert.rejects(
        invoke(players.setMatchRecapNotifications, ctx, {
            secret,
            userId: discordUserId,
            enabled: true,
        }),
        /not found/
    )
    assert.equal(
        ctx.db.tables.users[0].matchRecapNotificationsEnabled,
        undefined
    )
})
