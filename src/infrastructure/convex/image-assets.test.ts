import { actorFixture, seedDashboardActor } from "./testing/dashboard-actor"
import { IMAGE_CLEANUP_BATCH } from "../../domain/assets/image-asset"
import * as imageAssets from "../../../convex/imageAssets"
import { invoke, testContext } from "./testing/database"
import * as teams from "../../../convex/teams"
import { createHash } from "node:crypto"
import assert from "node:assert/strict"
import test from "node:test"

process.env.INTERNAL_AUTH_SECRET = "dev-internal-auth-secret"
const secret = process.env.INTERNAL_AUTH_SECRET
const guildId = "guild-a"
const access = { secret, guildId, actor: actorFixture }
const platform = { secret, actor: { ...actorFixture, superadmin: true } }

function setup() {
    const ctx = testContext()
    seedDashboardActor(ctx.db, guildId)
    ctx.db.seed("imageAssets", {
        _id: "imageAssets:logo",
        guildId: "platform",
        kind: "team-logo",
        publicId: "a".repeat(32),
        storageId: "storage:logo",
        contentType: "image/png",
        width: 512,
        height: 512,
        bytes: 1000,
        sha256: "b".repeat(64),
        publicUrl:
            "https://logi.test/api/image-assets/" + "a".repeat(32) + ".png",
        state: "ready",
        createdAt: "2026-10-01T00:00:00.000Z",
        createdBy: actorFixture.subject,
    })
    return ctx
}
const create = (
    ctx: ReturnType<typeof setup>,
    input: Record<string, unknown>
) => invoke(teams.create, ctx, { ...platform, input })

test("the platform upload scope needs a superadmin session; workspaces keep their own scope", async () => {
    const ctx = setup()
    await assert.rejects(
        invoke(imageAssets.reserveUpload, ctx, {
            ...access,
            guildId: "platform",
            kind: "team-logo",
        }),
        /Forbidden/
    )
    assert.deepEqual(
        await invoke(imageAssets.reserveUpload, ctx, {
            ...platform,
            guildId: "platform",
            kind: "team-logo",
        }),
        { ok: true }
    )
    // The platform scope holds catalogue logos only.
    assert.deepEqual(
        await invoke(imageAssets.reserveUpload, ctx, {
            ...platform,
            guildId: "platform",
            kind: "panel-banner",
        }),
        { error: "invalid_kind" }
    )
    const listed = await invoke(imageAssets.list, ctx, {
        ...platform,
        guildId: "platform",
        kind: "team-logo",
    })
    assert.deepEqual(
        listed.assets.map((asset: { id: string }) => asset.id),
        ["imageAssets:logo"]
    )
    const own = await invoke(imageAssets.list, ctx, {
        ...access,
        kind: "team-logo",
    })
    assert.deepEqual(own.assets, [])
})

test("image assets: attach checks, upload reservations and cleanup spare referenced logos", async (t) => {
    const now = Date.parse("2026-10-04T12:00:00.000Z")
    t.mock.method(Date, "now", () => now)
    const ctx = setup()
    for (let attempt = 0; attempt < 10; attempt++) {
        const reserved = await invoke(imageAssets.reserveUpload, ctx, {
            ...access,
            kind: "team-logo",
        })
        // A reservation only counts the attempt; it never issues an upload URL.
        assert.deepEqual(reserved, { ok: true })
    }
    const limited = await invoke(imageAssets.reserveUpload, ctx, {
        ...access,
        kind: "team-logo",
    })
    assert.equal(limited.error, "upload_limited")
    const created = await invoke(imageAssets.record, ctx, {
        ...access,
        asset: {
            kind: "team-logo",
            publicId: "e".repeat(32),
            storageId: "storage:new",
            contentType: "image/png",
            width: 512,
            height: 300,
            bytes: 1234,
            sha256: "f".repeat(64),
            publicUrl:
                "https://logi.test/api/image-assets/" + "e".repeat(32) + ".png",
        },
    })
    assert.equal(created.ok, true)
    assert.equal(
        created.asset.url,
        "https://logi.test/api/image-assets/" + "e".repeat(32) + ".png"
    )
    assert.deepEqual(
        await invoke(imageAssets.record, ctx, {
            ...access,
            asset: {
                kind: "team-logo",
                publicId: "e".repeat(32),
                storageId: "storage:dup",
                contentType: "image/png",
                width: 600,
                height: 300,
                bytes: 1234,
                sha256: "f".repeat(64),
                publicUrl: "https://logi.test/x.png",
            },
        }),
        { error: "invalid_asset" }
    )
    ctx.storage.files.set("storage:logo", "https://files/logo")
    assert.deepEqual(
        await invoke(imageAssets.resolvePublic, ctx, {
            secret,
            publicId: "a".repeat(32),
        }),
        { url: "https://files/logo", contentType: "image/png" }
    )
    // Reference the seeded logo from a team; the unreferenced seed and the fresh upload differ by age.
    await create(ctx, {
        gameId: "hell_let_loose",
        name: "Alpha",
        logoAssetId: "imageAssets:logo",
        idempotencyKey: "k-00000001",
    })
    ctx.db.tables.imageAssets.find(
        (row) => row._id === created.asset.id
    )!.createdAt = "2026-10-01T00:00:00.000Z"
    const swept = await invoke(imageAssets.cleanupUnattached, ctx, {})
    assert.deepEqual(swept, { deleted: 1, done: true })
    assert.equal(ctx.scheduler.calls.length, 0)
    assert.deepEqual(
        ctx.db.tables.imageAssets.map((row) => row._id),
        ["imageAssets:logo"]
    )
    assert.equal(
        await invoke(imageAssets.resolvePublic, ctx, {
            secret,
            publicId: "e".repeat(32),
        }),
        null
    )
})

