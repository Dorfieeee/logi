import {
    checkDivisionDelete,
    checkDivisionName,
    checkDivisionOrder,
    checkEventLink,
    checkFixture,
    checkRegistration,
    checkRegistrationRemoval,
    checkRegistrationUpdate,
    COMPETITION_DIVISION_LIMIT,
    COMPETITION_FIXTURE_LIMIT,
    COMPETITION_REGISTRATION_LIMIT,
    competitionCreateSchema,
    competitionUpdateSchema,
    divisionInputSchema,
    divisionOrderSchema,
    fixtureEventLinkSchema,
    fixtureInputSchema,
    isCompetitionPublished,
    legacyTeamKey,
    registrationCreateSchema,
    registrationUpdateSchema,
    type CompetitionCommandError,
    type FixtureInput,
    type PublicCompetition,
    type RegisteredTeam,
    type EventTeamSide,
} from "../src/domain/competitions/competition"
import type {
    CompetitionAdminView,
    CompetitionListItem,
    CompetitionSummary,
    CompetitionTeamView,
    FixtureEventCandidate,
} from "../src/domain/competitions/admin-view"
import {
    ConvexTeamDirectoryRepository,
    currentTeam,
    teamById,
} from "../src/infrastructure/convex/team-directory-repositories"
import { adoptCatalogueTeam } from "../src/application/competitions/adopt-catalogue-team.use-case"
import { query, type MutationCtx, type QueryCtx } from "./_generated/server"
import { dashboardActor, type DashboardActor } from "./dashboardActor"
import { getGuildByDiscordId, getGuildDiscordId } from "./identity"
import { resolveGameScope } from "../src/domain/games/game"
import { authorizePlatformAdmin } from "./platformAdmin"
import { assertInternalSecret } from "./discord_shared"
import type { Doc, Id } from "./_generated/dataModel"
import { assetPublicUrl } from "./imageAssetStore"
import { mutation } from "./integrationMutation"
import { v } from "convex/values"

/** Global-administrator access: superadmin attestation checked in the same transaction. */
const platformAccess = { secret: v.string(), actor: dashboardActor }
type Db = Pick<QueryCtx, "db">
type Failure = { error: CompetitionCommandError }
const fail = (error: CompetitionCommandError): Failure => ({ error })
const NOW = () => new Date().toISOString()
const FORMAT = {
    kind: "league_with_playoffs",
    standings: "ecl_cap_score",
} as const
const UNKNOWN_TEAM = "Unknown team"

const ECL_SLUG = "ecl-2026"
const ECL_DIVISIONS = [
    [
        "Division 1",
        ["Greyhounds", "Omen", "The Circle", "Wolves of War", "Bober Kurwa"],
    ],
    ["Division 2", ["82AD", "HaiiTeD", "Kebaguettes & Bayonets", "Yoko"]],
    ["Division 3", ["404", "Finns Let Loose", "Valkyria", "ËJiG"]],
    ["Division 4", ["Black Bees", "Overlord", "PZJR", "We Are Ready"]],
    [
        "Division 5",
        [
            "Betrunkenedonnerbalkenbesitzer",
            "Hell´s Trident",
            "Luftwaffen-Jäger-Regiment 46",
            "Oktogon",
            "Special Beer Delivery",
        ],
    ],
    [
        "Division 6",
        [
            "February Division",
            "MIB33",
            "No Tomorrow",
            "Panzerbrigade",
            "United Teams Coalition",
        ],
    ],
] as const
const ECL_WITHDRAWN = new Set<string>(["Bober Kurwa"])

/* ------------------------------------------------------------------ reads */

async function competitionBySlug(ctx: Db, slug: string) {
    return await ctx.db
        .query("competitions")
        .withIndex("slug", (q) => q.eq("slug", slug))
        .first()
}
async function competitionById(ctx: Db, competitionId: string) {
    const id = ctx.db.normalizeId("competitions", competitionId)
    return id ? await ctx.db.get(id) : null
}
async function rowById<
    T extends
        "competitionDivisions" | "competitionTeams" | "competitionFixtures",
>(ctx: Db, table: T, id: string): Promise<Doc<T> | null> {
    const normalized = ctx.db.normalizeId(table, id)
    return normalized ? await ctx.db.get(normalized) : null
}

type Parts = {
    divisions: Doc<"competitionDivisions">[]
    registrations: Doc<"competitionTeams">[]
    fixtures: Doc<"competitionFixtures">[]
}
/** Every division, registration and fixture of one competition (bounded). */
async function competitionParts(
    ctx: Db,
    competitionId: Id<"competitions">
): Promise<Parts> {
    const [divisions, registrations, fixtures] = await Promise.all([
        ctx.db
            .query("competitionDivisions")
            .withIndex("competitionId", (q) =>
                q.eq("competitionId", competitionId)
            )
            .take(COMPETITION_DIVISION_LIMIT + 1),
        ctx.db
            .query("competitionTeams")
            .withIndex("competitionId", (q) =>
                q.eq("competitionId", competitionId)
            )
            .take(COMPETITION_REGISTRATION_LIMIT + 1),
        ctx.db
            .query("competitionFixtures")
            .withIndex("competitionId", (q) =>
                q.eq("competitionId", competitionId)
            )
            .take(COMPETITION_FIXTURE_LIMIT + 1),
    ])
    return {
        divisions: divisions.sort((a, b) => a.order - b.order),
        registrations,
        fixtures,
    }
}

