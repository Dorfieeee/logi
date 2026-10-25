import {
    ChannelType,
    type Client,
    type Guild,
    type TextChannel,
} from "discord.js"
import { matchImageAttachment } from "../events/match-image"
import { syncMatchResult } from "../events/match-result"
import { makeFunctionReference } from "convex/server"

import {
    cancelScheduledDiscordEvent,
    deriveScheduledEventLifecycle,
    getStoredScheduledEventStatus,
    syncScheduledDiscordEvent,
} from "../scheduled-events"
import {
    scheduledEventContentFor,
    squadCategoryNameFor,
    squadVoiceChannelNameFor,
} from "../events/match-discord"
import {
    announcementMessage,
    announcementThumbnail,
    buildAnnouncementCard,
} from "../events/announcement"
import { isRegistrationAnnouncementDue } from "../../../src/domain/events/registration-announcement"
import {
    loadAnnouncementContext,
    syncAnnouncement,
} from "../events/announcement-sync"
import { eventInfoMessageRenderVersion } from "../../../src/domain/discord-sync/render-version"
import {
    buildRosterImageUrl,
    getRosterImageVersion,
    withTimeout,
} from "../utils"
import { isMessageEnabled } from "../../../src/domain/discord-messages/notification-settings"
import type { BotErrorSource } from "../../../src/domain/discord-messages/bot-errors"
import { shouldSyncEvent, shouldWriteMinimalConcludedSyncState } from "./rules"
import { finishAnnouncementMigration } from "../events/announcement-migration"
import type { EventRecord, Roster, SyncPayload, SyncState } from "../types"
import { fetchRosterImageAttachment } from "./roster-image-attachment"
import { applicationFactionEmoji } from "../runtime/faction-emoji"
import { syncSquadVoiceChannels } from "../events/squad-voice"
import { reportClanDiscordError } from "../error-reporting"
import { syncSignupThread } from "../events/signup-thread"
import { publishManagedMessage } from "./publication"
import { logError, logInfo, logWarn } from "../log"
import { syncEventRoles } from "../event-roles"
import { getCalendarSyncVersion } from "./work"
import { convex, references } from "../convex"
import { syncForumChannel } from "../forum"
import { env } from "../environment"

// One event can legitimately include role reconciliation, two message writes,
// a scheduled Discord event and forum provisioning. Discord rate limits make
// the previous 20-second aggregate deadline too short for that valid work.
const EVENT_SYNC_TIMEOUT_MS = 60_000

/**
 * A failed part of the event sync that has its own title in the errors
 * channel: the roster card in its channel reads "Soupiska se nezveřejnila"
 * (L5-17), not the announcement's title. The cause stays readable.
 */
export class EventSyncStepError extends Error {
    constructor(
        readonly source: Extract<BotErrorSource, "roster">,
        readonly cause: unknown
    ) {
        super("Event sync step failed.")
        this.name = "EventSyncStepError"
    }
}

/** The errors channel's source of a failed event sync. */
export function eventSyncErrorSource(error: unknown): BotErrorSource {
    return error instanceof EventSyncStepError ? error.source : "announcement"
}

async function buildPublishedRosterImageAttachment(
    event: EventRecord,
    roster: Roster
) {
    const publicUrl = new URL(
        buildRosterImageUrl(
            event.id,
            getRosterImageVersion(event, roster.updatedAt)
        )
    )
    const internalOrigin = new URL(env.internalAppSiteUrl)
    const imageUrl = new URL(
        `${publicUrl.pathname}${publicUrl.search}`,
        internalOrigin
    )
    return fetchRosterImageAttachment(imageUrl, event.name)
}

async function retireEventMessage(
    client: Client,
    payload: SyncPayload,
    event: EventRecord,
    kind: "announcement" | "details" | "info",
    legacyChannelId?: string,
    legacyMessageId?: string
) {
    await publishManagedMessage(client, {
        guildId: payload.config.guildId,
        key: `event:${event.id}:${kind}`,
        revision: Math.max(
            Date.parse(payload.config.updatedAt),
            Date.parse(event.updatedAt)
        ),
        channelId: null,
        legacyChannelId,
        legacyMessageId,
        message: {},
    })
}

