import {
    projectTeam,
    projectTeamRecord,
    TEAM_PAGE_MAX,
    TEAM_SEARCH_MAX,
    teamGameSchema,
    teamCreateSchema,
    TEAM_DIRECTORY_LIMIT,
    type TeamDto,
    type TeamGame,
    type TeamRecord,
} from "../src/domain/teams/team"
import {
    TEAM_USAGE_COMPETITIONS_MAX,
    TEAM_USAGE_IDS_MAX,
    teamCatalogueState,
    teamCatalogueStateSchema,
    type TeamUsage,
} from "../src/domain/teams/team-usage"
import {
    changeTeamLifecycle,
    createTeam,
    mergeTeam,
    updateTeam,
    type TeamDirectoryPorts,
} from "../src/application/teams/team-directory.use-case"
import {
    ConvexTeamDirectoryRepository,
    ConvexTeamLogoPort,
    teamById,
    teamEntity,
} from "../src/infrastructure/convex/team-directory-repositories"
import {
    mutation,
    query,
    type MutationCtx,
    type QueryCtx,
} from "./_generated/server"
import { importTeams } from "../src/application/teams/import-teams.use-case"
import { authorizeDashboardAdmin, dashboardActor } from "./dashboardActor"
import { authorizePlatformAdmin } from "./platformAdmin"
import type { Doc, Id } from "./_generated/dataModel"
import { assetPublicUrl } from "./imageAssetStore"
import { v } from "convex/values"
import { z } from "zod"

/** Workspace-administrator reads: the catalogue is global but read in a workspace's dashboard. */
const workspaceAccess = {
    secret: v.string(),
    guildId: v.string(),
    actor: dashboardActor,
}
/** Global-administrator access: no workspace, superadmin attestation required. */
const platformAccess = { secret: v.string(), actor: dashboardActor }
type Db = Pick<QueryCtx, "db">

export async function teamRecordOf(
    ctx: Db,
    row: Doc<"teamDirectory">
): Promise<TeamRecord> {
    return projectTeamRecord(
        teamEntity(row),
        await assetPublicUrl(ctx, row.logoAssetId)
    )
}
export async function teamDtoOf(
    ctx: Db,
    row: Doc<"teamDirectory">
): Promise<TeamDto> {
    return projectTeam(
        teamEntity(row),
        await assetPublicUrl(ctx, row.logoAssetId)
    )
}

function parseGame(value: string): TeamGame {
    const game = teamGameSchema.safeParse(value)
    if (!game.success) throw new Error("Invalid game.")
    return game.data
}
function assertPagination(limit: number, cursor: string | null) {
    if (
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > TEAM_PAGE_MAX ||
        (cursor?.length ?? 0) > 4096
    )
        throw new Error("Invalid pagination.")
}

/**
 * One page of the catalogue for a game. `archived` includes archived and
 * merged entries (administration only); search is bounded and unpaged.
 */
async function readCatalogue(
    ctx: Db,
    args: {
        gameId: string
        archived: boolean
        search?: string
        cursor: string | null
        limit: number
    }
): Promise<{ items: TeamRecord[]; nextCursor: string | null }> {
    const gameId = parseGame(args.gameId)
    assertPagination(args.limit, args.cursor)
    const search = args.search?.trim().slice(0, TEAM_SEARCH_MAX)
    if (search) {
        const rows = await ctx.db
            .query("teamDirectory")
            .withSearchIndex("search", (q) => {
                const scoped = q
                    .search("searchText", search)
                    .eq("gameId", gameId)
                return args.archived ? scoped : scoped.eq("archivedAt", null)
            })
            .take(args.limit)
        return {
            items: await Promise.all(rows.map((row) => teamRecordOf(ctx, row))),
            nextCursor: null,
        }
    }
    const page = args.archived
        ? await ctx.db
              .query("teamDirectory")
              .withIndex("gameId_normalizedName", (q) => q.eq("gameId", gameId))
              .paginate({ cursor: args.cursor, numItems: args.limit })
        : await ctx.db
              .query("teamDirectory")
              .withIndex("gameId_archivedAt_normalizedName", (q) =>
                  q.eq("gameId", gameId).eq("archivedAt", null)
              )
              .paginate({ cursor: args.cursor, numItems: args.limit })
    return {
        items: await Promise.all(
            page.page.map((row) => teamRecordOf(ctx, row))
        ),
        nextCursor: page.isDone ? null : page.continueCursor,
    }
}

const listArgs = {
    gameId: v.string(),
    search: v.optional(v.string()),
    cursor: v.union(v.string(), v.null()),
    limit: v.number(),
}

