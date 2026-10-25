import {
    matchTeamInputsSchema,
    matchTeamsEditability,
    resolveMatchTeams,
    validatePreservedMatchTeams,
    type MatchTeamAssignment,
    type MatchTeamError,
} from "../src/domain/teams/match-teams"
import {
    ConvexMatchTeamSnapshotPorts,
    directoryLookup,
} from "../src/infrastructure/convex/team-directory-repositories"
import { refreshAssignedMatchTeam } from "../src/application/teams/refresh-match-team.use-case"
import { authorizeDashboardAdmin, dashboardActor } from "./dashboardActor"
import { assertSessionGateway } from "./dashboardSessionStore"
import { getGuildById, getGuildDiscordId } from "./identity"
import { teamGameSchema } from "../src/domain/teams/team"
import type { QueryCtx } from "./_generated/server"
import type { Doc } from "./_generated/dataModel"
import { mutation } from "./integrationMutation"
import { v } from "convex/values"

export type MatchTeamResolution =
    | { ok: true; matchTeams: MatchTeamAssignment[] | undefined }
    | { ok: false; error: MatchTeamError }

const canonical = (
    entries: readonly { teamId: string; slot: string; side: string | null }[]
) =>
    JSON.stringify(
        [...entries]
            .map(({ teamId, slot, side }) => ({ teamId, slot, side }))
            .sort((a, b) => a.slot.localeCompare(b.slot))
    )

/**
 * Authoritative resolution for an event save. Omitted input preserves the
 * current assignments (re-validated after a game change); an explicit list
 * is resolved against active catalogue entries, keeping existing snapshots.
 * An explicit [] clears the selection, including on historical matches.
 * An event that never stored a selection keeps none (null in summaries). A training never
 * carries assignments: an unconcluded match that becomes one drops them, which
 * also releases their logo references.
 */
export async function resolveEventMatchTeams(
    ctx: Pick<QueryCtx, "db">,
    input: {
        gameId: string | undefined
        kind: "match" | "training" | undefined
        status: Doc<"events">["status"]
        inputs: unknown
        previous: MatchTeamAssignment[] | undefined
        now: string
    }
): Promise<MatchTeamResolution> {
    const game = teamGameSchema.safeParse(input.gameId ?? "hell_let_loose")
    const training = (input.kind ?? "match") === "training"
    const concluded = input.status === "concluded"
    if (input.inputs === undefined) {
        if (!input.previous?.length)
            return { ok: true, matchTeams: input.previous }
        if (training)
            return { ok: true, matchTeams: concluded ? input.previous : [] }
        if (!game.success) return { ok: false, error: "team_game_mismatch" }
        const denied = validatePreservedMatchTeams({
            gameId: game.data,
            assignments: input.previous,
            teams: await directoryLookup(
                ctx,
                input.previous.map((entry) => entry.teamId)
            ),
        })
        return denied
            ? { ok: false, error: denied }
            : { ok: true, matchTeams: input.previous }
    }
    const parsed = matchTeamInputsSchema.safeParse(input.inputs)
    if (!parsed.success) return { ok: false, error: "invalid_match_teams" }
    if (parsed.data.length === 0 && !input.previous?.length)
        return {
            ok: true,
            matchTeams: training || concluded ? input.previous : [],
        }
    if (parsed.data.length === 0 && training && !concluded)
        return { ok: true, matchTeams: [] }
    const frozen = matchTeamsEditability({
        kind: input.kind,
        status: input.status,
    })
    if (frozen) {
        // Re-sending the saved selection unchanged is not an edit.
        if (
            input.previous &&
            canonical(parsed.data) === canonical(input.previous)
        )
            return { ok: true, matchTeams: input.previous }
        return { ok: false, error: frozen }
    }
    if (!game.success) return { ok: false, error: "team_game_mismatch" }
    const resolved = resolveMatchTeams({
        gameId: game.data,
        inputs: parsed.data,
        previous: input.previous,
        teams: await directoryLookup(
            ctx,
            parsed.data.map((entry) => entry.teamId)
        ),
        now: input.now,
    })
    return resolved.ok
        ? { ok: true, matchTeams: resolved.assignments }
        : { ok: false, error: resolved.error }
}

/**
 * Explicit, audited re-capture of one assignment's presentation, including
 * historical corrections. Dashboard session and admin access are rechecked
 * in this transaction; the audit names the authorized session subject.
 */
export const refreshSnapshot = mutation({
    args: {
        secret: v.string(),
        serverId: v.id("guilds"),
        eventId: v.id("events"),
        teamId: v.string(),
        actor: dashboardActor,
    },
    handler: async (ctx, args) => {
        assertSessionGateway(args.secret)
        const guild = await getGuildById(ctx, String(args.serverId))
        if (!guild) throw new Error("Server not found.")
        const guildId = getGuildDiscordId(guild)
        const admin = await authorizeDashboardAdmin(ctx, {
            secret: args.secret,
            guildId,
            actor: args.actor,
        })
        const event = await ctx.db.get(args.eventId)
        if (!event || event.guildId !== guildId)
            throw new Error("Event not found.")
        const refreshed = await refreshAssignedMatchTeam(
            new ConvexMatchTeamSnapshotPorts(ctx),
            {
                event: { ...event, id: String(event._id) },
                teamId: args.teamId,
                actor: admin.session.subject,
                now: new Date(),
            }
        )
        return refreshed.ok
            ? { ok: true as const, matchTeams: refreshed.matchTeams }
            : { error: refreshed.error }
    },
})
