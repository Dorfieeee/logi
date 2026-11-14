import { GET } from "@/app/api/v1/clan/[[...path]]/route"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

test("HTTP polling caches projections while checking live revocation, grants and dependency versions", async (t) => {
    process.env.NEXT_PUBLIC_CONVEX_URL =
        "https://offline-cache-test.convex.cloud"
    process.env.INTERNAL_AUTH_SECRET = "synthetic-http-cache-secret"
    const member = JSON.parse(
        readFileSync("docs/integrations/website/v0.14/fixtures.json", "utf8")
    ).member
    let version = "1",
        revoked = false,
        allowed = true,
        authReads = 0,
        projectionReads = 0
    t.mock.method(
        globalThis,
        "fetch",
        async (_url: unknown, init?: RequestInit) => {
            const request = JSON.parse(String(init?.body)),
                args = request.args[0]
            let value: unknown
            if (request.path === "apiKeyAuth:authenticateKey") {
                authReads++
                assert.equal(args.projectionCache, true)
                value = revoked
                    ? null
                    : {
                          guildId: member.guildId,
                          lastUsedAt: new Date().toISOString(),
                          projectionVersion: version,
                          readAccess: {
                              resources: allowed
                                  ? ["member-summaries", "event-summaries"]
                                  : ["teams"],
                              gameIds: ["wardogs"],
                          },
                      }
            } else if (request.path === "peopleSummaries:list") {
                projectionReads++
                value =
                    args.cursor && args.peopleScopeVersion !== version
                        ? { resetRequired: true }
                        : {
                              items: args.cursor ? [] : [member],
                              nextCursor: args.cursor
                                  ? null
                                  : "native-cache-page",
                              limit: 10,
                              peopleScopeVersion: version,
                              resetRequired: false,
                          }
            } else if (request.path === "integrationChanges:readSyncRecord") {
                projectionReads++
                value = {
                    guildId: member.guildId,
                    gameId: "wardogs",
                    resource: args.resource,
                    id: args.id,
                    revision: version,
                    operation: "remove",
                    data: null,
                }
            } else throw new Error(`Unexpected request ${request.path}`)
            return Response.json({ status: "success", value })
        }
    )
    const call = (
        path: string,
        key = "synthetic-http-cache-reader",
        query = ""
    ) =>
        GET(
            new Request(
                `https://http-cache.test/api/v1/clan/${path}?game=wardogs${query}`,
                { headers: { Authorization: `Bearer ${key}` } }
            ),
            { params: Promise.resolve({ path: path.split("/") }) }
        )
    for (const path of [
        "member-summaries",
        "sync-records/event-summaries/event-cache",
    ]) {
        const before = projectionReads
        assert.equal((await call(path)).headers.get("X-Logi-Cache"), "miss")
        assert.equal((await call(path)).headers.get("X-Logi-Cache"), "hit")
        assert.equal(projectionReads, before + 1)
        version = String(Number(version) + 1)
        assert.equal((await call(path)).headers.get("X-Logi-Cache"), "miss")
        assert.equal(
            (await call(path, "another-cache-reader")).headers.get(
                "X-Logi-Cache"
            ),
            "miss"
        )
        allowed = false
        const beforeDenied = projectionReads
        assert.equal((await call(path)).status, 403)
        allowed = true
        revoked = true
        assert.equal((await call(path)).status, 401)
        assert.equal(projectionReads, beforeDenied)
        revoked = false
    }
    assert.equal(authReads, 12)
    const firstPage = await (await call("member-summaries")).json()
    const query = `&cursor=${encodeURIComponent(firstPage.page.nextCursor)}`
    assert.equal((await call("member-summaries", undefined, query)).status, 200)
    assert.equal(
        (await call("member-summaries", undefined, query)).headers.get(
            "X-Logi-Cache"
        ),
        "hit"
    )
    version = String(Number(version) + 1)
    assert.equal((await call("member-summaries", undefined, query)).status, 410)
})
