import { DEFAULT_GAME_ID, resolveGameScope, type GameId } from "../games/game"

/**
 * A score belongs to one workspace and one game. JSON encoding keeps the
 * record key unambiguous even when a catalogue game ID contains punctuation.
 */
export function gameScoreKey(guildId: string, gameId?: GameId) {
    return JSON.stringify([guildId, resolveGameScope(gameId)])
}

/**
 * Clan-only score keys predate game support. They are Hell Let Loose scores.
 */
export function getGameScore(
    scores: Record<string, number> | undefined,
    guildId: string,
    gameId?: GameId
) {
    const scoped = scores?.[gameScoreKey(guildId, gameId)]
    if (typeof scoped === "number") return scoped

    return resolveGameScope(gameId) === DEFAULT_GAME_ID
        ? (scores?.[guildId] ?? undefined)
        : undefined
}
