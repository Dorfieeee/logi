import { makeFunctionReference } from "convex/server"
import { fetchQuery } from "convex/nextjs"
import { after } from "next/server"

import type {
    AppUser,
    DiscordConfig,
    EventRecord,
    GameScope,
    Group,
    Guild,
    Roster,
    SquadPreset,
    StratmapRecord,
    TopicPreset,
} from "@/types/domain"
import type { ServerUserAssignment } from "@/lib/server-user-management"
import { appCacheTags, cachedRead } from "@/lib/cache-tags"
import { isSuperadminDiscordId } from "@/lib/superadmin"
import { getInternalAuthSecret } from "@/lib/env"
import { getLoggedInUser } from "@/lib/auth"

const CLAN_DASHBOARD_REVALIDATE_SECONDS = 60 * 60 * 24
const STALE_CONTEXT_REFRESH_INTERVAL_MS = 30 * 1000
const MAX_STALE_CONTEXTS = 100

const getServerContextReference = makeFunctionReference<"query">(
    "serverContext:getServerContext"
)
const getServerContextInternalReference = makeFunctionReference<"query">(
    "serverContext:getServerContextInternal"
)

export type ServerContextReadModel = {
    user: AppUser
    server: Guild
    canAdmin: boolean
    hasDashboardAccess: boolean
    memberRoleIds: string[]
    events: EventRecord[]
    topicPresets: TopicPreset[]
    squadPresets: SquadPreset[]
    rosters: Roster[]
    stratmaps: StratmapRecord[]
    groups: Group[]
    assignments: ServerUserAssignment[]
    discordConfig: DiscordConfig | null
}

type StaleContextEntry = {
    value: ServerContextReadModel | null
    refreshedAt: number
    refresh?: Promise<void>
}

// This small per-process cache sits in front of Next's tag-aware cache. When
// a tag is invalidated, the request can render the last complete overview
// while Next refreshes the authoritative value after the response.
const staleContexts = new Map<string, StaleContextEntry>()

async function getServerContextSnapshot(
    serverId: string,
    userId: string,
    gameScope?: GameScope
): Promise<ServerContextReadModel | null> {
    return (await fetchQuery(getServerContextReference, {
        secret: getInternalAuthSecret(),
        userId,
        serverId: serverId as never,
        gameScope,
    })) as ServerContextReadModel | null
}

async function getServerContextSnapshotInternal(
    serverId: string,
    userId: string,
    gameScope?: GameScope
): Promise<ServerContextReadModel | null> {
    return (await fetchQuery(getServerContextInternalReference, {
        secret: getInternalAuthSecret(),
        userId,
        serverId: serverId as never,
        gameScope,
    })) as ServerContextReadModel | null
}

export async function getServerContextReadModel(
    serverId: string,
    gameScope?: GameScope,
    options?: { staleWhileRevalidate?: boolean }
): Promise<ServerContextReadModel | null> {
    const user = await getLoggedInUser()
    if (!user) {
        return null
    }

    try {
        const isSuperadmin = await isSuperadminDiscordId(user.discordId)

        const cacheKey = [
            // v2: member entries no longer carry drafts or manager secrets.
            "server-context:v2",
            serverId,
            user.discordId,
            gameScope ?? "all",
            isSuperadmin ? "internal" : "standard",
        ]
        const load = () =>
            cachedRead(
                cacheKey,
                [
                    appCacheTags.serverContext(serverId),
                    appCacheTags.player(user.id),
                ],
                () =>
                    isSuperadmin
                        ? getServerContextSnapshotInternal(
                              serverId,
                              user.discordId,
                              gameScope
                          )
                        : getServerContextSnapshot(
                              serverId,
                              user.discordId,
                              gameScope
                          ),
                CLAN_DASHBOARD_REVALIDATE_SECONDS
            )
        if (!options?.staleWhileRevalidate) return await load()

        const staleKey = cacheKey.join(":")
        const entry = staleContexts.get(staleKey)
        if (!entry) {
            const value = await load()
            storeStaleContext(staleKey, { value, refreshedAt: Date.now() })
            return value
        }
        if (
            !entry.refresh &&
            Date.now() - entry.refreshedAt >= STALE_CONTEXT_REFRESH_INTERVAL_MS
        ) {
            entry.refresh = refreshStaleContext(staleKey, load)
            after(() => entry.refresh!.catch(() => undefined))
        }
        return entry.value
    } catch {
        return null
    }
}

async function refreshStaleContext(
    key: string,
    load: () => Promise<ServerContextReadModel | null>
) {
    try {
        const value = await load()
        storeStaleContext(key, { value, refreshedAt: Date.now() })
    } finally {
        const entry = staleContexts.get(key)
        if (entry) delete entry.refresh
    }
}

function storeStaleContext(key: string, entry: StaleContextEntry) {
    if (!staleContexts.has(key) && staleContexts.size >= MAX_STALE_CONTEXTS)
        staleContexts.delete(staleContexts.keys().next().value!)
    staleContexts.set(key, entry)
}

// Management writes must not rely on the dashboard's 24-hour read cache.
export async function getServerContextUncached(
    serverId: string
): Promise<ServerContextReadModel | null> {
    const user = await getLoggedInUser()
    if (!user) return null
    try {
        return await ((await isSuperadminDiscordId(user.discordId))
            ? getServerContextSnapshotInternal(serverId, user.discordId)
            : getServerContextSnapshot(serverId, user.discordId))
    } catch {
        return null
    }
}
