import {
    historyRecord,
    hllHistoryRecord,
} from "../../infrastructure/testing/game-history"
import { buildHistoryReport } from "./history-report"
import assert from "node:assert/strict"
import test from "node:test"

test("complete HLL report consumes a game-scoped snapshot without a Wardogs playtime or result assumption", async () => {
    const read = async () => ({
        items: [hllHistoryRecord()],
        revision: "1",
        nextCursor: null,
        lastCollectedAt: null,
    })
    const result = await buildHistoryReport(read, {
        gameId: "hell_let_loose",
        minMinutes: 0,
    })
    assert.equal(result.report.players[0].eligible, true)
    assert.equal(result.report.outcomes.unknown, 1)
    await assert.rejects(
        buildHistoryReport(read, { gameId: "wardogs" }),
        /Invalid history revision/
    )
})

test("full report consumes empty continuation pages; revision drift and loops fail closed", async () => {
    const read = async (cursor: string | null) => ({
        items: cursor ? [historyRecord()] : [],
        revision: "1",
        nextCursor: cursor ? null : "next",
        lastCollectedAt: null,
    })
    assert.equal((await buildHistoryReport(read)).report.games, 1)
    await assert.rejects(
        buildHistoryReport(async (cursor) => ({
            ...(await read(cursor)),
            revision: cursor ? "2" : "1",
        })),
        /revision/
    )
    await assert.rejects(
        buildHistoryReport(async () => ({
            ...(await read(null)),
            nextCursor: "again",
        })),
        /cursor/
    )
})

test("aborted or over-budget scans do not return partial rankings", async () => {
    const controller = new AbortController()
    controller.abort()
    await assert.rejects(
        buildHistoryReport(
            async () => {
                throw new Error("must not read")
            },
            { signal: controller.signal }
        ),
        /abort/i
    )
    await assert.rejects(
        buildHistoryReport(
            async () => ({
                items: [historyRecord()],
                revision: "1",
                nextCursor: "next",
                lastCollectedAt: null,
            }),
            { maxPages: 1 }
        ),
        /incomplete/
    )
})
