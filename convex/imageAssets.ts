import {
    cleanupDue,
    IMAGE_CLEANUP_BATCH,
    IMAGE_OUTPUT,
    IMAGE_UNATTACHED_TTL_MS,
    IMAGE_UPLOAD_LIMIT,
    imageAssetFileName,
    type ImageAssetKind,
} from "../src/domain/assets/image-asset"
import {
    adoptPlatformLogo,
    adoptablePlatformLogo,
    assetPublicUrl,
    attachableAsset,
    imageAssetEntity,
    syncAssetReferences,
    type AssetOwner,
} from "./imageAssetStore"
import {
    action,
    internalMutation,
    mutation,
    query,
    type MutationCtx,
    type QueryCtx,
} from "./_generated/server"
import {
    storeImageAsset,
    type StoreImageAssetResult,
} from "../src/application/assets/store-image-asset"
import {
    authorizeDashboardAdmin,
    dashboardActor,
    type DashboardActor,
} from "./dashboardActor"
import {
    imagePublicIdSchema,
    projectImageAsset,
} from "../src/domain/assets/image-asset.schema"
import { authorizePlatformAdmin, PLATFORM_SCOPE } from "./platformAdmin"
import { imageAssetKind, imageContentType } from "./teamValidators"
import { assertSessionGateway } from "./dashboardSessionStore"
import { authorizeTeamProfile } from "./teamProfileAccess"
import type { Doc, Id } from "./_generated/dataModel"
import { makeFunctionReference } from "convex/server"
import { v } from "convex/values"

const access = {
    secret: v.string(),
    guildId: v.string(),
    actor: dashboardActor,
}
type Db = Pick<QueryCtx, "db">
// The lookups and reference bookkeeping live in `imageAssetStore.ts`; they
// stay exported from here for existing importers.
export {
    adoptPlatformLogo,
    adoptablePlatformLogo,
    assetPublicUrl,
    attachableAsset,
    imageAssetEntity,
    syncAssetReferences,
    type AssetOwner,
}
/**
 * An asset scope is a workspace (its Discord guild ID, authorized for that
 * workspace's administrators) or the platform (global administrators only).
 */
async function authorizeAssetScope(
    ctx: Db,
    input: { secret: string; guildId: string; actor: DashboardActor }
): Promise<{ subject: string }> {
    if (input.guildId.startsWith("team:")) {
        return authorizeTeamProfile(ctx, {
            ...input,
            teamId: input.guildId.slice(5),
        })
    }
    if (input.guildId === PLATFORM_SCOPE) {
        const admin = await authorizePlatformAdmin(ctx, input)
        return { subject: admin.session.subject }
    }
    const admin = await authorizeDashboardAdmin(ctx, input)
    return { subject: admin.session.subject }
}

async function referenced(ctx: Db, assetId: Id<"imageAssets">) {
    return (
        (await ctx.db
            .query("imageAssetReferences")
            .withIndex("assetId", (q) => q.eq("assetId", assetId))
            .first()) !== null
    )
}

async function consumeUploadAttempt(ctx: MutationCtx, bucket: string) {
    const now = Date.now()
    const existing = await ctx.db
        .query("apiRateLimitBuckets")
        .withIndex("bucket", (q) => q.eq("bucket", bucket))
        .unique()
    if (!existing || existing.resetAt <= now) {
        const resetAt = now + IMAGE_UPLOAD_LIMIT.windowMs
        if (existing) await ctx.db.patch(existing._id, { count: 1, resetAt })
        else
            await ctx.db.insert("apiRateLimitBuckets", {
                bucket,
                count: 1,
                resetAt,
            })
        return { allowed: true as const, retryAfterMs: 0 }
    }
    if (existing.count >= IMAGE_UPLOAD_LIMIT.attempts)
        return { allowed: false as const, retryAfterMs: existing.resetAt - now }
    await ctx.db.patch(existing._id, { count: existing.count + 1 })
    return { allowed: true as const, retryAfterMs: 0 }
}

/**
 * Counts one upload attempt per actor and workspace before any bytes are
 * accepted. No upload URL is issued: bytes reach storage only through
 * `storeNormalized`, which records them or removes them again.
 */
