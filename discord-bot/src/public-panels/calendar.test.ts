import assert from "node:assert/strict"
import test from "node:test"

import { renderedView } from "../../../src/infrastructure/testing/message-views"
import { buildCalendarPanelView, calendarEntriesFromPayload } from "./calendar"

const now = Date.parse("2026-10-05T10:00:00.000Z")
const hours = (value: number) => new Date(now + value * 3_600_000).toISOString()

const payload = {
    config: {
        guildId: "100000000000000099",
        defaultLanguage: "cs",
        timezone: "Europe/Prague",
        updatedAt: hours(-48),
    },
    guild: {
        id: "guilds:1",
        name: "Vlci",
        eventCategories: [
            { id: "friendly", label: "Přátelák", color: "#ed4245" },
        ],
    },
    events: [
        {
            id: "events:1",
            name: "Vlci vs Rogue",
            kind: "match",
            matchType: "friendly",
            gameStart: hours(30),
            gameEnd: hours(32),
            registrationEnd: hours(20),
            status: "planned",
            isDraft: false,
            updatedAt: hours(-1),
        },
        {
            id: "events:2",
            name: "Trénink",
            kind: "training",
            gameStart: hours(6),
            gameEnd: hours(8),
            status: "planned",
            isDraft: false,
            updatedAt: hours(-2),
        },
        {
            id: "events:3",
            name: "Skrytý koncept",
            kind: "match",
            gameStart: hours(3),
            gameEnd: hours(5),
            status: "planned",
            isDraft: true,
            updatedAt: hours(-2),
        },
    ],
    calendarItems: [
        {
            id: "calendarItems:1",
            title: "Porada klanu",
            color: "#5865f2",
            startAt: hours(54),
            endAt: hours(55),
            allDay: false,
        },
    ],
    syncStates: [
        {
            eventId: "events:1",
            announcementChannelId: "123456789012345678",
            announcementMessageId: "223456789012345678",
        },
    ],
} as unknown as Parameters<typeof buildCalendarPanelView>[0]

test("calendar entries include custom items with their own category colour", () => {
    const entries = calendarEntriesFromPayload(payload, now)
    assert.deepEqual(
        entries.map((entry) => [
            entry.id,
            entry.typeWord,
            entry.category,
            entry.categoryColor,
        ]),
        [
            ["events:1", "Přátelák", "friendly", "#ed4245"],
            ["events:2", "Trénink", "training", null],
            ["calendarItems:1:0", null, null, "#5865f2"],
        ]
    )
    assert.equal(
        entries[0]?.url,
        "https://discord.com/channels/100000000000000099/123456789012345678/223456789012345678"
    )
})

test("the calendar panel groups every event type by day and links the Logi calendar", () => {
    const view = renderedView(
        buildCalendarPanelView(payload, {
            now,
            siteUrl: "https://logi.app",
            categories: [],
        })
    )
    assert.deepEqual(view.validation, { ok: true, issues: [] })
    assert.match(view.text, /KALENDÁŘ · VLCI/)
    assert.match(view.text, /\*\*pondělí 5\. října 2026\*\*/)
    assert.match(view.text, /🔴 \*\*Vlci vs Rogue\*\* · <t:\d+:t>/)
    assert.match(view.text, /🔵 \*\*Porada klanu\*\* · <t:\d+:t> – <t:\d+:t>/)
    assert.doesNotMatch(
        view.text,
        /<#123456789012345678>|https:\/\/discord\.com\/channels/
    )
    assert.match(view.text, /Trénink/)
    assert.doesNotMatch(view.text, /Skrytý koncept/)
    const open = view.buttons[0]
    assert.ok(open?.kind === "link")
    assert.equal(
        open.url,
        "https://logi.app/cs/dashboard/servers/guilds%3A1/calendar"
    )
})

test("the category filter keeps only the chosen kinds of events", () => {
    const view = renderedView(
        buildCalendarPanelView(payload, {
            now,
            siteUrl: "https://logi.app",
            categories: ["training"],
        })
    )
    assert.doesNotMatch(view.text, /Vlci vs Rogue/)
    assert.match(view.text, /Trénink/)
})

test("a competition match names its round: ECL, 3. kolo (L3-14)", () => {
    const withRound = {
        ...payload,
        guild: {
            ...payload.guild,
            eventCategories: [{ id: "ecl", label: "ECL" }],
        },
        events: [
            {
                id: "events:9",
                name: "VLK vs MNT",
                kind: "match",
                matchType: "ecl",
                competitionRound: 3,
                gameStart: hours(30),
                gameEnd: hours(32),
                status: "planned",
                isDraft: false,
                updatedAt: hours(-1),
            },
            {
                id: "events:10",
                name: "VLK vs ROG",
                kind: "match",
                matchType: "ecl",
                gameStart: hours(40),
                gameEnd: hours(42),
                status: "planned",
                isDraft: false,
                updatedAt: hours(-1),
            },
        ],
        calendarItems: [],
    } as unknown as Parameters<typeof buildCalendarPanelView>[0]
    const entries = calendarEntriesFromPayload(withRound, now)
    assert.deepEqual(
        entries.map((entry) => entry.typeWord),
        ["ECL, 3. kolo", "ECL"]
    )
    const en = calendarEntriesFromPayload(
        {
            ...withRound,
            config: { ...withRound.config, defaultLanguage: "en" },
        } as unknown as Parameters<typeof buildCalendarPanelView>[0],
        now
    )
    assert.equal(en[0]?.typeWord, "ECL, round 3")
})

test("the calendar starts with configured category colours and names, even without events", () => {
    const view = renderedView(
        buildCalendarPanelView(
            {
                ...payload,
                guild: {
                    ...payload.guild,
                    eventCategories: [
                        { id: "friendly", label: "Přátelák", color: "#ed4245" },
                        {
                            id: "training",
                            label: "Výcvik *nováčků*",
                            color: "#57f287",
                        },
                    ],
                },
                events: [],
                calendarItems: [],
            },
            { now, siteUrl: "https://logi.app", categories: [] }
        )
    )
    assert.deepEqual(view.validation, { ok: true, issues: [] })
    assert.match(view.text, /🔴 Přátelák\n🟢 Výcvik \\\*nováčků\\\*/)
    assert.ok(view.text.indexOf("Přátelák") < view.text.indexOf("Momentálně"))
})

test("the legend follows the category filter before the dated rows", () => {
    const view = renderedView(
        buildCalendarPanelView(payload, {
            now,
            siteUrl: "https://logi.app",
            categories: ["FRIENDLY"],
        })
    )
    assert.match(view.text, /🔴 Přátelák/)
    assert.ok(view.text.indexOf("🔴 Přátelák") < view.text.indexOf("**úterý"))
    const filtered = renderedView(
        buildCalendarPanelView(payload, {
            now,
            siteUrl: "https://logi.app",
            categories: ["training"],
        })
    )
    assert.doesNotMatch(filtered.text, /Přátelák/)
})
