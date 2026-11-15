import assert from "node:assert/strict"
import test from "node:test"

import { getStratmapMapById, getStratmapMaps } from "./game-stratmaps"

test("Wardogs offers its four named base maps", () => {
    assert.deepEqual(
        getStratmapMaps("wardogs").map((map) => map.id),
        ["bakurani", "ozeti", "zestafona", "sabatulo"]
    )
})

test("Wardogs maps use their imported tactical basemaps", () => {
    for (const map of getStratmapMaps("wardogs").filter(
        (map) => map.id !== "sabatulo"
    )) {
        assert.equal(map.imagePath, `/maps/wardogs/${map.id}.webp`)
    }

    assert.equal(
        getStratmapMapById("bakurani", "wardogs")?.staticMarkers?.[0]?.iconPath,
        "/stratmap/icons/wardogs/tower.webp"
    )
})

test("Wardogs maps include calculator-derived fixed map facilities", () => {
    const bakurani = getStratmapMapById("bakurani", "wardogs")

    assert.ok(bakurani)
    assert.equal(
        bakurani.staticMarkers?.filter((marker) => marker.label === "Tower 1")
            .length,
        1
    )
    assert.equal(
        bakurani.staticMarkers?.filter((marker) => marker.label === "Valkyra")
            .length,
        1
    )
    assert.equal(
        bakurani.staticMarkers?.filter(
            (marker) => marker.label === "Weapons Vendor"
        ).length,
        3
    )
    assert.equal(
        bakurani.staticMarkers?.filter((marker) => marker.kind === "hq").length,
        3
    )
    assert.equal(
        bakurani.staticMarkers?.filter((marker) => marker.kind === "tower")
            .length,
        5
    )
    assert.deepEqual(
        bakurani.staticPolygons?.map((polygon) => polygon.label),
        ["VALKYRA Spawn", "MANTICORE Spawn", "LONESTAR Spawn"]
    )
})

test("legacy Wardogs placeholder maps resolve to Bakurani", () => {
    assert.equal(
        getStratmapMapById("wardogs-placeholder", "wardogs")?.id,
        "bakurani"
    )
})

test("new Wardogs maps use the named catalog while saved generic stratmaps still resolve", () => {
    assert.deepEqual(
        getStratmapMaps("wardogs").map((map) => map.id),
        ["bakurani", "ozeti", "zestafona", "sabatulo"]
    )
    assert.ok(getStratmapMapById("wardogs-placeholder", "wardogs"))
    assert.equal(getStratmapMapById("zestafona", "wardogs")?.name, "Zestafona")
})