/** A side of a fixture or a registration: the global team, or its legacy workspace key. */
function registrationKey(row: Doc<"competitionTeams">): string {
    if (row.teamId) return String(row.teamId)
    return row.guildId ? legacyTeamKey(String(row.guildId)) : String(row._id)
}
function fixtureSides(row: Doc<"competitionFixtures">): [string, string] {
    const side = (
        teamId: Id<"teamDirectory"> | undefined,
        guildId: Id<"guilds"> | undefined
    ) =>
        teamId
            ? String(teamId)
            : guildId
              ? legacyTeamKey(String(guildId))
              : UNKNOWN_TEAM
    return [
        side(row.sideATeamId, row.teamAId),
        side(row.sideBTeamId, row.teamBId),
    ]
}
/** Global teams in their fixture/result order, with legacy rows projected as
 * their two historical sides. */
function fixtureParticipants(row: Doc<"competitionFixtures">): string[] {
    if (row.participantTeamIds?.length)
        return row.participantTeamIds.map(String)
    return fixtureSides(row)
}
function fixtureEventIds(row: Doc<"competitionFixtures">): Id<"events">[] {
    return row.eventIds?.length
        ? row.eventIds
        : row.eventId
          ? [row.eventId]
          : []
}
function involves(
    fixture: Doc<"competitionFixtures">,
    registration: Doc<"competitionTeams">
) {
    return fixtureSides(fixture).includes(registrationKey(registration))
}
function isLegacyRegistration(row: Doc<"competitionTeams">) {
    return !row.teamId
}
function isLegacyFixture(row: Doc<"competitionFixtures">) {
    return !row.sideATeamId || !row.sideBTeamId
}

/** Resolves global teams and legacy workspace references once per read. */
function teamViews(ctx: Db) {
    const cache = new Map<string, Promise<CompetitionTeamView>>()
    async function load(key: string): Promise<CompetitionTeamView> {
        if (key.startsWith("guild:")) {
            const id = ctx.db.normalizeId("guilds", key.slice("guild:".length))
            const guild = id ? await ctx.db.get(id) : null
            return {
                id: key,
                name: guild?.name || UNKNOWN_TEAM,
                shortCode: null,
                logoUrl: null,
                archived: false,
                legacy: true,
            }
        }
        const team = await teamById(ctx, key)
        return {
            id: key,
            name: team?.name ?? UNKNOWN_TEAM,
            shortCode: team?.shortCode ?? null,
            logoUrl: team ? await assetPublicUrl(ctx, team.logoAssetId) : null,
            archived: Boolean(team?.archivedAt || team?.mergedIntoTeamId),
            legacy: false,
        }
    }
    return (key: string) => {
        let view = cache.get(key)
        if (!view) cache.set(key, (view = load(key)))
        return view
    }
}

/** Public competition by slug; unpublished competitions read as absent. */
export const getPublic = query({
    args: { secret: v.string(), slug: v.string() },
    handler: async (ctx, args): Promise<PublicCompetition | null> => {
        assertInternalSecret(args.secret)
        const competition = await competitionBySlug(ctx, args.slug)
        if (!competition || !isCompetitionPublished(competition)) return null
        const { divisions, registrations, fixtures } = await competitionParts(
            ctx,
            competition._id
        )
        const view = teamViews(ctx)
        return {
            id: String(competition._id),
            gameId: resolveGameScope(competition.gameId),
            slug: competition.slug,
            name: competition.name,
            season: competition.season,
            description: competition.description ?? null,
            divisions: await Promise.all(
                divisions.map(async (division) => ({
                    id: String(division._id),
                    name: division.name,
                    teams: await Promise.all(
                        registrations
                            .filter((row) => row.divisionId === division._id)
                            .map(async (row) => {
                                const team = await view(registrationKey(row))
                                return {
                                    id: team.id,
                                    name: team.name,
                                    shortCode: team.shortCode,
                                    logoUrl: team.logoUrl,
                                    withdrawn: row.withdrawn,
                                }
                            })
                    ),
                    fixtures: fixtures
                        .filter((row) => row.divisionId === division._id)
                        .map((row) => {
                            const [teamAId, teamBId] = fixtureSides(row)
                            return {
                                id: String(row._id),
                                phase: row.phase,
                                teamAId,
                                teamBId,
                                participantTeamIds: fixtureParticipants(row),
                                scoreA: row.scoreA,
                                scoreB: row.scoreB,
                                participantScores: row.participantScores,
                                status: row.status,
                                scheduledAt: row.scheduledAt,
                                // Optional: fixtures saved before rounds have none.
                                round: row.round,
                                eventId: row.eventId
                                    ? String(row.eventId)
                                    : undefined,
                            }
                        }),
                }))
            ),
        }
    },
})

/** Slugs of published competitions, for the public listing. */
export const listPublicSlugs = query({
    args: { secret: v.string() },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        return (await ctx.db.query("competitions").take(200))
            .filter(isCompetitionPublished)
            .map((competition) => competition.slug)
    },
})

/** How many of a clan's newest events the fixture labels read at most. */
const CLAN_FIXTURE_SCAN_LIMIT = 400

/**
 * Which published competition each of a clan's matches is played in, for the
 * detail line of the dashboard match list. Reads the clan's newest events
 * through the guild index, bounded; a fixture counts only when it links back
 * to the same event. Unpublished competitions are left out.
 */
