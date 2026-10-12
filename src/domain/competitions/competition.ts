import {
    TEAM_NAME_MAX,
    teamGameSchema,
    teamIdSchema,
    teamNameSchema,
    type TeamGame,
} from "../teams/team"
import type { GameId } from "../games/game"
import { z } from "zod"

/**
 * Global competitions run by Logi's global administrators: one game, divisions,
 * registrations of global catalogue teams and fixtures between them. Formats are
 * fixed to league + playoff with ECL cap-score standings.
 */

export const COMPETITION_NAME_MAX = 120
export const COMPETITION_SEASON_MAX = 40
export const COMPETITION_DESCRIPTION_MAX = 1000
export const DIVISION_NAME_MAX = 80
/** Bounded collections per competition keep every read and write transaction small. */
export const COMPETITION_DIVISION_LIMIT = 50
export const COMPETITION_REGISTRATION_LIMIT = 500
export const COMPETITION_FIXTURE_LIMIT = 2000
export const FIXTURE_SCORE_MAX = 999
/** HLL fixtures have two teams; Wardogs may schedule a three-team game. */
export const FIXTURE_PARTICIPANT_MIN = 2
export const FIXTURE_PARTICIPANT_MAX = 3
/** Highest round number a fixture can carry ("1. kolo" … "99. kolo"). */
export const FIXTURE_ROUND_MAX = 99

export const FIXTURE_PHASES = ["league", "playoff", "relegation"] as const
export type FixturePhase = (typeof FIXTURE_PHASES)[number]
export const FIXTURE_STATUSES = ["scheduled", "final", "forfeit"] as const
export type FixtureStatus = (typeof FIXTURE_STATUSES)[number]

const FORBIDDEN = /[\p{Cc}\p{Zl}\p{Zp}]/u
const collapse = (value: unknown) =>
    typeof value === "string"
        ? value
              .normalize("NFKC")
              .trim()
              .replace(/[ \t]+/g, " ")
        : value
function labelSchema(max: number) {
    return z.preprocess(
        collapse,
        z
            .string()
            .min(1)
            .max(max)
            .refine((value) => !FORBIDDEN.test(value), {
                message: "Labels may not contain control characters.",
            })
    )
}

/** Lowercase URL segment used by the public pages and API. */
export const COMPETITION_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,63}$/
export const competitionSlugSchema = z
    .string()
    .trim()
    .regex(COMPETITION_SLUG_PATTERN)
export const competitionNameSchema = labelSchema(COMPETITION_NAME_MAX)
export const competitionSeasonSchema = labelSchema(COMPETITION_SEASON_MAX)
/** Free text; line breaks are allowed, other control characters are not. */
export const competitionDescriptionSchema = z.preprocess(
    (value) => (typeof value === "string" ? value.trim() : value),
    z
        .string()
        .min(1)
        .max(COMPETITION_DESCRIPTION_MAX)
        .refine((value) => !FORBIDDEN.test(value.replace(/\n/g, "")), {
            message: "Descriptions may not contain control characters.",
        })
)
export const divisionNameSchema = labelSchema(DIVISION_NAME_MAX)
/** Opaque record identifier (competition, division, registration, fixture, event). */
export const competitionRecordIdSchema = z.string().min(1).max(64)

/** New competitions start unpublished unless the administrator publishes them. */
export const competitionCreateSchema = z.strictObject({
    gameId: teamGameSchema,
    slug: competitionSlugSchema,
    name: competitionNameSchema,
    season: competitionSeasonSchema,
    description: competitionDescriptionSchema.nullable().default(null),
    published: z.boolean().default(false),
})
export type CompetitionCreateInput = z.infer<typeof competitionCreateSchema>

/** The game is fixed at creation: registrations and fixtures depend on it. */
export const competitionUpdateSchema = z
    .strictObject({
        slug: competitionSlugSchema.optional(),
        name: competitionNameSchema.optional(),
        season: competitionSeasonSchema.optional(),
        description: competitionDescriptionSchema.nullable().optional(),
        published: z.boolean().optional(),
    })
    .refine((value) => Object.values(value).some((v) => v !== undefined), {
        message: "An update must change at least one field.",
    })
export type CompetitionUpdateInput = z.infer<typeof competitionUpdateSchema>

export const divisionInputSchema = z.strictObject({ name: divisionNameSchema })
export type DivisionInput = z.infer<typeof divisionInputSchema>

/** The complete new order of a competition's divisions, first to last. */
export const divisionOrderSchema = z.strictObject({
    divisionIds: z
        .array(competitionRecordIdSchema)
        .min(1)
        .max(COMPETITION_DIVISION_LIMIT)
        .refine((ids) => new Set(ids).size === ids.length, {
            message: "Divisions may appear only once.",
        }),
})
export type DivisionOrderInput = z.infer<typeof divisionOrderSchema>

