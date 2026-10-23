import {
    assertInternalSecret,
    normalizeConfigDoc,
    normalizeCalendarItemDoc,
    normalizeDoc,
    normalizeEventDoc,
    normalizeGuildDoc,
    normalizeUserDoc,
} from "./discord_shared"
import {
    syncDashboardAdminOverrides,
    upsertDiscordMemberCache,
} from "./discordMemberAccessStore"
import { historicalConcludedEventCutoff } from "../src/application/discord-sync/relevance"
import { matchesGameScope, withGameOverrides } from "../src/domain/games/game"
import { isDraftEvent, withoutDrafts } from "../src/domain/events/drafts"
import { eventDiscordDeletion } from "../src/domain/events/deletion"
import { getGuildByDiscordId, getGuildDiscordId } from "./identity"
import { queueEventDiscordDeletion } from "./eventDeletionQueue"
import { applyGatewayObservation } from "./memberObservations"
import { query, type QueryCtx } from "./_generated/server"
import type { Doc, Id } from "./_generated/dataModel"
import { mutation } from "./integrationMutation"
import { v } from "convex/values"

/**
 * An event as the bot reads it, with the round of the competition fixture it
 * plays, so the calendar can say "ECL, 3. kolo" (L3-14).
 */
function withCompetitionRound(
    event: Parameters<typeof normalizeEventDoc>[0],
    rounds: ReadonlyMap<string, number>
) {
    const normalized = normalizeEventDoc(event)
    const round = rounds.get(normalized.id)
    return round === undefined
        ? normalized
        : { ...normalized, competitionRound: round }
}

/**
 * The statuses of events the bot keeps acting on whatever their date; a
 * legacy row without a status (`undefined`) counts as one of them.
 */
const CURRENT_EVENT_STATUSES = [
    "registration",
    "closed",
    "starting",
    undefined,
] as const

/**
 * The published events the bot acts on, which `isHistoricalConcludedEvent`
 * (shared in `src/application/discord-sync/relevance.ts`) decides exactly:
 * every event that is not concluded, whatever its date, plus the concluded
 * ones that ended at or after the cutoff, seven days ago with a day of
 * slack. Read through `status_gameEnd`, one range per status, so the bot's
 * subscriptions, which re-run on every write to `events`, never read the
 * concluded archive, which grows for as long as a clan exists
 * (ARCHITECTURE.md, "Convex hot paths"). Drafts are left out: the bot never
 * sees them.
 */
async function listBotEvents(ctx: QueryCtx, now: Date) {
    const cutoff = historicalConcludedEventCutoff(now)
    const groups = await Promise.all([
        ...CURRENT_EVENT_STATUSES.map((status) =>
            ctx.db
                .query("events")
                .withIndex("status_gameEnd", (q) => q.eq("status", status))
                .collect()
        ),
        ctx.db
            .query("events")
            .withIndex("status_gameEnd", (q) =>
                q.eq("status", "concluded").gte("gameEnd", cutoff)
            )
            .collect(),
    ])
    return withoutDrafts(groups.flat())
}

/**
 * One row per event through the table's `eventId` index. The first row
 * wins so that a duplicate, which `getEventSyncContext` reports for its own
 * event, never breaks a subscription over every event.
 */
async function perEvent<T extends object>(
    events: ReadonlyArray<Doc<"events">>,
    read: (eventId: Id<"events">) => Promise<T | null>
): Promise<T[]> {
    const rows: Array<T | null> = await Promise.all(
        events.map((event) => read(event._id))
    )
    return rows.filter((row): row is T => row !== null)
}

/**
 * The people a clan's payload names: everyone signed up, participating or
 * excused on the served events and everyone placed on their rosters (squads,
 * reserves, not attending, the streamer). The clan's assignments are served
 * too, but nothing in the bot names an assignee who is on no event
 * (`memberNames` reads any other name from Discord), so they add no reads.
 */
function referencedUserIds(
    events: ReadonlyArray<Doc<"events">>,
    rosters: ReadonlyArray<Doc<"rosters">>
) {
    const ids = new Set<string>()
    for (const event of events) {
        for (const signUp of event.signUps ?? []) ids.add(signUp.userId)
        for (const participant of event.participants ?? [])
            ids.add(participant.userId)
        for (const notice of event.absenceNotices ?? []) ids.add(notice.userId)
    }
    for (const roster of rosters) {
        for (const squad of roster.squads)
            for (const player of squad.players)
                if (player.id) ids.add(player.id)
        for (const id of roster.reservePlayerIds) ids.add(id)
        for (const id of roster.notAttendingPlayerIds) ids.add(id)
        if (roster.streamerId) ids.add(roster.streamerId)
    }
    ids.delete("")
    return ids
}