/** Active catalogue teams of one game for a workspace's picker and Teams page. */
export const list = query({
    args: { ...workspaceAccess, ...listArgs },
    handler: async (ctx, args) => {
        await authorizeDashboardAdmin(ctx, args)
        return await readCatalogue(ctx, { ...args, archived: false })
    },
})

/** One catalogue team for a workspace; archived and merged entries stay readable for history. */
export const get = query({
    args: { ...workspaceAccess, teamId: v.string() },
    handler: async (ctx, args): Promise<TeamRecord | null> => {
        await authorizeDashboardAdmin(ctx, args)
        const row = await teamById(ctx, args.teamId)
        return row ? await teamRecordOf(ctx, row) : null
    },
})

/** Global administration listing, optionally including archived and merged entries. */
export const adminList = query({
    args: { ...platformAccess, ...listArgs, archived: v.boolean() },
    handler: async (ctx, args) => {
        await authorizePlatformAdmin(ctx, args)
        return await readCatalogue(ctx, args)
    },
})

export const adminGet = query({
    args: { ...platformAccess, teamId: v.string() },
    handler: async (ctx, args): Promise<TeamRecord | null> => {
        await authorizePlatformAdmin(ctx, args)
        const row = await teamById(ctx, args.teamId)
        return row ? await teamRecordOf(ctx, row) : null
    },
})

/**
 * Global administration listing by lifecycle state (design I1 filters):
 * active entries by name; archived or merged entries most recently archived
 * first. Search is bounded and unpaged, like the plain listing.
 */
export const adminListState = query({
    args: { ...platformAccess, ...listArgs, state: v.string() },
    handler: async (ctx, args) => {
        await authorizePlatformAdmin(ctx, args)
        const state = teamCatalogueStateSchema.parse(args.state)
        if (state === "active")
            return await readCatalogue(ctx, { ...args, archived: false })
        const gameId = parseGame(args.gameId)
        assertPagination(args.limit, args.cursor)
        const search = args.search?.trim().slice(0, TEAM_SEARCH_MAX)
        const inState = (row: Doc<"teamDirectory">) =>
            teamCatalogueState({
                archivedAt: row.archivedAt,
                mergedIntoTeamId: row.mergedIntoTeamId ?? null,
            }) === state
        if (search) {
            const rows = await ctx.db
                .query("teamDirectory")
                .withSearchIndex("search", (q) =>
                    q.search("searchText", search).eq("gameId", gameId)
                )
                .take(TEAM_PAGE_MAX)
            return {
                items: await Promise.all(
                    rows
                        .filter(inState)
                        .slice(0, args.limit)
                        .map((row) => teamRecordOf(ctx, row))
                ),
                nextCursor: null,
            }
        }
        // Archived entries carry an ISO timestamp, which sorts after "".
        const page = await ctx.db
            .query("teamDirectory")
            .withIndex("gameId_archivedAt_normalizedName", (q) =>
                q.eq("gameId", gameId).gt("archivedAt", "")
            )
            .order("desc")
            .filter((q) =>
                state === "merged"
                    ? q.gt(q.field("mergedIntoTeamId"), "")
                    : q.or(
                          q.eq(q.field("mergedIntoTeamId"), null),
                          q.eq(q.field("mergedIntoTeamId"), undefined)
                      )
            )
            .paginate({ cursor: args.cursor, numItems: args.limit })
        return {
            items: await Promise.all(
                page.page.map((row) => teamRecordOf(ctx, row))
            ),
            nextCursor: page.isDone ? null : page.continueCursor,
        }
    },
})

/** Fixtures read per side for one team's detail; enough for every realistic season history. */
const USAGE_FIXTURES_PER_SIDE = 1000

/**
 * Registrations and pending requests of one team, and with `withFixtures`
 * its fixture count per competition; every read is indexed and bounded.
 */
async function teamUsageOf(
    ctx: Db,
    teamId: Id<"teamDirectory">,
    withFixtures: boolean
): Promise<TeamUsage> {
    const registrations = await ctx.db
        .query("competitionTeams")
        .withIndex("teamId", (q) => q.eq("teamId", teamId))
        .take(100)
    const fixtures = new Map<string, number>()
    if (withFixtures)
        for (const side of ["sideATeamId", "sideBTeamId"] as const)
            for (const fixture of await ctx.db
                .query("competitionFixtures")
                .withIndex(side, (q) => q.eq(side, teamId))
                .take(USAGE_FIXTURES_PER_SIDE)) {
                const key = String(fixture.competitionId)
                fixtures.set(key, (fixtures.get(key) ?? 0) + 1)
            }
    const competitions = []
    for (const registration of registrations.slice(
        0,
        TEAM_USAGE_COMPETITIONS_MAX
    )) {
        const [competition, division] = await Promise.all([
            ctx.db.get(registration.competitionId),
            registration.divisionId
                ? ctx.db.get(registration.divisionId)
                : null,
        ])
        if (!competition) continue
        competitions.push({
            id: String(competition._id),
            name: competition.name,
            season: competition.season,
            division: division?.name ?? null,
            fixtures: withFixtures
                ? (fixtures.get(String(competition._id)) ?? 0)
                : null,
            withdrawn: registration.withdrawn,
        })
    }
    const pending = await ctx.db
        .query("teamRequests")
        .withIndex("teamId_status", (q) =>
            q.eq("teamId", teamId).eq("status", "pending")
        )
        .take(20)
    return {
        teamId: String(teamId),
        competitions,
        competitionCount: registrations.length,
        pendingRequests: pending.length,
        pendingRequestId: pending[0] ? String(pending[0]._id) : null,
    }
}

