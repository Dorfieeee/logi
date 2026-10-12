import {
    MAX_OCCURRENCES_PER_PASS,
    RECURRENCE_HORIZON_DAYS,
    recurringOccurrenceInput,
    weeklyOccurrenceStarts,
} from "../src/domain/events/recurrence"
import { syncEventAssetReferences } from "../src/infrastructure/convex/event-asset-references"
import { refreshEventSchedule } from "../src/infrastructure/convex/event-scheduling"
import { buildCreateEventRecord } from "../src/domain/events/upsert-policy"
import { assertInternalSecret } from "./discord_shared"
import type { Doc } from "./_generated/dataModel"
import { mutation } from "./integrationMutation"
import { v } from "convex/values"

const DAY_MS = 24 * 60 * 60 * 1000
/** Upper bound of events one pass creates across all clans. */
const MAX_CREATED_PER_PASS = 50

function seriesInput(source: Doc<"events">) {
    return {
        guildId: source.guildId,
        gameId: source.gameId,
        kind: source.kind,
        matchType: source.matchType,
        name: source.name,
        description: source.description,
        thumbnailUrl: source.thumbnailUrl,
        imageUrl: source.imageUrl,
        announcementChannelId: source.announcementChannelId,
        eventInfoChannelId: source.eventInfoChannelId,
        meetingChannelId: source.meetingChannelId,
        createSquadVoiceChannels: source.createSquadVoiceChannels,
        squadVoiceCategoryId: source.squadVoiceCategoryId,
        durationMinutes: source.durationMinutes,
        requiredRoleIds: source.requiredRoleIds,
        rewardRoleIds: source.rewardRoleIds,
        server: source.server,
        serverPassword: source.serverPassword,
        side: source.side,
        map: source.map,
        timeOfDay: source.timeOfDay,
        tacticalPlan: source.tacticalPlan,
        cap: source.cap,
        notes: source.notes,
        registrationStart: source.registrationStart,
        registrationEnd: source.registrationEnd,
        meetingStart: source.meetingStart,
        gameStart: source.gameStart,
        gameEnd: source.gameEnd,
        pingClan: source.pingClan,
        pingMode: source.pingMode,
        pingRoleIds: source.pingRoleIds,
        createForumChannel: source.createForumChannel,
        topicPresetId: source.topicPresetId
            ? String(source.topicPresetId)
            : undefined,
        stratmapIds: source.stratmapIds?.map((id) => String(id)),
        signupGroupIds: source.signupGroupIds,
        allowedSignupStatuses: source.allowedSignupStatuses,
        useGeneralSignup: source.useGeneralSignup,
        signupReminderStatuses: source.signupReminderStatuses,
        signupGroupLimits: source.signupGroupLimits,
        attendanceReminderHours: source.attendanceReminderHours,
        createParticipantRoles: source.createParticipantRoles,
        squadPresetId: source.squadPresetId
            ? String(source.squadPresetId)
            : undefined,
    }
}

/**
 * Creates the next occurrences of every weekly match series two weeks ahead
 * ("Repeat every week"). The series event carries the recurrence; generated
 * events point back at it with `recurrenceSeriesId` and carry none, so they
 * never start series of their own. A start that already exists in the series
 * is never created twice, drafts and stopped series (recurrence removed) are
 * skipped, and one pass creates a bounded number of events. Monthly series
 * are not generated. The bot calls this at start and then every 15 minutes
 * and refreshes the dashboard for each created event.
 *
 * Events are large documents, so the pass never reads the whole table: the
 * weekly series come from the `recurrence_frequency` index and each one's
 * occurrences from `recurrenceSeriesId_gameStart`, bounded to starts from
 * now on. Earlier occurrences cannot collide with a new start, because a
 * pass only creates starts after the latest existing one (and after now).
 */
export const generateDue = mutation({
    args: { secret: v.string() },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const now = new Date()
        const nowIso = now.toISOString()
        const until = new Date(
            now.getTime() + RECURRENCE_HORIZON_DAYS * DAY_MS
        ).toISOString()
        const series = (
            await ctx.db
                .query("events")
                .withIndex("recurrence_frequency", (q) =>
                    q.eq("recurrence.frequency", "weekly")
                )
                .collect()
        ).filter(
            (event) =>
                !event.recurrenceSeriesId &&
                event.isDraft !== true &&
                (event.kind ?? "match") === "match"
        )
        const created: Array<{ eventId: string; guildId: string }> = []
        const zones = new Map<string, string>()
        for (const source of series) {
            if (created.length >= MAX_CREATED_PER_PASS) break
            const occurrences = (
                await ctx.db
                    .query("events")
                    .withIndex("recurrenceSeriesId_gameStart", (q) =>
                        q
                            .eq("recurrenceSeriesId", source._id)
                            .gte("gameStart", nowIso)
                    )
                    .collect()
            ).filter((event) => event.guildId === source.guildId)
            const existing = new Set([
                source.gameStart,
                ...occurrences.map((event) => event.gameStart),
            ])
            const latest = Math.max(
                now.getTime(),
                ...[...existing].map((start) => Date.parse(start) || 0)
            )
            if (!zones.has(source.guildId)) {
                const config = await ctx.db
                    .query("discordConfigs")
                    .withIndex("guildId", (q) =>
                        q.eq("guildId", source.guildId)
                    )
                    .unique()
                zones.set(source.guildId, config?.timezone ?? "UTC")
            }
            const starts = weeklyOccurrenceStarts({
                seriesStart: source.gameStart,
                timeZone: zones.get(source.guildId) ?? "UTC",
                recurrence: source.recurrence!,
                after: new Date(latest).toISOString(),
                until,
                limit: Math.min(
                    MAX_OCCURRENCES_PER_PASS,
                    MAX_CREATED_PER_PASS - created.length
                ),
            }).filter((start) => !existing.has(start))
            for (const start of starts) {
                const record = buildCreateEventRecord(
                    recurringOccurrenceInput(seriesInput(source), start),
                    now
                )
                const {
                    topicPresetId: _topic,
                    stratmapIds: _stratmaps,
                    squadPresetId: _preset,
                    ...fields
                } = record
                const eventId = await ctx.db.insert("events", {
                    ...fields,
                    recurrenceSeriesId: source._id,
                    matchTeams: source.matchTeams,
                    topicPresetId: source.topicPresetId,
                    stratmapIds: source.stratmapIds,
                    squadPresetId: source.squadPresetId,
                })
                const saved = await ctx.db.get(eventId)
                if (saved) await syncEventAssetReferences(ctx, saved)
                await refreshEventSchedule(ctx, eventId)
                created.push({
                    eventId: String(eventId),
                    guildId: source.guildId,
                })
            }
        }
        return { created }
    },
})
