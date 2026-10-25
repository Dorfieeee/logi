/**
 * Keeps the one announcement card of a match in the announcement channel
 * (board L1, L1-01, L1-B01): created when sign-ups open, edited in place
 * through every state up to the result, pinging the roles only with its
 * first post (L1-B02). A card drawn before the redesign is redrawn once, a
 * few per minute and without a ping (L1-B20).
 */

import type { AttachmentBuilder, Client, Guild, TextChannel } from "discord.js"
import type { MatchImageInput } from "../../../src/domain/events/match-image"
import { makeFunctionReference } from "convex/server"
import { matchImageAttachment } from "./match-image"

import {
    ANNOUNCEMENT_LAYOUT_VERSION,
    takeMigrationToken,
    type MigrationBucket,
} from "../../../src/domain/events/announcement-migration"
import {
    announcementMessage,
    announcementThumbnail,
    buildAnnouncementCard,
    getAnnouncementPingRoleIds,
} from "./announcement"
import type { PanelFactionEmoji } from "../../../src/domain/discord-publications/panel-presentation"
import type { AnnouncementResult } from "../../../src/domain/discord-messages/match-announcement"
import type { EventRecord, Roster, SyncPayload, SyncState } from "../types"
import { publishManagedMessage } from "../sync/publication"
import { logInfo, logWarn } from "../log"
import { env } from "../environment"
import { convex } from "../convex"

export const announcementReferences = {
    getContext: makeFunctionReference<"query">("eventAnnouncements:getContext"),
    record: makeFunctionReference<"mutation">("eventAnnouncements:record"),
    listMigrationDue: makeFunctionReference<"query">(
        "eventAnnouncements:listMigrationDue"
    ),
}

export type AnnouncementContext = {
    pingedAt: string | null
    rosterPingedAt: string | null
    layoutVersion: string | null
    result: AnnouncementResult | null
    publicMatch: boolean
    resultsChannelId: string | null
    leagueLabel?: string | null
    imageResult?: MatchImageInput["result"]
    resultVersion?: number | null
    sourceUrl?: string | null
    hasCollectedData?: boolean
    dashboardServerId?: string | null
}

const EMPTY_CONTEXT: AnnouncementContext = {
    pingedAt: null,
    rosterPingedAt: null,
    layoutVersion: null,
    result: null,
    publicMatch: false,
    resultsChannelId: null,
}

export async function loadAnnouncementContext(
    eventId: string,
    required = false
) {
    try {
        return (
            ((await convex.query(announcementReferences.getContext, {
                secret: env.internalSecret,
                eventId: eventId as never,
            })) as AnnouncementContext | null) ?? EMPTY_CONTEXT
        )
    } catch (error) {
        if (required) throw error
        // An older backend without this query: the card still renders.
        logWarn("announcement", "Announcement context is unavailable", {
            eventId,
            error,
        })
        return EMPTY_CONTEXT
    }
}

let migrationBucket: MigrationBucket | null = null

/** One redraw of an old card now, or false when the minute's budget is used up. */
export function takeAnnouncementMigrationSlot(now = Date.now()) {
    const result = takeMigrationToken(migrationBucket, now)
    migrationBucket = result.bucket
    return result.allowed
}

export type AnnouncementDecision =
    | { kind: "skip"; reason: "not-posted" | "migration-deferred" }
    | { kind: "publish"; ping: boolean; migrating: boolean }

/**
 * Whether the card is drawn now and whether it pings. A card is created only
 * when sign-ups open, or again in place when a card of the current layout was
 * deleted; a played or cancelled match never gets a new card. The first post
 * of an open card pings once; nothing else ever does.
 */
export function decideAnnouncement(input: {
    state: ReturnType<typeof buildAnnouncementCard>["state"]
    hasMessage: boolean
    context: Pick<AnnouncementContext, "pingedAt" | "layoutVersion">
    pingRoleIds: readonly string[]
    takeMigrationSlot: () => boolean
}): AnnouncementDecision {
    const current = input.context.layoutVersion === ANNOUNCEMENT_LAYOUT_VERSION
    if (!input.hasMessage) {
        const finished = input.state === "played" || input.state === "cancelled"
        if (input.state !== "open" && (finished || !current))
            return { kind: "skip", reason: "not-posted" }
        return {
            kind: "publish",
            ping:
                input.state === "open" &&
                !input.context.pingedAt &&
                input.pingRoleIds.length > 0,
            migrating: false,
        }
    }
    if (!current && !input.takeMigrationSlot())
        return { kind: "skip", reason: "migration-deferred" }
    return { kind: "publish", ping: false, migrating: !current }
}

