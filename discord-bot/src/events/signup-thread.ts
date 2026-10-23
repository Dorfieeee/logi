import {
    ThreadAutoArchiveDuration,
    type Guild,
    type ThreadChannel,
} from "discord.js"

import type { EventRecord } from "../types"
import { logWarn } from "../log"

function threadName(event: Pick<EventRecord, "name">) {
    return event.name.trim().slice(0, 100) || "Event discussion"
}

async function addMember(thread: ThreadChannel, userId: string) {
    await thread.members.add(userId).catch((error) =>
        logWarn("signup-thread", "Could not add signup to event thread", {
            threadId: thread.id,
            userId,
            error,
        })
    )
}

/** Creates the announcement's opt-in public thread and mirrors current signups. */
export async function syncSignupThread(input: {
    guild: Guild
    event: EventRecord
    announcementMessageId?: string
    announcementChannelId?: string
    existingThreadId?: string
}) {
    if (
        !input.event.createSignupThread ||
        !input.announcementMessageId ||
        !input.announcementChannelId
    )
        return input.existingThreadId

    const channel = await input.guild.channels
        .fetch(input.announcementChannelId)
        .catch(() => null)
    if (!channel?.isTextBased() || !("messages" in channel))
        return input.existingThreadId

    let thread = input.existingThreadId
        ? await input.guild.channels
              .fetch(input.existingThreadId)
              .then((value) => (value?.isThread() ? value : null))
              .catch(() => null)
        : null
    if (!thread) {
        const message = await channel.messages
            .fetch(input.announcementMessageId)
            .catch(() => null)
        if (!message) return undefined
        thread =
            message.thread ??
            (await message.startThread({
                name: threadName(input.event),
                autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
            }))
    }

    await Promise.all(
        input.event.participants
            .filter((participant) => participant.status === "attending")
            .map((participant) => addMember(thread, participant.userId))
    )
    return thread.id
}

/** Applies a signup button result immediately, without waiting for the next sync. */
export async function syncSignupThreadMember(input: {
    guild: Guild | null
    threadId?: string
    userId: string
    attending: boolean
}) {
    if (!input.guild || !input.threadId) return
    const thread = await input.guild.channels
        .fetch(input.threadId)
        .then((value) => (value?.isThread() ? value : null))
        .catch(() => null)
    if (!thread) return
    if (input.attending) {
        await addMember(thread, input.userId)
        return
    }
    await thread.members.remove(input.userId).catch((error) =>
        logWarn("signup-thread", "Could not remove decline from event thread", {
            threadId: thread.id,
            userId: input.userId,
            error,
        })
    )
}
