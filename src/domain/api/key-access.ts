import { isGameId, type GameId, type GameSelection } from "../games/game"

/** Only resources with a backend-enforced game ownership boundary. */
export const API_KEY_READ_RESOURCES = [
    "member-summaries",
    "roster-summaries",
    "player-stat-summaries",
    "league-matches",
    "league-fixtures",
    "warcon-data",
    "hll-live",
    "server-game-history",
    "membership-summaries",
    "server-snapshots",
    "integration-health",
    "events",
    "groups",
    "rosters",
    "assignments",
    "stratmaps",
    "matches",
    "event-summaries",
    "match-summaries",
    "result-summaries",
    "teams",
] as const

export type ApiKeyReadAccess = {
    resources: Array<(typeof API_KEY_READ_RESOURCES)[number]>
    gameIds: GameId[]
}

export function isApiKeyReadAccess(value: unknown): value is ApiKeyReadAccess {
    if (!value || typeof value !== "object" || Array.isArray(value))
        return false
    const input = value as Record<string, unknown>
    return (
        Object.keys(input).every(
            (key) => key === "resources" || key === "gameIds"
        ) &&
        Array.isArray(input.resources) &&
        input.resources.length > 0 &&
        input.resources.every((resource) =>
            (API_KEY_READ_RESOURCES as readonly unknown[]).includes(resource)
        ) &&
        new Set(input.resources).size === input.resources.length &&
        Array.isArray(input.gameIds) &&
        input.gameIds.length > 0 &&
        input.gameIds.every(
            (game) =>
                typeof game === "string" && game !== "all" && isGameId(game)
        ) &&
        new Set(input.gameIds).size === input.gameIds.length
    )
}

/** Missing policy preserves legacy keys. Present but malformed policy fails closed. */
export function allowsApiKeyRead(
    access: unknown,
    resource: string,
    game?: GameSelection
) {
    if (access === undefined)
        return ![
            "warcon-data",
            "hll-live",
            "server-game-history",
            "league-matches",
            "league-fixtures",
            "member-summaries",
            "roster-summaries",
            "player-stat-summaries",
            "teams",
        ].includes(resource)
    if (
        !isApiKeyReadAccess(access) ||
        !(access.resources as string[]).includes(resource)
    )
        return false
    if (game === undefined) return true // Detail reads must check the persisted game separately.
    if (game === "all") return false
    const games = typeof game === "string" ? [game] : game
    return games.length > 0 && games.every((id) => access.gameIds.includes(id))
}
