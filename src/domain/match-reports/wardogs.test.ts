import { buildWardogsMatchReport, sampleScoreTimeline } from "./wardogs"
import type { ResultRevision } from "../match-results/result-revision"
import type { ProviderSession } from "../game-data/contracts"
import assert from "node:assert/strict"
import test from "node:test"
const session: ProviderSession = {
    externalId: "4",
    complete: true,
    sourceDigest: "a".repeat(64),
    map: "Bakurani",
    startedAt: "2026-10-10T18:00:00Z",
    endedAt: "2026-10-10T20:00:00Z",
    participants: [
        { id: "valkyra", label: "Valkyra", score: 100 },
        { id: "lonestar", label: "Lonestar", score: 50 },
    ],
    players: [
        {
            platform: "steam",
            platformId: "PRIVATE-STEAM",
            name: "Player",
            faction: "Lonestar",
            metrics: { kills: 2, deaths: 28, cashDelta: -100, seconds: 1200 },
        },
    ],
}
const revision: ResultRevision = {
    version: 2,
    status: "confirmed",
    origin: "collected",
    createdAt: "2026-10-11T00:00:00Z",
    reviewedAt: "2026-10-11T00:00:00Z",
    reviewerId: "staff",
    createdBy: "staff",
    supersedesVersion: 1,
    reason: null,
    participants: session.participants,
    sessionLinks: [],
    players: [],
}
test("reports keep reviewed scores, match times, known money and public links without platform IDs", () => {
    const report = buildWardogsMatchReport({
        event: { id: "event", name: "Match", side: "Lonestar" },
        revision,
        sessions: [session],
        profileIds: new Map([["steam:PRIVATE-STEAM", "public-profile"]]),
    })
    assert.equal(report.sides[1].ours, true)
    assert.equal(report.sides[1].faction, "Lonestar")
    assert.equal(report.players[0].kd, 2 / 28)
    assert.equal(report.players[0].money, -100)
    assert.equal(report.players[0].profileId, "public-profile")
    assert.equal(report.endedAt, session.endedAt)
    assert.equal(JSON.stringify(report).includes("PRIVATE-STEAM"), false)
    assert.deepEqual(report.rounds[0].timeline, [])
})
test("partial metrics stay unknown and mixed factions are not attributed to one side", () => {
    const second = {
        ...session,
        players: [
            {
                ...session.players[0],
                faction: "Valkyra",
                metrics: { kills: 0, deaths: null, cashDelta: null },
            },
        ],
    }
    const report = buildWardogsMatchReport({
        event: { id: "event", name: "Match" },
        revision,
        sessions: [session, second],
        profileIds: new Map(),
    })
    assert.equal(report.players[0].kills, 2)
    assert.equal(report.players[0].deaths, null)
    assert.equal(report.players[0].money, null)
    assert.equal(report.players[0].kd, null)
    assert.equal(report.players[0].faction, null)
})
test("large timelines remain bounded and retain first/last real samples", () => {
    const points = Array.from({ length: 1000 }, (_, index) => [
        index,
        index * 2,
    ])
    const sampled = sampleScoreTimeline(points)
    assert.equal(sampled.length, 500)
    assert.deepEqual(sampled[0], points[0])
    assert.deepEqual(sampled.at(-1), points.at(-1))
    assert.throws(() => sampleScoreTimeline(points, 1), /at least two/)
})

test("an unassigned own faction uses the clan presentation without relabeling enemies", () => {
    const report = buildWardogsMatchReport({
        event: {
            id: "event",
            name: "Match",
            side: "Lonestar",
            clan: { name: "Our clan", logoUrl: "https://example.com/logo.png" },
        },
        revision,
        sessions: [session],
        profileIds: new Map(),
    })
    assert.equal(report.sides[1].name, "Our clan")
    assert.equal(report.sides[1].logoUrl, "https://example.com/logo.png")
    assert.equal(report.sides[0].name, "Valkyra")
})
