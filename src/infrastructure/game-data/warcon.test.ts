import {
    warconLive,
    warconMatch,
    warconMatchDetail,
    warconServerId,
    warconTime,
    warconSteamId,
} from "../testing/warcon"
import {
    ProviderError,
    type DataSource,
    type ProviderHttp,
} from "../../domain/game-data/contracts"
import {
    readWarcon,
    warconProvider,
    readWarconSession,
    readWarconSessionPage,
} from "./warcon"
import { warconQuerySchema } from "../../domain/game-data/warcon-query"
import assert from "node:assert/strict"
import { test } from "node:test"
const source: DataSource = {
    ref: "wd",
    guildId: "guild",
    gameId: "wardogs",
    provider: "wardogs_warcon",
    providerServerId: warconServerId,
    origin: "https://warcon.example",
    secretRef: "LOGI_GAME_DATA_WD_TOKEN",
    allowedAddresses: [],
}
const now = () => Date.parse(warconTime)
function http(body: unknown, status = 200): ProviderHttp {
    return { get: async () => ({ status, body, etag: null }) }
}
const invalid = (e: unknown) =>
    e instanceof ProviderError && e.category === "invalid_response"

test("Warcon snapshot uses the game join code, preserves zero and does not publish players", async () => {
    const result = await warconProvider.readSnapshot(
        source,
        http({ ok: true, live: { [warconServerId]: warconLive() } }),
        now
    )
    assert.equal(result.observation.players, 1)
    assert.equal(result.observation.scores[0].score, 0)
    assert.equal(
        result.observation.providerInstanceId,
        warconLive().gameServerId
    )
    assert.equal(JSON.stringify(result).includes(warconSteamId), false)
})
test("live scoreboard keeps provider timestamps and strips unknown private fields recursively", async () => {
    const live = {
        ...warconLive(),
        error: "private-host:443",
        adminToken: "secret",
        players: [
            { ...warconLive().players[0], ip: "private", notes: "private" },
        ],
    }
    const result = await readWarcon(
        source,
        { view: "live" },
        http({ ok: true, live: { [warconServerId]: live } }),
        now
    )
    assert.equal(result.view, "live")
    if (result.view !== "live") return
    assert.equal(result.data.players[0].kills, 0)
    assert.equal(result.data.status?.scoreCap, null)
    assert.equal(result.data.freshness, "fresh")
    assert.equal(result.data.playersFreshness, "fresh")
    assert.equal(JSON.stringify(result).includes("private"), false)
    assert.equal(JSON.stringify(result).includes("secret"), false)
})
test("live rows do not become fresh just because Logi fetched an old Warcon cache", async () => {
    const old = {
        ...warconLive(),
        statusAt: "2026-10-02T11:55:00.000Z",
        playersAt: "2026-10-02T11:59:00.000Z",
    }
    const result = await readWarcon(
        source,
        { view: "live" },
        http({ ok: true, live: { [warconServerId]: old } }),
        now
    )
    assert.equal(result.view, "live")
    if (result.view !== "live") return
    assert.equal(result.data.freshness, "unavailable")
    assert.equal(result.data.playersFreshness, "stale")
    const snapshot = await warconProvider.readSnapshot(
        source,
        http({ ok: true, live: { [warconServerId]: old } }),
        now
    )
    assert.equal(snapshot.observation.state, "unknown")
    assert.equal(snapshot.observation.observedAt, old.statusAt)
})
test("wrong server, malformed player counts, duplicate player rows and future time fail closed", async () => {
    for (const live of [
        { ...warconLive(), serverId: "another" },
        { ...warconLive(), players: "not-a-list" },
        {
            ...warconLive(),
            players: [...warconLive().players, ...warconLive().players],
        },
        {
            ...warconLive(),
            status: { ...warconLive().status, playerCount: -1 },
        },
        { ...warconLive(), playersAt: "2099-01-01T00:00:00.000Z" },
    ])
        await assert.rejects(
            () =>
                readWarcon(
                    source,
                    { view: "live" },
                    http({ ok: true, live: { [warconServerId]: live } }),
                    now
                ),
            invalid
        )
})
test("match import ignores ongoing rows, pages all history and preserves final scores and unknown feed metrics", async () => {
    const page = await readWarconSessionPage(
        source,
        1,
        http({
            ok: true,
            matches: [warconMatch(8, false), warconMatch()],
            live: [],
            page: 1,
            pageSize: 50,
            total: 51,
            pages: 2,
        })
    )
    assert.deepEqual(page, { ids: ["7"], nextPage: 2 })
    const result = await readWarconSession(
        source,
        "7",
        http(warconMatchDetail())
    )
    assert.equal(result.complete, true)
    assert.equal(result.participants[0].score, 0)
    assert.equal(result.players[0].metrics.kills, 0)
    assert.equal(result.players[0].metrics.headshots, null)
    assert.equal(result.players[0].metrics.cashDelta, -10)
    assert.equal(result.sourceDigest.length, 64)
    await assert.rejects(
        () => readWarconSession(source, "8", http(warconMatchDetail())),
        invalid
    )
})
test("ended detail is absent for an unfinished match, not an invented final result", async () => {
    const result = await readWarcon(
        source,
        { view: "match", matchId: "8" },
        http(null, 404),
        now
    )
    assert.equal(result.view, "match")
    assert.equal(result.data, null)
})

