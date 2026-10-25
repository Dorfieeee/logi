import assert from "node:assert/strict"
import test from "node:test"

import { parseClanSettingsPatch } from "./settings-patch"

test("settings patches preserve explicit safe fields and clearable fields", () => {
    assert.deepEqual(
        parseClanSettingsPatch({
            name: "  Logi  ",
            description: null,
            timezone: "Europe/Prague",
            announcementsChannelId: "123",
        }),
        {
            ok: true,
            value: {
                name: "Logi",
                description: null,
                timezone: "Europe/Prague",
                announcementsChannelId: "123",
            },
        }
    )
})

test("settings patches reject unsafe fields and invalid safe values", () => {
    for (const value of [
        {},
        { playerStatsServers: [] },
        { gameOverrides: {} },
        { timezone: "Mars/Olympus" },
        { defaultLanguage: "fr" },
        { clanRoleId: "role" },
        { avatar: "  " },
    ])
        assert.equal(parseClanSettingsPatch(value).ok, false)
})

test("event results routing is a clan-wide, clearable API setting", () => {
    assert.deepEqual(
        parseClanSettingsPatch({ eventResultsChannelId: " 123 " }),
        { ok: true, value: { eventResultsChannelId: "123" } }
    )
    assert.deepEqual(parseClanSettingsPatch({ eventResultsChannelId: null }), {
        ok: true,
        value: { eventResultsChannelId: null },
    })
    assert.equal(
        parseClanSettingsPatch({ eventResultsChannelId: "channel-name" }).ok,
        false
    )
})
