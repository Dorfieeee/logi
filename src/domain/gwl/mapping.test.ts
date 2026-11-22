import { matchUrl } from "../wardogs-league/match-url"
import { gwlSession, gwlSlotFixture } from "./mapping"
import { gwlDelay, gwlFileSchema } from "./contracts"
import assert from "node:assert/strict"
import test from "node:test"
test("staggering is stable and spreads identities within a bounded window", () => {
    assert.equal(gwlDelay("clan"), gwlDelay("clan"))
    assert.notEqual(gwlDelay("clan"), gwlDelay("other"))
    assert.ok(gwlDelay("clan") >= 15000 && gwlDelay("clan") < 315000)
})
test("GWL URL identities preserve numbered matches and open slots separately", () => {
    assert.equal(matchUrl("https://gwl.gg/matches/42/").id, "42")
    assert.equal(matchUrl("https://gwl.gg/matches?slot=abc").id, "gwl-slot-abc")
    for (const url of [
        "https://gwl.gg.evil/matches/42",
        "https://gwl.gg/matches/42?foo=1",
        "http://gwl.gg/matches/42",
    ])
        assert.throws(() => matchUrl(url))
})
test("combat mapping deduplicates events, leaves unsupported metrics unknown and counts suicides only as deaths", () => {
    const event = {
        id: "a",
        type: "player_killed",
        sequence: 0,
        at: "2026-11-19T19:00:00.000Z",
        victimSteamId: "76561198000000001",
        killerSteamId: "76561198000000002",
        mapName: "europe",
        matchId: "42",
        eventTime: 1,
        contextTags: [],
    }
    const file = gwlFileSchema.parse({
        id: "file",
        map: "europe",
        startedAt: event.at,
        endedAt: null,
        coverage: "observed",
        eventCount: 3,
        events: [
            event,
            event,
            {
                ...event,
                id: "b",
                type: "player_suicide",
                killerSteamId: undefined,
            },
        ],
        scores: [],
        notice: "observed",
    })
    const session = gwlSession(file, "a".repeat(64))
    assert.equal(
        session.players.find((p) => p.platformId === event.victimSteamId)
            ?.metrics.deaths,
        2
    )
    const killer = session.players.find(
        (p) => p.platformId === event.killerSteamId
    )!
    assert.equal(killer.metrics.kills, 1)
    assert.equal(killer.metrics.cashDelta, null)
    assert.equal(killer.metrics.seconds, null)
})
test("a slot with no opponent is ignored", () => {
    assert.equal(
        gwlSlotFixture(
            {
                id: "a",
                startsAt: "2026-11-19T19:00:00Z",
                region: "EU",
                map: "europe",
                layer: null,
                weather: null,
                seatsFilled: 1,
                host: "own",
                joinedTeam: null,
            },
            new Map()
        ),
        null
    )
})

test("GWL engine map IDs map to Logi's actual map selections", async () => {
    const { gwlMap } = await import("./mapping")
    assert.equal(gwlMap("kavkazi"), "bakurani")
    assert.equal(gwlMap("europe"), "ozeti")
    assert.equal(gwlMap("north-america"), "zestafona")
    assert.equal(gwlMap("sabatulo"), "sabatulo")
})

test("fixtures without a season label remain importable without inventing a season", async () => {
    const { gwlMatchSchema } = await import("./contracts")
    const { gwlFixture } = await import("./mapping")
    const { default: data } =
        await import("../../infrastructure/gwl/fixtures/fixtures.json")
    const fixture = { ...data.upcoming[0] }
    delete (fixture as { season?: string }).season
    for (const season of [undefined, null, "", "   ", "Season 1"]) {
        const match = gwlMatchSchema.parse({
            ...fixture,
            ...(season === undefined ? {} : { season }),
        })
        assert.equal(
            gwlFixture(match).competition?.season,
            season?.trim() || null
        )
    }
    assert.throws(() =>
        gwlMatchSchema.parse({ ...fixture, season: { name: "Season 1" } })
    )
})
