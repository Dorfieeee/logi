import type { RegistrationMode, EnrollmentStatus } from "./enrollment"
import type { FixturePhase, FixtureStatus } from "./competition"
import type { GameId } from "../games/game"

/** Global-administration projections of a competition (dashboard only, never public). */

export type CompetitionTeamView = {
    /** Global catalogue team ID, or `guild:<id>` for a row awaiting migration. */
    id: string
    name: string
    shortCode: string | null
    logoUrl: string | null
    /** Archived or merged in the catalogue. */
    archived: boolean
    /** A legacy workspace reference awaiting `competitionMigrations:adoptGlobalTeams`. */
    legacy: boolean
}

export type CompetitionSummary = {
    id: string
    gameId: GameId
    slug: string
    name: string
    season: string
    description: string | null
    registrationMode?: RegistrationMode
    minimumLinkedPlayers?: number | null
    published: boolean
    createdAt: string
    updatedAt: string
}

export type CompetitionListItem = CompetitionSummary & {
    divisions: number
    registrations: number
    fixtures: number
    legacyRows: number
}

export type CompetitionDivisionView = {
    id: string
    name: string
    order: number
}

export type CompetitionRegistrationView = {
    id: string
    divisionId: string | null
    status?: EnrollmentStatus
    withdrawn: boolean
    team: CompetitionTeamView
}

export type CompetitionFixtureView = {
    id: string
    divisionId: string | null
    phase: FixturePhase
    /** Round number; null for fixtures saved without one. */
    round: number | null
    sideA: CompetitionTeamView
    sideB: CompetitionTeamView
    /** Two HLL teams or two/three Wardogs teams in fixture result order. */
    participants?: CompetitionTeamView[]
    scheduledAt: string | null
    scoreA: number | null
    scoreB: number | null
    participantScores?: Array<number | null> | null
    /** Independent clan submissions disagree with the current fixture score. */
    resultConflict?: boolean
    status: FixtureStatus
    event: {
        id: string
        name: string
        gameStart: string
        workspace: string | null
        /** The clan's event carries an imported result. */
        hasResult: boolean
        /** The clan confirmed (reviewed) that result. */
        reviewed: boolean
    } | null
    /** All linked local clan events. `event` remains the legacy primary link. */
    events?: Array<{
        id: string
        name: string
        gameStart: string
        workspace: string | null
        hasResult: boolean
        reviewed: boolean
    }>
}

export type CompetitionAdminView = {
    competition: CompetitionSummary
    divisions: CompetitionDivisionView[]
    registrations: CompetitionRegistrationView[]
    fixtures: CompetitionFixtureView[]
    /** Rows that still reference workspaces until the migration runs. */
    legacyRows: number
}

/** A native match event offered for linking to a fixture. */
export type FixtureEventCandidate = {
    id: string
    name: string
    gameStart: string
    workspace: string
    /** The event's assigned match teams include both fixture teams. */
    teamsMatch: boolean
    hasResult: boolean
}
