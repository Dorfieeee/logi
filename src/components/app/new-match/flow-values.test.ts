import { emptyTacticalPlan } from "@/domain/events/tactical-plan"
import assert from "node:assert/strict"
import test from "node:test"

import type { MatchTeamAssignment } from "@/domain/teams/match-teams"
import type { EventRecord, Group } from "@/types/domain"

import {
    flowEditPayload,
    flowEventPayload,
    flowMapCode,
    flowSchedule,
    flowValuesFromEvent,
    newFlowValues,
    scheduleIsCoherent,
    type FlowValues,
} from "./flow-values"

const zone = "Europe/Prague"

function team(
    slot: "a" | "b" | "c",
    teamId: string,
    side: string | null,
    name: string
): MatchTeamAssignment {
    return {
        teamId,
        slot,
        side,
        snapshot: {
            name,
            shortCode: name.slice(0, 3).toUpperCase(),
            logoAssetId: null,
            logoUrl: null,
            teamRevision: 1,
            capturedAt: "2026-10-01T10:00:00.000Z",
        },
    }
}

/** A published HLL friendly: Sunday 11 Oct 2026 20:00 in Prague. */
function match(overrides: Partial<EventRecord> = {}): EventRecord {
    return {
        id: "events:1",
        guildId: "guild-1",
        gameId: "hell_let_loose",
        kind: "match",
        matchType: "friendly",
        name: "VLK vs ROG · Přátelák",
        description: "Bring your A game",
        thumbnailUrl: "https://logi.test/thumb.png",
        announcementChannelId: "chan-ann",
        eventInfoChannelId: "chan-info",
        meetingChannelId: "voice-1",
        createSquadVoiceChannels: true,
        squadVoiceCategoryId: "cat-1",
        durationMinutes: 90,
        requiredRoleIds: [],
        rewardRoleIds: [],
        server: "VLK #1",
        serverPassword: "secret",
        side: "Allies",
        map: "foy_warfare",
        cap: "COBRU APPROACH",
        notes: "Meet in voice",
        // Sign-ups close 90 minutes before the meeting.
        registrationEnd: "2026-10-11T16:00:00.000Z",
        meetingStart: "2026-10-11T17:30:00.000Z",
        gameStart: "2026-10-11T18:00:00.000Z",
        gameEnd: "2026-10-11T19:30:00.000Z",
        pingClan: true,
        pingMode: "clan",
        pingRoleIds: [],
        createForumChannel: true,
        createSignupThread: true,
        topicPresetId: "topicPresets:1",
        stratmapIds: ["stratmaps:1"],
        signupGroupIds: ["g-inf", "g-tank"],
        allowedSignupStatuses: [],
        useGeneralSignup: false,
        signupReminderStatuses: ["member"],
        signupGroupLimits: [{ groupId: "g-tank", max: 6 }],
        status: "registration",
        statusUpdatedAt: "2026-10-04T10:00:00.000Z",
        attendanceReminderLog: [],
        participants: [],
        signUps: [],
        absenceNotices: [],
        createdAt: "2026-10-04T10:00:00.000Z",
        updatedAt: "2026-10-04T10:00:00.000Z",
        matchTeams: [
            team("a", "teams:vlk", "Allies", "Vlci"),
            team("b", "teams:rog", "Axis", "Rogues"),
        ],
        ...overrides,
    }
}

const context = { timezone: zone, name: "", ownTeamId: "teams:vlk" }

test("Wardogs map, independent time, layout and team positions survive editing", () => {
    const plan = {
        ...emptyTacticalPlan("ozeti"),
        layout: "Layout B",
        controlZone: { x: 50, y: 45, radius: 10 },
    }
    const event = match({
        gameId: "wardogs",
        map: "ozeti",
        timeOfDay: "night",
        tacticalPlan: plan,
    })
    const values = flowValuesFromEvent(event, zone)
    assert.equal(values.mapId, "ozeti")
    assert.equal(values.timeOfDay, "night")
    assert.deepEqual(values.tacticalPlan, plan)
    assert.equal(flowMapCode(values), "ozeti")
    const payload = flowEditPayload(values, values, event, context)
    assert.equal(payload.timeOfDay, "night")
    assert.deepEqual(payload.tacticalPlan, plan)
    const cleared = flowEditPayload(
        { ...values, mapId: "", timeOfDay: "", tacticalPlan: null },
        values,
        event,
        context
    )
    assert.equal(cleared.map, undefined)
    assert.equal(cleared.tacticalPlan, null)
})

