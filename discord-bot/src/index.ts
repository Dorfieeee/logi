import { registerMembershipInvalidationEvents } from "./sync/membership-events"
import { startManagedRoleWorker } from "./sync/managed-member-roles"
import { startEventDeletionWorker } from "./sync/event-deletion"
import { Worker } from "node:worker_threads"
import { createRequire } from "node:module"
import { Events } from "discord.js"

import {
    removeGuildMemberAccess,
    syncGuildMemberAccessMember,
    invalidateMembershipGuild,
} from "./sync/member-access"
import {
    registerJoinedGuild,
    startCommandRegistration,
} from "./commands/runtime"
import { RosterChangeRequestService } from "./rosters/roster-change-service"
import { MeetingAttendanceRequestService } from "./meeting-attendance"
import { ManualReminderRequestService } from "./manual-reminders"
import { startPlatformStatusMonitor } from "./platform-status"
import { DiscordSyncService } from "./runtime/sync-service"
import { createInteractionHandler } from "./interactions"
import { runInteraction } from "./interactions/registry"
import { logError, logInfo, logWarn } from "./log"
import { client } from "./discord-client"
import { env } from "./environment"

const syncService = new DiscordSyncService(client)
const meetingAttendanceRequestService = new MeetingAttendanceRequestService(
    client
)
const manualReminderRequestService = new ManualReminderRequestService(
    client,
    (eventId) => syncService.loadEventPayload(eventId)
)
const rosterChangeRequestService = new RosterChangeRequestService(
    client,
    (eventId) => syncService.loadEventPayload(eventId)
)
const require = createRequire(import.meta.url)

function getWorkerExecArgv() {
    const hasTsxLoader = process.execArgv.some((value) =>
        value.includes("tsx/dist/loader.mjs")
    )
    if (hasTsxLoader) {
        return process.execArgv
    }

    return [
        "--require",
        require.resolve("tsx/preflight"),
        "--import",
        import.meta.resolve("tsx"),
    ]
}

function triggerPollSoon() {
    logInfo("bot", "Requested interactive sync flush")
    syncService.triggerInteractiveFlush()
}

const interactionHandler = createInteractionHandler({
    enqueueEventSync: (eventId) => syncService.queueEventSync(eventId),
    triggerPollSoon,
})

function startFallbackWorker() {
    const fallbackWorker = new Worker(
        new URL("./runtime/fallback-worker.ts", import.meta.url),
        {
            execArgv: getWorkerExecArgv(),
        }
    )

    fallbackWorker.on(
        "message",
        (message: {
            type: string
            eventIds?: string[]
            error?: string
            count?: number
            removed?: number
            released?: number
        }) => {
            if (message.type === "scheduledJobsRecovered") {
                logInfo("fallback-worker", "Recovered scheduled job queue", {
                    removed: message.removed ?? 0,
                    released: message.released ?? 0,
                })
                return
            }

            if (message.type === "scheduledJobsClaimed") {
                logInfo("fallback-worker", "Claimed due scheduled jobs", {
                    count: message.count ?? 0,
                    eventIds: message.eventIds ?? [],
                })
                return
            }

            if (message.type === "attendanceRemindersDue") {
                for (const eventId of message.eventIds ?? []) {
                    syncService.queueAttendanceReminder(eventId)
                }
                syncService.triggerSoon(250)
                return
            }

            if (message.type === "signupRemindersDue") {
                for (const eventId of message.eventIds ?? []) {
                    syncService.queueSignupReminder(eventId)
                }
                syncService.triggerSoon(250)
                return
            }

            if (message.type === "eventsChanged") {
                logInfo("fallback-worker", "Received changed events", {
                    eventIds: message.eventIds ?? [],
                    count: message.eventIds?.length ?? 0,
                })
                for (const eventId of message.eventIds ?? []) {
                    syncService.queueEventSync(eventId)
                }
                syncService.triggerSoon(250)
                return
            }

            if (message.type === "fullResync") {
                logInfo("fallback-worker", "Requested full resync")
                syncService.requestFullResync()
                return
            }

            if (message.type === "error") {
                logError("fallback-worker", "Worker reported an error", {
                    error: message.error,
                })
            }
        }
    )
    fallbackWorker.on("error", (error) => {
        logError("fallback-worker", "Worker crashed", { error })
    })
    fallbackWorker.on("exit", (code) => {
        if (code !== 0) {
            logWarn("fallback-worker", "Worker exited unexpectedly", { code })
            setTimeout(() => {
                logInfo("fallback-worker", "Restarting fallback worker")
                startFallbackWorker()
            }, 1000)
        }
    })

    return fallbackWorker
}

