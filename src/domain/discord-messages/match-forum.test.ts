import assert from "node:assert/strict"
import test from "node:test"

import { getAnnouncementMessages } from "@/lib/clan-language/announcements"
import { getRosterMessages } from "@/lib/clan-language/rosters"
import { getSystemMessages } from "@/lib/clan-language/system"

import {
    categoryChip,
    categoryChipTone,
    matchForumChannelName,
    matchSidesLine,
    matchTitle,
    noticeArrivalTime,
    playerName,
    weekdayDate,
} from "./match-text"
import {
    attendanceNoticeView,
    debriefView,
    forumInfoView,
    forumTopicView,
    type ForumEvent,
} from "./match-forum"
import {
    buildAnnouncementView,
    matchSidesLine as announcementSidesLine,
} from "./match-announcement"
import { layoutMessageView, type MessageLayoutOptions } from "./message-layout"
import { clanResultSummary, resultProviderName } from "./clan-result"
import { validateMessageView } from "./message-validation"
import type { MessageView } from "./message-view"

const layout: MessageLayoutOptions = {
    copy: getSystemMessages("cs").kit,
    locale: "cs-CZ",
}
const copy = getRosterMessages("cs")
const context = { copy, timeZone: "Europe/Prague" }

const teams = [
    { slot: "b", side: "Axis", snapshot: { name: "Rogue", shortCode: "ROG" } },
    { slot: "a", side: "Allies", snapshot: { name: "Vlci", shortCode: "VLK" } },
]

const event: ForumEvent = {
    id: "event-1",
    title: "VLK vs ROG",
    category: { label: "Přátelák", color: "#22c55e" },
    teams,
    mapLabel: "Foy · den",
    meetingStart: "2026-10-11T17:30:00.000Z",
    gameStart: "2026-10-11T18:00:00.000Z",
    meetingChannelId: "200000000000000001",
    server: "VLK Scrim",
    hasPassword: true,
    notes: "Tanky drží střed, F2 brání. Mikrofon povinný.",
    imageUrl: "https://cdn.example/briefing.png",
}

const text = (view: MessageView) =>
    layoutMessageView(view, layout)
        .nodes.flatMap((node) =>
            node.type === "text"
                ? [node.content]
                : node.type === "section"
                  ? node.texts
                  : []
        )
        .join("\n")

test("match title, sides, weekday date, names, forum name and arrival time", () => {
    assert.equal(
        matchTitle({ name: "Liga 4", matchTeams: teams }),
        "VLK vs ROG"
    )
    assert.equal(matchTitle({ name: "Trénink obrany" }), "Trénink obrany")
    assert.equal(
        matchSidesLine({ teams, factions: copy.factions }),
        "`VLK` Spojenci ★  vs  `ROG` Osa ✚"
    )
    assert.equal(
        matchSidesLine({ side: "Allies", factions: copy.factions }),
        "Spojenci ★"
    )
    assert.equal(
        weekdayDate("2026-10-11T18:00:00.000Z", "cs-CZ", "Europe/Prague"),
        "ne <t:1791741600:d>"
    )
    assert.equal(playerName({ id: "1", customName: "Rex_CZ" }, {}), "Rex\\_CZ")
    assert.equal(
        playerName({ id: "100000000000000001" }, {}),
        "<@100000000000000001>"
    )
    assert.equal(
        matchForumChannelName(
            "VLK vs ROG",
            "2026-10-11T18:00:00.000Z",
            "Europe/Prague"
        ),
        "vlk-vs-rog-11-10"
    )
    assert.equal(
        matchForumChannelName(
            "Trénink · obrana",
            "2026-10-12T17:00:00.000Z",
            "Europe/Prague"
        ),
        "trénink-obrana-12-10"
    )
    assert.equal(noticeArrivalTime("Ve 20:15, končím v práci"), "20:15")
    assert.equal(noticeArrivalTime("asi 9.05"), "09:05")
    assert.equal(noticeArrivalTime("později"), undefined)
})