export const registrationCreateSchema = z.strictObject({
    teamId: teamIdSchema,
    divisionId: competitionRecordIdSchema,
})
export type RegistrationCreateInput = z.infer<typeof registrationCreateSchema>

/** Move to another division and/or withdraw or reinstate. */
export const registrationUpdateSchema = z
    .strictObject({
        divisionId: competitionRecordIdSchema.optional(),
        withdrawn: z.boolean().optional(),
    })
    .refine(
        (value) =>
            value.divisionId !== undefined || value.withdrawn !== undefined,
        { message: "An update must change at least one field." }
    )
export type RegistrationUpdateInput = z.infer<typeof registrationUpdateSchema>

const scoreSchema = z.number().int().min(0).max(FIXTURE_SCORE_MAX)
/** Optional round number; fixtures saved before rounds existed have none. */
export const fixtureRoundSchema = z.number().int().min(1).max(FIXTURE_ROUND_MAX)

/**
 * A complete fixture write (create or edit). Final and forfeit results need
 * both scores; a scheduled fixture never keeps a score. `round` is optional:
 * a number or `null` sets it, leaving it out keeps the stored round on an
 * edit (so callers that predate rounds never clear one).
 */
export const fixtureInputSchema = z
    .strictObject({
        divisionId: competitionRecordIdSchema,
        phase: z.enum(FIXTURE_PHASES),
        /** Ordered participating global teams.  The first two also populate
         * the legacy side fields while old dashboard clients are retired. */
        participantTeamIds: z
            .array(teamIdSchema)
            .min(FIXTURE_PARTICIPANT_MIN)
            .max(FIXTURE_PARTICIPANT_MAX)
            .optional(),
        sideATeamId: teamIdSchema,
        sideBTeamId: teamIdSchema,
        scheduledAt: z.iso.datetime({ offset: true }).nullable().default(null),
        status: z.enum(FIXTURE_STATUSES),
        scoreA: scoreSchema.nullable().default(null),
        scoreB: scoreSchema.nullable().default(null),
        /** Scores in the same order as `participantTeamIds`; required for a
         * completed three-team fixture. */
        participantScores: z
            .array(scoreSchema.nullable())
            .min(FIXTURE_PARTICIPANT_MIN)
            .max(FIXTURE_PARTICIPANT_MAX)
            .optional(),
        round: fixtureRoundSchema.nullable().optional(),
    })
    .superRefine((value, ctx) => {
        const teams = value.participantTeamIds ?? [
            value.sideATeamId,
            value.sideBTeamId,
        ]
        if (new Set(teams).size !== teams.length)
            ctx.addIssue({
                code: "custom",
                path: ["participantTeamIds"],
                message: "A fixture may not contain the same team twice.",
            })
        if (teams[0] !== value.sideATeamId || teams[1] !== value.sideBTeamId)
            ctx.addIssue({
                code: "custom",
                path: ["participantTeamIds"],
                message: "The first two participants must match sides A and B.",
            })
        if (
            value.status !== "scheduled" &&
            (value.scoreA === null || value.scoreB === null)
        )
            ctx.addIssue({
                code: "custom",
                path: ["scoreA"],
                message: "Final and forfeit results need both scores.",
            })
    })
    .transform((value) =>
        value.status === "scheduled"
            ? (() => {
                  const { participantScores: _participantScores, ...rest } =
                      value
                  return { ...rest, scoreA: null, scoreB: null }
              })()
            : value
    )
export type FixtureInput = z.output<typeof fixtureInputSchema>

/** Links a fixture to a native Logi match event, or unlinks it with `null`. */
export const fixtureEventLinkSchema = z.strictObject({
    eventId: competitionRecordIdSchema.nullable(),
})
export type FixtureEventLinkInput = z.infer<typeof fixtureEventLinkSchema>

export type CompetitionCommandError =
    | "invalid_competition"
    | "not_found"
    | "duplicate_slug"
    | "duplicate_division"
    | "division_not_found"
    | "division_not_empty"
    | "invalid_order"
    | "limit_reached"
    | "team_not_found"
    | "team_archived"
    | "team_game_mismatch"
    | "already_registered"
    | "registration_has_fixtures"
    | "team_not_registered"
    | "division_mismatch"
    | "event_not_found"
    | "event_not_match"
    | "event_game_mismatch"
    | "event_already_linked"
    | "event_team_mismatch"
    | "migration_pending"

