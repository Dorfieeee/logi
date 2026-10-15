import {
    findEligibleNoticeTargets,
    findStartedNoticeEvent,
} from "@/domain/events/notice-policy"
import type { MatchTeamAssignment } from "@/domain/teams/match-teams"
import { normalizeEventRecord } from "@/domain/events/normalization"
import type { EventLike } from "@/domain/events/types"

type ExecuteUseCase<TInput = void, TResult = unknown> = {
    execute(input: TInput): Promise<TResult>
}

export function assertInternalSecret(secret: string, expectedSecret: string) {
    if (secret !== expectedSecret) {
        throw new Error("Unauthorized.")
    }
}

/** The stored facts an upsert needs from the event it updates. */
export type UpsertExistingEvent = Pick<
    EventLike,
    "gameId" | "kind" | "status" | "matchTeams"
> &
    Partial<Pick<EventLike, "registrationEnd" | "meetingStart" | "gameEnd">> & {
        guildId?: string
    }

export async function handleUpsertEvent(input: {
    secret: string
    expectedSecret: string
    args: Record<string, unknown> & {
        secret: string
        serverId: string
        eventId?: string
        topicPresetId?: string
    }
    getGuildById: (
        serverId: string
    ) => Promise<{ discordId?: string; id?: string } | null>
    getGuildDiscordId: (guild: { discordId?: string; id?: string }) => string
    getEventById: (eventId: string) => Promise<UpsertExistingEvent | null>
    /**
     * Resolves raw `matchTeams` client input against the directory for this
     * guild. Without a resolver the field is dropped, so a client can never
     * persist snapshots of its own.
     */
    resolveMatchTeams?: (context: {
        guildId: string
        existing: UpsertExistingEvent | null
    }) => Promise<MatchTeamAssignment[] | undefined>
    createUseCase: () => ExecuteUseCase<Record<string, unknown>, unknown>
}) {
    assertInternalSecret(input.secret, input.expectedSecret)

    const guild = await input.getGuildById(input.args.serverId)
    if (!guild) {
        throw new Error("Server not found.")
    }

    const guildId = input.getGuildDiscordId(guild)
    let existing: UpsertExistingEvent | null = null
    if (input.args.eventId) {
        existing = await input.getEventById(input.args.eventId)
        if (!existing || existing.guildId !== guildId) {
            // Do not allow a caller that can name another guild's event ID to
            // update it merely by supplying a server they do control.
            throw new Error("Event not found.")
        }
    }

    const matchTeams = input.resolveMatchTeams
        ? await input.resolveMatchTeams({ guildId, existing })
        : undefined
    const {
        secret: _secret,
        serverId: _serverId,
        matchTeams: _clientMatchTeams,
        ...command
    } = input.args

    return await input.createUseCase().execute({
        ...command,
        guildId,
        matchTeams,
        topicPresetId: input.args.topicPresetId
            ? String(input.args.topicPresetId)
            : undefined,
    })
}

export async function handleToggleSignup(input: {
    secret: string
    expectedSecret: string
    args: {
        eventId: string
        userId: string
        group: string | null
        profile?: { name: string; avatar: string }
    }
    createUseCase: () => ExecuteUseCase<
        {
            eventId: string
            userId: string
            group: string | null
            profile?: { name: string; avatar: string }
        },
        unknown
    >
}) {
    assertInternalSecret(input.secret, input.expectedSecret)
    return await input.createUseCase().execute(input.args)
}

export async function handleReconcileStatuses(input: {
    secret: string
    expectedSecret: string
    args: { cursor: string | null; limit: number; eventId?: string }
    createUseCase: () => ExecuteUseCase<
        { cursor: string | null; limit: number; eventId?: string },
        unknown
    >
}) {
    assertInternalSecret(input.secret, input.expectedSecret)
    return await input.createUseCase().execute(input.args)
}

export async function handleConcludeEvent(input: {
    secret: string
    expectedSecret: string
    eventId: string
    createUseCase: () => ExecuteUseCase<string, unknown>
}) {
    assertInternalSecret(input.secret, input.expectedSecret)
    return await input.createUseCase().execute(input.eventId)
}

