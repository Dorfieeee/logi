import {
    ConvexAssignmentCommandRepository,
    ConvexAssignmentRosterSyncPort,
} from "../src/infrastructure/convex/assignment-command-repositories"
import {
    getGuildByDiscordId,
    getUserByIdentifier,
    getUserDiscordId,
} from "./identity"
import { rebuildMembershipState } from "../src/application/assignments/rebuild-membership"
import { readMembershipAssignment } from "./membershipSubject"
import { resolveGameScope } from "../src/domain/games/game"
import { systemClock } from "../src/domain/shared/clock"
import { internalAuthSecret } from "./discord_shared"
import { makeFunctionReference } from "convex/server"
import { action, query } from "./_generated/server"
import { mutation } from "./integrationMutation"
import { v } from "convex/values"

/** The Wardogs Discord clan whose stale assignments this one-off removes. */
export const WARDOGS_CLAN_DISCORD_ID = "963323629242826762"
const HLL_MEMBERSHIP_GRACE_PERIOD_MS = 14 * 24 * 60 * 60 * 1000
const CLEANUP_BATCH_SIZE = 20
const listWardogsAssignmentIdsReference = makeFunctionReference<"query">(
    "migrations:listWardogsAssignmentIds"
)
const removeWardogsAssignmentsBatchReference =
    makeFunctionReference<"mutation">(
        "migrations:removeWardogsAssignmentsWithoutHllMembershipBatch"
    )

function assertInternalSecret(secret: string) {
    if (secret !== internalAuthSecret()) {
        throw new Error("Unauthorized.")
    }
}

function normalizePlatformIds(...values: Array<string | string[] | undefined>) {
    return [
        ...new Set(
            values
                .flatMap((value) =>
                    Array.isArray(value) ? value : value ? [value] : []
                )
                .flatMap((entry) => entry.split(","))
                .map((entry) => entry.replace(/\s+/g, "").trim())
                .filter(Boolean)
        ),
    ]
}

export const migratePlatformIds = mutation({
    args: {
        secret: v.string(),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)

        const users = await ctx.db.query("users").collect()
        let updated = 0

        for (const user of users) {
            const legacyUser = user as typeof user & {
                platformId?: string
                steamId?: string
            }
            const platformIds = normalizePlatformIds(
                user.platformIds,
                legacyUser.platformId,
                legacyUser.steamId
            )

            const currentPlatformIds = normalizePlatformIds(user.platformIds)
            const needsUpdate =
                currentPlatformIds.length !== platformIds.length ||
                currentPlatformIds.some(
                    (value, index) => value !== platformIds[index]
                )

            if (!needsUpdate) {
                continue
            }

            await ctx.db.patch(user._id, {
                platformIds,
                updatedAt: new Date().toISOString(),
            })
            updated += 1
        }

        return {
            scanned: users.length,
            updated,
        }
    },
})

/**
 * Removes every Wardogs-clan assignment for people who do not have an
 * established Hell Let Loose membership in the supplied HLL clan. HLL members
 * added within the last 14 days lose both game-scoped assignments. This is
 * deliberately a one-off internal migration: callers must explicitly supply
 * the HLL clan ID and opt in to writes with `apply: true`.
 */
/** Lists only Wardogs-scoped assignments, so the action can process them in bounded writes. */
export const listWardogsAssignmentIds = query({
    args: { secret: v.string() },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        return (
            await ctx.db
                .query("userAssignments")
                .withIndex("serverId", (q) =>
                    q.eq("serverId", WARDOGS_CLAN_DISCORD_ID)
                )
                .collect()
        )
            .filter(
                (assignment) =>
                    resolveGameScope(assignment.gameId) === "wardogs"
            )
            .map((assignment) => assignment._id)
    },
})

