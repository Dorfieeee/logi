/**
 * Candidate source games are deliberately suggestions, never an automatic
 * association.  A fixture/event gives us a start and expected end; rank by
 * overlap first, then by the distance of both boundaries.  Provider games
 * without complete timestamps sort after usable candidates but remain visible
 * for a manager to choose explicitly.
 */
export function rankSourceCandidates<
    T extends { session: { startedAt: string | null; endedAt: string | null } },
>(
    rows: readonly T[],
    event: { gameStart: string; gameEnd: string },
    limit = 10
): T[] {
    const start = Date.parse(event.gameStart)
    const end = Date.parse(event.gameEnd)
    const score = (row: T) => {
        const sessionStart = Date.parse(row.session.startedAt ?? "")
        const sessionEnd = row.session.endedAt
            ? Date.parse(row.session.endedAt)
            : Number.NaN
        if (
            !Number.isFinite(start) ||
            !Number.isFinite(end) ||
            !Number.isFinite(sessionStart) ||
            !Number.isFinite(sessionEnd)
        )
            return [
                1,
                Number.MAX_SAFE_INTEGER,
                Number.MAX_SAFE_INTEGER,
            ] as const
        const overlap = sessionStart <= end && sessionEnd >= start ? 0 : 1
        return [
            overlap,
            Math.abs(sessionStart - start) + Math.abs(sessionEnd - end),
            Math.abs(sessionStart - start),
        ] as const
    }
    return [...rows]
        .sort((left, right) => {
            const a = score(left),
                b = score(right)
            return (
                a[0] - b[0] ||
                a[1] - b[1] ||
                a[2] - b[2] ||
                (right.session.endedAt ?? "").localeCompare(
                    left.session.endedAt ?? ""
                )
            )
        })
        .slice(0, limit)
}
