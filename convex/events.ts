import {
    handleApplyEventScore,
    handleAppendAttendanceReminderLog,
    handleConcludeEvent,
    handleFindNoticeTarget,
    handleFindStartedNoticeEvent,
    handleReconcileStatuses,
    handleSetEventResult,
    handleToggleSignup,
    handleUpsertEvent,
    handleUpsertNotice,
} from "../src/infrastructure/convex/event-handlers"
import {
    ConvexEventCommandRepository,
    ConvexEventScoreRepository,
    DelegatingEventScorePort,
} from "../src/infrastructure/convex/event-command-repositories"
import {
    ConvexEventWorkflowRepository,
    ConvexEventWorkflowSyncPort,
} from "../src/infrastructure/convex/event-workflow-repositories"
import { ReconcileEventStatusesUseCase } from "../src/application/events/reconcile-event-statuses.use-case"
import { CompleteTrainingUseCase } from "../src/application/events/complete-training.use-case"
import { syncEventAssetReferences } from "../src/infrastructure/convex/event-asset-references"
import {
    getGuildById,
    getGuildByDiscordId,
    getGuildDiscordId,
} from "./identity"
import { ApplyEventScoreUseCase } from "../src/application/events/apply-event-score.use-case"
import { ConcludeEventUseCase } from "../src/application/events/conclude-event.use-case"
import { UpsertNoticeUseCase } from "../src/application/events/upsert-notice.use-case"
import { ToggleSignupUseCase } from "../src/application/events/toggle-signup.use-case"
import { UpsertEventUseCase } from "../src/application/events/upsert-event.use-case"
import { refreshEventSchedule } from "../src/infrastructure/convex/event-scheduling"
import { fixtureScoreFromEvent } from "../src/domain/competitions/competition"
import { assertInternalSecret, internalAuthSecret } from "./discord_shared"
import { normalizeEventRecord } from "../src/domain/events/normalization"
import { currentEventStatus } from "../src/domain/events/status"
import { queueEventDiscordDeletion } from "./eventDeletionQueue"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import { recordImportedResult } from "./eventResultStore"
import { systemClock } from "../src/domain/shared/clock"
import { DEFAULT_ROSTER_SCORE_SETTINGS } from "./guilds"
import { resolveEventMatchTeams } from "./matchTeams"
import { eventWriteFields } from "./eventValidators"
import { matchTeamInput } from "./teamValidators"
import type { Id } from "./_generated/dataModel"
import { mutation } from "./integrationMutation"
import { eventTeamSides } from "./competitions"
import { query } from "./_generated/server"
import { v } from "convex/values"

const attendanceReminder = v.object({
    userId: v.string(),
    offsetHours: v.number(),
    sentAt: v.string(),
})

const eventResult = v.object({
    sourceUrl: v.string(),
    mapId: v.string(),
    mapName: v.optional(v.string()),
    endedAt: v.optional(v.string()),
    importedAt: v.string(),
    sideA: v.string(),
    sideB: v.string(),
    outcome: v.union(
        v.literal("victory"),
        v.literal("defeat"),
        v.literal("draw")
    ),
    score: v.object({
        sideA: v.number(),
        sideB: v.number(),
    }),
})

async function applyScoreToEventSignups(
    ctx: MutationCtx,
    eventId: Id<"events">
) {
    return await new ApplyEventScoreUseCase(
        new ConvexEventScoreRepository(ctx, DEFAULT_ROSTER_SCORE_SETTINGS)
    ).execute(String(eventId))
}

