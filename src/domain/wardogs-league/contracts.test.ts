import {
    leagueMatchSchema,
    leagueResultsSchema,
    leagueSnapshotSchema,
    losesMatchStructure,
} from "./contracts"
import {
    completedLeagueSnapshot,
    leagueSnapshotFixture,
} from "../../infrastructure/testing/league-fixtures"
import assert from "node:assert/strict"
import test from "node:test"

test("results are null until parsed, and parsed placements validate", () => {
    assert.ok(leagueSnapshotSchema.parse(leagueSnapshotFixture()))
    const done = completedLeagueSnapshot({
        id: "m1",
        fixtureNumber: 1,
        scheduledAt: null,
        podium: ["ROG", "VLK", "DEF"],
    })
    assert.deepEqual(leagueSnapshotSchema.parse(done).results, {
        placements: [
            { place: 1, teamCode: "ROG" },
            { place: 2, teamCode: "VLK" },
            { place: 3, teamCode: "DEF" },
        ],
        confirmed: true,
    })
})

test("verified final layouts can omit preparation metadata without weakening identity, time or results", () => {
    const previous = leagueSnapshotFixture()
    const teams = previous.teams!.slice(0, 2).map((team) => ({
        ...team,
        nations: null,
        displayedMemberCount: null,
        readyCheck: null,
    }))
    const next = {
        ...previous,
        status: "Set by admin",
        teams,
        map: null,
        hosting: null,
        mapVote: null,
        rules: null,
        progress: [
            { label: "Placements", state: "done" as const, detail: "0/3" },
            {
                label: "Set by admin",
                state: "done" as const,
                detail: "Overridden",
            },
        ],
        results: {
            placements: [
                { place: 2, teamCode: teams[0].code },
                { place: 3, teamCode: teams[1].code },
            ],
            confirmed: true,
        },
    }
    assert.equal(losesMatchStructure(previous, next), false)
    for (const invalid of [
        { ...next, id: "foreign" },
        { ...next, sourceUrl: "https://wardogsleague.net/matches/foreign" },
        { ...next, scheduledAt: null },
        { ...next, status: "Disputed" },
        { ...next, results: { ...next.results, confirmed: false } },
        {
            ...next,
            results: {
                ...next.results,
                placements: next.results.placements.slice(1),
            },
        },
        {
            ...next,
            teams: [
                { ...teams[0], profileUrl: "https://foreign.invalid/team" },
                teams[1],
            ],
        },
        {
            ...next,
            progress: [
                { label: "Set by admin", state: "done" as const, detail: null },
            ],
        },
    ])
        assert.equal(losesMatchStructure(previous, invalid), true)
    assert.equal(losesMatchStructure(next, { ...next, results: null }), true)
    assert.equal(
        losesMatchStructure(next, {
            ...next,
            results: { ...next.results, confirmed: false },
        }),
        true
    )
})

test("a team cannot finish twice, places are 1–20 and results need a team", () => {
    const valid = {
        placements: [
            { place: 1, teamCode: "ROG" },
            { place: 1, teamCode: "VLK" },
        ],
        confirmed: false,
    }
    assert.ok(leagueResultsSchema.parse(valid))
    for (const invalid of [
        {
            ...valid,
            placements: [
                { place: 1, teamCode: "ROG" },
                { place: 2, teamCode: "ROG" },
            ],
        },
        { ...valid, placements: [{ place: 0, teamCode: "ROG" }] },
        { ...valid, placements: [{ place: 21, teamCode: "ROG" }] },
        { ...valid, placements: [] },
        { placements: valid.placements },
    ])
        assert.equal(leagueResultsSchema.safeParse(invalid).success, false)
    assert.equal(
        leagueMatchSchema.safeParse({
            ...leagueSnapshotFixture(),
            results: { placements: [], confirmed: true },
        }).success,
        false
    )
})

test("losing published placements on a later read is structure loss, not a reset", () => {
    const done = completedLeagueSnapshot({
        id: "m1",
        fixtureNumber: 1,
        scheduledAt: "2026-10-01T18:00:00.000Z",
        podium: ["ROG", "VLK", "DEF"],
    })
    assert.equal(losesMatchStructure(done, { ...done, results: null }), true)
    assert.equal(
        losesMatchStructure(leagueSnapshotFixture(), {
            ...leagueSnapshotFixture(),
            results: done.results,
        }),
        false
    )
})
