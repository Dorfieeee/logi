import assert from "node:assert/strict"
import test from "node:test"

import type { MatchListResultReview } from "@/domain/events/match-list"
import type { EventRecord, Roster } from "@/types/domain"
import { getDictionary } from "@/i18n/dictionaries"

import { buildMatchListRows, buildRecurringMatchRows } from "./match-list-rows"

// Sunday 11 October 2026, 12:00 in Prague.
const now = new Date("2026-10-11T10:00:00.000Z")
const dictionary = getDictionary("cs")
const categories = [{ id: "friendly", label: "Přátelák", color: "#22c55e" }]

function attending(count: number, completed?: "passed" | "failed") {
    return Array.from({ length: count }, (_, index) => ({
        userId: `${completed ?? "u"}${index}`,
        status: "attending" as const,
        completed,
        updatedAt: "2026-10-01T10:00:00.000Z",
    }))
}

function event(overrides: Partial<EventRecord>): EventRecord {
    return {
        id: "e",
        guildId: "guild",
        gameId: "hell_let_loose",
        kind: "match",
        name: "Match",
        requiredRoleIds: [],
        rewardRoleIds: [],
        registrationEnd: "2026-10-10T18:00:00.000Z",
        meetingStart: "2026-10-11T17:30:00.000Z",
        gameStart: "2026-10-11T18:00:00.000Z",
        gameEnd: "2026-10-11T19:30:00.000Z",
        pingClan: true,
        createForumChannel: true,
        stratmapIds: [],
        status: "closed",
        statusUpdatedAt: "2026-10-01T10:00:00.000Z",
        attendanceReminderLog: [],
        participants: [],
        signUps: [],
        absenceNotices: [],
        createdAt: "2026-09-28T10:00:00.000Z",
        updatedAt: "2026-09-28T10:00:00.000Z",
        ...overrides,
    }
}

const played = {
    status: "concluded" as const,
    registrationEnd: "2026-10-03T18:00:00.000Z",
    meetingStart: "2026-10-04T17:30:00.000Z",
    gameStart: "2026-10-04T18:00:00.000Z",
    gameEnd: "2026-10-04T19:30:00.000Z",
}

const events = [
    event({
        id: "rog",
        name: "VLK vs ROG",
        matchType: "friendly",
        map: "Foy",
        side: "Allies",
        participants: attending(23),
    }),
    event({
        id: "draft",
        isDraft: true,
        name: "Nedělní přátelák",
        matchType: "friendly",
        registrationEnd: "2026-10-17T18:00:00.000Z",
        meetingStart: "2026-10-18T17:30:00.000Z",
        gameStart: "2026-10-18T18:00:00.000Z",
        gameEnd: "2026-10-18T19:30:00.000Z",
    }),
    event({
        id: "def",
        name: "VLK vs DEF",
        map: "Carentan",
        side: "Axis",
        ...played,
        eventResult: {
            sourceUrl: "https://example.invalid",
            mapId: "carentan",
            importedAt: "2026-10-04T19:31:00.000Z",
            sideA: "VLK",
            sideB: "DEF",
            outcome: "victory",
            score: { sideA: 3, sideB: 2 },
        },
    }),
    event({
        id: "kursk",
        name: "VLK vs ROG",
        ...played,
        gameStart: "2026-09-27T18:00:00.000Z",
        gameEnd: "2026-09-27T19:30:00.000Z",
        eventResult: {
            sourceUrl: "https://example.invalid",
            mapId: "kursk",
            importedAt: "2026-09-27T19:31:00.000Z",
            sideA: "VLK",
            sideB: "ROG",
            outcome: "defeat",
            score: { sideA: 1, sideB: 4 },
        },
    }),
    event({
        id: "training",
        kind: "training",
        name: "Trénink pěchoty",
        ...played,
        participants: [...attending(9, "passed"), ...attending(2, "failed")],
    }),
]

function roster(
    eventId: string,
    published: boolean,
    players: Roster["squads"][number]["players"]
): Roster {
    return {
        id: `roster-${eventId}`,
        eventId,
        guildId: "guild",
        squads: [
            { name: "Able", group: "inf", order: 0, color: "#000", players },
        ],
        reservePlayerIds: [],
        notAttendingPlayerIds: [],
        published,
        createdAt: "2026-10-01T10:00:00.000Z",
        updatedAt: "2026-10-01T10:00:00.000Z",
    }
}

