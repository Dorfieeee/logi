import { parseSources } from "../../domain/game-data/policy.schema"
import { readHllSessionPage, readHllSession } from "./hll-sessions"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
const source = parseSources(
    JSON.stringify([
        {
            ref: "hll",
            guildId: "guild",
            gameId: "hell_let_loose",
            provider: "hll_crcon",
            providerServerId: "1",
            origin: "https://crcon.example.test",
            secretRef: null,
        },
    ])
)[0]
const wire = JSON.parse(
    readFileSync(
        new URL("./fixtures/hll/session.json", import.meta.url),
        "utf8"
    )
)
test("HLL session discovery pins server/page/limit and never trusts another server's records", async () => {
    const page = await readHllSessionPage(source, 2, {
        get: async (path) => {
            const url = new URL(path, source.origin)
            assert.equal(url.searchParams.get("page"), "2")
            assert.equal(url.searchParams.get("limit"), "10")
            assert.equal(url.searchParams.get("server_number"), "1")
            return {
                status: 200,
                etag: null,
                body: {
                    failed: false,
                    result: {
                        page: 2,
                        page_size: 10,
                        total: 21,
                        maps: [{ id: 42, server_number: 1 }],
                    },
                },
            }
        },
    })
    assert.deepEqual(page, { ids: ["42"], nextPage: 3 })
    await assert.rejects(
        readHllSessionPage(source, 1, {
            get: async () => ({
                status: 200,
                etag: null,
                body: {
                    failed: false,
                    result: {
                        page: 1,
                        page_size: 10,
                        total: 1,
                        maps: [{ id: 42, server_number: 2 }],
                    },
                },
            }),
        }),
        /invalid_response/
    )
})
test("unfinished HLL sessions stay provisional and same nicknames never link people", async () => {
    const session = await readHllSession(source, "42", {
        get: async (path) => {
            assert.equal(path, "/api/get_map_scoreboard?map_id=42")
            return { body: wire, status: 200, etag: null }
        },
    })
    assert.equal(session.complete, false)
    assert.equal(session.startedAt, "2030-01-01T00:00:00.000Z")
    assert.deepEqual(
        session.participants.map((team) => team.score),
        [0, 5]
    )
    assert.deepEqual(
        session.players.map((player) => player.platformId),
        ["76561198000000001", "76561198000000002"]
    )
    assert.equal(session.players[0].name, "Same nickname")
    assert.equal(session.players[1].name, "Same nickname")
    assert.equal(JSON.stringify(session).includes("steaminfo"), false)
    assert.equal("userId" in session.players[0], false)
    assert.equal(session.sourceDigest.length, 64)
    await assert.rejects(
        readHllSession(source, "43", {
            get: async () => ({ body: wire, status: 200, etag: null }),
        }),
        /invalid_response/
    )
})
