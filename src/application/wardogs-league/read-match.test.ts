import { parseMatchHtml } from "../../infrastructure/wardogs-league/parse-match"
import { LeagueError, CACHE_MS } from "../../domain/wardogs-league/contracts"
import { readLeagueMatch, type Ports } from "./read-match"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
const url = "https://wardogsleague.net/matches/cmuqt8ep605e1lf018w2nlywu"
const snapshot = {
    ...parseMatchHtml(
        readFileSync(
            new URL(
                "../../infrastructure/wardogs-league/fixtures/scheduled.html",
                import.meta.url
            ),
            "utf8"
        ),
        url
    ),
    fetchedAt: new Date(0).toISOString(),
}
function ports(): Ports {
    return {
        now: () => CACHE_MS + 1000,
        reserve: async () => ({
            kind: "claimed",
            cacheId: "id",
            fence: 1,
            previous: snapshot,
        }),
        fetch: async () => snapshot,
        finish: async (_, result) => ({
            snapshot: "snapshot" in result ? result.snapshot : snapshot,
            lastAttemptAt: CACHE_MS + 1000,
            nextRefreshAt: CACHE_MS * 2,
            error: "error" in result ? result.error : null,
        }),
    }
}
test("cache hit returns original timestamp without fetching", async () => {
    const p = ports()
    p.now = () => 1000
    p.reserve = async () => ({
        kind: "ready",
        state: {
            snapshot,
            lastAttemptAt: 0,
            nextRefreshAt: CACHE_MS,
            error: null,
        },
    })
    p.fetch = async () => {
        throw new Error("unexpected network")
    }
    const result = await readLeagueMatch(url, p)
    assert.equal(result.kind, "data")
    if (result.kind !== "data") return
    assert.equal(result.data.stale, false)
    assert.equal(result.data.ageSeconds, 1)
})
test("failed refresh retains last good snapshot with accurate stale age", async () => {
    const p = ports()
    p.fetch = async () => {
        throw new LeagueError("rate_limited", 120000)
    }
    const finish = p.finish
    p.finish = async (claim, result) => {
        assert.deepEqual(result, {
            error: "rate_limited",
            retryAfterMs: 120000,
        })
        return finish(claim, result)
    }
    const result = await readLeagueMatch(url, p)
    assert.equal(result.kind, "data")
    if (result.kind !== "data") return
    assert.equal(result.data.stale, true)
    assert.equal(result.data.ageSeconds, 301)
    assert.equal(result.data.snapshot?.fetchedAt, snapshot.fetchedAt)
    assert.equal(result.data.error, "rate_limited")
})
test("HTML drift cannot overwrite a previously populated match", async () => {
    const p = ports()
    p.fetch = async () => ({ ...snapshot, teams: null })
    const result = await readLeagueMatch(url, p)
    assert.ok(
        result.kind === "data" &&
            result.data.error === "invalid_html" &&
            result.data.snapshot?.teams?.length === 3
    )
})
test("drift inside map and team cards also preserves the last valid record", async () => {
    for (const next of [
        { ...snapshot, map: { name: null, zone: null, lighting: null } },
        {
            ...snapshot,
            teams: snapshot.teams!.map((t) => ({ ...t, faction: null })),
        },
        { ...snapshot, mapVote: { ...snapshot.mapVote!, closesAt: null } },
    ]) {
        const p = ports()
        p.fetch = async () => next
        const result = await readLeagueMatch(url, p)
        assert.ok(
            result.kind === "data" && result.data.error === "invalid_html"
        )
    }
})
test("revocation or superseded lease after fetch does not return data", async () => {
    const p = ports()
    p.finish = async () => null
    assert.deepEqual(await readLeagueMatch(url, p), { kind: "denied" })
    p.reserve = async () => ({ kind: "denied" })
    p.fetch = async () => {
        throw new Error("unexpected network")
    }
    assert.deepEqual(await readLeagueMatch(url, p), { kind: "denied" })
})

test("a verified final result can replace the cached pre-match layout", async () => {
    const finalUrl =
        "https://wardogsleague.net/matches/cmuim5nu20073lf01332kozcf"
    const next = {
        ...parseMatchHtml(
            readFileSync(
                new URL(
                    "../../infrastructure/wardogs-league/fixtures/completed-confirmed.html",
                    import.meta.url
                ),
                "utf8"
            ),
            finalUrl
        ),
        fetchedAt: new Date(CACHE_MS + 1000).toISOString(),
    }
    const p = ports()
    // The cache's prior observation is synthetic; the final body/URL are captured.
    p.reserve = async () => ({
        kind: "claimed",
        cacheId: "id",
        fence: 1,
        previous: {
            ...snapshot,
            id: next.id,
            sourceUrl: finalUrl,
            scheduledAt: next.scheduledAt,
        },
    })
    p.fetch = async () => next
    const result = await readLeagueMatch(finalUrl, p)
    assert.equal(result.kind, "data")
    if (result.kind !== "data") return
    assert.equal(result.data.error, null)
    assert.equal(result.data.snapshot?.status, "Confirmed")
    assert.deepEqual(result.data.snapshot?.results, next.results)
})
