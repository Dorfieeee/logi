import {
    SNAPSHOT_CONCURRENCY,
    SNAPSHOT_CONNECTIONS_PER_TICK,
    SNAPSHOT_START_BUDGET_MS,
} from "../../domain/game-data/snapshot-rules"

type SnapshotBatchPorts<Connection> = {
    now: () => number
    /** Atomically leases the oldest eligible source due by this fixed cutoff. */
    claim: (tickStartedAt: number) => Promise<Connection | null>
    collect: (connection: Connection) => Promise<unknown>
}

/** Bounded snapshot tick. Finish in-flight work and propagate failures for lease recovery. */
export async function collectDueSnapshots<Connection extends { id: string }>(
    ports: SnapshotBatchPorts<Connection>
): Promise<number> {
    const tickStartedAt = ports.now()
    const deadline = tickStartedAt + SNAPSHOT_START_BUDGET_MS
    const seen = new Set<string>()
    let started = 0
    let processed = 0
    let stopped = false
    async function worker() {
        try {
            while (
                !stopped &&
                started < SNAPSHOT_CONNECTIONS_PER_TICK &&
                ports.now() < deadline
            ) {
                // Reserve before awaiting the atomic mutation: workers share one tick budget.
                started++
                const connection = await ports.claim(tickStartedAt)
                if (!connection) {
                    stopped = true
                    return
                }
                if (seen.has(connection.id))
                    throw new Error("Duplicate snapshot claim.")
                seen.add(connection.id)
                await ports.collect(connection)
                processed++
            }
        } catch (error) {
            stopped = true
            throw error
        }
    }
    const results = await Promise.allSettled(
        Array.from({ length: SNAPSHOT_CONCURRENCY }, () => worker())
    )
    const failed = results.find((result) => result.status === "rejected")
    if (failed?.status === "rejected") throw failed.reason
    return processed
}
