export type MatchRecapHistoryEntry = {
    cashDelta?: number | null
    endedAt?: string
    importedAt: string
    kills: number
    deaths: number
    killDeathRatio: number
}

export function calculateMatchRecapBaseline(matches: MatchRecapHistoryEntry[]) {
    const previousMatches = [...matches]
        .sort(
            (left, right) =>
                new Date(right.endedAt ?? right.importedAt).getTime() -
                new Date(left.endedAt ?? left.importedAt).getTime()
        )
        .slice(0, 10)
    const count = previousMatches.length || 1

    return {
        ...(previousMatches.some((match) => match.cashDelta !== undefined)
            ? {
                  cashDelta: previousMatches.every(
                      (match) => typeof match.cashDelta === "number"
                  )
                      ? previousMatches.reduce(
                            (sum, match) => sum + (match.cashDelta ?? 0),
                            0
                        ) / count
                      : null,
              }
            : {}),
        matches: previousMatches.length,
        kills:
            previousMatches.reduce((sum, match) => sum + match.kills, 0) /
            count,
        deaths:
            previousMatches.reduce((sum, match) => sum + match.deaths, 0) /
            count,
        kd:
            previousMatches.reduce(
                (sum, match) => sum + match.killDeathRatio,
                0
            ) / count,
    }
}