/** One bounded database batch invoked only by the public cleanup action. */
export const removeWardogsAssignmentsWithoutHllMembershipBatch = mutation({
    args: {
        secret: v.string(),
        hllClanDiscordId: v.string(),
        apply: v.boolean(),
        assignmentIds: v.array(v.id("userAssignments")),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)

        if (!(await getGuildByDiscordId(ctx, args.hllClanDiscordId))) {
            throw new Error("The HLL clan was not found.")
        }

        const wardogsGameAssignments = (
            await Promise.all(args.assignmentIds.map((id) => ctx.db.get(id)))
        ).filter(
            (assignment): assignment is NonNullable<typeof assignment> =>
                Boolean(assignment) &&
                assignment.serverId === WARDOGS_CLAN_DISCORD_ID &&
                resolveGameScope(assignment.gameId) === "wardogs"
        )
        const assignmentsToRemove = []
        const hllAssignmentsToRemove = []
        const cutoff =
            systemClock.now().getTime() - HLL_MEMBERSHIP_GRACE_PERIOD_MS

        for (const assignment of wardogsGameAssignments) {
            const user = await getUserByIdentifier(ctx, assignment.userId)
            const discordUserId = user ? getUserDiscordId(user) : ""
            const hllAssignment = discordUserId
                ? await readMembershipAssignment(ctx, {
                      guildId: args.hllClanDiscordId,
                      gameId: "hell_let_loose",
                      discordUserId,
                  })
                : null
            const isHllClanMember =
                hllAssignment?.type === "member" ||
                hllAssignment?.type === "reserve_member"
            const hllMembershipStartedAt = hllAssignment
                ? new Date(hllAssignment.createdAt).getTime()
                : Number.NaN
            const isRecentHllClanMember =
                isHllClanMember && hllMembershipStartedAt > cutoff

            // Only a member/reserve-member HLL assignment older than two weeks
            // preserves the Wardogs assignment. A recent HLL member loses both
            // game-scoped assignments; missing/non-member HLL records lose the
            // Wardogs assignment only.
            if (isRecentHllClanMember) {
                assignmentsToRemove.push(assignment)
                hllAssignmentsToRemove.push(hllAssignment)
            } else if (!isHllClanMember) {
                assignmentsToRemove.push(assignment)
            }
        }

        const hllAssignmentIdsToRemove = [
            ...new Set(
                hllAssignmentsToRemove.map((assignment) =>
                    String(assignment._id)
                )
            ),
        ]
        const affectedUserIds = [
            ...new Set(
                [...assignmentsToRemove, ...hllAssignmentsToRemove].map(
                    (assignment) => assignment.userId
                )
            ),
        ]
        const affectedUsers = await Promise.all(
            affectedUserIds.map(async (userId) => {
                const user = await getUserByIdentifier(ctx, userId)
                return {
                    discordId: user ? getUserDiscordId(user) : userId,
                    name: user?.name ?? "Unknown user",
                }
            })
        )
        if (!args.apply) {
            return {
                apply: false,
                wardogsAssignmentsScanned: wardogsGameAssignments.length,
                assignmentsToRemove: assignmentsToRemove.length,
                hllAssignmentsToRemove: hllAssignmentIdsToRemove.length,
                affectedUserIds,
                affectedUsers,
            }
        }

        const repository = new ConvexAssignmentCommandRepository(ctx)
        for (const assignment of assignmentsToRemove) {
            await repository.remove(String(assignment._id))
        }
        for (const assignmentId of hllAssignmentIdsToRemove) {
            await repository.remove(assignmentId)
        }

        if (affectedUserIds.length > 0) {
            const now = systemClock.now()
            await rebuildMembershipState(
                repository,
                WARDOGS_CLAN_DISCORD_ID,
                affectedUserIds,
                now
            )
            const rosterSync = new ConvexAssignmentRosterSyncPort(ctx)
            const eventIds = await repository.listOpenMatchEventIds(
                WARDOGS_CLAN_DISCORD_ID,
                now
            )
            for (const eventId of eventIds) {
                await rosterSync.syncEvent(eventId)
            }
        }

        return {
            apply: true,
            wardogsAssignmentsScanned: wardogsGameAssignments.length,
            assignmentsRemoved: assignmentsToRemove.length,
            hllAssignmentsRemoved: hllAssignmentIdsToRemove.length,
            affectedUserIds,
            affectedUsers,
        }
    },
})

