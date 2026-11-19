import { internalMutation } from "./_generated/server"
import { makeFunctionReference } from "convex/server"
import { v } from "convex/values"
/** Queue delayed work instead of sleeping in a runtime. Offsets persist across restarts. */
export const enqueue = internalMutation({
    args: {
        job: v.union(
            v.literal("gwl"),
            v.literal("wardogs-teams"),
            v.literal("hll-teams")
        ),
    },
    handler: async (ctx, args) => {
        if (args.job === "gwl")
            await ctx.scheduler.runAfter(
                194_400,
                makeFunctionReference<"action">(
                    "leagueAutoImportJobs:collectDue"
                ),
                {}
            )
        else
            await ctx.scheduler.runAfter(
                args.job === "wardogs-teams" ? 257_000 : 389_000,
                makeFunctionReference<"action">("teamCatalogueSync:refresh"),
                {
                    gameId:
                        args.job === "wardogs-teams"
                            ? "wardogs"
                            : "hell_let_loose",
                }
            )
    },
})