export const upsert = mutation({
    args: {
        secret: v.string(),
        serverId: v.id("guilds"),
        eventId: v.optional(v.id("events")),
        gameId: v.optional(v.string()),
        kind: v.optional(v.union(v.literal("match"), v.literal("training"))),
        matchType: v.optional(v.string()),
        name: v.string(),
        description: v.optional(v.string()),
        thumbnailUrl: v.optional(v.string()),
        imageUrl: v.optional(v.string()),
        announcementChannelId: v.optional(v.string()),
        eventInfoChannelId: v.optional(v.string()),
        eventResultsChannelId: v.optional(v.string()),
        meetingChannelId: v.optional(v.string()),
        createSquadVoiceChannels: v.optional(v.boolean()),
        squadVoiceCategoryId: v.optional(v.string()),
        durationMinutes: v.optional(v.number()),
        requiredRoleIds: v.optional(v.array(v.string())),
        rewardRoleIds: v.optional(v.array(v.string())),
        signupGroupIds: v.optional(v.array(v.string())),
        allowedSignupStatuses: v.optional(
            v.array(
                v.union(
                    v.literal("recruit"),
                    v.literal("member"),
                    v.literal("reserve_member"),
                    v.literal("mercenary")
                )
            )
        ),
        allowNonMembersSignup: v.optional(v.boolean()),
        useGeneralSignup: v.optional(v.boolean()),
        signupReminderStatuses: v.optional(
            v.array(
                v.union(
                    v.literal("recruit"),
                    v.literal("member"),
                    v.literal("reserve_member")
                )
            )
        ),
        recurrence: v.optional(
            v.object({
                frequency: v.union(
                    v.literal("weekly"),
                    v.literal("monthly_date"),
                    v.literal("monthly_nth_weekday")
                ),
                interval: v.number(),
                weekdays: v.array(v.number()),
                monthDay: v.optional(v.number()),
                nth: v.optional(v.number()),
                weekday: v.optional(v.number()),
            })
        ),
        server: v.optional(v.string()),
        serverPassword: v.optional(v.string()),
        side: v.optional(v.string()),
        map: v.optional(v.string()),
        timeOfDay: eventWriteFields.timeOfDay,
        tacticalPlan: eventWriteFields.tacticalPlan,
        cap: v.optional(v.string()),
        notes: v.optional(v.string()),
        registrationStart: v.optional(v.string()),
        registrationEnd: v.string(),
        meetingStart: v.string(),
        gameStart: v.string(),
        gameEnd: v.string(),
        pingClan: v.boolean(),
        pingMode: v.optional(
            v.union(v.literal("none"), v.literal("clan"), v.literal("roles"))
        ),
        pingRoleIds: v.optional(v.array(v.string())),
        createForumChannel: v.optional(v.boolean()),
        createSignupThread: v.optional(v.boolean()),
        deleteForumAfterConclusion: v.optional(v.boolean()),
        topicPresetId: v.optional(v.id("topicPresets")),
        stratmapIds: v.optional(v.array(v.id("stratmaps"))),
        // Directory team selections (identity, slot, side); snapshots are captured here.
        matchTeams: v.optional(v.array(matchTeamInput)),
        // Template settings; omitted keeps the saved value on an update, [] clears.
        signupGroupLimits: eventWriteFields.signupGroupLimits,
        attendanceReminderHours: eventWriteFields.attendanceReminderHours,
        createParticipantRoles: eventWriteFields.createParticipantRoles,
        // null clears the roster's squad preset on an update.
        squadPresetId: v.optional(v.union(v.id("squadPresets"), v.null())),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        if (args.squadPresetId) {
            // A preset of another clan is never stored on this clan's event.
            const [guild, preset] = await Promise.all([
                getGuildById(ctx, String(args.serverId)),
                ctx.db.get(args.squadPresetId),
            ])
            if (
                !guild ||
                !preset ||
                preset.guildId !== getGuildDiscordId(guild)
            )
                throw new Error("Referenced squad preset was not found.")
        }
        const eventId = await handleUpsertEvent({
            secret: args.secret,
            expectedSecret: internalAuthSecret(),
            args: {
                ...args,
                serverId: String(args.serverId),
                eventId: args.eventId ? String(args.eventId) : undefined,
                topicPresetId: args.topicPresetId
                    ? String(args.topicPresetId)
                    : undefined,
                stratmapIds: args.stratmapIds?.map((value) => String(value)),
                allowedSignupStatuses: args.allowedSignupStatuses,
                allowNonMembersSignup: args.allowNonMembersSignup,
                squadPresetId:
                    args.squadPresetId === null
                        ? ""
                        : args.squadPresetId
                          ? String(args.squadPresetId)
                          : undefined,
            },
            getGuildById: async (serverId) => await getGuildById(ctx, serverId),
            getGuildDiscordId,
            getEventById: async (eventId) =>
                await ctx.db.get(eventId as Id<"events">),
            resolveMatchTeams: async ({ existing }) => {
                const resolved = await resolveEventMatchTeams(ctx, {
                    gameId: args.gameId ?? existing?.gameId,
                    kind: args.kind ?? existing?.kind,
                    status: existing ? currentEventStatus(existing) : undefined,
                    inputs: args.matchTeams,
                    previous: existing?.matchTeams,
                    now: new Date().toISOString(),
                })
                // The dashboard route maps this prefix to a 400 with the bare code.
                if (!resolved.ok)
                    throw new Error(`match_teams:${resolved.error}`)
                return resolved.matchTeams
            },
            createUseCase: () =>
                new UpsertEventUseCase(
                    new ConvexEventCommandRepository(ctx),
                    new DelegatingEventScorePort((eventId) =>
                        applyScoreToEventSignups(
                            ctx,
                            eventId as Id<"events">
                        ).then(() => undefined)
                    ),
                    systemClock
                ),
        })
        const saved = await ctx.db.get(eventId as Id<"events">)
        if (saved) await syncEventAssetReferences(ctx, saved)
        await refreshEventSchedule(ctx, eventId as Id<"events">)
        return eventId
    },
})

