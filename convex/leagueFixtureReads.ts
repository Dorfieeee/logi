import {
    allowsApiKeyRead,
    isApiKeyReadAccess,
} from "../src/domain/api/key-access"
import { convexLeaguePanelSource } from "../src/infrastructure/convex/league-fixture-store"
import { loadLeaguePanels } from "../src/application/wardogs-league/league-panels"
import { projectLeagueFixture } from "../src/domain/wardogs-league/fixture"
import { leagueOverviewSchema } from "../src/domain/wardogs-league/panels"
import { PANEL_WINDOW } from "../src/domain/wardogs-league/all-fixtures"
import { trackedMatch, trackingConfig } from "./leagueTrackingStore"
import { assertSessionGateway } from "./dashboardSessionStore"
import { query, type QueryCtx } from "./_generated/server"
import { v } from "convex/values"
export async function readLeagueFixture(
    ctx: Pick<QueryCtx, "db">,
    guildId: string,
    id: string
) {
    const row = await trackedMatch(ctx, guildId, id)
    return row ? projectLeagueFixture(row, Date.now()) : null
}
/** The key must be live, belong to the guild and carry an explicit league-fixtures/wardogs grant. */
async function fixtureKeyAllowed(
    ctx: Pick<QueryCtx, "db">,
    keyHash: string,
    guildId: string
) {
    const key = await ctx.db
        .query("apiKeys")
        .withIndex("keyHash", (q) => q.eq("keyHash", keyHash))
        .unique()
    return Boolean(
        key &&
        !key.revokedAt &&
        key.guildId === guildId &&
        isApiKeyReadAccess(key.readAccess) &&
        allowsApiKeyRead(key.readAccess, "league-fixtures", "wardogs")
    )
}
export const list = query({
    args: {
        secret: v.string(),
        keyHash: v.string(),
        guildId: v.string(),
        cursor: v.union(v.string(), v.null()),
        limit: v.number(),
    },
    handler: async (ctx, args) => {
        assertSessionGateway(args.secret)
        if (!(await fixtureKeyAllowed(ctx, args.keyHash, args.guildId)))
            return null
        if (
            !Number.isInteger(args.limit) ||
            args.limit < 1 ||
            args.limit > 100 ||
            (args.cursor?.length ?? 0) > 4096
        )
            throw new Error("Invalid pagination.")
        const page = await ctx.db
            .query("leagueTrackedMatches")
            .withIndex("published", (q) =>
                q.eq("guildId", args.guildId).eq("tracked", true)
            )
            .paginate({ cursor: args.cursor, numItems: args.limit })
        return {
            items: page.page.flatMap((row) => {
                const value = projectLeagueFixture(row, Date.now())
                return value ? [value] : []
            }),
            nextCursor: page.isDone ? null : page.continueCursor,
        }
    },
})
/**
 * The whole League as the WD League panels show it: Logi's table of the
 * current season and the nearest fixtures with recent results. Shared
 * League data; the guild's watched codes mark its own team.
 */
export const overview = query({
    args: {
        secret: v.string(),
        keyHash: v.string(),
        guildId: v.string(),
        limit: v.number(),
    },
    handler: async (ctx, args) => {
        assertSessionGateway(args.secret)
        if (!(await fixtureKeyAllowed(ctx, args.keyHash, args.guildId)))
            return null
        if (
            !Number.isInteger(args.limit) ||
            args.limit < 1 ||
            args.limit > PANEL_WINDOW
        )
            throw new Error("Invalid limit.")
        const config = await trackingConfig(ctx, args.guildId)
        const now = Date.now()
        const panels = await loadLeaguePanels(
            convexLeaguePanelSource(ctx, now),
            {
                now,
                ourTeamCodes: config?.teamCodes ?? [],
                options: {
                    table: true,
                    fixtures: true,
                    recentResults: true,
                    fixtureCount: args.limit,
                },
            }
        )
        return leagueOverviewSchema.parse(panels)
    },
})

/** GWL connection state is served without credentials, raw combat events or private IDs. */
export const listGwl = query({
    args: {
        secret: v.string(),
        keyHash: v.string(),
        guildId: v.string(),
        cursor: v.union(v.string(), v.null()),
        limit: v.number(),
    },
    handler: async (ctx, args) => {
        assertSessionGateway(args.secret)
        if (!(await fixtureKeyAllowed(ctx, args.keyHash, args.guildId)))
            return null
        if (!Number.isInteger(args.limit) || args.limit < 1 || args.limit > 100)
            throw new Error("Invalid pagination")
        const page = await ctx.db
            .query("leagueAutoImportFixtures")
            .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
            .paginate({ cursor: args.cursor, numItems: args.limit })
        return {
            items: page.page
                .filter((row) => row.matchJson || row.slotJson)
                .map((row) => ({
                    id: row.fixtureId,
                    eventId: row.eventId ?? null,
                    issue: row.issue ?? null,
                    resultState: row.resultState ?? "pending",
                    statsState: row.statsState ?? "pending",
                    updatedAt: row.updatedAt,
                    fixture: row.matchJson ? JSON.parse(row.matchJson) : null,
                    slot: row.slotJson ? JSON.parse(row.slotJson) : null,
                })),
            nextCursor: page.isDone ? null : page.continueCursor,
        }
    },
})