test("base HLL map without a preset remains selectable and TBD map stays empty", () => {
    const values = flowValuesFromEvent(match({ map: "foy" }), zone)
    assert.equal(values.mapId, "foy")
    assert.equal(values.timeOfDay, "")
    assert.equal(flowMapCode({ ...values, mapId: "" }), "")
})

function edit(event: EventRecord, change: (values: FlowValues) => FlowValues) {
    const initial = flowValuesFromEvent(event, zone)
    const values = change(initial)
    return flowEditPayload(values, initial, event, {
        ...context,
        name: values.name,
    })
}

test("a stored match reads back into the flow exactly", () => {
    const values = flowValuesFromEvent(match(), zone)
    assert.equal(values.date, "2026-10-11")
    assert.equal(values.time, "20:00")
    assert.equal(values.meetingMinutes, 30)
    assert.equal(values.registrationHours, 1.5)
    assert.equal(values.announcementHours, null)
    assert.equal(values.durationMinutes, 90)
    assert.deepEqual(
        [values.mapId, values.timeOfDay, values.mapMode],
        ["foy", "day", "warfare"]
    )
    assert.equal(values.cap, "COBRU APPROACH")
    assert.equal(values.ownSide, "Allies")
    assert.equal(values.opponent?.teamId, "teams:rog")
    assert.equal(values.opponentSide, "Axis")
    assert.equal(values.nameTouched, true)
    assert.deepEqual(values.stratmapIds, ["stratmaps:1"])
    assert.equal(values.createSignupThread, true)
    assert.equal(values.createParticipantRoles, undefined)
    // The untouched values reproduce the stored timeline.
    assert.deepEqual(flowSchedule(values, zone), {
        registrationStart: undefined,
        registrationEnd: "2026-10-11T16:00:00.000Z",
        meetingStart: "2026-10-11T17:30:00.000Z",
        gameStart: "2026-10-11T18:00:00.000Z",
        gameEnd: "2026-10-11T19:30:00.000Z",
    })
})

test("an untouched edit sends every stored field and nothing optional", () => {
    const payload = edit(match(), (values) => values)
    assert.equal(payload.registrationEnd, "2026-10-11T16:00:00.000Z")
    assert.equal(payload.gameEnd, "2026-10-11T19:30:00.000Z")
    assert.equal(payload.map, "foy_warfare")
    assert.equal(payload.cap, "COBRU APPROACH")
    assert.equal(payload.description, "Bring your A game")
    assert.equal(payload.notes, "Meet in voice")
    assert.equal(payload.thumbnailUrl, "https://logi.test/thumb.png")
    assert.equal(payload.meetingChannelId, "voice-1")
    assert.equal(payload.squadVoiceCategoryId, "cat-1")
    assert.equal(payload.topicPresetId, "topicPresets:1")
    assert.deepEqual(payload.stratmapIds, ["stratmaps:1"])
    assert.equal(payload.serverPassword, "secret")
    assert.equal(payload.matchType, "friendly")
    assert.equal(payload.announcementChannelId, "chan-ann")
    for (const key of [
        "matchTeams",
        "recurrence",
        "signupGroupLimits",
        "attendanceReminderHours",
        "createParticipantRoles",
        "squadPresetId",
    ])
        assert.equal(key in payload, false, `${key} is left alone`)
})

test("a new start moves the whole timeline and keeps every offset", () => {
    const payload = edit(match(), (values) => ({ ...values, time: "21:15" }))
    assert.equal(payload.gameStart, "2026-10-11T19:15:00.000Z")
    assert.equal(payload.meetingStart, "2026-10-11T18:45:00.000Z")
    assert.equal(payload.registrationEnd, "2026-10-11T17:15:00.000Z")
    assert.equal(payload.gameEnd, "2026-10-11T20:45:00.000Z")
    assert.equal(payload.durationMinutes, 90)
})

test("changed template settings are sent; a cap of a group no longer offered is dropped", () => {
    const payload = edit(match(), (values) => ({
        ...values,
        signupGroupIds: ["g-inf"],
        signupGroupLimits: [
            { groupId: "g-inf", max: 20 },
            { groupId: "g-tank", max: 6 },
        ],
        attendanceReminderHours: [24, 6],
        createParticipantRoles: false,
        squadPresetId: "squadPresets:2",
    }))
    assert.deepEqual(payload.signupGroupLimits, [{ groupId: "g-inf", max: 20 }])
    assert.deepEqual(payload.attendanceReminderHours, [24, 6])
    assert.equal(payload.createParticipantRoles, false)
    assert.equal(payload.squadPresetId, "squadPresets:2")
})