test("durable Warcon history retains explicit outcomes, names, factions and feed coverage", async () => {
    const detail = warconMatchDetail()
    const result = await readWarconSession(source, "7", http(detail))
    assert.deepEqual(result.warcon, {
        schemaVersion: 1,
        winner: "Bravo",
        outcome: "decided",
        hasFeed: false,
        scoreTimeline: [
            [0, 0, 0],
            [60, 0, 100],
        ],
        mode: "KingOfTheHill",
        lighting: "Day",
        factions: detail.factions,
    })
    assert.equal(result.players[0].name, detail.lines[0].name)
    assert.equal(result.players[0].faction, "Alpha")
    assert.equal(result.players[0].result, "loss")
    assert.equal(result.players[0].metrics.headshots, null)
})

test("completed-game import rejects duplicate faction metadata even with unique final scores", async () => {
    const detail = warconMatchDetail()
    detail.factions.push({ ...detail.factions[1] })
    detail.timeline = []
    await assert.rejects(
        () => readWarconSession(source, "7", http(detail)),
        invalid
    )
})

test("ended games without final scores remain without a result and unknown player attribution stays null", async () => {
    const detail = {
        ...warconMatchDetail(),
        match: { ...warconMatch(), winner: null, finalScores: null },
        lines: warconMatchDetail().lines.map((p) => ({
            ...p,
            faction: null,
            result: null,
        })),
    }
    const result = await readWarconSession(source, "7", http(detail))
    assert.equal(result.warcon?.outcome, "no_result")
    assert.equal(result.warcon?.winner, null)
    assert.equal(result.players[0].faction, null)
    assert.equal(result.players[0].result, null)
})

test("a detail that loses its end time is rejected rather than published as complete", async () => {
    const detail = warconMatchDetail()
    detail.match.endedAt = null
    detail.match.finalScores = null
    await assert.rejects(
        () => readWarconSession(source, "7", http(detail)),
        invalid
    )
})

test("completed match chronology compares instants across timezone offsets", async () => {
    const detail = warconMatchDetail()
    detail.match.startedAt = "2026-10-02T12:00:00+02:00"
    detail.match.endedAt = "2026-10-02T11:00:00Z"
    const session = await readWarconSession(source, "7", http(detail))
    assert.equal(session.complete, true)
    detail.match.endedAt = "2026-10-02T12:30:00+03:00"
    await assert.rejects(
        () => readWarconSession(source, "7", http(detail)),
        invalid
    )
})
test("disabled kill feed stays explicitly disabled", async () => {
    const result = await readWarcon(
        source,
        { view: "kills", limit: 50 },
        http({
            ok: true,
            configured: false,
            feedAt: null,
            kills: [],
            total: 0,
            token: "secret",
        }),
        now
    )
    assert.equal(result.view, "kills")
    if (result.view !== "kills") return
    assert.equal(result.data.configured, false)
    assert.equal(result.data.total, 0)
    assert.equal(JSON.stringify(result).includes("token"), false)
})
test("career refuses a key that can see additional servers before requesting aggregate data", async () => {
    const paths: string[] = []
    await assert.rejects(
        () =>
            readWarcon(
                source,
                { view: "career", steamId: warconSteamId },
                {
                    get: async (path) => {
                        paths.push(path)
                        return {
                            status: 200,
                            etag: null,
                            body: {
                                ok: true,
                                servers: [
                                    { id: warconServerId },
                                    { id: "another" },
                                ],
                            },
                        }
                    },
                },
                now
            ),
        (e: unknown) =>
            e instanceof ProviderError && e.category === "configuration"
    )
    assert.deepEqual(paths, ["/api/servers"])
})

test("cash history preserves gaps and zero; map filters use catalog IDs rather than display map names", async () => {
    const cash = await readWarcon(
        source,
        warconQuerySchema.parse({ view: "cash" }),
        http({
            ok: true,
            since: warconTime,
            points: [
                { ts: warconTime, total: null, factions: {} },
                { ts: warconTime, total: 0, factions: { Alpha: 0 } },
            ],
        }),
        now
    )
    assert.equal(cash.view, "cash")
    if (cash.view !== "cash") return
    assert.equal(cash.data.points[0].total, null)
    assert.equal(cash.data.points[1].factions.Alpha, 0)
    const calls: string[] = []
    const result = await readWarcon(
        source,
        { view: "experiences", map: "Kavkazi" },
        {
            get: async (path) => {
                calls.push(path)
                return {
                    status: 200,
                    etag: null,
                    body: {
                        ok: true,
                        action: "experiences",
                        result: {
                            experiences: [
                                {
                                    id: "KingOfTheHill",
                                    display: "King of the Hill",
                                },
                            ],
                        },
                    },
                }
            },
        },
        now
    )
    assert.equal(result.view, "experiences")
    assert.match(calls[0], /map=Kavkazi$/)
})
