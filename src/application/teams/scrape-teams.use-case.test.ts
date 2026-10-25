import {
    scrapeTeams,
    type PreparedTeam,
    type ScrapeTeamsPorts,
} from "./scrape-teams.use-case"
import assert from "node:assert/strict"
import test from "node:test"

test("skips normalized existing names/codes, source duplicates and failed logos; reports concurrent skips", async () => {
    const downloads: string[] = []
    let committed: PreparedTeam[] = []
    const ports: ScrapeTeamsPorts = {
        source: async () => [
            { name: "  ALPHA  TEAM ", shortCode: "NEW", logoUrl: "never" },
            { name: "Other", shortCode: "ａｔ", logoUrl: "never" },
            { name: "Bravo", shortCode: "B", logoUrl: "good" },
            { name: "Duplicate", shortCode: "b", logoUrl: "never" },
            { name: "Broken", shortCode: "X", logoUrl: "broken" },
            { name: "No logo", shortCode: "N", logoUrl: null },
        ],
        existing: async () => [{ name: "Alpha Team", shortCode: "AT" }],
        logo: async (url) => {
            downloads.push(url)
            if (url === "broken") throw new Error("offline")
            return "asset-good"
        },
        key: () => "import-00000001",
        commit: async (game, teams) => {
            assert.equal(game, "wardogs")
            committed = teams
            return { created: 1, skipped: 1 }
        },
    }
    assert.deepEqual(await scrapeTeams(ports, "wardogs"), {
        created: 1,
        skipped: 4,
        failed: ["Broken"],
    })
    assert.deepEqual(downloads, ["good", "broken"])
    assert.equal(committed[0]?.logoAssetId, "asset-good")
    assert.equal(committed[1]?.logoAssetId, null)
})

test("provider failure does not read or write catalogue", async () => {
    await assert.rejects(
        scrapeTeams(
            {
                source: async () => {
                    throw new Error("bad source")
                },
                existing: async () => {
                    assert.fail("must not read")
                },
                logo: async () => {
                    assert.fail("must not upload")
                },
                key: () => "unused",
                commit: async () => {
                    assert.fail("must not write")
                },
            },
            "hell_let_loose"
        ),
        /bad source/
    )
})

test("logo failures can be retried and a fully imported source performs no uploads or commit", async () => {
    let imported = false,
        online = false,
        commits = 0
    const ports: ScrapeTeamsPorts = {
        source: async () => [
            { name: "Alpha", shortCode: "A", logoUrl: "logo" },
        ],
        existing: async () =>
            imported ? [{ name: "Alpha", shortCode: "A" }] : [],
        logo: async () => {
            if (!online) throw new Error("offline")
            return "asset-a"
        },
        key: () => "import-alpha-1",
        commit: async () => {
            commits++
            imported = true
            return { created: 1, skipped: 0 }
        },
    }
    assert.deepEqual(await scrapeTeams(ports, "wardogs"), {
        created: 0,
        skipped: 0,
        failed: ["Alpha"],
    })
    online = true
    assert.deepEqual(await scrapeTeams(ports, "wardogs"), {
        created: 1,
        skipped: 0,
        failed: [],
    })
    assert.deepEqual(await scrapeTeams(ports, "wardogs"), {
        created: 0,
        skipped: 1,
        failed: [],
    })
    assert.equal(commits, 1)
})

test("logo preparation limits concurrent provider requests to four", async () => {
    let active = 0,
        maximum = 0
    await scrapeTeams(
        {
            source: async () =>
                Array.from({ length: 12 }, (_, i) => ({
                    name: `Team ${i}`,
                    shortCode: `${i}`,
                    logoUrl: "logo",
                })),
            existing: async () => [],
            logo: async () => {
                active++
                maximum = Math.max(maximum, active)
                await new Promise((resolve) => setTimeout(resolve, 1))
                active--
                return "asset"
            },
            key: () => "import-key",
            commit: async (_, teams) => ({ created: teams.length, skipped: 0 }),
        },
        "wardogs"
    )
    assert.equal(maximum, 4)
})
