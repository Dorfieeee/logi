import { resultRecordFromSnapshot } from "../../domain/wardogs-league/results"
import { parseLeagueResults, RESULTS_PARSER_ID } from "./parse-results"
import { parseLeagueIndex } from "./parse-index"
import { parseMatchHtml } from "./parse-match"
import { createHash } from "node:crypto"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { load } from "cheerio"
import test from "node:test"

const source = "https://wardogsleague.net/matches/cmuqt8ep605e1lf018w2nlywu"
const html = readFileSync(
    new URL("./fixtures/scheduled.html", import.meta.url),
    "utf8"
)

test("the captured Scheduled page has no placements and says results are unsupported", () => {
    const data = parseMatchHtml(html, source)
    assert.equal(data.results, null)
    assert.deepEqual(
        parseLeagueResults(load(html), {
            teams: data.teams,
            progress: data.progress,
            status: data.status,
        }),
        { results: null, warnings: ["results_not_supported"] }
    )
    assert.equal(RESULTS_PARSER_ID, "final-placements/1")
})

const capture = (name: string) =>
    readFileSync(new URL(`./fixtures/${name}.html`, import.meta.url), "utf8")
const finalSource =
    "https://wardogsleague.net/matches/cmv520uf003glmm01f2ti157i"

test("captured admin-final placements are explicit even with zero leader submissions", () => {
    const match = parseMatchHtml(capture("completed-admin"), finalSource)
    assert.equal(match.status, "Set by admin")
    assert.equal(match.type, "Friendly")
    assert.equal(match.fixtureNumber, 58)
    assert.equal(
        match.progress?.find((step) => step.label === "Placements")?.detail,
        "0/3"
    )
    assert.deepEqual(match.results, {
        placements: [
            { place: 1, teamCode: "III" },
            { place: 2, teamCode: "ROG" },
            { place: 3, teamCode: "HTD" },
        ],
        confirmed: true,
    })
    assert.equal(match.scoringRule, "1st 3 · 2nd 2 · 3rd 1")
    const record = resultRecordFromSnapshot(
        { ...match, fetchedAt: "2026-10-24T00:00:00.000Z" },
        "2026-10-24T00:00:00.000Z"
    )
    assert.equal(record?.pointsRuleSource, "published")
    assert.deepEqual(record?.pointsRule, [3, 2, 1])
    assert.deepEqual(
        match.teams?.map((team) => [team.code, team.name, team.faction]),
        [
            ["III", "Defcon III", "Manticore"],
            ["ROG", "Team Rogue", "Lonestar"],
            ["HTD", "HaiiTeD", "Valkyra"],
        ]
    )
    assert.deepEqual(match.warnings, [])
})

test("captured automatic confirmation reads its own final step and team identities", () => {
    const match = parseMatchHtml(
        capture("completed-confirmed"),
        "https://wardogsleague.net/matches/cmuim5nu20073lf01332kozcf"
    )
    assert.deepEqual(match.results, {
        placements: [
            { place: 1, teamCode: "ROG" },
            { place: 2, teamCode: "BMF" },
            { place: 3, teamCode: "RCNE" },
        ],
        confirmed: true,
    })
    assert.equal(match.status, "Confirmed")
    assert.equal(match.scheduledAt, "2026-10-03T18:00:00.000Z")
})

test("captured two-team result preserves ranks two and three without inventing first place or a no-show", () => {
    const match = parseMatchHtml(
        capture("completed-two-ranked"),
        "https://wardogsleague.net/matches/cmuduewpx0001o601v5we0g4e"
    )
    assert.deepEqual(match.results, {
        placements: [
            { place: 2, teamCode: "AK|" },
            { place: 3, teamCode: "BAMC" },
        ],
        confirmed: true,
    })
    assert.equal(
        match.teams?.[0].profileUrl,
        "https://wardogsleague.net/teams/AK%7C"
    )
    assert.equal(match.teams?.length, 2)
})

test("synthetic DOM reorder and ties preserve explicit rank labels, never visual order", () => {
    const $ = load(capture("completed-admin"))
    const list = $('section[aria-labelledby="placements-title"] > ol')
    const first = list.children("li").first()
    first.find("a > span").first().text("2")
    list.append(first)
    const match = parseMatchHtml($.html(), finalSource)
    assert.deepEqual(match.results, {
        placements: [
            { place: 2, teamCode: "ROG" },
            { place: 3, teamCode: "HTD" },
            { place: 2, teamCode: "III" },
        ],
        confirmed: true,
    })
})

