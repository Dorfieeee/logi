import { syncRegistrationSnapshot } from "./events/registration-summary"
import type { Client } from "discord.js"

import {
    syncDashboardAdminRoles,
    syncGuildMemberAccess,
} from "./sync/member-access"
import { processAttendanceReminders } from "./sync/attendance-reminders"
import { syncMembershipPanel } from "./interactions/membership-panel"
import { syncManagedMemberRoles } from "./sync/managed-member-roles"
import { syncCalendarPanel, syncTicketPanel } from "./sync/panels"
import { awaitOwnedOperation } from "./runtime/owned-operation"
import { reportClanDiscordError } from "./error-reporting"
import { logError, logInfo, logWarn } from "./log"
import { syncPayloadEvents } from "./sync/events"
import type { SyncPayload } from "./types"

export async function syncGuildPayload(
    client: Client,
    queuedEventIds: Set<string>,
    payload: SyncPayload,
    mode: "full" | "events_only" = "full",
    attendanceReminderEventIds = new Set<string>(),
    strict = false
) {
    logInfo("guild-sync", "Syncing guild payload", {
        guildId: payload.config.guildId,
        eventCount: payload.events.length,
        rosterCount: payload.rosters.length,
        syncStateCount: payload.syncStates.length,
        mode,
    })

    await runGuildSyncStep(client, "registration summary", payload, () =>
        syncRegistrationSnapshot(client, payload, mode === "full")
    )
    if (mode === "full") {
        await runGuildSyncStep(client, "managed member roles", payload, () =>
            syncManagedMemberRoles(client, payload.config.guildId)
        )
        await runGuildSyncStep(
            client,
            "dashboard admin role sync",
            payload,
            () => syncDashboardAdminRoles(client, payload)
        )
        await runGuildSyncStep(client, "member access sync", payload, () =>
            syncGuildMemberAccess(client, payload)
        )
        await runGuildSyncStep(client, "ticket panel sync", payload, () =>
            syncTicketPanel(client, payload)
        )
        await runGuildSyncStep(client, "membership panel sync", payload, () =>
            syncMembershipPanel(client, payload)
        )
        await runGuildSyncStep(client, "calendar panel sync", payload, () =>
            syncCalendarPanel(client, payload)
        )
    }

    await syncPayloadEvents(client, queuedEventIds, payload, {
        syncRoles: true,
        strict,
    })

    // Event lifecycle and message changes are user-visible state. Never hold them
    // behind potentially slow direct-message delivery.
    if (attendanceReminderEventIds.size > 0) {
        await runGuildSyncStep(
            client,
            "attendance reminder sync",
            payload,
            () =>
                processAttendanceReminders(
                    client,
                    queuedEventIds,
                    payload,
                    attendanceReminderEventIds
                )
        )
    }
}

async function runGuildSyncStep(
    client: Client,
    step: string,
    payload: SyncPayload,
    execute: () => Promise<void>
) {
    try {
        await awaitOwnedOperation(execute(), 20_000, () =>
            logWarn("guild-sync", "Guild sync step is still running", {
                guildId: payload.config.guildId,
                step,
            })
        )
    } catch (error) {
        logError("guild-sync", `Discord bot ${step} failed`, {
            guildId: payload.config.guildId,
            error,
        })
        await reportClanDiscordError({
            client,
            guildId: payload.config.guildId,
            error,
            action: step,
            location: "Guild sync",
            scope: "guild-sync",
        })
    }
}
