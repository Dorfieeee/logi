import { LEAGUE_POINTS_RULE, parseScoringRule } from "./scoring"
import type { LeagueResultRecord } from "./results.schema"
import type { LeagueSnapshot } from "./contracts"

// `leagueResultRecordSchema` lives in `results.schema.ts`; its type is
// re-exported here for the builders below.
export type { LeagueResultRecord } from "./results.schema"

/** The League runs on Central European time; seasons and days follow Prague. */
export const LEAGUE_TIME_ZONE = "Europe/Prague"
/** "Poslední výsledky" covers placements from the last seven days (P6-20, P6-B08). */
export const RECENT_RESULT_DAYS = 7
/** Podium places shown in recent results. */
export const PODIUM_PLACES = 3

/** Season label of a moment: the calendar year in League time ("SEZÓNA 2026"). */
export function leagueSeason(iso: string, timeZone = LEAGUE_TIME_ZONE) {
    const date = new Date(iso)
    if (!Number.isFinite(date.getTime())) throw new Error("Invalid date.")
    return new Intl.DateTimeFormat("en-GB", {
        timeZone,
        year: "numeric",
    }).format(date)
}

/**
 * Builds the stored result of a snapshot that carries League placements.
 * Returns null while the League has published no supported placements.
 */
export function resultRecordFromSnapshot(
    snapshot: LeagueSnapshot,
    firstRecordedAt: string
): LeagueResultRecord | null {
    if (!snapshot.results) return null
    const published = parseScoringRule(snapshot.scoringRule)
    const occurredAt = snapshot.scheduledAt ?? firstRecordedAt
    const teams = new Map(
        (snapshot.teams ?? []).map((team) => [team.code, team])
    )
    // Built from a validated snapshot; the record is typed, not re-parsed.
    return {
        matchId: snapshot.id,
        sourceUrl: snapshot.sourceUrl,
        fixtureNumber: snapshot.fixtureNumber,
        type: snapshot.type,
        occurredAt,
        season: leagueSeason(occurredAt),
        pointsRule: [...(published ?? LEAGUE_POINTS_RULE)],
        pointsRuleSource: published ? "published" : "default",
        confirmed: snapshot.results.confirmed,
        placements: [...snapshot.results.placements]
            .sort(
                (a, b) =>
                    a.place - b.place || a.teamCode.localeCompare(b.teamCode)
            )
            .map((entry) => ({
                place: entry.place,
                teamCode: entry.teamCode,
                teamName: teams.get(entry.teamCode)?.name ?? null,
                faction: teams.get(entry.teamCode)?.faction ?? null,
            })),
    }
}

/** Whether two stored results would show the same thing (no table refresh needed). */
export function sameResult(a: LeagueResultRecord, b: LeagueResultRecord) {
    return JSON.stringify(a) === JSON.stringify(b)
}

export type RecentResult = Pick<
    LeagueResultRecord,
    "matchId" | "sourceUrl" | "fixtureNumber" | "type" | "occurredAt"
> & { podium: LeagueResultRecord["placements"] }

/**
 * Results from the last `days` days, newest first, keeping only places 1–3
 * (P6-18, P6-B08). Results dated in the future are left out.
 */
export function recentResults(
    records: readonly LeagueResultRecord[],
    now: number,
    days = RECENT_RESULT_DAYS
): RecentResult[] {
    const since = now - days * 86_400_000
    return records
        .filter((record) => {
            const at = Date.parse(record.occurredAt)
            return at >= since && at <= now
        })
        .sort(
            (a, b) =>
                Date.parse(b.occurredAt) - Date.parse(a.occurredAt) ||
                (b.fixtureNumber ?? -1) - (a.fixtureNumber ?? -1) ||
                a.matchId.localeCompare(b.matchId)
        )
        .map((record) => ({
            matchId: record.matchId,
            sourceUrl: record.sourceUrl,
            fixtureNumber: record.fixtureNumber,
            type: record.type,
            occurredAt: record.occurredAt,
            podium: record.placements.filter(
                (entry) => entry.place <= PODIUM_PLACES
            ),
        }))
}