/**
 * Runs the cleanup through bounded mutations. Actions have a longer execution
 * budget than a Convex mutation while each database write remains atomic.
 */
export const removeWardogsAssignmentsWithoutHllMembership = action({
    args: {
        secret: v.string(),
        hllClanDiscordId: v.string(),
        apply: v.boolean(),
    },
    handler: async (ctx, args) => {
        const assignmentIds = (await ctx.runQuery(
            listWardogsAssignmentIdsReference,
            { secret: args.secret }
        )) as string[]
        let assignmentsToRemove = 0
        let hllAssignmentsToRemove = 0
        const affectedUsers = new Map<string, string>()

        for (
            let start = 0;
            start < assignmentIds.length;
            start += CLEANUP_BATCH_SIZE
        ) {
            const result = (await ctx.runMutation(
                removeWardogsAssignmentsBatchReference,
                {
                    ...args,
                    assignmentIds: assignmentIds.slice(
                        start,
                        start + CLEANUP_BATCH_SIZE
                    ) as never,
                }
            )) as {
                assignmentsToRemove?: number
                hllAssignmentsToRemove?: number
                assignmentsRemoved?: number
                hllAssignmentsRemoved?: number
                affectedUsers: Array<{ discordId: string; name: string }>
            }
            assignmentsToRemove +=
                result.assignmentsToRemove ?? result.assignmentsRemoved ?? 0
            hllAssignmentsToRemove +=
                result.hllAssignmentsToRemove ??
                result.hllAssignmentsRemoved ??
                0
            for (const user of result.affectedUsers) {
                affectedUsers.set(user.discordId, user.name)
            }
        }

        return {
            apply: args.apply,
            wardogsAssignmentsScanned: assignmentIds.length,
            ...(args.apply
                ? {
                      assignmentsRemoved: assignmentsToRemove,
                      hllAssignmentsRemoved: hllAssignmentsToRemove,
                  }
                : {
                      assignmentsToRemove,
                      hllAssignmentsToRemove,
                  }),
            affectedUserIds: [...affectedUsers.keys()],
            affectedUsers: [...affectedUsers].map(([discordId, name]) => ({
                discordId,
                name,
            })),
        }
    },
})

export const migrateEventResults = mutation({
    args: {
        secret: v.string(),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)

        const events = await ctx.db.query("events").collect()
        let updated = 0

        for (const event of events) {
            const currentResult = event.eventResult as
                | {
                      sourceUrl: string
                      mapId: string
                      mapName?: string
                      endedAt?: string
                      importedAt: string
                      sideA?: string
                      sideB?: string
                      outcome: "victory" | "defeat" | "draw"
                      score?: {
                          sideA?: number
                          sideB?: number
                          axis?: number
                          allied?: number
                          local?: number
                          enemy?: number
                      }
                      localTeam?: string
                      enemyTeam?: string
                  }
                | undefined

            if (!currentResult) {
                continue
            }

            if (
                currentResult.sideA &&
                currentResult.sideB &&
                currentResult.score?.sideA !== undefined &&
                currentResult.score?.sideB !== undefined
            ) {
                continue
            }

            await ctx.db.patch(event._id, {
                eventResult: {
                    sourceUrl: currentResult.sourceUrl,
                    mapId: currentResult.mapId,
                    mapName: currentResult.mapName,
                    endedAt: currentResult.endedAt,
                    importedAt: currentResult.importedAt,
                    sideA: currentResult.sideA ?? "axis",
                    sideB: currentResult.sideB ?? "allies",
                    outcome: currentResult.outcome,
                    score: {
                        sideA:
                            currentResult.score?.sideA ??
                            currentResult.score?.axis ??
                            0,
                        sideB:
                            currentResult.score?.sideB ??
                            currentResult.score?.allied ??
                            0,
                    },
                },
                updatedAt: new Date().toISOString(),
            })
            updated += 1
        }

        return {
            scanned: events.length,
            updated,
        }
    },
})

