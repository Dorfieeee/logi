import assert from "node:assert/strict"
import test from "node:test"

import { getRosterMessages } from "@/lib/clan-language/rosters"
import { getSystemMessages } from "@/lib/clan-language/system"

import {
    attendanceButtonIds,
    eventCustomId,
    findMyAssignment,
    myAssignmentView,
    parseEventButtonId,
    rosterButtonIds,
    rosterChangesView,
    rosterFullView,
    rosterMentionIds,
    rosterMessageView,
    rosterSections,
    rosterSquadView,
    roleShortName,
    type RosterCardContext,
    type RosterCardEvent,
    type RosterCardRoster,
} from "./roster-message"
import {
    diffRosterPlaces,
    rosterPlaces,
} from "../rosters/roster-update-summary"
import { layoutMessageView, type MessageLayoutOptions } from "./message-layout"
import { validateMessageView } from "./message-validation"

const layout: MessageLayoutOptions = {
    copy: getSystemMessages("cs").kit,
    locale: "cs-CZ",
}

const id = (n: number) => `1000000000000000${String(n).padStart(2, "0")}`

const names: Record<string, string> = {
    [id(1)]: "Kowalski",
    [id(2)]: "Dělo_Pepa",
    [id(3)]: "Rex_CZ",
    [id(4)]: "Medvěd",
    [id(5)]: "kapitánSova",
    [id(6)]: "Bizon",
    [id(7)]: "Zubr",
    [id(8)]: "ŠtěkotDog",
    [id(9)]: "Kos",
}

const event: RosterCardEvent = {
    id: "event-1",
    title: "VLK vs ROG",
    category: "Přátelák",
    mapLabel: "Foy · den",
    registrationEnd: "2026-10-10T17:30:00.000Z",
    meetingStart: "2026-10-11T17:30:00.000Z",
    gameStart: "2026-10-11T18:00:00.000Z",
    meetingChannelId: "200000000000000001",
    server: "VLK Scrim",
    serverPassword: "k7-sraz",
    notices: [
        { userId: id(5), reason: "Práce", kind: "cannot_come" },
        { userId: id(6), reason: "Přijdu ve 20:15, práce", kind: "late" },
    ],
}

const roster: RosterCardRoster = {
    squads: [
        {
            name: "F1",
            group: "Pěchota",
            order: 2,
            players: [
                { id: id(3), roleName: "Squad Leader", ack: true },
                {
                    id: id(4),
                    roleName: "Medic",
                    ack: true,
                    note: "drž se u tanků ve středu, léčíš hlavně F1.",
                },
                { id: id(5), roleName: "Support", ack: false },
                { id: id(6), roleName: "Machine Gunner", ack: false },
                { id: id(7), roleName: "Anti-Tank", ack: true },
                { roleName: "Rifleman", ack: false },
            ],
        },
        {
            name: "CMD",
            group: "Velení",
            order: 0,
            players: [{ id: id(1), roleName: "Commander", ack: true }],
        },
        {
            name: "Arty",
            group: "Dělostřelectvo",
            order: 1,
            players: [{ id: id(2), roleName: "Artillery", ack: false }],
        },
    ],
    reservePlayerIds: [id(8)],
    notAttendingPlayerIds: [id(9)],
}

const groups = [
    { id: "g-cmd", name: "Velení", order: 0 },
    { id: "g-arty", name: "Dělostřelectvo", order: 1, parentId: "g-cmd" },
    { id: "g-inf", name: "Pěchota", order: 2 },
]

function context(
    now = Date.parse("2026-10-11T17:40:00.000Z")
): RosterCardContext {
    return {
        copy: getRosterMessages("cs"),
        timeZone: "Europe/Prague",
        names,
        groups,
        rosterUrl: "https://logi.example/cs/rosters/event-1",
        now,
    }
}

const text = (view: Parameters<typeof layoutMessageView>[0]) =>
    layoutMessageView(view, layout)
        .nodes.flatMap((node) =>
            node.type === "text"
                ? [node.content]
                : node.type === "section"
                  ? node.texts
                  : []
        )
        .join("\n")

