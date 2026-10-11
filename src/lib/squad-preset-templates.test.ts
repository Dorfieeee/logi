import assert from "node:assert/strict"
import test from "node:test"

import {
    getRoleIconOptions,
    getSquadIconOptions,
} from "./squad-preset-templates"

test("squad preset icon options are scoped to their game", () => {
    const hllIcons = getRoleIconOptions("hell_let_loose")
    const vietnamIcons = getRoleIconOptions("hell_let_loose_vietnam")
    const wardogsIcons = getRoleIconOptions("wardogs")
    const wardogsSquadIcons = getSquadIconOptions("wardogs")
    const wowForeverIcons = getRoleIconOptions("world_of_warcraft_forever")

    assert.deepEqual(vietnamIcons, hllIcons)
    assert.notEqual(vietnamIcons, hllIcons)
    assert.ok(hllIcons.includes("/img/roles/icn_officer.png"))
    assert.ok(!hllIcons.includes("/img/roles/icn_builder.png"))
    assert.ok(wardogsIcons.includes("/img/roles/icn_builder.png"))
    assert.ok(!wardogsIcons.includes("/img/roles/icn_officer.png"))
    assert.ok(wowForeverIcons.includes("/img/roles/wowf/class/mage.png"))
    assert.ok(wardogsIcons.includes("/stratmap/icons/wardogs/artillery.webp"))
    assert.ok(
        wardogsSquadIcons.includes("/stratmap/icons/wardogs/artillery.webp")
    )
    assert.ok(
        wardogsSquadIcons.includes(
            "/stratmap/icons/wardogs/weapons_vendor.webp"
        )
    )
    assert.deepEqual(wardogsIcons, wardogsSquadIcons)
})