export const listClanFixtureLabels = query({
    args: { secret: v.string(), guildId: v.string() },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const events = await ctx.db
            .query("events")
            .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
            .order("desc")
            .take(CLAN_FIXTURE_SCAN_LIMIT)
        const competitions = new Map<
            string,
            Promise<Doc<"competitions"> | null>
        >()
        const labels = await Promise.all(
            events.map(async (event) => {
                if (
                    !event.competitionFixtureId ||
                    event.guildId !== args.guildId ||
                    event.isDraft ||
                    (event.kind ?? "match") !== "match"
                )
                    return null
                const fixture = await ctx.db.get(event.competitionFixtureId)
                if (!fixture || !fixtureEventIds(fixture).includes(event._id))
                    return null
                const key = String(fixture.competitionId)
                if (!competitions.has(key))
                    competitions.set(key, ctx.db.get(fixture.competitionId))
                const competition = await competitions.get(key)
                if (!competition || !isCompetitionPublished(competition))
                    return null
                return {
                    eventId: String(event._id),
                    name: competition.name,
                    season: competition.season,
                    phase: fixture.phase,
                }
            })
        )
        return labels.filter((label) => label !== null)
    },
})

function summaryOf(competition: Doc<"competitions">): CompetitionSummary {
    return {
        id: String(competition._id),
        gameId: resolveGameScope(competition.gameId),
        slug: competition.slug,
        name: competition.name,
        season: competition.season,
        description: competition.description ?? null,
        published: isCompetitionPublished(competition),
        createdAt: competition.createdAt,
        updatedAt: competition.updatedAt,
    }
}

/** Global administration: every competition, published or not, with record counts. */
export const adminList = query({
    args: platformAccess,
    handler: async (ctx, args): Promise<CompetitionListItem[]> => {
        await authorizePlatformAdmin(ctx, args)
        const competitions = await ctx.db.query("competitions").take(200)
        return await Promise.all(
            competitions
                .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
                .map(async (competition) => {
                    const parts = await competitionParts(ctx, competition._id)
                    return {
                        ...summaryOf(competition),
                        divisions: parts.divisions.length,
                        registrations: parts.registrations.length,
                        fixtures: parts.fixtures.length,
                        legacyRows:
                            parts.registrations.filter(isLegacyRegistration)
                                .length +
                            parts.fixtures.filter(isLegacyFixture).length,
                    }
                })
        )
    },
})

/** One competition with its divisions, registrations and fixtures for management. */
export const adminGet = query({
    args: { ...platformAccess, competitionId: v.string() },
    handler: async (ctx, args): Promise<CompetitionAdminView | null> => {
        await authorizePlatformAdmin(ctx, args)
        const competition = await competitionById(ctx, args.competitionId)
        if (!competition) return null
        const { divisions, registrations, fixtures } = await competitionParts(
            ctx,
            competition._id
        )
        const view = teamViews(ctx)
        return {
            competition: summaryOf(competition),
            divisions: divisions.map((division) => ({
                id: String(division._id),
                name: division.name,
                order: division.order,
            })),
            registrations: await Promise.all(
                registrations.map(async (row) => ({
                    id: String(row._id),
                    divisionId: row.divisionId ? String(row.divisionId) : null,
                    withdrawn: row.withdrawn,
                    team: await view(registrationKey(row)),
                }))
            ),
            fixtures: await Promise.all(
                fixtures
                    .sort((a, b) =>
                        (a.scheduledAt ?? a.createdAt).localeCompare(
                            b.scheduledAt ?? b.createdAt
                        )
                    )
                    .map(async (row) => {
                        const [sideA, sideB] = fixtureSides(row)
                        const events = await Promise.all(
                            fixtureEventIds(row).map((eventId) =>
                                ctx.db.get(eventId)
                            )
                        )
                        const event = events.find(Boolean) ?? null
                        const workspace = event
                            ? await getGuildByDiscordId(ctx, event.guildId)
                            : null
                        return {
                            id: String(row._id),
                            divisionId: row.divisionId
                                ? String(row.divisionId)
                                : null,
                            phase: row.phase,
                            round: row.round ?? null,
                            sideA: await view(sideA),
                            sideB: await view(sideB),
                            participants: await Promise.all(
                                fixtureParticipants(row).map(view)
                            ),
                            scheduledAt: row.scheduledAt ?? null,
                            scoreA: row.scoreA ?? null,
                            scoreB: row.scoreB ?? null,
                            participantScores: row.participantScores ?? null,
                            resultConflict: row.resultConflict === true,
                            status: row.status,
                            event: event
                                ? {
                                      id: String(event._id),
                                      name: event.name,
                                      gameStart: event.gameStart,
                                      workspace: workspace?.name ?? null,
                                      hasResult: Boolean(event.eventResult),
                                      reviewed: Boolean(event.reviewedResult),
                                  }
                                : null,
                            events: await Promise.all(
                                events.filter(Boolean).map(async (item) => {
                                    const event = item!
                                    const guild = await getGuildByDiscordId(
                                        ctx,
                                        event.guildId
                                    )
                                    return {
                                        id: String(event._id),
                                        name: event.name,
                                        gameStart: event.gameStart,
                                        workspace: guild?.name ?? null,
                                        hasResult: Boolean(event.eventResult),
                                        reviewed: Boolean(event.reviewedResult),
                                    }
                                })
                            ),
                        }
                    })
            ),
            legacyRows:
                registrations.filter(isLegacyRegistration).length +
                fixtures.filter(isLegacyFixture).length,
        }
    },
})

