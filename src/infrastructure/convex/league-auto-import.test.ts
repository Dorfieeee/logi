import {
    read,
    save,
    claim,
    importFixture,
} from "../../../convex/leagueAutoImport"
import { fixture, template, settings } from "../testing/wardogs-team-fixtures"
import { seedDashboardActor, actorFixture } from "./testing/dashboard-actor"
import { invoke, testContext } from "./testing/database"
import assert from "node:assert/strict"
import test from "node:test"
process.env.INTERNAL_AUTH_SECRET = "dev-internal-auth-secret"
const access = {
    secret: process.env.INTERNAL_AUTH_SECRET,
    guildId: "guild-a",
    actor: actorFixture,
}
const credentialJson = JSON.stringify({
    format: 1,
    keyId: "test",
    nonce: "a".repeat(16),
    ciphertext: "a".repeat(20),
    tag: "a".repeat(22),
})
async function setup() {
    const ctx = testContext()
    seedDashboardActor(ctx.db)
    Object.assign(ctx.db.tables.guilds[0], {
        enabledGames: ["wardogs"],
        matchTemplates: [template],
    })
    await invoke(save, ctx, {
        ...access,
        settingsJson: JSON.stringify(settings),
        credentialJson,
        provider: "gwl",
    })
    return ctx
}
async function run(ctx: ReturnType<typeof testContext>, patch = {}) {
    for (const row of ctx.db.tables.leagueAutoImportSettings ?? [])
        row.nextPollAt = 0
    const config = await invoke(claim, ctx, {})
    assert.ok(config)
    await invoke(importFixture, ctx, {
        id: config._id,
        fence: config.fence,
        revision: config.revision,
        fixtureJson: JSON.stringify({
            ...fixture,
            scheduledAt: new Date(Date.now() + 10 * 86400_000).toISOString(),
            ...patch,
        }),
    })
    return config
}
test("settings require current clan admin and Wardogs; credentials never appear in the read model", async () => {
    const ctx = await setup()
    await assert.rejects(invoke(read, ctx, { ...access, secret: "bad" }))
    const state = await invoke(read, ctx, access)
    assert.equal(state.hasKey, true)
    const publicState = JSON.stringify(state)
    for (const forbidden of ["ciphertext", "credentialJson", "apiKey", "nonce"])
        assert.equal(publicState.includes(forbidden), false, forbidden)
    assert.deepEqual(
        Object.keys(state).sort(),
        [
            "settings",
            "defaults",
            "hasKey",
            "provider",
            "testMode",
            "lastSuccessAt",
            "error",
            "templates",
            "available",
            "records",
        ].sort()
    )
    ctx.db.tables.guilds[0].enabledGames = ["hell_let_loose"]
    await assert.rejects(
        invoke(save, ctx, {
            ...access,
            settingsJson: JSON.stringify(settings),
        }),
        /Wardogs/
    )
})
test("replay creates one native match and schedule; updates retain signups and local fields", async () => {
    const ctx = await setup()
    const config = await run(ctx)
    const event = ctx.db.tables.events[0]
    assert.equal(event.gameId, "wardogs")
    assert.equal(ctx.db.tables.leagueTrackedMatches[0].eventId, event._id)
    assert.ok(ctx.db.tables.eventScheduleJobs.length)
    event.name = "Manager title"
    event.signUps = [{ userId: "person", role: "infantry" }]
    const args = {
        id: config._id,
        fence: config.fence,
        revision: config.revision,
    }
    await invoke(importFixture, ctx, {
        ...args,
        fixtureJson: JSON.stringify({
            ...fixture,
            map: "Ozeti",
            scheduledAt: event.gameStart,
        }),
    })
    assert.equal(ctx.db.tables.events.length, 1)
    assert.equal(event.name, "Manager title")
    assert.equal(event.map, "Ozeti")
    assert.equal(event.signUps.length, 1)
    assert.equal(
        ctx.db.tables.leagueAutoImportFixtures[0].issue,
        "team_matching_required"
    )
    // A stale worker cannot write after settings change.
    await invoke(save, ctx, {
        ...access,
        settingsJson: JSON.stringify({ ...settings, enabled: false }),
    })
    await invoke(importFixture, ctx, {
        ...args,
        fixtureJson: JSON.stringify({ ...fixture, map: "Stale map" }),
    })
    assert.equal(event.map, "Ozeti")
})
test("deleted imported matches never reappear and manual fixture links are preserved", async () => {
    const ctx = await setup()
    const config = await run(ctx)
    const event = ctx.db.tables.events[0]
    await ctx.db.delete(event._id)
    await invoke(importFixture, ctx, {
        id: config._id,
        fence: config.fence,
        revision: config.revision,
        fixtureJson: JSON.stringify(fixture),
    })
    assert.equal(ctx.db.tables.events.length, 0)
    assert.equal(
        ctx.db.tables.leagueAutoImportFixtures[0].issue,
        "match_deleted"
    )
})

