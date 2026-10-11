import type { EventDiscordDeletion } from "../../../src/domain/events/deletion"
import { Routes, type Client } from "discord.js"
import { convex, references } from "../convex"
import { env } from "../environment"
import { logError } from "../log"

/** Each operation is idempotent: a Discord 404 means it was already deleted. */
export async function deleteEventDiscordResources(
    snapshot: EventDiscordDeletion,
    remove: (route: `/${string}`) => Promise<unknown>
) {
    const routes = [
        ...snapshot.messages.map(({ channelId, messageId }) =>
            Routes.channelMessage(channelId, messageId)
        ),
        ...snapshot.scheduledEventIds.map((id) =>
            Routes.guildScheduledEvent(snapshot.guildId, id)
        ),
        ...snapshot.channelIds.map((id) => Routes.channel(id)),
        ...snapshot.roleIds.map((id) => Routes.guildRole(snapshot.guildId, id)),
    ]
    for (const route of routes) {
        try {
            await remove(route)
        } catch (error) {
            if (!(
                error &&
                typeof error === "object" &&
                "status" in error &&
                error.status === 404
            ))
                throw error
        }
    }
}

export function startEventDeletionWorker(
    client: Client,
    afterCleanup?: (guildId: string) => void
) {
    let running = false
    const tick = async () => {
        if (running) return
        running = true
        try {
            const ids = (await convex.query(references.pendingEventDeletions, {
                secret: env.internalSecret,
            })) as string[]
            for (const requestId of ids) {
                const claimed = (await convex.mutation(
                    references.claimEventDeletion,
                    { secret: env.internalSecret, requestId }
                )) as (EventDiscordDeletion & { leaseUntil: string }) | null
                if (!claimed) continue
                let failure: string | undefined
                try {
                    await deleteEventDiscordResources(claimed, (route) =>
                        client.rest.delete(route)
                    )
                } catch (error) {
                    // Persist a bounded operational reason; never serialize headers or request bodies.
                    failure =
                        error && typeof error === "object" && "status" in error
                            ? `Discord HTTP ${String(error.status)}`
                            : "Discord cleanup failed"
                    logError("event-deletion", "Discord cleanup will retry", {
                        requestId,
                        error: failure,
                    })
                }
                await convex.mutation(references.finishEventDeletion, {
                    secret: env.internalSecret,
                    requestId,
                    leaseUntil: claimed.leaseUntil,
                    ...(failure ? { error: failure } : {}),
                })
                if (!failure) afterCleanup?.(claimed.guildId)
            }
        } catch (error) {
            logError("event-deletion", "Unable to process deleted matches", {
                error,
            })
        } finally {
            running = false
        }
    }
    void tick()
    const timer = setInterval(() => void tick(), 30_000)
    timer.unref?.()
    return () => clearInterval(timer)
}