const buttons = (view: Parameters<typeof layoutMessageView>[0]) =>
    layoutMessageView(view, layout).nodes.flatMap((node) =>
        node.type === "buttons" ? node.buttons : []
    )

test("roles are written short in the text roster", () => {
    assert.equal(roleShortName("Squad Leader"), "SL")
    assert.equal(roleShortName("Machine Gunner"), "MG")
    assert.equal(roleShortName("Anti-Tank"), "AT")
    assert.equal(roleShortName("Tank Commander"), "TC")
    assert.equal(roleShortName("Crewman"), "Crew")
    assert.equal(roleShortName("Medic"), "Medic")
    assert.equal(roleShortName("Vlastní role"), "Vlastní role")
    assert.equal(roleShortName(""), undefined)
})

test("squads are grouped by the clan's root groups in their order", () => {
    assert.deepEqual(
        rosterSections(roster.squads, groups).map((section) => [
            section.title,
            section.squads.map((squad) => squad.name),
        ]),
        [
            ["Velení", ["CMD", "Arty"]],
            ["Pěchota", ["F1"]],
        ]
    )
    // Unknown groups keep their own name after the known ones.
    assert.deepEqual(
        rosterSections(roster.squads).map((section) => section.title),
        ["Velení", "Dělostřelectvo", "Pěchota"]
    )
})

test("saved section order overrides the group catalogue in published Discord rosters", () => {
    const reordered = roster.squads.map((squad) => ({
        ...squad,
        order: squad.group === "Pěchota" ? -1 : squad.order,
    }))
    assert.deepEqual(
        rosterSections(reordered, groups).map((section) => section.title),
        ["Pěchota", "Velení"]
    )
})

test("variant A: photo, then the whole roster as text, attendance actions and the publish footer", () => {
    const view = rosterMessageView(
        {
            event,
            roster,
            variant: "photo_text",
            image: { url: "attachment://roster.png", description: "Soupiska" },
            publishedAt: "2026-10-11T13:10:00.000Z",
        },
        context(),
        layout
    )
    assert.deepEqual(validateMessageView(view, layout).issues, [])
    const content = text(view)
    assert.match(
        content,
        /^### Soupiska · VLK vs ROG · Přátelák · ne <t:1791741600:d> · <t:1791741600:t>/
    )
    assert.match(
        content,
        /Foy · den · sraz <t:1791739800:t> v kanálu <#200000000000000001> · 7 z 8 míst/
    )
    assert.match(
        content,
        /-# \*\*VELENÍ\*\*\n\*\*CMD\*\* · Commander Kowalski\n\*\*Arty\*\* · Artillery Dělo\\_Pepa/
    )
    assert.match(
        content,
        /\*\*F1\*\* · SL Rex\\_CZ · Medic Medvěd · Support kapitánSova · MG Bizon · AT Zubr · Rifleman —/
    )
    assert.match(
        content,
        /\*\*Zálohy\*\* · ŠtěkotDog\n\*\*Neúčastní se\*\* · Kos/
    )
    assert.match(
        content,
        /-# Zveřejněno ne <t:1791724200:d> v <t:1791724200:t> · Spravováno v Logi$/
    )
    const gallery = layoutMessageView(view, layout).nodes.find(
        (node) => node.type === "gallery"
    )
    assert.ok(gallery)
    assert.deepEqual(
        buttons(view).map((button) => [
            button.label,
            button.kind === "action" ? button.style : "link",
        ]),
        [
            ["Potvrzuji účast", "success"],
            ["Přijdu později", "secondary"],
            ["Nepřijdu", "danger"],
            ["Zobrazit zařazení", "secondary"],
            ["Zobrazit soupisku", "secondary"],
            ["Otevřít soupisku", "link"],
        ]
    )
    // No server password on the public card.
    assert.doesNotMatch(content, /k7-sraz/)
})

