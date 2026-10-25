/** Scheduler throughput only; source polling, Retry-After and freshness stay independent. */
export const SNAPSHOT_TICK_SECONDS = 30
export const SNAPSHOT_CONNECTIONS_PER_TICK = 10
export const SNAPSHOT_CONCURRENCY = 2
export const SNAPSHOT_START_BUDGET_MS = 20_000

/** A fixed tick cutoff cannot make a future source or a post-tick retry due early. */
export function snapshotDueCutoff(now: number, tickStartedAt?: number): number {
    if (
        tickStartedAt !== undefined &&
        (!Number.isFinite(tickStartedAt) || tickStartedAt < 0)
    )
        throw new Error("Invalid snapshot due cutoff.")
    return Math.min(now, tickStartedAt ?? now)
}