export const getById = query({
    args: {
        secret: v.string(),
        eventId: v.id("events"),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const event = await ctx.db.get(args.eventId)
        return event
            ? { ...normalizeEventRecord(event), id: String(event._id) }
            : null
    },
})

/** The server's events with their roster reserves, for `/notice`. */
async function noticeCandidates(ctx: QueryCtx, discordGuildId: string) {
    const guild = await getGuildByDiscordId(ctx, discordGuildId)
    if (guild && getGuildDiscordId(guild) !== discordGuildId) return null
    const keys = new Set([
        discordGuildId,
        ...(guild ? [String(guild._id), ...(guild.id ? [guild.id] : [])] : []),
    ])
    const events = (
        await Promise.all(
            [...keys].map((guildId) =>
                ctx.db
                    .query("events")
                    .withIndex("guildId", (q) => q.eq("guildId", guildId))
                    .collect()
            )
        )
    ).flat()
    const withReserves = await Promise.all(
        events.map(async (event) => {
            const roster = await ctx.db
                .query("rosters")
                .withIndex("eventId", (q) => q.eq("eventId", event._id))
                .unique()
            return {
                ...event,
                reservePlayerIds: roster?.reservePlayerIds ?? [],
            }
        })
    )
    return { guild, events, withReserves }
}

const noticeQueryArgs = {
    secret: v.string(),
    guildId: v.string(),
    userId: v.string(),
    query: v.string(),
}

export const findNoticeTarget = query({
    args: noticeQueryArgs,
    handler: async (ctx, args) => {
        if (args.secret !== internalAuthSecret())
            throw new Error("Unauthorized.")
        const candidates = await noticeCandidates(ctx, args.guildId)
        if (!candidates) return []
        const { guild, events, withReserves: eventsWithReserves } = candidates

        const targets = handleFindNoticeTarget({
            events: eventsWithReserves,
            userId: args.userId,
            query: args.query.trim(),
            now: new Date(),
        })
        // The match category ("Přátelák", "Liga") labels /notice's choices.
        const byId = new Map(events.map((event) => [String(event._id), event]))
        return targets.map((target) => {
            const event = byId.get(target.id)
            const categoryId =
                event?.kind === "training"
                    ? undefined
                    : event?.matchType?.trim() || undefined
            const label = categoryId
                ? (guild?.eventCategories?.find(
                      (category) => category.id === categoryId
                  )?.label ?? categoryId)
                : undefined
            return label ? { ...target, categoryLabel: label } : target
        })
    },
})

