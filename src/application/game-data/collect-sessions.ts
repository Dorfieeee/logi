import {
    ProviderError,
    type ProviderKillEvent,
    type ProviderSession,
} from "../../domain/game-data/contracts"
export type HistoryProgress = {
    page: number
    pendingIds: string[]
    nextPage: number | null
}
export type HistoryCommit = {
    session: ProviderSession | null
    killEvents?: ProviderKillEvent[]
    progress: HistoryProgress
    completed: boolean
}
type Ports = {
    readPage(page: number): Promise<{ ids: string[]; nextPage: number | null }>
    /** Which of `ids` are already stored complete for the current source generation. */
    storedComplete(ids: string[]): Promise<string[]>
    readSession(
        id: string
    ): Promise<
        | ProviderSession
        | { session: ProviderSession; killEvents?: ProviderKillEvent[] }
    >
    commit(value: HistoryCommit): Promise<boolean>
}
const start = (): HistoryProgress => ({
    page: 1,
    pendingIds: [],
    nextPage: null,
})
/** A session the provider no longer serves (or serves malformed) is skipped so the
 * remaining history still arrives; transient provider failures keep retrying it. */
async function readOrSkip(id: string, ports: Ports) {
    try {
        const value = await ports.readSession(id)
        return "session" in value ? value : { session: value }
    } catch (error) {
        if (
            error instanceof ProviderError &&
            error.category === "invalid_response"
        )
            return null
        throw error
    }
}
/**
 * One step of a history cycle: reads a page when none is pending and
 * collects one session of it. A cycle starts at page 1 (the newest games).
 * An incremental cycle collects only the sessions that are new or not yet
 * stored complete, and ends at the first page that has none: everything
 * older was collected by an earlier cycle. A full walk (`fullWalk`, once a
 * day) re-reads every session to the last page, so a provider's correction
 * of an older game still arrives.
 */
export async function collectSessions(
    progress: HistoryProgress,
    ports: Ports,
    options: { fullWalk: boolean }
): Promise<"completed" | "continued" | "stale_fence"> {
    let page: { ids: string[]; nextPage: number | null }
    if (progress.pendingIds.length)
        page = { ids: progress.pendingIds, nextPage: progress.nextPage }
    else {
        const read = await ports.readPage(progress.page)
        const ids = [...new Set(read.ids)]
        if (options.fullWalk) page = { ids, nextPage: read.nextPage }
        else {
            const stored = new Set(
                ids.length ? await ports.storedComplete(ids) : []
            )
            const missing = ids.filter((id) => !stored.has(id))
            // Caught up: nothing on this page needs collecting.
            if (!missing.length)
                return (await ports.commit({
                    session: null,
                    progress: start(),
                    completed: true,
                }))
                    ? "completed"
                    : "stale_fence"
            page = { ids: missing, nextPage: read.nextPage }
        }
    }
    const [id, ...remaining] = [...new Set(page.ids)]
    const read = id ? await readOrSkip(id, ports) : null
    const completed = remaining.length === 0 && page.nextPage === null
    const next = completed
        ? start()
        : remaining.length
          ? {
                page: progress.page,
                pendingIds: remaining,
                nextPage: page.nextPage,
            }
          : { page: page.nextPage!, pendingIds: [], nextPage: null }
    if (
        !(await ports.commit({
            session: read?.session ?? null,
            ...(read?.killEvents === undefined
                ? {}
                : { killEvents: read.killEvents }),
            progress: next,
            completed,
        }))
    )
        return "stale_fence"
    return completed ? "completed" : "continued"
}
