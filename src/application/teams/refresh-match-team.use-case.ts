import {
    matchTeamsEditability,
    refreshMatchTeamSnapshot,
    type MatchTeamAssignment,
    type MatchTeamError,
} from "../../domain/teams/match-teams"
import type { EventKind, EventStatus } from "../../domain/events/types"
import { currentEventStatus } from "../../domain/events/status"
import { teamGameSchema } from "../../domain/teams/team"
import type { MatchTeamSnapshotPorts } from "./ports"

/** The event facts a refresh decides on. */
export type RefreshableEvent = {
    id: string
    gameId?: string
    kind?: EventKind
    status?: EventStatus
    registrationEnd?: string
    meetingStart?: string
    gameEnd?: string
    matchTeams?: MatchTeamAssignment[]
}

/**
 * Explicit, audited re-capture of one assigned team's presentation from its
 * active catalogue entry (after following merge pointers), including historical
 * matches. A rejection writes nothing. Shared
 * by the dashboard refresh and the website `refresh_match_team` command.
 */
export async function refreshAssignedMatchTeam(
    ports: MatchTeamSnapshotPorts,
    input: {
        event: RefreshableEvent
        teamId: string
        actor: string
        now: Date
    }
): Promise<
    | { ok: true; matchTeams: MatchTeamAssignment[] }
    | { ok: false; error: MatchTeamError }
> {
    const { event } = input
    const frozen = matchTeamsEditability({
        kind: event.kind,
        status: currentEventStatus(event, input.now),
    })
    if (frozen) return { ok: false, error: frozen }
    const game = teamGameSchema.safeParse(event.gameId ?? "hell_let_loose")
    if (!game.success) return { ok: false, error: "team_game_mismatch" }
    const assignment = event.matchTeams?.find(
        (entry) => entry.teamId === input.teamId
    )
    if (!event.matchTeams || !assignment)
        return { ok: false, error: "team_not_found" }
    const now = input.now.toISOString()
    const refreshed = refreshMatchTeamSnapshot({
        gameId: game.data,
        assignment,
        others: event.matchTeams.filter((entry) => entry !== assignment),
        team: await ports.lookupTeam(input.teamId),
        now,
    })
    if (!refreshed.ok) return refreshed
    const matchTeams = event.matchTeams.map((entry) =>
        entry === assignment ? refreshed.assignment : entry
    )
    await ports.saveAssignments(event.id, matchTeams, now)
    await ports.auditRefresh(refreshed.assignment.teamId, input.actor, event.id)
    return { ok: true, matchTeams }
}
