import type { resultReviewSchema } from "@/domain/match-results/result-revision"
import { editorState } from "./result-editor-state"
import assert from "node:assert/strict"
import test from "node:test"
import type { z } from "zod"
const empty: z.infer<typeof resultReviewSchema> = {
    current: null,
    sessions: [],
    history: [],
    hasLegacyImport: false,
}

test("manual Wardogs results start with three participants; HLL starts with two", () => {
    assert.equal(
        editorState(empty, undefined, "Team", undefined, undefined, "wardogs")
            .scores.length,
        3
    )
    assert.equal(
        editorState(
            empty,
            undefined,
            "Team",
            undefined,
            undefined,
            "hell_let_loose"
        ).scores.length,
        2
    )
})

test("a saved Wardogs selection supplies all three named teams in slot order", () => {
    const teams = (["c", "a", "b"] as const).map((slot) => ({
        teamId: `team-${slot}`,
        slot,
        side: null,
        snapshot: {
            name: `Team ${slot}`,
            shortCode: null,
            logoAssetId: null,
            logoUrl: null,
            teamRevision: 1,
            capturedAt: "2026-01-01T00:00:00.000Z",
        },
    }))
    const result = editorState(
        empty,
        undefined,
        "Team",
        teams,
        undefined,
        "wardogs"
    )
    assert.deepEqual(
        result.scores.map((row) => row.label),
        ["Team a", "Team b", "Team c"]
    )
    assert.equal(new Set(result.scores.map((row) => row.id)).size, 3)
})
