export const REGISTRATION_MODES = ["closed", "approval", "automatic"] as const
export type RegistrationMode = (typeof REGISTRATION_MODES)[number]
export type EnrollmentStatus = "pending" | "approved" | "rejected"
export type WorkspaceMode = "full" | "competitions"

/** Missing policy deliberately preserves operator-only registration for old competitions. */
export function enrollmentPolicy(competition: {
    registrationMode?: RegistrationMode
    minimumLinkedPlayers?: number | null
}) {
    return {
        registrationMode: competition.registrationMode ?? "closed",
        minimumLinkedPlayers: competition.minimumLinkedPlayers ?? null,
    }
}

export function checkClanEnrollment(input: {
    published: boolean
    registrationMode: RegistrationMode
    minimumLinkedPlayers: number | null
    linkedPlayers: number
    teamLinked: boolean
    teamActive: boolean
    gameMatches: boolean
}) {
    if (!input.teamLinked) return "team_not_owned" as const
    if (!input.teamActive) return "team_archived" as const
    if (!input.gameMatches) return "team_game_mismatch" as const
    if (!input.published || input.registrationMode === "closed")
        return "registration_closed" as const
    if (input.linkedPlayers < (input.minimumLinkedPlayers ?? 0))
        return "minimum_players" as const
    return null
}

/** Pending/rejected requests never participate in standings or fixture selection. */
export function isApprovedRegistration(row: { status?: EnrollmentStatus }) {
    return (row.status ?? "approved") === "approved"
}

/** A re-application must not erase the name/history of a previously admitted team. */
export function hasCompetitionHistory(row: {
    status?: EnrollmentStatus
    previouslyApproved?: boolean
}) {
    return isApprovedRegistration(row) || row.previouslyApproved === true
}

export type ClanCompetitionView = {
    linkedPlayers: number
    teams: Array<{ id: string; name: string; gameId: string }>
    competitions: Array<{
        id: string
        name: string
        season: string
        slug: string
        gameId: string
        registrationMode: RegistrationMode
        minimumLinkedPlayers: number | null
        registrations: Array<{
            teamId: string
            status: EnrollmentStatus
            withdrawn: boolean
        }>
    }>
}
