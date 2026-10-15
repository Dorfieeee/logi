import type {
    EventParticipant,
    EventStatus,
    SignupMembershipStatus,
} from "./types"
import { participantsToSignUps } from "./participants"
import { SIGNUP_NOT_ATTENDING } from "./types"
import { canAcceptSignups } from "./status"

export const DEFAULT_ALLOWED_SIGNUP_STATUSES: SignupMembershipStatus[] = [
    "recruit",
    "member",
    "reserve_member",
    "mercenary",
]

export function isSignupMembershipAllowed(input: {
    event: {
        kind?: "match" | "training"
        allowedSignupStatuses?: SignupMembershipStatus[]
        allowNonMembersSignup?: boolean
    }
    membershipStatus?: SignupMembershipStatus | null
}) {
    if (input.event.kind !== "match") {
        return true
    }

    if (!input.membershipStatus)
        return Boolean(input.event.allowNonMembersSignup)

    const allowedStatuses = input.event.allowedSignupStatuses?.length
        ? input.event.allowedSignupStatuses
        : DEFAULT_ALLOWED_SIGNUP_STATUSES

    return allowedStatuses.includes(input.membershipStatus)
}

export function assertSignupMembershipAllowed(input: {
    event: {
        kind?: "match" | "training"
        allowedSignupStatuses?: SignupMembershipStatus[]
        allowNonMembersSignup?: boolean
    }
    membershipStatus?: SignupMembershipStatus | null
}) {
    if (!isSignupMembershipAllowed(input)) {
        throw new Error(
            "Your membership status is not allowed to sign up for this match."
        )
    }
}

export function toggleSignup(input: {
    participants: EventParticipant[]
    event: {
        kind?: "match" | "training"
        registrationEnd: string
        status?: EventStatus
        allowedSignupStatuses?: SignupMembershipStatus[]
        allowNonMembersSignup?: boolean
    }
    userId: string
    group: string | null
    now: Date
    membershipStatus?: SignupMembershipStatus | null
    /** The full capped group the player chose; they get a reserve place. */
    requestedGroup?: string | null
}) {
    if (!canAcceptSignups(input.event, input.now)) {
        throw new Error("Signups are closed for this event.")
    }

    assertSignupMembershipAllowed({
        event: input.event,
        membershipStatus: input.membershipStatus,
    })

    const existing = input.participants.find(
        (participant) => participant.userId === input.userId
    )
    let participants = input.participants.filter(
        (participant) => participant.userId !== input.userId
    )
    const normalizedNextGroup =
        input.group && input.group !== SIGNUP_NOT_ATTENDING ? input.group : null
    const nextStatus =
        input.group === SIGNUP_NOT_ATTENDING ? "not_attending" : "attending"
    participants = [
        ...participants,
        {
            userId: input.userId,
            status: nextStatus,
            group: normalizedNextGroup,
            ...(nextStatus === "attending" &&
            !normalizedNextGroup &&
            input.requestedGroup
                ? { requestedGroup: input.requestedGroup }
                : {}),
            updatedAt: input.now.toISOString(),
            completed: existing?.completed,
        },
    ]

    return {
        participants,
        signUps: participantsToSignUps(participants),
        removed: false,
    }
}
