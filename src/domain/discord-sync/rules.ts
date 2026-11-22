import { isRegistrationAnnouncementDue } from "../events/registration-announcement"
import type { SyncEventLike, SyncScheduledStatus, SyncStateLike } from "./types"
import { eventInfoMessageRenderVersion } from "./render-version"

export function shouldWriteMinimalConcludedSyncState(input: {
    event: Pick<SyncEventLike, "id" | "status">
    state?: SyncStateLike
    queued: boolean
}) {
    return input.event.status === "concluded" && !input.state && !input.queued
}

export function shouldSyncEvent(input: {
    event: Pick<SyncEventLike, "updatedAt">
    rosterUpdatedAt?: string
    configUpdatedAt: string
    state?: SyncStateLike
    desiredScheduledEventStatus?: SyncScheduledStatus
    meetingChannelConfigured: boolean
    eventInfoChannelConfigured?: boolean
    eventInfoMessageRequired?: boolean
    queued: boolean
}) {
    const {
        event,
        rosterUpdatedAt,
        configUpdatedAt,
        state,
        desiredScheduledEventStatus,
        meetingChannelConfigured,
        eventInfoChannelConfigured,
        eventInfoMessageRequired,
        queued,
    } = input
    return (
        !state ||
        state.lastEventUpdatedAt !== event.updatedAt ||
        state.lastRosterUpdatedAt !== rosterUpdatedAt ||
        state.lastConfigUpdatedAt !== configUpdatedAt ||
        state.eventInfoMessageRenderVersion !== eventInfoMessageRenderVersion ||
        (eventInfoChannelConfigured &&
            eventInfoMessageRequired &&
            !state.eventInfoMessageId) ||
        state.scheduledEventStatus !== desiredScheduledEventStatus ||
        (meetingChannelConfigured
            ? !state.scheduledEventId &&
              desiredScheduledEventStatus !== "completed" &&
              desiredScheduledEventStatus !== "canceled"
            : Boolean(state.scheduledEventId)) ||
        queued
    )
}

export function deriveScheduledEventLifecycle(
    event: Pick<SyncEventLike, "meetingStart" | "gameEnd" | "status"> & {
        concludedAt?: string
    },
    now?: Date
): SyncScheduledStatus {
    const nowValue = now ? now.getTime() : Date.now()
    const meetingStart = new Date(event.meetingStart).getTime()
    const gameEnd = new Date(event.gameEnd).getTime()

    if (event.status === "concluded") {
        // A match ended before its meeting is cancelled, also when the bot
        // only syncs it later (board L1-141, L1-B17).
        const concludedAt = event.concludedAt
            ? new Date(event.concludedAt).getTime()
            : Number.NaN
        const endedAt = Number.isFinite(concludedAt) ? concludedAt : nowValue
        return Number.isFinite(meetingStart) && endedAt < meetingStart
            ? "canceled"
            : "completed"
    }
    if (Number.isFinite(gameEnd) && nowValue >= gameEnd) {
        return "completed"
    }
    if (Number.isFinite(meetingStart) && nowValue >= meetingStart) {
        return "active"
    }

    return "scheduled"
}

/**
 * Registration cards are transient: conclusion always retires them, whether
 * the announcement and match information share a channel or not.
 */
export function shouldKeepRegistrationMessage(
    input: {
        kind: "match" | "training"
        status: SyncEventLike["status"]
        registrationStart?: string
        splitChannels: boolean
    },
    now?: Date
) {
    return (
        isRegistrationAnnouncementDue(input, now) &&
        input.status !== "concluded" &&
        (!input.splitChannels || input.status === "registration")
    )
}