test("variant B is the photo only with the same actions", () => {
    const view = rosterMessageView(
        {
            event,
            roster,
            variant: "photo",
            image: { url: "attachment://roster.png" },
        },
        context(),
        layout
    )
    assert.doesNotMatch(text(view), /VELENÍ|Kowalski/)
    assert.equal(buttons(view).length, 6)
})

test("a roster over Discord's 4000 characters keeps the photo and offers the whole roster privately", () => {
    const big: RosterCardRoster = {
        ...roster,
        squads: Array.from({ length: 30 }, (_, index) => ({
            name: `Četa s velmi dlouhým názvem ${index}`,
            group: "Pěchota",
            order: index,
            players: Array.from({ length: 6 }, (__, slot) => ({
                customName: `Hráč s dlouhým jménem ${index}-${slot}`,
                roleName: "Rifleman",
                ack: false,
            })),
        })),
    }
    const view = rosterMessageView(
        {
            event,
            roster: big,
            variant: "photo_text",
            image: { url: "attachment://roster.png" },
        },
        context(),
        layout
    )
    assert.deepEqual(validateMessageView(view, layout).issues, [])
    assert.doesNotMatch(text(view), /Hráč s dlouhým jménem/)
    assert.deepEqual(
        buttons(view).map((button) => button.label),
        [
            "Potvrzuji účast",
            "Přijdu později",
            "Nepřijdu",
            "Zobrazit zařazení",
            "Zobrazit soupisku",
            "Zobrazit celou soupisku",
            "Otevřít soupisku",
        ]
    )
    const full = rosterFullView({
        event,
        roster: big,
        page: 1,
        context: context(),
        paging: { previous: "Předchozí", next: "Další" },
    })
    assert.deepEqual(validateMessageView(full, layout).issues, [])
    assert.equal(full.ephemeral, true)
    assert.match(text(full), /Strana 1 z \d/)
})

