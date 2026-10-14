import {
    historyFullWalkDue,
    historyTouchDue,
    isHistoryProgress,
    isProviderSessionWithinLimits,
    sessionRecordChanged,
} from "../src/domain/game-data/history-rules"
import {
    gameDataError,
    gameDataSession,
    gameDataHistoryProgress,
    warconKillEvent,
} from "./gameDataValidators"
import type { HistoryProgress } from "../src/application/game-data/collect-sessions"
import type { ResolvedSource } from "../src/domain/game-data/credentials"
import { internalQuery, type MutationCtx } from "./_generated/server"
import { archiveWarconHistory } from "./gameHistoryStore"
import { internalMutation } from "./integrationMutation"
import { connectionSource } from "./gameDataCatalog"
import type { Id } from "./_generated/dataModel"
import { v } from "convex/values"

export async function resetHistory(
    ctx: MutationCtx,
    id: Id<"gameDataConnections">,
    enabled: boolean
): Promise<void> {
    const existing = await ctx.db
        .query("gameDataHistoryRuns")
        .withIndex("connectionId", (q) => q.eq("connectionId", id))
        .unique()
    const state = {
        progress: { page: 1, pendingIds: [], nextPage: null },
        leaseUntil: 0,
        attempt: 0,
        nextAttemptAt: enabled ? Date.now() : null,
        errorCategory: null,
        lastWasRevisit: false,
    }
    // A new generation must recollect every session; record that cycle as
    // the day's full walk instead of walking everything again later.
    if (existing)
        await ctx.db.patch(existing._id, {
            ...state,
            lastFullWalkAt: undefined,
        })
    else
        await ctx.db.insert("gameDataHistoryRuns", {
            ...state,
            connectionId: id,
            fence: 0,
            lastSuccessAt: null,
            lastCompletedAt: null,
        })
}
type Claim = {
    runId: Id<"gameDataHistoryRuns">
    generation: number
    fence: number
    attempt: number
    connectionId: Id<"gameDataConnections">
    connection: ResolvedSource
    progress: HistoryProgress
    revisitId: string | null
    fullWalk: boolean
}
export const claimNext = internalMutation({
    args: {},
    handler: async (ctx): Promise<Claim | null> => {
        const now = Date.now()
        const rows = await ctx.db
            .query("gameDataHistoryRuns")
            .withIndex("nextAttemptAt", (q) =>
                q.gte("nextAttemptAt", 0).lte("nextAttemptAt", now)
            )
            .take(10)
        for (const row of rows) {
            if (row.leaseUntil > now) continue
            const connection = await ctx.db.get(row.connectionId)
            const source =
                connection?.enabled && (await connectionSource(ctx, connection))
            if (
                !connection ||
                !source ||
                !["hll_crcon", "wardogs_warcon"].includes(source.provider)
            ) {
                await ctx.db.patch(row._id, {
                    errorCategory: "configuration",
                    nextAttemptAt: null,
                })
                continue
            }
            const fence = row.fence + 1
            const progress =
                row.leaseUntil > 0 && row.progress.pendingIds.length === 0
                    ? {
                          ...row.progress,
                          page: Math.max(1, row.progress.page - 1),
                      }
                    : row.progress
            const unfinished = row.lastWasRevisit
                ? null
                : await ctx.db
                      .query("gameSessions")
                      .withIndex("connection_complete_fetched", (q) =>
                          q
                              .eq("connectionId", row.connectionId)
                              .eq("complete", false)
                              .lte("fetchedAt", now - 300_000)
                      )
                      .first()
            const attempt = row.attempt >= 3 ? 1 : row.attempt + 1
            // A cycle decides at page 1 whether it re-reads every session
            // (once a day) or stops at the first page already stored; it
            // keeps that decision until it ends. Rows from before the field
            // finish their walk as a full one.
            const fullWalk =
                (progress.page === 1 && progress.pendingIds.length === 0) ||
                row.fullWalk === undefined
                    ? historyFullWalkDue(row.lastFullWalkAt, now)
                    : row.fullWalk
            await ctx.db.patch(row._id, {
                fence,
                progress,
                attempt,
                fullWalk,
                leaseUntil: now + 60_000,
                nextAttemptAt: now + 60_000,
            })
            return {
                runId: row._id,
                generation: connection.generation,
                fence,
                attempt,
                connectionId: connection._id,
                connection: source,
                progress,
                revisitId: unfinished?.externalId ?? null,
                fullWalk,
            }
        }
        return null
    },
})
const runArgs = {
    runId: v.id("gameDataHistoryRuns"),
    generation: v.number(),
    fence: v.number(),
}
async function currentRun(
    ctx: MutationCtx,
    args: {
        runId: Id<"gameDataHistoryRuns">
        generation: number
        fence: number
    }
) {
    const row = await ctx.db.get(args.runId)
    if (!row || row.fence !== args.fence || row.leaseUntil <= Date.now())
        return null
    const connection = await ctx.db.get(row.connectionId)
    if (
        !connection?.enabled ||
        connection.generation !== args.generation ||
        !["hll_crcon", "wardogs_warcon"].includes(connection.provider)
    )
        return null
    if (!(await connectionSource(ctx, connection))) return null
    return { row, connection }
}
export const commit = internalMutation({
    args: {
        ...runArgs,
        result: v.object({
            session: v.union(gameDataSession, v.null()),
            killEvents: v.optional(v.array(warconKillEvent)),
            progress: gameDataHistoryProgress,
            completed: v.boolean(),
            revisit: v.optional(v.boolean()),
        }),
    },
    handler: async (ctx, args): Promise<boolean> => {
        const current = await currentRun(ctx, args)
        if (!current) return false
        const { row, connection } = current
        // The validators checked the shapes and the collector action parsed
        // the provider's pages with the session schema; the ranges are
        // checked here without Zod (ARCHITECTURE.md, "Convex hot paths").
        const progress = args.result.progress
        if (!isHistoryProgress(progress))
            throw new Error("Invalid history progress.")
        const now = Date.now()
        const updatedAt = new Date(now).toISOString()
        let count = connection.historyCount ?? 0
        if (args.result.session) {
            const session = args.result.session
            if (!isProviderSessionWithinLimits(session))
                throw new Error("Invalid session.")
            await archiveWarconHistory(ctx, connection, session)
            const existing = await ctx.db
                .query("gameSessions")
                .withIndex("connection_external", (q) =>
                    q
                        .eq("connectionId", row.connectionId)
                        .eq("externalId", session.externalId)
                )
                .unique()
            const record = {
                session,
                complete: session.complete,
                fetchedAt: now,
                sourceGeneration: connection.generation,
                updatedAt,
            }
            // Rewriting an unchanged row stores a version and a change-feed
            // entry per visit. Only an unfinished session records its visit
            // (at most once a minute): `fetchedAt` orders the revisits of
            // unfinished sessions. A complete, unchanged one is not written.
            const sessionId =
                existing?._id ??
                (await ctx.db.insert("gameSessions", {
                    ...record,
                    connectionId: row.connectionId,
                    guildId: connection.guildId,
                    gameId: connection.gameId,
                    externalId: session.externalId,
                }))
            if (existing) {
                if (sessionRecordChanged(existing, record))
                    await ctx.db.patch(existing._id, record)
                else if (
                    !record.complete &&
                    historyTouchDue(existing.fetchedAt, now)
                )
                    await ctx.db.patch(existing._id, { fetchedAt: now })
            } else {
                count++
            }
            if (args.result.killEvents !== undefined) {
                const old = await ctx.db
                    .query("warconKillEvents")
                    .withIndex("sessionId", (q) => q.eq("sessionId", sessionId))
                    .collect()
                for (const event of old) await ctx.db.delete(event._id)
                for (const event of args.result.killEvents)
                    await ctx.db.insert("warconKillEvents", {
                        guildId: connection.guildId,
                        sessionId,
                        sourceDigest: session.sourceDigest,
                        event,
                    })
            }
        }
        await ctx.db.patch(row._id, {
            progress,
            leaseUntil: 0,
            attempt: 0,
            errorCategory: null,
            lastSuccessAt: updatedAt,
            lastWasRevisit: args.result.revisit ?? false,
            ...(args.result.completed ? { lastCompletedAt: updatedAt } : {}),
            ...(args.result.completed && row.fullWalk
                ? { lastFullWalkAt: now }
                : {}),
            nextAttemptAt: now + (args.result.completed ? 300_000 : 1_000),
        })
        if (
            (connection.historyCount ?? 0) !== count ||
            connection.historyErrorCategory != null ||
            historyTouchDue(connection.historyLastSuccessAt, now)
        )
            await ctx.db.patch(connection._id, {
                historyCount: count,
                historyLastSuccessAt: updatedAt,
                historyErrorCategory: null,
                updatedAt,
            })
        return true
    },
})
/**
 * Which of a page's sessions are already stored complete for the
 * connection's current source generation, so an incremental cycle neither
 * fetches them from the provider again nor commits them. One indexed point
 * read per ID, at most a page (50) per call.
 */
