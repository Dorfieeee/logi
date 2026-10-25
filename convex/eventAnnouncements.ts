import { buildMatchImage } from "../src/domain/events/match-image"
import { assetPublicUrl } from "./imageAssetStore"
import { v } from "convex/values"

import {
    announcementMigrationScanStart,
    hasMigratableMessage,
    isAnnouncementMigrationDue,
} from "../src/domain/events/announcement-migration"
import {
    assertInternalSecret,
    normalizeConfigDoc,
    normalizeDoc,
    normalizeEventDoc,
} from "./discord_shared"
import {
    getGuildByDiscordId,
    getGuildById,
    getGuildDiscordId,
    getUserByDiscordId,
} from "./identity"
import {
    matchesGameScope,
    resolveGameScope,
    withGameOverrides,
} from "../src/domain/games/game"
import {
    signupListMembership,
    signupTimesFromActivities,
} from "../src/domain/events/signup-list"
import { toAnnouncementResult } from "../src/domain/discord-messages/match-announcement"
import { describeManualReminderAudience } from "../src/domain/events/manual-reminders"
import { mutation, query, type QueryCtx } from "./_generated/server"
import { isDraftEvent } from "../src/domain/events/drafts"
import type { Doc } from "./_generated/dataModel"

/**
 * Reads and writes of the match announcement card (board L1) for the Discord
 * bot. Every function checks the internal secret first.
 */

/** A user's name in this clan: the clan nickname, else the account name. */
async function clanName(ctx: QueryCtx, userId: string, guildId: string) {
    const user = await getUserByDiscordId(ctx, userId)
    return user?.nicknames?.[guildId]?.trim() || user?.name?.trim() || undefined
}

/** The confirming admin and the public match page of a reviewed result. */
async function reviewedResultFacts(ctx: QueryCtx, event: Doc<"events">) {
    const result = event.reviewedResult
    if (
        !result ||
        result.status === "provisional" ||
        event.reviewedResultGameId !== resolveGameScope(event.gameId)
    )
        return null
    const [revision, stats] = await Promise.all([
        ctx.db
            .query("eventResultRevisions")
            .withIndex("eventId_version", (q) =>
                q.eq("eventId", event._id).eq("version", result.version)
            )
            .unique(),
        ctx.db
            .query("matchStats")
            .withIndex("eventId", (q) => q.eq("eventId", event._id))
            .unique(),
    ])
    const reviewerId =
        revision && revision.guildId === event.guildId
            ? revision.revision.reviewerId
            : null
    return {
        imageResult: {
            participants: result.participants.map(({ id, label, score }) => ({
                id,
                label,
                score,
            })),
            imported: event.eventResult
                ? {
                      outcome: event.eventResult.outcome,
                      score: event.eventResult.score,
                  }
                : null,
        },
        resultVersion: result.version,
        hasCollectedData:
            revision?.revision.sessionLinks.some((source) => source.complete) ??
            false,
        sourceUrl: event.eventResult?.sourceUrl ?? null,
        result: toAnnouncementResult({
            participants: result.participants,
            clanSide: event.side,
            imported: event.eventResult
                ? {
                      outcome: event.eventResult.outcome,
                      score: event.eventResult.score,
                  }
                : null,
            reviewer: reviewerId
                ? await clanName(ctx, reviewerId, event.guildId)
                : null,
        }),
        // The public match page exists only for matches with linked stats.
        publicMatch: Boolean(
            (stats && event.matchStatsId && event.matchStatsId === stats._id) ||
            event.wardogsReportId
        ),
    }
}

/**
 * What the announcement needs beyond the sync payload: whether its first
 * post already pinged, the layout it was drawn with, the reviewed result with
 * the confirming admin, and the clan's results channel for this game.
 */