test("Informace o zápasu: chip, sides, start, meeting, server without the password, maps, image and Zobrazit zařazení", () => {
    const view = forumInfoView({
        event,
        stratmaps: [
            {
                title: "Obrana středu",
                url: "https://logi.example/cs/stratmaps/a",
            },
            { title: "Protiútok", url: "https://logi.example/cs/stratmaps/b" },
        ],
        context,
    })
    assert.deepEqual(validateMessageView(view, layout).issues, [])
    const content = text(view)
    assert.match(
        content,
        /-# \*\*INFORMACE O ZÁPASU\*\*\n### VLK vs ROG\n🟢 \*\*Přátelák\*\*/
    )
    // The same code chips and emblems as the announcement (L1-130).
    assert.match(content, /`VLK` Spojenci ★  vs  `ROG` Osa ✚/)
    assert.match(
        content,
        /\*\*ne <t:1791741600:d> · <t:1791741600:t>\*\* · <t:1791741600:R>/
    )
    assert.match(
        content,
        /Foy · den · sraz <t:1791739800:t> v kanálu <#200000000000000001>/
    )
    assert.match(
        content,
        /Server \*\*VLK Scrim\*\* · heslo najdeš pod Zobrazit zařazení\./
    )
    assert.match(content, /Tanky drží střed, F2 brání\. Mikrofon povinný\./)
    assert.match(
        content,
        /\*\*Taktické mapy\*\* · \[Obrana středu\]\(https:\/\/logi\.example\/cs\/stratmaps\/a\) · \[Protiútok\]/
    )
    assert.doesNotMatch(content, /Stratmaps/)
    assert.ok(content.endsWith("-# Spravováno v Logi"))
    const nodes = layoutMessageView(view, layout).nodes
    assert.ok(nodes.some((node) => node.type === "gallery"))
    const buttons = nodes.flatMap((node) =>
        node.type === "buttons" ? node.buttons : []
    )
    assert.deepEqual(
        buttons.map((button) => [
            button.label,
            button.kind === "action" ? button.style : "link",
        ]),
        [["Zobrazit zařazení", "primary"]]
    )
})

test("a topic post is the clan card with the preset in its footer", () => {
    const view = forumTopicView({
        title: "Komunikace a rádio",
        body: "Velitelé čet mluví na velitelském kanálu krátce: kde, co, kolik.",
        presetName: "Komunikace",
        copy,
    })
    assert.match(
        text(view),
        /### Komunikace a rádio\nVelitelé čet mluví.*\n-# Z předvolby témat Komunikace · Spravováno v Logi/
    )
})

test("Debrief: played chip, then the confirmed result and the match link", () => {
    const before = debriefView({ event, context })
    assert.match(
        text(before),
        /-# \*\*DEBRIEF\*\*\n### VLK vs ROG\n🟢 \*\*Přátelák\*\* · ⚪ \*\*Odehráno\*\* · ne <t:1791741600:d> · Foy · den/
    )
    assert.match(
        text(before),
        /Sem patří poznámky po zápase: co fungovalo, co příště jinak a odkazy na záznamy\./
    )
    const after = debriefView({
        event,
        result: {
            outcome: "win",
            score: "4 : 1",
            matchUrl: "https://logi.example/cs/matches/event-1",
        },
        context,
    })
    assert.match(
        text(after),
        /ne <t:1791741600:d> · \*\*Výhra 4 : 1\*\* · Foy · den/
    )
    const buttons = layoutMessageView(after, layout).nodes.flatMap((node) =>
        node.type === "buttons" ? node.buttons : []
    )
    assert.deepEqual(
        buttons.map((button) => button.label),
        ["Zobrazit zápas"]
    )
})

