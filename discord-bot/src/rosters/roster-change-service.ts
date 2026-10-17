/**
 * The roster change digest, change DMs and the first single-channel attendee
 * role mention (boards L1-120..126, L2-35..40, D5).
 * The dashboard only queues the request; this service watches the queue in
 * Convex, claims one request at a time and sends everything in the shared
 * card, so it goes out once even when the watch fires repeatedly.
 *
 * - One digest per match in the roster channel, edited with every
 *   re-publish so it lists every change since the first digest.
 * - One DM per affected clan member with all their changes.
 * - Players whose DMs are closed are recorded for the publish dialog.
 */

import {
    MessageFlags,
    TextDisplayBuilder,
    type Client,
    type Guild,
} from "discord.js"

import {
    changedRecipients,
    diffRosterPlaces,
    rosterPlaces,
    snapshotToPlaces,
    type RosterPlaceSnapshot,
    type RosterPlayerChange,
} from "../../../src/domain/rosters/roster-update-summary"
import {
    dmFrame,
    memberNames,
    rosterCardContext,
    rosterCardEvent,
} from "../events/match-context"
import { resolveRosterUpdateChannelIds } from "../../../src/domain/rosters/roster-update-channel"
import {
    matchTitle,
    playerName,
} from "../../../src/domain/discord-messages/match-text"
import { rosterChangeDmView } from "../../../src/domain/discord-messages/direct-message-views"
import { rosterChangesView } from "../../../src/domain/discord-messages/roster-message"
import { getDirectMessages } from "../../../src/lib/clan-language/direct-messages"
import { findSquadLeader } from "../../../src/domain/discord-messages/format"
import { getRosterMessages } from "../../../src/lib/clan-language/rosters"
import type { EventRecord, Roster, SyncPayload } from "../types"
import { publishManagedMessage } from "../sync/publication"
import { logError, logInfo, logWarn } from "../log"
import { messagePayload } from "../ui/message-kit"
import { buildPublicRosterUrl } from "../utils"
import { convex, references } from "../convex"
import { env } from "../environment"

export type ClaimedRosterChanges = {
    id: string
    eventId: string
    guildId: string
    requestedAt: string
    before: RosterPlaceSnapshot[]
    digestBaseline: RosterPlaceSnapshot[]
    notifyPlayers: boolean
    postDigest: boolean
    mentionPlayers: boolean
    /**
     * The mentions of a first publish whose roster card is the announcement
     * (D5-08): Discord never pings on the edited card, so they go out here.
     */
    firstPublish?: boolean
    memberIds: string[]
}

type PendingRequest = { id: string; eventId: string; guildId: string }

/** What the bot needs from Discord, injectable for tests. */
export type RosterChangePorts = {
    guild: Guild | null
    sendDm(userId: string, message: unknown): Promise<boolean>
    publishDigest(input: {
        channelId: string
        message: ReturnType<typeof messagePayload>
        legacyChannelId?: string
        legacyMessageId?: string
        revision: number
    }): Promise<unknown>
    mention(input: {
        channelId: string
        messageId?: string
        roleId: string
    }): Promise<void>
}

/** The digest message's managed-publication key: one per match. */
export const rosterChangesKey = (eventId: string) =>
    `event:${eventId}:roster-changes`

function leaderOf(
    roster: Roster,
    squadName: string | undefined,
    names: Readonly<Record<string, string>>,
    userId: string
) {
    const squad = roster.squads.find((item) => item.name.trim() === squadName)
    const leader = squad ? findSquadLeader(squad.players) : undefined
    return leader && leader.id !== userId
        ? playerName(leader, names)
        : undefined
}

/**
 * Sends one claimed request: the change DMs, the digest and the mention.
 * Returns who got a DM, whose DM Discord refused and whether the digest was
 * posted.
 */
