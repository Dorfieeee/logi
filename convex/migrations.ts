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
import { mutation } from "./integrationMutation"
import { v } from "convex/values"

/** The Wardogs Discord clan whose stale assignments this one-off removes. */
export const WARDOGS_CLAN_DISCORD_ID = "963323629242826762"

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
 * Removes every Wardogs-clan assignment for people who do not also have a
 * Hell Let Loose assignment in the supplied HLL clan. This is deliberately a
 * one-off internal migration: callers must explicitly supply the HLL clan ID
 * and opt in to writes with `apply: true`.
 */
export const removeWardogsAssignmentsWithoutHllMembership = mutation({
    args: {
        secret: v.string(),
        hllClanDiscordId: v.string(),
        apply: v.boolean(),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)

        if (!(await getGuildByDiscordId(ctx, args.hllClanDiscordId))) {
            throw new Error("The HLL clan was not found.")
        }

        const wardogsAssignments = await ctx.db
            .query("userAssignments")
            .withIndex("serverId", (q) =>
                q.eq("serverId", WARDOGS_CLAN_DISCORD_ID)
            )
            .collect()
        const wardogsGameAssignments = wardogsAssignments.filter(
            (assignment) => resolveGameScope(assignment.gameId) === "wardogs"
        )
        const assignmentsToRemove = []

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

            // Only a member/reserve-member HLL assignment in the selected clan
            // preserves the Wardogs assignment. Missing, mercenary, or other
            // non-member HLL records leave it eligible for deletion.
            if (!isHllClanMember) assignmentsToRemove.push(assignment)
        }

        const affectedUserIds = [
            ...new Set(
                assignmentsToRemove.map((assignment) => assignment.userId)
            ),
        ]
        if (!args.apply) {
            return {
                apply: false,
                wardogsAssignmentsScanned: wardogsGameAssignments.length,
                assignmentsToRemove: assignmentsToRemove.length,
                affectedUserIds,
            }
        }

        const repository = new ConvexAssignmentCommandRepository(ctx)
        for (const assignment of assignmentsToRemove) {
            await repository.remove(String(assignment._id))
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
            affectedUserIds,
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
