import { IDEMPOTENCY_RETENTION_MS } from "../src/domain/api/idempotency"
import type { MutationCtx } from "./_generated/server"
import type { Doc, Id } from "./_generated/dataModel"

type IdempotentMutationInput = {
    keyHash: string
    idempotencyKey: string
    bodyHash: string
    methodPath: string
}

type IdempotentMutationStart =
    | { kind: "unauthorized" }
    | { kind: "complete"; result: { status: number; body: string } }
    | {
          kind: "started"
          key: Doc<"apiKeys">
          idempotencyId: Id<"apiIdempotencyKeys">
          createdAt: string
      }

/**
 * Starts an API-key mutation in the same Convex transaction as its resource
 * write and response recording. Keeping this local prevents a retry from
 * observing a reservation without its corresponding resource result.
 */
export async function startIdempotentMutation(
    ctx: MutationCtx,
    args: IdempotentMutationInput
): Promise<IdempotentMutationStart> {
    const key = await ctx.db
        .query("apiKeys")
        .withIndex("keyHash", (q) => q.eq("keyHash", args.keyHash))
        .unique()
    if (!key || key.revokedAt) return { kind: "unauthorized" }
    // Enforce before reading cached responses, reserving idempotency or writing.
    if (key.readAccess !== undefined)
        return {
            kind: "complete",
            result: {
                status: 403,
                body: JSON.stringify({
                    error: {
                        code: "insufficient_scope",
                        message: "This API key does not allow this operation.",
                    },
                }),
            },
        }

    const existing = await ctx.db
        .query("apiIdempotencyKeys")
        .withIndex("guildId_key", (q) =>
            q.eq("guildId", key.guildId).eq("key", args.idempotencyKey)
        )
        .unique()
    if (existing && existing.expiresAt > Date.now()) {
        if (
            existing.methodPath !== args.methodPath ||
            existing.bodyHash !== args.bodyHash
        )
            return {
                kind: "complete",
                result: {
                    status: 409,
                    body: JSON.stringify({
                        error: {
                            code: "idempotency_conflict",
                            message:
                                "This Idempotency-Key was used for a different request.",
                        },
                    }),
                },
            }
        return {
            kind: "complete",
            result: { status: existing.status, body: existing.responseBody },
        }
    }
    if (existing) await ctx.db.delete(existing._id)

    const createdAt = new Date().toISOString()
    const idempotencyId = await ctx.db.insert("apiIdempotencyKeys", {
        guildId: key.guildId,
        key: args.idempotencyKey,
        methodPath: args.methodPath,
        bodyHash: args.bodyHash,
        status: 500,
        responseBody: "",
        createdAt,
        expiresAt: Date.now() + IDEMPOTENCY_RETENTION_MS,
    })
    return { kind: "started", key, idempotencyId, createdAt }
}
