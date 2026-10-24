import {
    historyRecord,
    hllHistoryRecord,
} from "../../infrastructure/testing/game-history"
import {
    handleGameHistoryRead,
    historyBackendGameArgs,
} from "./game-history-route"
import assert from "node:assert/strict"
import test from "node:test"

test("oversized history pages fail closed without publishing a continuation past omitted rows", async () => {
    const record = historyRecord()
    record.session.players = Array.from({ length: 300 }, (_, index) => ({
        ...record.session.players[0],
        platformId: String(index).padEnd(200, "p"),
        name: "n".repeat(200),
    }))
    const response = await handleGameHistoryRead(
        new Request(
            "https://logi.test/api/v1/clan/server-game-history?game=wardogs"
        ),
        {
            guildId: "guild-a",
            binding: "key:hash",
            secret: "synthetic-history-secret",
            read: async () => ({
                items: Array.from({ length: 20 }, (_, index) => ({
                    ...record,
                    id: String(index),
                })),
                revision: "1",
                nextCursor: "must-not-escape",
                lastCollectedAt: null,
            }),
        }
    )
    assert.equal(response.status, 503)
    assert.deepEqual(await response.json(), { error: { code: "unavailable" } })
})

test("history HTTP binds cursors and returned records to the exact game", async () => {
    const scope = {
        guildId: "guild-a",
        binding: "key:hash",
        secret: "synthetic-history-secret",
    }
    const request = (game: string, query = "") =>
        new Request(
            `https://logi.test/api/v1/clan/server-game-history?game=${game}${query}`
        )
    const read = async (input: { gameId?: string }) => ({
        items: [
            input.gameId === "hell_let_loose"
                ? hllHistoryRecord()
                : historyRecord(),
        ],
        revision: "1",
        nextCursor: "native-next",
        lastCollectedAt: null,
    })
    const first = await handleGameHistoryRead(request("hell_let_loose"), {
        ...scope,
        read,
    })
    assert.equal(first.status, 200)
    const cursor = encodeURIComponent((await first.json()).data.nextCursor)
    assert.equal(
        (
            await handleGameHistoryRead(
                request("wardogs", `&cursor=${cursor}`),
                { ...scope, read }
            )
        ).status,
        400
    )
    assert.equal(
        (
            await handleGameHistoryRead(
                request("hell_let_loose", `&cursor=${cursor}`),
                { ...scope, read }
            )
        ).status,
        200
    )
    assert.equal(
        (
            await handleGameHistoryRead(request("hell_let_loose"), {
                ...scope,
                read: async () => ({
                    items: [historyRecord()],
                    revision: "1",
                    nextCursor: null,
                    lastCollectedAt: null,
                }),
            })
        ).status,
        503
    )
    assert.equal(
        (
            await handleGameHistoryRead(request("wardogs", "&id=hll-game-1"), {
                ...scope,
                read: async () => hllHistoryRecord(),
            })
        ).status,
        503
    )
    assert.equal(
        (await handleGameHistoryRead(request("all"), { ...scope, read }))
            .status,
        400
    )
})

test("history RPC boundaries preserve old Wardogs argument shapes and keep HLL explicit without fallback", async () => {
    assert.deepEqual(historyBackendGameArgs("wardogs"), {})
    assert.deepEqual(historyBackendGameArgs("hell_let_loose"), {
        gameId: "hell_let_loose",
    })
    const calls: Array<Record<string, unknown>> = []
    const scope = {
        guildId: "guild-a",
        binding: "caller",
        secret: "synthetic-history-secret",
    }
    const read = async (input: Record<string, unknown>) => {
        calls.push(input)
        if (input.gameId !== undefined)
            throw new Error("Old backend rejects unknown gameId argument.")
        return {
            items: [historyRecord()],
            revision: "1",
            nextCursor: null,
            lastCollectedAt: null,
        }
    }
    const wardogs = await handleGameHistoryRead(
        new Request(
            "https://logi.test/api/v1/clan/server-game-history?game=wardogs"
        ),
        { ...scope, read }
    )
    assert.equal(wardogs.status, 200)
    assert.equal(Object.keys(calls[0]).includes("gameId"), false)
    const hll = await handleGameHistoryRead(
        new Request(
            "https://logi.test/api/v1/clan/server-game-history?game=hell_let_loose"
        ),
        { ...scope, read }
    )
    assert.equal(hll.status, 503)
    assert.equal(calls.length, 2, "No catch/retry against the Wardogs default.")
    assert.equal(calls[1].gameId, "hell_let_loose")
})

test("history cursors bind caller, workspace and filters; stale scans return 410", async () => {
    const scope = {
        guildId: "guild-a",
        binding: "key:hash",
        secret: "synthetic-history-secret",
    }
    let calls = 0
    const read = async () => {
        calls++
        return {
            items: [historyRecord()],
            revision: "1",
            nextCursor: "db-position",
            lastCollectedAt: null,
        }
    }
    const request = (
        query = "",
        base = "https://logi.test/api/v1/clan/server-game-history"
    ) => new Request(`${base}?game=wardogs${query}`)
    const response = await handleGameHistoryRead(request(), { ...scope, read })
    const body = await response.json()
    assert.equal(response.headers.get("cache-control"), "no-store")
    const cursor = encodeURIComponent(body.data.nextCursor)
    assert.equal(
        (
            await handleGameHistoryRead(request(`&cursor=${cursor}`), {
                ...scope,
                read,
            })
        ).status,
        200
    )
    const before = calls
    for (const change of [{ binding: "key:other" }, { guildId: "other" }])
        assert.equal(
            (
                await handleGameHistoryRead(request(`&cursor=${cursor}`), {
                    ...scope,
                    ...change,
                    read,
                })
            ).status,
            400
        )
    assert.equal(
        (
            await handleGameHistoryRead(
                request(`&cursor=${cursor}&map=other`),
                { ...scope, read }
            )
        ).status,
        400
    )
    assert.equal(calls, before)
    assert.equal(
        (
            await handleGameHistoryRead(request(`&cursor=${cursor}`), {
                ...scope,
                read: async () => ({ resetRequired: true }),
            })
        ).status,
        410
    )
    assert.equal(
        (
            await handleGameHistoryRead(request(), {
                ...scope,
                read: async () => null,
            })
        ).status,
        403
    )
    assert.equal(
        (
            await handleGameHistoryRead(
                request(
                    "&until=2020-01-01T00:00:00Z&from=2021-01-01T00:00:00Z"
                ),
                { ...scope, read }
            )
        ).status,
        400
    )
    assert.equal(
        (
            await handleGameHistoryRead(request("&id=game-1&map=x"), {
                ...scope,
                read,
            })
        ).status,
        400
    )
    const foreign = historyRecord()
    foreign.guildId = "other"
    assert.equal(
        (
            await handleGameHistoryRead(request(), {
                ...scope,
                read: async () => ({
                    items: [foreign],
                    revision: "1",
                    nextCursor: null,
                    lastCollectedAt: null,
                }),
            })
        ).status,
        503
    )
})
