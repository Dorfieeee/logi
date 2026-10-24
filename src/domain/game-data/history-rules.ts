import type { ProviderSession } from "./contracts"
import { canonicalJson } from "./canonical-json"

/**
 * The rules of the retained Warcon history, as plain predicates. `history.ts`
 * builds its Zod schema on them for the website; the history commit, which
 * the collector cron runs every few seconds, checks them directly without
 * loading Zod (ARCHITECTURE.md, "Convex hot paths").
 */
const DIGEST = /^[a-f0-9]{64}$/
const ID = /^\d{1,20}$/

export type HistoryGame = "wardogs" | "hell_let_loose"

/** Old retained rows were exclusively Wardogs. */
export function retainedHistoryGame(row: {
    gameId?: HistoryGame
}): HistoryGame {
    return row.gameId ?? "wardogs"
}

/** Shared without importing the settings schema into collector hot paths. */
export function historyRetentionCutoff(
    settings: { retentionDays: number | null } | null | undefined,
    now: number
): string | null {
    if (!settings || settings.retentionDays === null) return null
    return new Date(now - settings.retentionDays * 86_400_000).toISOString()
}

/** CRCON completed maps carry faction scores, never Wardogs outcome metadata. */
export function isRetainedHllSession(session: ProviderSession): boolean {
    return (
        session.complete &&
        session.startedAt !== null &&
        session.endedAt !== null &&
        Number.isFinite(Date.parse(session.startedAt)) &&
        Number.isFinite(Date.parse(session.endedAt)) &&
        Date.parse(session.endedAt) >= Date.parse(session.startedAt) &&
        isHllHistoryFacts(session)
    )
}

/** Valid HLL facts can be collected before a provider supplies their start time. */
export function isHllHistoryFacts(session: ProviderSession): boolean {
    return (
        ID.test(session.externalId) &&
        session.warcon === undefined &&
        session.participants.length === 2 &&
        session.participants.some(
            (side) => side.id === "allied" && side.label === "Allies"
        ) &&
        session.participants.some(
            (side) => side.id === "axis" && side.label === "Axis"
        ) &&
        session.participants.every(
            (side) =>
                side.score === null ||
                (Number.isFinite(side.score) && side.score >= 0)
        ) &&
        new Set(
            session.players.map(
                (player) => `${player.platform}:${player.platformId}`
            )
        ).size === session.players.length &&
        session.players.every(
            (player) =>
                player.faction === undefined &&
                player.result === undefined &&
                Object.entries(player.metrics).every(
                    ([key, value]) =>
                        [
                            "kills",
                            "deaths",
                            "combat",
                            "offense",
                            "defense",
                            "support",
                        ].includes(key) &&
                        (value === null ||
                            (Number.isFinite(value) && value >= 0))
                )
        )
    )
}

/** A session that may be archived: complete, consistent times, unique players and factions, a winner the factions name. */
export function isRetainedWarconSession(session: ProviderSession): boolean {
    return (
        session.complete &&
        session.startedAt !== null &&
        session.endedAt !== null &&
        Date.parse(session.endedAt) >= Date.parse(session.startedAt) &&
        session.warcon !== undefined &&
        new Set(
            session.players.map(
                (player) => `${player.platform}:${player.platformId}`
            )
        ).size === session.players.length &&
        new Set(session.participants.map((faction) => faction.id)).size ===
            session.participants.length &&
        (session.warcon.winner === null ||
            session.participants.length === 0 ||
            session.participants.some(
                (faction) => faction.id === session.warcon!.winner
            ))
    )
}

/** The size limits `providerSessionSchema` puts on a collected session. */
export function isProviderSessionWithinLimits(
    session: ProviderSession
): boolean {
    return (
        session.externalId.length >= 1 &&
        session.externalId.length <= 100 &&
        DIGEST.test(session.sourceDigest) &&
        (session.map === null || session.map.length <= 200) &&
        session.participants.length <= 16 &&
        session.players.length <= 300 &&
        [session.startedAt, session.endedAt].every(
            (at) => at === null || Number.isFinite(Date.parse(at))
        )
    )
}

/** The page bookkeeping of a history run, within the ranges the collector may ask for. */
export function isHistoryProgress(progress: {
    page: number
    pendingIds: string[]
    nextPage: number | null
}): boolean {
    const page = (value: number) =>
        Number.isInteger(value) && value >= 1 && value <= 1_000_000
    return (
        page(progress.page) &&
        (progress.nextPage === null || page(progress.nextPage)) &&
        progress.pendingIds.length <= 50 &&
        progress.pendingIds.every((id) => ID.test(id))
    )
}