/** The closed-match card placed beside its roster in a dedicated info channel. */
async function syncEventDetailsMessage(input: {
    channel: TextChannel
    payload: SyncPayload
    event: EventRecord
    guild: Guild
    forumChannelId?: string
    roster: Roster | undefined
    attendeeRoleId?: string
    factionEmoji: Awaited<ReturnType<typeof applicationFactionEmoji>>
}) {
    const thumbnail = await announcementThumbnail(
        input.event,
        input.payload.config.defaultLanguage
    )
    const meetingChannelId =
        input.event.meetingChannelId?.trim() ??
        input.payload.config.meetingChannelId
    const meetingChannel = meetingChannelId
        ? input.guild.channels.cache.get(meetingChannelId)
        : undefined
    const rosterImage =
        input.roster?.published && input.roster.updatedAt
            ? await buildPublishedRosterImageAttachment(
                  input.event,
                  input.roster
              )
            : undefined
    const context = await loadAnnouncementContext(input.event.id)
    const generatedImage = !input.event.imageUrl?.trim()
        ? await matchImageAttachment(input.payload, input.event, {
              league: context.leagueLabel,
          })
        : null
    const pingRole =
        input.roster?.discordMentionPlayers &&
        input.attendeeRoleId &&
        !context.rosterPingedAt
            ? input.attendeeRoleId
            : undefined
    const { view } = buildAnnouncementCard(input.payload, input.event, {
        factionEmoji: input.factionEmoji,
        forumChannelId: input.forumChannelId,
        rosterChannelId: null,
        rosterImage: rosterImage
            ? { url: rosterImage.mediaUrl, description: input.event.name }
            : null,
        hideSignupRoster: true,
        thumbnail: thumbnail?.media ?? null,
        generatedImage: generatedImage?.media ?? null,
        announcementChannelId: input.channel.id,
        clanName: input.guild.name,
        meetingChannelName: meetingChannel?.name ?? null,
        scheduledEvent: false,
        result: null,
        publicMatch: false,
        resultsChannelId: null,
    })
    const result = await publishManagedMessage(input.guild.client, {
        guildId: input.guild.id,
        key: `event:${input.event.id}:details`,
        revision: Math.max(
            Date.parse(input.payload.config.updatedAt),
            Date.parse(input.event.updatedAt),
            Date.parse(input.roster?.updatedAt ?? "") || 0
        ),
        channelId: input.channel.id,
        message: announcementMessage(view, {
            config: input.payload.config,
            pingRoleIds: pingRole ? [pingRole] : [],
            files: [
                ...(thumbnail?.file ? [thumbnail.file] : []),
                ...(generatedImage ? [generatedImage.file] : []),
                ...(rosterImage ? [rosterImage.attachment] : []),
            ],
        }),
    })
    if (result && pingRole)
        await convex.mutation(
            makeFunctionReference<"mutation">("eventAnnouncements:record"),
            {
                secret: env.internalSecret,
                eventId: input.event.id as never,
                guildId: input.guild.id,
                rosterPinged: true,
            }
        )
}

