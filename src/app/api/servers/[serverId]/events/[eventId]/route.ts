import {
    createServerEventDeleteHandler,
    createServerEventPatchHandler,
    createServerEventPostHandler,
} from "@/lib/api/event-route-handlers"
import {
    deleteServerEvent,
    completeServerTraining,
    concludeServerEvent,
    saveServerEvent,
} from "@/lib/server-events"
import {
    fetchDiscordGuildRoles,
    sendDiscordBotDm,
    syncDiscordMemberRoleIds,
} from "@/lib/discord"
import {
    getIntlLocaleForClanLanguage,
    resolveClanLanguage,
} from "@/lib/clan-language/core"
import {
    getUserSafeErrorMessage,
    logRouteError,
} from "@/lib/server-route-errors"
import { trainingResultView } from "@/domain/discord-messages/direct-message-views"
import { isMessageEnabled } from "@/domain/discord-messages/notification-settings"
import { getServerContextUncached } from "@/lib/read-models/server-context"
import { getEventMetadata, getGuildMetadata } from "@/lib/server-metadata"
import { getDirectMessages } from "@/lib/clan-language/direct-messages"
import { getDiscordConfigByGuild } from "@/lib/server-discord-settings"
import { eventSchema, eventUpdateSchema } from "@/lib/validation/event"
import { appCacheTags, revalidateCacheEntries } from "@/lib/cache-tags"
import { messageApiBody } from "@/domain/discord-messages/message-api"
import { currentDashboardActor } from "@/lib/gateways/dashboard-actor"
import { importEventMatchResults } from "@/lib/server-match-results"
import { matchTitle } from "@/domain/discord-messages/match-text"
import { getSystemMessages } from "@/lib/clan-language/system"
import { getSiteUrl } from "@/lib/env"

/** Current server admin with a live dashboard session. */
async function canAdminServer(serverId: string) {
    const [server, actor] = await Promise.all([
        getServerContextUncached(serverId),
        currentDashboardActor(),
    ])
    return Boolean(server?.canAdmin && actor)
}

const patchHandler = createServerEventPatchHandler({
    origin: new URL(getSiteUrl()).origin,
    // Unknown keys are refused; the template settings may change too.
    eventSchema: eventUpdateSchema,
    canAdminServer,
    saveServerEvent,
    concludeServerEvent,
    completeServerTraining,
    importServerEventsFromLinks: async () => {
        throw new Error("Unused.")
    },
    importEventMatchResults,
    getEventMetadata,
    finalizeTrainingCompletion: async () => undefined,
    revalidateCacheEntries,
    appCacheTags,
    logRouteError,
    getUserSafeErrorMessage,
})

const deleteHandler = createServerEventDeleteHandler({
    origin: new URL(getSiteUrl()).origin,
    canAdminServer,
    deleteServerEvent,
    revalidateCacheEntries,
    appCacheTags,
    logRouteError,
    getUserSafeErrorMessage,
})

export async function DELETE(
    request: Request,
    context: { params: Promise<{ serverId: string; eventId: string }> }
) {
    return deleteHandler(request, context)
}

const postHandler = createServerEventPostHandler({
    origin: new URL(getSiteUrl()).origin,
    eventSchema,
    canAdminServer,
    saveServerEvent,
    concludeServerEvent,
    completeServerTraining,
    importServerEventsFromLinks: async () => {
        throw new Error("Unused.")
    },
    importEventMatchResults,
    getEventMetadata,
    finalizeTrainingCompletion: async ({ serverId, eventId, participants }) => {
        const [event, guild, discordConfig] = await Promise.all([
            getEventMetadata(eventId),
            getGuildMetadata(serverId),
            getDiscordConfigByGuild(serverId),
        ])

        if (!event || !guild) {
            return
        }

        const language = discordConfig?.defaultLanguage
        const rewardRoleIds: string[] = event.rewardRoleIds ?? []
        // Role names, not mentions: a DM cannot render a guild role.
        const roleNames = rewardRoleIds.length
            ? await fetchDiscordGuildRoles(guild.discordId)
                  .then((roles) =>
                      rewardRoleIds.flatMap((roleId) => {
                          const role = roles.find((item) => item.id === roleId)
                          return role ? [role.name] : []
                      })
                  )
                  .catch(() => [])
            : []
        const rewardedUserIds: string[] = []
        const dmSentUserIds: string[] = []
        const sendResultDm = isMessageEnabled(discordConfig, "trainingResultDm")
        const layout = {
            copy: getSystemMessages(language).kit,
            locale: getIntlLocaleForClanLanguage(language),
            style: discordConfig?.messageStyle,
        }
        const frame = {
            clanName: guild.name,
            settingsUrl: new URL(
                `/${resolveClanLanguage(language)}/dashboard/settings/user#zpravy-od-bota`,
                getSiteUrl()
            ).toString(),
            timeZone: discordConfig?.timezone || "UTC",
        }

        await Promise.all(
            participants.map(async (participant) => {
                const passed = participant.completed === "passed"
                if (passed && rewardRoleIds.length > 0) {
                    await syncDiscordMemberRoleIds({
                        discordGuildId: guild.discordId,
                        userId: participant.userId,
                        addRoleIds: rewardRoleIds,
                    })
                    rewardedUserIds.push(participant.userId)
                }

                // "Výsledek tréninku" is a clan switch (board N1-23).
                if (!sendResultDm) return
                try {
                    // The result card in the clan language (board L2-52, L2-53).
                    await sendDiscordBotDm(
                        participant.userId,
                        messageApiBody(
                            trainingResultView({
                                title: matchTitle(event),
                                gameStart: event.gameStart,
                                passed,
                                rewardRoles: passed ? roleNames : [],
                                copy: getDirectMessages(language),
                                frame,
                            }),
                            layout
                        )
                    )
                    dmSentUserIds.push(participant.userId)
                } catch {
                    // Ignore DM failures so the training completion flow still succeeds.
                }
            })
        )

        return {
            rewardedUserIds,
            dmSentUserIds,
        }
    },
    revalidateCacheEntries,
    appCacheTags,
    logRouteError,
    getUserSafeErrorMessage,
})

export async function PATCH(
    request: Request,
    context: { params: Promise<{ serverId: string; eventId: string }> }
) {
    return patchHandler(request, context)
}

export async function POST(
    request: Request,
    context: { params: Promise<{ serverId: string; eventId: string }> }
) {
    return postHandler(request, context)
}