export const getContext = query({
    args: { secret: v.string(), eventId: v.id("events") },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const event = await ctx.db.get(args.eventId)
        if (!event || isDraftEvent(event)) return null
        const guild =
            (await getGuildByDiscordId(ctx, event.guildId)) ??
            (ctx.db.normalizeId("guilds", event.guildId)
                ? await getGuildById(ctx, event.guildId)
                : null)
        const discordId = guild ? getGuildDiscordId(guild) : event.guildId
        const [row, panels, config, fixture, tracked] = await Promise.all([
            ctx.db
                .query("discordAnnouncements")
                .withIndex("eventId", (q) => q.eq("eventId", event._id))
                .unique(),
            ctx.db
                .query("discordPublicPanels")
                .withIndex("guildId", (q) => q.eq("guildId", discordId))
                .take(20),
            ctx.db
                .query("discordConfigs")
                .withIndex("guildId", (q) => q.eq("guildId", discordId))
                .unique(),
            event.competitionFixtureId
                ? ctx.db.get(event.competitionFixtureId)
                : null,
            ctx.db
                .query("leagueTrackedMatches")
                .withIndex("event", (q) =>
                    q.eq("guildId", discordId).eq("eventId", String(event._id))
                )
                .first(),
        ])
        const competition = fixture
            ? await ctx.db.get(fixture.competitionId)
            : null
        const leagueLabel = competition
            ? `${competition.name}${fixture?.round ? ` · ${fixture.round}` : ""}`
            : tracked
              ? "Wardogs League"
              : null
        const gameId = resolveGameScope(event.gameId)
        const results = panels.find(
            (panel) =>
                panel.kind === "results" &&
                panel.enabled &&
                panel.gameId === gameId
        )
        const facts =
            event.status === "concluded"
                ? await reviewedResultFacts(ctx, event)
                : null
        return {
            pingedAt: row?.pingedAt ?? null,
            rosterPingedAt: row?.rosterPingedAt ?? null,
            layoutVersion: row?.layoutVersion ?? null,
            result: facts?.result ?? null,
            publicMatch: facts?.publicMatch ?? false,
            resultsChannelId:
                config?.eventResultsChannelId ?? results?.channelId ?? null,
            leagueLabel,
            imageResult: facts?.imageResult ?? null,
            resultVersion: facts?.resultVersion ?? null,
            sourceUrl: facts?.sourceUrl ?? null,
            hasCollectedData: facts?.hasCollectedData ?? false,
            dashboardServerId: guild ? String(guild._id) : null,
        }
    },
})

/** Same generated artwork for dashboard and scoped website integrations. */
export const getImageContext = query({
    args: {
        secret: v.string(),
        eventId: v.id("events"),
        guildId: v.string(),
        result: v.boolean(),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const event = await ctx.db.get(args.eventId)
        if (
            !event ||
            isDraftEvent(event) ||
            (event.kind ?? "match") !== "match" ||
            event.guildId !== args.guildId
        )
            return null
        const [guild, config, linked, fixture] = await Promise.all([
            getGuildByDiscordId(ctx, args.guildId),
            ctx.db
                .query("discordConfigs")
                .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
                .unique(),
            ctx.db
                .query("teamDirectory")
                .withIndex("linkedGuildId", (q) =>
                    q.eq("linkedGuildId", args.guildId)
                )
                .take(20),
            event.competitionFixtureId
                ? ctx.db.get(event.competitionFixtureId)
                : null,
        ])
        if (!guild) return null
        const own = linked.find(
            (team) =>
                team.gameId === resolveGameScope(event.gameId) &&
                !team.archivedAt &&
                !team.mergedIntoTeamId
        )
        const competition = fixture
            ? await ctx.db.get(fixture.competitionId)
            : null
        const tracked = !competition
            ? await ctx.db
                  .query("leagueTrackedMatches")
                  .withIndex("event", (q) =>
                      q
                          .eq("guildId", args.guildId)
                          .eq("eventId", String(event._id))
                  )
                  .first()
            : null
        const facts =
            args.result && event.status === "concluded"
                ? await reviewedResultFacts(ctx, event)
                : null
        if (args.result && !facts) return null
        const effective = withGameOverrides(
            config ?? { timezone: "UTC", defaultLanguage: "en" as const },
            config?.gameOverrides,
            event.gameId
        )
        return {
            customImageUrl: args.result ? null : (event.imageUrl ?? null),
            model: buildMatchImage({
                event,
                clan: guild,
                categories: guild.eventCategories,
                ownTeam: own
                    ? {
                          id: String(own._id),
                          name: own.name,
                          shortCode: own.shortCode,
                          logoUrl: await assetPublicUrl(ctx, own.logoAssetId),
                      }
                    : null,
                language: effective.defaultLanguage,
                timeZone: effective.timezone,
                league: competition
                    ? `${competition.name}${fixture?.round ? ` · ${fixture.round}` : ""}`
                    : tracked
                      ? "Wardogs League"
                      : null,
                result: facts?.imageResult,
            }),
        }
    },
})

