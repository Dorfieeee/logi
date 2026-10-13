import { DEFAULT_GAME_ID, type GameId } from "@/domain/games/game"
import { getGameScore } from "@/domain/players/game-score"
import type { AppUser } from "@/types/domain"

export function getUserScoreForGuild(
    user: Pick<AppUser, "guildId" | "score" | "scores">,
    guildId: string,
    gameId: GameId = DEFAULT_GAME_ID
) {
    return (
        getGameScore(user.scores, guildId, gameId) ??
        (gameId === DEFAULT_GAME_ID && user.guildId === guildId
            ? (user.score ?? 0)
            : 0)
    )
}

export function getPrimaryDisplayedScore(
    user: Pick<AppUser, "score" | "scores">
) {
    if (typeof user.score === "number") {
        return user.score
    }

    return Object.values(user.scores ?? {})[0] ?? 0
}
