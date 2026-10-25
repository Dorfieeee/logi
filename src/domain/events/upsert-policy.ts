import { normalizeOptionalArray } from "@/domain/shared/collections"

import {
    eventTimeOfDaySchema,
    tacticalPlanMatchesMap,
    tacticalPlanSchema,
    type TacticalPlan,
} from "./tactical-plan"
import type {
    EventKind,
    EventLike,
    EventStatus,
    SignupMembershipStatus,
} from "./types"
import { normalizeAttendanceReminderHours } from "./scheduled-job-policy"
import type { MatchTeamAssignment } from "@/domain/teams/match-teams"
import { normalizeParticipants } from "./participants"
import type { GameId } from "@/domain/games/game"
import { deriveEventStatus } from "./status"

export type EventUpsertInput = {
    guildId: string
    gameId?: GameId
    kind?: EventKind
    matchType?: string
    name: string
    description?: string
    thumbnailUrl?: string
    imageUrl?: string
    announcementChannelId?: string
    eventInfoChannelId?: string
    eventResultsChannelId?: string
    meetingChannelId?: string
    createSquadVoiceChannels?: boolean
    squadVoiceCategoryId?: string
    durationMinutes?: number
    requiredRoleIds?: string[]
    rewardRoleIds?: string[]
    server?: string
    serverPassword?: string
    side?: string
    map?: string
    timeOfDay?: string
    tacticalPlan?: TacticalPlan | null
    cap?: string
    notes?: string
    registrationStart?: string
    registrationEnd: string
    meetingStart: string
    gameStart: string
    gameEnd: string
    pingClan: boolean
    pingMode?: "none" | "clan" | "roles"
    pingRoleIds?: string[]
    createForumChannel?: boolean
    /** Opt-in only. Missing also means off for existing events. */
    createSignupThread?: boolean
    deleteForumAfterConclusion?: boolean
    topicPresetId?: string
    stratmapIds?: string[]
    signupGroupIds?: string[]
    allowedSignupStatuses?: SignupMembershipStatus[]
    allowNonMembersSignup?: boolean
    useGeneralSignup?: boolean
    signupReminderStatuses?: Array<"recruit" | "member" | "reserve_member">
    recurrence?: {
        frequency: "weekly" | "monthly_date" | "monthly_nth_weekday"
        interval: number
        weekdays: number[]
        monthDay?: number
        nth?: number
        weekday?: number
    }
    /** Resolved at the write boundary; never raw client input. Undefined preserves, [] clears. */
    matchTeams?: MatchTeamAssignment[]
    /**
     * Settings a match template gives. They are written when an event is
     * created or a draft is published. On an update an omitted (undefined)
     * setting keeps the saved value; [] clears the caps or the reminder
     * offsets and "" clears the squad preset.
     */
    signupGroupLimits?: Array<{ groupId: string; max: number }>
    attendanceReminderHours?: number[]
    createParticipantRoles?: boolean
    squadPresetId?: string
}

export const MAX_SIGNUP_GROUP_LIMIT = 100

/**
 * The creation-only settings, tidied: caps only for offered groups of a
 * match, reminder offsets from the supported set (largest first) and the
 * roster's squad preset for matches.
 */
export function buildEventCreationSettings(input: EventUpsertInput) {
    const kind = input.kind ?? "match"
    const offered = new Set(
        kind === "match" ? normalizeOptionalArray(input.signupGroupIds) : []
    )
    const limits = new Map<string, number>()
    for (const limit of normalizeOptionalArray(input.signupGroupLimits)) {
        const groupId = limit.groupId.trim()
        if (
            offered.has(groupId) &&
            Number.isInteger(limit.max) &&
            limit.max >= 1 &&
            limit.max <= MAX_SIGNUP_GROUP_LIMIT
        )
            limits.set(groupId, limit.max)
    }
    return {
        signupGroupLimits: limits.size
            ? [...limits].map(([groupId, max]) => ({ groupId, max }))
            : undefined,
        attendanceReminderHours: normalizeAttendanceReminderHours(
            input.attendanceReminderHours
        ),
        createParticipantRoles: input.createParticipantRoles,
        deleteForumAfterConclusion:
            kind === "match" && (input.deleteForumAfterConclusion ?? true),
        squadPresetId:
            kind === "match"
                ? input.squadPresetId?.trim() || undefined
                : undefined,
    }
}