/**
 * The referenced users, one by one through the `users` indexes (`id`, then
 * `discordId`, as a reference may carry either; a record ID as a last
 * resort), never the whole table, which holds every Discord member ever
 * seen across all clans (ARCHITECTURE.md, "Convex hot paths"). The first
 * row wins so a duplicate never fails the payload. Keyed by the identifier
 * looked up.
 */
async function usersByIdentifier(
    ctx: QueryCtx,
    identifiers: ReadonlySet<string>
): Promise<Map<string, Doc<"users">>> {
    const found = await Promise.all(
        [...identifiers].map(async (identifier) => {
            const recordId = ctx.db.normalizeId("users", identifier)
            const user =
                (await ctx.db
                    .query("users")
                    .withIndex("id", (q) => q.eq("id", identifier))
                    .first()) ??
                (await ctx.db
                    .query("users")
                    .withIndex("discordId", (q) =>
                        q.eq("discordId", identifier)
                    )
                    .first()) ??
                (recordId ? await ctx.db.get(recordId) : null)
            return user ? ([identifier, user] as const) : null
        })
    )
    return new Map(found.filter((entry) => entry !== null))
}

/** The stored clan nickname, otherwise the Discord username, by every ID the bot may hold. */
function userDisplayNamesFor(users: Iterable<Doc<"users">>, guildId: string) {
    return Object.fromEntries(
        [...users]
            .map((user) => normalizeUserDoc(user, { guildId }))
            .flatMap((user) => {
                const displayName =
                    user.name.trim() || user.discordId || user.id
                return [
                    [user.id, displayName],
                    [user.discordId, displayName],
                ] as const
            })
    )
}

/** What the bot needs of an assignment to pick a reminder's recipients. */
function projectAssignment(assignment: Doc<"userAssignments">) {
    return {
        userId: assignment.userId,
        type: assignment.type,
        status: assignment.status,
        gameId: assignment.gameId,
    }
}

/**
 * Every configured clan's payload. The events are the ones the bot acts on
 * (`listBotEvents`): every published event whose status is not `concluded`
 * (`registration`, `closed`, `starting` or a legacy row without one),
 * whatever its date, plus the concluded ones whose `gameEnd` is at or after
 * now minus seven days, with a day of slack; drafts never. Rosters, sync
 * states and competition fixtures are read per event through `eventId`,
 * assignments per clan through `serverId`, and the users the events and
 * rosters name one by one through the `users` indexes
 * (`usersByIdentifier`). Only the small per-clan tables are read whole.
 */