import { startApplicationWebSubmissionWorker } from "./interactions/membership-web-submissions"
import { startApplicationStateCache } from "./interactions/membership-application-store"
import { startApplicationEmojiProvisioning } from "./runtime/application-emoji"
import { startTeamRequestNotificationWorker } from "./sync/team-request-worker"
import { startAnnouncementMigration } from "./events/announcement-migration"
import { startPublicPanelWorker } from "./public-panels/worker"
import { startReportRecovery } from "./player-reports"
import { startLeagueWorker } from "./league/worker"
import { startSeedWorker } from "./seed/worker"
client.once(Events.ClientReady, async (readyClient) => {
    startEventDeletionWorker(client, (guildId) => {
        syncService.queueGuildSync(guildId)
        syncService.triggerSoon(250)
    })
    startReportRecovery(client)
    startApplicationWebSubmissionWorker(client)
    // Clan application windows open without a backend read (3 s rule).
    startApplicationStateCache()
    startLeagueWorker(client)
    // A calendar request ("Obnovit teď", "Odeslat do kanálu") redraws it now.
    startPublicPanelWorker(client, {
        refreshCalendar: (guildId) => syncService.refreshCalendar(guildId),
    })
    startManagedRoleWorker(client)
    // Seed calls, control messages and intros (board P5).
    startSeedWorker(client)
    startTeamRequestNotificationWorker(client)
    startApplicationEmojiProvisioning(client)
    try {
        logInfo("bot", "Discord bot ready", {
            user: readyClient.user.tag,
            guildCount: readyClient.guilds.cache.size,
        })

        for (const guild of readyClient.guilds.cache.values())
            await invalidateMembershipGuild(guild.id)
        // Slash commands in every server, then again whenever the clan
        // language or the command settings change (M1-17, M1-19, M1-B01).
        await startCommandRegistration(readyClient).catch((error) =>
            logError("bot", "Failed to register guild commands", { error })
        )

        await meetingAttendanceRequestService.start()
        await syncService.start()
        // Redraws pre-redesign match announcements once, a few a minute.
        startAnnouncementMigration({
            queueEventSync: (eventId) => syncService.queueEventSync(eventId),
            triggerSoon: () => syncService.triggerSoon(250),
        })
        // A backend without the reminder queue must not stop the rest of the
        // bot from starting; reminders then simply wait for the deploy.
        await manualReminderRequestService.start().catch((error) =>
            logError("bot", "Manual reminder requests failed to start", {
                error,
            })
        )
        // The roster change digest and DMs the dashboard asks for (W6b).
        await rosterChangeRequestService.start().catch((error) =>
            logError("bot", "Roster change requests failed to start", {
                error,
            })
        )
        startPlatformStatusMonitor(client)

        startFallbackWorker()
    } catch (error) {
        logError("bot", "Ready handler failed", { error })
    }
})

client.on(Events.InteractionCreate, (interaction) =>
    // Any failure ends in the private "Tohle se nepovedlo" card (M3-08).
    runInteraction(interaction, async () => {
        if (interaction.isButton()) {
            // Panel buttons route through the registry (public-panels/interactions.ts).
            await interactionHandler.handleButtonInteraction(interaction)
            return
        }

        if (interaction.isChannelSelectMenu()) {
            await interactionHandler.handleChannelSelectMenuInteraction(
                interaction
            )
            return
        }

        if (interaction.isStringSelectMenu()) {
            await interactionHandler.handleStringSelectMenuInteraction(
                interaction
            )
            return
        }

        if (interaction.isModalSubmit()) {
            await interactionHandler.handleModalSubmit(interaction)
            return
        }

        if (interaction.isAutocomplete()) {
            await interactionHandler.handleAutocompleteInteraction(interaction)
            return
        }

        if (interaction.isChatInputCommand())
            await interactionHandler.handleChatInputCommand(interaction)
    })
)

// A server that adds the bot gets the commands at once (M1-18).
client.on(Events.GuildCreate, (guild) => {
    void registerJoinedGuild(client, guild).catch((error) =>
        logError("bot", "Failed to register guild commands", {
            guildId: guild.id,
            error,
        })
    )
})

registerMembershipInvalidationEvents(client, {
    invalidate: invalidateMembershipGuild,
    reconcile: () => syncService.requestFullResync(),
    failed: (guildId, error) =>
        logWarn("member-access", "Membership invalidation failed", {
            guildId,
            error,
        }),
})
client.on(Events.GuildMemberAdd, (member) => {
    const config = syncService.getGuildConfig(member.guild.id)
    void syncGuildMemberAccessMember(
        member,
        config?.dashboardAdminRoleId
    ).catch((error) =>
        logError("member-access", "Failed to add member access", {
            guildId: member.guild.id,
            userId: member.id,
            error,
        })
    )
})
client.on(Events.GuildMemberUpdate, (_before, member) => {
    const config = syncService.getGuildConfig(member.guild.id)
    void syncGuildMemberAccessMember(
        member,
        config?.dashboardAdminRoleId
    ).catch((error) =>
        logError("member-access", "Failed to update member access", {
            guildId: member.guild.id,
            userId: member.id,
            error,
        })
    )
})
client.on(Events.GuildMemberRemove, (member) => {
    void removeGuildMemberAccess(member.guild.id, member.id).catch((error) =>
        logError("member-access", "Failed to remove member access", {
            guildId: member.guild.id,
            userId: member.id,
            error,
        })
    )
})

client.on(Events.Error, (error) => {
    logError("discord-client", "Discord client error", { error })
})
client.on(Events.Warn, (message) => {
    logWarn("discord-client", "Discord client warning", { message })
})
client.on(Events.ShardError, (error, shardId) => {
    logError("discord-client", "Discord shard error", { shardId, error })
})

void client.login(env.botToken).catch((error) => {
    logError("bot", "Discord login failed", { error })
})