test("clearing settings sends empty values; reminders read as all four when never set", () => {
    const stored = match({ squadPresetId: "squadPresets:1" })
    const cleared = edit(stored, (values) => ({
        ...values,
        signupGroupLimits: [],
        squadPresetId: undefined,
    }))
    assert.deepEqual(cleared.signupGroupLimits, [])
    assert.equal(cleared.squadPresetId, "")
    // An event from before the setting existed means every offset.
    const reminders = edit(match(), (values) => ({
        ...values,
        attendanceReminderHours: [24, 18, 12, 6],
    }))
    assert.equal("attendanceReminderHours" in reminders, false)
})

test("a new opponent keeps your stored team in slot a and a third Wardogs team", () => {
    const wardogs = match({
        gameId: "wardogs",
        map: "bakurani_koth_day",
        cap: undefined,
        side: undefined,
        matchTeams: [
            team("a", "teams:own-old", "Valkyra", "Vlci"),
            team("b", "teams:mnt", "Manticore", "Mantis"),
            team("c", "teams:lone", "Lonestar", "Lone"),
        ],
    })
    const values = flowValuesFromEvent(wardogs, zone)
    assert.deepEqual(
        [values.mapId, values.timeOfDay, values.mapMode, values.cap],
        ["bakurani", "day", "koth", ""]
    )
    const payload = edit(wardogs, (current) => ({
        ...current,
        opponent: {
            teamId: "teams:new",
            name: "New",
            shortCode: "NEW",
            logoUrl: null,
        },
    }))
    assert.deepEqual(payload.matchTeams, [
        { teamId: "teams:own-old", slot: "a", side: "Valkyra" },
        { teamId: "teams:new", slot: "b", side: "Manticore" },
        { teamId: "teams:lone", slot: "c", side: "Lonestar" },
    ])
    assert.equal(payload.map, "bakurani_koth_day")
    assert.equal(payload.cap, undefined)
})

test("a legacy match without teams keeps its side and an unknown map", () => {
    const legacy = match({
        matchTeams: undefined,
        side: "allies",
        map: "Foy (custom)",
        cap: "Custom point",
    })
    const values = flowValuesFromEvent(legacy, zone)
    assert.equal(values.ownSide, "Allies")
    assert.equal(values.opponent, null)
    assert.equal(values.mapId, "")
    const untouched = edit(legacy, (current) => ({
        ...current,
        name: "Renamed",
    }))
    assert.equal(untouched.map, "Foy (custom)")
    assert.equal(untouched.cap, "Custom point")
    assert.equal(untouched.name, "Renamed")
    assert.deepEqual(untouched.matchTeams, [
        { teamId: "teams:vlk", slot: "a", side: "Allies" },
    ])
    const picked = edit(legacy, (current) => ({
        ...current,
        mapId: "foy",
        timeOfDay: "night",
        mapMode: "",
    }))
    assert.equal(picked.map, "foy_warfare_night")
    const cleared = edit(legacy, (current) => ({
        ...current,
        mapCleared: true,
    }))
    assert.equal(cleared.map, undefined)
})

test("an offensive keeps its mode and follows your side", () => {
    const offensive = match({ map: "foy_offensive_us", side: "Allies" })
    const values = flowValuesFromEvent(offensive, zone)
    assert.equal(values.mapMode, "offensive")
    assert.equal(flowMapCode(values), "foy_offensive_us")
    const payload = edit(offensive, (current) => ({
        ...current,
        ownSide: "Axis",
        opponentSide: "Allies",
    }))
    assert.equal(payload.map, "foy_offensive_ger")
})

test("a training edits its meeting and never carries match fields", () => {
    const training = match({
        kind: "training",
        name: "Recruit training",
        meetingStart: "2026-10-11T17:00:00.000Z",
        gameStart: "2026-10-11T17:00:00.000Z",
        gameEnd: "2026-10-11T18:30:00.000Z",
        registrationEnd: "2026-10-10T17:00:00.000Z",
        registrationStart: "2026-10-08T17:00:00.000Z",
        signupGroupIds: [],
        requiredRoleIds: ["role-recruit"],
        rewardRoleIds: ["role-trained"],
        matchTeams: undefined,
        map: undefined,
        cap: undefined,
    })
    const values = flowValuesFromEvent(training, zone)
    assert.equal(values.time, "19:00")
    assert.equal(values.meetingMinutes, 0)
    assert.equal(values.registrationHours, 24)
    assert.equal(values.announcementHours, 72)
    const payload = edit(training, (current) => ({ ...current, time: "19:30" }))
    assert.equal(payload.meetingStart, "2026-10-11T17:30:00.000Z")
    assert.equal(payload.gameStart, "2026-10-11T17:30:00.000Z")
    assert.equal(payload.registrationStart, "2026-10-08T17:30:00.000Z")
    assert.deepEqual(payload.signupGroupIds, [])
    assert.deepEqual(payload.requiredRoleIds, ["role-recruit"])
    assert.deepEqual(payload.rewardRoleIds, ["role-trained"])
    assert.equal(payload.map, undefined)
    assert.equal(payload.createForumChannel, false)
    assert.equal("matchTeams" in payload, false)
})

