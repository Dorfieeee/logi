import { hasCompetitionHistory } from "../src/domain/competitions/enrollment"
import { mutation, query, type QueryCtx } from "./_generated/server"
import type { Doc, Id } from "./_generated/dataModel"
import { v } from "convex/values"

import {
    clanResult,
    isPublicUpcomingMatch,
    matchOpponent,
    parseDiscordInviteUrl,
    publicClanGames,
    type PublicUpcomingMatch,
} from "../src/domain/workspaces/public-clan-page"
import {
    isCompetitionPublished,
    legacyTeamKey,
} from "../src/domain/competitions/competition"
import { resolveGameScope, type GameId } from "../src/domain/games/game"
import { getGuildByDiscordId, getGuildDiscordId } from "./identity"
import { assertInternalSecret } from "./discord_shared"

/**
 * The public clan page beyond `publicProfiles:getClan` (design J2): the
 * clan's own Discord invite, announced upcoming matches, recent results from
 * the clan's side and the published competitions its teams play in. Only
 * public projections leave this module: no drafts, trainings, descriptions,
 * notes, server names or passwords, sign-ups or player names.
 */

type Db = Pick<QueryCtx, "db">
const UPCOMING_LIMIT = 10
const RESULT_LIMIT = 10

/** Same eligibility as `publicProfiles:getClan`: at least one member. */
async function isPublicClan(ctx: Db, guild: Doc<"guilds">) {
    if (guild.memberIds.length > 0) return true
    const assignments = await ctx.db
        .query("userAssignments")
        .withIndex("serverId", (q) =>
            q.eq("serverId", getGuildDiscordId(guild))
        )
        .collect()
    return assignments.some((assignment) => assignment.status === "active")
}

/** Catalogue team IDs that represent the clan, plus its legacy competition key. */
async function ownTeamIds(ctx: Db, guild: Doc<"guilds">) {
    const teams = await ctx.db
        .query("teamDirectory")
        .withIndex("linkedGuildId", (q) =>
            q.eq("linkedGuildId", getGuildDiscordId(guild))
        )
        .take(50)
    return {
        catalogue: teams.map((team) => team._id),
        all: new Set([
            ...teams.map((team) => String(team._id)),
            legacyTeamKey(String(guild._id)),
        ]),
    }
}

/** Published competitions the clan's teams are registered in, newest first. */
async function competitionSlugs(
    ctx: Db,
    guild: Doc<"guilds">,
    catalogue: Id<"teamDirectory">[]
) {
    const registrations = (
        await Promise.all([
            ...catalogue.map((teamId) =>
                ctx.db
                    .query("competitionTeams")
                    .withIndex("teamId", (q) => q.eq("teamId", teamId))
                    .take(50)
            ),
            ctx.db
                .query("competitionTeams")
                .withIndex("guildId", (q) => q.eq("guildId", guild._id))
                .take(50),
        ])
    ).flat()
    const ids = [
        ...new Set(
            registrations
                .filter(hasCompetitionHistory)
                .map((row) => String(row.competitionId))
        ),
    ]
    const competitions = await Promise.all(
        ids.map((id) => ctx.db.get(id as Id<"competitions">))
    )
    return competitions
        .filter((row): row is Doc<"competitions"> =>
            Boolean(row && isCompetitionPublished(row))
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((row) => row.slug)
}

/** The published competition a match belongs to, as "Name Season". */
async function competitionLabel(
    ctx: Db,
    fixtureId: Id<"competitionFixtures"> | undefined
) {
    if (!fixtureId) return null
    const fixture = await ctx.db.get(fixtureId)
    const competition = fixture ? await ctx.db.get(fixture.competitionId) : null
    return competition && isCompetitionPublished(competition)
        ? `${competition.name} ${competition.season}`
        : null
}

export const get = query({
    args: { secret: v.string(), guildId: v.string(), now: v.string() },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const now = Date.parse(args.now)
        if (!Number.isFinite(now)) throw new Error("Invalid time.")
        const guild = await getGuildByDiscordId(ctx, args.guildId)
        if (!guild || !(await isPublicClan(ctx, guild))) return null
        const guildId = getGuildDiscordId(guild)
        const [events, own] = await Promise.all([
            ctx.db
                .query("events")
                .withIndex("guildId", (q) => q.eq("guildId", guildId))
                .collect(),
            ownTeamIds(ctx, guild),
        ])
        const categoryLabel = (matchType: string | undefined) =>
            matchType
                ? (guild.eventCategories?.find((item) => item.id === matchType)
                      ?.label ?? matchType)
                : null
        const opponentOf = (event: Doc<"events">) =>
            matchOpponent(event.matchTeams ?? [], own.all)

        const upcoming: PublicUpcomingMatch[] = await Promise.all(
            events
                .filter((event) => isPublicUpcomingMatch(event, now))
                .sort((a, b) => a.gameStart.localeCompare(b.gameStart))
                .slice(0, UPCOMING_LIMIT)
                .map(async (event) => ({
                    eventId: String(event._id),
                    gameId: resolveGameScope(event.gameId),
                    startsAt: event.gameStart,
                    opponent: opponentOf(event),
                    name: event.name,
                    label:
                        (await competitionLabel(
                            ctx,
                            event.competitionFixtureId
                        )) ?? categoryLabel(event.matchType),
                }))
        )

        // The same matches `publicProfiles:getClan` lists: played, recorded, not trainings.
        const results = await Promise.all(
            events
                .filter(
                    (event) =>
                        event.kind !== "training" &&
                        event.isDraft !== true &&
                        event.matchStatsId
                )
                .sort((a, b) => b.gameEnd.localeCompare(a.gameEnd))
                .slice(0, RESULT_LIMIT)
                .map(async (event) => {
                    const gameId: GameId = resolveGameScope(event.gameId)
                    if (event.eventResult) {
                        const result = clanResult({
                            side: event.side,
                            result: event.eventResult,
                        })
                        return {
                            eventId: String(event._id),
                            gameId,
                            name: event.name,
                            endedAt: event.eventResult.endedAt ?? event.gameEnd,
                            mapName: event.eventResult.mapName ?? null,
                            ...result,
                            opponent: opponentOf(event) ?? result.opponent,
                        }
                    }
                    const stats = await ctx.db
                        .query("matchStats")
                        .withIndex("eventId", (q) => q.eq("eventId", event._id))
                        .unique()
                    return {
                        eventId: String(event._id),
                        gameId,
                        name: event.name,
                        endedAt: event.gameEnd,
                        mapName: stats?.raw.map.pretty_name ?? null,
                        outcome: null,
                        clanScore: null,
                        opponentScore: null,
                        opponent: opponentOf(event),
                    }
                })
        )

        return {
            inviteUrl: guild.publicInviteUrl
                ? parseDiscordInviteUrl(guild.publicInviteUrl)
                : null,
            games: publicClanGames(guild.enabledGames),
            upcoming,
            results,
            teamIds: [...own.all],
            competitionSlugs: await competitionSlugs(ctx, guild, own.catalogue),
        }
    },
})

