import assert from "node:assert/strict"
import test from "node:test"

import { getDictionary } from "@/i18n/dictionaries"
import type { EventRecord } from "@/types/domain"

import {
    flowChanges,
    flowPreviewModel,
    flowReviewRows,
    type FlowSummaryContext,
} from "./flow-summary"
import { flowValuesFromEvent } from "./flow-values"

const zone = "Europe/Prague"
const groups = [
    { id: "g-inf", name: "Pěchota", order: 1 },
    { id: "g-tank", name: "Tanky", order: 2 },
].map((group) => ({
    ...group,
    guildId: "guild-1",
    color: "#000",
    createdAt: "",
    updatedAt: "",
}))

const context: FlowSummaryContext = {
    t: getDictionary("cs").newMatch,
    intl: "cs-CZ",
    timezone: zone,
    clanName: "Vlci",
    ownTeam: { name: "Vlci", shortCode: "VLK" },
    templateName: null,
    groups,
    categories: [{ id: "friendly", label: "Přátelák", color: "#22c55e" }],
    squadPresets: [{ id: "squadPresets:1", name: "Standard" }],
    topicPresets: [],
    stratmaps: [],
    channelName: (id) => (id === "chan-ann" ? "oznameni" : null),
    roleName: (id) => (id === "role-clan" ? "Členové" : null),
}

const event = {
    id: "events:1",
    guildId: "guild-1",
    gameId: "hell_let_loose",
    kind: "match",
    matchType: "friendly",
    name: "VLK vs ROG · Přátelák",
    announcementChannelId: "chan-ann",
    requiredRoleIds: [],
    rewardRoleIds: [],
    server: "VLK #1",
    serverPassword: "secret",
    side: "Allies",
    map: "foy_warfare",
    registrationEnd: "2026-10-10T17:30:00.000Z",
    meetingStart: "2026-10-11T17:30:00.000Z",
    gameStart: "2026-10-11T18:00:00.000Z",
    gameEnd: "2026-10-11T19:30:00.000Z",
    pingClan: true,
    pingMode: "clan",
    createForumChannel: true,
    stratmapIds: [],
    signupGroupIds: ["g-inf", "g-tank"],
    signupGroupLimits: [{ groupId: "g-tank", max: 6 }],
    status: "registration",
    statusUpdatedAt: "",
    attendanceReminderLog: [],
    participants: [],
    signUps: [],
    absenceNotices: [],
    createdAt: "",
    updatedAt: "",
    matchTeams: [
        {
            teamId: "teams:rog",
            slot: "b",
            side: "Axis",
            snapshot: {
                name: "Rogues",
                shortCode: "ROG",
                logoAssetId: null,
                logoUrl: null,
                teamRevision: 1,
                capturedAt: "",
            },
        },
    ],
} satisfies EventRecord

test("the review rows describe a stored match", () => {
    const values = flowValuesFromEvent(event, zone)
    const rows = flowReviewRows(values, context)
    assert.deepEqual(
        rows.map((row) => row.step),
        ["match", "time", "signups", "discord"]
    )
    assert.equal(rows[0].text, "VLK vs ROG · Foy, den")
    assert.match(rows[1].text, /20:00 · sraz 19:30 · přihlášky do/)
    assert.equal(
        rows[2].text,
        "Člen, Rekrut, Záložník, Žoldák · Pěchota, Tanky max 6"
    )
    assert.equal(rows[3].text, "#oznameni · ping klanové role · fórum")
})

test("nothing changed lists nothing", () => {
    const values = flowValuesFromEvent(event, zone)
    assert.deepEqual(flowChanges(values, { ...values }, context), [])
})

test("changes read old to new, never show the password and follow the steps", () => {
    const initial = flowValuesFromEvent(event, zone)
    const changes = flowChanges(
        initial,
        {
            ...initial,
            time: "21:00",
            signupGroupLimits: [{ groupId: "g-tank", max: 4 }],
            serverPassword: "new-secret",
            notes: "x".repeat(80),
            createParticipantRoles: false,
        },
        context
    )
    const byKey = Object.fromEntries(
        changes.map((change) => [change.key, change])
    )
    assert.deepEqual(
        changes.map((change) => change.key),
        [
            "notes",
            "start",
            "meeting",
            "registrationEnd",
            "end",
            "groups",
            "participantRoles",
            "password",
        ]
    )
    assert.equal(byKey.groups.before, "Pěchota, Tanky max 6")
    assert.equal(byKey.groups.after, "Pěchota, Tanky max 4")
    assert.equal(byKey.groups.step, "signups")
    assert.equal(byKey.password.before, "nastaveno")
    assert.equal(byKey.password.after, "nové heslo")
    assert.equal(
        changes.some((change) =>
            [change.before, change.after].some((text) =>
                text.includes("secret")
            )
        ),
        false
    )
    assert.equal(byKey.participantRoles.before, "zapnuto")
    assert.equal(byKey.participantRoles.after, "vypnuto")
    assert.equal(byKey.notes.before, "—")
})

test("a long text edited past its excerpt still reads as edited", () => {
    const initial = {
        ...flowValuesFromEvent(event, zone),
        description: "a".repeat(80),
    }
    const [change] = flowChanges(
        initial,
        { ...initial, description: `${"a".repeat(79)}b` },
        context
    )
    assert.equal(change.key, "description")
    assert.equal(change.after, "upraveno")
})

test("the preview shows the current sign-ups against the caps", () => {
    const values = flowValuesFromEvent(event, zone)
    const model = flowPreviewModel(values, {
        ...context,
        botLanguage: "cs",
        clanRoleId: "role-clan",
        signups: { total: 9, byGroup: { Tanky: 6 } },
    })
    assert.equal(model.title, "VLK vs ROG · Přátelák")
    assert.equal(model.categoryLabel, "Přátelák")
    assert.deepEqual(model.mentions, ["Členové"])
    assert.deepEqual(model.groups, [
        { name: "Pěchota", max: undefined },
        { name: "Tanky", max: 6 },
    ])
    assert.deepEqual(model.signups, { total: 9, byGroup: { Tanky: 6 } })
    assert.deepEqual(model.teams, [
        { code: "VLK", side: "Allies" },
        { code: "ROG", side: "Axis" },
    ])
})

test("the preview keeps the home clan while its linked team is unavailable", () => {
    const model = flowPreviewModel(flowValuesFromEvent(event, zone), {
        ...context,
        ownTeam: null,
        botLanguage: "cs",
    })
    assert.deepEqual(model.teams, [
        { code: "VLC", side: "Allies" },
        { code: "ROG", side: "Axis" },
    ])
})
