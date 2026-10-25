import {
    historyPageSchema,
    historyRecordSchema,
} from "../../domain/game-data/history"
import { historyRecord, hllHistoryRecord } from "../testing/game-history"
import { read } from "../../../convex/gameHistoryReads"
import assert from "node:assert/strict"
import test from "node:test"

type Row = Record<string, unknown> & { _id: string }
class Database {
    tables: Record<string, Row[]> = {
        apiKeys: [
            {
                _id: "key",
                guildId: "guild-a",
                keyHash: "hash",
                readAccess: {
                    resources: ["server-game-history"],
                    gameIds: ["wardogs"],
                },
            },
        ],
        serverGameHistoryHeads: [
            {
                _id: "head",
                guildId: "guild-a",
                revision: "1",
                lastCollectedAt: "2026-10-03T12:00:00.000Z",
            },
        ],
        serverGameHistory: Array.from({ length: 21 }, (_, n) => {
            const r = historyRecord(`game-${n}`)
            const row: Row = {
                _id: r.id,
                ...r,
                endedAt: r.session.endedAt,
                map: r.session.map,
            }
            // Faithful legacy/new Wardogs storage: game/provider are implicit.
            delete row.gameId
            delete row.provider
            return row
        }),
    }
    query(table: string) {
        const checks: Array<(row: Row) => boolean> = []
        const index = {
            eq: (field: string, value: unknown) => {
                checks.push((row) => row[field] === value)
                return index
            },
            gte: (field: string, value: string) => {
                checks.push((row) => String(row[field]) >= value)
                return index
            },
            lt: (field: string, value: string) => {
                checks.push((row) => String(row[field]) < value)
                return index
            },
        }
        const rows = () =>
            (this.tables[table] ?? []).filter((row) =>
                checks.every((check) => check(row))
            )
        const query = {
            withIndex: (_: string, f: (q: typeof index) => unknown) => {
                f(index)
                return query
            },
            order: () => query,
            unique: async () => rows()[0] ?? null,
            paginate: async ({
                cursor,
                numItems,
            }: {
                cursor: string | null
                numItems: number
            }) => {
                assert.ok(numItems <= 20)
                const offset = Number(cursor ?? 0),
                    all = rows()
                return {
                    page: all.slice(offset, offset + numItems),
                    isDone: offset + numItems >= all.length,
                    continueCursor: String(offset + numItems),
                }
            },
        }
        return query
    }
    normalizeId(table: string, id: string) {
        return this.tables[table]?.some((row) => row._id === id) ? id : null
    }
    async get(id: string) {
        return (
            Object.values(this.tables)
                .flat()
                .find((row) => row._id === id) ?? null
        )
    }
}
const handler = (
    read as unknown as {
        _handler: (
            ctx: unknown,
            args: Record<string, unknown>
        ) => Promise<unknown>
    }
)._handler

test("HLL retained pages and details require the exact game grant and keep revisions separate from legacy Wardogs", async (t) => {
    const previous = process.env.INTERNAL_AUTH_SECRET
    process.env.INTERNAL_AUTH_SECRET = "synthetic-history-secret"
    t.after(() => {
        if (previous === undefined) delete process.env.INTERNAL_AUTH_SECRET
        else process.env.INTERNAL_AUTH_SECRET = previous
    })
    const db = new Database(),
        record = hllHistoryRecord()
    db.tables.serverGameHistory.unshift({
        ...record,
        _id: record.id,
        endedAt: record.session.endedAt,
        map: record.session.map,
    })
    db.tables.serverGameHistoryHeads.push({
        _id: "hll-head",
        guildId: record.guildId,
        gameId: "hell_let_loose",
        revision: "9",
        lastCollectedAt: record.collectedAt,
    })
    const args = {
        secret: "synthetic-history-secret",
        keyHash: "hash",
        guildId: record.guildId,
        gameId: "hell_let_loose",
        filters: {},
        cursor: null,
    }
    assert.equal(await handler({ db }, args), null)
    db.tables.apiKeys[0].readAccess = {
        resources: ["server-game-history"],
        gameIds: ["hell_let_loose", "wardogs"],
    }
    const first = historyPageSchema.parse(await handler({ db }, args))
    assert.equal(first.revision, "9")
    assert.deepEqual(
        first.items.map((row) => row.id),
        [record.id]
    )
    assert.equal(
        historyRecordSchema.parse(
            await handler({ db }, { ...args, id: record.id })
        ).gameId,
        "hell_let_loose"
    )
    assert.equal(await handler({ db }, { ...args, id: "game-1" }), null)
    assert.equal(
        await handler({ db }, { ...args, gameId: "wardogs", id: record.id }),
        null
    )
    const wardogs = historyPageSchema.parse(
        await handler({ db }, { ...args, gameId: "wardogs" })
    )
    assert.equal(wardogs.revision, "1")
    assert.ok(wardogs.items.every((row) => row.gameId === "wardogs"))
    assert.deepEqual(await handler({ db }, { ...args, revision: "1" }), {
        resetRequired: true,
    })
})

test("retained history enforces current explicit key/workspace and bounded revision-consistent pages", async (t) => {
    const previous = process.env.INTERNAL_AUTH_SECRET
    process.env.INTERNAL_AUTH_SECRET = "synthetic-history-secret"
    t.after(() => {
        if (previous === undefined) delete process.env.INTERNAL_AUTH_SECRET
        else process.env.INTERNAL_AUTH_SECRET = previous
    })
    const db = new Database(),
        args = {
            secret: "synthetic-history-secret",
            keyHash: "hash",
            guildId: "guild-a",
            filters: {},
            cursor: null,
        }
    const page = async (input: Record<string, unknown>) =>
        historyPageSchema.parse(await handler({ db }, input))
    const first = await page(args)
    assert.equal(first.items.length, 20)
    assert.equal(first.nextCursor, "20")
    assert.equal(
        (await page({ ...args, cursor: first.nextCursor, revision: "1" })).items
            .length,
        1
    )
    assert.deepEqual(
        await handler({ db }, { ...args, cursor: "20", revision: "0" }),
        { resetRequired: true }
    )
    assert.equal(await handler({ db }, { ...args, cursor: "20" }), null)
    assert.equal(await handler({ db }, { ...args, guildId: "other" }), null)
    assert.equal(await handler({ db }, { ...args, actor: {} }), null)
    assert.equal(
        (await page({ ...args, filters: { map: "unknown" } })).items.length,
        0
    )
    assert.equal(
        (await page({ ...args, filters: { map: "unknown" } })).nextCursor,
        "20"
    )
    assert.equal(
        (
            await page({
                ...args,
                filters: { until: "2026-10-03T11:00:00.000Z" },
            })
        ).items.length,
        0
    )
    assert.equal(
        historyRecordSchema.parse(
            await handler({ db }, { ...args, id: "game-1" })
        ).id,
        "game-1"
    )
    db.tables.serverGameHistory[1].guildId = "other"
    assert.equal(await handler({ db }, { ...args, id: "game-1" }), null)
    db.tables.apiKeys[0].revokedAt = "2026-10-03T12:00:00Z"
    assert.equal(await handler({ db }, args), null)
    delete db.tables.apiKeys[0].revokedAt
    delete db.tables.apiKeys[0].readAccess
    assert.equal(await handler({ db }, args), null)
})
