import { makeFunctionReference } from "convex/server"
import { ConvexReactClient } from "convex/react"
import WebSocket from "ws"

import { env } from "./environment"

// Node 20 on the production host does not expose a global WebSocket.
// Convex's reactive client expects one for query watchers used by the bot.
if (typeof globalThis.WebSocket === "undefined") {
    globalThis.WebSocket = WebSocket as typeof globalThis.WebSocket
}

let convexClient: ConvexReactClient | null = null

function getConvexClient() {
    if (!convexClient) {
        convexClient = new ConvexReactClient(env.convexUrl)
    }

    return convexClient
}

export const convex = new Proxy({} as ConvexReactClient, {
    get(_target, property, receiver) {
        const value = Reflect.get(
            getConvexClient() as object,
            property,
            receiver
        )
        return typeof value === "function"
            ? value.bind(getConvexClient())
            : value
    },
})

export async function closeConvexClient() {
    if (!convexClient) {
        return
    }

    const client = convexClient
    convexClient = null
    await client.close()
}

export const references = {
    pendingEventDeletions: makeFunctionReference<"query">(
        "eventDeletion:pending"
    ),
    claimEventDeletion: makeFunctionReference<"mutation">(
        "eventDeletion:claim"
    ),
    finishEventDeletion: makeFunctionReference<"mutation">(
        "eventDeletion:finish"
    ),
    getGameDataConnections: makeFunctionReference<"query">(
        "gameData:listConnections"
    ),
    getPlatformSettings: makeFunctionReference<"query">("platformSettings:get"),
    updatePlatformStatusState: makeFunctionReference<"mutation">(
        "platformSettings:updateBotState"
    ),
    acknowledgeAttendance: makeFunctionReference<"mutation">(
        "rosters:acknowledgeAttendance"
    ),
    declineAttendance: makeFunctionReference<"mutation">(
        "rosters:declineAttendance"
    ),
    applyEventScore: makeFunctionReference<"mutation">(
        "events:applyEventScore"
    ),
    appendAttendanceReminderLog: makeFunctionReference<"mutation">(
        "events:appendAttendanceReminderLog"
    ),
    closeTicketThread: makeFunctionReference<"mutation">(
        "discordMembership:closeTicketThread"
    ),
    claimMeetingAttendanceRequest: makeFunctionReference<"mutation">(
        "meetingAttendance:claimMeetingAttendanceRequest"
    ),
    completeMeetingAttendanceRequest: makeFunctionReference<"mutation">(
        "meetingAttendance:completeMeetingAttendanceRequest"
    ),
    closeMembershipApplicationThread: makeFunctionReference<"mutation">(
        "discordMembership:closeMembershipApplicationThread"
    ),
    createMembershipApplicationThread: makeFunctionReference<"mutation">(
        "discordMembership:createMembershipApplicationThread"
    ),
    createTicketThread: makeFunctionReference<"mutation">(
        "discordMembership:createTicketThread"
    ),
    getEventInteractionContext: makeFunctionReference<"query">(
        "discordSync:getEventInteractionContext"
    ),
    getEventSignupContext: makeFunctionReference<"query">(
        "discordSync:getEventSignupContext"
    ),
    getEventSyncContext: makeFunctionReference<"query">(
        "discordSync:getEventSyncContext"
    ),
    listPendingMeetingAttendanceRequests: makeFunctionReference<"query">(
        "meetingAttendance:listPendingMeetingAttendanceRequests"
    ),
    listPendingManualReminders: makeFunctionReference<"query">(
        "eventReminders:listPending"
    ),
    claimManualReminder: makeFunctionReference<"mutation">(
        "eventReminders:claim"
    ),
    completeManualReminder: makeFunctionReference<"mutation">(
        "eventReminders:complete"
    ),
    failManualReminder: makeFunctionReference<"mutation">(
        "eventReminders:fail"
    ),
    getPendingMatchRecaps: makeFunctionReference<"query">(
        "matchRecaps:listPendingForEvent"
    ),
    prepareMatchRecapDelivery: makeFunctionReference<"query">(
        "matchRecaps:prepareDelivery"
    ),
    markMatchRecapSent: makeFunctionReference<"mutation">(
        "matchRecaps:markSent"
    ),
    setMatchRecapNotifications: makeFunctionReference<"mutation">(
        "players:setMatchRecapNotifications"
    ),
    findNoticeTarget: makeFunctionReference<"query">("events:findNoticeTarget"),
    findStartedNoticeEvent: makeFunctionReference<"query">(
        "events:findStartedNoticeEvent"
    ),
    failMeetingAttendanceRequest: makeFunctionReference<"mutation">(
        "meetingAttendance:failMeetingAttendanceRequest"
    ),
    confirmRosterAttendanceFromMeetingChannel:
        makeFunctionReference<"mutation">(
            "discordRosters:confirmRosterAttendanceFromMeetingChannel"
        ),
    getConfigByDiscordGuildId: makeFunctionReference<"query">(
        "discordConfig:getConfigByDiscordGuildId"
    ),
    getMembershipApplicationThreadContext: makeFunctionReference<"query">(
        "discordMembership:getMembershipApplicationThreadContext"
    ),
    getTicketThreadContext: makeFunctionReference<"query">(
        "discordMembership:getTicketThreadContext"
    ),
    getDiscordPlatformLinkState: makeFunctionReference<"query">(
        "players:getDiscordPlatformLinkState"
    ),
    getLinkContext: makeFunctionReference<"query">(
        "discordGameAccounts:getLinkContext"
    ),
    searchClanPlayers: makeFunctionReference<"query">(
        "players:searchClanPlayers"
    ),
    getClanPlayerProfile: makeFunctionReference<"query">(
        "players:getClanPlayerProfile"
    ),
    linkDiscordPlatformId: makeFunctionReference<"mutation">(
        "players:linkDiscordPlatformId"
    ),
    unlinkDiscordPlatformId: makeFunctionReference<"mutation">(
        "players:unlinkDiscordPlatformId"
    ),
    listEventSyncIndex: makeFunctionReference<"query">(
        "discordSync:listEventSyncIndex"
    ),
    listGuildCacheSnapshot: makeFunctionReference<"query">(
        "discordSync:listGuildCacheSnapshot"
    ),
    listSyncPayloads: makeFunctionReference<"query">(
        "discordSync:listSyncPayloads"
    ),
    listGuildAssignments: makeFunctionReference<"query">(
        "discordSync:listGuildAssignments"
    ),
    reconcileStatuses: makeFunctionReference<"mutation">(
        "events:reconcileStatuses"
    ),
    claimDueScheduledJobs: makeFunctionReference<"mutation">(
        "scheduledJobs:claimDue"
    ),
    completeScheduledJob: makeFunctionReference<"mutation">(
        "scheduledJobs:complete"
    ),
    releaseScheduledJob: makeFunctionReference<"mutation">(
        "scheduledJobs:release"
    ),
    backfillMissingScheduledJobs: makeFunctionReference<"mutation">(
        "scheduledJobs:backfillMissing"
    ),
    generateRecurringEvents: makeFunctionReference<"mutation">(
        "eventRecurrence:generateDue"
    ),
    recoverScheduledJobQueue: makeFunctionReference<"mutation">(
        "scheduledJobs:recoverQueue"
    ),
    setDiscordEventRoles: makeFunctionReference<"mutation">(
        "events:setDiscordEventRoles"
    ),
    upsertMemberAccess: makeFunctionReference<"mutation">(
        "discordSync:upsertMemberAccess"
    ),
    removeMemberAccess: makeFunctionReference<"mutation">(
        "discordSync:removeMemberAccess"
    ),
    toggleSignUp: makeFunctionReference<"mutation">("events:toggleSignUp"),
    upsertNotice: makeFunctionReference<"mutation">("events:upsertNotice"),
    updateMembershipApplicationTranscriptMessage:
        makeFunctionReference<"mutation">(
            "discordMembership:updateMembershipApplicationTranscriptMessage"
        ),
    updateMembershipPanelState: makeFunctionReference<"mutation">(
        "discordConfig:updateMembershipPanelState"
    ),
    updateEventSyncState: makeFunctionReference<"mutation">(
        "discordSync:updateEventSyncState"
    ),
    updateRosterUpdateMessage: makeFunctionReference<"mutation">(
        "discordSync:updateRosterUpdateMessage"
    ),
    updateCalendarPanelState: makeFunctionReference<"mutation">(
        "discordConfig:updateCalendarPanelState"
    ),
    updateTicketTranscriptMessage: makeFunctionReference<"mutation">(
        "discordMembership:updateTicketTranscriptMessage"
    ),
    updateTicketPanelState: makeFunctionReference<"mutation">(
        "discordConfig:updateTicketPanelState"
    ),
    upsertAssignment: makeFunctionReference<"mutation">(
        "userAssignments:upsertByServerDiscordId"
    ),
    removeAssignment: makeFunctionReference<"mutation">(
        "userAssignments:remove"
    ),
    getAssignmentForServerUser: makeFunctionReference<"query">(
        "userAssignments:getForServerUser"
    ),
    claimTeamRequestNotifications: makeFunctionReference<"mutation">(
        "teamRequests:claimNotifications"
    ),
    markTeamRequestNotified: makeFunctionReference<"mutation">(
        "teamRequests:markNotified"
    ),
    // Roster, match forum and match DMs (W6b).
    getMatchForumContext: makeFunctionReference<"query">(
        "discordMatchForum:forumContext"
    ),
    listPendingRosterChanges: makeFunctionReference<"query">(
        "rosterChanges:listPending"
    ),
    claimRosterChanges: makeFunctionReference<"mutation">(
        "rosterChanges:claim"
    ),
    completeRosterChanges: makeFunctionReference<"mutation">(
        "rosterChanges:complete"
    ),
    failRosterChanges: makeFunctionReference<"mutation">("rosterChanges:fail"),
    getMatchRecapCard: makeFunctionReference<"query">("matchRecaps:recapCard"),
}
