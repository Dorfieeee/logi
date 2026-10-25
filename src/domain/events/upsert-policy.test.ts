import { emptyTacticalPlan } from "./tactical-plan"
import assert from "node:assert/strict"
import test from "node:test"

import type { MatchTeamAssignment } from "@/domain/teams/match-teams"

import {
    buildCreateEventRecord,
    buildEventBasePayload,
    buildUpdateEventPatch,
    type EventUpsertInput,
} from "./upsert-policy"

const now = new Date("2026-10-04T12:00:00.000Z")
const input: EventUpsertInput = {
    guildId: "guild-a",
    gameId: "hell_let_loose",
    kind: "match",
    name: "Fixture match",
    registrationEnd: "2030-01-01T17:00:00.000Z",
    meetingStart: "2030-01-01T18:00:00.000Z",
    gameStart: "2030-01-01T18:30:00.000Z",
    gameEnd: "2030-01-01T20:00:00.000Z",
    pingClan: false,
}

test("Wardogs time and planning metadata validate, persist and explicitly clear", () => {
    const plan = emptyTacticalPlan("bakurani")
    const wd = {
        ...input,
        gameId: "wardogs" as const,
        map: "bakurani",
        timeOfDay: "night",
        tacticalPlan: plan,
    }
    const saved = buildCreateEventRecord(wd, now)
    assert.equal(saved.timeOfDay, "night")
    assert.deepEqual(saved.tacticalPlan, plan)
    const cleared = buildUpdateEventPatch(
        saved,
        { ...wd, timeOfDay: "", tacticalPlan: null },
        now
    )
    assert.equal(cleared.timeOfDay, undefined)
    assert.equal(cleared.tacticalPlan, undefined)
    assert.equal("tacticalPlan" in cleared, true)
    assert.throws(
        () => buildCreateEventRecord({ ...wd, map: "ozeti" }, now),
        /selected Wardogs map/
    )
    assert.throws(
        () => buildCreateEventRecord({ ...wd, gameId: "hell_let_loose" }, now),
        /selected Wardogs map/
    )
    assert.throws(() =>
        buildCreateEventRecord({ ...wd, timeOfDay: "not-a-time" }, now)
    )
})

test("omitting a plan preserves it only while editing the same map", () => {
    const existing = {
        ...input,
        gameId: "wardogs" as const,
        map: "bakurani",
        tacticalPlan: emptyTacticalPlan("bakurani"),
    }
    const same = buildUpdateEventPatch(
        existing,
        { ...input, gameId: "wardogs", map: "bakurani" },
        now
    )
    assert.equal("tacticalPlan" in same, false)
    const changed = buildUpdateEventPatch(
        existing,
        { ...input, gameId: "wardogs", map: "ozeti" },
        now
    )
    assert.equal("tacticalPlan" in changed, true)
    assert.equal(changed.tacticalPlan, undefined)
})
const assignment: MatchTeamAssignment = {
    teamId: "teamDirectory:alpha",
    slot: "a",
    side: "Allies",
    snapshot: {
        name: "Alpha",
        shortCode: "ALP",
        logoAssetId: "imageAssets:logo",
        logoUrl: "https://logi.test/api/image-assets/logo.png",
        teamRevision: 1,
        capturedAt: "2026-10-04T11:00:00.000Z",
    },
}

test("base payload never carries match teams; create stores only resolved assignments", () => {
    assert.equal("matchTeams" in buildEventBasePayload(input), false)
    assert.equal(
        "matchTeams" in buildCreateEventRecord(input, now),
        false,
        "a create without assignments stays a legacy-shaped record"
    )
    const created = buildCreateEventRecord(
        { ...input, matchTeams: [assignment] },
        now
    )
    assert.deepEqual(created.matchTeams, [assignment])
    assert.deepEqual(
        buildCreateEventRecord({ ...input, matchTeams: [] }, now).matchTeams,
        []
    )
})

test("update preserves saved assignments when omitted and clears them with an explicit empty list", () => {
    const existing = {
        ...input,
        status: "registration" as const,
        matchTeams: [assignment],
    }
    const preserved = buildUpdateEventPatch(existing, input, now)
    assert.deepEqual(preserved.matchTeams, [assignment])
    const replaced = buildUpdateEventPatch(
        existing,
        { ...input, matchTeams: [{ ...assignment, slot: "b", side: null }] },
        now
    )
    assert.deepEqual(replaced.matchTeams, [
        { ...assignment, slot: "b", side: null },
    ])
    const cleared = buildUpdateEventPatch(
        existing,
        { ...input, matchTeams: [] },
        now
    )
    assert.deepEqual(cleared.matchTeams, [])
    const legacy = buildUpdateEventPatch(
        { ...input, status: "registration" },
        input,
        now
    )
    assert.equal(legacy.matchTeams, undefined)
})

