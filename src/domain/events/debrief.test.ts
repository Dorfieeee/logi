import { debriefParentChannelId, debriefParticipantIds } from "./debrief"
import assert from "node:assert/strict"
import test from "node:test"

test("debrief parent uses results, info, registration, with per-event overrides", () => {
    const config = {
        eventResultsChannelId: "results",
        eventInfoChannelId: "info",
        announcementsChannelId: "signup",
    }
    assert.equal(debriefParentChannelId({}, config), "results")
    assert.equal(
        debriefParentChannelId({ eventResultsChannelId: "override" }, config),
        "override"
    )
    assert.equal(
        debriefParentChannelId({ eventInfoChannelId: "override" }, config),
        "results"
    )
    assert.equal(
        debriefParentChannelId(
            { eventInfoChannelId: "override" },
            { announcementsChannelId: "signup" }
        ),
        "override"
    )
    assert.equal(
        debriefParentChannelId({}, { announcementsChannelId: "signup" }),
        "signup"
    )
    assert.equal(debriefParentChannelId({}, {}), undefined)
})

test("participants include roster and confirmed reserves, deduplicate and exclude explicit absences", () => {
    assert.deepEqual(
        debriefParticipantIds(
            {
                participants: [
                    { userId: "signup", status: "attending" },
                    { userId: "no", status: "not_attending" },
                    { userId: "absent", status: "attending" },
                ],
                absenceNotices: [{ userId: "absent", kind: "cannot_come" }],
            },
            {
                squads: [
                    {
                        players: [
                            { id: "signup" },
                            { id: "rostered" },
                            {},
                            { id: "no" },
                            { id: "excluded" },
                        ],
                    },
                ],
                notAttendingPlayerIds: ["excluded"],
                reserveAttendances: [
                    { userId: "reserve", confirmed: true },
                    { userId: "unused" },
                ],
            }
        ),
        ["signup", "rostered", "reserve"]
    )
    assert.deepEqual(debriefParticipantIds({ participants: [] }), [])
})
