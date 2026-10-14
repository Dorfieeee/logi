import type { ProviderSession } from "../game-data/contracts"
import { wardogsPlayerMetrics } from "./collected-metrics"
import { playerStatProfile } from "./game-metrics"
import assert from "node:assert/strict"
import test from "node:test"

test("HLL Vietnam shares HLL's metrics; Wardogs and unsupported games have distinct contracts", () => {
    assert.equal(
        playerStatProfile("hell_let_loose_vietnam"),
        playerStatProfile("hell_let_loose")
    )
    assert.deepEqual(playerStatProfile("wardogs")?.fields, [
        "kills",
        "kd",
        "deaths",
        "cashDelta",
    ])
    assert.equal(playerStatProfile("world_of_warcraft_forever"), null)
    assert.equal(playerStatProfile("future-game"), null)
    assert.equal(playerStatProfile("constructor"), null)
    assert.equal(playerStatProfile("__proto__"), null)
    assert.equal(
        playerStatProfile(undefined),
        playerStatProfile("hell_let_loose")
    )
})
function session(
    kills: number | null,
    deaths: number | null,
    cashDelta: number | null
): ProviderSession {
    return {
        externalId: "1",
        startedAt: null,
        endedAt: null,
        complete: true,
        map: "Bakurani",
        participants: [],
        sourceDigest: "a".repeat(64),
        players: [
            {
                platform: "steam",
                platformId: "123",
                name: "Player",
                faction: "Lonestar",
                metrics: { kills, deaths, cashDelta },
            },
        ],
    }
}
test("collected Wardogs metrics aggregate signed money and preserve zero", () => {
    assert.deepEqual(
        wardogsPlayerMetrics([session(10, 0, -150), session(2, 4, 0)])[0],
        {
            platformId: "123",
            name: "Player",
            faction: "Lonestar",
            kills: 12,
            deaths: 4,
            cashDelta: -150,
        }
    )
})
test("unknown money is not converted to zero; incomplete K/D is not invented", () => {
    assert.equal(
        wardogsPlayerMetrics([session(10, 5, null)])[0]?.cashDelta,
        null
    )
    assert.equal(
        wardogsPlayerMetrics([session(10, 5, 200), session(2, 1, null)])[0]
            ?.cashDelta,
        null
    )
    assert.deepEqual(wardogsPlayerMetrics([session(null, 2, 20)]), [])
})