/**
 * Records the first ping and the layout of a delivered card, or that a
 * match without a card had its other messages redrawn (L1-147).
 */
export const record = mutation({
    args: {
        secret: v.string(),
        eventId: v.id("events"),
        guildId: v.string(),
        pinged: v.optional(v.boolean()),
        rosterPinged: v.optional(v.boolean()),
        layoutVersion: v.optional(v.string()),
        migrationVersion: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const event = await ctx.db.get(args.eventId)
        if (!event || event.guildId !== args.guildId) return null
        const now = new Date().toISOString()
        const row = await ctx.db
            .query("discordAnnouncements")
            .withIndex("eventId", (q) => q.eq("eventId", args.eventId))
            .unique()
        const patch = {
            ...(args.pinged && !row?.pingedAt ? { pingedAt: now } : {}),
            ...(args.rosterPinged && !row?.rosterPingedAt
                ? { rosterPingedAt: now }
                : {}),
            ...(args.layoutVersion
                ? { layoutVersion: args.layoutVersion }
                : {}),
            ...(args.migrationVersion
                ? { migrationVersion: args.migrationVersion }
                : {}),
            updatedAt: now,
        }
        if (row) {
            await ctx.db.patch(row._id, patch)
            return String(row._id)
        }
        return String(
            await ctx.db.insert("discordAnnouncements", {
                eventId: args.eventId,
                guildId: args.guildId,
                ...patch,
            })
        )
    },
})

/**
 * Matches with messages of the old bot that are upcoming or ended in the
 * migration window (L1-147, L1-148): a posted card of an older layout, or a
 * roster card or forum post of a match whose announcement the old bot had
 * already removed. Drafts and matches without such a message are left out;
 * the bot redraws the rest, a few a minute, and the record above marks each
 * one done, so a restart never redraws a match twice.
 *
 * The bot asks every minute, so the read is bounded by the `gameEnd` index
 * to the matches that end after the window's start (ARCHITECTURE.md,
 * "Convex hot paths"); the rule then decides exactly.
 */
export const listMigrationDue = query({
    args: {
        secret: v.string(),
        version: v.string(),
        now: v.string(),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const now = new Date(args.now)
        const limit = Math.max(1, Math.min(args.limit ?? 25, 100))
        const due: Array<{ eventId: string; guildId: string }> = []
        const candidates = await ctx.db
            .query("events")
            .withIndex("gameEnd", (q) =>
                q.gte("gameEnd", announcementMigrationScanStart(now))
            )
            .collect()
        for (const event of candidates) {
            if (due.length >= limit) break
            if (isDraftEvent(event)) continue
            if (
                !isAnnouncementMigrationDue({
                    gameEnd: event.gameEnd,
                    now,
                    hasMessage: true,
                    layoutVersion: null,
                    version: args.version,
                })
            )
                continue
            const [sync, row] = await Promise.all([
                ctx.db
                    .query("discordEventSyncs")
                    .withIndex("eventId", (q) => q.eq("eventId", event._id))
                    .unique(),
                ctx.db
                    .query("discordAnnouncements")
                    .withIndex("eventId", (q) => q.eq("eventId", event._id))
                    .unique(),
            ])
            if (
                isAnnouncementMigrationDue({
                    gameEnd: event.gameEnd,
                    now,
                    hasMessage: hasMigratableMessage(sync),
                    layoutVersion: row?.layoutVersion ?? null,
                    migrationVersion: row?.migrationVersion ?? null,
                    version: args.version,
                })
            )
                due.push({ eventId: String(event._id), guildId: event.guildId })
        }
        return due
    },
})

