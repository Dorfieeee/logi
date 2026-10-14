import {
    getGuildDiscordId,
    getUserDiscordId,
    getUserStableId,
} from "../../../convex/identity"
import { normalizeEventRecord } from "@/domain/events/normalization"

type UnknownDoc = { _id: unknown }

export function normalizeDoc<T extends UnknownDoc>(doc: T) {
    return {
        ...doc,
        id: String(doc._id),
    }
}

export function normalizeUserDoc<
    T extends {
        _id: unknown
        discordId?: string
        id?: string
        name: string
        note?: string
        nicknames?: Record<string, string>
        platformIds?: string[]
        platformId?: string
        steamId?: string
        score?: number
        scores?: Record<string, number>
    },
>(user: T, options?: { guildId?: string }) {
    const legacyUser = user as T & { steamId?: string; platformId?: string }
    const guildDisplayName = options?.guildId
        ? user.nicknames?.[options.guildId]?.trim()
        : undefined

    return {
        ...user,
        id: getUserStableId(user),
        discordId: getUserDiscordId(user),
        name: guildDisplayName || user.name,
        linkedDiscordId: user.discordId,
        hasDiscordLink: Boolean(user.discordId),
        note: user.note?.trim() || undefined,
        nicknames: user.nicknames ?? {},
        platformIds: [
            ...new Set(
                (
                    user.platformIds ??
                    [legacyUser.platformId ?? legacyUser.steamId].filter(
                        Boolean
                    )
                )
                    .flatMap((entry) => String(entry).split(","))
                    .map((entry) => entry.replace(/\s+/g, "").trim())
                    .filter(Boolean)
            ),
        ],
        scores: user.scores ?? {},
    }
}

export function normalizeGuildDoc<T extends UnknownDoc>(
    guild: T & { discordId?: string; id?: string }
) {
    return {
        ...normalizeDoc(guild),
        discordId: getGuildDiscordId(guild),
        eventCategories: Array.isArray(
            (guild as { eventCategories?: unknown[] }).eventCategories
        )
            ? (
                  (
                      guild as {
                          eventCategories?: Array<{
                              id: string
                              label: string
                              color: string
                              emoji?: string
                          }>
                      }
                  ).eventCategories ?? []
              ).map((category) => ({
                  id: category.id,
                  label: category.label,
                  color: category.color,
                  emoji: category.emoji,
              }))
            : [],
        calendarItems: Array.isArray(
            (guild as { calendarItems?: unknown[] }).calendarItems
        )
            ? (
                  (
                      guild as {
                          calendarItems?: Array<{
                              id: string
                              guildId: string
                              title: string
                              description?: string
                              color: string
                              emoji?: string
                              label?: string
                              startAt: string
                              endAt: string
                              allDay: boolean
                              recurrence?: {
                                  frequency:
                                      | "weekly"
                                      | "monthly_date"
                                      | "monthly_nth_weekday"
                                      | "yearly"
                                  interval: number
                                  until?: string
                              }
                          }>
                      }
                  ).calendarItems ?? []
              ).map((item) => ({
                  id: item.id,
                  guildId: item.guildId,
                  title: item.title,
                  description: item.description,
                  color: item.color,
                  emoji: item.emoji,
                  label: item.label,
                  startAt: item.startAt,
                  endAt: item.endAt,
                  allDay: item.allDay,
                  recurrence: item.recurrence,
              }))
            : [],
    }
}

export function normalizeCalendarItemDoc<
    T extends UnknownDoc & {
        guildId: string
        title: string
        description?: string
        color: string
        emoji?: string
        label?: string
        startAt: string
        endAt: string
        allDay: boolean
        recurrence?: {
            frequency:
                "weekly" | "monthly_date" | "monthly_nth_weekday" | "yearly"
            interval: number
            until?: string
        }
        createdAt?: string
        updatedAt?: string
    },
>(item: T) {
    return {
        ...normalizeDoc(item),
        recurrence: item.recurrence,
    }
}