test("manual fixture bindings prevent duplicate native creation", async () => {
    const ctx = await setup()
    ctx.db.seed("leagueTrackedMatches", {
        _id: "leagueTrackedMatches:manual",
        guildId: access.guildId,
        matchId: fixture.id,
        eventId: "events:manual",
        ignored: false,
        paused: false,
    })
    await run(ctx)
    assert.equal(ctx.db.tables.events?.length ?? 0, 0)
    assert.equal(
        ctx.db.tables.leagueAutoImportFixtures[0].issue,
        "manually_managed"
    )
    assert.equal(ctx.db.tables.leagueTrackedMatches[0].eventId, "events:manual")
})
test("cross-clan event links fail closed and cancellation retains existing signups", async () => {
    const ctx = await setup()
    const config = await run(ctx)
    const event = ctx.db.tables.events[0]
    const args = {
        id: config._id,
        fence: config.fence,
        revision: config.revision,
    }
    event.signUps = [{ userId: "player" }]
    await invoke(importFixture, ctx, {
        ...args,
        fixtureJson: JSON.stringify({ ...fixture, status: "CANCELLED" }),
    })
    assert.equal(
        ctx.db.tables.leagueAutoImportFixtures[0].issue,
        "cancelled_or_postponed"
    )
    assert.equal(event.signUps.length, 1)
    event.guildId = "other-clan"
    await assert.rejects(
        invoke(importFixture, ctx, {
            ...args,
            fixtureJson: JSON.stringify(fixture),
        }),
        /scope mismatch/
    )
})
test("defaults change new imports only, and registrationStart reaches the shared signup repository", async () => {
    const ctx = await setup()
    const config = await run(ctx)
    const event = ctx.db.tables.events[0]
    const opensAt = event.registrationStart
    await invoke(save, ctx, {
        ...access,
        settingsJson: JSON.stringify({
            ...settings,
            registrationHoursBeforeStart: 240,
        }),
    })
    ctx.db.tables.leagueAutoImportSettings[0].nextPollAt = 0
    const next = await invoke(claim, ctx, {})
    await invoke(importFixture, ctx, {
        id: next._id,
        fence: next.fence,
        revision: next.revision,
        fixtureJson: JSON.stringify({
            ...fixture,
            scheduledAt: event.gameStart,
        }),
    })
    assert.equal(event.registrationStart, opensAt)
    const { ConvexEventWorkflowRepository } =
        await import("./event-workflow-repositories")
    const repository = new ConvexEventWorkflowRepository(ctx as never)
    assert.equal(
        (await repository.getById(event._id))?.registrationStart,
        opensAt
    )
    assert.notEqual(config.revision, next.revision)
})