test("image cleanup pages past a full batch of referenced assets and stops when done", async (t) => {
    const now = Date.parse("2026-10-04T12:00:00.000Z")
    t.mock.method(Date, "now", () => now)
    const ctx = setup()
    ctx.db.tables.imageAssets = []
    const seedAsset = (n: number, createdAt: string) => {
        const id = `imageAssets:old${n}`
        ctx.db.seed("imageAssets", {
            _id: id,
            guildId,
            kind: "team-logo",
            publicId: n.toString(16).padStart(32, "0"),
            storageId: `storage:old${n}`,
            contentType: "image/png",
            width: 64,
            height: 64,
            bytes: 10,
            sha256: "b".repeat(64),
            publicUrl: "https://logi.test/x.png",
            state: "ready",
            createdAt,
            createdBy: actorFixture.subject,
        })
        return id
    }
    // A full batch of the oldest assets stays referenced forever.
    for (let n = 0; n < IMAGE_CLEANUP_BATCH; n++)
        ctx.db.seed("imageAssetReferences", {
            _id: `imageAssetReferences:${n}`,
            assetId: seedAsset(
                n,
                `2026-09-01T00:00:${String(n).padStart(2, "0")}.000Z`
            ),
            guildId,
            owner: "team",
            ownerId: `teamDirectory:${n}`,
            createdAt: "2026-09-01T00:00:00.000Z",
        })
    // A newer, but still expired, unattached upload sits behind them.
    const orphan = seedAsset(999, "2026-10-02T00:00:00.000Z")
    const fresh = seedAsset(1000, "2026-10-04T11:00:00.000Z")
    const first = await invoke(imageAssets.cleanupUnattached, ctx, {})
    assert.deepEqual(first, { deleted: 0, done: false })
    assert.equal(ctx.scheduler.calls.length, 1)
    const [, , next] = ctx.scheduler.calls[0] as [
        number,
        unknown,
        { cursor: string; cutoff: string },
    ]
    assert.equal(next.cutoff, "2026-10-03T12:00:00.000Z")
    assert.equal(typeof next.cursor, "string")
    const second = await invoke(imageAssets.cleanupUnattached, ctx, next)
    assert.deepEqual(second, { deleted: 1, done: true })
    // The scan finished, so no further run is chained.
    assert.equal(ctx.scheduler.calls.length, 1)
    const ids = ctx.db.tables.imageAssets.map((row) => row._id)
    assert.equal(ids.includes(orphan), false)
    assert.equal(ids.includes(fresh), true)
    assert.equal(ids.length, IMAGE_CLEANUP_BATCH + 1)
})

