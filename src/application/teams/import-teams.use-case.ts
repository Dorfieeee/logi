import {
    teamImportIndex,
    type ImportTeamIdentity,
} from "../../domain/teams/team-import"
import { createTeam, type TeamDirectoryPorts } from "./team-directory.use-case"
import type { TeamGame } from "../../domain/teams/team"

/** Called inside one persistence transaction: retries and concurrent imports cannot duplicate codes. */
export async function importTeams(
    ports: TeamDirectoryPorts,
    actor: string,
    gameId: TeamGame,
    existing: readonly ImportTeamIdentity[],
    teams: readonly (ImportTeamIdentity & {
        logoAssetId: string | null
        idempotencyKey: string
    })[]
) {
    const index = teamImportIndex(existing)
    let created = 0,
        skipped = 0
    for (const team of teams) {
        if (index.has(team)) {
            skipped++
            continue
        }
        const result = await createTeam(ports, { actor }, { ...team, gameId })
        if ("error" in result)
            throw new Error(`Team import failed: ${result.error}`)
        index.add(team)
        created++
    }
    return { created, skipped }
}
