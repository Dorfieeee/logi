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

/** Match both identities; ambiguous matches must never overwrite a different team. */
export function matchingImportTeams<T extends ImportTeamIdentity>(
    existing: readonly T[],
    team: ImportTeamIdentity
): T[] {
    return existing.filter(
        (item) =>
            normalizeTeamName(item.name) === normalizeTeamName(team.name) ||
            Boolean(
                item.shortCode &&
                team.shortCode &&
                normalizeTeamName(item.shortCode) ===
                    normalizeTeamName(team.shortCode)
            )
    )
}
