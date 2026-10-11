import assert from "node:assert/strict"
import { GET } from "./route"
import test from "node:test"

test("roster API documents section moves, ordering and the complete editable player shape", async () => {
    const document = await (await GET()).json()
    const squads =
        document.paths["/clan/rosters/{id}"].patch.requestBody.content[
            "application/json"
        ].schema.properties.squads
    assert.match(squads.description, /first squad/)
    assert.match(squads.description, /Changing group/)
    assert.deepEqual(squads.items.required, [
        "name",
        "group",
        "order",
        "color",
        "players",
    ])
    assert.equal(
        squads.items.properties.players.items.properties.id.type,
        "string"
    )
    assert.equal(
        squads.items.properties.players.items.properties.roleName.type,
        "string"
    )
})