test("update keeps the template settings it is not sent", () => {
    const existing = {
        ...input,
        status: "registration" as const,
        signupGroupIds: ["g1", "g2"],
        signupGroupLimits: [{ groupId: "g2", max: 6 }],
        attendanceReminderHours: [24, 6],
        createParticipantRoles: false,
        squadPresetId: "squadPresets:a",
    }
    const patch = buildUpdateEventPatch(
        existing,
        { ...input, signupGroupIds: ["g1", "g2"] },
        now
    )
    for (const key of [
        "signupGroupLimits",
        "attendanceReminderHours",
        "createParticipantRoles",
        "squadPresetId",
    ])
        assert.equal(key in patch, false, `${key} is preserved by omission`)
})

test("update changes caps, reminder offsets, participant roles and the squad preset", () => {
    const existing = { ...input, status: "registration" as const }
    const patch = buildUpdateEventPatch(
        existing,
        {
            ...input,
            signupGroupIds: ["g1", "g2"],
            signupGroupLimits: [
                { groupId: "g2", max: 4 },
                // A cap of a group the match does not offer is dropped.
                { groupId: "g9", max: 3 },
                { groupId: "g1", max: 0 },
            ],
            attendanceReminderHours: [6, 24, 5],
            createParticipantRoles: false,
            squadPresetId: " squadPresets:b ",
        },
        now
    )
    assert.deepEqual(patch.signupGroupLimits, [{ groupId: "g2", max: 4 }])
    assert.deepEqual(patch.attendanceReminderHours, [24, 6])
    assert.equal(patch.createParticipantRoles, false)
    assert.equal(patch.squadPresetId, "squadPresets:b")
})

test("update clears caps, reminders and the preset with empty values", () => {
    const existing = {
        ...input,
        status: "registration" as const,
        signupGroupLimits: [{ groupId: "g2", max: 6 }],
        attendanceReminderHours: [24],
        squadPresetId: "squadPresets:a",
    }
    const patch = buildUpdateEventPatch(
        existing,
        {
            ...input,
            signupGroupIds: ["g2"],
            signupGroupLimits: [],
            attendanceReminderHours: [],
            squadPresetId: "",
        },
        now
    )
    // A present key holding undefined removes the stored field.
    assert.equal("signupGroupLimits" in patch, true)
    assert.equal(patch.signupGroupLimits, undefined)
    assert.deepEqual(patch.attendanceReminderHours, [])
    assert.equal("squadPresetId" in patch, true)
    assert.equal(patch.squadPresetId, undefined)
})

test("a training update never stores caps or a squad preset", () => {
    const training = { ...input, kind: "training" as const }
    const patch = buildUpdateEventPatch(
        { ...training, status: "registration" },
        {
            ...training,
            signupGroupIds: ["g1"],
            signupGroupLimits: [{ groupId: "g1", max: 3 }],
            squadPresetId: "squadPresets:a",
            attendanceReminderHours: [12],
            createParticipantRoles: true,
        },
        now
    )
    assert.equal(patch.signupGroupLimits, undefined)
    assert.equal(patch.squadPresetId, undefined)
    assert.deepEqual(patch.attendanceReminderHours, [12])
    assert.equal(patch.createParticipantRoles, true)
})

test("forum cleanup defaults on for new matches and preserves legacy values on update", () => {
    assert.equal(
        buildCreateEventRecord(input, now).deleteForumAfterConclusion,
        true
    )
    assert.equal(
        buildCreateEventRecord({ ...input, kind: "training" }, now)
            .deleteForumAfterConclusion,
        false
    )
    const saved = buildCreateEventRecord(
        { ...input, deleteForumAfterConclusion: false },
        now
    )
    assert.equal(saved.deleteForumAfterConclusion, false)
    assert.equal(
        "deleteForumAfterConclusion" in
            buildUpdateEventPatch(saved, input, now),
        false
    )
    assert.equal(
        buildUpdateEventPatch(
            saved,
            { ...input, deleteForumAfterConclusion: true },
            now
        ).deleteForumAfterConclusion,
        true
    )
})

test("results routing is a trimmed creation-time choice just like event info", () => {
    const saved = buildCreateEventRecord(
        { ...input, eventResultsChannelId: "  results-one  " },
        now
    )
    assert.equal(saved.eventResultsChannelId, "results-one")
    const edited = buildUpdateEventPatch(
        saved,
        { ...input, eventResultsChannelId: "results-two" },
        now
    )
    assert.equal(edited.eventResultsChannelId, "results-one")
    assert.equal(
        buildCreateEventRecord(
            {
                ...input,
                kind: "training",
                eventResultsChannelId: "results-one",
            },
            now
        ).eventResultsChannelId,
        undefined
    )
})
