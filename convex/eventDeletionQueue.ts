import type { EventDiscordDeletion } from "../src/domain/events/deletion"
import type { MutationCtx } from "./_generated/server"

/** Separate from the delete workflow so hot bot sync modules import no broad graph. */
export async function queueEventDiscordDeletion(
    ctx: MutationCtx,
    eventId: string,
    resources: EventDiscordDeletion
) {
    if (
        !resources.messages.length &&
        !resources.channelIds.length &&
        !resources.roleIds.length &&
        !resources.scheduledEventIds.length
    )
        return false
    const now = new Date().toISOString()
    await ctx.db.insert("eventDeletionRequests", {
        ...resources,
        eventId,
        status: "pending",
        attempts: 0,
        nextAttemptAt: now,
        createdAt: now,
    })
    return true
}
