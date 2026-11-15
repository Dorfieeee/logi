import {
    ConvexTeamDirectoryRepository,
    ConvexTeamLogoPort,
} from "../src/infrastructure/convex/team-directory-repositories"
import {
    teamCreateSchema,
    teamGameSchema,
    TEAM_DIRECTORY_LIMIT,
} from "../src/domain/teams/team"
import { importTeams } from "../src/application/teams/import-teams.use-case"
import { internalAction, mutation, query } from "./_generated/server"
import { assertSessionGateway } from "./dashboardSessionStore"
import { teamRecordOf } from "./teams"
import { v } from "convex/values"
import { z } from "zod"

// Trusted runtime adapters only: never impersonate a dashboard administrator.
export const list = query({
    args: {
        secret: v.string(),
        gameId: v.string(),
        archived: v.boolean(),
        cursor: v.union(v.string(), v.null()),
        limit: v.number(),
    },
    handler: async (ctx, args) => {
        assertSessionGateway(args.secret)
        const gameId = teamGameSchema.parse(args.gameId)
        const page = await ctx.db
            .query("teamDirectory")
            .withIndex("gameId_normalizedName", (q) => q.eq("gameId", gameId))
            .paginate({
                cursor: args.cursor,
                numItems: Math.max(1, Math.min(100, args.limit)),
            })
        return {
            items: await Promise.all(
                page.page.map((row) => teamRecordOf(ctx, row))
            ),
            nextCursor: page.isDone ? null : page.continueCursor,
        }
    },
})
export const commit = mutation({
    args: { secret: v.string(), gameId: v.string(), teams: v.any() },
    handler: async (ctx, args) => {
        assertSessionGateway(args.secret)
        const gameId = teamGameSchema.parse(args.gameId)
        const teams = z
            .array(teamCreateSchema.omit({ gameId: true }))
            .max(500)
            .parse(args.teams)
        const existing = await ctx.db
            .query("teamDirectory")
            .withIndex("gameId_normalizedName", (q) => q.eq("gameId", gameId))
            .take(TEAM_DIRECTORY_LIMIT + 1)
        if (existing.length > TEAM_DIRECTORY_LIMIT)
            throw new Error("Catalogue exceeds limit")
        return importTeams(
            {
                repository: new ConvexTeamDirectoryRepository(ctx),
                logos: new ConvexTeamLogoPort(ctx),
                now: () => new Date().toISOString(),
            },
            "team-catalogue-sync",
            gameId,
            existing.map((row) => ({ ...row, id: String(row._id) })),
            teams
        )
    },
})

// Native image decoding runs in the web Node runtime (sharp is not a Convex V8 module).
export const refresh = internalAction({
    args: {
        gameId: v.union(v.literal("wardogs"), v.literal("hell_let_loose")),
    },
    handler: async (_ctx, args) => {
        const site = process.env.SITE_URL
        const secret = process.env.INTERNAL_AUTH_SECRET
        if (!site || !secret)
            throw new Error(
                "SITE_URL and INTERNAL_AUTH_SECRET are required for team refresh"
            )
        const response = await fetch(
            new URL("/api/internal/team-catalogue-refresh", site),
            {
                method: "POST",
                redirect: "error",
                headers: {
                    Authorization: `Bearer ${secret}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(args),
                signal: AbortSignal.timeout(300_000),
            }
        )
        if (!response.ok)
            throw new Error(
                `Team catalogue refresh failed (${response.status})`
            )
        const result = await response.json()
        console.info("Team catalogue refresh", args.gameId, result)
    },
})
