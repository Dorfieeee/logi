import { PARSER_VERSION } from "./league-constants"
import { z } from "zod"

export {
    CACHE_MS,
    LEASE_MS,
    MAX_RETRY_AFTER_MS,
    PARSER_VERSION,
} from "./league-constants"
const text = z.string().min(1).max(500)
const nullableText = text.nullable()
const timestamp = z.iso.datetime()
const count = z.number().int().nonnegative().nullable()
const choice = z.object({ teamCode: text, value: nullableText })
/**
 * Finishing places the League publishes for a completed fixture. Parser
 * pages use the verified Final placements layout
 * (see `src/infrastructure/wardogs-league/parse-results.ts`). Places may tie;
 * a team finishes at most once. Points are not stored: Logi derives them from
 * the published scoring rule (`scoring.ts`).
 */
export const leagueResultsSchema = z
    .object({
        placements: z
            .array(
                z.object({
                    place: z.number().int().min(1).max(20),
                    teamCode: text,
                })
            )
            .min(1)
            .max(20),
        /** The League's own "Confirmed" step is done; unconfirmed places may still change. */
        confirmed: z.boolean(),
    })
    .refine(
        (value) =>
            new Set(value.placements.map((entry) => entry.teamCode)).size ===
            value.placements.length,
        { message: "A team can finish only once." }
    )
export type LeagueResults = z.infer<typeof leagueResultsSchema>
export const leagueMatchSchema = z.object({
    id: text,
    sourceUrl: z.url(),
    parserVersion: z.literal(PARSER_VERSION),
    title: text,
    fixtureNumber: count,
    type: nullableText,
    status: nullableText,
    scheduledAt: timestamp.nullable(),
    request: z.object({ number: count, url: z.url() }).nullable(),
    teams: z
        .array(
            z.object({
                code: text,
                name: nullableText,
                profileUrl: z.url(),
                nations: z.array(text).max(30).nullable(),
                displayedMemberCount: count,
                faction: nullableText,
                readyCheck: nullableText,
            })
        )
        .max(20)
        .nullable(),
    map: z
        .object({
            name: nullableText,
            zone: nullableText,
            lighting: nullableText,
        })
        .nullable(),
    hosting: z
        .object({ mode: nullableText, teamCode: nullableText })
        .nullable(),
    moderator: nullableText,
    mapVote: z
        .object({
            status: nullableText,
            closesAt: timestamp.nullable(),
            ballots: z.array(choice).max(20).nullable(),
        })
        .nullable(),
    rules: z
        .object({
            summary: nullableText,
            choices: z.array(choice).max(20).nullable(),
        })
        .nullable(),
    readyCheck: nullableText,
    progress: z
        .array(
            z.object({
                label: text,
                state: z.enum(["done", "current", "not_started"]).nullable(),
                detail: nullableText,
            })
        )
        .max(30)
        .nullable(),
    scoringRule: nullableText,
    results: leagueResultsSchema.nullable(),
    warnings: z.array(text).max(100),
})
export type LeagueMatch = z.infer<typeof leagueMatchSchema>
export const leagueSnapshotSchema = leagueMatchSchema.extend({
    fetchedAt: timestamp,
})
export type LeagueSnapshot = z.infer<typeof leagueSnapshotSchema>
export const leagueErrorSchema = z.enum([
    "rate_limited",
    "timeout",
    "network",
    "http",
    "invalid_html",
    "unsafe_redirect",
    "too_large",
    "refresh_in_progress",
])
export type LeagueErrorCode = z.infer<typeof leagueErrorSchema>
export class LeagueError extends Error {
    constructor(
        public readonly code: LeagueErrorCode,
        public readonly retryAfterMs?: number
    ) {
        super(code)
    }
}
export const leagueReadSchema = z.object({
    snapshot: leagueSnapshotSchema.nullable(),
    stale: z.boolean(),
    ageSeconds: z.number().int().nonnegative().nullable(),
    lastAttemptAt: timestamp.nullable(),
    nextRefreshAt: timestamp,
    error: leagueErrorSchema.nullable(),
})
export type LeagueRead = z.infer<typeof leagueReadSchema>

/** Final pages deliberately omit pre-match sections and can publish fewer ranked teams. */
function hasVerifiedFinalPlacements(match: LeagueMatch): boolean {
    const finalStep =
        match.status === "Confirmed"
            ? "Confirmed"
            : match.status === "Set by admin"
              ? "Set by admin"
              : null
    const teams = match.teams
    const result = match.results
    if (
        !finalStep ||
        !teams?.length ||
        !result?.confirmed ||
        teams.length !== result.placements.length ||
        new Set(teams.map((team) => team.code)).size !== teams.length ||
        new Set(result.placements.map((entry) => entry.teamCode)).size !==
            teams.length ||
        teams.some(
            (team) =>
                team.profileUrl !==
                `https://wardogsleague.net/teams/${encodeURIComponent(team.code)}`
        ) ||
        result.placements.some(
            (entry) => !teams.some((team) => team.code === entry.teamCode)
        )
    )
        return false
    return ["Placements", finalStep].every((label) => {
        const steps = match.progress?.filter((step) => step.label === label)
        return steps?.length === 1 && steps[0].state === "done"
    })
}

/** Losing previously observed structure is a refresh failure, except a verified final layout. */
export function losesMatchStructure(previous: LeagueMatch, next: LeagueMatch) {
    if (
        previous.id !== next.id ||
        previous.sourceUrl !== next.sourceUrl ||
        (previous.scheduledAt !== null && next.scheduledAt === null) ||
        (previous.results !== null && next.results === null) ||
        (previous.results?.confirmed === true &&
            next.results?.confirmed !== true)
    )
        return true
    // The parser validates the explicit header/card count. Final cards replace
    // pre-match metadata; do not retain an absent participant or invent a winner.
    if (hasVerifiedFinalPlacements(next)) return false
    const lostFields = <T extends object>(before: T | null, after: T | null) =>
        before !== null &&
        (after === null ||
            (Object.keys(before) as Array<keyof T>).some(
                (key) => before[key] !== null && after[key] === null
            ))
    return (
        (
            [
                "scheduledAt",
                "teams",
                "map",
                "hosting",
                "mapVote",
                "rules",
                "progress",
                "results",
            ] as const
        ).some((field) => previous[field] !== null && next[field] === null) ||
        (previous.teams !== null &&
            next.teams !== null &&
            (next.teams.length < previous.teams.length ||
                previous.teams.some((team) => {
                    const updated = next.teams!.find(
                        (item) => item.code === team.code
                    )
                    return updated ? lostFields(team, updated) : false
                }))) ||
        lostFields(previous.map, next.map) ||
        lostFields(previous.hosting, next.hosting) ||
        lostFields(previous.mapVote, next.mapVote) ||
        lostFields(previous.rules, next.rules)
    )
}
