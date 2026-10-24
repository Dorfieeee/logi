import { clanPlayersMatching } from "../../../convex/clanPlayerHistory"
import type { QueryCtx } from "../../../convex/_generated/server"
import { testContext, spyReads } from "./testing/database"
import assert from "node:assert/strict"
import test from "node:test"

test("newer HLL retained games cannot consume the bounded legacy Wardogs player lookup", async () => {
    const ctx = testContext()
    ctx.db.seed("serverGameHistory", {
        _id: "serverGameHistory:legacy",
        guildId: "guild-a",
        endedAt: "2026-01-01T00:00:00Z",
        serverName: "Legacy Wardogs",
        session: {
            players: [
                {
                    platform: "steam",
                    platformId: "76561198000000017",
                    name: "Legacy player",
                },
            ],
        },
    })
    const lookup = () =>
        clanPlayersMatching(
            ctx as unknown as QueryCtx,
            "guild-a",
            "Legacy player",
            25
        )
    assert.equal((await lookup()).length, 1)
    for (let index = 0; index < 100; index++)
        ctx.db.seed("serverGameHistory", {
            _id: `serverGameHistory:hll-${index}`,
            guildId: "guild-a",
            gameId: "hell_let_loose",
            provider: "hll_crcon",
            endedAt: "2026-10-01T00:00:00Z",
            serverName: "New HLL",
            session: {
                players: [
                    {
                        platform: "steam",
                        platformId: "76561198000000099",
                        name: "Legacy player",
                    },
                ],
            },
        })
    const reads = spyReads(ctx)
    const result = await lookup()
    assert.equal(result.length, 1)
    assert.equal(result[0].platformId, "76561198000000017")
    assert.equal(
        reads.find((read) => read.table === "serverGameHistory")!.index,
        "guildId_gameId_endedAt"
    )
    assert.deepEqual(
        await clanPlayersMatching(
            ctx as unknown as QueryCtx,
            "another-guild",
            "Legacy player",
            25
        ),
        []
    )
})
