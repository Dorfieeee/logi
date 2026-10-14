import { resolveGameScope } from "../games/game"

export type PlayerMetric =
    "kills" | "deaths" | "kd" | "offense" | "defense" | "support" | "cashDelta"
export type PlayerStatProfile = {
    kind: "hll" | "wardogs"
    fields: readonly PlayerMetric[]
    trends: readonly Exclude<PlayerMetric, "defense">[]
    primaryChart: "playerEffectiveness" | "cash"
}
const hll: PlayerStatProfile = {
    kind: "hll",
    fields: ["kills", "kd", "deaths", "offense", "defense", "support"],
    trends: ["kd", "offense", "support"],
    primaryChart: "playerEffectiveness",
}
const wardogs: PlayerStatProfile = {
    kind: "wardogs",
    fields: ["kills", "kd", "deaths", "cashDelta"],
    trends: ["kills", "deaths", "cashDelta"],
    primaryChart: "cash",
}
/** Register a game's supported metrics here; unsupported games have no stats UI. */
const profiles: Readonly<Record<string, PlayerStatProfile>> = {
    hell_let_loose: hll,
    hell_let_loose_vietnam: hll,
    wardogs,
}
export function playerStatProfile(gameId?: string): PlayerStatProfile | null {
    const game = resolveGameScope(gameId)
    return Object.prototype.hasOwnProperty.call(profiles, game)
        ? (profiles[game] ?? null)
        : null
}
export function playerMetricKind(gameId?: string) {
    return playerStatProfile(gameId)?.kind ?? null
}
