import { createResultRevision } from "../match-results/result-revision"
import { gwlResultRevision } from "./results"
import assert from "node:assert/strict"
import test from "node:test"
const draft = {
    origin: "collected" as const,
    participants: [
        { id: "a", label: "A", score: 100 },
        { id: "b", label: "B", score: 20 },
    ],
    players: [],
    sessionLinks: [],
}
const now = "2026-11-19T20:00:00.000Z"
test("trusted GWL confirmation, dispute and reconfirmation preserve version history", () => {
    const first = gwlResultRevision(draft, null, false, now)
    assert.equal(first.status, "confirmed")
    assert.equal(first.reviewerId, null)
    const disputed = gwlResultRevision(
        {
            ...draft,
            participants: draft.participants.map((p) => ({
                ...p,
                score: null,
            })),
        },
        first,
        true,
        now
    )
    assert.equal(disputed.status, "provisional")
    assert.equal(disputed.supersedesVersion, 1)
    const corrected = gwlResultRevision(draft, disputed, false, now)
    assert.equal(corrected.version, 3)
    assert.equal(corrected.status, "corrected")
})
test("ordinary imports still cannot auto-confirm", () => {
    assert.throws(
        () =>
            createResultRevision({
                draft,
                previous: null,
                expectedRevision: 0,
                action: "confirm",
                actor: { id: "import", kind: "import" },
                now,
            }),
        /human reviewer/
    )
})
