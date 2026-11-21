import { gwlFixturesSchema } from "../../domain/gwl/contracts"
import fixtures from "./fixtures/fixtures.json"
import { gwlGet, GwlError } from "./client"
import assert from "node:assert/strict"
import test from "node:test"
test("fixed GWL destination, no redirects, and test-mode isolation metadata", async () => {
    let reserved = 0
    const result = await gwlGet(
        "gwl_test_example",
        "/team/fixtures",
        gwlFixturesSchema,
        {
            reserve: async () => {
                reserved++
            },
            fetcher: async (url, init) => {
                assert.equal(url, "https://gwl.gg/api/v1/team/fixtures")
                assert.equal(init?.redirect, "error")
                return Response.json(fixtures, {
                    headers: { "X-GWL-Mode": "test", ETag: '"abc"' },
                })
            },
        }
    )
    assert.equal(reserved, 1)
    assert.equal(result.test, true)
    assert.equal(result.data?.upcoming.length, 2)
    await assert.rejects(
        gwlGet("key", "https://evil.test", gwlFixturesSchema),
        /invalid_path/
    )
})
test("rate-limit errors retain Retry-After without exposing key or provider messages", async () => {
    await assert.rejects(
        gwlGet("secret", "/team/fixtures", gwlFixturesSchema, {
            fetcher: async () =>
                Response.json(
                    { error: { code: "rate_limited", message: "secret" } },
                    { status: 429, headers: { "Retry-After": "42" } }
                ),
        }),
        (e) =>
            e instanceof GwlError &&
            e.retryAfterMs === 42000 &&
            !e.message.includes("secret")
    )
})
test("ETag 304 returns no fabricated data", async () => {
    const result = await gwlGet("live", "/team/fixtures", gwlFixturesSchema, {
        etag: '"abc"',
        fetcher: async (_, init) => {
            assert.equal(
                (init?.headers as Record<string, string>)["If-None-Match"],
                '"abc"'
            )
            return new Response(null, { status: 304 })
        },
    })
    assert.equal(result.data, null)
})

test("invalid live payloads report schema paths without leaking values", async () => {
    const secret = "gwl_live_private_example_never_return"
    await assert.rejects(
        gwlGet(secret, "/team/fixtures", gwlFixturesSchema, {
            fetcher: async () =>
                Response.json({ upcoming: [{ number: secret }], recent: [] }),
        }),
        (error) => {
            assert.ok(error instanceof GwlError)
            assert.equal(error.diagnostic?.endpoint, "fixtures")
            assert.equal(error.diagnostic?.status, 200)
            assert.equal(error.diagnostic?.reason, "invalid_shape")
            assert.ok(error.diagnostic?.fields?.includes("upcoming.[].number"))
            assert.ok(!JSON.stringify(error.diagnostic).includes(secret))
            return true
        }
    )
})
test("non-JSON responses retain status and format, never response text", async () => {
    const secret = "gwl_live_private_example_never_return"
    await assert.rejects(
        gwlGet(secret, "/team/fixtures", gwlFixturesSchema, {
            fetcher: async () =>
                new Response(`<html>${secret}</html>`, {
                    status: 403,
                    headers: { "Content-Type": "text/html" },
                }),
        }),
        (error) =>
            error instanceof GwlError &&
            error.diagnostic?.status === 403 &&
            error.diagnostic?.format === "html" &&
            !JSON.stringify(error).includes(secret)
    )
})
test("unknown provider error codes cannot echo key material", async () => {
    const secret = "gwl_live_private_example_never_return"
    await assert.rejects(
        gwlGet(secret, "/team/fixtures", gwlFixturesSchema, {
            fetcher: async () =>
                Response.json({ error: { code: secret } }, { status: 500 }),
        }),
        (error) =>
            error instanceof GwlError &&
            error.code === "unavailable" &&
            !error.message.includes(secret)
    )
})
