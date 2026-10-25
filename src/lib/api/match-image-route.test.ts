import { buildMatchImage } from "@/domain/events/match-image"
import { matchImageReadHandler } from "./match-image-route"
import assert from "node:assert/strict"
import test from "node:test"

test("unavailable and custom images never render a replacement", async () => {
    let renders = 0
    for (const context of [
        null,
        { customImageUrl: "https://example.com/custom.png", model: {} },
    ]) {
        const response = await matchImageReadHandler({
            context: async () => context,
            render: async () => {
                renders++
                return new Uint8Array([1])
            },
        })()
        assert.equal(response.status, context ? 409 : 404)
        assert.equal(response.headers.get("Cache-Control"), "private, no-store")
    }
    assert.equal(renders, 0)
})

test("simultaneous identical renders are coalesced and retain rate-limit headers", async () => {
    const model = buildMatchImage({
        clan: { name: "Route test clan" },
        event: {
            name: "Concurrent image",
            meetingStart: "2026-10-25T18:30:00Z",
            gameStart: "2026-10-25T19:00:00Z",
        },
        language: "en",
        timeZone: "UTC",
    })
    let count = 0
    const handle = matchImageReadHandler({
        context: async () => ({ model }),
        render: async () => {
            count++
            await Promise.resolve()
            return new Uint8Array([1, 2, 3])
        },
    })
    const responses = await Promise.all([
        handle({ "X-RateLimit-Remaining": "5" }),
        handle(),
    ])
    assert.equal(count, 1)
    assert.equal(responses[0]?.headers.get("X-RateLimit-Remaining"), "5")
    assert.equal(responses[0]?.headers.get("Content-Type"), "image/png")
})
