import assert from "node:assert/strict"
import test from "node:test"

import {
    websiteEventCommandPaths,
    websiteEventCommandSchemas,
} from "./website-event-command-openapi"

test("OpenAPI exposes the same planned map and time fields for writes and reads", () => {
    for (const schema of [
        websiteEventCommandSchemas.WebsiteEventCommand,
        websiteEventCommandSchemas.WebsiteEventEditor,
    ]) {
        const json = JSON.stringify(schema)
        for (const field of [
            "deleteForumAfterConclusion",
            "timeOfDay",
            "tacticalPlan",
            "controlZone",
            "hotZone",
            "layout",
            "radius",
        ])
            assert.ok(json.includes(`"${field}"`), field)
    }
})

test("OpenAPI exposes actor-backed deletion with revision fencing and Discord cleanup", () => {
    const schema = JSON.stringify(
        websiteEventCommandSchemas.WebsiteEventCommand
    )
    assert.ok(schema.includes('"delete"'))
    assert.ok(
        JSON.stringify(websiteEventCommandSchemas.WebsiteEventReceipt).includes(
            '"delete"'
        )
    )
    assert.match(
        websiteEventCommandPaths["/clan/event-commands"].post.description,
        /Discord cleanup/
    )
})

test("event command OpenAPI documents team selections, the refresh operation and invalid_match_teams", () => {
    const post = websiteEventCommandPaths["/clan/event-commands"].post
    assert.match(post.responses["400"].description, /invalid_match_teams/)
    assert.match(post.description, /Omitting matchTeams preserves/)
    assert.match(post.description, /explicit \[\] clears/)
    assert.match(post.description, /refresh_match_team/)
    assert.match(
        post.description,
        /Updates remain available after meeting start and conclusion/
    )
    assert.match(post.responses["200"].description, /team snapshot refresh/)
    const schema = JSON.stringify(
        websiteEventCommandSchemas.WebsiteEventCommand
    )
    for (const fragment of ['"refresh_match_team"', '"matchTeams"', '"teamId"'])
        assert.ok(schema.includes(fragment), fragment)
    assert.equal(schema.includes('"snapshot"'), false)
    const editor = websiteEventCommandSchemas.WebsiteEventEditor as {
        required?: string[]
        properties: Record<string, unknown>
    }
    assert.ok(editor.required?.includes("matchTeams"))
    assert.equal(JSON.stringify(editor).includes("logoAssetId"), false)
    assert.ok(
        JSON.stringify(websiteEventCommandSchemas.WebsiteEventReceipt).includes(
            '"refresh_match_team"'
        )
    )
})