/**
 * Public clan pages of a published competition's teams, by competition team
 * ID: catalogue teams linked to a Logi clan, and legacy clan registrations.
 * Teams without an eligible public clan page are left out.
 */
export const competitionClanLinks = query({
    args: { secret: v.string(), slug: v.string() },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const competition = await ctx.db
            .query("competitions")
            .withIndex("slug", (q) => q.eq("slug", args.slug))
            .first()
        if (!competition || !isCompetitionPublished(competition)) return {}
        const registrations = await ctx.db
            .query("competitionTeams")
            .withIndex("competitionId", (q) =>
                q.eq("competitionId", competition._id)
            )
            .take(500)
        const links: Record<string, string> = {}
        for (const row of registrations.filter(hasCompetitionHistory)) {
            let key: string
            let guild: Doc<"guilds"> | null = null
            if (row.teamId) {
                key = String(row.teamId)
                const team = await ctx.db.get(row.teamId)
                if (team?.linkedGuildId)
                    guild = await getGuildByDiscordId(ctx, team.linkedGuildId)
            } else if (row.guildId) {
                key = legacyTeamKey(String(row.guildId))
                guild = await ctx.db.get(row.guildId)
            } else continue
            if (guild && (await isPublicClan(ctx, guild)))
                links[key] = getGuildDiscordId(guild)
        }
        return links
    },
})

/**
 * Sets or removes the clan's public Discord invite. The Next route checks the
 * dashboard session, clan admin right and origin; the invite is validated
 * again here.
 */
export const setInviteUrl = mutation({
    args: {
        secret: v.string(),
        guildId: v.id("guilds"),
        inviteUrl: v.union(v.string(), v.null()),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const guild = await ctx.db.get(args.guildId)
        if (!guild) throw new Error("Server not found.")
        const inviteUrl =
            args.inviteUrl === null
                ? null
                : parseDiscordInviteUrl(args.inviteUrl)
        if (args.inviteUrl !== null && !inviteUrl)
            return { ok: false as const, error: "invalid_invite" as const }
        await ctx.db.patch(guild._id, {
            publicInviteUrl: inviteUrl ?? undefined,
            updatedAt: new Date().toISOString(),
        })
        return {
            ok: true as const,
            inviteUrl,
            guildDiscordId: getGuildDiscordId(guild),
        }
    },
})