export async function syncPayloadEvents(
    client: Client,
    queuedEventIds: Set<string>,
    payload: SyncPayload,
    options: { syncRoles: boolean } = { syncRoles: true }
) {
    for (const event of payload.events) {
        const state = payload.syncStates.find(
            (item) => item.eventId === event.id
        )
        const roster = payload.rosters.find((item) => item.eventId === event.id)
        const desiredScheduledEventStatus = payload.config.meetingChannelId
            ? getStoredScheduledEventStatus(
                  deriveScheduledEventLifecycle(event)
              )
            : undefined
        const queued = queuedEventIds.has(event.id)

        if (
            !payload.config.eventResultsChannelId &&
            shouldWriteMinimalConcludedSyncState({ event, state, queued })
        ) {
            logInfo(
                "event-sync",
                "Writing minimal sync state for concluded event without prior state",
                {
                    eventId: event.id,
                    guildId: payload.config.guildId,
                }
            )
            await convex.mutation(references.updateEventSyncState, {
                secret: env.internalSecret,
                eventId: event.id as never,
                guildId: payload.config.guildId,
                announcementChannelId: payload.config.announcementsChannelId,
                announcementMessageId: undefined,
                eventInfoMessageId: undefined,
                eventInfoMessageRenderVersion: undefined,
                scheduledEventId: undefined,
                scheduledEventStatus: desiredScheduledEventStatus,
                forumChannelId: undefined,
                forumThreadId: undefined,
                infoMessageId: undefined,
                topicMessageIds: [],
                lastEventUpdatedAt: event.updatedAt,
                lastRosterUpdatedAt: roster?.updatedAt,
                lastConfigUpdatedAt: payload.config.updatedAt,
                lastCalendarSyncVersion: getCalendarSyncVersion(event),
                lastSyncedAt: new Date().toISOString(),
            })
            continue
        }

        const needsSync = shouldSyncEvent({
            event,
            rosterUpdatedAt: roster?.updatedAt,
            configUpdatedAt: payload.config.updatedAt,
            state,
            desiredScheduledEventStatus,
            meetingChannelConfigured: Boolean(payload.config.meetingChannelId),
            eventInfoChannelConfigured:
                event.kind === "match" &&
                Boolean(
                    payload.config.announcementsChannelId &&
                    payload.config.eventInfoChannelId
                ),
            eventInfoMessageRequired:
                event.kind === "match" &&
                Boolean(
                    payload.config.announcementsChannelId &&
                    payload.config.eventInfoChannelId
                ),
            queued,
        })

        if (!needsSync) {
            logInfo(
                "event-sync",
                "Skipping event because no sync changes were detected",
                {
                    eventId: event.id,
                    guildId: payload.config.guildId,
                    status: event.status,
                }
            )
            continue
        }

        try {
            logInfo("event-sync", "Syncing event", {
                eventId: event.id,
                guildId: payload.config.guildId,
                status: event.status,
                hasState: Boolean(state),
                hasRoster: Boolean(roster),
            })
            await withTimeout(
                syncEvent(client, payload, event, state, options),
                EVENT_SYNC_TIMEOUT_MS,
                `event sync ${event.id}`
            )
        } catch (error) {
            logError("event-sync", "Discord bot event sync failed", {
                eventId: event.id,
                guildId: payload.config.guildId,
                error,
            })
            await reportClanDiscordError({
                client,
                guildId: payload.config.guildId,
                error,
                source: eventSyncErrorSource(error),
                eventId: event.id,
            })
        }
    }
}