export const listSyncPayloads = query({
    args: { secret: v.string() },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)

        const events = await listBotEvents(ctx, new Date())
        const [
            guilds,
            configs,
            groups,
            calendarItems,
            topicPresets,
            syncStates,
            rosters,
            fixtures,
        ] = await Promise.all([
            ctx.db.query("guilds").collect(),
            ctx.db.query("discordConfigs").collect(),
            ctx.db.query("groups").collect(),
            ctx.db.query("calendarItems").collect(),
            ctx.db.query("topicPresets").collect(),
            perEvent(events, (eventId) =>
                ctx.db
                    .query("discordEventSyncs")
                    .withIndex("eventId", (q) => q.eq("eventId", eventId))
                    .first()
            ),
            perEvent(events, (eventId) =>
                ctx.db
                    .query("rosters")
                    .withIndex("eventId", (q) => q.eq("eventId", eventId))
                    .first()
            ),
            perEvent(events, (eventId) =>
                ctx.db
                    .query("competitionFixtures")
                    .withIndex("eventId", (q) => q.eq("eventId", eventId))
                    .first()
            ),
        ])
        const [assignmentsByGuild, users] = await Promise.all([
            Promise.all(
                configs.map((config) =>
                    ctx.db
                        .query("userAssignments")
                        .withIndex("serverId", (q) =>
                            q.eq("serverId", config.guildId)
                        )
                        .collect()
                )
            ),
            usersByIdentifier(ctx, referencedUserIds(events, rosters)),
        ])
        // L3-14: the calendar names a competition match's round.
        const rounds = new Map(
            fixtures.flatMap((fixture) =>
                fixture.eventId && typeof fixture.round === "number"
                    ? [[String(fixture.eventId), fixture.round] as const]
                    : []
            )
        )

        return await Promise.all(
            configs.map(async (config, configIndex) => {
                const guild = guilds.find(
                    (item) => getGuildDiscordId(item) === config.guildId
                )
                const guildGroups = groups
                    .filter((group) => group.guildId === config.guildId)
                    .map(normalizeDoc)
                const clanEvents = events.filter(
                    (event) => event.guildId === config.guildId
                )
                const clanRosters = rosters.filter((roster) =>
                    clanEvents.some((event) => event._id === roster.eventId)
                )
                const guildEvents = clanEvents.map((event) =>
                    withCompetitionRound(event, rounds)
                )
                const guildCalendarItems = calendarItems
                    .filter((item) => item.guildId === config.guildId)
                    .map(normalizeCalendarItemDoc)
                const guildTopicPresets = topicPresets
                    .filter((preset) => preset.guildId === config.guildId)
                    .map(normalizeDoc)
                const guildSyncStates = syncStates
                    .filter((state) => state.guildId === config.guildId)
                    .map(normalizeDoc)
                const guildRosters = clanRosters.map(normalizeDoc)
                // The clan's referenced people, each user once whichever of its
                // identifiers the references carried.
                const clanUsers = new Map<string, Doc<"users">>()
                for (const id of referencedUserIds(clanEvents, clanRosters)) {
                    const user = users.get(id)
                    if (user) clanUsers.set(String(user._id), user)
                }

                const userDisplayNames = userDisplayNamesFor(
                    clanUsers.values(),
                    config.guildId
                )
                const linkedTeams = await ctx.db
                    .query("teamDirectory")
                    .withIndex("linkedGuildId", (q) =>
                        q.eq("linkedGuildId", config.guildId)
                    )
                    .take(20)

                return {
                    guild: guild
                        ? normalizeGuildDoc(guild)
                        : {
                              id: config.guildId,
                              discordId: config.guildId,
                              name: config.guildId,
                              avatar: "",
                              botInside: false,
                              adminIds: [],
                              memberIds: [],
                              mercenaryIds: [],
                              eventCategories: [],
                              calendarItems: [],
                              updatedAt: config.updatedAt,
                          },
                    config: normalizeConfigDoc(config),
                    groups: guildGroups,
                    userDisplayNames,
                    events: guildEvents,
                    calendarItems: guildCalendarItems,
                    rosters: guildRosters,
                    topicPresets: guildTopicPresets,
                    syncStates: guildSyncStates,
                    assignments:
                        assignmentsByGuild[configIndex].map(projectAssignment),
                    linkedTeams: linkedTeams
                        .filter(
                            (team) => !team.archivedAt && !team.mergedIntoTeamId
                        )
                        .map((team) => ({
                            gameId: team.gameId,
                            name: team.name,
                            shortCode: team.shortCode ?? null,
                        })),
                }
            })
        )
    },
})

/**
 * The bot's guild cache: the per-clan configuration tables, read whole. The
 * bot subscribes to this, so it re-runs on every write to these tables; the
 * clan's assignments are not part of it (see `listGuildAssignments`).
 */
export const listGuildCacheSnapshot = query({
    args: { secret: v.string() },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)

        const [
            guilds,
            configs,
            groups,
            calendarItems,
            squadPresets,
            topicPresets,
        ] = await Promise.all([
            ctx.db.query("guilds").collect(),
            ctx.db.query("discordConfigs").collect(),
            ctx.db.query("groups").collect(),
            ctx.db.query("calendarItems").collect(),
            ctx.db.query("squadPresets").collect(),
            ctx.db.query("topicPresets").collect(),
        ])

        return {
            guilds: guilds.map(normalizeGuildDoc),
            configs: configs.map(normalizeConfigDoc),
            groups: groups.map(normalizeDoc),
            calendarItems: calendarItems.map(normalizeCalendarItemDoc),
            squadPresets: squadPresets.map(normalizeDoc),
            topicPresets: topicPresets.map(normalizeDoc),
        }
    },
})

/**
 * One clan's member assignments, projected to what a sign-up reminder needs
 * to pick its recipients. The bot reads them once per due reminder through
 * `serverId`; they are deliberately not part of the guild cache
 * subscription, which would otherwise re-run on every assignment write and
 * read the whole table.
 */
