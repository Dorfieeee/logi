import { fetchMutation, fetchQuery } from "convex/nextjs"
import { makeFunctionReference } from "convex/server"

import type { EventDraftParsed } from "@/lib/validation/event-flow"
import type { EventDraftError } from "@/domain/events/drafts"
import type { EventRecord } from "@/types/domain"
import { getInternalAuthSecret } from "@/lib/env"

const saveDraftReference = makeFunctionReference<"mutation">("eventDrafts:save")
const publishDraftReference = makeFunctionReference<"mutation">(
    "eventDrafts:publish"
)
const removeDraftReference =
    makeFunctionReference<"mutation">("eventDrafts:remove")
const getDraftReference = makeFunctionReference<"query">("eventDrafts:get")

export type EventDraftWriteResult =
    { ok: true; eventId: string } | { ok: false; error: EventDraftError }

/** The validated body as Convex arguments; empty optional strings are left out. */
function toArgs(input: EventDraftParsed) {
    const blank = (value: string | undefined) => value || undefined
    return {
        ...input,
        registrationStart: blank(input.registrationStart),
        thumbnailUrl: blank(input.thumbnailUrl),
        imageUrl: blank(input.imageUrl),
        topicPresetId: blank(input.topicPresetId),
        announcementChannelId: blank(input.announcementChannelId),
        eventInfoChannelId: blank(input.eventInfoChannelId),
        eventResultsChannelId: blank(input.eventResultsChannelId),
        squadVoiceCategoryId: blank(input.squadVoiceCategoryId),
        // Training timelines start at the meeting.
        gameStart: input.gameStart || input.meetingStart,
        gameEnd: input.gameEnd || input.meetingStart,
    }
}

/** Creates (no `eventId`) or overwrites a draft of this clan. */
export async function saveEventDraft(
    serverId: string,
    eventId: string | undefined,
    input: EventDraftParsed
): Promise<EventDraftWriteResult> {
    return (await fetchMutation(saveDraftReference, {
        secret: getInternalAuthSecret(),
        serverId: serverId as never,
        eventId: eventId as never,
        ...toArgs(input),
    })) as EventDraftWriteResult
}

/** Publishes a draft in place, or creates the event directly without one. */
export async function publishEventDraft(
    serverId: string,
    eventId: string | undefined,
    input: EventDraftParsed
): Promise<EventDraftWriteResult> {
    return (await fetchMutation(publishDraftReference, {
        secret: getInternalAuthSecret(),
        serverId: serverId as never,
        eventId: eventId as never,
        ...toArgs(input),
    })) as EventDraftWriteResult
}

export async function deleteEventDraft(
    serverId: string,
    eventId: string
): Promise<EventDraftWriteResult> {
    return (await fetchMutation(removeDraftReference, {
        secret: getInternalAuthSecret(),
        serverId: serverId as never,
        eventId: eventId as never,
    })) as EventDraftWriteResult
}

/** A draft of this clan, or null for anything else (a published event, another clan's). */
export async function getEventDraft(
    serverId: string,
    eventId: string
): Promise<EventRecord | null> {
    try {
        return (await fetchQuery(getDraftReference, {
            secret: getInternalAuthSecret(),
            serverId: serverId as never,
            eventId: eventId as never,
        })) as EventRecord | null
    } catch {
        // A malformed ID fails Convex argument validation; it is simply not a draft.
        return null
    }
}
