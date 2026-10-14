import type { PerformanceSnapshot } from "@/lib/read-models/performance-history"
import type { PlayerMetric } from "@/domain/player-stats/game-metrics"
import type { Dictionary } from "@/i18n/dictionaries"

export function playerMetricLabels(
    dictionary: Dictionary
): Record<PlayerMetric, string> {
    return {
        kills: dictionary.gameHistory.kills,
        deaths: dictionary.gameHistory.deaths,
        kd: dictionary.clan.kd,
        offense: dictionary.clan.combatEffectiveness,
        defense: dictionary.userManagement.matchDefense,
        support: dictionary.clan.supportEffectiveness,
        cashDelta: dictionary.gameHistory.cash,
    }
}
/** One mapping used by both public profile and individual match charts. */
export function playerMatchSnapshot(match: {
    eventId: string
    gameId?: string
    endedAt: string
    name: string
    kills: number
    deaths: number
    killDeathRatio: number
    offense?: number
    defense?: number
    support?: number
    cashDelta?: number | null
}): PerformanceSnapshot {
    return {
        eventId: match.eventId,
        gameId: match.gameId,
        playedAt: match.endedAt,
        label: match.name,
        kills: match.kills,
        deaths: match.deaths,
        kd: match.killDeathRatio,
        cashDelta: match.cashDelta,
        combat: Math.round((match.offense ?? 0) + (match.defense ?? 0)),
        offense: Math.round((match.offense ?? 0) + (match.defense ?? 0)),
        support: Math.round(match.support ?? 0),
        points: 0,
    }
}
