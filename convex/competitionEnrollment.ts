import {
    clanCompetitionView,
    executeClanEnrollment,
} from "./competitionEnrollmentStore"
import { workspaceModeSchema } from "../src/domain/competitions/enrollment.schema"
import { authorizeDashboardAdmin, dashboardActor } from "./dashboardActor"
import { mutation } from "./integrationMutation"
import { query } from "./_generated/server"
import { v } from "convex/values"
const access = {
    secret: v.string(),
    actor: dashboardActor,
    guildId: v.string(),
}
export const list = query({
    args: access,
    handler: async (ctx, args) => {
        const { server } = await authorizeDashboardAdmin(ctx, args)
        return clanCompetitionView(ctx, server, args.guildId)
    },
})
export const execute = mutation({
    args: { ...access, input: v.any() },
    handler: async (ctx, args) => {
        const { server, session } = await authorizeDashboardAdmin(ctx, args)
        return executeClanEnrollment(
            ctx,
            server,
            args.guildId,
            session.subject,
            args.input
        )
    },
})
export const setWorkspaceMode = mutation({
    args: { ...access, mode: v.string() },
    handler: async (ctx, args) => {
        const { server } = await authorizeDashboardAdmin(ctx, args)
        const mode = workspaceModeSchema.parse(args.mode)
        await ctx.db.patch(server._id, {
            workspaceMode: mode,
            updatedAt: new Date().toISOString(),
        })
        return { ok: true }
    },
})
