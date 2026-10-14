import { saveCollectedPlayerStats } from "../../../convex/collectedPlayerStatsStore"
import { createResultRevision } from "../../domain/match-results/result-revision"
import type { MutationCtx } from "../../../convex/_generated/server"
import * as performance from "../../../convex/performanceHistory"
import * as publicProfiles from "../../../convex/publicProfiles"
import type { Doc } from "../../../convex/_generated/dataModel"
import * as publicReads from "../../../convex/publicApiReads"
import { invoke, testContext } from "./testing/database"
import assert from "node:assert/strict"
import test from "node:test"

const secret = (process.env.INTERNAL_AUTH_SECRET = "dev-internal-auth-secret")
function fixture() {
    const ctx = testContext()
    const event = {
        _id: "events:wd",
        gameId: "wardogs",
        guildId: "guild",
        name: "Wardogs match",
        gameStart: "2026-10-10T18:00:00Z",
        gameEnd: "2026-10-10T20:00:00Z",
    }
    ctx.db.seed("events", event)
    ctx.db.seed("users", {
        _id: "users:a",
        id: "user",
        name: "Player",
        avatar: "avatar",
        platformIds: ["steam1"],
        managedGuildIds: [],
        mercenaryGuildIds: [],
        isStreamer: false,
        updatedAt: "2026-10-10T20:00:00Z",
    })
    ctx.db.seed("userAssignments", {
        _id: "userAssignments:a",
        userId: "user",
        serverId: "guild",
        gameId: "wardogs",
        status: "active",
    })
    ctx.db.seed("gameSessions", {
        _id: "gameSessions:a",
        guildId: "guild",
        gameId: "wardogs",
        session: {
            externalId: "1",
            map: "Bakurani",
            startedAt: "2026-10-10T18:00:00Z",
            endedAt: "2026-10-10T20:00:00Z",
            complete: true,
            sourceDigest: "a".repeat(64),
            participants: [],
            players: [
                {
                    platform: "steam",
                    platformId: "steam1",
                    name: "Player",
                    faction: "Lonestar",
                    metrics: { kills: 20, deaths: 4, cashDelta: -50 },
                },
            ],
        },
    })
    const revision = createResultRevision({
        expectedRevision: 0,
        previous: null,
        action: "stage",
        actor: { kind: "session", id: "staff" },
        now: "2026-10-11T00:00:00Z",
        draft: {
            origin: "collected",
            participants: [
                { id: "a", label: "A", score: 1 },
                { id: "b", label: "B", score: 0 },
            ],
            players: [
                {
                    platform: "steam",
                    platformId: "steam1",
                    logiUserId: null,
                    method: null,
                    verifiedAt: null,
                },
            ],
            sessionLinks: [
                {
                    sessionId: "gameSessions:a",
                    provider: "wardogs_warcon",
                    externalId: "1",
                    sourceDigest: "a".repeat(64),
                    startedAt: "2026-10-10T18:00:00Z",
                    endedAt: "2026-10-10T20:00:00Z",
                    complete: true,
                    map: "Bakurani",
                },
            ],
        },
    })
    const confirmed = createResultRevision({
        expectedRevision: 1,
        previous: revision,
        action: "confirm",
        actor: { kind: "session", id: "staff" },
        now: "2026-10-11T00:01:00Z",
        draft: {
            origin: revision.origin,
            participants: revision.participants,
            players: revision.players,
            sessionLinks: revision.sessionLinks,
        },
    })
    return {
        ctx,
        event: event as unknown as Doc<"events">,
        revision,
        confirmed,
    }
}
test("confirming a Warcon source saves K/D/cash exactly once, without manufacturing verified identity", async () => {
    const { ctx, event, revision, confirmed } = fixture()
    assert.equal(
        (
            await saveCollectedPlayerStats(
                ctx as unknown as MutationCtx,
                event,
                revision
            )
        ).players,
        0
    )
    const result = await saveCollectedPlayerStats(
        ctx as unknown as MutationCtx,
        event,
        confirmed
    )
    assert.equal(result.players, 1)
    const doc = ctx.db.tables.playerStats[0]
    assert.equal(doc.userId, "user")
    assert.equal(doc.matches[event._id].kills, 20)
    assert.equal(doc.matches[event._id].deaths, 4)
    assert.equal(doc.matches[event._id].killDeathRatio, 5)
    assert.equal(doc.matches[event._id].cashDelta, -50)
    assert.equal(confirmed.players[0].logiUserId, null)
    assert.equal(
        (
            await saveCollectedPlayerStats(
                ctx as unknown as MutationCtx,
                event,
                confirmed
            )
        ).changed,
        false
    )
    assert.equal(ctx.db.tables.playerStats.length, 1)
})
test("changed/cross-workspace sources cannot populate historical metrics", async () => {
    const { ctx, event, confirmed } = fixture()
    await ctx.db.patch("gameSessions:a", { guildId: "other" })
    await assert.rejects(
        () =>
            saveCollectedPlayerStats(
                ctx as unknown as MutationCtx,
                event,
                confirmed
            ),
        /unavailable or changed/
    )
    assert.equal(ctx.db.tables.playerStats?.length ?? 0, 0)
})
test("Wardogs history/profile/API expose money and scope gameplay metrics to that game", async () => {
    const { ctx, event, confirmed } = fixture()
    await saveCollectedPlayerStats(
        ctx as unknown as MutationCtx,
        event,
        confirmed
    )
    await ctx.db.patch(event._id, { reviewedResult: { status: "confirmed" } })
    const player = await invoke(publicProfiles.getPlayer, ctx, {
        secret,
        playerId: "user",
        game: "wardogs",
    })
    assert.equal(player.stats.cashDelta, -50)
    assert.equal(player.recentMatches[0].cashDelta, -50)
    assert.equal(player.recentMatches[0].gameId, "wardogs")
    assert.equal("support" in player.recentMatches[0], false)
    await performance.rebuildGuildPerformanceHistory(
        ctx as unknown as MutationCtx,
        "guild"
    )
    assert.equal(
        ctx.db.tables.playerPerformanceHistory[0].matches[0].cashDelta,
        -50
    )
    ctx.db.seed("apiKeys", {
        _id: "apiKeys:a",
        keyHash: "key",
        guildId: "guild",
    })
    const history = await invoke(publicReads.getClanPerformanceHistory, ctx, {
        secret,
        keyHash: "key",
        game: "wardogs",
    })
    assert.equal(history.matches[0].cashDelta, -50)
    assert.equal("support" in history.matches[0], false)
    assert.equal("combat" in history.matches[0], false)
})
test("correction removes players from a removed source and clears their contribution", async () => {
    const { ctx, event, confirmed } = fixture()
    await saveCollectedPlayerStats(
        ctx as unknown as MutationCtx,
        event,
        confirmed
    )
    await saveCollectedPlayerStats(
        ctx as unknown as MutationCtx,
        event,
        { ...confirmed, sessionLinks: [], players: [], status: "corrected" },
        confirmed
    )
    assert.deepEqual(ctx.db.tables.playerStats[0].matches, {})
})

