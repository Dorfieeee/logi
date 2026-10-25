import * as eventAnnouncements from "../../../convex/eventAnnouncements"
import { invoke, testContext } from "./testing/database"
import assert from "node:assert/strict"
import test from "node:test"

/**
 * The announcement's bot-facing reads: the one-time redraw's scope
 * (L1-147, L1-B20) and the dashboard link of "Zobrazit přihlášené" (L1-85).
 */

const secret = ["synthetic", "announcement", "secret"].join("-")
const guildId = "910000000000000001"
const version = "l1-test"
const now = "2026-10-20T12:00:00.000Z"

function fixture() {
    process.env.INTERNAL_AUTH_SECRET = secret
    const ctx = testContext()
    const match = (id: string, gameEnd: string, extra = {}) =>
        ctx.db.seed("events", {
            _id: `events:${id}`,
            guildId,
            kind: "match",
            name: id,
            status: "registration",
            registrationEnd: "2026-10-24T17:00:00.000Z",
            meetingStart: "2026-10-25T17:30:00.000Z",
            gameStart: "2026-10-25T18:00:00.000Z",
            gameEnd,
            participants: [],
            ...extra,
        })
    const sync = (id: string, fields: Record<string, string>) =>
        ctx.db.seed("discordEventSyncs", {
            _id: `discordEventSyncs:${id}`,
            eventId: `events:${id}`,
            guildId,
            topicMessageIds: [],
            ...fields,
        })
    const upcoming = "2026-10-25T20:00:00.000Z"
    match("card", upcoming)
    sync("card", { announcementMessageId: "1" })
    // The old bot removed the announcement once sign-ups closed.
    match("roster-card", upcoming)
    sync("roster-card", { eventInfoMessageId: "2" })
    match("forum-only", upcoming)
    sync("forum-only", { infoMessageId: "3" })
    match("nothing", upcoming)
    sync("nothing", {})
    match("old", "2026-10-01T20:00:00.000Z")
    sync("old", { eventInfoMessageId: "4" })
    match("draft", upcoming, { isDraft: true })
    sync("draft", { eventInfoMessageId: "5" })
    return ctx
}

const listDue = async (ctx: ReturnType<typeof testContext>) =>
    (
        (await invoke(eventAnnouncements.listMigrationDue, ctx, {
            secret,
            version,
            now,
        })) as Array<{ eventId: string }>
    ).map((item) => item.eventId)

test("the one-time redraw also covers matches with only a roster card or forum post (L1-147, L1-B20)", async () => {
    const ctx = fixture()
    assert.deepEqual(await listDue(ctx), [
        "events:card",
        "events:roster-card",
        "events:forum-only",
    ])
})

test("each match is redrawn once: the card's layout or the migration marker takes it off the list", async () => {
    const ctx = fixture()
    await invoke(eventAnnouncements.record, ctx, {
        secret,
        eventId: "events:card",
        guildId,
        layoutVersion: version,
    })
    await invoke(eventAnnouncements.record, ctx, {
        secret,
        eventId: "events:roster-card",
        guildId,
        migrationVersion: version,
    })
    assert.deepEqual(await listDue(ctx), ["events:forum-only"])
    // The marker is not a card layout: the bot never reads it as a posted
    // card and so never posts a new announcement for this match.
    const row = ctx.db.tables.discordAnnouncements.find(
        (item) => item.eventId === "events:roster-card"
    )
    assert.equal(row?.layoutVersion, undefined)
    assert.equal(row?.migrationVersion, version)
    assert.equal(row?.pingedAt, undefined)
})

test("the list reads the matches through the gameEnd index from the window's start, never the whole table", async (t) => {
    const ctx = fixture()
    const ranges: Array<{ index: string; lowerBound: string | null }> = []
    const original = ctx.db.query.bind(ctx.db)
    t.mock.method(ctx.db, "query", (table: string) => {
        const query = original(table)
        if (table !== "events") return query
        const withIndex = query.withIndex
        query.withIndex = (
            name: string,
            fn?: (q: Record<string, unknown>) => unknown
        ) => {
            const range = { index: name, lowerBound: null as string | null }
            ranges.push(range)
            return withIndex(name, (q: Record<string, unknown>) =>
                fn?.(
                    new Proxy(q, {
                        get: (target, op) =>
                            op === "gte"
                                ? (field: string, value: string) => {
                                      range.lowerBound = `${field}>=${value}`
                                      return (
                                          target.gte as (
                                              field: string,
                                              value: string
                                          ) => unknown
                                      )(field, value)
                                  }
                                : Reflect.get(target, op),
                    })
                )
            )
        }
        return query
    })
    assert.deepEqual(await listDue(ctx), [
        "events:card",
        "events:roster-card",
        "events:forum-only",
    ])
    assert.deepEqual(ranges, [
        { index: "gameEnd", lowerBound: "gameEnd>=2026-10-05T12:00:00.000Z" },
    ])
})

