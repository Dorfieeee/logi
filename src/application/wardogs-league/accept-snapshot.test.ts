import { parseMatchHtml } from "../../infrastructure/wardogs-league/parse-match"
import { projectLeagueFixture } from "../../domain/wardogs-league/fixture"
import { selectTrackedSnapshot } from "./accept-snapshot"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const snapshot = {
    ...parseMatchHtml(
        readFileSync(
            new URL(
                "../../infrastructure/wardogs-league/fixtures/scheduled.html",
                import.meta.url
            ),
            "utf8"
        ),
        "https://wardogsleague.net/matches/cmuqt8ep605e1lf018w2nlywu"
    ),
    fetchedAt: "2026-10-03T12:00:00.000Z",
}
test("tracked snapshot survives cache eviction, older reads and structural regression", () => {
    assert.deepEqual(selectTrackedSnapshot(snapshot, null), {
        snapshot,
        rejected: false,
    })
    assert.deepEqual(
        selectTrackedSnapshot(snapshot, {
            ...snapshot,
            fetchedAt: "2026-10-02T12:00:00.000Z",
        }),
        { snapshot, rejected: true }
    )
    assert.deepEqual(
        selectTrackedSnapshot(snapshot, {
            ...snapshot,
            teams: null,
            fetchedAt: "2026-10-03T13:00:00.000Z",
        }),
        { snapshot, rejected: true }
    )
    const fresh = { ...snapshot, fetchedAt: "2026-10-03T13:00:00.000Z" }
    assert.equal(selectTrackedSnapshot(snapshot, fresh).snapshot, fresh)
})
test("public DTO preserves age and excludes storage, Discord references and private notes", () => {
    const row = {
        matchId: snapshot.id,
        guildId: "guild",
        revision: 1,
        state: "paused",
        tracked: true,
        snapshotJson: JSON.stringify(snapshot),
        discordRefs: [{ messageId: "private" }],
        notes: "private",
        error: "network",
    }
    const dto = projectLeagueFixture(
        row,
        Date.parse(snapshot.fetchedAt) + 600_000
    )!
    assert.equal(dto.ageSeconds, 600)
    assert.equal(dto.stale, true)
    assert.equal(dto.snapshot.fetchedAt, snapshot.fetchedAt)
    assert.equal(JSON.stringify(dto).includes("private"), false)
    assert.equal(
        projectLeagueFixture({ ...row, tracked: false }, Date.now()),
        null
    )
})

test("the captured two-ranked final page replaces a synthetic earlier three-team observation", () => {
    const next = {
        ...parseMatchHtml(
            readFileSync(
                new URL(
                    "../../infrastructure/wardogs-league/fixtures/completed-two-ranked.html",
                    import.meta.url
                ),
                "utf8"
            ),
            "https://wardogsleague.net/matches/cmuduewpx0001o601v5we0g4e"
        ),
        fetchedAt: "2026-10-24T14:00:00.000Z",
    }
    // This prior three-team observation is synthetic; only next is a captured page.
    const previous = {
        ...snapshot,
        id: next.id,
        sourceUrl: next.sourceUrl,
        scheduledAt: next.scheduledAt,
        teams: [
            ...next.teams!.map((team) => ({
                ...team,
                displayedMemberCount: 48,
                nations: ["SYN"],
                readyCheck: "Pending",
            })),
            {
                ...next.teams![0],
                code: "POL",
                name: "Synthetic prior participant",
                profileUrl: "https://wardogsleague.net/teams/POL",
            },
        ],
    }
    assert.deepEqual(selectTrackedSnapshot(previous, next), {
        snapshot: next,
        rejected: false,
    })
    assert.deepEqual(next.results?.placements, [
        { place: 2, teamCode: "AK|" },
        { place: 3, teamCode: "BAMC" },
    ])
    assert.equal(
        selectTrackedSnapshot(previous, {
            ...next,
            fetchedAt: "2026-10-02T00:00:00.000Z",
        }).rejected,
        true
    )
    assert.equal(
        selectTrackedSnapshot(previous, { ...next, id: "foreign" }).rejected,
        true
    )
    assert.equal(
        selectTrackedSnapshot(previous, { ...next, scheduledAt: null })
            .rejected,
        true
    )
})