test("exact platform IDs with conflicting member accounts stay unlinked", async () => {
    const { ctx, event, confirmed } = fixture()
    ctx.db.seed("users", {
        _id: "users:b",
        id: "other",
        platformIds: ["steam1"],
    })
    ctx.db.seed("userAssignments", {
        _id: "userAssignments:b",
        userId: "other",
        serverId: "guild",
        gameId: "wardogs",
    })
    const result = await saveCollectedPlayerStats(
        ctx as unknown as MutationCtx,
        event,
        confirmed
    )
    assert.equal(result.matchedPlayers, 0)
    assert.equal(ctx.db.tables.playerStats[0].userId, undefined)
})

test("public histories and comparisons never combine games", async () => {
    const { ctx, event, confirmed } = fixture()
    await saveCollectedPlayerStats(
        ctx as unknown as MutationCtx,
        event,
        confirmed
    )
    await ctx.db.patch(event._id, { reviewedResult: { status: "confirmed" } })
    ctx.db.seed("events", {
        _id: "events:hll",
        gameId: "hell_let_loose",
        gameEnd: "2026-10-01T20:00:00Z",
        name: "HLL",
        matchStatsId: "matchStats:hll",
    })
    ctx.db.seed("playerStats", {
        _id: "playerStats:hll",
        id: "hll",
        userId: "user",
        matches: {
            "events:hll": {
                importedAt: "2026-10-01T20:00:00Z",
                endedAt: "2026-10-01T20:00:00Z",
                kills: 100,
                deaths: 10,
                killDeathRatio: 10,
                offense: 1000,
                defense: 20,
                support: 500,
            },
        },
    })
    const wd = await invoke(publicProfiles.getPlayer, ctx, {
        secret,
        playerId: "user",
        game: "wardogs",
    })
    const hll = await invoke(publicProfiles.getPlayer, ctx, {
        secret,
        playerId: "user",
        game: "hell_let_loose",
    })
    assert.equal(wd.stats.kills, 20)
    assert.equal(hll.stats.kills, 100)
    assert.equal(hll.recentMatches[0].support, 500)
    assert.deepEqual(wd.games, ["wardogs", "hell_let_loose"])
    const match = await invoke(publicProfiles.getPlayerMatch, ctx, {
        secret,
        playerId: "user",
        eventId: event._id,
    })
    assert.deepEqual(match.previousMatches, [])
    assert.equal(
        await invoke(publicProfiles.getPlayer, ctx, {
            secret,
            playerId: "user",
            game: "unsupported",
        }),
        null
    )
})

