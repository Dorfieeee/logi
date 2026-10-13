import assert from "node:assert/strict"
import test from "node:test"

import { getUserScoreForGuild } from "./user-scores"

test("game scores retain legacy clan-only HLL values", () => {
    const user = {
        guildId: "clan",
        score: 7,
        scores: {
            clan: 12,
            [JSON.stringify(["clan", "wardogs"])]: 42,
        },
    }

    assert.equal(getUserScoreForGuild(user, "clan"), 12)
    assert.equal(getUserScoreForGuild(user, "clan", "wardogs"), 42)
    assert.equal(
        getUserScoreForGuild(user, "clan", "hell_let_loose_vietnam"),
        0
    )
})