/**
 * The template settings an update changes: only those the caller sends, tidied
 * like on creation. Undefined keeps the saved value. A lowered cap never
 * removes anyone: players already holding a place keep it and only new
 * sign-ups go to the reserve (`isSignupGroupFull`). New reminder offsets are
 * scheduled by the caller's schedule refresh, as after a time change. Turning
 * participant roles off makes the bot delete the roles it created; a new
 * squad preset is only the default of a roster that does not exist yet.
 */
export function buildEventUpdateSettings(input: EventUpsertInput) {
    const tidied = buildEventCreationSettings(input)
    return {
        ...(input.signupGroupLimits !== undefined
            ? { signupGroupLimits: tidied.signupGroupLimits }
            : {}),
        ...(input.attendanceReminderHours !== undefined
            ? { attendanceReminderHours: tidied.attendanceReminderHours }
            : {}),
        ...(input.deleteForumAfterConclusion !== undefined
            ? { deleteForumAfterConclusion: tidied.deleteForumAfterConclusion }
            : {}),
        ...(input.createParticipantRoles !== undefined
            ? { createParticipantRoles: input.createParticipantRoles }
            : {}),
        ...(input.squadPresetId !== undefined
            ? { squadPresetId: tidied.squadPresetId }
            : {}),
    }
}

function trimOptional(value: string | undefined) {
    return value?.trim() || undefined
}

export function buildEventBasePayload(input: EventUpsertInput) {
    const kind = input.kind ?? "match"
    const tacticalPlan = input.tacticalPlan
        ? tacticalPlanSchema.parse(input.tacticalPlan)
        : undefined
    if (
        tacticalPlan &&
        (kind !== "match" ||
            input.gameId !== "wardogs" ||
            !tacticalPlanMatchesMap(tacticalPlan, input.map))
    ) {
        throw new Error(
            "Tactical plan must belong to the selected Wardogs map."
        )
    }

    return {
        guildId: input.guildId,
        gameId: input.gameId,
        kind,
        matchType: trimOptional(input.matchType),
        name: input.name.trim(),
        description: trimOptional(input.description),
        thumbnailUrl: trimOptional(input.thumbnailUrl),
        imageUrl: trimOptional(input.imageUrl),
        announcementChannelId: trimOptional(input.announcementChannelId),
        eventInfoChannelId:
            kind === "match"
                ? trimOptional(input.eventInfoChannelId)
                : undefined,
        eventResultsChannelId:
            kind === "match"
                ? trimOptional(input.eventResultsChannelId)
                : undefined,
        meetingChannelId: trimOptional(input.meetingChannelId),
        createSquadVoiceChannels: Boolean(input.createSquadVoiceChannels),
        squadVoiceCategoryId: trimOptional(input.squadVoiceCategoryId),
        durationMinutes:
            Number.isInteger(input.durationMinutes) &&
            input.durationMinutes! > 0
                ? input.durationMinutes
                : 90,
        requiredRoleIds: normalizeOptionalArray(input.requiredRoleIds)
            .map((roleId) => roleId.trim())
            .filter(Boolean),
        rewardRoleIds: normalizeOptionalArray(input.rewardRoleIds)
            .map((roleId) => roleId.trim())
            .filter(Boolean),
        server: trimOptional(input.server),
        serverPassword: trimOptional(input.serverPassword),
        side: trimOptional(input.side),
        map: trimOptional(input.map),
        ...(input.timeOfDay !== undefined
            ? {
                  timeOfDay:
                      kind === "match"
                          ? eventTimeOfDaySchema.parse(input.timeOfDay) ||
                            undefined
                          : undefined,
              }
            : {}),
        ...(input.tacticalPlan !== undefined ? { tacticalPlan } : {}),
        cap: trimOptional(input.cap),
        notes: trimOptional(input.notes),
        registrationStart: trimOptional(input.registrationStart),
        registrationEnd: input.registrationEnd,
        meetingStart: input.meetingStart,
        gameStart: input.gameStart,
        gameEnd: input.gameEnd,
        pingClan: input.pingClan,
        pingMode: input.pingMode ?? (input.pingClan ? "clan" : "none"),
        pingRoleIds: normalizeOptionalArray(input.pingRoleIds)
            .map((roleId) => roleId.trim())
            .filter(Boolean),
        createForumChannel:
            kind === "training" ? false : (input.createForumChannel ?? true),
        createSignupThread:
            kind === "match" && Boolean(input.createSignupThread),
        topicPresetId: input.topicPresetId,
        stratmapIds: normalizeOptionalArray(input.stratmapIds)
            .map((id) => id.trim())
            .filter(Boolean),
        signupGroupIds:
            kind === "training"
                ? []
                : normalizeOptionalArray(input.signupGroupIds)
                      .map((id) => id.trim())
                      .filter(Boolean),
        allowedSignupStatuses:
            kind === "training"
                ? undefined
                : normalizeOptionalArray(input.allowedSignupStatuses).filter(
                      (status): status is SignupMembershipStatus =>
                          Boolean(status)
                  ),
        allowNonMembersSignup:
            kind === "match" && Boolean(input.allowNonMembersSignup),
        useGeneralSignup:
            kind === "match" ? Boolean(input.useGeneralSignup) : false,
        signupReminderStatuses:
            kind === "match"
                ? input.signupReminderStatuses === undefined
                    ? (["member"] as Array<
                          "recruit" | "member" | "reserve_member"
                      >)
                    : normalizeOptionalArray(
                          input.signupReminderStatuses
                      ).filter(
                          (
                              status
                          ): status is
                              "recruit" | "member" | "reserve_member" =>
                              status === "recruit" ||
                              status === "member" ||
                              status === "reserve_member"
                      )
                : [],
        recurrence: kind === "match" ? input.recurrence : undefined,
    }
}

