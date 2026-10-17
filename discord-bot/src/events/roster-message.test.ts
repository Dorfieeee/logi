import assert from "node:assert/strict"
import test from "node:test"

import { MessageFlags } from "discord.js"

import type { EventRecord, Roster, SyncPayload } from "../types"
import { buildRosterMessage } from "./roster-message"

const payload = {
    config: {
        id: "config-1",
        guildId: "guild-1",
        timezone: "Europe/Prague",
        defaultLanguage: "cs",
        calendarCategories: [],
        meetingChannelId: "200000000000000001",
        messageStyle: { accentColor: "#123456" },
        updatedAt: "2026-10-01T10:00:00.000Z",
    },
    guild: {
        name: "Vlci",
        eventCategories: [
            { id: "friendly", label: "Přátelák", color: "#22c55e" },
        ],
    },
    groups: [{ id: "g1", name: "Pěchota", color: "#000", order: 0 }],
} as unknown as Pick<SyncPayload, "config" | "guild" | "groups">

const event = {
    id: "event-1",
    guildId: "guild-1",
    kind: "match",
    name: "Liga",
    matchType: "friendly",
    map: "foy_warfare_day",
    gameId: "hell_let_loose",
    matchTeams: [
        {
            slot: "a",
            side: "Allies",
            snapshot: { name: "Vlci", shortCode: "VLK" },
        },
        {
            slot: "b",
            side: "Axis",
            snapshot: { name: "Rogue", shortCode: "ROG" },
        },
    ],
    server: "VLK Scrim",
    serverPassword: "never-public",
    registrationEnd: "2026-10-10T17:30:00.000Z",
    meetingStart: "2026-10-11T17:30:00.000Z",
    gameStart: "2026-10-11T18:00:00.000Z",
} as unknown as EventRecord

const roster = {
    id: "roster-1",
    eventId: "event-1",
    published: true,
    publishedAt: "2026-10-11T13:10:00.000Z",
    reservePlayerIds: ["100000000000000003"],
    updatedAt: "2026-10-11T13:10:00.000Z",
    squads: [
        {
            name: "F1",
            group: "Pěchota",
            color: "#000",
            order: 0,
            players: [
                {
                    id: "100000000000000001",
                    ack: false,
                    roleName: "Squad Leader",
                },
                { id: "100000000000000002", ack: false, roleName: "Medic" },
            ],
        },
    ],
} as unknown as Roster

const names = {
    "100000000000000001": "Rex_CZ",
    "100000000000000002": "Medvěd",
    "100000000000000003": "Fík",
}

const image = { url: "attachment://roster.png", description: "Liga" }

function render(patch: Partial<Roster> = {}) {
    const message = buildRosterMessage({
        payload,
        event,
        roster: { ...roster, ...patch },
        names,
        image,
    })
    return {
        message,
        json: JSON.stringify(
            (message.components ?? []).map((item) =>
                "toJSON" in item ? item.toJSON() : item
            )
        ),
    }
}

test("variant A by default: the photo with the text roster, clan colour and no pings", () => {
    const { message, json } = render()
    assert.equal(message.flags, MessageFlags.IsComponentsV2)
    assert.deepEqual(message.allowedMentions, { parse: [] })
    assert.match(json, /"accent_color":1193046/)
    assert.match(json, /Soupiska · VLK vs ROG · Přátelák · ne <t:1791741600:d>/)
    assert.match(
        json,
        /Foy · den · sraz <t:1791739800:t> v kanálu <#200000000000000001> · 2 z 2 míst/
    )
    assert.match(json, /attachment:\/\/roster\.png/)
    assert.match(json, /\*\*F1\*\* · SL Rex\\\\_CZ · Medic Medvěd/)
    assert.match(json, /\*\*Zálohy\*\* · Fík/)
    assert.match(
        json,
        /Zveřejněno ne <t:1791724200:d> v <t:1791724200:t> · Spravováno v Logi/
    )
    for (const label of [
        "Zobrazit zařazení",
        "Zobrazit soupisku",
        "Otevřít soupisku",
    ])
        assert.match(json, new RegExp(label))
    assert.doesNotMatch(json, /never-public/)
})

test("Jen fotka keeps the photo and the buttons without the text roster", () => {
    const { json } = render({ discordMessageVariant: "photo" })
    assert.doesNotMatch(json, /SL Rex/)
    assert.match(json, /Zobrazit soupisku/)
})

test("the clan default applies when the publish chose nothing", () => {
    const message = buildRosterMessage({
        payload: {
            ...payload,
            config: { ...payload.config, rosterMessageVariant: "photo" },
        },
        event,
        roster,
        names,
        image,
    })
    assert.doesNotMatch(JSON.stringify(message.components), /SL Rex/)
})

test("the first roster card pings its attendee role, never every player", () => {
    const message = buildRosterMessage({
        payload,
        event,
        roster: { ...roster, discordMentionPlayers: true },
        names,
        image,
        attendeeRoleId: "event-attendees",
        pingAttendeeRole: true,
    })
    const json = JSON.stringify(
        (message.components ?? []).map((item) =>
            "toJSON" in item ? item.toJSON() : item
        )
    )
    assert.match(json, /^\[\{"type":10,"content":"<@&event-attendees>"/)
    assert.deepEqual(message.allowedMentions, {
        roles: ["event-attendees"],
        parse: [],
    })
})

test("a recovered roster card stays silent after its attendee role was pinged", () => {
    const message = buildRosterMessage({
        payload,
        event,
        roster: { ...roster, discordMentionPlayers: true },
        names,
        image,
        attendeeRoleId: "event-attendees",
        pingAttendeeRole: false,
    })
    const json = JSON.stringify(message.components)

    assert.doesNotMatch(json, /<@/)
    assert.deepEqual(message.allowedMentions, { parse: [] })
})
