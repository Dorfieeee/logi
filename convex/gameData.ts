import {
    acceptsRun,
    projectHealth,
    projectLastState,
    projectSnapshot,
} from "../src/domain/game-data/policy"
import {
    sourceFingerprint,
    type ResolvedClaim,
    type ResolvedSource,
} from "../src/domain/game-data/credentials"
import {
    connectionFor,
    connectionSource,
    resolveSource,
    workspaceSources,
} from "./gameDataCatalog"
import { snapshotDueCutoff } from "../src/domain/game-data/snapshot-rules"
import { authorizeDashboardAdmin, dashboardActor } from "./dashboardActor"
import { gameDataError, gameDataObservation } from "./gameDataValidators"
import { mutation, internalMutation } from "./integrationMutation"
import type { MutationCtx } from "./_generated/server"
import { resetHistory } from "./gameDataHistory"
import { query } from "./_generated/server"
import { v } from "convex/values"

function assertSecret(secret: string) {
    if (
        !process.env.INTERNAL_AUTH_SECRET ||
        secret !== process.env.INTERNAL_AUTH_SECRET
    )
        throw new Error("Unauthorized.")
}

const configurationArgs = {
    secret: v.string(),
    guildId: v.string(),
    sourceRef: v.string(),
    enabled: v.boolean(),
}
async function configureConnection(
    ctx: MutationCtx,
    args: {
        secret: string
        guildId: string
        sourceRef: string
        enabled: boolean
    },
    options: { requireVerifiedKey: boolean } = { requireVerifiedKey: false }
): Promise<string> {
    assertSecret(args.secret)
    return applyConnectionSource(ctx, args, options)
}
/**
 * Binds a connection to the current catalog entry for its reference; callers
 * authorize. Collection starts only with a usable credential; a dashboard
 * enable also needs a stored key that passed a connection test.
 */
export async function applyConnectionSource(
    ctx: MutationCtx,
    args: { guildId: string; sourceRef: string; enabled: boolean },
    options: { requireVerifiedKey: boolean } = { requireVerifiedKey: false }
): Promise<string> {
    const entry = await resolveSource(ctx, args.guildId, args.sourceRef)
    const source: ResolvedSource | undefined = entry?.source
    const existing = await connectionFor(ctx, args.guildId, args.sourceRef)
    if ((!source && args.enabled) || (!source && !existing))
        throw new Error("Configured source not found.")
    if (args.enabled && !source?.usable)
        throw new Error("Source credential is not ready.")
    if (
        args.enabled &&
        options.requireVerifiedKey &&
        source?.credentialMode === "encrypted" &&
        !entry?.credential?.verifiedAt
    )
        throw new Error("Test the stored key before enabling collection.")
    if (
        source &&
        existing &&
        (existing.gameId !== source.gameId ||
            existing.provider !== source.provider ||
            existing.providerServerId !== source.providerServerId)
    )
        throw new Error(
            "Use a new source reference for a different provider identity."
        )
    const now = Date.now()
    const state = {
        enabled: args.enabled,
        generation: (existing?.generation ?? 0) + 1,
        leaseUntil: 0,
        attempt: 0,
        nextAttemptAt: args.enabled ? now : null,
        errorCategory: null,
        updatedAt: new Date(now).toISOString(),
        pollAfterMs: 60_000,
    }
    if (existing) {
        await ctx.db.patch(existing._id, {
            ...state,
            ...(source ? { sourceFingerprint: sourceFingerprint(source) } : {}),
            etag: null,
        })
        if (["hll_crcon", "wardogs_warcon"].includes(existing.provider))
            await resetHistory(ctx, existing._id, args.enabled)
        return String(existing._id)
    }
    if (!source) throw new Error("Configured source not found.")
    const id = await ctx.db.insert("gameDataConnections", {
        ...state,
        sourceRef: source.ref,
        guildId: source.guildId,
        gameId: source.gameId,
        provider: source.provider,
        providerServerId: source.providerServerId,
        sourceFingerprint: sourceFingerprint(source),
        fence: 0,
        lastAttemptAt: null,
        observation: null,
        etag: null,
        createdAt: state.updatedAt,
    })
    if (["hll_crcon", "wardogs_warcon"].includes(source.provider))
        await resetHistory(ctx, id, args.enabled)
    return String(id)
}