export function buildCreateEventRecord(input: EventUpsertInput, now: Date) {
    const nowIso = now.toISOString()
    const base = {
        ...buildEventBasePayload(input),
        ...buildEventCreationSettings(input),
    }
    const derivedStatus: EventStatus = deriveEventStatus(
        {
            registrationEnd: input.registrationEnd,
            meetingStart: input.meetingStart,
            gameEnd: input.gameEnd,
        },
        now
    )

    return {
        ...base,
        status: derivedStatus,
        statusUpdatedAt: nowIso,
        concludedAt: derivedStatus === "concluded" ? nowIso : undefined,
        attendanceReminderLog: [],
        participants: [],
        signUps: [],
        scoreAppliedAt: undefined,
        scoreResolution: undefined,
        absenceNotices: [],
        eventResult: undefined,
        matchStatsId: undefined,
        ...(input.matchTeams !== undefined
            ? { matchTeams: input.matchTeams }
            : {}),
        createdAt: nowIso,
        updatedAt: nowIso,
    }
}

export function buildUpdateEventPatch(
    existing: EventLike,
    input: EventUpsertInput,
    now: Date
) {
    const nowIso = now.toISOString()
    const base = buildEventBasePayload({
        ...input,
        gameId: input.gameId ?? existing.gameId,
    })
    // Discord message locations and recipients are creation-time choices.  The
    // bot persists message IDs per location, so changing either later could
    // update or delete a message belonging to a different event.
    const {
        announcementChannelId: _announcementChannelId,
        eventInfoChannelId: _eventInfoChannelId,
        eventResultsChannelId: _eventResultsChannelId,
        ...mutableBase
    } = base
    const derivedStatus: EventStatus = deriveEventStatus(
        {
            registrationEnd: input.registrationEnd,
            meetingStart: input.meetingStart,
            gameEnd: input.gameEnd,
            status: existing.status,
        },
        now
    )

    return {
        ...mutableBase,
        // A map change cannot retain positions from a different battlefield.
        ...(input.tacticalPlan === undefined &&
        (input.map !== existing.map ||
            (input.gameId !== undefined && input.gameId !== existing.gameId))
            ? { tacticalPlan: undefined }
            : {}),
        ...buildEventUpdateSettings(input),
        // An edit without a game selector must not move a scoped event back to HLL.
        gameId: input.gameId ?? existing.gameId,
        announcementChannelId: existing.announcementChannelId,
        eventInfoChannelId: existing.eventInfoChannelId,
        eventResultsChannelId: existing.eventResultsChannelId,
        status: derivedStatus,
        statusUpdatedAt: nowIso,
        concludedAt:
            derivedStatus === "concluded"
                ? (existing.concludedAt ?? nowIso)
                : undefined,
        eventResult: existing.eventResult,
        matchStatsId: existing.matchStatsId,
        attendanceReminderLog: normalizeOptionalArray(
            existing.attendanceReminderLog
        ),
        participants: normalizeParticipants(
            existing.participants,
            existing.signUps,
            nowIso
        ),
        signUps: normalizeOptionalArray(existing.signUps),
        scoreAppliedAt: existing.scoreAppliedAt,
        scoreResolution: existing.scoreResolution,
        absenceNotices: normalizeOptionalArray(existing.absenceNotices),
        // Omitted assignments preserve the saved selection; an explicit [] clears it.
        matchTeams: input.matchTeams ?? existing.matchTeams,
        updatedAt: nowIso,
    }
}
