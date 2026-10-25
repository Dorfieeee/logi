import { teamGameSchema, teamIdSchema, type TeamGame } from "./team"
import { z } from "zod"

export const MATCH_TEAM_SLOTS = ["a", "b", "c"] as const
export type MatchTeamSlot = (typeof MATCH_TEAM_SLOTS)[number]
/** Match-specific sides/factions a slot may be assigned; null leaves the side open. */
export const MATCH_TEAM_SIDES = {
    hell_let_loose: ["Allies", "Axis"],
    wardogs: ["Valkyra", "Manticore", "Lonestar"],
} as const satisfies Record<TeamGame, readonly string[]>

export function matchTeamSlots(gameId: TeamGame): readonly MatchTeamSlot[] {
    return gameId === "wardogs" ? MATCH_TEAM_SLOTS : ["a", "b"]
}
export function matchTeamSides(gameId: TeamGame): readonly string[] {
    return MATCH_TEAM_SIDES[gameId]
}

/** What a client may send: identity, position and side. Snapshots are never client input. */
export const matchTeamInputSchema = z.strictObject({
    teamId: teamIdSchema,
    slot: z.enum(MATCH_TEAM_SLOTS),
    side: z.string().min(1).max(32).nullable(),
})
export type MatchTeamInput = z.infer<typeof matchTeamInputSchema>
export const matchTeamInputsSchema = z.array(matchTeamInputSchema).max(3)

/** Presentation captured when a team is first selected; directory edits never rewrite it. */
export const matchTeamSnapshotSchema = z.strictObject({
    name: z.string(),
    shortCode: z.string().nullable(),
    logoAssetId: z.string().nullable(),
    logoUrl: z.string().nullable(),
    teamRevision: z.number().int().min(1),
    capturedAt: z.string(),
})
export type MatchTeamSnapshot = z.infer<typeof matchTeamSnapshotSchema>
export const matchTeamAssignmentSchema = matchTeamInputSchema.extend({
    snapshot: matchTeamSnapshotSchema,
})
export type MatchTeamAssignment = z.infer<typeof matchTeamAssignmentSchema>

export type MatchTeamError =
    | "invalid_match_teams"
    | "team_not_found"
    | "team_archived"
    | "team_game_mismatch"
    | "match_concluded"
    | "training_event"

/** Slots, sides and duplicates are checked against one explicit game. */
export function validateMatchTeamInputs(
    gameId: TeamGame,
    inputs: readonly MatchTeamInput[]
): MatchTeamError | null {
    const slots = matchTeamSlots(gameId),
        sides = matchTeamSides(gameId)
    if (inputs.length > slots.length) return "invalid_match_teams"
    const seenSlots = new Set<string>(),
        seenTeams = new Set<string>(),
        seenSides = new Set<string>()
    for (const input of inputs) {
        if (!slots.includes(input.slot)) return "invalid_match_teams"
        if (input.side !== null && !sides.includes(input.side))
            return "invalid_match_teams"
        if (
            seenSlots.has(input.slot) ||
            seenTeams.has(input.teamId) ||
            (input.side !== null && seenSides.has(input.side))
        )
            return "invalid_match_teams"
        seenSlots.add(input.slot)
        seenTeams.add(input.teamId)
        if (input.side !== null) seenSides.add(input.side)
    }
    return null
}

/** Directory facts the write boundary looks up for each referenced team. */
export type DirectoryTeamLookup = {
    id: string
    gameId: TeamGame
    name: string
    shortCode: string | null
    logoAssetId: string | null
    logoUrl: string | null
    revision: number
    archivedAt: string | null
}

export function captureSnapshot(
    team: DirectoryTeamLookup,
    now: string
): MatchTeamSnapshot {
    return {
        name: team.name,
        shortCode: team.shortCode,
        logoAssetId: team.logoAssetId,
        logoUrl: team.logoAssetId ? team.logoUrl : null,
        teamRevision: team.revision,
        capturedAt: now,
    }
}

/** Any active catalogue team of the event's game can be selected. */
function selectable(
    team: DirectoryTeamLookup | undefined,
    gameId: TeamGame
): MatchTeamError | null {
    if (!team) return "team_not_found"
    if (team.gameId !== gameId) return "team_game_mismatch"
    if (team.archivedAt) return "team_archived"
    return null
}

export type MatchTeamResolution =
    | { ok: true; assignments: MatchTeamAssignment[] }
    | { ok: false; error: MatchTeamError }

/**
 * Builds the stored assignments for a save. A team already assigned keeps its
 * snapshot (even if since archived) when only its slot or side changes, as long
 * as its catalogue entry still belongs to the event's game; a newly selected
 * team must be an active catalogue entry of the same game.
 */