test("storeNormalized stores and records together and deletes the blob when recording fails", async (t) => {
    const now = Date.parse("2026-10-04T12:00:00.000Z")
    t.mock.method(Date, "now", () => now)
    const ctx = setup()
    const png = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4,
    ])
    const stored = new Map<string, Blob>()
    let sequence = 0
    const actionCtx = {
        storage: {
            store: async (blob: Blob) => {
                const id = `storage:upload${++sequence}`
                stored.set(id, blob)
                return id
            },
            delete: async (id: string) => {
                stored.delete(id)
            },
        },
        runMutation: async (_ref: unknown, args: Record<string, unknown>) =>
            await invoke(imageAssets.record, ctx, args),
    }
    const asset = {
        kind: "team-logo",
        publicId: "9".repeat(32),
        contentType: "image/png",
        width: 64,
        height: 64,
        publicUrl:
            "https://logi.test/api/image-assets/" + "9".repeat(32) + ".png",
    }
    const run = (args: Record<string, unknown>) =>
        (
            imageAssets.storeNormalized as unknown as {
                _handler: (ctx: unknown, args: unknown) => Promise<unknown>
            }
        )._handler(actionCtx, {
            ...access,
            asset,
            bytes: png.buffer.slice(0),
            ...args,
        })
    const ok = (await run({})) as { ok: true; asset: { bytes: number } }
    assert.equal(ok.ok, true)
    assert.equal(ok.asset.bytes, png.byteLength)
    assert.deepEqual([...stored.keys()], ["storage:upload1"])
    const row = ctx.db.tables.imageAssets.find(
        (entry) => entry.publicId === asset.publicId
    )!
    assert.equal(row.storageId, "storage:upload1")
    assert.equal(row.bytes, png.byteLength)
    // The digest is computed from the stored bytes, not supplied by the caller.
    assert.equal(row.sha256, createHash("sha256").update(png).digest("hex"))
    // A rejected record (publicId already used) removes exactly the new blob.
    assert.deepEqual(await run({}), { error: "invalid_asset" })
    assert.deepEqual([...stored.keys()], ["storage:upload1"])
    // A revoked dashboard session makes the record throw; the blob is removed.
    ctx.db.tables.dashboardSessions[0].revokedAt = "2026-10-04T11:00:00.000Z"
    await assert.rejects(
        run({ asset: { ...asset, publicId: "8".repeat(32) } }),
        { message: "Image asset could not be recorded." }
    )
    assert.deepEqual([...stored.keys()], ["storage:upload1"])
    assert.equal(
        ctx.db.tables.imageAssets.some(
            (entry) => entry.publicId === "8".repeat(32)
        ),
        false
    )
    // Bytes that are not the kind's normalized output are never stored.
    assert.deepEqual(
        await run({
            asset: { ...asset, publicId: "7".repeat(32) },
            bytes: new Uint8Array([0xff, 0xd8, 0xff, 0]).buffer,
        }),
        { error: "invalid_asset" }
    )
    assert.equal(sequence, 3)
    await assert.rejects(run({ secret: "wrong" }), /Unauthorized/)
    assert.equal(sequence, 3)
})

test("image assets keep the uploaded file's own name for display (P8-08)", async () => {
    const ctx = setup()
    const created = await invoke(imageAssets.record, ctx, {
        ...access,
        asset: {
            kind: "panel-banner",
            publicId: "c".repeat(32),
            storageId: "storage:named",
            contentType: "image/webp",
            width: 1200,
            height: 400,
            bytes: 2048,
            sha256: "d".repeat(64),
            publicUrl:
                "https://logi.test/api/image-assets/" +
                "c".repeat(32) +
                ".webp",
            fileName: "fotky/vlci-public.png",
        },
    })
    assert.equal(created.ok, true)
    const row = await ctx.db.get(created.asset.id)
    assert.equal(row?.fileName, "vlci-public.png")
})

test("trusted catalogue uploads are limited to platform team logos and still validate records", async () => {
    const ctx = testContext()
    const asset = {
        kind: "team-logo",
        publicId: "c".repeat(32),
        storageId: "storage:scheduled",
        contentType: "image/png",
        width: 32,
        height: 32,
        bytes: 100,
        sha256: "d".repeat(64),
        publicUrl: `https://logi.test/api/image-assets/${"c".repeat(32)}.png`,
    }
    const input = { secret, guildId: "platform", provider: true, asset }
    await assert.rejects(
        invoke(imageAssets.record, ctx, { ...input, secret: "wrong" })
    )
    await assert.rejects(
        invoke(imageAssets.record, ctx, { ...input, guildId: "guild-a" })
    )
    await assert.rejects(
        invoke(imageAssets.record, ctx, {
            ...input,
            asset: { ...asset, kind: "panel-banner" },
        })
    )
    assert.deepEqual(
        await invoke(imageAssets.record, ctx, {
            ...input,
            asset: { ...asset, width: 513 },
        }),
        { error: "invalid_asset" }
    )
    const result = await invoke(imageAssets.record, ctx, input)
    assert.equal(result.ok, true)
})
