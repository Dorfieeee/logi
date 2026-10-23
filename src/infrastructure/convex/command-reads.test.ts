import assert from "node:assert/strict"
import test from "node:test"

import { invoke, testContext } from "./testing/database"
import * as players from "../../../convex/players"
import * as events from "../../../convex/events"

process.env.INTERNAL_AUTH_SECRET = "dev-internal-auth-secret"
const secret = process.env.INTERNAL_AUTH_SECRET
const GUILD = "100000000000000000"
const MEMBER = "100000000000000017"

test("/notice's choices carry the match category (M3-15)", async (t) => {
    t.mock.timers.enable({
        apis: ["Date"],
        now: Date.parse("2026-10-20T12:00:00Z"),
    })
    const ctx = testContext()
    ctx.db.seed("guilds", {
        _id: "guilds:a",
        discordId: GUILD,
        name: "Vlci",
        adminIds: [],
        eventCategories: [{ id: "friendly", label: "Přátelák", color: "#fff" }],
    })
    const event = (id: string, name: string, extra: Record<string, unknown>) =>
        ctx.db.seed("events", {
            _id: `events:${id}`,
            guildId: GUILD,
            name,
            gameStart: "2026-10-21T18:00:00.000Z",
            gameEnd: "2026-10-21T20:00:00.000Z",
            meetingStart: "2026-10-21T17:30:00.000Z",
            participants: [{ userId: MEMBER, status: "attending" }],
            signUps: [],
            ...extra,
        })
    event("m", "VLK vs ROG", { kind: "match", matchType: "friendly" })
    event("t", "Trénink obrany", { kind: "training", matchType: "friendly" })
    const targets = await invoke(events.findNoticeTarget, ctx, {
        secret,
        guildId: GUILD,
        userId: MEMBER,
        query: "",
    })
    const byName = Object.fromEntries(
        targets.map((target: { name: string; categoryLabel?: string }) => [
            target.name,
            target.categoryLabel,
        ])
    )
    assert.deepEqual(byName, {
        "VLK vs ROG": "Přátelák",
        "Trénink obrany": undefined,
    })
})

test("/player's profile names the oldest imported match (M2-41)", async () => {
    const ctx = testContext()
    ctx.db.seed("users", {
        _id: "users:p",
        discordId: MEMBER,
        id: MEMBER,
        name: "Hráč 17",
        nicknames: {},
        avatar: "",
        managedGuildIds: [],
        mercenaryGuildIds: [],
        scores: {},
        score: 0,
    })
    ctx.db.seed("userAssignments", {
        _id: "userAssignments:a",
        userId: MEMBER,
        serverId: GUILD,
        type: "member",
        status: "active",
        paused: false,
    })
    ctx.db.seed("events", {
        _id: "events:a",
        guildId: GUILD,
        name: "HLL newest",
        kind: "match",
        gameId: "hell_let_loose",
        gameStart: "2026-10-03T18:00:00.000Z",
        gameEnd: "2026-10-03T20:00:00.000Z",
        meetingStart: "2026-10-03T17:30:00.000Z",
        participants: [],
        signUps: [],
    })
    ctx.db.seed("events", {
        _id: "events:b",
        guildId: GUILD,
        name: "HLL oldest",
        kind: "match",
        gameStart: "2026-06-02T18:00:00.000Z",
        gameEnd: "2026-06-02T20:00:00.000Z",
        meetingStart: "2026-06-02T17:30:00.000Z",
        participants: [],
        signUps: [],
    })
    const match = (endedAt: string) => ({
        sourceUrl: "https://crcon.test",
        importedAt: endedAt,
        endedAt,
        mapId: "foy",
        playerName: "Hráč 17",
        team: "allies",
        kills: 1,
        killDeathRatio: 1,
        deaths: 1,
        offense: 1,
        defense: 1,
        support: 1,
    })
    ctx.db.seed("playerStats", {
        _id: "playerStats:a",
        id: "steam-a",
        userId: MEMBER,
        updatedAt: "2026-10-03T00:00:00.000Z",
        matches: {
            "events:a": match("2026-10-03T19:00:00.000Z"),
            "events:b": match("2026-06-02T19:00:00.000Z"),
        },
    })
    const profile = await invoke(players.getClanPlayerProfile, ctx, {
        secret,
        guildId: GUILD,
        userId: MEMBER,
    })
    assert.equal(profile.firstMatchAt, "2026-06-02T19:00:00.000Z")
    const [option] = await invoke(players.searchClanPlayers, ctx, {
        secret,
        guildId: GUILD,
        query: "",
    })
    assert.equal(option.assignmentPaused, false)
})

