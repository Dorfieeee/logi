import * as sync from "../../../convex/teamCatalogueSync"
import { invoke, testContext } from "./testing/database"
import assert from "node:assert/strict"
import test from "node:test"

process.env.INTERNAL_AUTH_SECRET = "synthetic-catalogue-sync-secret"
const secret = process.env.INTERNAL_AUTH_SECRET

test("scheduled catalogue import needs no user session, shares idempotent writes and supports logo-free teams", async () => {
    const ctx = testContext()
    const input = {
        secret,
        gameId: "wardogs",
        teams: [
            {
                name: "No Logo",
                shortCode: "NL",
                logoAssetId: null,
                idempotencyKey: "scheduled-team-1",
            },
        ],
    }
    assert.deepEqual(await invoke(sync.commit, ctx, input), {
        created: 1,
        updated: 0,
        skipped: 0,
    })
    assert.deepEqual(await invoke(sync.commit, ctx, input), {
        created: 0,
        updated: 0,
        skipped: 1,
    })
    const page = await invoke(sync.list, ctx, {
        secret,
        gameId: "wardogs",
        archived: true,
        cursor: null,
        limit: 100,
    })
    assert.equal(page.items.length, 1)
    assert.equal(page.items[0].logoUrl, null)
    assert.equal(
        (
            await invoke(sync.list, ctx, {
                secret,
                gameId: "hell_let_loose",
                archived: true,
                cursor: null,
                limit: 100,
            })
        ).items.length,
        0
    )
})

test("scheduled catalogue adapters reject missing authority and unsupported games", async () => {
    const ctx = testContext()
    await assert.rejects(
        invoke(sync.commit, ctx, {
            secret: "wrong",
            gameId: "wardogs",
            teams: [],
        })
    )
    await assert.rejects(
        invoke(sync.list, ctx, {
            secret: "wrong",
            gameId: "wardogs",
            archived: true,
            cursor: null,
            limit: 100,
        })
    )
    await assert.rejects(
        invoke(sync.commit, ctx, { secret, gameId: "other", teams: [] })
    )
})

test("daily refresh calls the authenticated Node image worker and surfaces failures", async () => {
    const previousFetch = globalThis.fetch
    const previousSite = process.env.SITE_URL
    process.env.SITE_URL = "https://dashboard.test"
    try {
        globalThis.fetch = async (url, options) => {
            assert.equal(
                String(url),
                "https://dashboard.test/api/internal/team-catalogue-refresh"
            )
            assert.equal(options?.method, "POST")
            assert.equal(
                new Headers(options?.headers).get("Authorization"),
                `Bearer ${secret}`
            )
            assert.deepEqual(JSON.parse(String(options?.body)), {
                gameId: "wardogs",
            })
            return new Response("unavailable", { status: 503 })
        }
        await assert.rejects(
            invoke(sync.refresh, testContext(), { gameId: "wardogs" }),
            /503/
        )
    } finally {
        globalThis.fetch = previousFetch
        if (previousSite === undefined) delete process.env.SITE_URL
        else process.env.SITE_URL = previousSite
    }
})