async function syncEvent(
    client: Client,
    payload: SyncPayload,
    event: EventRecord,
    state?: SyncState,
    options: { syncRoles: boolean } = { syncRoles: true }
) {
    const guild = await client.guilds
        .fetch(payload.config.guildId)
        .catch(() => null)
    if (!guild) {
        logWarn(
            "event-sync",
            "Skipping event sync because guild could not be fetched",
            {
                eventId: event.id,
                guildId: payload.config.guildId,
            }
        )
        return
    }

    await syncMatchResult(client, payload, event)
    const roster = payload.rosters.find((item) => item.eventId === event.id)
    const eventRoles = options.syncRoles
        ? await syncEventRoles(
              guild,
              event,
              roster ?? null,
              payload.config.defaultLanguage
          )
        : {
              attendeeRoleId: event.attendeeRoleId,
              reserveRoleId: event.reserveRoleId,
          }
    let announcementMessageId = state?.announcementMessageId
    let eventInfoMessageId = state?.eventInfoMessageId
    let scheduledEventId = state?.scheduledEventId
    let scheduledEventStatus = state?.scheduledEventStatus
    let forumChannelId = state?.forumChannelId
    let signupThreadId = state?.signupThreadId
    const forumThreadId = state?.forumThreadId
    let infoMessageId = state?.infoMessageId
    let debriefMessageId = state?.debriefMessageId
    let topicMessageIds = state?.topicMessageIds ?? []
    let squadVoiceChannelIds = state?.squadVoiceChannelIds ?? []
    squadVoiceChannelIds = await syncSquadVoiceChannels({
        guild,
        event,
        roster,
        defaultCategoryId: payload.config.squadVoiceCategoryId,
        existingIds: squadVoiceChannelIds,
        names: {
            category: squadCategoryNameFor(payload, event),
            squad: (squad) =>
                squadVoiceChannelNameFor(squad, payload.config.defaultLanguage),
        },
    })

    // A concluded match's result belongs exclusively to the configured
    // results panel. Do not leave a second result card in registration or
    // event-info channels; retire the ordinary event cards at conclusion.
    const registrationAnnouncementDue =
        isRegistrationAnnouncementDue(event) && event.status !== "concluded"

    if (
        registrationAnnouncementDue &&
        event.createForumChannel &&
        payload.config.forumCategoryId &&
        !(event.status === "concluded" && !forumChannelId)
    ) {
        try {
            const topicPreset = payload.topicPresets.find(
                (preset) => preset.id === event.topicPresetId
            )
            const forumSyncResult = await syncForumChannel({
                config: payload.config,
                event,
                forumCategoryId: payload.config.forumCategoryId,
                forumChannelId,
                guild,
                existingTopicMessageIds: topicMessageIds,
                // Stored posts are found again even when archived (L1-137).
                infoMessageId,
                debriefMessageId,
                topicPreset,
                attendeeRoleId: eventRoles.attendeeRoleId,
                reserveRoleId: eventRoles.reserveRoleId,
                categories: payload.guild.eventCategories,
            })

            forumChannelId = forumSyncResult.forumChannelId
            infoMessageId = forumSyncResult.infoMessageId
            debriefMessageId = forumSyncResult.debriefMessageId
            if (
                !topicMessageIds.length &&
                forumSyncResult.topicMessageIds.length
            ) {
                topicMessageIds = forumSyncResult.topicMessageIds
            }
            // Store the Discord resource as soon as it exists. The remainder
            // of an event sync can take longer for Wardogs (three team cards,
            // uploads, and rate limits), and a later failure must not make the
            // next attempt create another event forum.
            if (forumSyncResult.stateChanged && forumChannelId) {
                await convex.mutation(references.updateEventSyncState, {
                    secret: env.internalSecret,
                    eventId: event.id as never,
                    guildId: payload.config.guildId,
                    announcementChannelId: state?.announcementChannelId,
                    announcementMessageId,
                    eventInfoMessageId,
                    eventInfoMessageRenderVersion:
                        state?.eventInfoMessageRenderVersion,
                    scheduledEventId,
                    scheduledEventStatus,
                    forumChannelId,
                    forumThreadId,
                    infoMessageId,
                    debriefMessageId,
                    topicMessageIds,
                    lastEventUpdatedAt: event.updatedAt,
                    lastRosterUpdatedAt: roster?.updatedAt,
                    lastConfigUpdatedAt: payload.config.updatedAt,
                    lastCalendarSyncVersion: getCalendarSyncVersion(event),
                    squadVoiceChannelIds,
                    lastSyncedAt: new Date().toISOString(),
                })
            }
            logInfo("forum", "Forum sync completed", {
                eventId: event.id,
                guildId: payload.config.guildId,
                forumChannelId,
                infoMessageId,
                topicMessageCount: topicMessageIds.length,
            })
        } catch (error) {
            logError("forum", "Discord bot forum sync failed", {
                eventId: event.id,
                guildId: payload.config.guildId,
                forumChannelId,
                error,
            })
        }
    } else {
        logInfo("forum", "Skipping forum sync", {
            eventId: event.id,
            guildId: payload.config.guildId,
            reason: !event.createForumChannel
                ? "event-forum-creation-disabled"
                : !payload.config.forumCategoryId
                  ? "forum-category-not-configured"
                  : "concluded-without-existing-forum",
        })
    }

    logInfo("event-sync", "Event sync started", {
        eventId: event.id,
        guildId: payload.config.guildId,
        eventStatus: event.status,
        announcementChannelId: payload.config.announcementsChannelId,
        eventInfoChannelId: payload.config.eventInfoChannelId,
        meetingChannelId: payload.config.meetingChannelId,
        forumCategoryId: payload.config.forumCategoryId,
        createForumChannel: event.createForumChannel,
    })

    // New events snapshot their routing; records created before this field was
    // introduced intentionally retain the central-setting fallback.
    const announcementChannelId =
        event.announcementChannelId ?? payload.config.announcementsChannelId
    const eventInfoChannelId =
        event.eventInfoChannelId ?? payload.config.eventInfoChannelId
    const splitChannels =
        event.kind === "match" &&
        Boolean(
            announcementChannelId &&
            eventInfoChannelId &&
            announcementChannelId !== eventInfoChannelId
        )
    logInfo("event-sync", "Resolved event message channels", {
        eventId: event.id,
        eventKind: event.kind,
        registrationChannelId: announcementChannelId,
        eventInfoChannelId,
        splitChannels,
        rosterPublished: Boolean(roster?.published),
    })
    const registrationChannel = announcementChannelId
        ? await guild.channels.fetch(announcementChannelId).catch(() => null)
        : null
    const infoChannel =
        splitChannels && eventInfoChannelId
            ? await guild.channels.fetch(eventInfoChannelId).catch(() => null)
            : null
    // A dedicated info channel takes over once registration closes: remove
    // the now-actionless registration card and keep the match details and
    // roster together there. Single-channel matches deliberately retain the
    // one evolving announcement card.
    const registrationMessageVisible =
        registrationAnnouncementDue &&
        event.status !== "concluded" &&
        (!splitChannels || event.status === "registration")
    if (!registrationMessageVisible) {
        await retireEventMessage(
            client,
            payload,
            event,
            "announcement",
            state?.announcementChannelId ?? announcementChannelId,
            announcementMessageId
        )
        announcementMessageId = undefined
    }
    if (event.status === "concluded" || !registrationAnnouncementDue) {
        await retireEventMessage(
            client,
            payload,
            event,
            "info",
            eventInfoChannelId,
            eventInfoMessageId
        )
        await retireEventMessage(client, payload, event, "details")
        eventInfoMessageId = undefined
    }
    // The roster card has its own channel in split mode (W6b's message).
    if (
        splitChannels &&
        registrationAnnouncementDue &&
        event.status !== "concluded" &&
        infoChannel?.isTextBased() &&
        infoChannel.type !== ChannelType.GuildVoice
    ) {
        const infoText = infoChannel as TextChannel
        if (event.status !== "registration") {
            await retireEventMessage(
                client,
                payload,
                event,
                "info",
                infoText.id,
                eventInfoMessageId
            )
            eventInfoMessageId = undefined
            await syncEventDetailsMessage({
                channel: infoText,
                payload,
                event,
                guild,
                forumChannelId,
                roster,
                attendeeRoleId: eventRoles.attendeeRoleId,
                factionEmoji: await applicationFactionEmoji(client),
            })
        } else {
            await retireEventMessage(client, payload, event, "details")
            await retireEventMessage(
                client,
                payload,
                event,
                "info",
                infoText.id,
                eventInfoMessageId
            )
            eventInfoMessageId = undefined
        }
        logInfo("event-sync", "Synchronized event info message", {
            eventId: event.id,
            guildId: payload.config.guildId,
            messageId: eventInfoMessageId,
            rosterImageAttached: Boolean(
                event.kind === "match" && roster?.published
            ),
        })
    }
    if (!splitChannels && registrationAnnouncementDue) {
        await retireEventMessage(
            client,
            payload,
            event,
            "info",
            eventInfoChannelId,
            eventInfoMessageId
        )
        eventInfoMessageId = undefined
        await retireEventMessage(client, payload, event, "details")
    }
    // Without a roster channel the announcement doubles as the roster card
    // (L1-43, L1-B16). Discord's media gallery can be unreliable when it has
    // to fetch a generated image from our public URL, so the PNG is uploaded
    // with the message and Discord renders an attachment it already owns.
    let rosterImageAttachment:
        | Awaited<ReturnType<typeof buildPublishedRosterImageAttachment>>
        | undefined
    if (
        event.kind === "match" &&
        event.status !== "concluded" &&
        roster?.published &&
        roster.updatedAt
    ) {
        try {
            rosterImageAttachment = await buildPublishedRosterImageAttachment(
                event,
                roster
            )
        } catch (error) {
            throw new EventSyncStepError("roster", error)
        }
    }
    // One announcement card from the announcement to the result (L1-01).
    if (announcementChannelId && registrationMessageVisible) {
        if (
            registrationChannel?.isTextBased() &&
            (registrationChannel.type === ChannelType.GuildText ||
                registrationChannel.type === ChannelType.GuildAnnouncement)
        ) {
            announcementMessageId = await syncAnnouncement({
                client,
                guild,
                payload,
                event,
                roster,
                state,
                channel: registrationChannel as TextChannel,
                forumChannelId,
                rosterChannelId: null,
                rosterImage: rosterImageAttachment,
                factionEmoji: await applicationFactionEmoji(client),
            })
        } else {
            logWarn(
                "announcement",
                "Announcement channel is unavailable or not a text channel",
                {
                    eventId: event.id,
                    guildId: payload.config.guildId,
                    channelId: announcementChannelId,
                }
            )
        }
    } else {
        logInfo("announcement", "Skipping announcement sync", {
            eventId: event.id,
            guildId: payload.config.guildId,
            reason: announcementChannelId
                ? "announcement-not-due"
                : "announcements-channel-not-configured",
        })
    }

    signupThreadId = await syncSignupThread({
        guild,
        event,
        announcementMessageId,
        announcementChannelId,
        existingThreadId: signupThreadId,
    })

    const scheduledLifecycle = deriveScheduledEventLifecycle(event)
    // "Událost na Discordu" is a clan switch (N1-16); off cancels it below.
    if (
        payload.config.meetingChannelId &&
        isMessageEnabled(payload.config, "scheduledEvent")
    ) {
        try {
            const meetingChannel = await guild.channels
                .fetch(payload.config.meetingChannelId)
                .catch(() => null)
            const scheduledSyncResult = await syncScheduledDiscordEvent({
                guild,
                event,
                content: scheduledEventContentFor(
                    payload,
                    event,
                    announcementChannelId
                ),
                meetingChannel,
                scheduledEventId,
                desiredLifecycle: scheduledLifecycle,
            })

            scheduledEventId = scheduledSyncResult.scheduledEventId
            scheduledEventStatus = scheduledSyncResult.scheduledEventStatus
            logInfo("scheduled-event", "Scheduled event sync completed", {
                eventId: event.id,
                guildId: payload.config.guildId,
                scheduledEventId,
                scheduledEventStatus,
                desiredLifecycle: scheduledLifecycle,
            })
        } catch (error) {
            logError(
                "scheduled-event",
                "Discord bot scheduled event sync failed",
                {
                    eventId: event.id,
                    guildId: payload.config.guildId,
                    scheduledEventId,
                    error,
                }
            )
        }
    } else if (scheduledEventId) {
        const canceled = await cancelScheduledDiscordEvent(
            guild,
            scheduledEventId
        )
        scheduledEventId = undefined
        scheduledEventStatus = canceled ? "canceled" : undefined
        logInfo(
            "scheduled-event",
            "Canceled scheduled event because meeting channel is no longer configured",
            {
                eventId: event.id,
                guildId: payload.config.guildId,
                canceled,
            }
        )
    } else {
        logInfo(
            "scheduled-event",
            "Skipping scheduled event sync because meeting channel is not configured",
            {
                eventId: event.id,
                guildId: payload.config.guildId,
            }
        )
    }

    await convex.mutation(references.updateEventSyncState, {
        secret: env.internalSecret,
        eventId: event.id as never,
        guildId: payload.config.guildId,
        announcementChannelId: announcementMessageId
            ? announcementChannelId
            : undefined,
        announcementMessageId,
        eventInfoMessageId,
        eventInfoMessageRenderVersion,
        scheduledEventId,
        scheduledEventStatus,
        forumChannelId,
        forumThreadId,
        signupThreadId,
        infoMessageId,
        debriefMessageId,
        topicMessageIds,
        lastEventUpdatedAt: event.updatedAt,
        lastRosterUpdatedAt: roster?.updatedAt,
        lastConfigUpdatedAt: payload.config.updatedAt,
        lastCalendarSyncVersion: getCalendarSyncVersion(event),
        squadVoiceChannelIds,
        lastSyncedAt: new Date().toISOString(),
    })
    logInfo("event-sync", "Persisted event sync state", {
        eventId: event.id,
        guildId: payload.config.guildId,
        announcementMessageId,
        scheduledEventId,
        scheduledEventStatus,
        forumChannelId,
        infoMessageId,
        topicMessageCount: topicMessageIds.length,
    })
    // The one-time redraw (L1-147): a match without a card is done now that
    // its roster card and forum post were redrawn above.
    await finishAnnouncementMigration({
        eventId: event.id,
        guildId: payload.config.guildId,
        hasCard: Boolean(announcementMessageId),
    })
}
