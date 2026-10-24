import {
    historyRetentionCutoff,
    isProviderSessionWithinLimits,
    isRetainedHllSession,
} from "../src/domain/game-data/history-rules"
import { archiveProviderHistory, historySettings } from "./gameHistoryStore"
import { readStoredSource } from "../src/domain/game-data/operator-sources"
import { internalMutation } from "./_generated/server"
import { v } from "convex/values"

/** Operator-only seed from existing CRCON sessions. No provider requests, new
 * collector or automatic scheduling. Each invocation is one bounded transaction.
 * CLI deployment administration is the authorization boundary; this is internal. */
export const hllPage = internalMutation({
    args: {
        guildId: v.string(),
        cursor: v.union(v.string(), v.null()),
        apply: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        if (
            !args.guildId ||
            args.guildId.length > 200 ||
            (args.cursor?.length ?? 0) > 4096
        )
            throw new Error("Invalid backfill scope.")
        const page = await ctx.db
            .query("gameSessions")
            .withIndex("guildId_gameId", (q) =>
                q.eq("guildId", args.guildId).eq("gameId", "hell_let_loose")
            )
            .paginate({
                cursor: args.cursor,
                numItems: 10,
                maximumRowsRead: 10,
                maximumBytesRead: 1_000_000,
            })
        let eligible = 0,
            archived = 0,
            skipped = 0
        const cutoff = historyRetentionCutoff(
            await historySettings(ctx, args.guildId, "hell_let_loose"),
            Date.now()
        )
        for (const row of page.page) {
            const connection = await ctx.db.get(row.connectionId)
            if (
                !connection ||
                connection.guildId !== args.guildId ||
                connection.gameId !== "hell_let_loose" ||
                connection.provider !== "hll_crcon" ||
                row.sourceGeneration !== connection.generation ||
                row.externalId !== row.session.externalId ||
                !row.complete ||
                !Number.isFinite(row.fetchedAt) ||
                row.fetchedAt < 0 ||
                row.fetchedAt > Date.now() ||
                !isProviderSessionWithinLimits(row.session) ||
                !isRetainedHllSession(row.session) ||
                (cutoff !== null && row.session.endedAt! < cutoff)
            ) {
                skipped++
                continue
            }
            const source = readStoredSource(
                JSON.parse(connection.sourceFingerprint)
            )
            if (
                !source ||
                source.guildId !== args.guildId ||
                source.gameId !== "hell_let_loose" ||
                source.provider !== "hll_crcon" ||
                source.providerServerId !== connection.providerServerId
            )
                throw new Error("History source identity conflict.")
            // archiveProviderHistory also checks the stored source fingerprint,
            // provider/server/game identity and immutable start time. Any conflict
            // aborts the entire page, preserving the operator's prior checkpoint.
            eligible++
            if (args.apply) {
                await archiveProviderHistory(
                    ctx,
                    connection,
                    row.session,
                    row.fetchedAt
                )
                archived++
            }
        }
        return {
            scanned: page.page.length,
            eligible,
            archived,
            skipped,
            nextCursor: page.isDone ? null : page.continueCursor,
        }
    },
})
