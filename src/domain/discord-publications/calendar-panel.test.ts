import assert from "node:assert/strict"
import test from "node:test"

import {
    CALENDAR_PANEL_ROWS,
    calendarPanelEntries,
    calendarPanelView,
    type CalendarEntry,
} from "./calendar-panel"
import { renderedView } from "../../infrastructure/testing/message-views"
import { getPanelMessages } from "../../lib/clan-language/panels"

const now = Date.parse("2026-10-05T10:00:00.000Z")
const hour = 3_600_000
const entry = (
    id: string,
    startOffsetHours: number,
    overrides: Partial<CalendarEntry> = {}
): CalendarEntry => ({
    id,
    title: `Akce ${id}`,
    typeWord: "Trénink",
    startAt: new Date(now + startOffsetHours * hour).toISOString(),
    endAt: new Date(now + (startOffsetHours + 2) * hour).toISOString(),
    allDay: false,
    url: null,
    signupUntil: null,
    category: "training",
    event: true,
    range: true,
    ...overrides,
})

test("upcoming entries only, ordered, filtered by the chosen categories", () => {
    const entries = [
        entry("late", 48),
        entry("past", -5),
        entry("match", 24, { category: "match", typeWord: "Přátelák" }),
        entry("manual", 30, { event: false, category: null, typeWord: null }),
    ]
    assert.deepEqual(
        calendarPanelEntries(entries, { now, categories: [] }).map((e) => e.id),
        ["match", "manual", "late"]
    )
    assert.deepEqual(
        calendarPanelEntries(entries, { now, categories: ["MATCH"] }).map(
            (e) => e.id
        ),
        ["match", "manual"]
    )
})

const view = (entries: CalendarEntry[]) =>
    renderedView(
        calendarPanelView({
            copy: getPanelMessages("cs").calendarPanel,
            locale: "cs-CZ",
            timeZone: "Europe/Prague",
            clanName: "Vlci",
            entries,
            now,
            calendarUrl: "https://logi.app/cs/dashboard/servers/g/calendar",
            updatedAt: now,
            accentColor: null,
        })
    )

test("the next event is highlighted with its sign-up deadline; the rest are compact rows", () => {
    const out = view([
        entry("a", 24, {
            title: "Vlci vs *Rogue*",
            typeWord: "Přátelák",
            categoryColor: "#ed4245",
            mapLabel: "Foy · den",
            url: "https://discord.com/channels/1/2/3",
            signupUntil: new Date(now + 20 * hour).toISOString(),
        }),
        entry("b", 48),
        entry("c", 72, { allDay: true, range: false, typeWord: null }),
    ])
    assert.deepEqual(out.validation, { ok: true, issues: [] })
    assert.match(out.text, /KALENDÁŘ · VLCI/)
    assert.match(out.text, /Nejbližší akce/)
    assert.match(
        out.text,
        /\*\*Další\*\* · 🔴 \*\*Přátelák\*\*\n\*\*Vlci vs \\\*Rogue\\\* · <#2>\*\*/
    )
    assert.doesNotMatch(out.text, /https:\/\/discord\.com\/channels/)
    assert.match(out.text, /přihlášky do /)
    assert.match(out.text, /🗺️ Foy · den/)
    assert.match(out.text, /\*\*Akce b\*\* · ⚪ \*\*Trénink\*\*/)
    assert.match(out.text, /📅 \*\*st 7\. 10\.\*\* · <t:\d+:t>–<t:\d+:t>/)
    assert.match(out.text, /📅 \*\*čt 8\. 10\.\*\* · celý den/)
    assert.match(out.text, /Časy v tvém pásmu/)
    assert.deepEqual(
        out.buttons.map((button) => button.label),
        ["Otevřít kalendář"]
    )
})

test("an empty plan says so; only Discord message URLs become channel mentions", () => {
    assert.match(view([]).text, /Momentálně nejsou naplánované/)
    const out = view([entry("x", 5, { url: "https://evil.example/x" })])
    assert.doesNotMatch(out.text, /evil\.example/)
})

test("at most ten rows besides the highlight", () => {
    const out = view(
        Array.from({ length: 20 }, (_, i) => entry(String(i), i + 1))
    )
    const rows = out.text
        .split("\n")
        .filter((line) => /^\*\*.+\*\* · <t:\d+:t>/.test(line))
    assert.ok(rows.length <= CALENDAR_PANEL_ROWS)
    assert.deepEqual(out.validation, { ok: true, issues: [] })
})