test("an exact existing kickoff is adopted without changing the match, signups or roster", async () => {
    const ctx = await setup()
    const start = new Date(Date.now() + 10 * 86400_000).toISOString()
    ctx.db.seed("events", {
        _id: "events:manual",
        guildId: "guild-a",
        gameId: "wardogs",
        kind: "match",
        name: "Manual match",
        gameStart: start,
        gameEnd: new Date(Date.parse(start) + 7200_000).toISOString(),
        registrationEnd: start,
        meetingStart: start,
        signUps: [{ userId: "player" }],
    })
    ctx.db.seed("rosters", {
        _id: "rosters:manual",
        eventId: "events:manual",
        squads: [{ name: "Keep" }],
    })
    const config = await run(ctx, { scheduledAt: start })
    assert.equal(ctx.db.tables.events.length, 1)
    assert.equal(
        ctx.db.tables.leagueAutoImportFixtures[0].eventId,
        "events:manual"
    )
    assert.equal(ctx.db.tables.events[0].name, "Manual match")
    assert.equal(
        ctx.db.tables.events[0].wardogsFixtureUrl,
        `https://wardogsleague.net/matches/${fixture.id}`
    )
    assert.equal(ctx.db.tables.events[0].signUps.length, 1)
    assert.equal(ctx.db.tables.rosters[0].squads[0].name, "Keep")
    await invoke(importFixture, ctx, {
        id: config._id,
        fence: config.fence,
        revision: config.revision,
        fixtureJson: JSON.stringify({
            ...fixture,
            scheduledAt: start,
            map: "Changed API map",
        }),
    })
    assert.equal(ctx.db.tables.events.length, 1)
    assert.equal(ctx.db.tables.events[0].map, undefined)
})
test("ambiguous exact kickoff and a match linked to a different fixture block duplicate creation", async () => {
    for (const ambiguous of [true, false]) {
        const ctx = await setup()
        const start = new Date(Date.now() + 10 * 86400_000).toISOString()
        const event = {
            guildId: "guild-a",
            gameId: "wardogs",
            kind: "match",
            name: "Manual match",
            gameStart: start,
            gameEnd: new Date(Date.parse(start) + 7200_000).toISOString(),
            registrationEnd: start,
            meetingStart: start,
        }
        ctx.db.seed("events", {
            _id: "events:first",
            ...event,
            ...(!ambiguous
                ? {
                      wardogsFixtureUrl:
                          "https://wardogsleague.net/matches/different",
                  }
                : {}),
        })
        if (ambiguous) ctx.db.seed("events", { _id: "events:second", ...event })
        await run(ctx, { scheduledAt: start })
        assert.equal(ctx.db.tables.events.length, ambiguous ? 2 : 1)
        assert.equal(
            ctx.db.tables.leagueAutoImportFixtures[0].issue,
            ambiguous ? "ambiguous_game_start" : "kickoff_already_linked"
        )
    }
})
test("another clan's match at the same kickoff is never adopted", async () => {
    const ctx = await setup()
    const start = new Date(Date.now() + 10 * 86400_000).toISOString()
    ctx.db.seed("events", {
        _id: "events:other",
        guildId: "other",
        gameId: "wardogs",
        kind: "match",
        gameStart: start,
    })
    await run(ctx, { scheduledAt: start })
    assert.equal(ctx.db.tables.events.length, 2)
    assert.notEqual(
        ctx.db.tables.leagueAutoImportFixtures[0].eventId,
        "events:other"
    )
})

test("exact-time adoption also recognizes legacy clan record IDs without migrating native data", async () => {
    const ctx = await setup()
    const start = new Date(Date.now() + 10 * 86400_000).toISOString()
    ctx.db.seed("events", {
        _id: "events:legacy",
        guildId: "guilds:admin",
        gameId: "wardogs",
        name: "Legacy match",
        gameStart: start,
        gameEnd: new Date(Date.parse(start) + 7200_000).toISOString(),
        registrationEnd: start,
        meetingStart: start,
    })
    const config = await run(ctx, { scheduledAt: start })
    assert.equal(ctx.db.tables.events.length, 1)
    assert.equal(ctx.db.tables.events[0].guildId, "guilds:admin")
    assert.equal(ctx.db.tables.leagueAutoImportFixtures.length, 1)
    assert.equal(ctx.db.tables.leagueAutoImportFixtures[0].guildId, "guild-a")
    await invoke(importFixture, ctx, {
        id: config._id,
        fence: config.fence,
        revision: config.revision,
        fixtureJson: JSON.stringify({ ...fixture, scheduledAt: start }),
    })
    assert.equal(ctx.db.tables.events.length, 1)
})