const rosters = [
    roster("rog", false, [
        { id: "p1", ack: false },
        { ack: false },
        { ack: false },
        { ack: false },
        { ack: false },
    ]),
    roster("def", true, [
        { id: "p1", ack: true },
        { id: "p2", ack: false },
        { id: "p3", ack: false },
    ]),
]

const reviews = new Map<string, MatchListResultReview>([
    ["def", { status: "provisional", origin: "legacy_import", scores: [3, 2] }],
    ["kursk", { status: "confirmed", origin: "legacy_import", scores: [1, 4] }],
])

function build(canAdmin: boolean, list = events) {
    return buildMatchListRows({
        events: list,
        rosters,
        categories,
        canAdmin,
        locale: "cs",
        serverId: "server",
        timeZone: "Europe/Prague",
        dictionary,
        now,
        reviews,
    })
}

test("drafts are listed apart and open the new-match form", () => {
    const { rows, drafts } = build(true)
    assert.equal(
        rows.some((row) => row.id === "draft"),
        false
    )
    assert.deepEqual(
        drafts.map((row) => [row.id, row.href, row.metric, row.badge]),
        [
            [
                "draft",
                "/cs/dashboard/servers/server/matches/create?draftId=draft",
                "neohlášeno",
                { label: "Koncept", tone: "neutral" },
            ],
        ]
    )
    assert.equal(drafts[0].details, "Hell Let Loose · soupeř zatím nevybrán")
})

test("members never get drafts, tasks or review states", () => {
    const { rows, drafts, queue } = build(false)
    assert.deepEqual(drafts, [])
    assert.deepEqual(queue, [])
    assert.equal(
        rows.some((row) => row.id === "draft"),
        false
    )
    const def = rows.find((row) => row.id === "def")
    assert.deepEqual(def?.badge, { label: "Výhra", tone: "success" })
    assert.equal(def?.href, "/cs/dashboard/servers/server/matches/def")
})

test("a reviewed Wardogs result opens its report from the match list", () => {
    const wardogs = event({
        id: "wardogs-result",
        gameId: "wardogs",
        wardogsReportId: "wardogsMatchReports:result",
        ...played,
    })
    assert.equal(
        build(true, [wardogs]).rows[0]?.href,
        "/cs/dashboard/servers/server/matches/wardogs-result/match-stats"
    )
    assert.equal(
        build(false, [wardogs]).rows[0]?.href,
        "/cs/dashboard/servers/server/matches/wardogs-result/match-stats"
    )
})

test("rows show the board's date, details, counts and phases", () => {
    const { rows } = build(true)
    const byId = new Map(rows.map((row) => [row.id, row]))
    const rog = byId.get("rog")
    assert.equal(rog?.date, "ne 11. 10.")
    assert.equal(rog?.time, "20:00")
    assert.equal(rog?.title, "VLK vs ROG · Přátelák")
    assert.equal(rog?.details, "Hell Let Loose · Foy · Spojenci")
    assert.equal(rog?.metric, "23 přihlášeno")
    assert.deepEqual(rog?.badge, {
        label: "Soupiska · koncept",
        tone: "attention",
    })
    assert.equal(
        rog?.href,
        "/cs/dashboard/servers/server/matches/rog?tab=roster"
    )
    assert.equal(rog?.weekLabel, "Tento týden")

    const def = byId.get("def")
    assert.equal(def?.metric, "3 : 2")
    assert.equal(def?.metricTone, "strong")
    assert.deepEqual(def?.badge, {
        label: "Výsledek čeká na potvrzení",
        tone: "attention",
    })
    assert.equal(
        def?.href,
        "/cs/dashboard/servers/server/matches/def?tab=result"
    )
    assert.equal(def?.weekLabel, "Minulý týden")

    assert.deepEqual(byId.get("kursk")?.badge, {
        label: "Prohra · potvrzeno",
        tone: "neutral",
    })
    const training = byId.get("training")
    assert.equal(training?.details, "Trénink · 11 účastníků")
    assert.equal(training?.metric, "9 prošlo, 2 neprošli")
    assert.deepEqual(training?.badge, { label: "Uzavřeno", tone: "success" })
})

