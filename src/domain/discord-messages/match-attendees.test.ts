import assert from "node:assert/strict"
import test from "node:test"

import { getAnnouncementMessages } from "@/lib/clan-language/announcements"
import { getSystemMessages } from "@/lib/clan-language/system"

import {
    attendeesPageId,
    buildAttendeesView,
    decodeSignupListFilter,
    encodeSignupListFilter,
    parseAttendeesCustomId,
    type AttendeesViewInput,
} from "./match-attendees"
import { layoutMessageView, type MessageLayoutOptions } from "./message-layout"
import { buildSignupList, type SignupListInput } from "../events/signup-list"
import type { MessageButton, MessageView } from "./message-view"
import { validateMessageView } from "./message-validation"
import type { MatchCardEvent } from "./match-announcement"

const copy = getAnnouncementMessages("cs")
const layoutOptions: MessageLayoutOptions = {
    copy: getSystemMessages("cs").kit,
    locale: "cs-CZ",
}

const event: MatchCardEvent = {
    kind: "match",
    eventId: "event-1",
    guildId: "111111111111111111",
    name: "VLK vs ROG",
    category: { label: "Přátelák", color: "#3BA55C" },
    teams: [
        { code: "VLK", side: "Allies" },
        { code: "ROG", side: "Axis" },
    ],
    mapLabel: "Foy · den",
    meetingStart: "2026-10-11T17:30:00.000Z",
    gameStart: "2026-10-11T18:00:00.000Z",
    registrationEnd: "2026-10-10T17:30:00.000Z",
    timeZone: "Europe/Prague",
    locale: "cs-CZ",
}

const signup = (userId: string, group: string | null, at: string) => ({
    userId,
    status: "attending" as const,
    group,
    updatedAt: at,
})

const listInput: SignupListInput = {
    groups: [
        { id: "inf", name: "Pěchota" },
        { id: "tank", name: "Tanky" },
        { id: "recon", name: "Recon" },
    ],
    limits: new Map([
        ["tank", 1],
        ["recon", 2],
    ]),
    participants: [
        signup("kowalski", "Pěchota", "2026-10-05T16:04:00.000Z"),
        signup("bizon", "Pěchota", "2026-10-05T17:02:00.000Z"),
        signup("tomcat", "Tanky", "2026-10-05T16:06:00.000Z"),
        {
            ...signup("fik", null, "2026-10-08T17:02:00.000Z"),
            requestedGroup: "Tanky",
        },
        {
            userId: "kos",
            status: "not_attending",
            group: null,
            updatedAt: "2026-10-07T10:00:00.000Z",
        },
    ],
    absenceNotices: [
        { userId: "bizon", reason: "Ve 20:15", createdAt: "x", kind: "late" },
        { userId: "kos", reason: "nemoc", createdAt: "x" },
    ],
    memberships: new Map([
        ["kowalski", "member"],
        ["bizon", "member"],
        ["fik", "reserve_member"],
    ]),
    leadership: false,
    unanswered: ["sokol"],
    locale: "cs-CZ",
}

const names = new Map([
    ["kowalski", "Kowalski"],
    ["bizon", "Bizon"],
    ["tomcat", "Tomcat"],
    ["fik", "Fík"],
    ["kos", "Kos"],
    ["sokol", "Sokol"],
])

function view(
    patch: Partial<AttendeesViewInput> = {},
    leadership = false,
    list = buildSignupList({ ...listInput, leadership })
) {
    return buildAttendeesView({
        event,
        list,
        filter: { kind: "all" },
        page: 1,
        leadership,
        registrationOpen: false,
        names,
        reminderAvailable: true,
        webUrl: leadership ? "https://logi.example/cs/attendance" : null,
        copy,
        ...patch,
    })
}

function text(message: MessageView) {
    return layoutMessageView(message, layoutOptions)
        .nodes.flatMap((node) => (node.type === "text" ? [node.content] : []))
        .join("\n")
}

const buttons = (message: MessageView) =>
    message.blocks.flatMap((block) =>
        block.kind === "buttons" ? [block.buttons] : []
    )
const select = (message: MessageView) =>
    message.blocks.find((block) => block.kind === "select")

