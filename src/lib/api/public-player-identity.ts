import {
    isPublicPlayerDiscordSubject,
    type PublicPlayerIdentifierKind,
} from "@/domain/player-stats/public-identity"

/** Only the opt-in selector is constrained here; existing collection/game queries
 * retain their existing parsing and backwards-compatible behavior. */
export function publicPlayerIdentityQuery(
    params: URLSearchParams,
    playerId: string
): { identifierKind?: PublicPlayerIdentifierKind } | null {
    const values = params.getAll("identity")
    if (!values.length) return {}
    return values.length === 1 &&
        values[0] === "discord" &&
        isPublicPlayerDiscordSubject(playerId)
        ? { identifierKind: "discord" }
        : null
}
