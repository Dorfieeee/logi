import { competitionEnrollmentPaths } from "./competition-enrollment-openapi"
import assert from "node:assert/strict"
import test from "node:test"
test("competition and mode contracts include actor/key authentication and strict commands", () => {
    const commands = competitionEnrollmentPaths["/clan/competitions"]
    assert.deepEqual(commands.post.security, [
        { clanApiKey: [], ssoActorToken: [] },
    ])
    const schema = commands.post.requestBody.content["application/json"].schema
    assert.equal(schema.additionalProperties, false)
    assert.deepEqual(schema.required, ["action", "competitionId", "teamId"])
    assert.deepEqual(
        competitionEnrollmentPaths["/clan/workspace-mode"].patch.security,
        commands.post.security
    )
    assert.ok(commands.post.responses["403"])
})