test("malformed, duplicated, foreign and ambiguous placement cards fail closed", () => {
    const mutate: ((document: ReturnType<typeof load>) => void)[] = [
        ($) => {
            $('section[aria-labelledby="placements-title"]').append(
                $('section[aria-labelledby="placements-title"] > ol').clone()
            )
        },
        ($) => {
            const list = $('section[aria-labelledby="placements-title"] > ol')
            list.append(list.children("li").first().clone())
        },
        ($) => {
            $('section[aria-labelledby="placements-title"] a')
                .first()
                .attr("href", "https://attacker.invalid/teams/III")
        },
        ($) => {
            $('section[aria-labelledby="placements-title"] a')
                .first()
                .attr("href", "/teams/OTHER")
        },
        ($) => {
            $('section[aria-labelledby="placements-title"] a > span')
                .first()
                .text("0")
        },
        ($) => {
            $('section[aria-labelledby="placements-title"] a > span')
                .first()
                .text("21")
        },
        ($) => {
            $('section[aria-labelledby="placements-title"] a > span')
                .first()
                .remove()
        },
        ($) => {
            $('section[aria-labelledby="placements-title"] > ol > li')
                .first()
                .remove()
        },
        ($) => {
            $('section[aria-labelledby="placements-title"]')
                .clone()
                .appendTo("main")
        },
    ]
    for (const change of mutate) {
        const $ = load(capture("completed-admin"))
        change($)
        const match = parseMatchHtml($.html(), finalSource)
        assert.equal(match.results, null)
        assert.ok(match.warnings.includes("results_invalid_placements"))
    }
})

test("the actual anonymous results index includes the captured matches and fixture hashes match provenance", () => {
    const index = parseLeagueIndex(
        capture("index-results"),
        "https://wardogsleague.net/matches?tab=results"
    )
    assert.equal(index.tab, "results")
    for (const id of [
        "cmv520uf003glmm01f2ti157i",
        "cmuim5nu20073lf01332kozcf",
        "cmuduewpx0001o601v5we0g4e",
    ])
        assert.ok(
            index.matchUrls.includes(`https://wardogsleague.net/matches/${id}`)
        )
    const provenance = JSON.parse(
        readFileSync(
            new URL("./fixtures/results-provenance.json", import.meta.url),
            "utf8"
        )
    ) as {
        captures: {
            file: string
            fixtureBytes: number
            fixtureSha256: string
        }[]
    }
    for (const item of provenance.captures) {
        const bytes = readFileSync(
            new URL(`./fixtures/${item.file}`, import.meta.url)
        )
        assert.equal(bytes.length, item.fixtureBytes)
        assert.equal(
            createHash("sha256").update(bytes).digest("hex"),
            item.fixtureSha256
        )
    }
})

test("unknown, disputed and unfinished confirmation states cannot publish confirmed results", () => {
    for (const state of ["Live", "Disputed", "Completed", "Cancelled"]) {
        const $ = load(capture("completed-admin"))
        $("main > header span")
            .filter((_, element) => $(element).text() === "Set by admin")
            .text(state)
        const match = parseMatchHtml($.html(), finalSource)
        assert.equal(match.results, null)
        assert.ok(match.warnings.includes("results_unverified_state"))
    }
    const $ = load(capture("completed-confirmed"))
    $('ol[aria-label="Match progress"] > li')
        .last()
        .find("span")
        .first()
        .find("span")
        .text("(not started yet)")
    assert.equal(parseMatchHtml($.html(), finalSource).results, null)
})

test("a final result cannot bind to a different or incomplete context team set", () => {
    const html = capture("completed-confirmed")
    const match = parseMatchHtml(html, finalSource)
    assert.deepEqual(
        parseLeagueResults(load(html), {
            ...match,
            teams: match.teams!.slice(1),
        }),
        { results: null, warnings: ["results_team_mismatch"] }
    )
})

test("a synthetic finished page still yields no invented placements", () => {
    // Real completed markup is unknown; this mutation is not evidence of it.
    const finished = html
        .replace("Scheduled", "Completed")
        .replace(
            "<span>Placements<span> (<!-- -->not started yet<!-- -->)</span>",
            "<span>Placements<span> (<!-- -->done<!-- -->)</span>"
        )
        .replace(
            "<span>Confirmed<span> (<!-- -->not started yet<!-- -->)</span>",
            "<span>Confirmed<span> (<!-- -->done<!-- -->)</span>"
        )
    const data = parseMatchHtml(finished, source)
    assert.equal(data.status, "Completed")
    assert.equal(
        data.progress?.find((step) => step.label === "Placements")?.state,
        "done"
    )
    assert.equal(data.results, null)
    assert.ok(data.warnings.includes("results_not_supported"))
})
