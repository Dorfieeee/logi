import { SyncRosterMembershipForUserUseCase } from "@/application/rosters/sync-roster-membership.use-case"
import type { MutationCtx } from "../../../convex/_generated/server"
import { matchesGameScope, type GameId } from "@/domain/games/game"
import type { Id } from "../../../convex/_generated/dataModel"
import { systemClock } from "@/domain/shared/clock"

import {
    ConvexAssignmentRepository,
    ConvexEventRepository,
    ConvexRosterRepository,
} from "./roster-sync-repositories"
import type {
    EventWorkflowRecord,
    EventWorkflowRepository,
    EventWorkflowSyncPort,
} from "@/application/events/ports"

export class ConvexEventWorkflowRepository implements EventWorkflowRepository {
    constructor(private readonly ctx: MutationCtx) {}

    async getById(eventId: string): Promise<EventWorkflowRecord | null> {
        const event = await this.ctx.db.get(eventId as Id<"events">)
        if (!event) {
            return null
        }

        return {
            id: String(event._id),
            guildId: event.guildId,
            name: event.name,
            kind: event.kind,
            gameId: event.gameId,
            signupGroupIds: event.signupGroupIds,
            allowedSignupStatuses: event.allowedSignupStatuses,
            allowNonMembersSignup: event.allowNonMembersSignup,
            useGeneralSignup: event.useGeneralSignup,
            signupGroupLimits: event.signupGroupLimits,
            isDraft: event.isDraft,
            registrationEnd: event.registrationEnd,
            meetingStart: event.meetingStart,
            gameStart: event.gameStart,
            gameEnd: event.gameEnd,
            status: event.status,
            participants: event.participants,
            signUps: event.signUps,
            absenceNotices: event.absenceNotices,
            updatedAt: event.updatedAt,
            createdAt: event.createdAt,
        }
    }

    async getAssignmentForUser(
        serverId: string,
        userId: string,
        gameId?: GameId
    ) {
        const assignments = await this.ctx.db
            .query("userAssignments")
            .withIndex("serverId_userId", (q) =>
                q.eq("serverId", serverId).eq("userId", userId)
            )
            .collect()
        const assignment = assignments
            .filter((candidate) => matchesGameScope(candidate.gameId, gameId))
            .sort((left, right) =>
                right.updatedAt.localeCompare(left.updatedAt)
            )[0]

        return assignment
            ? {
                  primaryGroupId: assignment.primaryGroupId
                      ? String(assignment.primaryGroupId)
                      : undefined,
                  type: assignment.type,
                  status: assignment.status,
              }
            : null
    }

    async getGroupNameById(groupId: string) {
        const group = await this.ctx.db.get(groupId as Id<"groups">)
        return group?.name ?? null
    }

    async getReservePlayerIds(eventId: string) {
        const roster = await this.ctx.db
            .query("rosters")
            .withIndex("eventId", (q) =>
                q.eq("eventId", eventId as Id<"events">)
            )
            .unique()

        return roster?.reservePlayerIds ?? []
    }

    async ensureDiscordProfile(input: {
        userId: string
        name: string
        avatar: string
    }) {
        if (!/^\d{17,20}$/.test(input.userId)) return
        const existing = await this.ctx.db
            .query("users")
            .withIndex("discordId", (q) => q.eq("discordId", input.userId))
            .unique()
        if (existing) return
        const conflictingId = await this.ctx.db
            .query("users")
            .withIndex("id", (q) => q.eq("id", input.userId))
            .unique()
        if (conflictingId) return
        const now = new Date().toISOString()
        await this.ctx.db.insert("users", {
            discordId: input.userId,
            id: input.userId,
            name: input.name.trim() || input.userId,
            nicknames: {},
            avatar:
                input.avatar ||
                "https://cdn.discordapp.com/embed/avatars/0.png",
            managedGuildIds: [],
            guildId: undefined,
            mercenaryGuildIds: [],
            isStreamer: false,
            score: 0,
            scores: {},
            performance: undefined,
            createdAt: now,
            updatedAt: now,
        })
    }

    async saveSignupState(
        eventId: string,
        input: {
            participants: EventWorkflowRecord["participants"]
            signUps: EventWorkflowRecord["signUps"]
            updatedAt: string
        }
    ): Promise<void> {
        await this.ctx.db.patch(eventId as Id<"events">, {
            participants: input.participants ?? [],
            signUps: input.signUps ?? [],
            updatedAt: input.updatedAt,
        })
    }

    async appendSignupActivity(input: {
        guildId: string
        eventId: string
        eventName: string
        eventKind: "match" | "training"
        userId: string
        action: "signed_up" | "changed_role" | "unsigned" | "declined"
        role?: string | null
        previousRole?: string | null
        occurredAt: string
    }): Promise<void> {
        await this.ctx.db.insert("signupActivities", {
            ...input,
            eventId: input.eventId as Id<"events">,
        })
    }

    async saveAbsenceNotices(
        eventId: string,
        input: {
            absenceNotices: EventWorkflowRecord["absenceNotices"]
            updatedAt: string
        }
    ): Promise<void> {
        await this.ctx.db.patch(eventId as Id<"events">, {
            absenceNotices: input.absenceNotices ?? [],
            updatedAt: input.updatedAt,
        })
    }
}

export class ConvexEventWorkflowSyncPort implements EventWorkflowSyncPort {
    constructor(private readonly ctx: MutationCtx) {}

    async syncRosterMembershipForUser(
        eventId: string,
        userId: string
    ): Promise<void> {
        const useCase = new SyncRosterMembershipForUserUseCase(
            new ConvexEventRepository(this.ctx),
            new ConvexRosterRepository(this.ctx),
            new ConvexAssignmentRepository(this.ctx),
            systemClock
        )
        await useCase.execute(eventId, userId)
    }
}