test("public profile clan badges combine active games regardless of the selected stats game", async () => {
    const { ctx, event, confirmed } = fixture()
    await saveCollectedPlayerStats(
        ctx as unknown as MutationCtx,
        event,
        confirmed
    )
    await ctx.db.patch(event._id, { reviewedResult: { status: "confirmed" } })
    ctx.db.seed("guilds", {
        _id: "guilds:a",
        discordId: "guild",
        name: "Clan",
        avatar: "logo",
    })
    ctx.db.seed("userAssignments", {
        _id: "userAssignments:hll",
        userId: "user",
        serverId: "guild",
        gameId: "hell_let_loose",
        status: "active",
    })
    ctx.db.seed("userAssignments", {
        _id: "userAssignments:duplicate",
        userId: "user",
        serverId: "guild",
        gameId: "wardogs",
        status: "active",
    })
    ctx.db.seed("userAssignments", {
        _id: "userAssignments:inactive",
        userId: "user",
        serverId: "guild",
        gameId: "hell_let_loose_vietnam",
        status: "pending",
    })
    const player = await invoke(publicProfiles.getPlayer, ctx, {
        secret,
        playerId: "user",
        game: "wardogs",
    })
    assert.deepEqual(player.clans, [
        {
            id: "guild",
            name: "Clan",
            avatar: "logo",
            gameIds: ["hell_let_loose", "wardogs"],
        },
    ])
})

test("Wardogs reports are immutable snapshots with scoped reads and disappear after source removal", async () => {
    const { ctx, event, confirmed } = fixture()
    await ctx.db.patch(event._id, {
        reviewedResult: { version: confirmed.version, status: "confirmed" },
    })
    await saveCollectedPlayerStats(
        ctx as unknown as MutationCtx,
        event,
        confirmed
    )
    const reports = await import("../../../convex/wardogsMatchReports")
    const report = await invoke(reports.get, ctx, {
        secret,
        eventId: event._id,
    })
    assert.equal(report.players[0].money, -50)
    assert.equal(JSON.stringify(report).includes("steam1"), false)
    assert.equal(
        await invoke(reports.get, ctx, {
            secret,
            eventId: event._id,
            guildId: "other",
        }),
        null
    )
    ctx.db.seed("apiKeys", {
        _id: "apiKeys:report",
        keyHash: "report",
        guildId: "guild",
        readAccess: { resources: ["matches"], gameIds: ["wardogs"] },
    })
    assert.equal(
        (
            await invoke(reports.getForKey, ctx, {
                secret,
                eventId: event._id,
                keyHash: "report",
            })
        ).version,
        2
    )
    await ctx.db.patch("apiKeys:report", { guildId: "other" })
    assert.equal(
        await invoke(reports.getForKey, ctx, {
            secret,
            eventId: event._id,
            keyHash: "report",
        }),
        null
    )
    await ctx.db.patch("gameSessions:a", {
        session: { ...ctx.db.tables.gameSessions[0].session, players: [] },
    })
    assert.equal(
        (await invoke(reports.get, ctx, { secret, eventId: event._id })).players
            .length,
        1,
        "reads the captured report, not a changed source"
    )
    await saveCollectedPlayerStats(
        ctx as unknown as MutationCtx,
        event,
        {
            ...confirmed,
            version: 3,
            status: "corrected",
            sessionLinks: [],
            players: [],
        },
        confirmed
    )
    assert.equal(
        await invoke(reports.get, ctx, { secret, eventId: event._id }),
        null
    )
})