export const reserveUpload = mutation({
    args: { ...access, kind: imageAssetKind },
    handler: async (ctx, args) => {
        const admin = await authorizeAssetScope(ctx, args)
        // The platform scope holds catalogue team logos only.
        if (
            (args.guildId === PLATFORM_SCOPE ||
                args.guildId.startsWith("team:")) &&
            args.kind !== "team-logo"
        )
            return { error: "invalid_kind" as const }
        const attempt = await consumeUploadAttempt(
            ctx,
            `image-upload:${args.guildId}:${admin.subject}`
        )
        if (!attempt.allowed)
            return {
                error: "upload_limited" as const,
                retryAfterMs: attempt.retryAfterMs,
            }
        return { ok: true as const }
    },
})

/** Presentation facts the gateway derived while normalizing; size and digest are derived here. */
const normalizedAsset = v.object({
    kind: imageAssetKind,
    publicId: v.string(),
    contentType: imageContentType,
    width: v.number(),
    height: v.number(),
    publicUrl: v.string(),
    fileName: v.optional(v.string()),
})
const recordReference = makeFunctionReference<
    "mutation",
    {
        secret: string
        guildId: string
        actor?: DashboardActor
        provider?: true
        asset: {
            kind: ImageAssetKind
            publicId: string
            storageId: Id<"_storage">
            contentType: Doc<"imageAssets">["contentType"]
            width: number
            height: number
            bytes: number
            sha256: string
            publicUrl: string
            fileName?: string
        }
    },
    StoreImageAssetResult
>("imageAssets:record")

async function sha256Hex(bytes: ArrayBuffer) {
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))
    return Array.from(digest, (byte) =>
        byte.toString(16).padStart(2, "0")
    ).join("")
}

/**
 * Stores a normalized image the gateway produced and records it for the
 * current workspace administrator, or for a global administrator in the
 * platform scope. The record re-authorizes the actor in its
 * own transaction; when it is rejected or fails, exactly the blob stored here
 * is deleted, so no stored file is ever left without a record.
 */
export const storeNormalized = action({
    args: { ...access, asset: normalizedAsset, bytes: v.bytes() },
    handler: async (ctx, args): Promise<StoreImageAssetResult> => {
        assertSessionGateway(args.secret)
        const { secret, guildId, actor, asset } = args
        return await storeImageAsset(
            {
                kind: asset.kind,
                contentType: asset.contentType,
                bytes: args.bytes,
            },
            {
                digest: sha256Hex,
                store: async (bytes, contentType) =>
                    await ctx.storage.store(
                        new Blob([bytes], { type: contentType })
                    ),
                record: async (stored) =>
                    await ctx.runMutation(recordReference, {
                        secret,
                        guildId,
                        actor,
                        asset: { ...asset, ...stored },
                    }),
                remove: async (storageId) =>
                    await ctx.storage.delete(storageId),
            }
        )
    },
})

export const storeProviderLogo = action({
    args: {
        secret: v.string(),
        guildId: v.literal("platform"),
        asset: normalizedAsset,
        bytes: v.bytes(),
    },
    handler: async (ctx, args): Promise<StoreImageAssetResult> => {
        assertSessionGateway(args.secret)
        const { secret, asset } = args
        if (asset.kind !== "team-logo")
            throw new Error("Invalid provider asset")
        const guildId = PLATFORM_SCOPE
        return await storeImageAsset(
            {
                kind: asset.kind,
                contentType: asset.contentType,
                bytes: args.bytes,
            },
            {
                digest: sha256Hex,
                store: async (bytes, contentType) =>
                    await ctx.storage.store(
                        new Blob([bytes], { type: contentType })
                    ),
                record: async (stored) =>
                    await ctx.runMutation(recordReference, {
                        secret,
                        guildId,
                        provider: true,
                        asset: { ...asset, ...stored },
                    }),
                remove: async (storageId) =>
                    await ctx.storage.delete(storageId),
            }
        )
    },
})