export const listGuildAssignments = query({
    args: { secret: v.string(), guildId: v.string() },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const assignments = await ctx.db
            .query("userAssignments")
            .withIndex("serverId", (q) => q.eq("serverId", args.guildId))
            .collect()
        return assignments.map(projectAssignment)
    },
})

/**
 * The index the bot subscribes to for event changes: the events it acts on
 * (`listBotEvents`) and their rosters, read per event through `eventId`.
 * An event that becomes historical drops out of the index; the bot only
 * queues the events it still sees, so a drop-out is not a deletion.
 */
export const listEventSyncIndex = query({
    args: { secret: v.string() },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)

        const events = await listBotEvents(ctx, new Date())
        const rosters = await perEvent(events, (eventId) =>
            ctx.db
                .query("rosters")
                .withIndex("eventId", (q) => q.eq("eventId", eventId))
                .first()
        )

        return {
            events: events.map((event) => {
                const normalized = normalizeEventDoc(event)
                return {
                    id: normalized.id,
                    guildId: normalized.guildId,
                    status: normalized.status,
                    gameEnd: normalized.gameEnd,
                    updatedAt: normalized.updatedAt,
                }
            }),
            rosters: rosters.map((roster) => ({
                ...normalizeDoc(roster),
                eventId: String(roster.eventId),
            })),
        }
    },
})

export const getEventSyncContext = query({
    args: { secret: v.string(), eventId: v.id("events") },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)

        const event = await ctx.db.get(args.eventId)
        if (!event || isDraftEvent(event)) {
            return null
        }

        const [roster, syncState, fixture] = await Promise.all([
            ctx.db
                .query("rosters")
                .withIndex("eventId", (q) => q.eq("eventId", args.eventId))
                .unique(),
            ctx.db
                .query("discordEventSyncs")
                .withIndex("eventId", (q) => q.eq("eventId", args.eventId))
                .unique(),
            ctx.db
                .query("competitionFixtures")
                .withIndex("eventId", (q) => q.eq("eventId", args.eventId))
                .first(),
        ])
        const users = await usersByIdentifier(
            ctx,
            referencedUserIds([event], roster ? [roster] : [])
        )

        return {
            event: withCompetitionRound(
                event,
                new Map(
                    typeof fixture?.round === "number"
                        ? [[String(event._id), fixture.round]]
                        : []
                )
            ),
            roster: roster
                ? { ...normalizeDoc(roster), eventId: String(roster.eventId) }
                : null,
            syncState: syncState ? normalizeDoc(syncState) : null,
            userDisplayNames: userDisplayNamesFor(
                users.values(),
                event.guildId
            ),
        }
    },
})

export const getEventSignupContext = query({
    args: {
        secret: v.string(),
        guildId: v.optional(v.string()),
        eventId: v.id("events"),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)

        const event = await ctx.db.get(args.eventId)
        if (
            !event ||
            isDraftEvent(event) ||
            (args.guildId && event.guildId !== args.guildId)
        ) {
            return null
        }
        const guildId = event.guildId
        const [config, groups, roster, assignments, syncState] =
            await Promise.all([
                ctx.db
                    .query("discordConfigs")
                    .withIndex("guildId", (q) => q.eq("guildId", guildId))
                    .unique(),
                ctx.db
                    .query("groups")
                    .withIndex("guildId", (q) => q.eq("guildId", guildId))
                    .collect(),
                ctx.db
                    .query("rosters")
                    .withIndex("eventId", (q) => q.eq("eventId", args.eventId))
                    .unique(),
                ctx.db
                    .query("userAssignments")
                    .withIndex("serverId", (q) => q.eq("serverId", guildId))
                    .collect(),
                ctx.db
                    .query("discordEventSyncs")
                    .withIndex("eventId", (q) => q.eq("eventId", args.eventId))
                    .unique(),
            ])

        if (!config) {
            return null
        }

        return {
            config: normalizeConfigDoc(
                withGameOverrides(config, config.gameOverrides, event.gameId)
            ),
            event: normalizeEventDoc(event),
            groups: groups.map(normalizeDoc),
            assignments: assignments
                .filter((assignment) =>
                    matchesGameScope(assignment.gameId, event.gameId)
                )
                .map((assignment) => ({
                    userId: assignment.userId,
                    primaryGroupId: assignment.primaryGroupId
                        ? String(assignment.primaryGroupId)
                        : undefined,
                    secondaryGroupIds: (assignment.secondaryGroupIds ?? []).map(
                        (groupId) => String(groupId)
                    ),
                    type: assignment.type,
                    status: assignment.status,
                })),
            roster: roster ? normalizeDoc(roster) : null,
            syncState: syncState ? normalizeDoc(syncState) : null,
        }
    },
})

