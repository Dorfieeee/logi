import {
    createProjectionReadCache,
    PROJECTION_CACHE_TTL_MS,
    readCachedProjection,
} from "./projection-read-cache"
import assert from "node:assert/strict"
import test from "node:test"

test("five-minute cache coalesces requests and preserves fresh per-request headers", async () => {
    let time = 0,
        reads = 0
    const cache = createProjectionReadCache({ now: () => time })
    let release: (() => void) | undefined
    const gate = new Promise<void>((resolve) => {
        release = resolve
    })
    const read = async () => {
        reads++
        await gate
        return Response.json({ data: reads })
    }
    const first = cache("scope", { "X-RateLimit-Remaining": "10" }, read)
    const second = cache("scope", { "X-RateLimit-Remaining": "9" }, read)
    release?.()
    assert.equal((await first).headers.get("X-Logi-Cache"), "miss")
    const joined = await second
    assert.equal(joined.headers.get("X-Logi-Cache"), "coalesced")
    assert.equal(joined.headers.get("X-RateLimit-Remaining"), "9")
    time = PROJECTION_CACHE_TTL_MS - 1
    const hit = await cache("scope", {}, read)
    assert.equal(hit.headers.get("X-Logi-Cache"), "hit")
    assert.equal(hit.headers.get("Cache-Control"), "no-store")
    assert.deepEqual(await hit.json(), { data: 1 })
    assert.equal(reads, 1)
    time++
    assert.deepEqual(await (await cache("scope", {}, read)).json(), { data: 2 })
})

test("failures, missing projections and oversized bodies do not persist; capacity is bounded", async () => {
    const cache = createProjectionReadCache({
        maxEntries: 1,
        maxBytes: 20,
        maxEntryBytes: 20,
    })
    let reads = 0
    const read = async () => {
        reads++
        return Response.json({ ok: true })
    }
    await assert.rejects(
        cache("error", {}, async () => {
            throw new Error("offline")
        }),
        /offline/
    )
    assert.equal((await cache("error", {}, read)).status, 200)
    for (let i = 0; i < 2; i++) {
        assert.equal(
            (
                await cache(
                    "missing",
                    {},
                    async () => new Response("missing", { status: 404 })
                )
            ).headers.get("X-Logi-Cache"),
            "miss"
        )
        assert.equal(
            (
                await cache(
                    "large",
                    {},
                    async () => new Response("x".repeat(21))
                )
            ).headers.get("X-Logi-Cache"),
            "miss"
        )
    }
    await cache("other", {}, read)
    assert.equal(
        (await cache("error", {}, read)).headers.get("X-Logi-Cache"),
        "miss"
    )
    assert.equal(reads, 3)
})

test("projection cache isolates keys, tenants, games, pages and revisions; policy/live reads bypass it", async () => {
    process.env.INTERNAL_AUTH_SECRET = "synthetic-cache-secret"
    const auth = {
        key: "synthetic-cache-key",
        guildId: "cache-guild",
        headers: {},
        projectionVersion: "1:1",
    }
    let reads = 0
    const read = async () => Response.json({ read: ++reads })
    const url = "https://cache.test/api/v1/clan/member-summaries?game=wardogs"
    const call = (scope = auth, path = url, resource = "member-summaries") =>
        readCachedProjection(new Request(path), scope, resource, read)
    await call()
    assert.equal((await call()).headers.get("X-Logi-Cache"), "hit")
    await call({ ...auth, key: "another-key" })
    await call({ ...auth, guildId: "another-guild" })
    await call({ ...auth, projectionVersion: "2:1" })
    await call(auth, url.replace("wardogs", "hell_let_loose"))
    await call(auth, url + "&cursor=another-page")
    assert.equal(reads, 6)
    for (const resource of [
        "membership-summaries",
        "server-snapshots",
        "integration-health",
        "league-fixtures",
    ])
        for (let i = 0; i < 2; i++)
            assert.equal(
                (await call(auth, url, resource)).headers.get("X-Logi-Cache"),
                "bypass"
            )
    assert.equal(reads, 14)
})
