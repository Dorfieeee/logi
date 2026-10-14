import { resolveGameScope } from "../games/game"

/** One badge per active clan, with each membership game represented once. */
export function groupPlayerClans(
    assignments: readonly {
        serverId: string
        gameId?: string
        status: string
    }[]
) {
    const clans = new Map<string, Set<string>>()
    for (const assignment of assignments) {
        if (assignment.status !== "active") continue
        const games = clans.get(assignment.serverId) ?? new Set<string>()
        games.add(resolveGameScope(assignment.gameId))
        clans.set(assignment.serverId, games)
    }
    return [...clans].map(([serverId, games]) => ({
        serverId,
        gameIds: [...games].sort(),
    }))
}
