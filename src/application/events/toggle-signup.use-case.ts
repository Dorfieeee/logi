import { SIGNUP_GENERAL, SIGNUP_NOT_ATTENDING } from "@/domain/events/types"
import { getResolvedMemberStatus } from "@/domain/assignments/policy"
import { normalizeEventRecord } from "@/domain/events/normalization"
import { isSignupGroupFull } from "@/domain/events/signup-limits"
import { toggleSignup } from "@/domain/events/signup-policy"
import type { Clock } from "@/application/ports/clock"
import { isDraftEvent } from "@/domain/events/drafts"

import type { EventWorkflowRepository, EventWorkflowSyncPort } from "./ports"

export class ToggleSignupUseCase {
    constructor(
        private readonly events: EventWorkflowRepository,
        private readonly rosterSync: EventWorkflowSyncPort,
        private readonly clock: Clock
    ) {}

    async execute(input: {
        eventId: string
        userId: string
        group: string | null
        profile?: { name: string; avatar: string }
    }) {
        const event = await this.events.getById(input.eventId)
        // A draft has not been announced, so nobody can sign up for it yet.
        if (!event || isDraftEvent(event)) {
            throw new Error("Event not found.")
        }

        const now = this.clock.now()
        const normalizedEvent = normalizeEventRecord(event, now)
        const previousParticipant = normalizedEvent.participants.find(
            (participant) => participant.userId === input.userId
        )
        let nextGroup = input.group
        const assignment = await this.events.getAssignmentForUser(
            normalizedEvent.guildId,
            input.userId,
            normalizedEvent.gameId
        )
        const resolvedMembershipStatus =
            assignment?.type && assignment.status
                ? getResolvedMemberStatus(assignment.type, assignment.status)
                : null
        const membershipStatus =
            resolvedMembershipStatus && resolvedMembershipStatus !== "pending"
                ? resolvedMembershipStatus
                : null

        if (
            normalizedEvent.kind === "match" &&
            input.group === SIGNUP_GENERAL
        ) {
            const groupIds = [
                assignment?.primaryGroupId,
                ...(assignment?.secondaryGroupIds ?? []),
            ]
            const allowedGroupIds = new Set(
                normalizedEvent.signupGroupIds ?? []
            )
            const groupId = groupIds.find(
                (candidate): candidate is string =>
                    typeof candidate === "string" &&
                    allowedGroupIds.has(candidate)
            )
            nextGroup = groupId
                ? await this.events.getGroupNameById(groupId)
                : null
        }

        // A capped group that is already full gives the player a reserve
        // place instead: a signup without a group, which the roster treats as
        // a reserve candidate. The caller learns which group was full.
        let fullGroup: string | undefined
        if (
            normalizedEvent.kind === "match" &&
            nextGroup &&
            nextGroup !== SIGNUP_NOT_ATTENDING &&
            nextGroup !== SIGNUP_GENERAL &&
            event.signupGroupLimits?.length
        ) {
            for (const limit of event.signupGroupLimits) {
                const groupName = await this.events.getGroupNameById(
                    limit.groupId
                )
                if (
                    groupName === nextGroup &&
                    isSignupGroupFull({
                        participants: normalizedEvent.participants,
                        userId: input.userId,
                        groupName,
                        max: limit.max,
                    })
                ) {
                    fullGroup = groupName
                    nextGroup = null
                    break
                }
            }
        }

        const next = toggleSignup({
            participants: normalizedEvent.participants,
            event: normalizedEvent,
            userId: input.userId,
            group: nextGroup,
            now,
            membershipStatus,
            requestedGroup: fullGroup,
        })

        if (input.profile) {
            await this.events.ensureDiscordProfile?.({
                userId: input.userId,
                ...input.profile,
            })
        }

        await this.events.saveSignupState(input.eventId, {
            participants: next.participants,
            signUps: next.signUps,
            updatedAt: now.toISOString(),
        })
        const nextParticipant = next.participants.find(
            (participant) => participant.userId === input.userId
        )
        const action = next.removed
            ? "unsigned"
            : nextParticipant?.status === "not_attending"
              ? "declined"
              : previousParticipant?.status === "attending" &&
                  previousParticipant.group !== nextParticipant?.group
                ? "changed_role"
                : "signed_up"
        await this.events.appendSignupActivity({
            guildId: normalizedEvent.guildId,
            eventId: input.eventId,
            eventName: event.name ?? "Event",
            eventKind: normalizedEvent.kind ?? "match",
            userId: input.userId,
            action,
            role: nextParticipant?.group,
            previousRole: previousParticipant?.group,
            occurredAt: now.toISOString(),
        })
        await this.rosterSync.syncRosterMembershipForUser(
            input.eventId,
            input.userId
        )

        return {
            signUps: next.signUps,
            appliedSignupLabel:
                input.group === SIGNUP_NOT_ATTENDING
                    ? SIGNUP_NOT_ATTENDING
                    : (nextGroup ?? SIGNUP_GENERAL),
            removed: next.removed,
            ...(fullGroup ? { fullGroup } : {}),
        }
    }
}
