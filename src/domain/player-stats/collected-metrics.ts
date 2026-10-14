import type { ProviderSession } from "../game-data/contracts"

/** Combine linked games once per platform player; unknown cash stays unknown. */
export function wardogsPlayerMetrics(sessions: readonly ProviderSession[]) {
    const players = new Map<
        string,
        {
            platformId: string
            name: string
            faction: string
            kills: number
            deaths: number
            cashDelta: number | null
        }
    >()
    for (const session of sessions) {
        // Session identities are de-duplicated by the caller (different servers can reuse IDs).
        for (const player of session.players) {
            if (player.platform !== "steam") continue
            const kills = player.metrics.kills,
                deaths = player.metrics.deaths
            if (kills == null || deaths == null) continue
            const key = player.platformId
            const previous = players.get(key)
            const cash = player.metrics.cashDelta ?? null
            players.set(key, {
                platformId: key,
                name: player.name || previous?.name || key,
                faction: player.faction || previous?.faction || "",
                kills: (previous?.kills ?? 0) + kills,
                deaths: (previous?.deaths ?? 0) + deaths,
                cashDelta: previous
                    ? previous.cashDelta !== null && cash !== null
                        ? previous.cashDelta + cash
                        : null
                    : cash,
            })
        }
    }
    return [...players.values()]
}
