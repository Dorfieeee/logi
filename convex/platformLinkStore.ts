import { parseSteamId } from "../src/domain/player-stats/player-stats"
import type { MutationCtx } from "./_generated/server"

function normalizePlatformIds(value: string | string[] | undefined) {
    const values = Array.isArray(value) ? value : value ? [value] : []
    return [
        ...new Set(
            values
                .flatMap((entry) => entry.split(","))
                .map((entry) => entry.replace(/\s+/g, "").trim())
                .filter(Boolean)
        ),
    ]
}
function platformComparisonKey(value: string) {
    return parseSteamId(value) ?? value
}

export async function linkDiscordPlatformInTransaction(
    ctx: MutationCtx,
    args: {
        userId: string
        userName: string
        userAvatar: string
        platformId: string
    }
) {
    if (!/^\d{17,20}$/.test(args.userId))
        throw new Error("Invalid Discord account.")
    const now = new Date().toISOString()
    const normalizedPlatformIds = normalizePlatformIds([args.platformId])
    if (!normalizedPlatformIds.length) {
        throw new Error("Platform ID is required.")
    }

    const existing = await ctx.db
        .query("users")
        .withIndex("discordId", (q) => q.eq("discordId", args.userId))
        .unique()
    if (
        !existing &&
        (await ctx.db
            .query("users")
            .withIndex("id", (q) => q.eq("id", args.userId))
            .unique())
    ) {
        throw new Error("Identity conflict. Contact an administrator.")
    }
    for (const value of normalizedPlatformIds) {
        const steamId = parseSteamId(value)
        if (!steamId) continue
        const verified = await ctx.db
            .query("platformIdentityLinks")
            .withIndex("platform_platformId_active", (q) =>
                q
                    .eq("platform", "steam")
                    .eq("platformId", steamId)
                    .eq("active", true)
            )
            .unique()
        if (verified && verified.discordUserId !== args.userId)
            throw new Error(
                "This platform ID is already linked to another player."
            )
    }
    const allUsers = await ctx.db.query("users").take(5001)
    if (allUsers.length > 5000)
        throw new Error("Platform link requires administrator review.")
    for (const candidate of allUsers) {
        if (candidate._id === existing?._id) {
            continue
        }

        const legacyCandidate = candidate as typeof candidate & {
            steamId?: string
            platformId?: string
        }
        const candidatePlatformIds = normalizePlatformIds([
            ...(candidate.platformIds ?? []),
            legacyCandidate.platformId ?? "",
            legacyCandidate.steamId ?? "",
        ])

        if (
            normalizedPlatformIds.some((platformId) =>
                candidatePlatformIds.some(
                    (candidateId) =>
                        platformComparisonKey(candidateId) ===
                        platformComparisonKey(platformId)
                )
            )
        ) {
            throw new Error(
                "This platform ID is already linked to another player."
            )
        }
    }

    if (existing) {
        const currentIds = normalizePlatformIds([
            ...(existing.platformIds ?? []),
            (existing as typeof existing & { platformId?: string })
                .platformId ?? "",
            (existing as typeof existing & { steamId?: string }).steamId ?? "",
        ])
        const ids = [...currentIds]
        for (const value of normalizedPlatformIds)
            if (
                !ids.some(
                    (current) =>
                        platformComparisonKey(current) ===
                        platformComparisonKey(value)
                )
            )
                ids.push(value)
        if (
            JSON.stringify(ids) === JSON.stringify(existing.platformIds) &&
            (args.userName.trim() || existing.name) === existing.name &&
            (args.userAvatar || existing.avatar) === existing.avatar
        )
            return {
                action: "updated" as const,
                platformId: normalizedPlatformIds[0],
            }
        await ctx.db.patch(existing._id, {
            name: args.userName.trim() || existing.name,
            avatar: args.userAvatar || existing.avatar,
            platformIds: ids,
            updatedAt: now,
        })
        return {
            action: "updated" as const,
            platformId: normalizedPlatformIds[0],
        }
    }

    await ctx.db.insert("users", {
        id: args.userId,
        discordId: args.userId,
        name: args.userName.trim(),
        nicknames: {},
        avatar: args.userAvatar,
        platformIds: normalizedPlatformIds,
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

    return {
        action: "created" as const,
        platformId: normalizedPlatformIds[0],
    }
}
