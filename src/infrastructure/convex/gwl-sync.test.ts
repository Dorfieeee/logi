import { gwlMatchSchema, gwlFileSchema } from "../../domain/gwl/contracts"
import type { MutationCtx } from "../../../convex/_generated/server"
import { reserve, promote } from "../../../convex/gwlSyncStore"
import { invoke, testContext } from "./testing/database"
import fixtureData from "../gwl/fixtures/fixtures.json"
import { gwlSession } from "../../domain/gwl/mapping"
import { apply } from "../../../convex/gwlResults"
import fileData from "../gwl/fixtures/file.json"
import assert from "node:assert/strict"
import test from "node:test"
const match = gwlMatchSchema.parse(
    fixtureData.recent.find((m) => m.status === "confirmed")
)
const session = gwlSession(gwlFileSchema.parse(fileData), "a".repeat(64))
process.env.INTERNAL_AUTH_SECRET = "dev-internal-auth-secret"
function setup() {
    const ctx = testContext()
    ctx.db.seed("guilds", { _id: "guilds:a", discordId: "guild", name: "Team" })
    ctx.db.seed("leagueAutoImportSettings", {
        _id: "leagueAutoImportSettings:a",
        guildId: "guild",
        enabled: true,
        provider: "gwl",
        testMode: false,
        settingsJson: JSON.stringify({ teamCode: "test-team" }),
        fence: 1,
        revision: 1,
        leaseUntil: Date.now() + 300000,
    })
    ctx.db.seed("events", {
        _id: "events:a",
        guildId: "guild",
        gameId: "wardogs",
        kind: "match",
        name: "GWL",
        status: "concluded",
        registrationEnd: "2026-01-01T18:00:00Z",
        meetingStart: "2026-01-01T18:30:00Z",
        gameStart: "2026-01-01T19:00:00Z",
        gameEnd: "2026-01-01T20:00:00Z",
        wardogsFixtureUrl: `https://gwl.gg/matches/${match.number}`,
    })
    ctx.db.seed("leagueAutoImportFixtures", {
        _id: "leagueAutoImportFixtures:a",
        guildId: "guild",
        fixtureId: match.number,
        eventId: "events:a",
        overrides: [],
        updatedAt: 0,
    })
    return ctx
}
const args = {
    id: "leagueAutoImportSettings:a",
    fence: 1,
    revision: 1,
    matchJson: JSON.stringify(match),
    sessionJson: JSON.stringify(session),
}
test("GWL results replay idempotently, retract stats on dispute and restore on reconfirmation", async () => {
    const ctx = setup()
    await invoke(apply, ctx, args)
    const event = ctx.db.tables.events[0]
    assert.equal(event.reviewedResult.status, "confirmed")
    assert.equal(ctx.db.tables.playerStats.length, 4)
    assert.ok(ctx.db.tables.playerStats.every((row) => !row.userId))
    await invoke(apply, ctx, args)
    assert.equal(ctx.db.tables.eventResultRevisions.length, 1)
    await invoke(apply, ctx, {
        ...args,
        matchJson: JSON.stringify({ ...match, status: "disputed" }),
    })
    assert.equal(event.reviewedResult.status, "provisional")
    assert.ok(ctx.db.tables.playerStats.every((row) => !row.matches[event._id]))
    await invoke(apply, ctx, args)
    assert.equal(event.reviewedResult.status, "corrected")
    assert.equal(ctx.db.tables.eventResultRevisions.length, 3)
    assert.ok(ctx.db.tables.playerStats.every((row) => row.matches[event._id]))
})
test("sandbox, stale fence and foreign events cannot receive GWL results", async () => {
    const ctx = setup()
    ctx.db.tables.leagueAutoImportSettings[0].testMode = true
    await invoke(apply, ctx, args)
    assert.equal(ctx.db.tables.eventResultRevisions, undefined)
    ctx.db.tables.leagueAutoImportSettings[0].testMode = false
    await invoke(apply, ctx, { ...args, fence: 0 })
    assert.equal(ctx.db.tables.eventResultRevisions, undefined)
    ctx.db.tables.events[0].guildId = "foreign"
    await assert.rejects(invoke(apply, ctx, args), /scope mismatch/)
})
test("GWL rate budgets are shared across clans and do not overrun per-key budget", async () => {
    const ctx = testContext()
    for (let i = 0; i < 90; i++)
        assert.equal((await invoke(reserve, ctx, { keyHash: "a" })).ok, true)
    assert.equal((await invoke(reserve, ctx, { keyHash: "a" })).ok, false)
    for (let i = 0; i < 90; i++)
        assert.equal((await invoke(reserve, ctx, { keyHash: "b" })).ok, true)
    assert.equal((await invoke(reserve, ctx, { keyHash: "c" })).ok, false)
})

