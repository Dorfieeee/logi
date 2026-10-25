import { buildMatchImage } from "@/domain/events/match-image"
import { createMatchLogoLoader } from "./match-logo-source"
import { createMatchImageRenderer } from "./match-render"
import assert from "node:assert/strict"
import test from "node:test"
import path from "node:path"
import sharp from "sharp"

const render = createMatchImageRenderer({
    publicDir: path.resolve("public"),
    loadLogo: async () => null,
})

test("one, two, three team, gray and result images render real 1200 × 675 PNGs", async () => {
    for (const count of [1, 2, 3]) {
        const model = buildMatchImage({
            clan: { name: "Clan" },
            language: "cs",
            timeZone: "Europe/Prague",
            event: {
                name: '<Sunday & "match">',
                gameId: "wardogs",
                map: count === 1 ? undefined : "Ozeti",
                meetingStart: "2026-10-25T18:30:00Z",
                gameStart: "2026-10-25T19:00:00Z",
                matchTeams: (["a", "b", "c"] as const)
                    .slice(0, count)
                    .map((slot) => ({
                        teamId: slot,
                        slot,
                        side: slot,
                        snapshot: {
                            name: "Very long team name ".repeat(5),
                            shortCode: slot,
                            logoUrl: null,
                        },
                    })),
            },
            ...(count === 3
                ? {
                      result: {
                          participants: [
                              { label: "a", score: 300 },
                              { label: "b", score: 200 },
                              { label: "c", score: 100 },
                          ],
                      },
                  }
                : {}),
        })
        const png = await render(model)
        const meta = await sharp(png).metadata()
        assert.equal(meta.format, "png")
        assert.equal(meta.width, 1200)
        assert.equal(meta.height, 675)
        assert.ok(png.byteLength < 4 * 1024 * 1024)
        if (count === 1) {
            const pixel = await sharp(png)
                .extract({ left: 0, top: 0, width: 1, height: 1 })
                .removeAlpha()
                .raw()
                .toBuffer()
            assert.deepEqual([...pixel], [49, 51, 56])
        }
    }
})

test("logo loading resolves public assets and permits only bounded Discord CDN images", async () => {
    const publicId = "a".repeat(32)
    const assets: string[] = [],
        requests: string[] = []
    const load = createMatchLogoLoader({
        siteUrl: "https://logi.example",
        loadAsset: async (id) => {
            assets.push(id)
            return new Uint8Array([1])
        },
        fetch: async (url, options) => {
            requests.push(String(url))
            assert.equal(options?.redirect, "error")
            return new Response(new Uint8Array([2]), {
                headers: { "Content-Type": "image/png" },
            })
        },
    })
    assert.deepEqual(
        await load(`https://logi.example/api/image-assets/${publicId}.png`),
        new Uint8Array([1])
    )
    assert.deepEqual(assets, [publicId])
    assert.deepEqual(
        await load("https://cdn.discordapp.com/icons/123/hash.png"),
        new Uint8Array([2])
    )
    for (const url of [
        "http://127.0.0.1/secret",
        "file:///etc/passwd",
        "https://evil.example/icon.png",
        "https://cdn.discordapp.com.evil.example/icons/123/hash.png",
        `https://evil.example/api/image-assets/${publicId}.png`,
        "https://cdn.discordapp.com:443@evil.example/icon.png",
    ])
        assert.equal(await load(url), null)
    assert.equal(requests.length, 1)
})
