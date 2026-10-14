import { groupPlayerClans } from "./clan-memberships"
import assert from "node:assert/strict"
import test from "node:test"

test("one clan has distinct game icons even with multiple or repeated assignments", () => {
    assert.deepEqual(
        groupPlayerClans([
            { serverId: "clan", gameId: "wardogs", status: "active" },
            { serverId: "clan", gameId: "hell_let_loose", status: "active" },
            { serverId: "clan", gameId: "wardogs", status: "active" },
        ]),
        [{ serverId: "clan", gameIds: ["hell_let_loose", "wardogs"] }]
    )
})
test("inactive memberships are excluded, legacy game IDs mean HLL, and different clans stay separate", () => {
    assert.deepEqual(
        groupPlayerClans([
            { serverId: "first", status: "active" },
            { serverId: "first", gameId: "wardogs", status: "pending" },
            { serverId: "second", gameId: "wardogs", status: "active" },
        ]),
        [
            { serverId: "first", gameIds: ["hell_let_loose"] },
            { serverId: "second", gameIds: ["wardogs"] },
        ]
    )
    assert.deepEqual(groupPlayerClans([]), [])
})
