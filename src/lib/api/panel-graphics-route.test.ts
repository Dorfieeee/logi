import {
    panelGraphicsHandlers,
    PANEL_GRAPHICS_MAX_BODY_BYTES,
    type PanelGraphicsUpdateResult,
} from "./panel-graphics-route"
import { panelEmojiStatus } from "@/domain/discord-publications/panel-graphics-settings"
import assert from "node:assert/strict"
import test from "node:test"

const ORIGIN = "https://logi.test"
const view = {
    revision: 3,
    settings: { defaultStyle: "a", servers: [], maps: [] },
    clanAccent: "#e8a33d",
    clanName: "Vlci",
    clanTag: "VLC",
    servers: [
        {
            id: "c1",
            currentMap: { key: "foy", name: "Foy" },
            gameId: "hell_let_loose",
            name: "Vlci #1 · Public",
            banner: null,
        },
    ],
    maps: [
        {
            game: "hell_let_loose",
            mapKey: "carentan",
            image: {
                assetId: "imageAssets:2",
                url: "https://logi.test/api/image-assets/b.webp",
                width: 800,
                height: 800,
                bytes: 4000,
            },
        },
    ],
    emoji: panelEmojiStatus(null),
}

function setup(
    options: {
        admin?: boolean
        result?: PanelGraphicsUpdateResult
        fail?: boolean
    } = {}
) {
    const updates: unknown[] = []
    const accessed: string[] = []
    const handlers = panelGraphicsHandlers<{ guildId: string }>({
        origin: ORIGIN,
        access: async (serverId) => {
            accessed.push(serverId)
            return options.admin === false ? null : { guildId: "guild-a" }
        },
        read: async () => {
            if (options.fail) throw new Error("convex down: secret")
            return view
        },
        update: async (_access, patch) => {
            updates.push(patch)
            if (options.fail) throw new Error("convex down")
            return options.result ?? { ok: true, revision: 4 }
        },
    })
    return { handlers, updates, accessed }
}
const patch = (body: unknown, origin: string | null = ORIGIN, raw?: string) =>
    new Request("http://internal/api/servers/s1/discord-panel-graphics", {
        method: "PATCH",
        headers: {
            "content-type": "application/json",
            ...(origin ? { origin } : {}),
        },
        body: raw ?? JSON.stringify(body),
    })

test("GET returns the page view with every catalogue map tile for a clan admin", async () => {
    const { handlers } = setup()
    const response = await handlers.GET(new Request("http://x"), "s1")
    assert.equal(response.status, 200)
    assert.equal(response.headers.get("cache-control"), "no-store")
    const body = await response.json()
    assert.equal(body.revision, 3)
    assert.equal(body.mapTiles.length, 24)
    assert.equal(
        body.mapTiles.find((t: { key: string }) => t.key === "carentan").status,
        "custom"
    )
    assert.equal(body.emoji.faction.total, 12)
})

test("non-admins are refused for reads and writes; writes never reach Convex", async () => {
    const { handlers, updates } = setup({ admin: false })
    assert.equal(
        (await handlers.GET(new Request("http://x"), "s1")).status,
        403
    )
    assert.equal(
        (await handlers.PATCH(patch({ defaultStyle: "b" }), "s1")).status,
        403
    )
    assert.equal(updates.length, 0)
})

test("writes from another origin are refused before access or body are read", async () => {
    const { handlers, updates, accessed } = setup()
    for (const origin of [null, "https://evil.test", "http://logi.test"]) {
        const response = await handlers.PATCH(
            patch({ defaultStyle: "b" }, origin),
            "s1"
        )
        assert.equal(response.status, 403)
    }
    assert.deepEqual(accessed, [])
    assert.equal(updates.length, 0)
})

test("invalid and oversized bodies are a 400 without details", async () => {
    const { handlers, updates } = setup()
    for (const request of [
        patch({}),
        patch({ defaultStyle: "z" }),
        patch({ servers: [{ connectionId: "c1", bannerUrl: "https://evil" }] }),
        patch({ maps: [{ game: "wardogs", mapKey: "foy", assetId: "a" }] }),
        patch(null, ORIGIN, "{not json"),
        patch({
            defaultStyle: "b",
            pad: "x".repeat(PANEL_GRAPHICS_MAX_BODY_BYTES),
        }),
    ]) {
        const response = await handlers.PATCH(request, "s1")
        assert.equal(response.status, 400)
        assert.deepEqual(await response.json(), { error: "invalid_request" })
    }
    assert.equal(updates.length, 0)
})

test("a valid change is forwarded once and answers the new revision", async () => {
    const { handlers, updates } = setup()
    const response = await handlers.PATCH(
        patch({
            defaultStyle: "a",
            servers: [{ connectionId: "c1", crop: "top", barColor: "#2BB3A3" }],
            maps: [
                { game: "hell_let_loose", mapKey: "carentan", assetId: null },
            ],
            expectedRevision: 3,
        }),
        "s1"
    )
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { ok: true, revision: 4 })
    assert.deepEqual(updates, [
        {
            defaultStyle: "a",
            servers: [{ connectionId: "c1", crop: "top", barColor: "#2bb3a3" }],
            maps: [
                { game: "hell_let_loose", mapKey: "carentan", assetId: null },
            ],
            expectedRevision: 3,
        },
    ])
})

test("conflicts, foreign assets and outages map to plain status codes", async () => {
    const body = { defaultStyle: "b" }
    assert.equal(
        (
            await setup({ result: { error: "conflict" } }).handlers.PATCH(
                patch(body),
                "s1"
            )
        ).status,
        409
    )
    const asset = await setup({
        result: { error: "asset_unavailable" },
    }).handlers.PATCH(patch(body), "s1")
    assert.equal(asset.status, 400)
    assert.deepEqual(await asset.json(), { error: "asset_unavailable" })
    const down = setup({ fail: true })
    const failed = await down.handlers.PATCH(patch(body), "s1")
    assert.equal(failed.status, 503)
    assert.equal((await failed.text()).includes("secret"), false)
    assert.equal(
        (await down.handlers.GET(new Request("http://x"), "s1")).status,
        503
    )
})
