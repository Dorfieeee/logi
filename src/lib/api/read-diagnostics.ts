import { createHash } from "node:crypto"

type Scope = {
    operation: string
    resource: string
    gameId: string
    keyHash: string
}
type Sample = {
    scope: Omit<Scope, "keyHash"> & { keyFingerprint: string }
    startedAt: number
    count: number
    failures: number
    totalMs: number
    maxMs: number
}

/** Bounded process-local minute aggregates; never retain credentials or record/subject IDs. */
export function createReadDiagnostics(
    now = Date.now,
    report: (sample: Record<string, unknown>) => void = (sample) =>
        console.info("[api-read]", JSON.stringify(sample))
) {
    const samples = new Map<string, Sample>()
    return async <T>(scope: Scope, read: () => Promise<T>): Promise<T> => {
        const started = now()
        let failed = false
        try {
            return await read()
        } catch (error) {
            failed = true
            throw error
        } finally {
            const finished = now()
            for (const [key, sample] of samples) {
                if (finished - sample.startedAt >= 60_000) {
                    report({
                        ...sample.scope,
                        count: sample.count,
                        failures: sample.failures,
                        meanMs: Math.round(sample.totalMs / sample.count),
                        maxMs: sample.maxMs,
                        windowMs: finished - sample.startedAt,
                    })
                    samples.delete(key)
                }
            }
            const { keyHash, ...fields } = scope
            const safeScope = {
                ...fields,
                keyFingerprint: createHash("sha256")
                    .update(keyHash)
                    .digest("hex")
                    .slice(0, 12),
            }
            const key = JSON.stringify(safeScope)
            let sample = samples.get(key)
            if (!sample) {
                if (samples.size >= 1000) {
                    const oldest = samples.keys().next().value
                    if (oldest !== undefined) samples.delete(oldest)
                }
                sample = {
                    scope: safeScope,
                    startedAt: finished,
                    count: 0,
                    failures: 0,
                    totalMs: 0,
                    maxMs: 0,
                }
                samples.set(key, sample)
            }
            const durationMs = Math.max(0, finished - started)
            sample.count++
            sample.failures += Number(failed)
            sample.totalMs += durationMs
            sample.maxMs = Math.max(sample.maxMs, durationMs)
            if (failed || durationMs >= 750)
                report({
                    ...safeScope,
                    outcome: failed ? "error" : "slow",
                    durationMs,
                })
        }
    }
}

export const observeApiRead = createReadDiagnostics()