/** Operator-only entrypoint; the dashboard uses the actor-fenced mutation below. */
export const configure = internalMutation({
    args: configurationArgs,
    handler: configureConnection,
})
export const configureForDashboard = mutation({
    args: { ...configurationArgs, actor: dashboardActor },
    handler: async (ctx, args) => {
        await authorizeDashboardAdmin(ctx, args)
        return configureConnection(ctx, args, { requireVerifiedKey: true })
    },
})

export const listConnections = query({
    args: { secret: v.string(), guildId: v.string() },
    handler: async (ctx, args) => {
        assertSecret(args.secret)
        const configured = (await workspaceSources(ctx, args.guildId)).map(
            (entry) => entry.source
        )
        const rows = await ctx.db
            .query("gameDataConnections")
            .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
            .collect()
        const now = Date.now()
        const result = rows.map((row) => ({
            sourceRef: row.sourceRef,
            configured: configured.some(
                (source) => source.ref === row.sourceRef
            ),
            snapshot: projectSnapshot({ ...row, id: String(row._id) }, now),
            health: projectHealth({ ...row, id: String(row._id) }, now),
            // `/server-status` names the last state of a stale row (M3-23).
            lastState: projectLastState(row, now),
        }))
        return {
            sources: configured.map(({ ref, gameId, provider }) => ({
                ref,
                gameId,
                provider,
            })),
            connections: result,
        }
    },
})

export const claimNext = internalMutation({
    args: { tickStartedAt: v.optional(v.number()) },
    handler: async (ctx, args): Promise<ResolvedClaim | null> => {
        const now = Date.now()
        const cutoff = snapshotDueCutoff(now, args.tickStartedAt)
        // The index orders oldest due work across all tenants. A finished source's
        // next poll/retry falls after this tick's cutoff, so it cannot consume it twice.
        const due = await ctx.db
            .query("gameDataConnections")
            .withIndex("nextAttemptAt", (q) =>
                q.gte("nextAttemptAt", 0).lte("nextAttemptAt", cutoff)
            )
            .take(10)
        for (const row of due) {
            if (!row.enabled || row.leaseUntil > now) continue
            const source = await connectionSource(ctx, row)
            if (!source) {
                await ctx.db.patch(row._id, {
                    errorCategory: "configuration",
                    nextAttemptAt: null,
                    updatedAt: new Date(now).toISOString(),
                })
                continue
            }
            const fence = row.fence + 1
            const attempt = row.attempt >= 3 ? 1 : row.attempt + 1
            await ctx.db.patch(row._id, {
                fence,
                attempt,
                leaseUntil: now + 60_000,
                nextAttemptAt: now + 60_000,
                lastAttemptAt: new Date(now).toISOString(),
                updatedAt: new Date(now).toISOString(),
            })
            return {
                ...source,
                id: String(row._id),
                generation: row.generation,
                fence,
                attempt,
                observation: row.observation,
                etag: row.etag,
                pollAfterMs: row.pollAfterMs,
            }
        }
        return null
    },
})

export const finishSnapshot = internalMutation({
    args: {
        id: v.id("gameDataConnections"),
        generation: v.number(),
        fence: v.number(),
        result: v.object({
            observation: v.optional(gameDataObservation),
            etag: v.optional(v.union(v.string(), v.null())),
            pollAfterMs: v.optional(v.number()),
            errorCategory: v.union(gameDataError, v.null()),
            nextAttemptAt: v.union(v.number(), v.null()),
        }),
    },
    handler: async (ctx, args): Promise<boolean> => {
        const row = await ctx.db.get(args.id)
        const now = Date.now()
        if (!row || !acceptsRun(row, args, now)) return false
        if (!(await connectionSource(ctx, row))) return false
        // The validator checked the shape and the collector action parsed
        // the provider's reply with the observation schema; only the time
        // is checked again here (ARCHITECTURE.md, "Convex hot paths").
        const observation = args.result.observation
        if (observation) {
            const observedAt = Date.parse(observation.observedAt)
            if (Number.isNaN(observedAt) || observedAt > now)
                throw new Error("Invalid observation time.")
        }
        await ctx.db.patch(row._id, {
            ...args.result,
            ...(observation ? { observation } : {}),
            leaseUntil: 0,
            ...(!args.result.errorCategory ? { attempt: 0 } : {}),
            updatedAt: new Date(now).toISOString(),
        })
        return true
    },
})