export async function syncAnnouncement(input: {
    client: Client
    guild: Guild
    payload: SyncPayload
    event: EventRecord
    roster: Roster | undefined
    state: SyncState | undefined
    channel: TextChannel
    forumChannelId?: string
    /** The roster card's own channel in split mode. */
    rosterChannelId?: string | null
    /** The roster picture when this card doubles as the roster. */
    rosterImage?: { attachment: AttachmentBuilder; mediaUrl: string }
    factionEmoji?: PanelFactionEmoji
    now?: Date
}): Promise<string | undefined> {
    const { client, guild, payload, event, state } = input
    const messageId = state?.announcementMessageId
    const context = await loadAnnouncementContext(event.id)
    const meetingChannelId =
        event.meetingChannelId?.trim() || payload.config.meetingChannelId
    const meetingChannel = meetingChannelId
        ? guild.channels.cache.get(meetingChannelId)
        : undefined
    const thumbnail = await announcementThumbnail(
        event,
        payload.config.defaultLanguage
    )
    const generatedImage =
        event.kind === "match" && !event.imageUrl?.trim()
            ? await matchImageAttachment(payload, event, {
                  league: context.leagueLabel,
              })
            : null
    const { view, state: cardState } = buildAnnouncementCard(payload, event, {
        now: input.now,
        factionEmoji: input.factionEmoji,
        forumChannelId: input.forumChannelId,
        rosterChannelId: input.rosterChannelId,
        rosterImage: input.rosterImage
            ? {
                  url: input.rosterImage.mediaUrl,
                  description:
                      input.rosterImage.attachment.description ?? undefined,
              }
            : null,
        thumbnail: thumbnail?.media ?? null,
        generatedImage: generatedImage?.media ?? null,
        announcementChannelId: input.channel.id,
        clanName: guild.name,
        meetingChannelName: meetingChannel?.name ?? null,
        scheduledEvent: Boolean(
            payload.config.meetingChannelId && state?.scheduledEventId
        ),
        result: context.result,
        publicMatch: context.publicMatch,
        resultsChannelId: context.resultsChannelId,
    })
    const pingRoleIds = getAnnouncementPingRoleIds(payload, event)
    const decision = decideAnnouncement({
        state: cardState,
        hasMessage: Boolean(messageId),
        context,
        pingRoleIds,
        takeMigrationSlot: () => takeAnnouncementMigrationSlot(),
    })
    if (decision.kind === "skip") {
        logInfo("announcement", "Announcement left as it is", {
            eventId: event.id,
            guildId: guild.id,
            state: cardState,
            reason: decision.reason,
        })
        return messageId
    }
    const result = await publishManagedMessage(client, {
        guildId: guild.id,
        key: `event:${event.id}:announcement`,
        revision: Math.max(
            Date.parse(payload.config.updatedAt),
            Date.parse(event.updatedAt)
        ),
        channelId: input.channel.id,
        legacyChannelId: state?.announcementChannelId ?? input.channel.id,
        legacyMessageId: messageId,
        message: announcementMessage(view, {
            config: payload.config,
            pingRoleIds: decision.ping ? pingRoleIds : [],
            files: [
                ...(thumbnail?.file ? [thumbnail.file] : []),
                ...(generatedImage ? [generatedImage.file] : []),
                ...(input.rosterImage ? [input.rosterImage.attachment] : []),
            ],
        }),
    })
    if (decision.ping || context.layoutVersion !== ANNOUNCEMENT_LAYOUT_VERSION)
        await convex
            .mutation(announcementReferences.record, {
                secret: env.internalSecret,
                eventId: event.id as never,
                guildId: guild.id,
                pinged: decision.ping,
                layoutVersion: ANNOUNCEMENT_LAYOUT_VERSION,
            })
            .catch((error) =>
                logWarn("announcement", "Could not record the announcement", {
                    eventId: event.id,
                    error,
                })
            )
    if (decision.migrating)
        logInfo("announcement", "Redrew an announcement in the new layout", {
            eventId: event.id,
            guildId: guild.id,
            state: cardState,
        })
    return result ?? messageId
}