/** Competitions without the flag predate it and stay public. */
export function isCompetitionPublished(competition: {
    published?: boolean
}): boolean {
    return competition.published !== false
}

/** Division names are unique within a competition, ignoring case and spacing. */
export function normalizeDivisionName(name: string): string {
    return name.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase()
}

export function checkDivisionName(input: {
    name: string
    divisionId?: string
    divisions: ReadonlyArray<{ id: string; name: string }>
}): CompetitionCommandError | null {
    const wanted = normalizeDivisionName(input.name)
    return input.divisions.some(
        (division) =>
            division.id !== input.divisionId &&
            normalizeDivisionName(division.name) === wanted
    )
        ? "duplicate_division"
        : null
}

/** A division can be deleted only when no registration or fixture uses it. */
export function checkDivisionDelete(input: {
    registrations: number
    fixtures: number
}): CompetitionCommandError | null {
    return input.registrations > 0 || input.fixtures > 0
        ? "division_not_empty"
        : null
}

/** The requested order must name every current division exactly once. */
export function checkDivisionOrder(input: {
    current: readonly string[]
    requested: readonly string[]
}): CompetitionCommandError | null {
    const current = new Set(input.current)
    return input.requested.length === current.size &&
        new Set(input.requested).size === input.requested.length &&
        input.requested.every((id) => current.has(id))
        ? null
        : "invalid_order"
}

/** Catalogue facts the registration rules need about a team. */
export type CompetitionTeamFacts = {
    gameId: TeamGame
    archivedAt: string | null
    mergedIntoTeamId: string | null
}

/** A new registration: an active team of the competition's game, once, into an existing division. */
export function checkRegistration(input: {
    gameId: string
    team: CompetitionTeamFacts | null
    divisionExists: boolean
    alreadyRegistered: boolean
    registrations: number
}): CompetitionCommandError | null {
    if (!input.team) return "team_not_found"
    if (input.team.mergedIntoTeamId || input.team.archivedAt)
        return "team_archived"
    if (input.team.gameId !== input.gameId) return "team_game_mismatch"
    if (!input.divisionExists) return "division_not_found"
    if (input.alreadyRegistered) return "already_registered"
    if (input.registrations >= COMPETITION_REGISTRATION_LIMIT)
        return "limit_reached"
    return null
}

/**
 * Moving a registration keeps standings consistent: a team with league
 * fixtures in its current division must keep that division.
 */
export function checkRegistrationUpdate(input: {
    registration: { divisionId: string | null }
    input: RegistrationUpdateInput
    divisionExists: boolean
    leagueFixturesInCurrentDivision: number
}): CompetitionCommandError | null {
    const target = input.input.divisionId
    if (target === undefined || target === input.registration.divisionId)
        return null
    if (!input.divisionExists) return "division_not_found"
    if (input.leagueFixturesInCurrentDivision > 0)
        return "registration_has_fixtures"
    return null
}

/** A registration is removed only while no fixture references the team. */
export function checkRegistrationRemoval(input: {
    fixtures: number
}): CompetitionCommandError | null {
    return input.fixtures > 0 ? "registration_has_fixtures" : null
}

/** What fixture rules need to know about a registered team. */
export type RegisteredTeam = {
    divisionId: string | null
    gameId: string | null
}

/**
 * Both sides must be registered teams of the competition's game. League
 * fixtures are played inside one division, so both teams must be registered
 * in it; playoff and relegation fixtures may cross divisions.
 */
export function checkFixture(input: {
    gameId: string
    fixture: FixtureInput
    divisionIds: ReadonlySet<string>
    registrations: ReadonlyMap<string, RegisteredTeam>
}): CompetitionCommandError | null {
    if (!input.divisionIds.has(input.fixture.divisionId))
        return "division_not_found"
    const teams = input.fixture.participantTeamIds ?? [
        input.fixture.sideATeamId,
        input.fixture.sideBTeamId,
    ]
    if (input.gameId !== "wardogs" && teams.length !== 2)
        return "invalid_competition"
    const sides = teams.map((teamId) => input.registrations.get(teamId))
    if (sides.some((side) => !side)) return "team_not_registered"
    if (sides.some((side) => side!.gameId !== input.gameId))
        return "team_game_mismatch"
    if (
        input.fixture.phase === "league" &&
        sides.some((side) => side!.divisionId !== input.fixture.divisionId)
    )
        return "division_mismatch"
    return null
}

/** Event facts for linking; team IDs are the event's assigned match teams (merges resolved). */
export type LinkableEvent = {
    kind: "match" | "training"
    gameId: string
    competitionFixtureId: string | null
    teamIds: readonly string[]
}

