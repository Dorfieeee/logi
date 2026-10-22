import {
    externalPlatformId,
    linkedExternalPlatformId,
} from "./external-platform-id"
import { externalRegistrationSchema } from "./external-registration.schema"
import assert from "node:assert/strict"
import test from "node:test"

const steamId = "76561198199051397"
const eos = "f17568f25c8fb49a2c10c23e444ad07b"
const base = {
    discordId: "111111111111111111",
    guildId: "222222222222222222",
    name: "Player",
}

test("external registration accepts a Steam alias or a raw Steam/EOS platform ID", () => {
    for (const identity of [
        { steamId },
        { platformId: steamId },
        { platformId: eos },
        { platformId: eos.toUpperCase() },
        { steamId, platformId: steamId },
        {},
    ]) {
        assert.ok(
            externalRegistrationSchema.safeParse({ ...base, ...identity })
                .success
        )
    }
    assert.equal(externalPlatformId(eos.toUpperCase()), eos)
    assert.equal(externalPlatformId(`epic:${eos.toUpperCase()}`), eos)
    assert.equal(linkedExternalPlatformId(["bad", `epic:${eos}`]), eos)
    assert.equal(linkedExternalPlatformId([eos, `steam:${steamId}`]), steamId)
    assert.equal(linkedExternalPlatformId(["xbox:Player", "bad"]), null)
})

test("registration rejects malformed IDs and conflicting account fields", () => {
    for (const identity of [
        { platformId: eos.slice(1) },
        { platformId: eos + "a" },
        { platformId: eos.replace("f", "g") },
        { platformId: `epic:${eos}` },
        { platformId: "76561197960265728" },
        { platformId: "" },
        { platformId: [eos] },
        { platformId: eos + "," + steamId },
        { platformId: eos.slice(0, 3) + "\n" + eos.slice(3) },
        { steamId: eos },
        { steamId, platformId: eos },
        { steamId, platformId: "76561198000000001" },
    ]) {
        assert.equal(
            externalRegistrationSchema.safeParse({ ...base, ...identity })
                .success,
            false,
            JSON.stringify(identity)
        )
    }
})