test("members see who signed up by group, the reserves and who is not coming (L1-70..79)", () => {
    const { view: message } = view()
    assert.equal(message.ephemeral, true)
    assert.equal(message.accent, "clan")
    assert.equal(message.header?.title, "Přihlášení · VLK vs ROG · Přátelák")
    const body = text(message)
    assert.match(body, /<t:1791741600:f> · přihlášky skončily <t:1791653400:f>/)
    assert.match(
        body,
        /\*\*3 přihlášeno\*\* · Pěchota 2 · Tanky 1\/1 · Recon 0\/2/
    )
    assert.match(
        body,
        /\*\*Pěchota\*\* · 2 · bez limitu\n1\. \*\*Kowalski\*\* · 🟢 Člen · po <t:1791216240:t>/
    )
    assert.match(
        body,
        /2\. \*\*Bizon\*\* · 🟢 Člen · přijde později \(20:15\) · po <t:1791219720:t>/
    )
    assert.match(body, /\*\*Tanky\*\* · 1\/1 · plno/)
    assert.match(body, /\*\*Recon\*\* · 0\/2/)
    assert.match(
        body,
        /\*\*Zálohy \(1\)\*\* · skupina byla plná, velení je může přesunout\n1\. \*\*Fík\*\* · 🔵 Záložník · původně Tanky · čt <t:1791478920:t>/
    )
    assert.match(body, /\*\*Nepřijdou \(1\)\*\*\nKos$/m)
    assert.doesNotMatch(body, /nemoc|Bez odpovědi|Sokol/)
    assert.match(body, /-# Pořadí podle času přihlášky · Spravováno v Logi$/)
    assert.deepEqual(buttons(message), [])
    const filter = select(message)
    assert.ok(filter?.kind === "select")
    assert.equal(filter.select.id, "attendees-filter:event-1")
    assert.deepEqual(
        filter.select.options.map((option) => [option.label, option.default]),
        [
            ["Skupina: Všechny", true],
            ["Skupina: Pěchota", false],
            ["Skupina: Tanky", false],
            ["Skupina: Recon", false],
        ]
    )
})

test("leadership also sees reasons, Bez odpovědi and the two actions (L1-81..86)", () => {
    const { view: message } = view({}, true)
    const body = text(message)
    assert.match(
        body,
        /\*\*Nepřijdou \(1\)\*\* · důvod vidí jen velení\n\*\*Kos\*\* · nemoc/
    )
    assert.match(
        body,
        /\*\*Bez odpovědi \(1\)\*\* · členové, kteří se nepřihlásili ani neomluvili\nSokol/
    )
    const [actions] = buttons(message)
    assert.deepEqual(
        actions?.map((button: MessageButton) =>
            button.kind === "link"
                ? [button.label, button.url]
                : [
                      button.label,
                      button.style,
                      button.id,
                      Boolean(button.disabled),
                  ]
        ),
        [
            [
                "Připomenout bez odpovědi",
                "primary",
                "attendees-remind:event-1",
                false,
            ],
            ["Otevřít na webu", "https://logi.example/cs/attendance"],
        ]
    )
    const filter = select(message)
    assert.ok(filter?.kind === "select")
    assert.equal(filter.select.options.at(-1)?.label, "Skupina: Bez odpovědi")
    assert.equal(filter.select.options.at(-1)?.description, "1 člen")
})

test("the reminder button is off when nobody can be reminded now", () => {
    const { view: message } = view({ reminderAvailable: false }, true)
    const [actions] = buttons(message)
    assert.equal(actions?.[0]?.disabled, true)
})

test("open sign-ups show the deadline as 'přihlášky do' (L1-71)", () => {
    assert.match(
        text(view({ registrationOpen: true }).view),
        /přihlášky do <t:1791653400:f>/
    )
})

test("a group filter shows that group only; members cannot filter Bez odpovědi", () => {
    const tanks = text(view({ filter: { kind: "group", id: "tank" } }).view)
    assert.match(tanks, /\*\*Tanky\*\*/)
    assert.doesNotMatch(tanks, /Pěchota\*\* ·|Zálohy/)
    const unanswered = text(view({ filter: { kind: "unanswered" } }, true).view)
    assert.match(unanswered, /Bez odpovědi \(1\)/)
    assert.doesNotMatch(unanswered, /Kowalski/)
})

function crowd(count: number) {
    return buildSignupList({
        ...listInput,
        participants: Array.from({ length: count }, (_, index) =>
            signup(
                `p${String(index).padStart(3, "0")}`,
                index % 2 ? "Pěchota" : "Recon",
                new Date(Date.UTC(2026, 9, 5, 16, index)).toISOString()
            )
        ),
        limits: new Map(),
        absenceNotices: [],
        leadership: true,
        unanswered: Array.from({ length: 30 }, (_, index) => `u${index}`),
    })
}

test("more than 40 names page with Předchozí · 1 / 2 · Další (L1-80, L1-83, L1-B10)", () => {
    const list = crowd(45)
    const first = view({}, true, list)
    assert.equal(first.pages, 3)
    const [pager] = buttons(first.view)
    assert.deepEqual(
        pager?.map((button: MessageButton) => [
            button.label,
            Boolean(button.disabled),
            button.kind === "action" ? button.id : "",
        ]),
        [
            ["Předchozí", true, "attendees-page:event-1:all:0"],
            ["1 / 3", true, "attendees-page:event-1:all:none"],
            ["Další", false, "attendees-page:event-1:all:2"],
        ]
    )
    const last = view({ page: 3 }, true, list)
    assert.equal(last.page, 3)
    const [lastPager] = buttons(last.view)
    assert.deepEqual(
        lastPager?.map((button: MessageButton) => Boolean(button.disabled)),
        [false, true, true]
    )
    assert.match(text(last.view), /Bez odpovědi \(30\)/)
})

test("every page of a large clan stays within Discord's limits", () => {
    const list = crowd(160)
    const { pages } = view({}, true, list)
    for (let page = 1; page <= pages; page += 1) {
        const { view: message } = view({ page }, true, list)
        assert.deepEqual(
            validateMessageView(message, layoutOptions).issues,
            [],
            `page ${page}`
        )
    }
    assert.ok(pages >= 4)
})

test("an empty list says nobody signed up yet", () => {
    const message = view(
        {},
        false,
        buildSignupList({ ...listInput, participants: [], absenceNotices: [] })
    ).view
    assert.match(text(message), /Zatím se nikdo nepřihlásil\./)
})

test("filters and pages round-trip through custom IDs", () => {
    for (const filter of [
        { kind: "all" as const },
        { kind: "unanswered" as const },
        { kind: "group" as const, id: "k57abc" },
    ])
        assert.deepEqual(
            decodeSignupListFilter(encodeSignupListFilter(filter)),
            filter
        )
    assert.deepEqual(
        parseAttendeesCustomId(
            attendeesPageId("event-1", { kind: "group", id: "tank" }, 3)
        ),
        {
            prefix: "attendees-page:",
            eventId: "event-1",
            filter: { kind: "group", id: "tank" },
            page: 3,
        }
    )
})