export async function deliverRosterChanges(input: {
    payload: SyncPayload
    request: ClaimedRosterChanges
    ports: RosterChangePorts
    now?: number
}) {
    const { payload, request, ports } = input
    const event = payload.events.find((item) => item.id === request.eventId)
    const roster = payload.rosters.find(
        (item) => item.eventId === request.eventId && item.published
    )
    const outcome = {
        dmSentUserIds: [] as string[],
        dmFailedUserIds: [] as string[],
        digestPosted: false,
    }
    if (!event || !roster) return outcome
    const current = rosterPlaces(roster)
    const changes = diffRosterPlaces(
        snapshotToPlaces(request.before),
        current,
        roster.reservePlayerIds
    )
    const recipients = request.notifyPlayers
        ? changedRecipients(changes, new Set(request.memberIds))
        : []
    const digestChanges = request.postDigest
        ? diffRosterPlaces(
              snapshotToPlaces(request.digestBaseline),
              current,
              roster.reservePlayerIds
          )
        : []
    const names = await memberNames(
        ports.guild,
        [
            ...changes.map((change) => change.userId),
            ...digestChanges.map((change) => change.userId),
            ...roster.squads.flatMap((squad) => {
                const leader = findSquadLeader(squad.players)
                return leader?.id ? [leader.id] : []
            }),
        ],
        payload.userDisplayNames
    )
    const language = payload.config.defaultLanguage
    const options = { language, style: payload.config.messageStyle }

    for (const userId of recipients) {
        const change = changes.find(
            (item) => item.userId === userId
        ) as RosterPlayerChange
        const view = rosterChangeDmView({
            event: {
                id: event.id,
                title: matchTitle(event),
                meetingStart: event.meetingStart,
                gameStart: event.gameStart,
                guildId: event.guildId,
            },
            change,
            leader: change.after
                ? leaderOf(roster, change.after.squad, names, userId)
                : undefined,
            rosterUrl: buildPublicRosterUrl(event.id, language),
            copy: getDirectMessages(language),
            rosterCopy: getRosterMessages(language),
            frame: dmFrame(payload.config, payload.guild.name),
        })
        if (await ports.sendDm(userId, messagePayload(view, options)))
            outcome.dmSentUserIds.push(userId)
        else outcome.dmFailedUserIds.push(userId)
    }

    const syncState = payload.syncStates.find(
        (state) => state.eventId === event.id
    )
    const channels = resolveRosterUpdateChannelIds({
        eventAnnouncementChannelId: event.announcementChannelId,
        eventInfoChannelId: event.eventInfoChannelId,
        configuredAnnouncementChannelId: payload.config.announcementsChannelId,
        configuredEventInfoChannelId: payload.config.eventInfoChannelId,
    })
    if (digestChanges.length && channels.rosterUpdateChannelId) {
        const view = rosterChangesView({
            event: rosterCardEvent(
                event,
                payload.config,
                payload.guild.eventCategories
            ),
            changes: digestChanges,
            editedAt: request.requestedAt,
            context: rosterCardContext({
                config: payload.config,
                eventId: event.id,
                names,
                groups: payload.groups,
                now: input.now,
            }),
        })
        await ports.publishDigest({
            channelId: channels.rosterUpdateChannelId,
            message: messagePayload(view, options),
            // The digest the web used to post becomes the managed one.
            legacyChannelId: syncState?.rosterUpdateChannelId,
            legacyMessageId: syncState?.rosterUpdateMessageId,
            revision: Date.parse(request.requestedAt) || Date.now(),
        })
        outcome.digestPosted = true
    }

    const inInfo = Boolean(syncState?.eventInfoMessageId)
    // A first publish in the roster channel pings with its own first post.
    // Only a first single-channel publish needs a separate Discord message:
    // edits cannot ping, and a re-publish must never notify the event again.
    if (request.firstPublish && request.mentionPlayers && !inInfo) {
        const channelId = inInfo
            ? channels.eventInfoChannelId
            : channels.announcementChannelId
        if (event.attendeeRoleId && channelId)
            await ports.mention({
                channelId,
                messageId: inInfo
                    ? syncState?.eventInfoMessageId
                    : syncState?.announcementMessageId,
                roleId: event.attendeeRoleId,
            })
    }
    return outcome
}

