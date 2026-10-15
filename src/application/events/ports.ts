import type {
    EventNotice,
    EventParticipant,
    EventSignup,
    EventStatus,
} from "@/domain/events/types"
import type { GameId } from "@/domain/games/game"

export type EventWorkflowRecord = {
    id: string
    guildId: string
    name?: string
    kind?: "match" | "training"
    gameId?: GameId
    signupGroupIds?: string[]
    allowedSignupStatuses?: Array<
        "recruit" | "member" | "reserve_member" | "mercenary"
    >
    allowNonMembersSignup?: boolean
    useGeneralSignup?: boolean
    /** Unpublished drafts accept no sign-ups. */
    isDraft?: boolean
    /** Group caps by group ID; a full group gives a reserve place instead. */
    signupGroupLimits?: Array<{ groupId: string; max: number }>
    registrationEnd: string
    meetingStart: string
    gameStart?: string
    gameEnd: string
    status?: EventStatus
    participants?: EventParticipant[]
    signUps?: EventSignup[]
    absenceNotices?: EventNotice[]
    updatedAt?: string
    createdAt?: string
}

export interface EventWorkflowRepository {
    getById(eventId: string): Promise<EventWorkflowRecord | null>
    getAssignmentForUser(
        serverId: string,
        userId: string,
        gameId?: GameId
    ): Promise<{
        primaryGroupId?: string
        secondaryGroupIds?: string[]
        type?: "member" | "reserve_member" | "mercenary"
        status?: "pending" | "recruit" | "active"
    } | null>
    getGroupNameById(groupId: string): Promise<string | null>
    getReservePlayerIds(eventId: string): Promise<string[]>
    ensureDiscordProfile?(input: {
        userId: string
        name: string
        avatar: string
    }): Promise<void>
    saveSignupState(
        eventId: string,
        input: {
            participants: EventParticipant[]
            signUps: EventSignup[]
            updatedAt: string
        }
    ): Promise<void>
    appendSignupActivity(input: {
        guildId: string
        eventId: string
        eventName: string
        eventKind: "match" | "training"
        userId: string
        action: "signed_up" | "changed_role" | "unsigned" | "declined"
        role?: string | null
        previousRole?: string | null
        occurredAt: string
    }): Promise<void>
    saveAbsenceNotices(
        eventId: string,
        input: {
            absenceNotices: EventNotice[]
            updatedAt: string
        }
    ): Promise<void>
}

export interface EventWorkflowSyncPort {
    syncRosterMembershipForUser(eventId: string, userId: string): Promise<void>
}
