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
