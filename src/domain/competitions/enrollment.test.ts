import {
    checkClanEnrollment,
    enrollmentPolicy,
    isApprovedRegistration,
} from "./enrollment"
import { minimumLinkedPlayersSchema } from "./enrollment.schema"
import assert from "node:assert/strict"
import test from "node:test"
const eligible = {
    published: true,
    registrationMode: "automatic" as const,
    minimumLinkedPlayers: 49,
    linkedPlayers: 49,
    teamLinked: true,
    teamActive: true,
    gameMatches: true,
}
test("legacy competitions stay closed; legacy registrations stay approved", () => {
    assert.deepEqual(enrollmentPolicy({}), {
        registrationMode: "closed",
        minimumLinkedPlayers: null,
    })
    assert.equal(isApprovedRegistration({}), true)
    assert.equal(isApprovedRegistration({ status: "pending" }), false)
    assert.equal(isApprovedRegistration({ status: "rejected" }), false)
})
test("optional minimums, exact thresholds and both signup policies", () => {
    assert.equal(checkClanEnrollment(eligible), null)
    assert.equal(
        checkClanEnrollment({ ...eligible, linkedPlayers: 48 }),
        "minimum_players"
    )
    assert.equal(
        checkClanEnrollment({ ...eligible, registrationMode: "approval" }),
        null
    )
    assert.equal(
        checkClanEnrollment({
            ...eligible,
            minimumLinkedPlayers: 30,
            linkedPlayers: 30,
        }),
        null
    )
    assert.equal(
        checkClanEnrollment({
            ...eligible,
            minimumLinkedPlayers: null,
            linkedPlayers: 0,
        }),
        null
    )
})
test("closed, unpublished, foreign, archived and wrong-game teams fail", () => {
    assert.equal(
        checkClanEnrollment({ ...eligible, registrationMode: "closed" }),
        "registration_closed"
    )
    assert.equal(
        checkClanEnrollment({ ...eligible, published: false }),
        "registration_closed"
    )
    assert.equal(
        checkClanEnrollment({ ...eligible, teamLinked: false }),
        "team_not_owned"
    )
    assert.equal(
        checkClanEnrollment({ ...eligible, teamActive: false }),
        "team_archived"
    )
    assert.equal(
        checkClanEnrollment({ ...eligible, gameMatches: false }),
        "team_game_mismatch"
    )
})
test("minimums reject zero, negative, fractional and unbounded input", () => {
    for (const input of [0, -1, 1.5, 1001, "49", NaN])
        assert.equal(minimumLinkedPlayersSchema.safeParse(input).success, false)
    for (const input of [null, 1, 49, 1000])
        assert.equal(minimumLinkedPlayersSchema.safeParse(input).success, true)
})
