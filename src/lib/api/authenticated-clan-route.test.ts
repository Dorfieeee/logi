import assert from "node:assert/strict"
import test from "node:test"

test("HLL live API requires its own explicit HLL read grant", async () => {
    for (const [readAccess, expected] of [
        [undefined, 403],
        [{ resources: ["server-snapshots"], gameIds: ["hell_let_loose"] }, 403],
        [{ resources: ["hll-live"], gameIds: ["wardogs"] }, 403],
        [{ resources: ["hll-live"], gameIds: ["hell_let_loose"] }, 200],
    ] as const) {
        const result = await authenticateClanRequestWith(
            new Request("https://logi.test/api/v1/clan/hll-live/one", {
                headers: { authorization: "Bearer fixture" },
            }),
            createDependencies({
                authenticateKey: async () => ({
                    guildId: "guild-1",
                    ...(readAccess
                        ? {
                              readAccess: {
                                  resources: [...readAccess.resources],
                                  gameIds: [...readAccess.gameIds],
                              },
                          }
                        : {}),
                }),
            })
        )
        assert.equal(isAuthError(result) ? result.status : 200, expected)
    }
})

test("retained history collection accepts the canonical explicit Wardogs game query and refuses legacy keys", async () => {
    for (const allowed of [true, false]) {
        const result = await authenticateClanRequestWith(
            new Request(
                "https://logi.test/api/v1/clan/server-game-history?game=wardogs",
                { headers: { authorization: "Bearer fixture" } }
            ),
            createDependencies({
                authenticateKey: async () => ({
                    guildId: "guild-1",
                    ...(allowed
                        ? {
                              readAccess: {
                                  resources: ["server-game-history"] as const,
                                  gameIds: ["wardogs"] as const,
                              },
                          }
                        : {}),
                }),
            })
        )
        assert.equal(
            isAuthError(result) ? result.status : 200,
            allowed ? 200 : 403
        )
    }
})

test("HLL history authorization requires its exact game grant and rejects missing or repeated games", async () => {
    for (const [query, grantedGame, expected] of [
        ["game=hell_let_loose", "hell_let_loose", 200],
        ["game=hell_let_loose", "wardogs", 403],
        ["game=wardogs", "hell_let_loose", 403],
        ["game=all", "hell_let_loose", 400],
        ["", "hell_let_loose", 400],
        ["game=hell_let_loose&game=wardogs", "hell_let_loose", 400],
    ] as const) {
        const result = await authenticateClanRequestWith(
            new Request(
                `https://logi.test/api/v1/clan/server-game-history?${query}`,
                { headers: { authorization: "Bearer fixture" } }
            ),
            createDependencies({
                authenticateKey: async () => ({
                    guildId: "guild-1",
                    readAccess: {
                        resources: ["server-game-history"],
                        gameIds: [grantedGame],
                    },
                }),
            })
        )
        assert.equal(isAuthError(result) ? result.status : 200, expected)
    }
})

test("League reads require both explicit Wardogs grants and reject legacy/write access", async () => {
    for (const [readAccess, method, expected] of [
        [undefined, "GET", 403],
        [{ resources: ["events"], gameIds: ["wardogs"] }, "GET", 403],
        [
            { resources: ["league-matches"], gameIds: ["hell_let_loose"] },
            "GET",
            403,
        ],
        [{ resources: ["league-matches"], gameIds: ["wardogs"] }, "POST", 403],
        [{ resources: ["league-matches"], gameIds: ["wardogs"] }, "GET", 200],
    ] as const) {
        const result = await authenticateClanRequestWith(
            new Request(
                "https://logi.test/api/v1/clan/league-matches?game=wardogs&url=https://wardogsleague.net/matches/example",
                { method, headers: { authorization: "Bearer fixture" } }
            ),
            createDependencies({
                authenticateKey: async () => ({
                    guildId: "guild",
                    ...(readAccess
                        ? {
                              readAccess: {
                                  resources: [...readAccess.resources],
                                  gameIds: [...readAccess.gameIds],
                              },
                          }
                        : {}),
                }),
            })
        )
        assert.equal(isAuthError(result) ? result.status : 200, expected)
    }
})