export const storedComplete = internalQuery({
    args: {
        connectionId: v.id("gameDataConnections"),
        generation: v.number(),
        externalIds: v.array(v.string()),
    },
    handler: async (ctx, args): Promise<string[]> => {
        if (args.externalIds.length > 50)
            throw new Error("Too many session IDs.")
        const stored: string[] = []
        for (const externalId of new Set(args.externalIds)) {
            const row = await ctx.db
                .query("gameSessions")
                .withIndex("connection_external", (q) =>
                    q
                        .eq("connectionId", args.connectionId)
                        .eq("externalId", externalId)
                )
                .first()
            if (row?.complete && row.sourceGeneration === args.generation)
                stored.push(externalId)
        }
        return stored
    },
})
export const fail = internalMutation({
    args: {
        ...runArgs,
        errorCategory: gameDataError,
        nextAttemptAt: v.union(v.number(), v.null()),
    },
    handler: async (ctx, args): Promise<boolean> => {
        const current = await currentRun(ctx, args)
        if (!current) return false
        await ctx.db.patch(current.row._id, {
            leaseUntil: 0,
            errorCategory: args.errorCategory,
            nextAttemptAt: args.nextAttemptAt,
        })
        await ctx.db.patch(current.connection._id, {
            historyErrorCategory: args.errorCategory,
            updatedAt: new Date().toISOString(),
        })
        return true
    },
})
