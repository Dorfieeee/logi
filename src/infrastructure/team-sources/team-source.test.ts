import {
    allowedTeamSourceUrl,
    parseHeloTeams,
    parseTeamSource,
    parseWardogsTeams,
} from "./team-source"
import assert from "node:assert/strict"
import test from "node:test"

test("Wardogs cards yield decoded code, name and absolute logo, excluding navigation", () => {
    assert.deepEqual(
        parseWardogsTeams(
            `<a href="/teams">Teams</a><a href="/teams/A%26B"><img src="/api/logos/team-logos/a.png"><span class="line-clamp-2">Alpha &amp; Beta</span></a><script>fake teams</script>`
        ),
        [
            {
                name: "Alpha & Beta",
                shortCode: "A&B",
                logoUrl: "https://wardogsleague.net/api/logos/team-logos/a.png",
            },
        ]
    )
    assert.throws(() => parseWardogsTeams("<html>Provider error</html>"))
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
        "http://wardogsleague.net/api/logos/a",
        "https://localhost/a",
        "https://127.0.0.1/a",
        "https://floriansw.github.io/other/a",
        "https://wardogsleague.net.evil.test/api/logos/a",
        "https://user:pass@wardogsleague.net/api/logos/a",
        "https://wardogsleague.net:3210/api/logos/a",
        "https://wardogsleague.net/api/logos/../../private",
    ])
        assert.equal(allowedTeamSourceUrl(url), false, url)
    assert.equal(
        allowedTeamSourceUrl(
            "https://wardogsleague.net/api/logos/team-logos/a.gif"
        ),
        true
    )
})

test("Wardogs selects the provider logo rather than unrelated images in a card", () => {
    const [team] = parseWardogsTeams(
        '<a href="/teams/PMF"><img src="/brand/badge.svg"><span class="line-clamp-2">Pardon My French</span><img alt="" width="48" height="48" class="block shrink-0 object-cover h-12 w-12 text-[11px]" src="/api/logos/team-logos/example.png"></a>'
    )
    assert.equal(
        team?.logoUrl,
        "https://wardogsleague.net/api/logos/team-logos/example.png"
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
