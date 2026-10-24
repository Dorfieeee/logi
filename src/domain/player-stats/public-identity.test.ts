import {
    publicPlayerIdentityBinding,
    publicPlayerLookupArguments,
    publicPlayerCacheKey,
} from "./public-identity"
import { createHash } from "node:crypto"
import assert from "node:assert/strict"
import test from "node:test"

test("public player binding has one exact portable SHA256 protocol without raw identifiers", async () => {
    const nativeId = "users:synthetic-native",
        subject = "100000000000000001"
    const expected = createHash("sha256")
        .update(JSON.stringify(["public-player-native-v1", nativeId, subject]))
        .digest("hex")
    assert.equal(await publicPlayerIdentityBinding(nativeId, subject), expected)
    assert.match(expected, /^[a-f0-9]{64}$/)
    assert.notEqual(
        await publicPlayerIdentityBinding("users:another", subject),
        expected
    )
    assert.notEqual(
        await publicPlayerIdentityBinding(nativeId, "100000000000000002"),
        expected
    )
    await assert.rejects(
        publicPlayerIdentityBinding(nativeId, "legacy-id"),
        /Invalid public player identity/
    )
    await assert.rejects(
        publicPlayerIdentityBinding("", subject),
        /Invalid public player identity/
    )
})

test("default public player RPCs omit the new argument; exact lookups never omit the selector", () => {
    assert.deepEqual(publicPlayerLookupArguments("legacy"), {
        playerId: "legacy",
    })
    assert.deepEqual(publicPlayerLookupArguments("legacy", "wardogs"), {
        playerId: "legacy",
        game: "wardogs",
    })
    assert.deepEqual(
        publicPlayerLookupArguments(
            "100000000000000001",
            "hell_let_loose",
            "discord"
        ),
        {
            playerId: "100000000000000001",
            game: "hell_let_loose",
            identifierKind: "discord",
        }
    )
})

test("v5 public profile caches never reuse legacy or another game's profile for an exact identity selector", () => {
    assert.deepEqual(publicPlayerCacheKey("123", "wardogs"), [
        "public-player:v5",
        "123",
        "wardogs",
        "legacy",
    ])
    assert.notDeepEqual(
        publicPlayerCacheKey("123", "wardogs"),
        publicPlayerCacheKey("123", "wardogs", "discord")
    )
    assert.notDeepEqual(
        publicPlayerCacheKey("123", "wardogs", "discord"),
        publicPlayerCacheKey("123", "hell_let_loose", "discord")
    )
})