export const getEventInteractionContext = query({
    args: { secret: v.string(), eventId: v.id("events") },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)

        const event = await ctx.db.get(args.eventId)
        if (!event) {
            return null
        }

        const [config, groups, roster] = await Promise.all([
            ctx.db
                .query("discordConfigs")
                .withIndex("guildId", (q) => q.eq("guildId", event.guildId))
                .unique(),
            ctx.db
                .query("groups")
                .withIndex("guildId", (q) => q.eq("guildId", event.guildId))
                .collect(),
            ctx.db
                .query("rosters")
                .withIndex("eventId", (q) => q.eq("eventId", args.eventId))
                .unique(),
        ])

        if (!config) {
            return null
        }
        // The event category colour keeps private replies in the card's colour.
        const guild = await getGuildByDiscordId(ctx, event.guildId)
        const matchType = event.matchType?.trim().toLowerCase()
        const categoryColor =
            (matchType &&
                guild?.eventCategories?.find(
                    (category) => category.id.trim().toLowerCase() === matchType
                )?.color) ||
            null

        return {
            config: normalizeConfigDoc(
                withGameOverrides(config, config.gameOverrides, event.gameId)
            ),
            event: normalizeEventDoc(event),
            groups: groups.map(normalizeDoc),
            roster: roster ? normalizeDoc(roster) : null,
            categoryColor,
        }
    },
})

/** Marks an existing forum-backed event for a fresh topic-template sync. */
export const requestForumTopicResync = mutation({
    args: { secret: v.string(), eventId: v.id("events") },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)

        const event = await ctx.db.get(args.eventId)
        if (!event) throw new Error("Event not found.")
        if (event.status === "concluded")
            throw new Error("Concluded events cannot be resynced.")
        if (!event.createForumChannel || !event.topicPresetId) {
            throw new Error("This event does not have a forum topic template.")
        }

        const [preset, syncState] = await Promise.all([
            ctx.db.get(event.topicPresetId),
            ctx.db
                .query("discordEventSyncs")
                .withIndex("eventId", (q) => q.eq("eventId", args.eventId))
                .unique(),
        ])
        if (!preset || preset.guildId !== event.guildId)
            throw new Error("Topic preset not found.")
        if (!syncState?.forumChannelId)
            throw new Error("This event does not have a forum channel yet.")

        await ctx.db.patch(args.eventId, {
            updatedAt: new Date().toISOString(),
        })
        return { ok: true as const }
    },
})

export const updateEventSyncState = mutation({
    args: {
        secret: v.string(),
        eventId: v.id("events"),
        guildId: v.string(),
        announcementChannelId: v.optional(v.string()),
        announcementMessageId: v.optional(v.string()),
        eventInfoMessageId: v.optional(v.string()),
        eventInfoMessageRenderVersion: v.optional(v.string()),
        scheduledEventId: v.optional(v.string()),
        scheduledEventStatus: v.optional(
            v.union(
                v.literal("scheduled"),
                v.literal("active"),
                v.literal("completed"),
                v.literal("canceled")
            )
        ),
        forumChannelId: v.optional(v.string()),
        forumThreadId: v.optional(v.string()),
        signupThreadId: v.optional(v.string()),
        infoMessageId: v.optional(v.string()),
        debriefMessageId: v.optional(v.string()),
        topicMessageIds: v.array(v.string()),
        lastEventUpdatedAt: v.optional(v.string()),
        lastRosterUpdatedAt: v.optional(v.string()),
        lastConfigUpdatedAt: v.optional(v.string()),
        lastCalendarSyncVersion: v.optional(v.string()),
        squadVoiceChannelIds: v.optional(v.array(v.string())),
        lastSyncedAt: v.string(),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)

        // A Discord HTTP request can finish after a manager deleted the event.
        // Queue its just-created resources instead of resurrecting orphan sync state.
        if (!(await ctx.db.get(args.eventId))) {
            const config = await ctx.db
                .query("discordConfigs")
                .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
                .unique()
            await queueEventDiscordDeletion(
                ctx,
                String(args.eventId),
                eventDiscordDeletion({ guildId: args.guildId }, [args], {
                    announcementChannelId: config?.announcementsChannelId,
                    eventInfoChannelId: config?.eventInfoChannelId,
                })
            )
            return null
        }

        const now = new Date().toISOString()
        const payload = {
            guildId: args.guildId,
            announcementChannelId: args.announcementChannelId,
            announcementMessageId: args.announcementMessageId,
            eventInfoMessageId: args.eventInfoMessageId,
            eventInfoMessageRenderVersion: args.eventInfoMessageRenderVersion,
            scheduledEventId: args.scheduledEventId,
            scheduledEventStatus: args.scheduledEventStatus,
            forumChannelId: args.forumChannelId,
            forumThreadId: args.forumThreadId,
            signupThreadId: args.signupThreadId,
            infoMessageId: args.infoMessageId,
            // Only a bot that knows the Debrief writes it; an older bot
            // leaves the stored ID alone.
            ...(args.debriefMessageId
                ? { debriefMessageId: args.debriefMessageId }
                : {}),
            topicMessageIds: args.topicMessageIds,
            lastEventUpdatedAt: args.lastEventUpdatedAt,
            lastRosterUpdatedAt: args.lastRosterUpdatedAt,
            lastConfigUpdatedAt: args.lastConfigUpdatedAt,
            lastCalendarSyncVersion: args.lastCalendarSyncVersion,
            squadVoiceChannelIds: args.squadVoiceChannelIds,
            lastSyncedAt: args.lastSyncedAt,
            updatedAt: now,
        }

        const existing = await ctx.db
            .query("discordEventSyncs")
            .withIndex("eventId", (q) => q.eq("eventId", args.eventId))
            .unique()

        if (existing) {
            await ctx.db.patch(existing._id, payload)
            return String(existing._id)
        }

        const stateId = await ctx.db.insert("discordEventSyncs", {
            eventId: args.eventId,
            ...payload,
            createdAt: now,
        })

        return String(stateId)
    },
})

