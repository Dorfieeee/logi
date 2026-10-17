/**
 * The published roster message in the roster channel (board L1 1.11): the
 * roster photo as the old bot posted it, with the text roster under it
 * (variant A, the default) or the photo only (variant B), chosen when the
 * roster is published. The temporary attendee role sits above the card and
 * pings only when the message is first posted.
 */

import { TextDisplayBuilder, type MessageCreateOptions } from "discord.js"

import { resolveRosterMessageVariant } from "../../../src/domain/discord-messages/notification-settings"
import { rosterMessageView } from "../../../src/domain/discord-messages/roster-message"
import type { MessageMedia } from "../../../src/domain/discord-messages/message-view"
import { messageKitLayoutOptions, messagePayload } from "../ui/message-kit"
import { rosterCardContext, rosterCardEvent } from "./match-context"
import type { EventRecord, Roster, SyncPayload } from "../types"

export function buildRosterMessage(input: {
    payload: Pick<SyncPayload, "config" | "guild" | "groups">
    event: EventRecord
    roster: Roster
    names: Readonly<Record<string, string>>
    image: MessageMedia
    /** The temporary attendee role to notify when this roster first appears. */
    attendeeRoleId?: string
    /** A durable event marker ensures a recovered card is silent. */
    pingAttendeeRole?: boolean
    now?: number
}): MessageCreateOptions {
    const { payload, event, roster } = input
    const options = {
        language: payload.config.defaultLanguage,
        style: payload.config.messageStyle,
    }
    const view = rosterMessageView(
        {
            event: rosterCardEvent(
                event,
                payload.config,
                payload.guild.eventCategories
            ),
            roster: {
                squads: roster.squads,
                reservePlayerIds: roster.reservePlayerIds,
                notAttendingPlayerIds: roster.notAttendingPlayerIds,
                reserveAttendances: roster.reserveAttendances,
            },
            variant: resolveRosterMessageVariant(
                roster.discordMessageVariant,
                payload.config
            ),
            image: input.image,
            publishedAt: roster.publishedAt ?? roster.updatedAt,
        },
        rosterCardContext({
            config: payload.config,
            eventId: event.id,
            names: input.names,
            groups: payload.groups,
            now: input.now,
        }),
        messageKitLayoutOptions(options)
    )
    const message = messagePayload(view, options)
    const roleId = input.pingAttendeeRole ? input.attendeeRoleId?.trim() : ""
    if (!roleId) return message
    return {
        ...message,
        components: [
            new TextDisplayBuilder().setContent(`<@&${roleId}>`),
            ...message.components,
        ],
        // Edits never ping and the durable event marker suppresses recovery pings.
        allowedMentions: { roles: [roleId], parse: [] },
    }
}