/** Records a stored normalized image; internal, reached only through `storeNormalized`. */
export const record = internalMutation({
    args: {
        secret: v.string(),
        guildId: v.string(),
        actor: v.optional(dashboardActor),
        provider: v.optional(v.literal(true)),
        asset: v.object({
            kind: imageAssetKind,
            publicId: v.string(),
            storageId: v.id("_storage"),
            contentType: imageContentType,
            width: v.number(),
            height: v.number(),
            bytes: v.number(),
            sha256: v.string(),
            publicUrl: v.string(),
            fileName: v.optional(v.string()),
        }),
    },
    handler: async (ctx, args): Promise<StoreImageAssetResult> => {
        assertSessionGateway(args.secret)
        const admin =
            args.provider &&
            args.guildId === PLATFORM_SCOPE &&
            args.asset.kind === "team-logo"
                ? { subject: "team-catalogue-sync" }
                : args.actor
                  ? await authorizeAssetScope(ctx, {
                        ...args,
                        actor: args.actor,
                    })
                  : null
        if (!admin) throw new Error("Forbidden.")
        const asset = args.asset,
            bounds = IMAGE_OUTPUT[asset.kind]
        if (args.guildId.startsWith("team:") && asset.kind !== "team-logo")
            return { error: "invalid_asset" }
        if (
            !imagePublicIdSchema.safeParse(asset.publicId).success ||
            !/^[a-f0-9]{64}$/.test(asset.sha256) ||
            !Number.isInteger(asset.width) ||
            !Number.isInteger(asset.height) ||
            !Number.isInteger(asset.bytes) ||
            asset.width < 1 ||
            asset.height < 1 ||
            asset.bytes < 1 ||
            asset.width > bounds.width ||
            asset.height > bounds.height ||
            asset.publicUrl.length > 512 ||
            !/^https?:\/\//.test(asset.publicUrl)
        )
            return { error: "invalid_asset" as const }
        if (
            await ctx.db
                .query("imageAssets")
                .withIndex("publicId", (q) => q.eq("publicId", asset.publicId))
                .unique()
        )
            return { error: "invalid_asset" as const }
        const { fileName: rawName, ...stored } = asset
        const fileName = imageAssetFileName(rawName)
        const id = await ctx.db.insert("imageAssets", {
            guildId: args.guildId,
            ...stored,
            ...(fileName ? { fileName } : {}),
            state: "ready",
            createdAt: new Date().toISOString(),
            createdBy: admin.subject,
        })
        const row = await ctx.db.get(id)
        return {
            ok: true as const,
            asset: projectImageAsset(imageAssetEntity(row!)),
        }
    },
})

/** Serves the immutable public file; the gateway adds nosniff and caching headers. */
export const resolvePublic = query({
    args: { secret: v.string(), publicId: v.string() },
    handler: async (ctx, args) => {
        assertSessionGateway(args.secret)
        if (!imagePublicIdSchema.safeParse(args.publicId).success) return null
        const row = await ctx.db
            .query("imageAssets")
            .withIndex("publicId", (q) => q.eq("publicId", args.publicId))
            .unique()
        if (!row || row.state !== "ready") return null
        const url = await ctx.storage.getUrl(row.storageId)
        return url ? { url, contentType: row.contentType } : null
    },
})

/** Dashboard listing of one scope's live assets of one kind (bounded). */
export const list = query({
    args: { ...access, kind: imageAssetKind },
    handler: async (ctx, args) => {
        await authorizeAssetScope(ctx, args)
        const rows = await ctx.db
            .query("imageAssets")
            .withIndex("guildId_kind", (q) =>
                q.eq("guildId", args.guildId).eq("kind", args.kind)
            )
            .take(200)
        return {
            assets: rows
                .filter((row) => row.state === "ready")
                .map((row) => projectImageAsset(imageAssetEntity(row))),
        }
    },
})

/**
 * Claims unreferenced uploads older than the retention window, then removes the
 * blob and the record. Referenced assets are never touched; batches are bounded.
 * One sweep pages through every old ready asset with a cursor and a fixed
 * cutoff, so referenced assets never block the uploads behind them; it
 * schedules its next batch only while the scan is unfinished.
 */
export const cleanupUnattached = internalMutation({
    args: {
        cursor: v.optional(v.string()),
        cutoff: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const now = Date.now()
        const cutoff =
            args.cutoff ?? new Date(now - IMAGE_UNATTACHED_TTL_MS).toISOString()
        const page = await ctx.db
            .query("imageAssets")
            .withIndex("state_createdAt", (q) =>
                q.eq("state", "ready").lte("createdAt", cutoff)
            )
            .paginate({
                cursor: args.cursor ?? null,
                numItems: IMAGE_CLEANUP_BATCH,
            })
        let deleted = 0
        for (const row of page.page) {
            if (!cleanupDue(row, await referenced(ctx, row._id), now)) continue
            // Claim first so a concurrent attach observes a non-attachable state.
            await ctx.db.patch(row._id, { state: "deleting" })
            await ctx.storage.delete(row.storageId)
            await ctx.db.delete(row._id)
            deleted++
        }
        if (!page.isDone)
            await ctx.scheduler.runAfter(
                0,
                makeFunctionReference<"mutation">(
                    "imageAssets:cleanupUnattached"
                ),
                { cursor: page.continueCursor, cutoff }
            )
        return { deleted, done: page.isDone }
    },
})