/** The global team IDs an event's match-team assignments currently stand for (merges followed). */
/** Each assigned team's side, under its assigned ID and its current (merged-into) ID. */
export async function eventTeamSides(
    ctx: Db,
    event: Doc<"events">
): Promise<EventTeamSide[]> {
    const sides: EventTeamSide[] = []
    for (const assignment of event.matchTeams ?? []) {
        const current = await currentTeam(ctx, assignment.teamId)
        sides.push({
            teamIds: current
                ? [assignment.teamId, String(current._id)]
                : [assignment.teamId],
            side: assignment.side,
        })
    }
    return sides
}

async function eventTeamIds(ctx: Db, event: Doc<"events">): Promise<string[]> {
    const ids = new Set<string>()
    for (const assignment of event.matchTeams ?? []) {
        ids.add(assignment.teamId)
        const current = await currentTeam(ctx, assignment.teamId)
        if (current) ids.add(String(current._id))
    }
    return [...ids]
}

/**
 * Native match events a fixture could link to: recent matches of the
 * competition's game in the workspaces linked to either fixture team.
 */
export const linkCandidates = query({
    args: { ...platformAccess, fixtureId: v.string() },
    handler: async (ctx, args): Promise<FixtureEventCandidate[]> => {
        await authorizePlatformAdmin(ctx, args)
        const fixture = await rowById(
            ctx,
            "competitionFixtures",
            args.fixtureId
        )
        const competition = fixture
            ? await ctx.db.get(fixture.competitionId)
            : null
        if (!fixture || !competition) return []
        const gameId = resolveGameScope(competition.gameId)
        const sides = [fixture.sideATeamId, fixture.sideBTeamId].filter(
            (id): id is Id<"teamDirectory"> => Boolean(id)
        )
        const candidates = new Map<string, FixtureEventCandidate>()
        for (const teamId of sides) {
            const team = await ctx.db.get(teamId)
            const guild = team?.linkedGuildId
                ? await getGuildByDiscordId(ctx, team.linkedGuildId)
                : null
            if (!guild) continue
            const keys = new Set(
                [getGuildDiscordId(guild), String(guild._id), guild.id].filter(
                    (key): key is string => Boolean(key)
                )
            )
            for (const key of keys) {
                const events = await ctx.db
                    .query("events")
                    .withIndex("guildId", (q) => q.eq("guildId", key))
                    .order("desc")
                    .take(100)
                for (const event of events) {
                    if (
                        candidates.has(String(event._id)) ||
                        event.isDraft === true ||
                        event.kind === "training" ||
                        resolveGameScope(event.gameId) !== gameId ||
                        (event.competitionFixtureId &&
                            event.competitionFixtureId !== fixture._id)
                    )
                        continue
                    const teamIds = await eventTeamIds(ctx, event)
                    candidates.set(String(event._id), {
                        id: String(event._id),
                        name: event.name,
                        gameStart: event.gameStart,
                        workspace: guild.name,
                        teamsMatch: sides.every((id) =>
                            teamIds.includes(String(id))
                        ),
                        hasResult: Boolean(event.eventResult),
                    })
                }
            }
        }
        return (
            [...candidates.values()]
                .sort((a, b) => b.gameStart.localeCompare(a.gameStart))
                // Managers explicitly choose a source/link; a short ranked list
                // is useful while preventing an accidental broad event browser.
                .slice(0, 10)
        )
    },
})

/* ----------------------------------------------------------------- writes */

/** Authorizes the global administrator in the write's own transaction. */
async function admin(
    ctx: MutationCtx,
    args: { secret: string; actor: DashboardActor }
) {
    return (await authorizePlatformAdmin(ctx, args)).session.subject
}
async function touch(ctx: MutationCtx, competition: Doc<"competitions">) {
    await ctx.db.patch(competition._id, { updatedAt: NOW() })
}
type Ok<T extends object = object> = { ok: true; slug: string } & T
function ok<T extends object>(
    competition: Doc<"competitions">,
    extra: T
): Ok<T> {
    return { ok: true, slug: competition.slug, ...extra }
}

/** Creates a competition; new competitions are unpublished unless requested. */
export const create = mutation({
    args: { ...platformAccess, input: v.any() },
    handler: async (
        ctx,
        args
    ): Promise<Ok<{ competitionId: string }> | Failure> => {
        await admin(ctx, args)
        const parsed = competitionCreateSchema.safeParse(args.input)
        if (!parsed.success) return fail("invalid_competition")
        const input = parsed.data
        if (await competitionBySlug(ctx, input.slug))
            return fail("duplicate_slug")
        const now = NOW()
        const id = await ctx.db.insert("competitions", {
            gameId: input.gameId,
            slug: input.slug,
            name: input.name,
            season: input.season,
            description: input.description ?? undefined,
            format: FORMAT,
            published: input.published,
            createdAt: now,
            updatedAt: now,
        })
        return { ok: true, slug: input.slug, competitionId: String(id) }
    },
})

