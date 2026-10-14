import { saveCollectedPlayerStats } from "./collectedPlayerStatsStore"
import { currentEventResult } from "./eventResultStore"
import { assertInternalSecret } from "./discord_shared"
import { mutation } from "./_generated/server"
import { v } from "convex/values"

/** Operator recovery: bounded pages, one event per transaction; no result edits. */
export const backfillPage = mutation({
    args: { secret: v.string(), cursor: v.union(v.string(), v.null()) },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const page = await ctx.db
            .query("events")
            .paginate({ cursor: args.cursor, numItems: 1 })
        let matchedPlayers = 0
        let players = 0,
            changed = 0,
            unavailable = 0
        for (const event of page.page) {
            if (event.gameId !== "wardogs" || event.kind === "training")
                continue
            const revision = await currentEventResult(ctx, event)
            if (!revision || revision.status === "provisional") continue
            try {
                const result = await saveCollectedPlayerStats(
                    ctx,
                    event,
                    revision
                )
                matchedPlayers += result.matchedPlayers
                players += result.players
                changed += Number(result.changed)
            } catch (error) {
                if (
                    !(error instanceof Error) ||
                    !error.message.includes("source is unavailable or changed")
                )
                    throw error
                unavailable++
            }
        }
        return {
            cursor: page.continueCursor,
            done: page.isDone,
            players,
            matchedPlayers,
            changed,
            unavailable,
        }
    },
})
