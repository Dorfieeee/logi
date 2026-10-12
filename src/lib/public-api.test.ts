import { ConvexHttpClient } from "convex/browser"
import assert from "node:assert/strict"
import test from "node:test"

import {
    hashApiKey,
    readBearerToken,
    mutateClanApiAssignment,
} from "./public-api"

test("hashApiKey is deterministic and does not return the secret", () => {
    const key = "logi_very-secret-key"
    assert.equal(hashApiKey(key), hashApiKey(key))
    assert.notEqual(hashApiKey(key), key)
})

test("readBearerToken accepts only a bearer authorization header", () => {
    assert.equal(
        readBearerToken(
            new Request("https://example.test", {
                headers: { authorization: "Bearer logi_key" },
            })
        ),
        "logi_key"
    )
    assert.equal(
        readBearerToken(
            new Request("https://example.test", {
                headers: { authorization: "Basic abc" },
            })
        ),
        null
    )
})

test("assignment gateway sends only hashed API key to Convex", async (t) => {
    const original = process.env.INTERNAL_AUTH_SECRET
    process.env.INTERNAL_AUTH_SECRET = "synthetic-secret"
    const originalUrl = process.env.NEXT_PUBLIC_CONVEX_URL
    process.env.NEXT_PUBLIC_CONVEX_URL = "https://synthetic.convex.cloud"
    t.after(() => {
        if (original === undefined) delete process.env.INTERNAL_AUTH_SECRET
        else process.env.INTERNAL_AUTH_SECRET = original
        if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_CONVEX_URL
        else process.env.NEXT_PUBLIC_CONVEX_URL = originalUrl
    })
    const call = t.mock.method(
        ConvexHttpClient.prototype,
        "mutation",
        async (_reference: unknown, args: Record<string, unknown>) => {
            assert.equal("key" in args, false)
            assert.equal(args.keyHash, hashApiKey("synthetic-key"))
            assert.equal(args.secret, "synthetic-secret")
            assert.equal(args.userId, "111111111111111111")
            return { status: 201, body: "{}" }
        }
    )
    await mutateClanApiAssignment({
        key: "synthetic-key",
        idempotencyKey: "assignment-1",
        bodyHash: "hash",
        methodPath: "POST /clan/assignments",
        operation: "create",
        userId: "111111111111111111",
        gameId: "wardogs",
        type: "member",
        status: "pending",
        secondaryGroupIds: [],
        paused: false,
    })
    assert.equal(call.mock.callCount(), 1)
})