test("direct server stats take precedence over GWL and confirmed corrections replace one contribution", async () => {
    const ctx = setup()
    await invoke(apply, ctx, args)
    const previous = ctx.db.tables.eventResultRevisions[0].revision
    const direct = {
        ...session,
        externalId: "server",
        sourceDigest: "b".repeat(64),
        players: session.players.map((p) => ({
            ...p,
            metrics: { ...p.metrics, kills: 99 },
        })),
    }
    ctx.db.seed("gameSessions", {
        _id: "gameSessions:a",
        guildId: "guild",
        gameId: "wardogs",
        session: direct,
    })
    previous.sessionLinks = [
        {
            sessionId: "gameSessions:a",
            provider: "wardogs_warcon",
            externalId: "server",
            sourceDigest: direct.sourceDigest,
            startedAt: direct.startedAt,
            endedAt: direct.endedAt,
            complete: true,
            map: direct.map,
        },
    ]
    const correction = {
        ...match,
        sides: match.sides.map((side, index) => ({
            ...side,
            score: index === 0 ? 70 : side.score,
        })),
    }
    await invoke(apply, ctx, { ...args, matchJson: JSON.stringify(correction) })
    assert.equal(
        ctx.db.tables.leagueAutoImportFixtures[0].statsState,
        "direct_server"
    )
    assert.ok(
        ctx.db.tables.playerStats.every(
            (row) => row.matches["events:a"].kills === 99
        )
    )
    assert.equal(Object.keys(ctx.db.tables.playerStats[0].matches).length, 1)
    assert.equal(
        ctx.db.tables.events[0].reviewedResult.participants[0].score,
        70
    )
})
test("slot promotion uses the clan, host, kickoff and opponent instead of creating another event", async () => {
    const ctx = setup(),
        row = ctx.db.tables.leagueAutoImportFixtures[0]
    row.fixtureId = "gwl-slot-slot-a"
    row.slotJson = JSON.stringify({
        id: "slot-a",
        startsAt: match.startsAt,
        region: match.region,
        map: match.map,
        layer: match.layer,
        weather: match.weather,
        seatsFilled: 2,
        host: match.host,
        joinedTeam: match.sides[1].team.slug,
    })
    const promoted = await invoke(promote, ctx, {
        configId: args.id,
        matchJson: JSON.stringify(match),
    })
    assert.equal(promoted, true)
    assert.equal(row.fixtureId, match.number)
    assert.equal(ctx.db.tables.events.length, 1)
    assert.equal(
        ctx.db.tables.events[0].wardogsFixtureUrl,
        `https://gwl.gg/matches/${match.number}`
    )
})

test("GWL API projection enforces explicit grants and clan boundaries without exposing raw stats", async () => {
    const { listGwl } = await import("../../../convex/leagueFixtureReads")
    const ctx = setup()
    const readArgs = {
        secret: process.env.INTERNAL_AUTH_SECRET!,
        keyHash: "test-key",
        guildId: "guild",
        cursor: null,
        limit: 10,
    }
    assert.equal(await invoke(listGwl, ctx, readArgs), null)
    ctx.db.seed("apiKeys", {
        _id: "apiKeys:a",
        keyHash: "test-key",
        guildId: "guild",
        readAccess: { resources: ["league-fixtures"], gameIds: ["wardogs"] },
    })
    ctx.db.tables.leagueAutoImportFixtures[0].matchJson = JSON.stringify(match)
    ctx.db.tables.leagueAutoImportFixtures[0].sessionJson =
        JSON.stringify(session)
    ctx.db.seed("leagueAutoImportFixtures", {
        _id: "leagueAutoImportFixtures:foreign",
        guildId: "other",
        fixtureId: "42",
        matchJson: JSON.stringify(match),
    })
    const result = await invoke(listGwl, ctx, readArgs)
    assert.equal(result.items.length, 1)
    assert.equal(
        JSON.stringify(result).includes(session.players[0].platformId),
        false
    )
    ctx.db.tables.apiKeys[0].revokedAt = 1
    assert.equal(await invoke(listGwl, ctx, readArgs), null)
})
test("dashboard and v1 default saves use the same game-scoped preparation", async () => {
    const { prepareExternalClanSettings } =
        await import("../../../convex/clanSettingsStores")
    const { CLAN_SETTINGS_SLICES } =
        await import("../../domain/api/clan-settings-slices")
    const { save } = await import("../../../convex/matchTemplates")
    const { defaultMatchTemplate } =
        await import("../../domain/events/match-templates")
    const ctx = setup()
    ctx.db.seed("groups", {
        _id: "groups:foreign-game",
        guildId: "guild",
        gameId: "hell_let_loose",
    })
    const template = {
        ...defaultMatchTemplate("default", "Defaults"),
        isDefault: true,
        gameId: "wardogs",
        signupGroupIds: ["groups:foreign-game"],
    }
    const dashboard = await invoke(save, ctx, {
        secret: process.env.INTERNAL_AUTH_SECRET!,
        guildId: "guilds:a",
        templates: [template],
    })
    assert.ok(dashboard.ok)
    const prepared = await invoke(
        {
            _handler: (context: MutationCtx) =>
                prepareExternalClanSettings(
                    context,
                    "guild",
                    { matchTemplates: { templates: [template] } },
                    CLAN_SETTINGS_SLICES
                ),
        },
        ctx
    )
    assert.ok(prepared.ok)
    await prepared.commit("integration")
    assert.deepEqual(
        ctx.db.tables.guilds[0].matchTemplates,
        dashboard.templates
    )
    assert.deepEqual(dashboard.templates[0].signupGroupIds, [])
})