test("Wardogs recaps queue once for rostered linked players and wait for a published results card", async () => {
    const { ctx, event, confirmed } = fixture()
    await ctx.db.patch(event._id, {
        reviewedResult: {
            version: confirmed.version,
            status: "confirmed",
            reviewedAt: confirmed.reviewedAt,
        },
    })
    await ctx.db.patch("users:a", { discordId: "111111111111111111" })
    ctx.db.seed("rosters", {
        _id: "rosters:a",
        eventId: event._id,
        squads: [{ players: [{ id: "user" }] }],
    })
    ctx.db.seed("discordPublicPanels", {
        _id: "discordPublicPanels:a",
        guildId: "guild",
        gameId: "wardogs",
        kind: "results",
        enabled: true,
        channelId: "channel",
    })
    await saveCollectedPlayerStats(
        ctx as unknown as MutationCtx,
        event,
        confirmed
    )
    assert.equal(ctx.db.tables.matchRecaps.length, 1)
    const recaps = await import("../../../convex/matchRecaps")
    const args = { secret, eventId: event._id, deliveryVersion: 2 }
    assert.deepEqual(await invoke(recaps.listPendingForEvent, ctx, args), [])
    ctx.db.seed("discordPublications", {
        _id: "discordPublications:a",
        guildId: "guild",
        key: `panel:discordPublicPanels:a:result:${event._id}`,
        channelId: "channel",
        messageId: "posted",
        error: null,
        lastSuccessAt: Date.parse(confirmed.reviewedAt!) + 1,
    })
    assert.equal(
        (await invoke(recaps.listPendingForEvent, ctx, args))[0].cashDelta,
        -50
    )
    await saveCollectedPlayerStats(
        ctx as unknown as MutationCtx,
        event,
        confirmed
    )
    assert.equal(ctx.db.tables.matchRecaps.length, 1)
    await ctx.db.patch("discordPublications:a", { error: "send_failed" })
    assert.deepEqual(await invoke(recaps.listPendingForEvent, ctx, args), [])
})

test("Wardogs corrections suppress queued delivery and never queue another recap", async () => {
    const { ctx, event, confirmed } = fixture()
    await ctx.db.patch(event._id, {
        reviewedResult: {
            version: confirmed.version,
            status: "confirmed",
            reviewedAt: confirmed.reviewedAt,
        },
    })
    await ctx.db.patch("users:a", { discordId: "111111111111111111" })
    ctx.db.seed("rosters", {
        _id: "rosters:a",
        eventId: event._id,
        squads: [{ players: [{ id: "user" }] }],
    })
    await saveCollectedPlayerStats(
        ctx as unknown as MutationCtx,
        event,
        confirmed
    )
    const recaps = await import("../../../convex/matchRecaps")
    const args = { secret, eventId: event._id, deliveryVersion: 2 }
    assert.equal(
        (await invoke(recaps.listPendingForEvent, ctx, args)).length,
        1
    )
    const recap = ctx.db.tables.matchRecaps[0]
    await ctx.db.patch(event._id, {
        reviewedResult: {
            version: confirmed.version + 1,
            status: "corrected",
            reviewedAt: confirmed.reviewedAt,
        },
    })
    assert.deepEqual(await invoke(recaps.listPendingForEvent, ctx, args), [])
    assert.equal(
        await invoke(recaps.prepareDelivery, ctx, {
            secret,
            eventId: event._id,
            recapId: recap._id,
            discordUserId: recap.discordUserId,
        }),
        null
    )
    await invoke(recaps.queueForPublishedResult, ctx, {
        secret,
        eventId: event._id,
    })
    assert.equal(ctx.db.tables.matchRecaps.length, 1)
    ctx.db.tables.matchRecaps.length = 0
    await invoke(recaps.queueForPublishedResult, ctx, {
        secret,
        eventId: event._id,
    })
    assert.equal(
        ctx.db.tables.matchRecaps.length,
        0,
        "correction cannot create a first recap either"
    )
})

test("Wardogs sent markers survive worker replays without another delivery", async () => {
    const { ctx, event, confirmed } = fixture()
    await ctx.db.patch(event._id, {
        reviewedResult: {
            version: confirmed.version,
            status: "confirmed",
            reviewedAt: confirmed.reviewedAt,
        },
    })
    await ctx.db.patch("users:a", { discordId: "111111111111111111" })
    ctx.db.seed("rosters", {
        _id: "rosters:a",
        eventId: event._id,
        squads: [{ players: [{ id: "user" }] }],
    })
    await saveCollectedPlayerStats(
        ctx as unknown as MutationCtx,
        event,
        confirmed
    )
    const recaps = await import("../../../convex/matchRecaps")
    const recap = ctx.db.tables.matchRecaps[0]
    await invoke(recaps.markSent, ctx, {
        secret,
        recapId: recap._id,
        discordUserId: recap.discordUserId,
    })
    await invoke(recaps.queueForPublishedResult, ctx, {
        secret,
        eventId: event._id,
    })
    assert.equal(ctx.db.tables.matchRecaps.length, 1)
    assert.deepEqual(
        await invoke(recaps.listPendingForEvent, ctx, {
            secret,
            eventId: event._id,
            deliveryVersion: 2,
        }),
        []
    )
})
