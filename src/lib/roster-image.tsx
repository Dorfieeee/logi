import { makeFunctionReference } from "convex/server"
import { fetchQuery } from "convex/nextjs"

import { getInternalAuthSecret, getSiteUrl } from "@/lib/env"
import { appCacheTags, cachedRead } from "@/lib/cache-tags"

type RosterImageContext = {
    event: {
        id: string
        name: string
        map?: string
        side?: string
        meetingStart: string
        gameStart: string
        cap?: string
        notes?: string
        registrationEnd: string
        gameEnd: string
        topicPresetId?: string
        server?: string
        serverPassword?: string
        description?: string
        absenceNotices?: Array<{
            userId: string
            reason: string
            /** Older notices without a kind are late notices. */
            kind?: "late" | "cannot_come"
        }>
    }
    roster: {
        updatedAt: string
        reservePlayerIds: string[]
        notAttendingPlayerIds: string[]
        squads: Array<{
            name: string
            group: string
            color: string
            order: number
            icon?: string
            players: Array<{
                id?: string
                customName?: string
                ack: boolean
                confirmed?: boolean
                roleName?: string
                roleIcon?: string
                note?: string
            }>
        }>
    }
    config?: {
        guildId: string
        timezone: string
        defaultLanguage: "en" | "cs" | "de"
    }
    groups: Array<{
        id: string
        name: string
        color: string
        order: number
        parentId?: string
    }>
    assignments: Array<{
        userId: string
        primaryGroupId?: string
        secondaryGroupIds?: string[]
    }>
    users: Array<{
        id: string
        discordId: string
        name: string
        avatar: string
        score: number
    }>
}

const getRosterImageContextReference = makeFunctionReference<"query">(
    "discordRosters:getRosterImageContext"
)

export async function getRosterImageContext(eventId: string) {
    return (await fetchQuery(getRosterImageContextReference, {
        secret: getInternalAuthSecret(),
        eventId: eventId as never,
    })) as RosterImageContext | null
}

export async function getRosterImageContextCached(eventId: string) {
    return await cachedRead(
        ["roster-image", eventId],
        [appCacheTags.rosterImage(), appCacheTags.rosterImageEvent(eventId)],
        () => getRosterImageContext(eventId),
        3600
    )
}

function buildRosterImageCacheKey(eventId: string, rosterUpdatedAt?: string) {
    const versionSource = rosterUpdatedAt
        ? `${eventId}:${rosterUpdatedAt}`
        : `${eventId}:${Date.now()}`
    return Buffer.from(versionSource).toString("base64url")
}

export function resolveSiteAssetUrl(path?: string) {
    if (!path) return undefined

    try {
        return new URL(path, getSiteUrl()).toString()
    } catch {
        return undefined
    }
}

function isAnimatedDiscordAvatar(url: URL) {
    return (
        (url.hostname === "cdn.discordapp.com" ||
            url.hostname === "media.discordapp.net") &&
        /^\/avatars\/[^/]+\/a_[^/]+\.(png|jpe?g|webp|gif)$/i.test(url.pathname)
    )
}

// ImageResponse cannot reliably decode Discord's animated avatar assets, even
// when their URL requests a PNG representation. Use a local, static fallback
// so one avatar never prevents the entire roster image from rendering.
export function resolveRosterAvatarUrl(
    avatar?: string,
    resolveAssetUrl: (path?: string) => string | undefined = resolveSiteAssetUrl
) {
    const resolved = resolveAssetUrl(avatar)
    if (!resolved) return undefined

    try {
        return isAnimatedDiscordAvatar(new URL(resolved))
            ? resolveAssetUrl("/favicon.png")
            : resolved
    } catch {
        return undefined
    }
}

export function buildRosterImageUrl(eventId: string, rosterUpdatedAt?: string) {
    const url = new URL(`/api/discord/roster-image/${eventId}`, getSiteUrl())
    url.searchParams.set(
        "cb",
        buildRosterImageCacheKey(eventId, rosterUpdatedAt)
    )
    return url.toString()
}
