import {
    nextDraftSquadOrder,
    removeDraftSquad,
    draftSquadKey,
    cloneDraftRoster,
    cloneDraftSquad,
    cloneDraftSquads,
    cloneDraftUserPlacement,
    moveDraftSquad,
    moveDraftSection,
} from "./roster-board-state"
import type { Roster } from "@/types/domain"
import assert from "node:assert/strict"
import test from "node:test"

function fixture(): Roster {
    return {
        id: "draft-roster",
        eventId: "event",
        guildId: "guild",
        createdAt: "2026-11-21",
        updatedAt: "2026-11-21",
        published: false,
        squads: [0, 1, 2].map((order) => ({
            name: "Infantry",
            group: "Infantry",
            order,
            color: "#ffffff",
            players: [{ id: `player-${order}`, ack: true, confirmed: true }],
        })),
        reservePlayerIds: ["reserve"],
        notAttendingPlayerIds: [],
    }
}

test("squad removal shares surviving state, returns players once and stays unpublished", () => {
    const board = fixture()
    board.squads[1].players.push(
        { id: "reserve", ack: false },
        { customName: "Guest", ack: false }
    )
    const result = removeDraftSquad(board, 1)
    assert.deepEqual(result.reservePlayerIds, ["reserve", "player-1"])
    assert.equal(result.squads[0], board.squads[0])
    assert.equal(result.squads[1], board.squads[2])
    assert.deepEqual(
        result.squads.map((squad) => squad.order),
        [0, 2]
    )
    assert.equal(result.published, false)
    assert.equal(board.squads.length, 3)
    assert.deepEqual(board.reservePlayerIds, ["reserve"])
    assert.equal(nextDraftSquadOrder(result.squads), 3)
})

test("invalid removals and removal of the final squad are no-ops", () => {
    const board = fixture()
    for (const index of [-1, 3, 999])
        assert.equal(removeDraftSquad(board, index), board)
    board.squads = [board.squads[0]]
    assert.equal(removeDraftSquad(board, 0), board)
    assert.equal(nextDraftSquadOrder([]), 0)
})

test("duplicate template names and orders have unique stable UI identities", () => {
    const board = fixture()
    board.squads.forEach((squad) => {
        squad.order = 1
    })
    const keys = board.squads.map(draftSquadKey)
    assert.equal(new Set(keys).size, 3)
    const cloned = cloneDraftRoster(board)
    assert.deepEqual(cloned.squads.map(draftSquadKey), keys)
    const result = removeDraftSquad(cloned, 1)
    assert.deepEqual(result.squads.map(draftSquadKey), [keys[0], keys[2]])
    assert.equal(JSON.stringify(cloned), JSON.stringify(board))
})

test("layout reorders preserve the identity of duplicate squads", () => {
    const board = fixture()
    board.squads.forEach((squad) => {
        squad.order = 1
    })
    const keys = board.squads.map(draftSquadKey)
    const result = moveDraftSquad(board.squads, 2, "Infantry", 0)
    assert.deepEqual(result.map(draftSquadKey), [keys[2], keys[0], keys[1]])
    board.squads[2].group = "Armor"
    const sections = moveDraftSection(
        board.squads,
        ["Armor"],
        ["Infantry"],
        "before"
    )
    assert.deepEqual(sections.map(draftSquadKey), [keys[2], keys[0], keys[1]])
})

test("editing a squad only copies that squad and keeps its card identity", () => {
    const board = fixture()
    const key = draftSquadKey(board.squads[1])
    const result = cloneDraftSquad(board, 1)
    result.squads[1].name = "Changed"
    result.squads[1].players[0].roleName = "Changed"
    result.reservePlayerIds.push("returned")
    assert.equal(board.squads[1].name, "Infantry")
    assert.equal(board.squads[1].players[0].roleName, undefined)
    assert.deepEqual(board.reservePlayerIds, ["reserve"])
    assert.equal(result.squads[0], board.squads[0])
    assert.equal(result.squads[2], board.squads[2])
    assert.equal(draftSquadKey(result.squads[1]), key)
    assert.equal(cloneDraftSquad(board, 99), board)
})

test("list-only edits retain every squad and isolate both attendance lists", () => {
    const board = fixture()
    board.notAttendingPlayerIds = ["declined"]
    const result = cloneDraftSquads(board, [])
    result.reservePlayerIds.splice(0, 1)
    result.notAttendingPlayerIds.push("reserve")
    assert.equal(result.squads, board.squads)
    assert.deepEqual(board.reservePlayerIds, ["reserve"])
    assert.deepEqual(board.notAttendingPlayerIds, ["declined"])
})

test("user placement copies both source and target while preserving unrelated squads", () => {
    const board = fixture()
    board.squads[0].players[0].allocatedGuildId = "other-clan"
    board.squads[0].players[0].locked = true
    const keys = board.squads.map(draftSquadKey)
    const result = cloneDraftUserPlacement(board, "player-0", 1)
    assert.notEqual(result.squads[0], board.squads[0])
    assert.notEqual(result.squads[1], board.squads[1])
    assert.equal(result.squads[2], board.squads[2])
    assert.deepEqual(result.squads, board.squads)
    assert.deepEqual(result.squads.map(draftSquadKey), keys)
    result.squads[0].players[0].id = undefined
    result.squads[1].players[0].id = "player-0"
    assert.equal(board.squads[0].players[0].id, "player-0")
    assert.equal(board.squads[1].players[0].id, "player-1")
    assert.equal(result.squads[0].players[0].allocatedGuildId, "other-clan")
    assert.equal(result.squads[0].players[0].locked, true)
})

test("swapping within or between squads copies each affected squad safely", () => {
    const board = fixture()
    for (const indices of [
        [0, 0],
        [0, 2],
    ]) {
        const result = cloneDraftSquads(board, indices)
        for (let index = 0; index < board.squads.length; index++) {
            if (indices.includes(index)) {
                assert.notEqual(
                    result.squads[index].players[0],
                    board.squads[index].players[0]
                )
            } else {
                assert.equal(result.squads[index], board.squads[index])
            }
        }
        assert.deepEqual(result, board)
    }
})

test("adding an unassigned user to a reserve list does not clone squads", () => {
    const board = fixture()
    const result = cloneDraftUserPlacement(board, "new-player")
    result.reservePlayerIds.push("new-player")
    assert.deepEqual(result.squads, board.squads)
    result.squads.forEach((squad, index) =>
        assert.equal(squad, board.squads[index])
    )
    assert.deepEqual(board.reservePlayerIds, ["reserve"])
})