/**
 * Where catalogue teams are used (design I1 "Kde se tým používá" and the
 * request marker): global administrators only. Fixture counts come only
 * with a single team (its detail). Unknown IDs are skipped.
 */
export const adminUsage = query({
    args: { ...platformAccess, teamIds: v.array(v.string()) },
    handler: async (ctx, args): Promise<{ items: TeamUsage[] }> => {
        await authorizePlatformAdmin(ctx, args)
        if (args.teamIds.length > TEAM_USAGE_IDS_MAX)
            throw new Error("Too many teams.")
        const items: TeamUsage[] = []
        const teamIds = new Set(args.teamIds)
        for (const raw of teamIds) {
            const id = ctx.db.normalizeId("teamDirectory", raw)
            if (id && (await ctx.db.get(id)))
                items.push(await teamUsageOf(ctx, id, teamIds.size === 1))
        }
        return { items }
    },
})

/** Authorizes the global administrator in this transaction and wires the use-cases. */
async function catalogueWriter(
    ctx: MutationCtx,
    args: {
        secret: string
        actor: Parameters<typeof authorizePlatformAdmin>[1]["actor"]
    }
): Promise<{ ports: TeamDirectoryPorts; actor: string }> {
    const admin = await authorizePlatformAdmin(ctx, args)
    return {
        ports: {
            repository: new ConvexTeamDirectoryRepository(ctx),
            logos: new ConvexTeamLogoPort(ctx),
            now: () => new Date().toISOString(),
        },
        actor: admin.session.subject,
    }
}

/** Idempotent create: a retried key with the same payload replays the original result. */
export const create = mutation({
    args: { ...platformAccess, input: v.any() },
    handler: async (ctx, args) => {
        const { ports, actor } = await catalogueWriter(ctx, args)
        return await createTeam(ports, { actor }, args.input)
    },
})

export const update = mutation({
    args: { ...platformAccess, teamId: v.string(), input: v.any() },
    handler: async (ctx, args) => {
        const { ports, actor } = await catalogueWriter(ctx, args)
        return await updateTeam(ports, { actor }, args.teamId, args.input)
    },
})

/** Archive hides a team from new selection and the website catalogue; history keeps its snapshots. */
export const archive = mutation({
    args: { ...platformAccess, teamId: v.string(), input: v.any() },
    handler: async (ctx, args) => {
        const { ports, actor } = await catalogueWriter(ctx, args)
        return await changeTeamLifecycle(
            ports,
            { actor },
            args.teamId,
            args.input,
            "archive"
        )
    },
})
export const restore = mutation({
    args: { ...platformAccess, teamId: v.string(), input: v.any() },
    handler: async (ctx, args) => {
        const { ports, actor } = await catalogueWriter(ctx, args)
        return await changeTeamLifecycle(
            ports,
            { actor },
            args.teamId,
            args.input,
            "restore"
        )
    },
})

/** Merges a duplicate into the team that stays; see the use-case for what moves. */
export const merge = mutation({
    args: { ...platformAccess, teamId: v.string(), input: v.any() },
    handler: async (ctx, args) => {
        const { ports, actor } = await catalogueWriter(ctx, args)
        return await mergeTeam(ports, { actor }, args.teamId, args.input)
    },
})

/** Add-only provider import, with name/code matching in the same transaction as creation. */
export const importCatalogue = mutation({
    args: { ...platformAccess, gameId: v.string(), teams: v.any() },
    handler: async (ctx, args) => {
        const { ports, actor } = await catalogueWriter(ctx, args)
        const gameId = parseGame(args.gameId)
        const teams = z
            .array(teamCreateSchema.omit({ gameId: true }))
            .max(500)
            .parse(args.teams)
        const existing = await ctx.db
            .query("teamDirectory")
            .withIndex("gameId_normalizedName", (q) => q.eq("gameId", gameId))
            .take(TEAM_DIRECTORY_LIMIT + 1)
        return await importTeams(ports, actor, gameId, existing, teams)
    },
})
