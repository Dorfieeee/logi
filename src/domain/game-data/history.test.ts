import {
    hllHistoryRecord,
    historyRecord,
} from "../../infrastructure/testing/game-history"
import { historyRecordSchema } from "./history"
import assert from "node:assert/strict"
import test from "node:test"

test("retained history strictly pairs each game with its provider and completed session semantics", () => {
    const hll = hllHistoryRecord()
    assert.equal(historyRecordSchema.safeParse(hll).success, true)
    assert.equal(historyRecordSchema.safeParse(historyRecord()).success, true)
    for (const candidate of [
        { ...hll, provider: "wardogs_warcon" },
        { ...hll, gameId: "wardogs" },
        {
            ...hll,
            session: { ...hll.session, warcon: historyRecord().session.warcon },
        },
        { ...hll, session: { ...hll.session, complete: false } },
        { ...hll, session: { ...hll.session, endedAt: null } },
        {
            ...hll,
            session: { ...hll.session, endedAt: "2020-01-01T00:00:00Z" },
        },
        { ...hll, session: { ...hll.session, participants: [] } },
        {
            ...hll,
            session: {
                ...hll.session,
                participants: [
                    hll.session.participants[0],
                    hll.session.participants[0],
                ],
            },
        },
        {
            ...hll,
            session: {
                ...hll.session,
                players: [hll.session.players[0], hll.session.players[0]],
            },
        },
        {
            ...hll,
            session: {
                ...hll.session,
                players: [{ ...hll.session.players[0], result: "win" }],
            },
        },
    ])
        assert.equal(historyRecordSchema.safeParse(candidate).success, false)
    assert.deepEqual(
        hll.session.participants.map((side) => side.score),
        [0, 5]
    )
})
