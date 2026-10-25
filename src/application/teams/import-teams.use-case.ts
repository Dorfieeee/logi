import {
    teamImportIndex,
    matchingImportTeams,
    type ImportTeamIdentity,
} from "../../domain/teams/team-import"
import {
    createTeam,
    updateTeam,
    type TeamDirectoryPorts,
} from "./team-directory.use-case"
import type { TeamGame } from "../../domain/teams/team"

/** Called inside one persistence transaction: retries and concurrent imports cannot duplicate codes. */
export async function importTeams(
    ports: TeamDirectoryPorts,
    actor: string,
    gameId: TeamGame,
    existing: readonly (ImportTeamIdentity & {
        id: string
        archivedAt?: string | null
        mergedIntoTeamId?: string | null
    })[],
    teams: readonly (ImportTeamIdentity & {
        logoAssetId: string | null
        idempotencyKey: string
    })[]
) {
    const index = teamImportIndex(existing)
    let updated = 0
    const seen = teamImportIndex([])
    let created = 0,
        skipped = 0
    for (const team of teams) {
        if (seen.has(team)) {
            skipped++
            continue
        }
        seen.add(team)
        const matches = matchingImportTeams(existing, team)
        if (matches.length === 1) {
            const current = await ports.repository.get(matches[0]!.id)
            if (
                !current ||
                current.archivedAt ||
                current.mergedIntoTeamId ||
                !team.logoAssetId ||
                current.logoAssetId === team.logoAssetId
            ) {
                skipped++
                continue
            }
            const result = await updateTeam(ports, { actor }, current.id, {
                expectedRevision: current.revision,
                logoAssetId: team.logoAssetId,
            })
            if ("error" in result)
                throw new Error(`Team logo update failed: ${result.error}`)
            updated++
            continue
        }
        if (matches.length > 1 || index.has(team)) {
            skipped++
            continue
        }
        const result = await createTeam(ports, { actor }, { ...team, gameId })
        if ("error" in result)
            throw new Error(`Team import failed: ${result.error}`)
        index.add(team)
        created++
    }
    return { created, updated, skipped }
}
