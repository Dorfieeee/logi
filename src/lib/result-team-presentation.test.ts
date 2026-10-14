import type { MatchTeamAssignment } from "@/domain/teams/match-teams"
import { resultTeamFor } from "./result-team-presentation"
import assert from "node:assert/strict"
import test from "node:test"

function team(
    slot: MatchTeamAssignment["slot"],
    name: string,
    side: string | null
): MatchTeamAssignment {
    return {
        slot,
        teamId: name,
        side,
        snapshot: {
            name,
            shortCode: name,
            logoAssetId: null,
            logoUrl: `${name}.png`,
            teamRevision: 1,
            capturedAt: "2026-10-14",
        },
    }
}

test("Wardogs provider order cannot duplicate an enemy or hide the clan team", () => {
    const ours = team("a", "Our clan", "Lonestar")
    const enemy = team("b", "Rogue", "Manticore")
    const third = team("c", "Polish", "Valkyra")
    const teams = [ours, enemy, third]
    assert.deepEqual(
        ["Valkyra", "Manticore", "Lonestar"].map((id, index) =>
            resultTeamFor({ id, label: id, index, teams })
        ),
        [third, enemy, ours]
    )
})

test("missing faction assignment does not borrow an enemy logo", () => {
    const teams = [
        team("a", "Polish", "Valkyra"),
        team("b", "Rogue", "Manticore"),
    ]
    assert.equal(
        resultTeamFor({ id: "Lonestar", label: "Lonestar", index: 1, teams }),
        undefined
    )
    assert.equal(
        resultTeamFor({ id: "axis", label: "Axis", index: 0, teams }),
        undefined
    )
})

test("manual names match snapshots and unnamed sides can use unassigned slots", () => {
    const ours = team("a", "Our clan", null)
    const enemy = team("b", "Rogue", "Axis")
    assert.equal(
        resultTeamFor({
            id: "manual",
            label: " rogue ",
            index: 0,
            teams: [ours, enemy],
        }),
        enemy
    )
    assert.equal(
        resultTeamFor({
            id: "manual",
            label: "Participant",
            index: 0,
            teams: [ours, enemy],
        }),
        ours
    )
    assert.equal(
        resultTeamFor({
            id: "manual",
            label: "Participant",
            index: 1,
            teams: [ours, enemy],
        }),
        undefined
    )
})
