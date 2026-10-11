import assert from "node:assert/strict"
import test from "node:test"

import {
    emptyTacticalPlan,
    moveTacticalMarker,
    tacticalPlanSchema,
} from "./tactical-plan"

test("a fresh tactical plan does not invent an official zone or layout", () => {
    assert.deepEqual(emptyTacticalPlan("bakurani"), {
        mapId: "bakurani",
        layout: "",
        controlZone: null,
        hotZone: null,
        teams: [],
    })
})

test("moving a zone preserves its size and clamps map coordinates", () => {
    const plan = moveTacticalMarker(
        emptyTacticalPlan("ozeti"),
        "controlZone",
        40,
        45
    )
    assert.deepEqual(plan.controlZone, { x: 40, y: 45, radius: 10 })
    const moved = moveTacticalMarker(plan, "controlZone", 120, -10)
    assert.deepEqual(moved.controlZone, { x: 100, y: 0, radius: 10 })
    assert.equal(plan.controlZone?.x, 40)
})

test("moving one team keeps other team positions and never duplicates its slot", () => {
    let plan = moveTacticalMarker(emptyTacticalPlan("ozeti"), "a", 12, 30)
    plan = moveTacticalMarker(plan, "b", 82, 64)
    plan = moveTacticalMarker(plan, "a", 21, 38)
    assert.deepEqual(plan.teams, [
        { slot: "b", x: 82, y: 64 },
        { slot: "a", x: 21, y: 38 },
    ])
})

test("the wire contract rejects nonfinite coordinates, excessive zones, duplicates and unknown data", () => {
    const plan = emptyTacticalPlan("bakurani")
    assert.equal(tacticalPlanSchema.safeParse(plan).success, true)
    for (const invalid of [
        { ...plan, hotZone: { x: NaN, y: 20, radius: 3 } },
        { ...plan, controlZone: { x: 50, y: 50, radius: 51 } },
        {
            ...plan,
            teams: [
                { slot: "a", x: 20, y: 20 },
                { slot: "a", x: 50, y: 50 },
            ],
        },
        { ...plan, imageUrl: "https://untrusted.test/map.png" },
    ])
        assert.equal(tacticalPlanSchema.safeParse(invalid).success, false)
})