/** Edits details and the published flag; the game is fixed. */
export const update = mutation({
    args: { ...platformAccess, competitionId: v.string(), input: v.any() },
    handler: async (
        ctx,
        args
    ): Promise<Ok<{ previousSlug: string }> | Failure> => {
        await admin(ctx, args)
        const parsed = competitionUpdateSchema.safeParse(args.input)
        if (!parsed.success) return fail("invalid_competition")
        const competition = await competitionById(ctx, args.competitionId)
        if (!competition) return fail("not_found")
        const input = parsed.data,
            previousSlug = competition.slug
        if (input.slug !== undefined && input.slug !== competition.slug) {
            const taken = await competitionBySlug(ctx, input.slug)
            if (taken && taken._id !== competition._id)
                return fail("duplicate_slug")
        }
        await ctx.db.patch(competition._id, {
            ...(input.slug !== undefined ? { slug: input.slug } : {}),
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.season !== undefined ? { season: input.season } : {}),
            ...(input.description !== undefined
                ? { description: input.description ?? undefined }
                : {}),
            ...(input.published !== undefined
                ? { published: input.published }
                : {}),
            updatedAt: NOW(),
        })
        return { ok: true, slug: input.slug ?? previousSlug, previousSlug }
    },
})

export const createDivision = mutation({
    args: { ...platformAccess, competitionId: v.string(), input: v.any() },
    handler: async (
        ctx,
        args
    ): Promise<Ok<{ divisionId: string }> | Failure> => {
        await admin(ctx, args)
        const parsed = divisionInputSchema.safeParse(args.input)
        if (!parsed.success) return fail("invalid_competition")
        const competition = await competitionById(ctx, args.competitionId)
        if (!competition) return fail("not_found")
        const { divisions } = await competitionParts(ctx, competition._id)
        if (divisions.length >= COMPETITION_DIVISION_LIMIT)
            return fail("limit_reached")
        const conflict = checkDivisionName({
            name: parsed.data.name,
            divisions: divisions.map((row) => ({
                id: String(row._id),
                name: row.name,
            })),
        })
        if (conflict) return fail(conflict)
        const id = await ctx.db.insert("competitionDivisions", {
            competitionId: competition._id,
            name: parsed.data.name,
            order: Math.max(-1, ...divisions.map((row) => row.order)) + 1,
            createdAt: NOW(),
        })
        await touch(ctx, competition)
        return ok(competition, { divisionId: String(id) })
    },
})

export const renameDivision = mutation({
    args: { ...platformAccess, divisionId: v.string(), input: v.any() },
    handler: async (ctx, args): Promise<Ok | Failure> => {
        await admin(ctx, args)
        const parsed = divisionInputSchema.safeParse(args.input)
        if (!parsed.success) return fail("invalid_competition")
        const division = await rowById(
            ctx,
            "competitionDivisions",
            args.divisionId
        )
        const competition = division
            ? await ctx.db.get(division.competitionId)
            : null
        if (!division || !competition) return fail("division_not_found")
        const { divisions } = await competitionParts(ctx, competition._id)
        const conflict = checkDivisionName({
            name: parsed.data.name,
            divisionId: String(division._id),
            divisions: divisions.map((row) => ({
                id: String(row._id),
                name: row.name,
            })),
        })
        if (conflict) return fail(conflict)
        await ctx.db.patch(division._id, { name: parsed.data.name })
        await touch(ctx, competition)
        return ok(competition, {})
    },
})

export const reorderDivisions = mutation({
    args: { ...platformAccess, competitionId: v.string(), input: v.any() },
    handler: async (ctx, args): Promise<Ok | Failure> => {
        await admin(ctx, args)
        const parsed = divisionOrderSchema.safeParse(args.input)
        if (!parsed.success) return fail("invalid_order")
        const competition = await competitionById(ctx, args.competitionId)
        if (!competition) return fail("not_found")
        const { divisions } = await competitionParts(ctx, competition._id)
        const invalid = checkDivisionOrder({
            current: divisions.map((row) => String(row._id)),
            requested: parsed.data.divisionIds,
        })
        if (invalid) return fail(invalid)
        const byId = new Map(divisions.map((row) => [String(row._id), row]))
        for (const [order, id] of parsed.data.divisionIds.entries()) {
            const row = byId.get(id)!
            if (row.order !== order) await ctx.db.patch(row._id, { order })
        }
        await touch(ctx, competition)
        return ok(competition, {})
    },
})

export const deleteDivision = mutation({
    args: { ...platformAccess, divisionId: v.string() },
    handler: async (ctx, args): Promise<Ok | Failure> => {
        await admin(ctx, args)
        const division = await rowById(
            ctx,
            "competitionDivisions",
            args.divisionId
        )
        const competition = division
            ? await ctx.db.get(division.competitionId)
            : null
        if (!division || !competition) return fail("division_not_found")
        const { registrations, fixtures } = await competitionParts(
            ctx,
            competition._id
        )
        const blocked = checkDivisionDelete({
            registrations: registrations.filter(
                (row) => row.divisionId === division._id
            ).length,
            fixtures: fixtures.filter((row) => row.divisionId === division._id)
                .length,
        })
        if (blocked) return fail(blocked)
        await ctx.db.delete(division._id)
        await touch(ctx, competition)
        return ok(competition, {})
    },
})

