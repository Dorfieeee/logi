import { teamScrapeHandler } from "./team-scrape-route"
import assert from "node:assert/strict"
import test from "node:test"

const request = (body: unknown, origin = "https://logi.test") =>
    new Request("https://logi.test/api/superadmin/teams/scrape", {
        method: "POST",
        headers: { origin, "Content-Type": "application/json" },
        body: JSON.stringify(body),
    })
test("scraping requires same origin, superadmin and supported game before any work", async () => {
    let allowed = false,
        calls = 0
    const handler = teamScrapeHandler({
        origin: "https://logi.test",
        access: async () => (allowed ? "admin" : null),
        scrape: async (_access, game) => {
            calls++
            return { game, created: 2, skipped: 1, failed: [] }
        },
    })
    assert.equal(
        (await handler(request({ gameId: "wardogs" }, "https://evil.test")))
            .status,
        403
    )
    assert.equal((await handler(request({ gameId: "wardogs" }))).status, 403)
    allowed = true
    assert.equal(
        (await handler(request({ gameId: "hell_let_loose_vietnam" }))).status,
        400
    )
    assert.equal(
        (
            await handler(
                request({ gameId: "wardogs", url: "https://evil.test" })
            )
        ).status,
        400
    )
    assert.equal(calls, 0)
    const response = await handler(request({ gameId: "wardogs" }))
    assert.equal(response.status, 200)
    assert.equal(response.headers.get("cache-control"), "no-store")
    assert.equal(calls, 1)
})
test("provider errors produce a retryable unavailable response without leaking details", async () => {
    const handler = teamScrapeHandler({
        origin: "https://logi.test",
        access: async () => "admin",
        scrape: async () => {
            throw new Error("private detail")
        },
    })
    const response = await handler(request({ gameId: "hell_let_loose" }))
    assert.equal(response.status, 503)
    assert.deepEqual(await response.json(), { error: "unavailable" })
})