/**
 * `/notice` typed a signed-up event that already started (M3-19): its ID and
 * name, so the bot answers "VLK vs ROG už začal" instead of "not signed up".
 */
export const findStartedNoticeEvent = query({
    args: noticeQueryArgs,
    handler: async (ctx, args) => {
        if (args.secret !== internalAuthSecret())
            throw new Error("Unauthorized.")
        const candidates = await noticeCandidates(ctx, args.guildId)
        if (!candidates) return null
        return handleFindStartedNoticeEvent({
            events: candidates.withReserves,
            userId: args.userId,
            query: args.query.trim(),
            now: new Date(),
        })
    },
})

export const toggleSignUp = mutation({
    args: {
        secret: v.string(),
        eventId: v.id("events"),
        userId: v.string(),
        group: v.union(v.string(), v.null()),
        profile: v.optional(v.object({ name: v.string(), avatar: v.string() })),
    },
    handler: async (ctx, args) => {
        return await handleToggleSignup({
            secret: args.secret,
            expectedSecret: internalAuthSecret(),
            args: {
                eventId: String(args.eventId),
                userId: args.userId,
                group: args.group,
                profile: args.profile,
            },
            createUseCase: () =>
                new ToggleSignupUseCase(
                    new ConvexEventWorkflowRepository(ctx),
                    new ConvexEventWorkflowSyncPort(ctx),
                    systemClock
                ),
        })
    },
})

export const reconcileStatuses = mutation({
    args: {
        secret: v.string(),
        cursor: v.optional(v.string()),
        limit: v.optional(v.number()),
        eventId: v.optional(v.id("events")),
    },
    handler: async (ctx, args) => {
        return await handleReconcileStatuses({
            secret: args.secret,
            expectedSecret: internalAuthSecret(),
            args: {
                cursor: args.cursor ?? null,
                limit: args.limit ?? 25,
                eventId: args.eventId ? String(args.eventId) : undefined,
            },
            createUseCase: () =>
                new ReconcileEventStatusesUseCase(
                    new ConvexEventCommandRepository(ctx),
                    new DelegatingEventScorePort((eventId) =>
                        applyScoreToEventSignups(
                            ctx,
                            eventId as Id<"events">
                        ).then(() => undefined)
                    ),
                    systemClock
                ),
        })
    },
})

export const applyEventScore = mutation({
    args: {
        secret: v.string(),
        eventId: v.id("events"),
    },
    handler: async (ctx, args) => {
        if (args.secret !== internalAuthSecret()) {
            throw new Error("Unauthorized.")
        }

        return await handleApplyEventScore({
            eventId: String(args.eventId),
            createUseCase: () =>
                new ApplyEventScoreUseCase(
                    new ConvexEventScoreRepository(
                        ctx,
                        DEFAULT_ROSTER_SCORE_SETTINGS
                    )
                ),
        })
    },
})

export const conclude = mutation({
    args: {
        secret: v.string(),
        eventId: v.id("events"),
    },
    handler: async (ctx, args) => {
        return await handleConcludeEvent({
            secret: args.secret,
            expectedSecret: internalAuthSecret(),
            eventId: String(args.eventId),
            createUseCase: () =>
                new ConcludeEventUseCase(
                    new ConvexEventCommandRepository(ctx),
                    new DelegatingEventScorePort((eventId) =>
                        applyScoreToEventSignups(
                            ctx,
                            eventId as Id<"events">
                        ).then(() => undefined)
                    ),
                    systemClock
                ),
        })
    },
})

export const completeTraining = mutation({
    args: {
        secret: v.string(),
        eventId: v.id("events"),
        participants: v.array(
            v.object({
                userId: v.string(),
                completed: v.union(v.literal("passed"), v.literal("failed")),
            })
        ),
    },
    handler: async (ctx, args) => {
        if (args.secret !== internalAuthSecret()) {
            throw new Error("Unauthorized.")
        }

        return await new CompleteTrainingUseCase(
            new ConvexEventCommandRepository(ctx),
            new DelegatingEventScorePort((eventId) =>
                applyScoreToEventSignups(ctx, eventId as Id<"events">).then(
                    () => undefined
                )
            ),
            systemClock
        ).execute(String(args.eventId), {
            participants: args.participants,
        })
    },
})