test("the queue words roster, result and attendance tasks like the board", () => {
    const { queue } = build(true)
    assert.deepEqual(
        queue.map((item) => [item.kind, item.title, item.detail, item.href]),
        [
            [
                "publishRoster",
                "Zveřejnit soupisku",
                "VLK vs ROG · ne 20:00 · 4 volná místa",
                "/cs/dashboard/servers/server/matches/rog?tab=roster",
            ],
            [
                "confirmResult",
                "Potvrdit výsledek",
                "VLK vs DEF · import 3 : 2 čeká",
                "/cs/dashboard/servers/server/matches/def?tab=result",
            ],
            [
                "confirmAttendance",
                "Zkontrolovat docházku",
                "VLK vs DEF · 2 hráči bez potvrzení",
                "/cs/dashboard/servers/server/matches/def?tab=attendance",
            ],
        ]
    )
})

test("registration deadlines name the weekday within a week, else the date", () => {
    const { rows } = build(true, [
        event({
            id: "soon",
            status: "registration",
            registrationEnd: "2026-10-13T17:30:00.000Z",
            meetingStart: "2026-10-14T17:30:00.000Z",
            gameStart: "2026-10-14T18:00:00.000Z",
            gameEnd: "2026-10-14T19:30:00.000Z",
        }),
        event({
            id: "later",
            status: "registration",
            registrationEnd: "2026-10-24T16:00:00.000Z",
            meetingStart: "2026-10-25T17:30:00.000Z",
            gameStart: "2026-10-25T18:00:00.000Z",
            gameEnd: "2026-10-25T19:30:00.000Z",
        }),
    ])
    assert.deepEqual(
        rows.map((row) => row.badge.label),
        ["Přihlášky do út 19:30", "Přihlášky do 24. 10. 18:00"]
    )
    assert.deepEqual(
        rows.map((row) => row.weekLabel),
        ["Příští týden", "Týden od 19. 10."]
    )
})

test("recurring rows lead with their schedule and skip drafts", () => {
    const rows = buildRecurringMatchRows({
        events: [
            event({
                id: "weekly",
                name: "Liga",
                recurrence: { frequency: "weekly", interval: 1, weekdays: [3] },
            }),
            event({
                id: "pair",
                name: "Dvojice",
                recurrence: {
                    frequency: "weekly",
                    interval: 1,
                    weekdays: [1, 3],
                },
            }),
            event({
                id: "draft",
                isDraft: true,
                recurrence: { frequency: "weekly", interval: 1, weekdays: [3] },
            }),
            event({ id: "single" }),
        ],
        rosters: [],
        categories,
        canAdmin: true,
        locale: "cs",
        serverId: "server",
        timeZone: "Europe/Prague",
        dictionary,
        now,
    })
    assert.deepEqual(
        rows.map((row) => [row.id, row.details]),
        [
            ["weekly", "opakuje se každou středu · Hell Let Loose"],
            [
                "pair",
                "opakuje se každé pondělí a každou středu · Hell Let Loose",
            ],
        ]
    )
})

test("linked matches name their published competition in the details", () => {
    const { rows } = buildMatchListRows({
        events: [
            event({ id: "league", gameId: "wardogs", map: "Zestafona" }),
            event({ id: "playoff", gameId: "wardogs" }),
            event({ id: "training", kind: "training" }),
        ],
        rosters: [],
        categories,
        canAdmin: false,
        locale: "cs",
        serverId: "server",
        timeZone: "Europe/Prague",
        dictionary,
        now,
        competitions: new Map([
            ["league", { name: "ECL", season: "2026", phase: "league" }],
            ["playoff", { name: "ECL 2026", season: "2026", phase: "playoff" }],
            ["training", { name: "ECL", season: "2026", phase: "league" }],
        ]),
    })
    assert.deepEqual(
        rows.map((row) => row.details),
        [
            // A training never names a competition.
            "Trénink · Hell Let Loose",
            "Wardogs · Zestafona · soutěž ECL 2026",
            "Wardogs · soutěž ECL 2026, play-off",
        ]
    )
})