export const updateRosterUpdateMessage = mutation({
    args: {
        secret: v.string(),
        eventId: v.id("events"),
        guildId: v.string(),
        channelId: v.string(),
        messageId: v.string(),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const existing = await ctx.db
            .query("discordEventSyncs")
            .withIndex("eventId", (q) => q.eq("eventId", args.eventId))
            .unique()
        if (!(await ctx.db.get(args.eventId))) {
            await queueEventDiscordDeletion(ctx, String(args.eventId), {
                guildId: args.guildId,
                messages: [
                    { channelId: args.channelId, messageId: args.messageId },
                ],
                channelIds: [],
                roleIds: [],
                scheduledEventIds: [],
            })
            return null
        }
        if (!existing) return null
        await ctx.db.patch(existing._id, {
            rosterUpdateChannelId: args.channelId,
            rosterUpdateMessageId: args.messageId,
            updatedAt: new Date().toISOString(),
        })
        return String(existing._id)
    },
})

export const upsertMemberAccess = mutation({
    args: {
        secret: v.string(),
        guildId: v.string(),
        userId: v.string(),
        roleIds: v.array(v.string()),
        isAdmin: v.boolean(),
        hasDashboardAccess: v.boolean(),
        observation: v.optional(
            v.object({ epoch: v.string(), observedAt: v.string() })
        ),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        if (
            args.observation &&
            !(await applyGatewayObservation(ctx, {
                guildId: args.guildId,
                discordUserId: args.userId,
                state: "present",
                roleIds: args.roleIds,
                ...args.observation,
            }))
        )
            return null
        // Unchanged access writes nothing; a role or permission change does.
        const id = String(
            await upsertDiscordMemberCache(ctx, args.guildId, {
                userId: args.userId,
                roleIds: args.roleIds,
                isAdmin: args.isAdmin,
                hasDashboardAccess: args.hasDashboardAccess,
            })
        )
        await syncDashboardAdminOverrides(ctx, args.guildId, [args])
        return id
    },
})

export const removeMemberAccess = mutation({
    args: {
        secret: v.string(),
        guildId: v.string(),
        userId: v.string(),
        observation: v.optional(
            v.object({ epoch: v.string(), observedAt: v.string() })
        ),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        if (
            args.observation &&
            !(await applyGatewayObservation(ctx, {
                guildId: args.guildId,
                discordUserId: args.userId,
                state: "left",
                roleIds: [],
                ...args.observation,
            }))
        )
            return
        const existing = await ctx.db
            .query("discordMemberAccess")
            .withIndex("guildId_userId", (q) =>
                q.eq("guildId", args.guildId).eq("userId", args.userId)
            )
            .unique()
        if (existing) await ctx.db.delete(existing._id)
    },
})
