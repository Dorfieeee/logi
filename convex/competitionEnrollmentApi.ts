import {
    workspaceModeSchema,
    clanEnrollmentCommandSchema,
} from "../src/domain/competitions/enrollment.schema"
import {
    clanCompetitionView,
    executeClanEnrollment,
} from "./competitionEnrollmentStore"
import {
    allowsApiKeyRead,
    isApiKeyReadAccess,
} from "../src/domain/api/key-access"
import { assertSessionGateway } from "./dashboardSessionStore"
import { query, type QueryCtx } from "./_generated/server"
import { authorizeDashboardAdmin } from "./dashboardActor"
import { resolveSsoActor } from "./ssoTokenStore"
import { mutation } from "./integrationMutation"
import { v } from "convex/values"

const access = {
    secret: v.string(),
    keyHash: v.string(),
    actorTokenHash: v.string(),
    guildId: v.string(),
    gameId: v.string(),
}
async function authorize(
    ctx: Pick<QueryCtx, "db">,
    args: {
        secret: string
        keyHash: string
        actorTokenHash: string
        guildId: string
        gameId: string
    },
    write: boolean
) {
    assertSessionGateway(args.secret)
    if (!["hell_let_loose", "wardogs"].includes(args.gameId)) return null
    const key = await ctx.db
        .query("apiKeys")
        .withIndex("keyHash", (q) => q.eq("keyHash", args.keyHash))
        .unique()
    const actor = await resolveSsoActor(ctx, args.actorTokenHash)
    if (
        !key ||
        key.revokedAt ||
        key.guildId !== args.guildId ||
        !actor ||
        actor.guildId !== args.guildId
    )
        return null
    // Restricted read keys never acquire writes. Existing full-access keys also
    // need the live SSO clan administrator, unlike a service-only settings call.
    if (
        write
            ? key.readAccess !== undefined
            : key.readAccess !== undefined &&
              (!isApiKeyReadAccess(key.readAccess) ||
                  !allowsApiKeyRead(key.readAccess, "teams", args.gameId))
    )
        return null
    try {
        return await authorizeDashboardAdmin(ctx, {
            secret: args.secret,
            guildId: args.guildId,
            actor: {
                sid: actor.sid,
                subject: actor.subject,
                userRecordId: String(actor.userRecordId),
                superadmin: false,
            },
        })
    } catch {
        return null
    }
}
export const list = query({
    args: access,
    handler: async (ctx, args) => {
        const current = await authorize(ctx, args, false)
        if (!current) return { error: "forbidden" }
        const view = await clanCompetitionView(
            ctx,
            current.server,
            args.guildId
        )
        return {
            data: {
                ...view,
                teams: view.teams.filter((row) => row.gameId === args.gameId),
                competitions: view.competitions.filter(
                    (row) => row.gameId === args.gameId
                ),
            },
        }
    },
})
export const execute = mutation({
    args: { ...access, input: v.any() },
    handler: async (ctx, args) => {
        const current = await authorize(ctx, args, true)
        if (!current) return { error: "forbidden" }
        const parsed = clanEnrollmentCommandSchema.safeParse(args.input)
        if (!parsed.success) return { error: "invalid_competition" }
        const id = ctx.db.normalizeId("competitions", parsed.data.competitionId)
        const competition = id ? await ctx.db.get(id) : null
        if (
            !competition ||
            (competition.gameId ?? "hell_let_loose") !== args.gameId
        )
            return { error: "not_found" }
        return executeClanEnrollment(
            ctx,
            current.server,
            args.guildId,
            current.session.subject,
            parsed.data
        )
    },
})
export const mode = mutation({
    args: { ...access, mode: v.string() },
    handler: async (ctx, args) => {
        const current = await authorize(ctx, args, true)
        if (!current) return { error: "forbidden" }
        const mode = workspaceModeSchema.parse(args.mode)
        await ctx.db.patch(current.server._id, {
            workspaceMode: mode,
            updatedAt: new Date().toISOString(),
        })
        return { ok: true, serverId: String(current.server._id) }
    },
})
export const readMode = query({
    args: access,
    handler: async (ctx, args) => {
        const current = await authorize(ctx, args, false)
        return current
            ? { data: { mode: current.server.workspaceMode ?? "full" } }
            : { error: "forbidden" }
    },
})