test("Warcon reads require an explicit grant even for legacy keys", async () => {
    for (const readAccess of [
        undefined,
        {
            resources: ["server-snapshots"] as const,
            gameIds: ["wardogs"] as const,
        },
    ]) {
        const result = await authenticateClanRequestWith(
            new Request(
                "https://logi.test/api/v1/clan/warcon-data/connection?game=wardogs&view=live",
                { headers: { authorization: "Bearer fixture" } }
            ),
            createDependencies({
                authenticateKey: async () => ({
                    guildId: "guild-1",
                    ...(readAccess
                        ? {
                              readAccess: {
                                  resources: [...readAccess.resources],
                                  gameIds: [...readAccess.gameIds],
                              },
                          }
                        : {}),
                }),
            })
        )
        assert.ok(isAuthError(result))
        assert.equal(result.status, 403)
    }
})

test("scoped HLL readers cannot use empty game tokens as an implicit default", async () => {
    for (const query of ["", "?game=", "?game=,"]) {
        const response = await authenticateClanRequestWith(
            new Request(`https://logi.test/api/v1/clan/events${query}`, {
                headers: { authorization: "Bearer fixture" },
            }),
            createDependencies({
                authenticateKey: async () => ({
                    guildId: "guild-1",
                    readAccess: {
                        resources: ["events"],
                        gameIds: ["hell_let_loose"],
                    },
                }),
            })
        )
        assert.ok(isAuthError(response), query)
        assert.equal(response.status, 403)
    }
})

test("scoped collection and detail reads are allowed without cache retention", async () => {
    for (const path of [
        "events?game=wardogs",
        "events/opaque-id",
        "events?game=wardogs&game=hell_let_loose",
    ]) {
        const result = await authenticateClanRequestWith(
            new Request(`https://logi.test/api/v1/clan/${path}`, {
                headers: { authorization: "Bearer fixture" },
            }),
            createDependencies({
                authenticateKey: async () => ({
                    guildId: "guild-1",
                    readAccess: {
                        resources: ["events"],
                        gameIds: ["wardogs", "hell_let_loose"],
                    },
                }),
            })
        )
        assert.equal(isAuthError(result), false)
        if (!isAuthError(result))
            assert.equal(result.headers["Cache-Control"], "no-store")
    }
})

test("HTTP authentication rejects scoped writes, global resources and implicit or broader game selection", async () => {
    for (const [method, path] of [
        ["POST", "events"],
        ["PATCH", "rosters/fixture"],
        ["DELETE", "groups/fixture"],
        ["GET", "settings"],
        ["GET", "meta"],
        ["GET", "users"],
        ["GET", "events"],
        ["GET", "events?game=all"],
        ["GET", "events?game=hell_let_loose"],
    ]) {
        const result = await authenticateClanRequestWith(
            new Request(`https://logi.test/api/v1/clan/${path}`, {
                method,
                headers: { authorization: "Bearer fixture" },
            }),
            createDependencies({
                authenticateKey: async () => ({
                    guildId: "guild-1",
                    readAccess: {
                        resources: ["events", "rosters"],
                        gameIds: ["wardogs"],
                    },
                }),
            })
        )
        assert.ok(isAuthError(result), `${method} ${path}`)
        assert.equal(result.status, 403)
        assert.equal((await result.json()).error.code, "insufficient_scope")
    }
})

import {
    authenticateClanRequestWith,
    isAuthError,
} from "./authenticated-clan-route"

function createDependencies(
    overrides: Partial<Parameters<typeof authenticateClanRequestWith>[1]> = {}
) {
    return {
        readBearerToken: (request: Request) => {
            const value = request.headers.get("authorization")
            return value?.startsWith("Bearer ") ? value.slice(7) : null
        },
        hashApiKey: (key: string) => `hash:${key}`,
        checkRateLimit: async () => ({
            allowed: true,
            remaining: 299,
            resetAt: 1_700_000_060_000,
        }),
        authenticateKey: async () => ({ guildId: "guild-1" }),
        rateLimitHeaders: (result: { remaining: number; resetAt: number }) => ({
            "RateLimit-Limit": "300",
            "RateLimit-Remaining": String(result.remaining),
            "RateLimit-Reset": String(Math.ceil(result.resetAt / 1_000)),
        }),
        ...overrides,
    }
}

