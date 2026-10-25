import {
    teamImportIndex,
    matchingImportTeams,
    type ImportTeamIdentity,
} from "../../domain/teams/team-import"
import type { TeamGame } from "../../domain/teams/team"

export type ScrapedTeam = ImportTeamIdentity & { logoUrl: string | null }
export type ExistingScrapedTeam = ImportTeamIdentity & {
    id?: string
    logoAssetId?: string | null
    logoUrl?: string | null
    archivedAt?: string | null
    mergedIntoTeamId?: string | null
}
export type PreparedTeam = ImportTeamIdentity & {
    logoAssetId: string | null
    idempotencyKey: string
}
export type ScrapeTeamsPorts = {
    source(game: TeamGame): Promise<ScrapedTeam[]>
    existing(game: TeamGame): Promise<ExistingScrapedTeam[]>
    logo(url: string, existing?: ExistingScrapedTeam): Promise<string>
    key(): string
    commit(
        game: TeamGame,
        teams: PreparedTeam[]
    ): Promise<{ created: number; updated: number; skipped: number }>
}

/** Prepare logos outside the database transaction; failed downloads stay retryable. */
export async function scrapeTeams(ports: ScrapeTeamsPorts, game: TeamGame) {
    const source = await ports.source(game)
    const existing = await ports.existing(game)
    const index = teamImportIndex([])
    const targets = new Set<string>()
    const prepared: PreparedTeam[] = []
    let skipped = 0
    const failed: string[] = []
    const candidates = source.filter((team) => {
        if (index.has(team)) {
            skipped++
            return false
        }
        index.add(team)
        const matches = matchingImportTeams(existing, team)
        if (matches.length > 1) {
            failed.push(team.name)
            return false
        }
        const current = matches[0]
        if (current) {
            const key = current.id ?? current.name
            if (targets.has(key)) {
                skipped++
                return false
            }
            targets.add(key)
        }
        if (
            current &&
            (current.archivedAt || current.mergedIntoTeamId || !team.logoUrl)
        ) {
            skipped++
            return false
        }
        return true
    })
    // Keep provider traffic bounded while allowing large directories to finish promptly.
    for (let offset = 0; offset < candidates.length; offset += 4) {
        const batch = await Promise.all(
            candidates.slice(offset, offset + 4).map(async (team) => {
                try {
                    const logoAssetId = team.logoUrl
                        ? await ports.logo(
                              team.logoUrl,
                              matchingImportTeams(existing, team)[0]
                          )
                        : null
                    return {
                        name: team.name,
                        shortCode: team.shortCode,
                        logoAssetId,
                        idempotencyKey: ports.key(),
                    }
                } catch {
                    return null
                }
            })
        )
        batch.forEach((team, position) => {
            if (team) prepared.push(team)
            else {
                const sourceTeam = candidates[offset + position]
                if (sourceTeam) failed.push(sourceTeam.name)
            }
        })
    }
    const result = prepared.length
        ? await ports.commit(game, prepared)
        : { created: 0, updated: 0, skipped: 0 }
    return {
        created: result.created,
        updated: result.updated,
        skipped: skipped + result.skipped,
        failed,
    }
}