/** Registers an active global team of the competition's game into one division. */
export const registerTeam = mutation({
    args: { ...platformAccess, competitionId: v.string(), input: v.any() },
    handler: async (
        ctx,
        args
    ): Promise<Ok<{ registrationId: string }> | Failure> => {
        await admin(ctx, args)
        const parsed = registrationCreateSchema.safeParse(args.input)
        if (!parsed.success) return fail("invalid_competition")
        const competition = await competitionById(ctx, args.competitionId)
        if (!competition) return fail("not_found")
        const team = await teamById(ctx, parsed.data.teamId)
        const division = await rowById(
            ctx,
            "competitionDivisions",
            parsed.data.divisionId
        )
        const { registrations } = await competitionParts(ctx, competition._id)
        const blocked = checkRegistration({
            gameId: resolveGameScope(competition.gameId),
            team: team
                ? {
                      gameId: team.gameId,
                      archivedAt: team.archivedAt,
                      mergedIntoTeamId: team.mergedIntoTeamId
                          ? String(team.mergedIntoTeamId)
                          : null,
                  }
                : null,
            divisionExists: division?.competitionId === competition._id,
            alreadyRegistered: Boolean(
                team && registrations.some((row) => row.teamId === team._id)
            ),
            registrations: registrations.length,
        })
        if (blocked || !team || !division) return fail(blocked ?? "not_found")
        const now = NOW()
        const id = await ctx.db.insert("competitionTeams", {
            competitionId: competition._id,
            teamId: team._id,
            divisionId: division._id,
            withdrawn: false,
            createdAt: now,
            updatedAt: now,
        })
        await touch(ctx, competition)
        return ok(competition, { registrationId: String(id) })
    },
})

/** Moves a registration to another division and/or withdraws or reinstates the team. */
export const updateRegistration = mutation({
    args: { ...platformAccess, registrationId: v.string(), input: v.any() },
    handler: async (ctx, args): Promise<Ok | Failure> => {
        await admin(ctx, args)
        const parsed = registrationUpdateSchema.safeParse(args.input)
        if (!parsed.success) return fail("invalid_competition")
        const registration = await rowById(
            ctx,
            "competitionTeams",
            args.registrationId
        )
        const competition = registration
            ? await ctx.db.get(registration.competitionId)
            : null
        if (!registration || !competition) return fail("not_found")
        const target = parsed.data.divisionId
            ? await rowById(ctx, "competitionDivisions", parsed.data.divisionId)
            : null
        const { fixtures } = await competitionParts(ctx, competition._id)
        const blocked = checkRegistrationUpdate({
            registration: {
                divisionId: registration.divisionId
                    ? String(registration.divisionId)
                    : null,
            },
            input: parsed.data,
            divisionExists: target?.competitionId === competition._id,
            leagueFixturesInCurrentDivision: fixtures.filter(
                (row) =>
                    row.phase === "league" &&
                    row.divisionId === registration.divisionId &&
                    involves(row, registration)
            ).length,
        })
        if (blocked) return fail(blocked)
        await ctx.db.patch(registration._id, {
            ...(target ? { divisionId: target._id } : {}),
            ...(parsed.data.withdrawn !== undefined
                ? { withdrawn: parsed.data.withdrawn }
                : {}),
            updatedAt: NOW(),
        })
        await touch(ctx, competition)
        return ok(competition, {})
    },
})

/** Removes a registration that no fixture references. */
export const removeRegistration = mutation({
    args: { ...platformAccess, registrationId: v.string() },
    handler: async (ctx, args): Promise<Ok | Failure> => {
        await admin(ctx, args)
        const registration = await rowById(
            ctx,
            "competitionTeams",
            args.registrationId
        )
        const competition = registration
            ? await ctx.db.get(registration.competitionId)
            : null
        if (!registration || !competition) return fail("not_found")
        const { fixtures } = await competitionParts(ctx, competition._id)
        const blocked = checkRegistrationRemoval({
            fixtures: fixtures.filter((row) => involves(row, registration))
                .length,
        })
        if (blocked) return fail(blocked)
        await ctx.db.delete(registration._id)
        await touch(ctx, competition)
        return ok(competition, {})
    },
})

/** Validates a fixture write against the competition's divisions and registered teams. */
async function fixtureWrite(
    ctx: MutationCtx,
    competition: Doc<"competitions">,
    raw: unknown
): Promise<
    | {
          fixture: FixtureInput
          fields: {
              divisionId: Id<"competitionDivisions">
              sideATeamId: Id<"teamDirectory">
              sideBTeamId: Id<"teamDirectory">
              participantTeamIds: Id<"teamDirectory">[]
          }
      }
    | Failure
> {
    const parsed = fixtureInputSchema.safeParse(raw)
    if (!parsed.success) return fail("invalid_competition")
    const fixture = parsed.data
    const { divisions, registrations } = await competitionParts(
        ctx,
        competition._id
    )
    const registered = new Map<string, RegisteredTeam>()
    for (const teamId of fixture.participantTeamIds ?? [
        fixture.sideATeamId,
        fixture.sideBTeamId,
    ]) {
        if (!teamId) return fail("invalid_competition")
        const row = registrations.find(
            (entry) => String(entry.teamId) === teamId
        )
        const team = row?.teamId ? await ctx.db.get(row.teamId) : null
        if (row)
            registered.set(teamId, {
                divisionId: row.divisionId ? String(row.divisionId) : null,
                gameId: team?.gameId ?? null,
            })
    }
    const blocked = checkFixture({
        gameId: resolveGameScope(competition.gameId),
        fixture,
        divisionIds: new Set(divisions.map((row) => String(row._id))),
        registrations: registered,
    })
    if (blocked) return fail(blocked)
    const divisionId = ctx.db.normalizeId(
        "competitionDivisions",
        fixture.divisionId
    )
    const sideATeamId = ctx.db.normalizeId("teamDirectory", fixture.sideATeamId)
    const sideBTeamId = ctx.db.normalizeId("teamDirectory", fixture.sideBTeamId)
    if (!divisionId || !sideATeamId || !sideBTeamId)
        return fail("invalid_competition")
    return {
        fixture,
        fields: {
            divisionId,
            sideATeamId,
            sideBTeamId,
            participantTeamIds: (
                fixture.participantTeamIds ?? [
                    fixture.sideATeamId,
                    fixture.sideBTeamId,
                ]
            ).map((id) => ctx.db.normalizeId("teamDirectory", id)!),
        },
    }
}