/**
 * Everything "Zobrazit přihlášené" shows (L1-69..86): the match, its groups,
 * each sign-up's time and membership, display names, and the members without
 * an answer with whether a reminder can go to them now. The bot decides who
 * sees the leadership parts with a fresh role check.
 */
export const getAttendees = query({
    args: {
        secret: v.string(),
        eventId: v.id("events"),
        guildId: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const event = await ctx.db.get(args.eventId)
        if (
            !event ||
            isDraftEvent(event) ||
            (args.guildId && event.guildId !== args.guildId)
        )
            return null
        const guildId = event.guildId
        const [config, guild, groups, roster, assignments, activities] =
            await Promise.all([
                ctx.db
                    .query("discordConfigs")
                    .withIndex("guildId", (q) => q.eq("guildId", guildId))
                    .unique(),
                getGuildByDiscordId(ctx, guildId),
                ctx.db
                    .query("groups")
                    .withIndex("guildId", (q) => q.eq("guildId", guildId))
                    .collect(),
                ctx.db
                    .query("rosters")
                    .withIndex("eventId", (q) => q.eq("eventId", event._id))
                    .unique(),
                ctx.db
                    .query("userAssignments")
                    .withIndex("serverId", (q) => q.eq("serverId", guildId))
                    .collect(),
                ctx.db
                    .query("signupActivities")
                    .withIndex("eventId_occurredAt", (q) =>
                        q.eq("eventId", event._id)
                    )
                    .collect(),
            ])
        if (!config) return null
        const normalized = normalizeEventDoc(event)
        const gameAssignments = assignments.filter((assignment) =>
            matchesGameScope(assignment.gameId, event.gameId)
        )
        const unanswered = describeManualReminderAudience({
            audience: "unanswered",
            event: {
                kind: event.kind,
                gameId: event.gameId,
                status: event.status,
                isDraft: event.isDraft,
                registrationEnd: event.registrationEnd,
                meetingStart: event.meetingStart,
                allowedSignupStatuses: event.allowedSignupStatuses,
                participants: event.participants ?? [],
                absenceNotices: event.absenceNotices ?? [],
            },
            roster,
            assignments: gameAssignments,
            now: new Date(),
        })
        const memberships = gameAssignments.flatMap((assignment) => {
            const membership = signupListMembership(assignment)
            return membership ? [{ userId: assignment.userId, membership }] : []
        })
        const userIds = new Set([
            ...normalized.participants.map((participant) => participant.userId),
            ...unanswered.userIds,
        ])
        const names: Array<{ userId: string; name: string }> = []
        for (const userId of userIds) {
            const name = await clanName(ctx, userId, guildId)
            if (name) names.push({ userId, name })
        }
        const matchType = event.matchType?.trim().toLowerCase()
        const category = matchType
            ? guild?.eventCategories?.find(
                  (item) => item.id.trim().toLowerCase() === matchType
              )
            : undefined
        return {
            config: normalizeConfigDoc(
                withGameOverrides(config, config.gameOverrides, event.gameId)
            ),
            // The clan's dashboard record, for "Otevřít na webu" (L1-85):
            // dashboard URLs name the Convex guild, never the Discord ID.
            serverId: guild ? String(guild._id) : null,
            event: normalized,
            category: category
                ? { label: category.label, color: category.color ?? null }
                : null,
            groups: groups.map((group) => {
                const doc = normalizeDoc(group)
                return { id: doc.id, name: group.name }
            }),
            memberships,
            signedUpAt: [...signupTimesFromActivities(activities)].map(
                ([userId, at]) => ({ userId, at })
            ),
            names,
            unanswered,
        }
    },
})