export async function handleAppendAttendanceReminderLog(input: {
    secret: string
    expectedSecret: string
    eventId: string
    reminders: Array<{ userId: string; offsetHours: number; sentAt: string }>
    getEventById: (
        eventId: string
    ) => Promise<(Record<string, unknown> & EventLike) | null>
    patchEvent: (
        eventId: string,
        patch: Record<string, unknown>
    ) => Promise<void>
}) {
    assertInternalSecret(input.secret, input.expectedSecret)

    const event = await input.getEventById(input.eventId)
    if (!event) {
        throw new Error("Event not found.")
    }

    const normalizedEvent = normalizeEventRecord(event)

    await input.patchEvent(input.eventId, {
        attendanceReminderLog: [
            ...normalizedEvent.attendanceReminderLog,
            ...input.reminders,
        ],
        updatedAt: new Date().toISOString(),
    })

    return { ok: true as const }
}

export async function handleUpsertNotice(input: {
    secret: string
    expectedSecret: string
    args: { eventId: string; userId: string; reason: string }
    createUseCase: () => ExecuteUseCase<
        { eventId: string; userId: string; reason: string },
        { ok: true }
    >
}) {
    assertInternalSecret(input.secret, input.expectedSecret)
    return await input.createUseCase().execute(input.args)
}

export async function handleSetEventResult(input: {
    secret: string
    expectedSecret: string
    eventId: string
    eventResult: Record<string, unknown>
    getEventById: (eventId: string) => Promise<Record<string, unknown> | null>
    patchEvent: (
        eventId: string,
        patch: Record<string, unknown>
    ) => Promise<void>
}) {
    assertInternalSecret(input.secret, input.expectedSecret)

    const event = await input.getEventById(input.eventId)
    if (!event) {
        throw new Error("Event not found.")
    }

    await input.patchEvent(input.eventId, {
        eventResult: input.eventResult,
        updatedAt: new Date().toISOString(),
    })

    return { ok: true as const }
}

export function handleFindNoticeTarget(input: {
    events: Array<
        (Record<string, unknown> & EventLike) & {
            _id: unknown
            name: string
            reservePlayerIds?: string[]
        }
    >
    userId: string
    query: string
    now: Date
}) {
    return findEligibleNoticeTargets({
        events: input.events.map((event) => {
            const normalized = normalizeEventRecord(event, input.now)
            return {
                id: String(event._id),
                name: event.name,
                gameStart: normalized.gameStart ?? normalized.meetingStart,
                status: normalized.status,
                participants: normalized.participants,
                reservePlayerIds: event.reservePlayerIds,
            }
        }),
        userId: input.userId,
        query: input.query,
        now: input.now,
    }).map((event) => ({
        id: event.id,
        name: event.name,
        gameStart: event.gameStart,
    }))
}

/**
 * The person's started event that matches the typed `/notice` text, for
 * "VLK vs ROG už začal" (M3-19); only its ID and name leave the backend.
 */
export function handleFindStartedNoticeEvent(input: {
    events: Array<
        (Record<string, unknown> & EventLike) & {
            _id: unknown
            name: string
            reservePlayerIds?: string[]
        }
    >
    userId: string
    query: string
    now: Date
}) {
    const found = findStartedNoticeEvent({
        events: input.events.map((event) => {
            const normalized = normalizeEventRecord(event, input.now)
            return {
                id: String(event._id),
                name: event.name,
                gameStart: normalized.gameStart ?? normalized.meetingStart,
                status: normalized.status,
                participants: normalized.participants,
                reservePlayerIds: event.reservePlayerIds,
            }
        }),
        userId: input.userId,
        query: input.query,
        now: input.now,
    })
    return found ? { id: found.id, name: found.name } : null
}

export async function handleApplyEventScore(input: {
    eventId: string
    createUseCase: () => ExecuteUseCase<string, unknown>
}) {
    return await input.createUseCase().execute(input.eventId)
}
