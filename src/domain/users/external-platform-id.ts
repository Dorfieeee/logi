import { parseGameAccountId } from "../game-accounts/platform-id"
import { parseSteamId } from "../player-stats/player-stats"

/** Canonical self-declared Steam64 or EOS ID, never proof of ownership. */
export function externalPlatformId(value: string): string | null {
    const steam = parseSteamId(value)
    if (steam) return steam
    const epic = parseGameAccountId("epic", value)
    return epic.ok ? epic.id : null
}

/** Reuse a supported account, preferring Steam for legacy callers. */
export function linkedExternalPlatformId(
    values: readonly string[]
): string | null {
    const ids = values
        .map(externalPlatformId)
        .filter((id): id is string => id !== null)
    return ids.find((id) => id.length === 17) ?? ids[0] ?? null
}