/**
 * A fixture links to one non-training match event of the same game that no
 * other fixture uses. A participating clan may keep a local event containing
 * only its own team, so assigned event teams must be a non-empty subset of
 * the fixture participants rather than a copy of the whole fixture.
 */
export function checkEventLink(input: {
    gameId: string
    fixtureId: string
    fixtureTeamIds: readonly string[]
    event: LinkableEvent | null
    /** Another fixture already pointing at this event, if any. */
    otherFixtureId: string | null
}): CompetitionCommandError | null {
    if (!input.event) return "event_not_found"
    if (input.event.kind !== "match") return "event_not_match"
    if (input.event.gameId !== input.gameId) return "event_game_mismatch"
    if (
        (input.event.competitionFixtureId &&
            input.event.competitionFixtureId !== input.fixtureId) ||
        (input.otherFixtureId && input.otherFixtureId !== input.fixtureId)
    )
        return "event_already_linked"
    if (
        input.event.teamIds.length > 0 &&
        (!input.event.teamIds.some((teamId) =>
            input.fixtureTeamIds.includes(teamId)
        ) ||
            input.event.teamIds.some(
                (teamId) => !input.fixtureTeamIds.includes(teamId)
            ))
    )
        return "event_team_mismatch"
    return null
}

/** Stable public identifier for a not-yet-migrated legacy workspace reference. */
export function legacyTeamKey(guildId: string): string {
    return `guild:${guildId}`
}

/**
 * The catalogue name a legacy workspace reference becomes: the stored name
 * when it is a valid team name, otherwise a cleaned and bounded version of it,
 * otherwise `fallback`.
 */
export function adoptedTeamName(name: string, fallback: string): string {
    const parsed = teamNameSchema.safeParse(name)
    if (parsed.success) return parsed.data
    const cleaned = [
        ...name
            .normalize("NFKC")
            .replace(/[\p{Cc}\p{Zl}\p{Zp}]/gu, " ")
            .replace(/\s+/g, " ")
            .trim(),
    ]
        .slice(0, TEAM_NAME_MAX)
        .join("")
        .trim()
    return cleaned || fallback
}

export type PublicCompetitionTeam = {
    /** Global catalogue team ID, or `guild:<id>` for a row awaiting migration. */
    id: string
    name: string
    shortCode: string | null
    logoUrl: string | null
    withdrawn: boolean
}
export type PublicCompetitionFixture = {
    id: string
    phase: FixturePhase
    teamAId: string
    teamBId: string
    /** All fixture teams in score/placement order.  Missing on old rows means
     * the two legacy side IDs. */
    participantTeamIds?: string[]
    scoreA?: number
    scoreB?: number
    participantScores?: Array<number | null>
    status: FixtureStatus
    scheduledAt?: string
    /** Round number within the phase; missing on fixtures saved before rounds. */
    round?: number
    eventId?: string
}
/** Public pages and `GET /api/v1/public/competitions/{slug}`; published competitions only. */
export type PublicCompetition = {
    id: string
    gameId: GameId
    slug: string
    name: string
    season: string
    description: string | null
    divisions: Array<{
        id: string
        name: string
        teams: PublicCompetitionTeam[]
        fixtures: PublicCompetitionFixture[]
    }>
}

/** One team's side in a native match event, by every ID it is known under (merges followed). */
export type EventTeamSide = { teamIds: readonly string[]; side: string | null }

/**
 * The fixture score from an imported Hell Let Loose result. The import lists
 * Axis as `sideA` and Allies as `sideB`, while fixture sides follow the
 * administrator's order, so each fixture team takes the score of the side it
 * was assigned in the event. Without a known Axis/Allies side for both teams
 * nothing is filled in rather than guessing.
 */
export function fixtureScoreFromEvent(input: {
    fixture: { sideATeamId: string; sideBTeamId: string }
    eventTeams: readonly EventTeamSide[]
    score: { sideA: number; sideB: number }
}): { scoreA: number; scoreB: number } | null {
    const sideOf = (teamId: string) =>
        input.eventTeams.find((team) => team.teamIds.includes(teamId))?.side ??
        null
    const scoreOf = (side: string | null) =>
        side === "Axis"
            ? input.score.sideA
            : side === "Allies"
              ? input.score.sideB
              : null
    const sideA = sideOf(input.fixture.sideATeamId)
    const sideB = sideOf(input.fixture.sideBTeamId)
    const scoreA = scoreOf(sideA)
    const scoreB = scoreOf(sideB)
    return sideA !== sideB && scoreA !== null && scoreB !== null
        ? { scoreA, scoreB }
        : null
}
