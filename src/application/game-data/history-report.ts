import {
    historyPageSchema,
    type HistoryPage,
    type HistoryRecord,
} from "../../domain/game-data/history"
import { aggregateHistory } from "../../domain/game-data/history-report"

/** Consumers must await the completed result; failed/partial scans never yield a ranking. */
export async function buildHistoryReport(
    readPage: (cursor: string | null) => Promise<HistoryPage>,
    options: {
        signal?: AbortSignal
        maxPages?: number
        minMinutes?: number
        gameId?: HistoryRecord["gameId"]
    } = {}
) {
    const records: HistoryRecord[] = [],
        seen = new Set<string>()
    let cursor: string | null = null,
        revision: string | undefined,
        lastCollectedAt: string | null = null
    const maxPages = options.maxPages ?? 1000
    if (!Number.isSafeInteger(maxPages) || maxPages < 1 || maxPages > 10000)
        throw new Error("Invalid page budget.")
    for (let pageNumber = 0; pageNumber < maxPages; pageNumber++) {
        options.signal?.throwIfAborted()
        const page = historyPageSchema.parse(await readPage(cursor))
        options.signal?.throwIfAborted()
        revision ??= page.revision
        if (revision !== page.revision)
            throw new Error("History revision changed; restart the scan.")
        if (
            page.items.some(
                (record) =>
                    BigInt(record.revision) > BigInt(page.revision) ||
                    (options.gameId !== undefined &&
                        record.gameId !== options.gameId)
            )
        )
            throw new Error("Invalid history revision.")
        lastCollectedAt = page.lastCollectedAt
        records.push(...page.items)
        cursor = page.nextCursor
        if (cursor === null)
            return {
                revision,
                lastCollectedAt,
                records,
                report: aggregateHistory(records, options.minMinutes),
            }
        if (seen.has(cursor)) throw new Error("Repeated history cursor.")
        seen.add(cursor)
    }
    throw new Error(
        "History scan incomplete: page budget exceeded. Narrow the period."
    )
}
