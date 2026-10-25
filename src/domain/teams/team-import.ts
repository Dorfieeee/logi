import { normalizeTeamName } from "./team"

export type ImportTeamIdentity = { name: string; shortCode: string | null }

/** Names and codes are separate identities, scoped by the caller to one game. */
export function teamImportIndex(existing: readonly ImportTeamIdentity[]) {
    const names = new Set(existing.map((team) => normalizeTeamName(team.name)))
    const codes = new Set(
        existing.flatMap((team) =>
            team.shortCode ? [normalizeTeamName(team.shortCode)] : []
        )
    )
    return {
        has(team: ImportTeamIdentity) {
            return (
                names.has(normalizeTeamName(team.name)) ||
                Boolean(
                    team.shortCode &&
                    codes.has(normalizeTeamName(team.shortCode))
                )
            )
        },
        add(team: ImportTeamIdentity) {
            names.add(normalizeTeamName(team.name))
            if (team.shortCode) codes.add(normalizeTeamName(team.shortCode))
        },
    }
}