test("the squad view lists every slot with its confirmation and the late arrival time", () => {
    const view = rosterSquadView({
        event,
        roster,
        selected: 2,
        context: context(),
    })
    assert.deepEqual(validateMessageView(view, layout).issues, [])
    const content = text(view)
    assert.match(content, /\*\*SOUPISKA · VLK VS ROG\*\*/)
    assert.match(content, /### F1 · Pěchota · 5 z 6/)
    assert.match(
        content,
        /Velitel čety Rex\\_CZ · sraz běží v kanálu <#200000000000000001> · start ve <t:1791741600:t>/
    )
    assert.match(content, /≡ Squad Leader · \*\*Rex\\_CZ\*\* ✓ potvrzeno/)
    assert.match(content, /Support · \*\*kapitánSova\*\* ✕ nepřijde/)
    assert.match(
        content,
        /Machine Gunner · \*\*Bizon\*\* ⏳ zatím ne · přijde později \(20:15\)/
    )
    assert.match(content, /✕ Rifleman · volné místo/)
    assert.match(
        content,
        /-# ✓ potvrzeno · ⏳ zatím ne · potvrzuje se od začátku srazu$/
    )
    const select = layoutMessageView(view, layout).nodes.find(
        (node) => node.type === "select"
    )
    assert.ok(select?.type === "select")
    assert.deepEqual(
        select.select.options.map((option) => option.label),
        [
            "CMD · Velení · 1 z 1",
            "Arty · Dělostřelectvo · 1 z 1",
            "F1 · Pěchota · 5 z 6",
            "Zálohy · 1",
        ]
    )
    assert.equal(select.select.placeholder, "Vyber četu: F1 · Pěchota · 5 z 6")
    const reserves = rosterSquadView({
        event,
        roster,
        selected: "reserves",
        context: context(),
    })
    assert.match(text(reserves), /\*\*ŠtěkotDog\*\* ⏳ zatím ne/)
})

test("Moje zařazení: the place, leader, note, server with password and the meeting buttons", () => {
    const assignment = findMyAssignment(roster, id(4))
    const view = myAssignmentView({ event, assignment, context: context() })
    assert.deepEqual(validateMessageView(view, layout).issues, [])
    assert.equal(view.ephemeral, true)
    const content = text(view)
    assert.match(content, /\*\*MOJE ZAŘAZENÍ · VLK VS ROG\*\*/)
    assert.match(content, /### \+ F1 · Medic/)
    assert.match(content, /Velitel čety Rex\\_CZ · sraz běží v kanálu/)
    assert.match(
        content,
        /> Velení: drž se u tanků ve středu, léčíš hlavně F1\./
    )
    assert.match(content, /Server \*\*VLK Scrim\*\* · heslo `k7-sraz`/)
    assert.match(
        content,
        /-# Heslo vidí jen hráči na soupisce\. Nesdílej ho dál\.$/
    )
    // Medvěd already confirmed: only "Přijdu později" is left.
    assert.deepEqual(
        buttons(view).map((button) => button.label),
        ["Přijdu později"]
    )
    const open = myAssignmentView({
        event,
        assignment: findMyAssignment(roster, id(5)),
        context: context(),
    })
    assert.deepEqual(
        buttons(open).map((button) => [
            button.label,
            button.kind === "action" ? button.style : "link",
        ]),
        [
            ["Potvrdím účast", "primary"],
            ["Přijdu později", "secondary"],
        ]
    )
    // Before the meeting only "Přijdu později".
    const early = myAssignmentView({
        event,
        assignment,
        context: context(Date.parse("2026-10-11T12:00:00.000Z")),
    })
    assert.deepEqual(
        buttons(early).map((button) => button.label),
        ["Přijdu později"]
    )
    // After the start nothing can be confirmed or excused.
    const late = myAssignmentView({
        event,
        assignment,
        context: context(Date.parse("2026-10-11T18:05:00.000Z")),
    })
    assert.deepEqual(buttons(late), [])
})

test("attendance and Zobrazit zařazení IDs name the server in a DM and older IDs still parse", () => {
    // L1-B19, L2-B01: the registry routes by the unchanged prefixes.
    assert.equal(attendanceButtonIds.confirm(""), "attendance-confirm:")
    assert.equal(attendanceButtonIds.late(""), "attendance-late:")
    assert.equal(attendanceButtonIds.decline(""), "attendance-decline:")
    assert.equal(rosterButtonIds.assignment(""), "roster-assignment:")
    const guildId = "900000000000000001"
    const dm = attendanceButtonIds.confirm("event-1", guildId)
    assert.equal(dm, `attendance-confirm:event-1:${guildId}`)
    assert.ok(dm.startsWith(attendanceButtonIds.confirm("")))
    assert.deepEqual(parseEventButtonId(dm, "attendance-confirm:"), {
        eventId: "event-1",
        guildId,
    })
    assert.deepEqual(
        parseEventButtonId(
            rosterButtonIds.assignment("event-1", guildId),
            "roster-assignment:"
        ),
        { eventId: "event-1", guildId }
    )
    // A server card keeps the short form; a DM sent before has no server.
    assert.equal(attendanceButtonIds.late("event-1"), "attendance-late:event-1")
    assert.deepEqual(
        parseEventButtonId("attendance-decline:event-1", "attendance-decline:"),
        { eventId: "event-1" }
    )
    // Anything but a Discord ID after the event is ignored.
    assert.deepEqual(
        parseEventButtonId("roster-assignment:event-1:x", "roster-assignment:"),
        { eventId: "event-1" }
    )
    assert.equal(
        eventCustomId("attendance-late-modal:", "event-1", guildId),
        `attendance-late-modal:event-1:${guildId}`
    )
    // "Moje zařazení" can arrive in a DM, so its buttons name the server.
    const open = myAssignmentView({
        event: { ...event, guildId },
        assignment: findMyAssignment(roster, id(5)),
        context: context(),
    })
    assert.deepEqual(
        buttons(open).map((button) =>
            button.kind === "action" ? button.id : "link"
        ),
        [
            `attendance-confirm:${event.id}:${guildId}`,
            `attendance-late:${event.id}:${guildId}`,
        ]
    )
})

test("Moje zařazení for a reserve and for a player off the roster", () => {
    const reserve = myAssignmentView({
        event,
        assignment: findMyAssignment(roster, id(8)),
        context: context(Date.parse("2026-10-11T13:24:00.000Z")),
    })
    const content = text(reserve)
    assert.match(content, /### Záloha/)
    assert.match(
        content,
        /Sraz ne <t:1791739800:d> v <t:1791739800:t> v kanálu <#200000000000000001> · <t:1791739800:R>/
    )
    assert.match(
        content,
        /Když se uvolní místo, velení tě přesune a pošle ti DM\./
    )
    assert.match(content, /heslo `k7-sraz`/)
    assert.deepEqual(
        buttons(reserve).map((button) => button.label),
        ["Přijdu později"]
    )
    const outside = myAssignmentView({
        event,
        assignment: findMyAssignment(roster, "999"),
        context: context(),
    })
    assert.match(text(outside), /### Na soupisce nejsi/)
    assert.match(
        text(outside),
        /Přihlášky skončily v so <t:1791653400:d> v <t:1791653400:t>\. Jestli chceš hrát, napiš velení\./
    )
    assert.doesNotMatch(text(outside), /k7-sraz/)
    assert.deepEqual(buttons(outside), [])
})

test("the change digest lists every change since the first publish in the shared frame", () => {
    const before = rosterPlaces({
        squads: [
            {
                name: "F1",
                players: [
                    { id: id(7), roleName: "Anti-Tank" },
                    { id: id(4), roleName: "Rifleman" },
                ],
            },
            { name: "F2", players: [{ id: id(6), roleName: "Anti-Tank" }] },
        ],
    })
    const after = rosterPlaces({
        squads: [
            {
                name: "F1",
                players: [
                    { id: id(8), roleName: "Rifleman" },
                    { id: id(6), roleName: "Anti-Tank" },
                ],
            },
            { name: "F2", players: [{ id: id(4), roleName: "Anti-Tank" }] },
        ],
    })
    const view = rosterChangesView({
        event,
        changes: diffRosterPlaces(before, after),
        editedAt: "2026-10-11T16:52:00.000Z",
        context: context(),
    })
    assert.deepEqual(validateMessageView(view, layout).issues, [])
    const content = text(view)
    assert.match(
        content,
        /\*\*ZMĚNY SOUPISKY · VLK VS ROG\*\*\n### Soupiska upravena/
    )
    assert.match(
        content,
        /ne <t:1791741600:d> · sraz <t:1791739800:t> · start <t:1791741600:t>/
    )
    assert.match(content, /\*\*Nově na soupisce\*\*\nŠtěkotDog → F1 · Rifleman/)
    assert.match(content, /\*\*Mimo soupisku\*\*\nZubr, dřív F1 · Anti-Tank/)
    assert.match(
        content,
        /\*\*Přesuny\*\*\nBizon: F2 → F1 · Anti-Tank\nMedvěd: F1 → F2 · Anti-Tank/
    )
    assert.match(
        content,
        /\*\*Nové role\*\*\nMedvěd v F2: Rifleman → Anti-Tank/
    )
    assert.match(
        content,
        /-# Upraveno ne <t:1791737520:d> v <t:1791737520:t> · Spravováno v Logi$/
    )
    assert.deepEqual(
        buttons(view).map((button) => button.label),
        ["Zobrazit zařazení", "Otevřít soupisku"]
    )
    assert.doesNotMatch(content, /Unassigned|📋|🟢|🔴/)
})

test("mentions name every rostered Discord user once", () => {
    assert.deepEqual(rosterMentionIds(roster), [
        id(3),
        id(4),
        id(5),
        id(6),
        id(7),
        id(1),
        id(2),
    ])
})
