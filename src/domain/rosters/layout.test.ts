import {
    firstAvailableRosterSlot,
    moveRosterSection,
    moveRosterSquad,
    rosterSectionOrder,
} from "./layout"
import type { RosterSquad } from "./types"
import assert from "node:assert/strict"
import test from "node:test"

const squad = (name: string, group: string, order: number): RosterSquad => ({
    name,
    group,
    order,
    color: "#ffffff",
    players: [
        {
            id: name,
            ack: true,
            confirmed: true,
            roleName: "Leader",
            note: "Keep",
        },
    ],
})
const fixture = () => [
    squad("FL1", "Infantry", 0),
    squad("T1", "Tanks", 1),
    squad("FL4", "Other", 2),
]

test("FL4 moves before infantry with all player and role information preserved", () => {
    const input = fixture()
    const result = moveRosterSquad(input, 2, "Infantry", 0)
    assert.deepEqual(
        result.map(({ name, group, order }) => ({ name, group, order })),
        [
            { name: "FL4", group: "Infantry", order: 0 },
            { name: "FL1", group: "Infantry", order: 1 },
            { name: "T1", group: "Tanks", order: 2 },
        ]
    )
    assert.deepEqual(result[0].players, input[2].players)
    assert.equal(input[2].group, "Other")
    assert.deepEqual(
        input.map((item) => item.order),
        [0, 1, 2]
    )
})

test("group drop appends within that group; invalid and self drops are no-ops", () => {
    const input = fixture()
    assert.deepEqual(
        moveRosterSquad(input, 2, "Infantry").map((item) => item.name),
        ["FL1", "FL4", "T1"]
    )
    for (const args of [
        [9, "Infantry", 0],
        [0, "", 1],
        [0, "Tanks", 9],
        [0, "Infantry", 0],
    ] as const)
        assert.deepEqual(
            moveRosterSquad(input, args[0], args[1], args[2]),
            input
        )
})

test("sections move with child groups and persist as contiguous squad order", () => {
    const input = [...fixture(), squad("Recon", "Scouts", 3)]
    const result = moveRosterSection(input, ["Other", "Scouts"], ["Infantry"])
    assert.deepEqual(
        result.map((item) => item.name),
        ["FL4", "Recon", "FL1", "T1"]
    )
    assert.equal(rosterSectionOrder(result, ["Other", "Scouts"]), 0)
    assert.equal(rosterSectionOrder(result, ["Infantry"]), 2)
    assert.deepEqual(
        moveRosterSection(
            result,
            ["Other", "Scouts"],
            ["Infantry"],
            "after"
        ).map((item) => item.name),
        ["FL1", "FL4", "Recon", "T1"]
    )
    assert.deepEqual(
        moveRosterSection(input, ["Infantry"], ["Infantry"]),
        input
    )
})

test("team drop skips named guests and assigned players, and reports a full squad", () => {
    const input = squad("FL1", "Infantry", 0)
    assert.equal(firstAvailableRosterSlot(input), -1)
    input.players.push(
        { ack: false, customName: "Guest" },
        { ack: false, roleName: "Medic" }
    )
    assert.equal(firstAvailableRosterSlot(input), 2)
})
