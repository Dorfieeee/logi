import { publicPlayerIdentityQuery } from "./public-player-identity"
import assert from "node:assert/strict"
import test from "node:test"

test("public identity query keeps legacy requests unchanged and rejects ambiguous explicit identity selection", () => {
    assert.deepEqual(
        publicPlayerIdentityQuery(
            new URLSearchParams("game=wardogs&collection=recentMatches"),
            "legacy"
        ),
        {}
    )
    assert.deepEqual(
        publicPlayerIdentityQuery(
            new URLSearchParams("identity=discord&game=wardogs"),
            "100000000000000001"
        ),
        { identifierKind: "discord" }
    )
    for (const query of [
        "identity=",
        "identity=legacy",
        "identity=discord&identity=discord",
        "identity=discord&identity=legacy",
    ])
        assert.equal(
            publicPlayerIdentityQuery(
                new URLSearchParams(query),
                "100000000000000001"
            ),
            null
        )
    assert.equal(
        publicPlayerIdentityQuery(
            new URLSearchParams("identity=discord"),
            "legacy"
        ),
        null
    )
})