/**
 * How often a history run may rewrite a row that did not change, just to
 * record that it was seen (an unfinished session's `fetchedAt`, the
 * connection's `historyLastSuccessAt`). A walk commits once a second;
 * rewriting the row each time stored a new version per second
 * (ARCHITECTURE.md, "Convex hot paths"). A complete session that did not
 * change is never rewritten.
 */
export const HISTORY_TOUCH_INTERVAL_MS = 60_000

/**
 * How often the Warcon history head may record `lastCollectedAt` when its
 * revision did not change. The head is read as "data as of" by the history
 * API, the dashboard and Discord `/stats`; ten minutes is precise enough.
 */
export const HISTORY_HEAD_TOUCH_INTERVAL_MS = 10 * 60_000

/**
 * How often a history cycle re-reads every session of a server, so a
 * correction of an older game still arrives. The cycles in between stop at
 * the first page whose sessions are all stored complete.
 */
export const HISTORY_FULL_WALK_INTERVAL_MS = 24 * 60 * 60_000

/**
 * How many history steps (one session each) one cron tick of
 * `gameDataCollector:collectHistoryDue` may run, one claim at a time and
 * {@link HISTORY_STEP_PAUSE_MS} apart. The collector no longer schedules
 * itself between steps, so without this a tick would collect one session
 * and a daily full walk would hold back new games for days.
 */
export const HISTORY_STEPS_PER_TICK = 30

/** The pause between two steps of a tick; a walk's next step is due a second after its commit. */
export const HISTORY_STEP_PAUSE_MS = 1_100

/** Whether a seen-at time (ms or ISO string, or none) is old enough to record again. */
export function historyTouchDue(
    lastAt: number | string | null | undefined,
    now: number,
    intervalMs: number = HISTORY_TOUCH_INTERVAL_MS
): boolean {
    if (lastAt == null) return true
    const at = typeof lastAt === "number" ? lastAt : Date.parse(lastAt)
    return Number.isNaN(at) || now - at >= intervalMs
}

/** Whether the next history cycle must re-read every session (none yet, or the last one is a day old). */
export function historyFullWalkDue(
    lastFullWalkAt: number | null | undefined,
    now: number
): boolean {
    return historyTouchDue(lastFullWalkAt, now, HISTORY_FULL_WALK_INTERVAL_MS)
}

/** A session's own time for ordering: its start, else its end, else none. */
function sessionTime(session: {
    startedAt: string | null
    endedAt: string | null
}): number {
    const at = Date.parse(session.startedAt ?? session.endedAt ?? "")
    return Number.isNaN(at) ? Number.NEGATIVE_INFINITY : at
}

/** Orders sessions newest first by their own start (or end) time; sessions without a time go last. */
export function newestSessionFirst(
    left: { startedAt: string | null; endedAt: string | null },
    right: { startedAt: string | null; endedAt: string | null }
): number {
    const a = sessionTime(left),
        b = sessionTime(right)
    return a === b ? 0 : a > b ? -1 : 1
}

/**
 * Orders result-picker sessions by when they ended. A game that began long
 * ago but finished later belongs ahead of an older completed game; missing or
 * invalid end times intentionally fall to the end.
 */
export function newestEndedSessionFirst(
    left: { endedAt: string | null },
    right: { endedAt: string | null }
): number {
    const ended = (session: { endedAt: string | null }) => {
        const value = Date.parse(session.endedAt ?? "")
        return Number.isNaN(value) ? Number.NEGATIVE_INFINITY : value
    }
    const a = ended(left),
        b = ended(right)
    return a === b ? 0 : a > b ? -1 : 1
}

/** Whether a stored session row differs from a freshly collected one in what the row serves. */
export function sessionRecordChanged(
    stored: {
        session: ProviderSession
        complete: boolean
        sourceGeneration?: number
    },
    next: {
        session: ProviderSession
        complete: boolean
        sourceGeneration: number
    }
): boolean {
    return (
        canonicalJson(stored.session) !== canonicalJson(next.session) ||
        stored.complete !== next.complete ||
        stored.sourceGeneration !== next.sourceGeneration
    )
}