test("clan authentication rejects missing and malformed bearer credentials before persistence calls", async () => {
    for (const authorization of [undefined, "Basic abc", "Bearer "]) {
        let rateLimitCalls = 0
        const response = await authenticateClanRequestWith(
            new Request("https://logi.test/api/v1/clan/meta", {
                ...(authorization ? { headers: { authorization } } : {}),
            }),
            createDependencies({
                checkRateLimit: async () => {
                    rateLimitCalls += 1
                    return { allowed: true, remaining: 299, resetAt: 0 }
                },
            })
        )
        assert.equal(isAuthError(response), true)
        if (isAuthError(response)) {
            assert.equal(response.status, 401)
            assert.equal((await response.json()).error.code, "missing_api_key")
        }
        assert.equal(rateLimitCalls, 0)
    }
})

test("clan authentication returns rate-limit headers for revoked keys", async () => {
    const response = await authenticateClanRequestWith(
        new Request("https://logi.test/api/v1/clan/meta", {
            headers: { authorization: "Bearer logi_revoked" },
        }),
        createDependencies({ authenticateKey: async () => null })
    )

    assert.equal(isAuthError(response), true)
    if (isAuthError(response)) {
        assert.equal(response.status, 401)
        assert.deepEqual(await response.json(), {
            error: {
                code: "invalid_api_key",
                message: "The API key is invalid or revoked.",
            },
        })
        assert.equal(response.headers.get("RateLimit-Limit"), "300")
        assert.equal(response.headers.get("RateLimit-Remaining"), "299")
    }
})

test("clan authentication returns rate-limit headers and retry timing when limited", async () => {
    const response = await authenticateClanRequestWith(
        new Request("https://logi.test/api/v1/clan/meta", {
            headers: { authorization: "Bearer logi_limited" },
        }),
        createDependencies({
            checkRateLimit: async () => ({
                allowed: false,
                remaining: 0,
                resetAt: Date.now() + 5_000,
            }),
        })
    )

    assert.equal(isAuthError(response), true)
    if (isAuthError(response)) {
        assert.equal(response.status, 429)
        assert.equal((await response.json()).error.code, "rate_limited")
        assert.equal(response.headers.get("RateLimit-Remaining"), "0")
        assert.match(response.headers.get("Retry-After") ?? "", /^[1-9]\d*$/)
    }
})

test("clan authentication returns the key owner after applying the rate limit", async () => {
    const response = await authenticateClanRequestWith(
        new Request("https://logi.test/api/v1/clan/meta", {
            headers: { authorization: "Bearer logi_valid" },
        }),
        createDependencies()
    )

    assert.equal(isAuthError(response), false)
    if (!isAuthError(response)) {
        assert.deepEqual(response, {
            key: "logi_valid",
            guildId: "guild-1",
            headers: {
                "RateLimit-Limit": "300",
                "RateLimit-Remaining": "299",
                "RateLimit-Reset": "1700000060",
            },
        })
    }
})