/** Discord-backed ports for one guild. */
export function discordRosterChangePorts(
    client: Client,
    guild: Guild | null,
    event: Pick<EventRecord, "id" | "guildId">
): RosterChangePorts {
    return {
        guild,
        async sendDm(userId, message) {
            const user = await client.users.fetch(userId).catch(() => null)
            if (!user) return false
            return await user
                .send(message as Parameters<typeof user.send>[0])
                .then(() => true)
                .catch(() => false)
        },
        async publishDigest(input) {
            await publishManagedMessage(client, {
                guildId: event.guildId,
                key: rosterChangesKey(event.id),
                revision: input.revision,
                channelId: input.channelId,
                legacyChannelId: input.legacyChannelId,
                legacyMessageId: input.legacyMessageId,
                message: input.message,
            })
        },
        async mention(input) {
            const channel = await client.channels
                .fetch(input.channelId)
                .catch(() => null)
            if (!channel?.isSendable()) return
            // Edits never ping, so a re-publish mentions in a reply to the roster.
            await channel.send({
                components: [
                    new TextDisplayBuilder().setContent(`<@&${input.roleId}>`),
                ],
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { roles: [input.roleId], parse: [] },
                ...(input.messageId
                    ? {
                          reply: {
                              messageReference: input.messageId,
                              failIfNotExists: false,
                          },
                      }
                    : {}),
            })
        },
    }
}

/**
 * Watches pending roster change requests in Convex and sends each once.
 * A backend without the queue only logs; the rest of the bot keeps running.
 */
export class RosterChangeRequestService {
    private unsubscribe?: () => void
    private readonly processing = new Set<string>()

    constructor(
        private readonly client: Client,
        private readonly loadEventPayload: (
            eventId: string
        ) => Promise<SyncPayload | null>
    ) {}

    async start() {
        const watch = convex.watchQuery(references.listPendingRosterChanges, {
            secret: env.internalSecret,
        })
        this.unsubscribe = watch.onUpdate(() => {
            let pending: PendingRequest[] | undefined
            try {
                pending = watch.localQueryResult() as
                    PendingRequest[] | undefined
            } catch (error) {
                logWarn("roster-changes", "Could not read pending requests", {
                    error,
                })
                return
            }
            if (pending) void this.processAll(pending)
        })
        const pending = (await convex.query(
            references.listPendingRosterChanges,
            { secret: env.internalSecret }
        )) as PendingRequest[]
        await this.processAll(pending)
        logInfo("roster-changes", "Started roster change requests")
    }

    stop() {
        this.unsubscribe?.()
    }

    private async processAll(pending: PendingRequest[]) {
        for (const request of pending) {
            if (this.processing.has(request.id)) continue
            this.processing.add(request.id)
            try {
                await this.process(request)
            } finally {
                this.processing.delete(request.id)
            }
        }
    }

    private async process(request: PendingRequest) {
        let claimed: ClaimedRosterChanges | null
        try {
            claimed = (await convex.mutation(references.claimRosterChanges, {
                secret: env.internalSecret,
                requestId: request.id,
            })) as ClaimedRosterChanges | null
        } catch (error) {
            logError("roster-changes", "Failed to claim a request", {
                requestId: request.id,
                error,
            })
            return
        }
        if (!claimed) return
        try {
            const payload = await this.loadEventPayload(claimed.eventId)
            if (!payload) throw new Error("Match context is not available.")
            const guild = await this.client.guilds
                .fetch(claimed.guildId)
                .catch(() => null)
            const outcome = await deliverRosterChanges({
                payload,
                request: claimed,
                ports: discordRosterChangePorts(this.client, guild, {
                    id: claimed.eventId,
                    guildId: claimed.guildId,
                }),
            })
            await convex.mutation(references.completeRosterChanges, {
                secret: env.internalSecret,
                requestId: claimed.id,
                ...outcome,
            })
            logInfo("roster-changes", "Sent roster changes", {
                eventId: claimed.eventId,
                guildId: claimed.guildId,
                dmSent: outcome.dmSentUserIds.length,
                dmFailed: outcome.dmFailedUserIds.length,
                digestPosted: outcome.digestPosted,
            })
        } catch (error) {
            logWarn("roster-changes", "Roster changes failed", {
                requestId: claimed.id,
                eventId: claimed.eventId,
                error,
            })
            await convex
                .mutation(references.failRosterChanges, {
                    secret: env.internalSecret,
                    requestId: claimed.id,
                    error: "send_failed",
                })
                .catch((failure) =>
                    logError("roster-changes", "Failed to record a failure", {
                        error: failure,
                    })
                )
        }
    }
}