test("/player keeps Wardogs statistics and scores separate from HLL", async () => {
    const ctx = testContext()
    ctx.db.seed("users", {
        _id: "users:p",
        discordId: MEMBER,
        id: MEMBER,
        name: "Hráč 17",
        nicknames: {},
        avatar: "",
        managedGuildIds: [],
        mercenaryGuildIds: [],
        score: 12,
        scores: { [JSON.stringify([GUILD, "wardogs"])]: 42 },
    })
    for (const gameId of ["hell_let_loose", "wardogs"]) {
        ctx.db.seed("userAssignments", {
            _id: `userAssignments:${gameId}`,
            userId: MEMBER,
            serverId: GUILD,
            gameId,
            type: "member",
            status: "active",
            paused: false,
        })
    }
    for (const [id, gameId, kills] of [
        ["hll", "hell_let_loose", 8],
        ["wardogs", "wardogs", 2],
    ] as const) {
        ctx.db.seed("events", {
            _id: `events:${id}`,
            guildId: GUILD,
            name: id,
            kind: "match",
            gameId,
            gameStart: "2026-10-03T18:00:00.000Z",
            gameEnd: "2026-10-03T20:00:00.000Z",
            meetingStart: "2026-10-03T17:30:00.000Z",
            participants: [],
            signUps: [],
        })
        ctx.db.seed("playerStats", {
            _id: `playerStats:${id}`,
            id: `platform:${id}`,
            userId: MEMBER,
            updatedAt: "2026-10-03T00:00:00.000Z",
            matches: {
                [`events:${id}`]: {
                    sourceUrl: `https://stats.test/${id}`,
                    importedAt: "2026-10-03T20:00:00.000Z",
                    mapId: id,
                    playerName: "Hráč 17",
                    team: "allies",
                    kills,
                    killDeathRatio: kills,
                    deaths: 1,
                    offense: kills,
                    defense: 0,
                    support: 0,
                },
            },
        })
    }
    const hll = await invoke(players.getClanPlayerProfile, ctx, {
        secret,
        guildId: GUILD,
        userId: MEMBER,
    })
    const wardogs = await invoke(players.getClanPlayerProfile, ctx, {
        secret,
        guildId: GUILD,
        userId: MEMBER,
        gameId: "wardogs",
    })
    assert.deepEqual(
        [
            hll.performance.matchesPlayed,
            hll.performance.averages.kills,
            hll.score,
        ],
        [1, 8, 12]
    )
    assert.deepEqual(
        [
            wardogs.performance.matchesPlayed,
            wardogs.performance.averages.kills,
            wardogs.score,
        ],
        [1, 2, 42]
    )
    await invoke(players.updateScore, ctx, {
        secret,
        userId: MEMBER,
        guildId: GUILD,
        score: 15,
    })
    await invoke(players.updateScore, ctx, {
        secret,
        userId: MEMBER,
        guildId: GUILD,
        gameId: "wardogs",
        score: 55,
    })
    const updatedHll = await invoke(players.getClanPlayerProfile, ctx, {
        secret,
        guildId: GUILD,
        userId: MEMBER,
    })
    const updatedWardogs = await invoke(players.getClanPlayerProfile, ctx, {
        secret,
        guildId: GUILD,
        userId: MEMBER,
        gameId: "wardogs",
    })
    assert.deepEqual([updatedHll.score, updatedWardogs.score], [15, 55])
})