test("the list and the records need the internal secret", async () => {
    const ctx = fixture()
    await assert.rejects(
        invoke(eventAnnouncements.listMigrationDue, ctx, {
            secret: "wrong",
            version,
            now,
        })
    )
    await assert.rejects(
        invoke(eventAnnouncements.record, ctx, {
            secret: "wrong",
            eventId: "events:card",
            guildId,
            migrationVersion: version,
        })
    )
    assert.equal((ctx.db.tables.discordAnnouncements ?? []).length, 0)
})

test("Zobrazit přihlášené names the clan's dashboard record for its web link (L1-85)", async () => {
    const ctx = fixture()
    ctx.db.seed("guilds", { _id: "guilds:vlci", discordId: guildId })
    ctx.db.seed("discordConfigs", {
        _id: "discordConfigs:vlci",
        guildId,
        defaultLanguage: "cs",
    })
    const data = await invoke(eventAnnouncements.getAttendees, ctx, {
        secret,
        eventId: "events:card",
        guildId,
    })
    assert.equal(data.serverId, "guilds:vlci")
    assert.equal(data.event.guildId, guildId)
})

test("the shared results channel wins for every game without a game-specific panel", async () => {
    const ctx = fixture()
    ctx.db.seed("guilds", {
        _id: "guilds:clan",
        discordId: guildId,
        name: "Clan",
        avatar: "",
        eventCategories: [],
    })
    ctx.db.seed("discordConfigs", {
        _id: "discordConfigs:clan",
        guildId,
        eventResultsChannelId: "shared-results",
        timezone: "Europe/Prague",
        defaultLanguage: "en",
    })
    ctx.db.seed("discordPublicPanels", {
        _id: "discordPublicPanels:old",
        guildId,
        gameId: "hell_let_loose",
        kind: "results",
        enabled: true,
        channelId: "old-results",
    })
    for (const game of ["hell_let_loose", "wardogs"]) {
        await ctx.db.patch("events:card", { gameId: game })
        const data = await invoke(eventAnnouncements.getContext, ctx, {
            secret,
            eventId: "events:card",
        })
        assert.equal(data.resultsChannelId, "shared-results")
    }
})

test("image context enforces tenant and draft boundaries and uses catalogue art facts", async () => {
    const ctx = fixture()
    ctx.db.seed("guilds", {
        _id: "guilds:clan",
        discordId: guildId,
        name: "Clan",
        avatar: "",
        eventCategories: [{ id: "league", label: "League", color: "#ffffff" }],
    })
    ctx.db.seed("discordConfigs", {
        _id: "discordConfigs:clan",
        guildId,
        timezone: "Europe/Prague",
        defaultLanguage: "cs",
    })
    ctx.db.seed("competitions", {
        _id: "competitions:league",
        name: "Community League",
    })
    ctx.db.seed("competitionFixtures", {
        _id: "competitionFixtures:game",
        competitionId: "competitions:league",
        round: 4,
    })
    await ctx.db.patch("events:card", {
        matchType: "league",
        competitionFixtureId: "competitionFixtures:game",
    })
    const args = { secret, eventId: "events:card", guildId, result: false }
    const data = await invoke(eventAnnouncements.getImageContext, ctx, args)
    assert.equal(data.model.league, "Community League · 4")
    assert.equal(data.model.category, "League")
    assert.equal(data.model.teams[0].name, "Clan")
    assert.equal(data.model.timeZone, "Europe/Prague")
    assert.equal(data.model.language, "cs")
    assert.equal(
        await invoke(eventAnnouncements.getImageContext, ctx, {
            ...args,
            guildId: "different",
        }),
        null
    )
    assert.equal(
        await invoke(eventAnnouncements.getImageContext, ctx, {
            ...args,
            eventId: "events:draft",
        }),
        null
    )
    assert.equal(
        await invoke(eventAnnouncements.getImageContext, ctx, {
            ...args,
            result: true,
        }),
        null
    )
    await assert.rejects(
        invoke(eventAnnouncements.getImageContext, ctx, {
            ...args,
            secret: "wrong",
        })
    )
})

test("result image facts are reviewed, game-scoped and include Wardogs public statistics", async () => {
    const ctx = fixture()
    await ctx.db.patch("events:card", {
        status: "concluded",
        gameId: "wardogs",
        reviewedResultGameId: "wardogs",
        wardogsReportId: "wardogsMatchReports:game",
        reviewedResult: {
            status: "confirmed",
            version: 1,
            participants: [
                { id: "valkyra", label: "Valkyra", score: 300 },
                { id: "lonestar", label: "Lonestar", score: 200 },
            ],
        },
    })
    const args = { secret, eventId: "events:card" }
    const data = await invoke(eventAnnouncements.getContext, ctx, args)
    assert.equal(data.publicMatch, true)
    assert.equal(data.imageResult.participants[0].score, 300)
    await ctx.db.patch("events:card", {
        reviewedResultGameId: "hell_let_loose",
    })
    assert.equal(
        (await invoke(eventAnnouncements.getContext, ctx, args)).imageResult,
        null
    )
})