export const migrateMembershipCategoryRoleArrays = mutation({
    args: {
        secret: v.string(),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)

        const configs = await ctx.db.query("discordConfigs").collect()
        let updated = 0

        for (const config of configs) {
            if (!config.membershipSettings) {
                continue
            }

            let changed = false
            const categories = config.membershipSettings.categories.map(
                (category) => {
                    const legacyCategory = category as typeof category & {
                        recruitRoleId?: string
                        finalRoleId?: string
                    }

                    const recruitRoleIds = Array.isArray(
                        category.recruitRoleIds
                    )
                        ? category.recruitRoleIds
                        : legacyCategory.recruitRoleId
                          ? [legacyCategory.recruitRoleId]
                          : []
                    const finalRoleIds = Array.isArray(category.finalRoleIds)
                        ? category.finalRoleIds
                        : legacyCategory.finalRoleId
                          ? [legacyCategory.finalRoleId]
                          : []

                    if (
                        !Array.isArray(category.recruitRoleIds) ||
                        !Array.isArray(category.finalRoleIds) ||
                        legacyCategory.recruitRoleId ||
                        legacyCategory.finalRoleId
                    ) {
                        changed = true
                    }

                    const {
                        recruitRoleId: _legacyRecruitRoleId,
                        finalRoleId: _legacyFinalRoleId,
                        ...rest
                    } = legacyCategory

                    return {
                        ...rest,
                        recruitRoleIds,
                        finalRoleIds,
                    }
                }
            )

            if (!changed) {
                continue
            }

            await ctx.db.patch(config._id, {
                membershipSettings: {
                    ...config.membershipSettings,
                    categories,
                },
                updatedAt: new Date().toISOString(),
            })
            updated += 1
        }

        return {
            scanned: configs.length,
            updated,
        }
    },
})

/**
 * Backfills API read projections in bounded pages. Run explicitly after the
 * schema is deployed; it never changes roster contents or membership records.
 */
export const backfillClanApiReadProjections = mutation({
    args: {
        secret: v.string(),
        kind: v.union(v.literal("rosters"), v.literal("users")),
        cursor: v.union(v.string(), v.null()),
        limit: v.number(),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const options = {
            cursor: args.cursor,
            numItems: Math.min(Math.max(Math.trunc(args.limit), 1), 100),
        }
        if (args.kind === "rosters") {
            const page = await ctx.db.query("rosters").paginate(options)
            let updated = 0
            for (const roster of page.page) {
                if (roster.guildId) continue
                const event = await ctx.db.get(roster.eventId)
                if (!event) continue
                await ctx.db.patch(roster._id, { guildId: event.guildId })
                updated += 1
            }
            return {
                scanned: page.page.length,
                updated,
                nextCursor: page.isDone ? null : page.continueCursor,
            }
        }
        const page = await ctx.db.query("userAssignments").paginate(options)
        let updated = 0
        for (const assignment of page.page) {
            const existing = await ctx.db
                .query("clanApiUserProjections")
                .withIndex("guildId_userId", (q) =>
                    q
                        .eq("guildId", assignment.serverId)
                        .eq("userId", assignment.userId)
                )
                .unique()
            if (!existing) {
                await ctx.db.insert("clanApiUserProjections", {
                    guildId: assignment.serverId,
                    userId: assignment.userId,
                    updatedAt: assignment.updatedAt,
                })
                updated += 1
            } else if (existing.updatedAt < assignment.updatedAt) {
                await ctx.db.patch(existing._id, {
                    updatedAt: assignment.updatedAt,
                })
                updated += 1
            }
        }
        return {
            scanned: page.page.length,
            updated,
            nextCursor: page.isDone ? null : page.continueCursor,
        }
    },
})