export function resolveMatchTeams(input: {
    gameId: TeamGame
    inputs: readonly MatchTeamInput[]
    previous: readonly MatchTeamAssignment[] | undefined
    teams: ReadonlyMap<string, DirectoryTeamLookup>
    now: string
}): MatchTeamResolution {
    const invalid = validateMatchTeamInputs(input.gameId, input.inputs)
    if (invalid) return { ok: false, error: invalid }
    const kept = new Map(
        (input.previous ?? []).map((assignment) => [
            assignment.teamId,
            assignment,
        ])
    )
    const assignments: MatchTeamAssignment[] = []
    for (const entry of input.inputs) {
        const existing = kept.get(entry.teamId)
        const team = input.teams.get(entry.teamId)
        if (existing) {
            // A game change must not silently relabel a kept selection.
            if (team && team.gameId !== input.gameId)
                return { ok: false, error: "team_game_mismatch" }
            assignments.push({ ...entry, snapshot: existing.snapshot })
            continue
        }
        const denied = selectable(team, input.gameId)
        if (denied || !team)
            return { ok: false, error: denied ?? "team_not_found" }
        assignments.push({
            ...entry,
            snapshot: captureSnapshot(team, input.now),
        })
    }
    return { ok: true, assignments: sortAssignments(assignments) }
}

/** Preserved assignments must still fit the event's game after a game change. */
export function validatePreservedMatchTeams(input: {
    gameId: TeamGame
    assignments: readonly MatchTeamAssignment[]
    teams: ReadonlyMap<string, DirectoryTeamLookup>
}): MatchTeamError | null {
    for (const assignment of input.assignments) {
        const team = input.teams.get(assignment.teamId)
        if (team && team.gameId !== input.gameId) return "team_game_mismatch"
    }
    return validateMatchTeamInputs(input.gameId, input.assignments)
}

/**
 * An explicit refresh re-captures presentation from an active catalogue entry
 * only. `team` is the entry after following merge pointers, so a merged team
 * refreshes to its replacement and the assignment adopts the replacement's ID.
 */
export function refreshMatchTeamSnapshot(input: {
    gameId: TeamGame
    assignment: MatchTeamAssignment
    others: readonly MatchTeamAssignment[]
    team: DirectoryTeamLookup | undefined
    now: string
}):
    | { ok: true; assignment: MatchTeamAssignment }
    | { ok: false; error: MatchTeamError } {
    const denied = selectable(input.team, input.gameId)
    if (denied || !input.team)
        return { ok: false, error: denied ?? "team_not_found" }
    const refreshed: MatchTeamAssignment = {
        ...input.assignment,
        teamId: input.team.id,
        snapshot: captureSnapshot(input.team, input.now),
    }
    // A replacement already assigned in another slot would duplicate the team.
    if (
        validateMatchTeamInputs(input.gameId, [...input.others, refreshed]) !==
        null
    )
        return { ok: false, error: "invalid_match_teams" }
    return { ok: true, assignment: refreshed }
}

/** Managers may correct team assignments, including historical matches. */
export function matchTeamsEditability(event: {
    kind?: "match" | "training"
    status?: "registration" | "closed" | "starting" | "concluded"
}): MatchTeamError | null {
    if ((event.kind ?? "match") === "training") return "training_event"
    return null
}

export function sortAssignments<T extends { slot: MatchTeamSlot }>(
    assignments: readonly T[]
): T[] {
    return [...assignments].sort(
        (a, b) =>
            MATCH_TEAM_SLOTS.indexOf(a.slot) - MATCH_TEAM_SLOTS.indexOf(b.slot)
    )
}

/** Consumer-facing assignment summary: no asset identifiers, only the public URL. */
export const matchTeamSummarySchema = z.strictObject({
    teamId: z.string(),
    slot: z.enum(MATCH_TEAM_SLOTS),
    side: z.string().nullable(),
    name: z.string(),
    shortCode: z.string().nullable(),
    logoUrl: z.string().nullable(),
    teamRevision: z.number().int().min(1),
    capturedAt: z.string(),
})
export type MatchTeamSummary = z.infer<typeof matchTeamSummarySchema>
export function projectMatchTeams(
    assignments: readonly MatchTeamAssignment[] | undefined
): MatchTeamSummary[] | null {
    if (!assignments) return null
    return sortAssignments(assignments).map((assignment) =>
        matchTeamSummarySchema.parse({
            teamId: assignment.teamId,
            slot: assignment.slot,
            side: assignment.side,
            name: assignment.snapshot.name,
            shortCode: assignment.snapshot.shortCode,
            logoUrl: assignment.snapshot.logoUrl,
            teamRevision: assignment.snapshot.teamRevision,
            capturedAt: assignment.snapshot.capturedAt,
        })
    )
}
export { teamGameSchema }