export const appendAttendanceReminderLog = mutation({
    args: {
        secret: v.string(),
        eventId: v.id("events"),
        reminders: v.array(attendanceReminder),
    },
    handler: async (ctx, args) => {
        return await handleAppendAttendanceReminderLog({
            secret: args.secret,
            expectedSecret: internalAuthSecret(),
            eventId: String(args.eventId),
            reminders: args.reminders,
            getEventById: async (eventId) =>
                await ctx.db.get(eventId as Id<"events">),
            patchEvent: async (eventId, patch) =>
                await ctx.db.patch(eventId as Id<"events">, patch),
        })
    },
})

export const upsertNotice = mutation({
    args: {
        secret: v.string(),
        eventId: v.id("events"),
        userId: v.string(),
        reason: v.string(),
    },
    handler: async (ctx, args) => {
        return await handleUpsertNotice({
            secret: args.secret,
            expectedSecret: internalAuthSecret(),
            args: {
                eventId: String(args.eventId),
                userId: args.userId,
                reason: args.reason,
            },
            createUseCase: () =>
                new UpsertNoticeUseCase(
                    new ConvexEventWorkflowRepository(ctx),
                    systemClock
                ),
        })
    },
})

export const setDiscordEventRoles = mutation({
    args: {
        secret: v.string(),
        eventId: v.id("events"),
        guildId: v.optional(v.string()),
        attendeeRoleId: v.optional(v.string()),
        reserveRoleId: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        if (args.secret !== internalAuthSecret())
            throw new Error("Unauthorized.")
        if (!(await ctx.db.get(args.eventId))) {
            if (args.guildId)
                await queueEventDiscordDeletion(ctx, String(args.eventId), {
                    guildId: args.guildId,
                    messages: [],
                    channelIds: [],
                    roleIds: [args.attendeeRoleId, args.reserveRoleId].filter(
                        (id): id is string => Boolean(id)
                    ),
                    scheduledEventIds: [],
                })
            return
        }
        await ctx.db.patch(args.eventId, {
            attendeeRoleId: args.attendeeRoleId,
            reserveRoleId: args.reserveRoleId,
            updatedAt: new Date().toISOString(),
        })
    },
})

export const setResult = mutation({
    args: {
        secret: v.string(),
        eventId: v.id("events"),
        eventResult,
    },
    handler: async (ctx, args) => {
        const result = await handleSetEventResult({
            secret: args.secret,
            expectedSecret: internalAuthSecret(),
            eventId: String(args.eventId),
            eventResult: args.eventResult,
            getEventById: async (eventId) =>
                await ctx.db.get(eventId as Id<"events">),
            patchEvent: async (eventId, patch) =>
                await ctx.db.patch(eventId as Id<"events">, patch),
        })
        const event = await ctx.db.get(args.eventId)
        const fixture = event?.competitionFixtureId
            ? await ctx.db.get(event.competitionFixtureId)
            : null
        // The imported score is Axis/Allies; each fixture team gets the score
        // of the side it played. Unknown sides leave the fixture for an admin.
        const score =
            event && fixture?.sideATeamId && fixture.sideBTeamId
                ? fixtureScoreFromEvent({
                      fixture: {
                          sideATeamId: String(fixture.sideATeamId),
                          sideBTeamId: String(fixture.sideBTeamId),
                      },
                      eventTeams: await eventTeamSides(ctx, event),
                      score: args.eventResult.score,
                  })
                : null
        if (fixture && score)
            await ctx.db.patch(fixture._id, {
                ...score,
                status: "final",
                updatedAt: new Date().toISOString(),
            })
        await recordImportedResult(ctx, args.eventId, args.eventResult)
        return result
    },
})
