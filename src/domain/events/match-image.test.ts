import {
    buildMatchImage,
    matchImageAlt,
    type MatchImageInput,
} from "./match-image"
import { matchImageSchema } from "./match-image.schema"
import assert from "node:assert/strict"
import test from "node:test"

const input = (): MatchImageInput => ({
    event: {
        name: "Sunday match",
        gameId: "wardogs",
        map: "Ozeti",
        matchType: "league",
        meetingStart: "2026-10-25T18:30:00.000Z",
        gameStart: "2026-10-25T19:00:00.000Z",
    },
    clan: {
        name: "Your clan",
        avatar: "https://cdn.discordapp.com/icons/123/clan.png",
    },
    language: "en",
    timeZone: "Europe/Prague",
    categories: [{ id: "league", label: "League match" }],
    league: "Wardogs League · Round 4",
})
const team = (slot: "a" | "b" | "c", side: string) => ({
    teamId: slot,
    slot,
    side,
    snapshot: {
        name: `Team ${slot}`,
        shortCode: slot.toUpperCase(),
        logoUrl: `https://logi.example/api/image-assets/${slot.repeat(32)}.png`,
    },
})

test("no assigned teams centres the clan, preferring its linked catalogue identity", () => {
    const original = input()
    const fallback = buildMatchImage(original)
    assert.equal(fallback.teams.length, 1)
    assert.equal(fallback.teams[0]?.name, "Your clan")
    assert.equal(fallback.teams[0]?.logoUrl, original.clan.avatar)
    const linked = buildMatchImage({
        ...original,
        ownTeam: {
            id: "own",
            name: "Catalogue clan",
            shortCode: "CLN",
            logoUrl: "https://logo.example/clan.png",
        },
    })
    assert.equal(linked.teams[0]?.name, "Catalogue clan")
    assert.equal(linked.teams[0]?.code, "CLN")
})

test("team snapshots keep slot order and historical logos; HLL has at most two teams", () => {
    const original = input()
    original.event.matchTeams = [
        team("c", "Lonestar"),
        team("b", "Manticore"),
        team("a", "Valkyra"),
    ]
    const model = buildMatchImage(original)
    assert.deepEqual(
        model.teams.map((t) => t.code),
        ["A", "B", "C"]
    )
    assert.equal(model.teams[0]?.logoUrl, team("a", "Valkyra").snapshot.logoUrl)
    assert.equal(
        buildMatchImage({
            ...original,
            event: { ...original.event, gameId: "hell_let_loose" },
        }).teams.length,
        2
    )
    assert.equal(model.category, "League match")
    assert.equal(model.league, original.league)
    assert.equal(matchImageSchema.safeParse(model).success, true)
})

test("scores follow side labels even when participant ordering differs; a three-team clan beats every opponent", () => {
    const original = input()
    original.event.matchTeams = [
        team("a", "Valkyra"),
        team("b", "Manticore"),
        team("c", "Lonestar"),
    ]
    original.ownTeam = { id: "c", name: "Team c", shortCode: "C" }
    original.result = {
        participants: [
            { label: "Manticore", score: 100 },
            { label: "Lonestar", score: 300 },
            { label: "Valkyra", score: 200 },
        ],
    }
    let model = buildMatchImage(original)
    assert.deepEqual(
        model.teams.map((t) => t.score),
        [200, 100, 300]
    )
    assert.equal(model.result?.outcome, "win")
    original.ownTeam.id = "a"
    model = buildMatchImage(original)
    assert.equal(model.result?.outcome, "loss")
    original.result.participants = [
        { label: "Valkyra", score: 300 },
        { label: "Manticore", score: 100 },
        { label: "Lonestar", score: 300 },
    ]
    assert.equal(buildMatchImage(original).result?.outcome, "draw")
})

test("unknown clan side and missing scores never invent a victory", () => {
    const original = input()
    original.result = {
        participants: [
            { label: "Allies", score: 5 },
            { label: "Axis", score: 0 },
        ],
    }
    assert.equal(buildMatchImage(original).result?.outcome, null)
    original.event.side = "Allies"
    original.result.participants = [
        { label: "Allies", score: null },
        { label: "Axis", score: 0 },
    ]
    assert.equal(buildMatchImage(original).result?.outcome, null)
})

test("an imported outcome stops applying once reviewed scores have changed", () => {
    const original = input()
    original.result = {
        participants: [
            { label: "Allies", score: 5 },
            { label: "Axis", score: 0 },
        ],
        imported: { outcome: "victory", score: { sideA: 5, sideB: 0 } },
    }
    assert.equal(buildMatchImage(original).result?.outcome, "win")
    original.result.participants = [
        { label: "Allies", score: 0 },
        { label: "Axis", score: 5 },
    ]
    assert.equal(buildMatchImage(original).result?.outcome, null)
})

test("alt text uses the clan timezone including daylight-saving changes", () => {
    const original = input()
    assert.match(matchImageAlt(buildMatchImage(original)), /19:30:00/)
    original.event.meetingStart = "2026-07-25T18:30:00.000Z"
    assert.match(matchImageAlt(buildMatchImage(original)), /20:30:00/)
    assert.equal(
        matchImageSchema.safeParse({
            ...buildMatchImage(original),
            timeZone: "../invalid",
        }).success,
        false
    )
})

test("unsafe or malformed renderer inputs are refused", () => {
    const model = buildMatchImage(input())
    assert.equal(
        matchImageSchema.safeParse({ ...model, teams: [] }).success,
        false
    )
    assert.equal(
        matchImageSchema.safeParse({ ...model, gameStart: "tomorrow" }).success,
        false
    )
    assert.equal(
        matchImageSchema.safeParse({
            ...model,
            teams: [
                ...model.teams,
                ...model.teams,
                ...model.teams,
                ...model.teams,
            ],
        }).success,
        false
    )
})

test("an opponent-only legacy match still includes the home clan", () => {
    const original = input()
    original.event.matchTeams = [team("b", "Manticore")]
    assert.deepEqual(
        buildMatchImage(original).teams.map((t) => t.name),
        ["Your clan", "Team b"]
    )
})

test("editable participant labels do not break score matching by stable side IDs", () => {
    const original = input()
    original.event.matchTeams = [team("a", "Valkyra"), team("b", "Manticore")]
    original.event.side = "Valkyra"
    original.result = {
        participants: [
            { id: "valkyra", label: "Home team", score: 100 },
            { id: "manticore", label: "Visitors", score: 200 },
        ],
    }
    const model = buildMatchImage(original)
    assert.equal(model.result?.outcome, "loss")
    assert.deepEqual(
        model.teams.map((t) => t.score),
        [100, 200]
    )
})