test("team directory reads require an explicit per-game teams grant at the gateway", async () => {
    const scoped = createDependencies({
        authenticateKey: async () => ({
            guildId: "guild-1",
            readAccess: {
                resources: ["teams"],
                gameIds: ["hell_let_loose"],
            },
        }),
    })
    for (const [path, expected] of [
        ["teams?game=hell_let_loose", 200],
        ["teams/opaque-team-id?game=hell_let_loose", 200],
        ["teams?game=wardogs", 403],
        ["teams", 403],
        ["teams?game=", 403],
        ["teams?game=all", 403],
    ] as const) {
        const result = await authenticateClanRequestWith(
            new Request(`https://logi.test/api/v1/clan/${path}`, {
                headers: { authorization: "Bearer fixture" },
            }),
            scoped
        )
        assert.equal(isAuthError(result) ? result.status : 200, expected, path)
        if (!isAuthError(result))
            assert.equal(result.headers["Cache-Control"], "no-store")
    }
    // Another explicit grant for the same game does not imply the directory.
    const other = await authenticateClanRequestWith(
        new Request("https://logi.test/api/v1/clan/teams?game=hell_let_loose", {
            headers: { authorization: "Bearer fixture" },
        }),
        createDependencies({
            authenticateKey: async () => ({
                guildId: "guild-1",
                readAccess: {
                    resources: ["event-summaries"],
                    gameIds: ["hell_let_loose"],
                },
            }),
        })
    )
    assert.ok(isAuthError(other))
    assert.equal(other.status, 403)
    // A legacy key (no readAccess) is not refused by the generic gateway branch:
    // it reaches the handler, and teamReads:* denies it inside Convex because
    // allowsApiKeyRead(undefined, "teams", game) is false. The HTTP outcome is
    // still 403 insufficient_scope: teams-route.test.ts covers the HTTP mapping
    // and src/infrastructure/convex/teams.test.ts the Convex-side denial.
    const legacy = await authenticateClanRequestWith(
        new Request("https://logi.test/api/v1/clan/teams?game=hell_let_loose", {
            headers: { authorization: "Bearer fixture" },
        }),
        createDependencies()
    )
    assert.equal(isAuthError(legacy), false)
})

test("the WD League overview requires the explicit league-fixtures Wardogs grant", async () => {
    for (const [readAccess, expected] of [
        [undefined, 403],
        [{ resources: ["league-matches"], gameIds: ["wardogs"] }, 403],
        [{ resources: ["league-fixtures"], gameIds: ["hell_let_loose"] }, 403],
        [{ resources: ["league-fixtures"], gameIds: ["wardogs"] }, 200],
    ] as const) {
        const result = await authenticateClanRequestWith(
            new Request(
                "https://logi.test/api/v1/clan/league-fixtures/overview?game=wardogs",
                { headers: { authorization: "Bearer fixture" } }
            ),
            createDependencies({
                authenticateKey: async () => ({
                    guildId: "guild",
                    ...(readAccess
                        ? {
                              readAccess: {
                                  resources: [...readAccess.resources],
                                  gameIds: [...readAccess.gameIds],
                              },
                          }
                        : {}),
                }),
            })
        )
        assert.equal(isAuthError(result) ? result.status : 200, expected)
        if (!isAuthError(result))
            assert.equal(result.headers["Cache-Control"], "no-store")
    }
})

test("generated event images use the event read grant while other nested routes stay closed", async () => {
    for (const [path, resource, method, expected] of [
        ["events/one/image", "events", "GET", 200],
        ["events/one/image?view=result", "events", "GET", 200],
        ["events/one/image", "rosters", "GET", 403],
        ["events/one/image", "events", "POST", 403],
        ["events/one/image/extra", "events", "GET", 403],
        ["rosters/one/image", "rosters", "GET", 403],
    ] as const) {
        const result = await authenticateClanRequestWith(
            new Request(`https://logi.test/api/v1/clan/${path}`, {
                method,
                headers: { authorization: "Bearer fixture" },
            }),
            createDependencies({
                authenticateKey: async () => ({
                    guildId: "guild-1",
                    readAccess: { resources: [resource], gameIds: ["wardogs"] },
                }),
            })
        )
        assert.equal(
            isAuthError(result) ? result.status : 200,
            expected,
            `${method} ${path}`
        )
    }
})

test("competition reads use teams grants while restricted competition and mode writes stay denied", async () => {
    for (const resource of ["competitions", "workspace-mode"]) {
        for (const [method, grantedGame, expected] of [
            ["GET", "hell_let_loose", 200],
            ["GET", "wardogs", 403],
            ["POST", "hell_let_loose", 403],
            ["PATCH", "hell_let_loose", 403],
        ] as const) {
            const result = await authenticateClanRequestWith(
                new Request(
                    `https://logi.test/api/v1/clan/${resource}?game=hell_let_loose`,
                    { method, headers: { authorization: "Bearer fixture" } }
                ),
                createDependencies({
                    authenticateKey: async () => ({
                        guildId: "guild-1",
                        readAccess: {
                            resources: ["teams"],
                            gameIds: [grantedGame],
                        },
                    }),
                })
            )
            assert.equal(isAuthError(result) ? result.status : 200, expected)
        }
    }
})