test("a weekly series stops, starts and follows its match to another day", () => {
    const series = match({
        recurrence: { frequency: "weekly", interval: 1, weekdays: [0] },
    })
    assert.equal(flowValuesFromEvent(series, zone).repeatWeekly, true)
    assert.deepEqual(edit(series, (values) => values).recurrence, {
        frequency: "weekly",
        interval: 1,
        weekdays: [0],
    })
    const stopped = edit(series, (values) => ({
        ...values,
        repeatWeekly: false,
    }))
    assert.equal("recurrence" in stopped, false)
    const moved = edit(series, (values) => ({ ...values, date: "2026-10-13" }))
    assert.deepEqual(moved.recurrence?.weekdays, [2])
    const started = edit(match(), (values) => ({
        ...values,
        repeatWeekly: true,
    }))
    assert.deepEqual(started.recurrence, {
        frequency: "weekly",
        interval: 1,
        weekdays: [0],
    })
    // A generated date stays in its series and never starts another.
    const occurrence = match({ recurrenceSeriesId: "events:series" })
    assert.equal(flowValuesFromEvent(occurrence, zone).repeatWeekly, false)
    assert.equal(
        "recurrence" in
            edit(occurrence, (values) => ({ ...values, repeatWeekly: true })),
        false
    )
})

test("a new match payload keeps the create flow's shape", () => {
    const groups: Group[] = [
        {
            id: "g-inf",
            guildId: "guild-1",
            name: "Infantry",
            color: "#000",
            order: 1,
            createdAt: "",
            updatedAt: "",
        },
    ]
    const values = {
        ...newFlowValues({
            kind: "match",
            gameId: "hell_let_loose",
            timezone: zone,
            groups,
            templates: [],
            channelDefaults: {
                hell_let_loose: { announcementChannelId: "chan-ann" },
            },
            now: new Date("2026-10-10T10:00:00.000Z"),
        }),
        mapId: "foy",
        timeOfDay: "day",
    }
    const payload = flowEventPayload(values, {
        timezone: zone,
        name: "VLK vs ROG",
        ownTeamId: "teams:vlk",
    })
    assert.equal(payload.map, "foy_warfare")
    assert.equal(payload.gameStart, "2026-10-11T18:00:00.000Z")
    assert.equal(payload.meetingStart, "2026-10-11T17:30:00.000Z")
    assert.equal(payload.registrationEnd, "2026-10-10T17:30:00.000Z")
    assert.deepEqual(payload.signupGroupIds, ["g-inf"])
    assert.deepEqual(payload.matchTeams, [
        { teamId: "teams:vlk", slot: "a", side: null },
    ])
    assert.equal(payload.squadPresetId, undefined)
    assert.equal(payload.announcementChannelId, "chan-ann")
})

test("an incoherent timeline is caught before saving", () => {
    const values = flowValuesFromEvent(match(), zone)
    assert.equal(scheduleIsCoherent(flowSchedule(values, zone)), true)
    assert.equal(
        scheduleIsCoherent(
            flowSchedule({ ...values, durationMinutes: 0 }, zone)
        ),
        false
    )
    assert.equal(
        scheduleIsCoherent(flowSchedule({ ...values, date: "" }, zone)),
        false
    )
})

test("creation persists the edited sign-up roles, caps and general sign-up without unrelated caps", () => {
    const values = flowValuesFromEvent(match(), zone)
    const payload = flowEventPayload(
        {
            ...values,
            signupGroupIds: ["g-inf"],
            signupGroupLimits: [
                { groupId: "g-inf", max: 12 },
                { groupId: "g-tank", max: 6 },
            ],
            useGeneralSignup: true,
            requiredRoleIds: ["discord-member"],
        },
        { timezone: zone, name: "New match", ownTeamId: null }
    )
    assert.deepEqual(payload.signupGroupIds, ["g-inf"])
    assert.deepEqual(payload.signupGroupLimits, [{ groupId: "g-inf", max: 12 }])
    assert.equal(payload.useGeneralSignup, true)
    assert.deepEqual(payload.requiredRoleIds, ["discord-member"])
})
