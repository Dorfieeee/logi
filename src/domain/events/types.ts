import type { MatchTeamAssignment } from "../teams/match-teams"

export type EventStatus = "registration" | "closed" | "starting" | "concluded"
export type EventKind = "match" | "training"
export type MatchTypeCategory = string
export type ParticipantStatus = "attending" | "not_attending"
export type ParticipantCompletionStatus = "passed" | "failed"
export type SignupMembershipStatus =
    "recruit" | "member" | "reserve_member" | "mercenary"

export const SIGNUP_NOT_ATTENDING = "NOT_ATTENDING"
export const SIGNUP_ATTENDING = "ATTENDING"
export const SIGNUP_GENERAL = "GENERAL"
export const TRAINING_ATTEND = "ATTEND"

export type EventParticipant = {
    userId: string
    status: ParticipantStatus
    group?: string | null
    /**
     * The capped group a player chose while it was full; they hold a reserve
     * place without a group ("Zálohy · původně Tanky").
     */
    requestedGroup?: string | null
    completed?: ParticipantCompletionStatus
    updatedAt: string
}

export type EventSignup = {
    userId: string
    group?: string | null
}

export type EventNotice = {
    userId: string
    reason: string
    createdAt: string
    /** The clan admin who excused the player; absent for late notices. */
    excusedBy?: string
    /**
     * "late" from "Přijdu později", "cannot_come" from "Nemůžu". Older
     * notices have none and read as late.
     */
    kind?: EventNoticeKind
}

export type EventNoticeKind = "late" | "cannot_come"

export type EventResult = {
    sourceUrl: string
    mapId: string
    mapName?: string
    endedAt?: string
    importedAt: string
    sideA: string
    sideB: string
    outcome: "victory" | "defeat" | "draw"
    score: {
        sideA: number
        sideB: number
    }
}

export type AttendanceReminder = {
    userId: string
    offsetHours: number
    sentAt: string
}

export type EventLike = {
    map?: string
    timeOfDay?: string
    tacticalPlan?: import("./tactical-plan").TacticalPlan | null
    gameId?: import("@/domain/games/game").GameId
    registrationEnd: string
    registrationStart?: string
    meetingStart: string
    gameStart?: string
    gameEnd: string
    kind?: EventKind
    matchType?: MatchTypeCategory
    createForumChannel?: boolean
    status?: EventStatus
    statusUpdatedAt?: string
    concludedAt?: string
    attendanceReminderLog?: AttendanceReminder[]
    participants?: EventParticipant[]
    signUps?: EventSignup[]
    scoreAppliedAt?: string
    scoreResolution?: "applied" | "skipped"
    absenceNotices?: EventNotice[]
    eventResult?: EventResult
    matchStatsId?: unknown
    wardogsReportId?: unknown
    createdAt?: string
    updatedAt?: string
    thumbnailUrl?: string
    imageUrl?: string
    announcementChannelId?: string
    eventInfoChannelId?: string
    meetingChannelId?: string
    createSquadVoiceChannels?: boolean
    squadVoiceCategoryId?: string
    durationMinutes?: number
    requiredRoleIds?: string[]
    rewardRoleIds?: string[]
    stratmapIds?: string[]
    signupGroupIds?: string[]
    allowedSignupStatuses?: SignupMembershipStatus[]
    /** Lets Discord users without a workspace assignment sign up for a match. */
    allowNonMembersSignup?: boolean
    useGeneralSignup?: boolean
    signupReminderStatuses?: Array<"recruit" | "member" | "reserve_member">
    pingClan?: boolean
    pingMode?: "none" | "clan" | "roles"
    pingRoleIds?: string[]
    /** Directory team selections with server-captured snapshots; absent on legacy events. */
    matchTeams?: MatchTeamAssignment[]
}