export const createFixture = mutation({
    args: { ...platformAccess, competitionId: v.string(), input: v.any() },
    handler: async (
        ctx,
        args
    ): Promise<Ok<{ fixtureId: string }> | Failure> => {
        await admin(ctx, args)
        const competition = await competitionById(ctx, args.competitionId)
        if (!competition) return fail("not_found")
        const { fixtures } = await competitionParts(ctx, competition._id)
        if (fixtures.length >= COMPETITION_FIXTURE_LIMIT)
            return fail("limit_reached")
        const write = await fixtureWrite(ctx, competition, args.input)
        if ("error" in write) return write
        const now = NOW()
        const id = await ctx.db.insert("competitionFixtures", {
            competitionId: competition._id,
            ...write.fields,
            phase: write.fixture.phase,
            round: write.fixture.round ?? undefined,
            scheduledAt: write.fixture.scheduledAt ?? undefined,
            scoreA: write.fixture.scoreA ?? undefined,
            scoreB: write.fixture.scoreB ?? undefined,
            participantScores:
                ("participantScores" in write.fixture
                    ? write.fixture.participantScores
                    : undefined) ?? undefined,
            status: write.fixture.status,
            createdAt: now,
            updatedAt: now,
        })
        await touch(ctx, competition)
        return ok(competition, { fixtureId: String(id) })
    },
})

/** Replaces a fixture's teams, division, phase, round, schedule, score and status; its event link stays. */
export const updateFixture = mutation({
    args: { ...platformAccess, fixtureId: v.string(), input: v.any() },
    handler: async (ctx, args): Promise<Ok | Failure> => {
        await admin(ctx, args)
        const row = await rowById(ctx, "competitionFixtures", args.fixtureId)
        const competition = row ? await ctx.db.get(row.competitionId) : null
        if (!row || !competition) return fail("not_found")
        const write = await fixtureWrite(ctx, competition, args.input)
        if ("error" in write) return write
        // A linked match event belongs to the pairing it was checked for; new
        // teams release it so later imports cannot score the wrong pairing.
        const teamsChanged =
            write.fields.sideATeamId !== row.sideATeamId ||
            write.fields.sideBTeamId !== row.sideBTeamId ||
            JSON.stringify(write.fields.participantTeamIds) !==
                JSON.stringify(
                    row.participantTeamIds ?? [row.sideATeamId, row.sideBTeamId]
                )
        if (teamsChanged)
            for (const eventId of fixtureEventIds(row))
                await releaseEvent(ctx, eventId, row._id)
        await ctx.db.patch(row._id, {
            ...write.fields,
            ...(teamsChanged
                ? { eventId: undefined, eventIds: undefined }
                : {}),
            teamAId: undefined,
            teamBId: undefined,
            phase: write.fixture.phase,
            // A write without `round` keeps the stored one.
            ...(write.fixture.round !== undefined
                ? { round: write.fixture.round ?? undefined }
                : {}),
            scheduledAt: write.fixture.scheduledAt ?? undefined,
            scoreA: write.fixture.scoreA ?? undefined,
            scoreB: write.fixture.scoreB ?? undefined,
            participantScores:
                ("participantScores" in write.fixture
                    ? write.fixture.participantScores
                    : undefined) ?? undefined,
            status: write.fixture.status,
            updatedAt: NOW(),
        })
        await touch(ctx, competition)
        return ok(competition, {})
    },
})

/** Clears the event's back-reference when it still points at this fixture. */
async function releaseEvent(
    ctx: MutationCtx,
    eventId: Id<"events"> | undefined,
    fixtureId: Id<"competitionFixtures">
) {
    const event = eventId ? await ctx.db.get(eventId) : null
    if (event?.competitionFixtureId === fixtureId)
        await ctx.db.patch(event._id, { competitionFixtureId: undefined })
}

/** Deletes a fixture and releases its linked match event. */
export const deleteFixture = mutation({
    args: { ...platformAccess, fixtureId: v.string() },
    handler: async (ctx, args): Promise<Ok | Failure> => {
        await admin(ctx, args)
        const row = await rowById(ctx, "competitionFixtures", args.fixtureId)
        const competition = row ? await ctx.db.get(row.competitionId) : null
        if (!row || !competition) return fail("not_found")
        for (const eventId of fixtureEventIds(row))
            await releaseEvent(ctx, eventId, row._id)
        await ctx.db.delete(row._id)
        await touch(ctx, competition)
        return ok(competition, {})
    },
})

/**
 * Links a fixture to a native match event of the competition's game, or
 * unlinks it (`eventId: null`). The event's assigned match teams must include
 * both fixture teams; an imported event result fills a still-scheduled
 * fixture, and later results keep flowing through the event.
 */
