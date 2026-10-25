import {
    refreshAssignedMatchTeam,
    type RefreshableEvent,
} from "./refresh-match-team.use-case"
import { InMemoryMatchTeamSnapshots } from "@/infrastructure/testing/in-memory-team-directory"
import type { DirectoryTeamLookup } from "@/domain/teams/match-teams"
import assert from "node:assert/strict"
import test from "node:test"

const now = new Date("2026-10-04T12:00:00.000Z")
const team: DirectoryTeamLookup = {
    id: "team-1",
    gameId: "hell_let_loose",
    name: "Alpha Prime",
    shortCode: "APX",
    logoAssetId: "asset-2",
    logoUrl: "https://logi.test/api/image-assets/b.png",
    revision: 2,
    archivedAt: null,
}
const assignment = {
    teamId: "team-1",
    slot: "a" as const,
    side: "Allies",
    snapshot: {
        name: "Alpha",
        shortCode: null,
        logoAssetId: null,
        logoUrl: null,
        teamRevision: 1,
        capturedAt: "2026-10-01T00:00:00.000Z",
    },
}
const event: RefreshableEvent = {
    id: "event-1",
    gameId: "hell_let_loose",
    kind: "match",
    status: "registration",
    registrationEnd: "2030-01-01T17:00:00.000Z",
    meetingStart: "2030-01-01T18:00:00.000Z",
    gameEnd: "2030-01-01T20:00:00.000Z",
    matchTeams: [assignment],
}
const run = (
    ports: InMemoryMatchTeamSnapshots,
    overrides: Partial<RefreshableEvent> = {},
    teamId = "team-1"
) =>
    refreshAssignedMatchTeam(ports, {
        event: { ...event, ...overrides },
        teamId,
        actor: "100000000000000001",
        now,
    })

test("a refresh re-captures the active entry, keeps slot and side, saves and audits", async () => {
    const ports = new InMemoryMatchTeamSnapshots(new Map([["team-1", team]]))
    const result = await run(ports)
    assert.equal(result.ok, true)
    const saved = ports.saved.get("event-1")
    assert.equal(saved?.at, now.toISOString())
    assert.deepEqual(saved?.matchTeams, [
        {
            teamId: "team-1",
            slot: "a",
            side: "Allies",
            snapshot: {
                name: "Alpha Prime",
                shortCode: "APX",
                logoAssetId: "asset-2",
                logoUrl: team.logoUrl,
                teamRevision: 2,
                capturedAt: now.toISOString(),
            },
        },
    ])
    assert.deepEqual(ports.audits, [
        {
            teamId: "team-1",
            actor: "100000000000000001",
            eventId: "event-1",
        },
    ])
})

test("training, unassigned, archived and cross-game refreshes write nothing", async () => {
    const cases: [
        Map<string, DirectoryTeamLookup>,
        Partial<RefreshableEvent>,
        string,
        string,
    ][] = [
        [
            new Map([["team-1", team]]),
            { kind: "training" },
            "team-1",
            "training_event",
        ],
        [new Map([["team-1", team]]), {}, "team-9", "team_not_found"],
        [
            new Map([
                ["team-1", { ...team, archivedAt: "2026-10-02T00:00:00.000Z" }],
            ]),
            {},
            "team-1",
            "team_archived",
        ],
        [
            new Map([["team-1", { ...team, gameId: "wardogs" }]]),
            {},
            "team-1",
            "team_game_mismatch",
        ],
        [
            new Map([["team-1", team]]),
            { gameId: "hell_let_loose_vietnam" },
            "team-1",
            "team_game_mismatch",
        ],
    ]
    for (const [directory, overrides, teamId, error] of cases) {
        const ports = new InMemoryMatchTeamSnapshots(directory)
        assert.deepEqual(await run(ports, overrides, teamId), {
            ok: false,
            error,
        })
        assert.equal(ports.saved.size, 0)
        assert.equal(ports.audits.length, 0)
    }
})

test("a merged team refreshes to its replacement and audits the replacement", async () => {
    const ports = new InMemoryMatchTeamSnapshots(
        new Map([["team-1", { ...team, id: "team-2", name: "Alpha United" }]])
    )
    const result = await run(ports)
    assert.ok(result.ok)
    assert.equal(result.matchTeams[0]?.teamId, "team-2")
    assert.equal(result.matchTeams[0]?.snapshot.name, "Alpha United")
    assert.deepEqual(ports.audits, [
        {
            teamId: "team-2",
            actor: "100000000000000001",
            eventId: "event-1",
        },
    ])
})
