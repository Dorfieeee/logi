import * as configuration from "../../../convex/discordConfig"
import { invoke, testContext } from "./testing/database"
import assert from "node:assert/strict"
import test from "node:test"

const secret = (process.env.INTERNAL_AUTH_SECRET = "dev-internal-auth-secret")

function fixture() {
    const ctx = testContext()
    ctx.db.seed("guilds", {
        _id: "guilds:a",
        discordId: "111111111111111111",
        adminIds: [],
        enabledGames: ["hell_let_loose", "wardogs"],
    })
    ctx.db.seed("discordConfigs", {
        _id: "discordConfigs:a",
        guildId: "111111111111111111",
        timezone: "Europe/Prague",
        defaultLanguage: "cs",
        announcementsChannelId: "201",
        eventInfoChannelId: "202",
        errorsChannelId: "203",
        calendarCategories: ["ECL"],
        playerStatsServers: [{ token: "t", url: "https://stats.example" }],
        statsSettings: {
            enabled: true,
            games: { hell_let_loose: true, wardogs: false },
        },
        gameOverrides: { wardogs: { announcementsChannelId: "301" } },
    })
    return ctx
}

test("saving one settings page keeps every setting it did not submit", async () => {
    const ctx = fixture()
    const ticketSettings = {
        enabled: false,
        panelTitle: "",
        panelDescription: "",
        categories: [],
    }
    await invoke(configuration.upsertConfig, ctx, {
        secret,
        guildId: "guilds:a",
        ticketSettings,
    })
    const [config] = ctx.db.tables.discordConfigs
    assert.deepEqual(config.ticketSettings, ticketSettings)
    assert.equal(config.timezone, "Europe/Prague")
    assert.equal(config.defaultLanguage, "cs")
    assert.equal(config.eventInfoChannelId, "202")
    assert.equal(config.errorsChannelId, "203")
    assert.deepEqual(config.calendarCategories, ["ECL"])
    assert.equal(config.playerStatsServers.length, 1)
    assert.equal(config.statsSettings.enabled, true)
    assert.equal(config.gameOverrides.wardogs.announcementsChannelId, "301")
})

test("null clears one Discord ID and German can be saved", async () => {
    const ctx = fixture()
    await invoke(configuration.upsertConfig, ctx, {
        secret,
        guildId: "guilds:a",
        defaultLanguage: "de",
        errorsChannelId: null,
        announcementsChannelId: " 204 ",
    })
    const [config] = ctx.db.tables.discordConfigs
    assert.equal(config.defaultLanguage, "de")
    assert.equal(config.errorsChannelId, undefined)
    assert.equal(config.announcementsChannelId, "204")
    assert.equal(config.eventInfoChannelId, "202")
})

test("the first save creates a configuration with clan defaults", async () => {
    const ctx = fixture()
    ctx.db.tables.discordConfigs = []
    await invoke(configuration.upsertConfig, ctx, {
        secret,
        guildId: "guilds:a",
        clanRoleId: "401",
    })
    const [config] = ctx.db.tables.discordConfigs
    assert.equal(config.guildId, "111111111111111111")
    assert.equal(config.timezone, "UTC")
    assert.equal(config.defaultLanguage, "en")
    assert.deepEqual(config.calendarCategories, [])
    assert.equal(config.clanRoleId, "401")
})

test("the clan-wide results destination can be saved and cleared without changing game routing", async () => {
    const ctx = fixture()
    await invoke(configuration.upsertConfig, ctx, {
        secret,
        guildId: "guilds:a",
        eventResultsChannelId: " 500 ",
    })
    assert.equal(ctx.db.tables.discordConfigs[0].eventResultsChannelId, "500")
    assert.equal(
        ctx.db.tables.discordConfigs[0].gameOverrides.wardogs
            .announcementsChannelId,
        "301"
    )
    await invoke(configuration.upsertConfig, ctx, {
        secret,
        guildId: "guilds:a",
        eventResultsChannelId: null,
    })
    assert.equal(
        ctx.db.tables.discordConfigs[0].eventResultsChannelId,
        undefined
    )
})

test("per-game debrief forums save without a clan fallback or disabled-game channels", async () => {
    const ctx = fixture()
    const eventDiscussionDefaults = {
        createForumChannel: false,
        createDebriefThread: true,
        debriefDestination: "debrief_forum",
    }
    const gameOverrides = {
        hell_let_loose: {
            eventDiscussionDefaults: { debriefForumChannelId: "401" },
        },
        wardogs: {
            eventDiscussionDefaults: { debriefForumChannelId: "402" },
        },
    }
    await invoke(configuration.upsertConfig, ctx, {
        secret,
        guildId: "guilds:a",
        eventDiscussionDefaults,
        gameOverrides,
    })
    assert.deepEqual(
        ctx.db.tables.discordConfigs[0].gameOverrides,
        gameOverrides
    )
    // Subsequent saves of another settings page must validate the same effective routing.
    await invoke(configuration.upsertConfig, ctx, {
        secret,
        guildId: "guilds:a",
        timezone: "UTC",
    })
    await assert.rejects(
        invoke(configuration.upsertConfig, ctx, {
            secret,
            guildId: "guilds:a",
            gameOverrides: {
                ...gameOverrides,
                wardogs: { eventDiscussionDefaults: {} },
            },
        }),
        /Select a debrief forum channel/
    )
})

test("enabled custom games require a debrief forum while disabled debriefs do not", async () => {
    const ctx = fixture()
    ctx.db.tables.guilds[0].enabledGames = ["custom-game"]
    const eventDiscussionDefaults = {
        debriefDestination: "debrief_forum",
        createDebriefThread: true,
    }
    await assert.rejects(
        invoke(configuration.upsertConfig, ctx, {
            secret,
            guildId: "guilds:a",
            eventDiscussionDefaults,
        }),
        /Select a debrief forum channel/
    )
    await invoke(configuration.upsertConfig, ctx, {
        secret,
        guildId: "guilds:a",
        eventDiscussionDefaults: {
            ...eventDiscussionDefaults,
            createDebriefThread: false,
        },
    })
})

test("discussion defaults save with game overrides and validate inherited deletion", async () => {
    const ctx = fixture()
    await invoke(configuration.upsertConfig, ctx, {
        secret,
        guildId: "guilds:a",
        eventDiscussionDefaults: {
            createForumChannel: true,
            deleteForumAfterConclusion: false,
            debriefDestination: "event_forum",
        },
        gameOverrides: {
            wardogs: {
                announcementsChannelId: "301",
                eventDiscussionDefaults: {
                    debriefDestination: "debrief_forum",
                    debriefForumChannelId: "123456789012345678",
                },
            },
        },
    })
    assert.equal(
        ctx.db.tables.discordConfigs[0].eventDiscussionDefaults
            .debriefDestination,
        "event_forum"
    )
    await assert.rejects(
        invoke(configuration.upsertConfig, ctx, {
            secret,
            guildId: "guilds:a",
            eventDiscussionDefaults: {
                createForumChannel: true,
                deleteForumAfterConclusion: true,
                debriefDestination: "event_forum",
            },
        }),
        /retained/
    )
    assert.equal(
        ctx.db.tables.discordConfigs[0].eventDiscussionDefaults
            .deleteForumAfterConclusion,
        false
    )
    assert.equal(
        ctx.db.tables.discordConfigs[0].gameOverrides.wardogs
            .announcementsChannelId,
        "301"
    )
})
