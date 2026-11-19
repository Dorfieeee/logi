import {
    allowedTeamSourceUrl,
    parseHeloTeams,
    parseTeamSource,
    parseWardogsTeams,
} from "./team-source"
import assert from "node:assert/strict"
import test from "node:test"

test("GWL cards use the displayed tag rather than the slug and ignore navigation", () => {
    assert.deepEqual(
        parseWardogsTeams(
            `<a href="/teams">Teams</a><a href="/teams/fake">Navigation</a><a class="tcd-link" href="/teams/alpha-beta"><img src="/banners/alpha-beta.webp"><img src="/flags/gb.svg"><svg class="tcd-crest"><image href="/logos/alpha-beta.webp?v=123&amp;w=128"></image></svg><div class="tcd-name"><h2>Alpha &amp; Beta</h2><span>A&amp;B</span></div></a><script>fake teams</script>`
        ),
        [
            {
                name: "Alpha & Beta",
                shortCode: "A&B",
                logoUrl: "https://gwl.gg/logos/alpha-beta.webp?v=123&w=128",
            },
        ]
    )
    assert.throws(() => parseWardogsTeams("<html>Provider error</html>"))
    assert.throws(() =>
        parseWardogsTeams(
            '<a class="tcd-link" href="/teams/bad"><div class="tcd-name"><h2>Missing tag</h2></div></a>'
        )
    )
})
test("HeLO maps name, tag and icon and rejects malformed data", () => {
    assert.deepEqual(
        parseHeloTeams([
            {
                name: "Alpha",
                tag: "A",
                icon: "https://floriansw.github.io/helo-team-images/teams/a.png",
            },
            { name: "Beta", tag: "B", icon: "" },
        ]),
        [
            {
                name: "Alpha",
                shortCode: "A",
                logoUrl:
                    "https://floriansw.github.io/helo-team-images/teams/a.png",
            },
            { name: "Beta", shortCode: "B", logoUrl: null },
        ]
    )
    for (const value of [
        [],
        {},
        [{ name: "Alpha" }],
        [{ name: "Alpha", tag: "x".repeat(17) }],
    ])
        assert.throws(() => parseHeloTeams(value))
})
test("logo network access is confined to HTTPS provider paths", () => {
    for (const url of [
        "http://gwl.gg/logos/a.webp",
        "https://localhost/a",
        "https://127.0.0.1/a",
        "https://floriansw.github.io/other/a",
        "https://gwl.gg.evil.test/logos/a.webp",
        "https://user:pass@gwl.gg/logos/a.webp",
        "https://gwl.gg:3210/logos/a.webp",
        "https://gwl.gg/logos/../../private",
        "https://gwl.gg/banners/a.webp",
        "https://gwl.gg/logos/a.svg",
        "https://wardogsleague.net/api/logos/a.gif",
    ])
        assert.equal(allowedTeamSourceUrl(url), false, url)
    assert.equal(
        allowedTeamSourceUrl("https://gwl.gg/logos/team-a.webp?v=123&w=128"),
        true
    )
    assert.equal(allowedTeamSourceUrl("https://gwl.gg/teams"), true)
})

test("GWL rejects an untrusted crest origin", () => {
    assert.throws(
        () =>
            parseWardogsTeams(
                '<a class="tcd-link" href="/teams/a"><div class="tcd-name"><h2>Alpha</h2><span>A</span></div><svg class="tcd-crest"><image href="https://other.test/logos/a.webp"></image></svg></a>'
            ),
        /Unsupported GWL logo URL/
    )
})

test("HeLO rendered cards use the explicit Team Icon alt marker", () => {
    const [team] = parseTeamSource(
        "hell_let_loose",
        '<div class="team-card" data-team-name="Esprit de Corps" data-team-tag="ESPT"><img alt="Unrelated" src="https://other.test/logo"><img alt="Team Icon" loading="lazy" decoding="async" width="48px" style="content-visibility: auto;" src="https://floriansw.github.io/helo-team-images/teams/espt_128px.png"></div>'
    )
    assert.equal(
        team?.logoUrl,
        "https://floriansw.github.io/helo-team-images/teams/espt_128px.png"
    )
    assert.equal(team?.shortCode, "ESPT")
})

test("HeLO HTML includes teams without image elements and ignores headings", () => {
    assert.deepEqual(
        parseTeamSource(
            "hell_let_loose",
            "<table><tr><th>Tag</th><th>Name</th></tr><tr><td></td><td>NL</td><td>No Logo</td></tr></table>"
        ),
        [{ name: "No Logo", shortCode: "NL", logoUrl: null }]
    )
})
test("GWL includes logo-free cards without importing placeholder crests or banners", () => {
    assert.deepEqual(
        parseTeamSource(
            "wardogs",
            '<a class="tcd-link" href="/teams/no-logo"><img src="/banners/no-logo.webp"><svg class="tcd-crest"><path d="M0 0"></path></svg><div class="tcd-name"><h2>No Logo</h2><span>NL</span></div></a>'
        ),
        [{ name: "No Logo", shortCode: "NL", logoUrl: null }]
    )
})
