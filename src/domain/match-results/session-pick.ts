/** How far a server game boundary may be from the corresponding match boundary. */
export const SESSION_MATCH_WINDOW_MS = 3 * 60 * 60 * 1000

/**
 * The collected game with a start or end closest to the corresponding scheduled
 * boundary, within three hours. Complete records win ties. This is a suggestion,
 * never an approved link; end time also covers provider games with an early start.
 */
export function suggestResultSession<
    T extends {
        id: string
        startedAt: string | null
        endedAt?: string | null
        complete: boolean
    },
>(sessions: readonly T[], matchStart: string, matchEnd?: string): T | null {
    const target = new Date(matchStart).getTime()
    if (!Number.isFinite(target)) return null
    const targetEnd = matchEnd ? Date.parse(matchEnd) : Number.NaN
    let best: { session: T; distance: number } | null = null
    for (const session of sessions) {
        const started = session.startedAt
            ? new Date(session.startedAt).getTime()
            : Number.NaN
        const ended = Date.parse(session.endedAt ?? "")
        const startDistance = Number.isFinite(started)
            ? Math.abs(started - target)
            : Infinity
        const endDistance =
            Number.isFinite(ended) && Number.isFinite(targetEnd)
                ? Math.abs(ended - targetEnd)
                : Infinity
        const distance = Math.min(startDistance, endDistance)
        if (distance > SESSION_MATCH_WINDOW_MS) continue
        if (
            !best ||
            distance < best.distance ||
            (distance === best.distance &&
                session.complete &&
                !best.session.complete)
        )
            best = { session, distance }
    }
    return best?.session ?? null
}