test("the attendance post in the match thread never shows the reason", () => {
    const view = attendanceNoticeView({
        kind: "late",
        name: "Hráč_17",
        event,
        place: { squad: "Able", role: "Medic" },
        attendanceUrl:
            "https://logi.example/cs/dashboard/servers/1/matches/event-1?tab=attendance",
        context,
    })
    assert.deepEqual(validateMessageView(view, layout).issues, [])
    const content = text(view)
    assert.match(
        content,
        /-# \*\*DOCHÁZKA · VLK VS ROG\*\*\n### Hráč\\_17 přijde později/
    )
    assert.match(
        content,
        /ne <t:1791741600:d> · start <t:1791741600:t> · Able · Medic/
    )
    assert.match(content, /Důvod vidí jen velení na webu\./)
    // The board's card: "start 20:00" without "ve", and no divider (L5-43).
    assert.doesNotMatch(content, /start ve/)
    assert.deepEqual(
        view.blocks.map((block) => block.kind),
        ["meta", "text", "buttons"]
    )
    const absent = attendanceNoticeView({
        kind: "absent",
        name: "Kos",
        event,
        context,
    })
    assert.match(text(absent), /### Kos nepřijde/)
})

test("category chips keep the category colour as their dot", () => {
    assert.equal(categoryChipTone("#22c55e"), "success")
    assert.equal(categoryChipTone("#E8A33D"), "warning")
    assert.equal(categoryChipTone("#ef4444"), "danger")
    assert.equal(categoryChipTone("#3b82f6"), "info")
    assert.equal(categoryChipTone("#808080"), "neutral")
    assert.equal(categoryChipTone(undefined), "neutral")
    assert.deepEqual(categoryChip({ label: " Přátelák ", color: "#3BA55C" }), [
        { label: "Přátelák", tone: "success" },
    ])
    assert.deepEqual(categoryChip({ label: " " }), [])
    assert.deepEqual(categoryChip(null), [])
})

test("a confirmed result reads with the clan's score first; provisional ones are not shown", () => {
    const result = {
        status: "confirmed" as const,
        participants: [
            { label: "Axis", score: 1 },
            { label: "Allies", score: 4 },
        ],
        provenance: { sources: [{ provider: "hll_crcon" }] },
    }
    assert.deepEqual(clanResultSummary({ result, clanSide: "Allies" }), {
        outcome: "win",
        score: "4 : 1",
    })
    assert.equal(
        clanResultSummary({
            result: { ...result, status: "provisional" },
            clanSide: "Allies",
        }),
        null
    )
    assert.equal(clanResultSummary({ result, clanSide: null }), null)
    assert.equal(resultProviderName(result), "CRCON")
})

test("a legacy public-link import keeps its stored clan outcome and side order", () => {
    const result = {
        status: "confirmed" as const,
        participants: [
            { label: "Axis", score: 2 },
            { label: "Allies", score: 3 },
        ],
        provenance: { origin: "legacy_import" as const, sources: [] },
    }
    assert.deepEqual(
        clanResultSummary({
            result,
            clanSide: "Allies",
            imported: {
                outcome: "defeat",
                score: { sideA: 3, sideB: 2 },
                sideA: "Axis",
                sideB: "Allies",
            },
        }),
        { outcome: "loss", score: "2 : 3" }
    )
})

test("the forum post draws the announcement's sides row and category chip (L1-130)", () => {
    const announcementCopy = getAnnouncementMessages("cs")
    const card = {
        kind: "match" as const,
        eventId: "event-1",
        guildId: "111111111111111111",
        name: "Liga 4",
        category: event.category,
        teams: [
            { code: "VLK", side: "Allies" },
            { code: "ROG", side: "Axis" },
        ],
        meetingStart: event.meetingStart,
        gameStart: event.gameStart,
        registrationEnd: "2026-10-10T17:30:00.000Z",
        timeZone: "Europe/Prague",
        locale: "cs-CZ",
    }
    const forum = forumInfoView({ event, stratmaps: [], context })
    const sides = forum.blocks.find((block) => block.kind === "text")
    assert.equal(
        sides?.kind === "text" ? sides.markdown : undefined,
        announcementSidesLine(card, announcementCopy)
    )
    assert.deepEqual(forum.header?.chips, categoryChip(event.category))
    assert.deepEqual(
        forum.header?.chips,
        buildAnnouncementView({
            event: card,
            state: "open",
            counts: { groups: [], withoutGroup: 0, total: 0, declined: 0 },
            links: { calendar: "https://calendar.example" },
            copy: announcementCopy,
        }).header?.chips
    )
})