export const linkEvent = mutation({
    args: { ...platformAccess, fixtureId: v.string(), input: v.any() },
    handler: async (ctx, args): Promise<Ok | Failure> => {
        await admin(ctx, args)
        const parsed = fixtureEventLinkSchema.safeParse(args.input)
        if (!parsed.success) return fail("invalid_competition")
        const fixture = await rowById(
            ctx,
            "competitionFixtures",
            args.fixtureId
        )
        const competition = fixture
            ? await ctx.db.get(fixture.competitionId)
            : null
        if (!fixture || !competition) return fail("not_found")
        if (parsed.data.eventId === null) {
            for (const eventId of fixtureEventIds(fixture))
                await releaseEvent(ctx, eventId, fixture._id)
            if (fixtureEventIds(fixture).length)
                await ctx.db.patch(fixture._id, {
                    eventId: undefined,
                    eventIds: undefined,
                    updatedAt: NOW(),
                })
            await touch(ctx, competition)
            return ok(competition, {})
        }
        if (!fixture.sideATeamId || !fixture.sideBTeamId)
            return fail("migration_pending")
        const eventId = ctx.db.normalizeId("events", parsed.data.eventId)
        const event = eventId ? await ctx.db.get(eventId) : null
        const other = event
            ? await ctx.db
                  .query("competitionFixtures")
                  .withIndex("eventId", (q) => q.eq("eventId", event._id))
                  .first()
            : null
        const blocked = checkEventLink({
            gameId: resolveGameScope(competition.gameId),
            fixtureId: String(fixture._id),
            fixtureTeamIds: fixtureParticipants(fixture),
            event: event
                ? {
                      kind: event.kind ?? "match",
                      gameId: resolveGameScope(event.gameId),
                      competitionFixtureId: event.competitionFixtureId
                          ? String(event.competitionFixtureId)
                          : null,
                      teamIds: await eventTeamIds(ctx, event),
                  }
                : null,
            otherFixtureId: other ? String(other._id) : null,
        })
        if (blocked || !event) return fail(blocked ?? "event_not_found")
        // A fixture deliberately permits one independent local event per
        // participating workspace/team. Do not evict existing links.
        await ctx.db.patch(fixture._id, {
            // Retain the first link in `eventId` for legacy callers.
            eventId: fixture.eventId ?? event._id,
            eventIds: [...new Set([...fixtureEventIds(fixture), event._id])],
            updatedAt: NOW(),
        })
        await ctx.db.patch(event._id, { competitionFixtureId: fixture._id })
        await touch(ctx, competition)
        return ok(competition, {})
    },
})

/**
 * Creates or completes ECL 2026: the competition (published), its official
 * divisions and their teams as global catalogue teams (found by name or
 * created). Re-running only fills what is missing.
 */
export const seedEcl2026 = mutation({
    args: platformAccess,
    handler: async (
        ctx,
        args
    ): Promise<
        Ok<{ competitionId: string; teamsCreated: number }> | Failure
    > => {
        const actor = await admin(ctx, args)
        const now = NOW()
        let existing = await competitionBySlug(ctx, ECL_SLUG)
        if (!existing) {
            const id = await ctx.db.insert("competitions", {
                gameId: "hell_let_loose",
                slug: ECL_SLUG,
                name: "European Community League",
                season: "2026",
                description: "European Community League 2026 season",
                format: FORMAT,
                published: true,
                createdAt: now,
                updatedAt: now,
            })
            existing = await ctx.db.get(id)
        }
        const competition = existing
        if (!competition) return fail("not_found")
        if (resolveGameScope(competition.gameId) !== "hell_let_loose")
            return fail("invalid_competition")
        const parts = await competitionParts(ctx, competition._id)
        if (parts.registrations.some(isLegacyRegistration))
            return fail("migration_pending")
        const ports = {
            repository: new ConvexTeamDirectoryRepository(ctx),
            now: NOW,
        }
        let teamsCreated = 0
        for (const [order, [name, teams]] of ECL_DIVISIONS.entries()) {
            let division = parts.divisions.find((row) => row.name === name)
            if (!division) {
                const id = await ctx.db.insert("competitionDivisions", {
                    competitionId: competition._id,
                    name,
                    order,
                    createdAt: now,
                })
                division = (await ctx.db.get(id))!
            }
            for (const teamName of teams) {
                const adopted = await adoptCatalogueTeam(ports, actor, {
                    gameId: "hell_let_loose",
                    name: teamName,
                    linkedGuildId: null,
                })
                if ("error" in adopted)
                    return fail(
                        adopted.error === "limit_reached"
                            ? "limit_reached"
                            : "invalid_competition"
                    )
                if (adopted.created) teamsCreated++
                const teamId = ctx.db.normalizeId(
                    "teamDirectory",
                    adopted.teamId
                )!
                const joined = await ctx.db
                    .query("competitionTeams")
                    .withIndex("competitionId_teamId", (q) =>
                        q
                            .eq("competitionId", competition._id)
                            .eq("teamId", teamId)
                    )
                    .first()
                if (!joined)
                    await ctx.db.insert("competitionTeams", {
                        competitionId: competition._id,
                        teamId,
                        divisionId: division._id,
                        withdrawn: ECL_WITHDRAWN.has(teamName),
                        createdAt: now,
                        updatedAt: now,
                    })
            }
        }
        await touch(ctx, competition)
        return ok(competition, {
            competitionId: String(competition._id),
            teamsCreated,
        })
    },
})