export function normalizeEventDoc<
    T extends {
        _id: unknown
        registrationEnd: string
        meetingStart: string
        gameEnd: string
        gameId?: import("@/domain/games/game").GameId
        kind?: "match" | "training"
        matchType?: string
        thumbnailUrl?: string
        imageUrl?: string
        meetingChannelId?: string
        requiredRoleIds?: string[]
        rewardRoleIds?: string[]
        signupGroupIds?: string[]
        useGeneralSignup?: boolean
        stratmapIds?: string[]
        createForumChannel?: boolean
        status?: "registration" | "closed" | "starting" | "concluded"
        statusUpdatedAt?: string
        concludedAt?: string
        eventResult?: {
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
        wardogsReportId?: unknown
        matchStatsId?: unknown
        competitionFixtureId?: unknown
        attendanceReminderLog?: Array<{
            userId: string
            offsetHours: number
            sentAt: string
        }>
        participants?: Array<{
            userId: string
            status: "attending" | "not_attending"
            group?: string | null
            completed?: "passed" | "failed"
            updatedAt: string
        }>
        signUps?: Array<{ userId: string; group?: string | null }>
        scoreAppliedAt?: string
        scoreResolution?: "applied" | "skipped"
        absenceNotices?: Array<{
            userId: string
            reason: string
            createdAt: string
        }>
        updatedAt?: string
        createdAt?: string
    },
>(event: T) {
    const normalized = normalizeEventRecord(event)

    return {
        ...normalizeDoc(event),
        ...normalized,
        matchStatsId: normalized.matchStatsId
            ? String(normalized.matchStatsId)
            : undefined,
        wardogsReportId: event.wardogsReportId
            ? String(event.wardogsReportId)
            : undefined,
        matchId: normalized.matchStatsId
            ? String(normalized.matchStatsId)
            : undefined,
        competitionFixtureId: event.competitionFixtureId
            ? String(event.competitionFixtureId)
            : undefined,
    }
}

export function normalizeAssignmentDoc<
    T extends {
        _id: unknown
        serverId: string
        primaryGroupId?: unknown
        secondaryGroupIds?: unknown[]
    },
>(assignment: T, groupNameById: Map<string, string>) {
    const primaryGroupId = assignment.primaryGroupId
        ? String(assignment.primaryGroupId)
        : undefined
    const secondaryGroupIds = Array.isArray(assignment.secondaryGroupIds)
        ? assignment.secondaryGroupIds.map((groupId) => String(groupId))
        : []

    return {
        ...assignment,
        id: String(assignment._id),
        primaryGroupId,
        secondaryGroupIds,
        primaryGroup: primaryGroupId
            ? groupNameById.get(primaryGroupId)
            : undefined,
        secondaryGroups: secondaryGroupIds
            .map((groupId) => groupNameById.get(groupId))
            .filter((groupName): groupName is string => Boolean(groupName)),
    }
}

export function normalizeStratmapDoc<
    T extends UnknownDoc & {
        eventId?: unknown
    },
>(stratmap: T) {
    return {
        ...normalizeDoc(stratmap),
        eventId: stratmap.eventId ? String(stratmap.eventId) : undefined,
    }
}

export function canAccessServerContext(input: {
    user: {
        guildId?: string
        managedGuildIds: string[]
        mercenaryGuildIds: string[]
    }
    serverDiscordId: string
    serverAdminIds?: string[]
    dashboardAdminIds?: string[]
    adminAccessOverrides?: Record<string, boolean>
    userId?: string
    discordAccess?: {
        hasDashboardAccess?: boolean
        isAdmin?: boolean
    } | null
}) {
    const { user, serverDiscordId, discordAccess } = input

    return (
        user.guildId === serverDiscordId ||
        user.managedGuildIds.includes(serverDiscordId) ||
        user.mercenaryGuildIds.includes(serverDiscordId) ||
        Boolean(input.userId && input.serverAdminIds?.includes(input.userId)) ||
        Boolean(discordAccess?.hasDashboardAccess)
    )
}

export function canAdminServerContext(input: {
    serverAdminIds: string[]
    dashboardAdminIds?: string[]
    adminAccessOverrides?: Record<string, boolean>
    userId: string
    discordAccess?: {
        isAdmin?: boolean
        hasDashboardAccess?: boolean
    } | null
}) {
    // Discord's Administrator permission is the bootstrap path: it must remain
    // effective even if a Logi administrator has explicitly revoked the
    // dashboard role for that account.
    if (input.discordAccess?.isAdmin) {
        return true
    }

    const override = input.adminAccessOverrides?.[input.userId]
    if (override !== undefined) {
        return override
    }

    return (
        input.serverAdminIds.includes(input.userId) ||
        Boolean(input.discordAccess?.hasDashboardAccess)
    )
}
