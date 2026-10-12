import { createHash, randomBytes } from "node:crypto"

import { fetchMutation, fetchQuery } from "convex/nextjs"
import { makeFunctionReference } from "convex/server"

import {
    readClanApiMeta,
    type ClanMetaRead,
    type ClanMetaRefresh,
} from "@/lib/api/clan-meta-read"
import type { DashboardActor } from "../../convex/dashboardActor"
import type { ApiKeyReadAccess } from "@/domain/api/key-access"
import { publicApiMemory } from "@/lib/api/public-api-memory"
import type { GameSelection } from "@/domain/games/game"
import { keyUseDue } from "@/domain/api/key-usage"
import { getInternalAuthSecret } from "@/lib/env"

const createKeyReference = makeFunctionReference<"mutation">(
    "publicApi:createKey"
)
const listKeysReference = makeFunctionReference<"query">(
    "publicApiReads:listKeys"
)
const revokeKeyReference = makeFunctionReference<"mutation">(
    "publicApi:revokeKey"
)
const authenticateKeyReference = makeFunctionReference<"query">(
    "apiKeyAuth:authenticateKey"
)
const recordKeyUseReference = makeFunctionReference<"mutation">(
    "apiKeyAuth:recordKeyUse"
)
const clanResourcePageReference = makeFunctionReference<"query">(
    "publicApiReads:getClanResourcePage"
)
const clanResourceReference = makeFunctionReference<"query">(
    "publicApiReads:getClanResource"
)
const mutateArticleReference = makeFunctionReference<"mutation">(
    "publicApi:mutateClanArticle"
)
const mutateEventSignupReference = makeFunctionReference<"mutation">(
    "publicApi:mutateClanEventSignup"
)
const mutateEventReference = makeFunctionReference<"mutation">(
    "publicApi:mutateClanEvent"
)
const mutateGroupReference = makeFunctionReference<"mutation">(
    "publicApi:mutateClanGroup"
)
const mutateCalendarItemReference = makeFunctionReference<"mutation">(
    "publicApi:mutateClanCalendarItem"
)
const mutatePresetReference = makeFunctionReference<"mutation">(
    "publicApi:mutateClanPreset"
)
const mutateRosterReference = makeFunctionReference<"mutation">(
    "publicApi:mutateClanRoster"
)
const mutateAssignmentReference = makeFunctionReference<"mutation">(
    "publicApi:mutateClanAssignment"
)
const clanMetaReference = makeFunctionReference<"query">(
    "publicApiReads:getClanMeta"
)
const refreshClanMetaReference = makeFunctionReference<"mutation">(
    "clanMeta:refreshClanMeta"
)
const clanSettingsReference = makeFunctionReference<"query">(
    "publicApiReads:getClanSettings"
)
const mutateClanSettingsReference = makeFunctionReference<"mutation">(
    "publicApi:mutateClanSettings"
)
const clanPerformanceHistoryReference = makeFunctionReference<"query">(
    "publicApiReads:getClanPerformanceHistory"
)
const clanMatchByEventReference = makeFunctionReference<"query">(
    "publicApiReads:getClanMatchByEvent"
)
const clanUserReference = makeFunctionReference<"query">(
    "publicApiReads:getClanUser"
)

export const clanApiResources = [
    "server-snapshots",
    "integration-health",
    "event-summaries",
    "match-summaries",
    "result-summaries",
    "events",
    "groups",
    "rosters",
    "assignments",
    "calendar-items",
    "stratmaps",
    "topic-presets",
    "squad-presets",
    "matches",
    "articles",
    "users",
] as const
export type ClanApiResource = (typeof clanApiResources)[number]

export function hashApiKey(value: string) {
    return createHash("sha256").update(value).digest("hex")
}

export async function createClanApiKey(
    guildId: string,
    actor: DashboardActor,
    name: string,
    readAccess?: ApiKeyReadAccess
) {
    const value = `logi_${randomBytes(32).toString("base64url")}`
    await fetchMutation(createKeyReference, {
        secret: getInternalAuthSecret(),
        guildId,
        actor,
        name,
        keyHash: hashApiKey(value),
        keyPrefix: value.slice(0, 13),
        ...(readAccess !== undefined ? { readAccess } : {}),
    })
    return value
}

export async function listClanApiKeys(guildId: string, actor: DashboardActor) {
    return (await fetchQuery(listKeysReference, {
        secret: getInternalAuthSecret(),
        guildId,
        actor,
    })) as Array<{
        id: string
        name: string
        keyPrefix: string
        createdAt: string
        lastUsedAt?: string
        revokedAt?: string
        readAccess?: ApiKeyReadAccess
    }>
}

export async function revokeClanApiKey(
    guildId: string,
    actor: DashboardActor,
    keyId: string
) {
    await fetchMutation(revokeKeyReference, {
        secret: getInternalAuthSecret(),
        guildId,
        actor,
        keyId: keyId as never,
    })
}

/**
 * A fixed one-minute window per bucket, counted in this web process. The
 * request path makes no Convex write: one counter document patched on every
 * request made parallel requests conflict and retry in the backend.
 */
export async function checkPublicApiRateLimit(bucket: string, limit: number) {
    return publicApiMemory.takeToken(bucket, limit, 60_000)
}

/**
 * Authenticates through a read-only query and records the key's last use
 * off the request path, at most once per interval per key and process.
 */
export async function authenticateClanApiKey(key: string) {
    const keyHash = hashApiKey(key)
    const secret = getInternalAuthSecret()
    const authenticated = (await fetchQuery(authenticateKeyReference, {
        secret,
        keyHash,
    })) as {
        guildId: string
        lastUsedAt: string | null
        readAccess?: ApiKeyReadAccess
    } | null
    if (!authenticated) return null
    const now = Date.now()
    if (
        keyUseDue(authenticated.lastUsedAt, now) &&
        publicApiMemory.claimKeyUse(keyHash, now)
    )
        void fetchMutation(recordKeyUseReference, { secret, keyHash }).catch(
            () => undefined
        )
    const { guildId, readAccess } = authenticated
    return { guildId, ...(readAccess !== undefined ? { readAccess } : {}) }
}

export async function getClanApiResourcePage(
    key: string,
    input: {
        resource: ClanApiResource
        game: GameSelection
        cursor: string | null
        limit: number
        updatedSince?: string
    }
) {
    return await fetchQuery(clanResourcePageReference, {
        secret: getInternalAuthSecret(),
        keyHash: hashApiKey(key),
        ...input,
    })
}

export async function getClanApiResource(
    key: string,
    resource: ClanApiResource,
    id: string
) {
    return await fetchQuery(clanResourceReference, {
        secret: getInternalAuthSecret(),
        keyHash: hashApiKey(key),
        resource,
        id,
    })
}

/**
 * The meta's counts come from the clan's stored summary; the request never
 * scans the clan's tables. A missing summary is computed synchronously once,
 * a stale one is refreshed off the request path, at most once per clan and
 * `CLAN_META_INTERVAL_MS` in this process (and once in the backend, which
 * re-checks before it writes).
 */
export async function getClanApiMeta(key: string) {
    const secret = getInternalAuthSecret()
    const keyHash = hashApiKey(key)
    return await readClanApiMeta({
        read: async () =>
            (await fetchQuery(clanMetaReference, {
                secret,
                keyHash,
            })) as ClanMetaRead | null,
        refresh: async () =>
            (await fetchMutation(refreshClanMetaReference, {
                secret,
                keyHash,
            })) as ClanMetaRefresh,
        claimRefresh: (guildId, now) =>
            publicApiMemory.claimClanMetaRefresh(guildId, now),
        now: Date.now,
    })
}

export async function getClanApiSettings(key: string) {
    return await fetchQuery(clanSettingsReference, {
        secret: getInternalAuthSecret(),
        keyHash: hashApiKey(key),
    })
}
export async function mutateClanApiSettings(input: {
    key: string
    idempotencyKey: string
    bodyHash: string
    methodPath: string
    name?: string
    avatar?: string
    description?: string | null
    timezone?: string
    defaultLanguage?: "en" | "cs" | "de"
    announcementsChannelId?: string | null
    eventInfoChannelId?: string | null
    errorsChannelId?: string | null
    calendarChannelId?: string | null
    forumCategoryId?: string | null
    meetingChannelId?: string | null
    clanRoleId?: string | null
    dashboardAdminRoleId?: string | null
    /** Validated feature settings slices by key. */
    slices?: Record<string, unknown>
}) {
    return (await fetchMutation(mutateClanSettingsReference, {
        secret: getInternalAuthSecret(),
        ...input,
        keyHash: hashApiKey(input.key),
    })) as { status: number; body: string } | null
}

export async function getClanApiPerformanceHistory(
    key: string,
    game: GameSelection
) {
    return await fetchQuery(clanPerformanceHistoryReference, {
        secret: getInternalAuthSecret(),
        keyHash: hashApiKey(key),
        game,
    })
}
export async function getClanApiMatchByEvent(key: string, eventId: string) {
    return await fetchQuery(clanMatchByEventReference, {
        secret: getInternalAuthSecret(),
        keyHash: hashApiKey(key),
        eventId: eventId as never,
    })
}
export async function getClanApiUser(key: string, userId: string) {
    return await fetchQuery(clanUserReference, {
        secret: getInternalAuthSecret(),
        keyHash: hashApiKey(key),
        userId,
    })
}

export async function mutateClanApiArticle(input: {
    key: string
    idempotencyKey: string
    bodyHash: string
    methodPath: string
    operation: "create" | "update" | "delete"
    articleId?: string
    title?: string
    description?: string
    tags?: string[]
    body?: string
    attachments?: string[]
}) {
    return (await fetchMutation(mutateArticleReference, {
        secret: getInternalAuthSecret(),
        ...input,
        keyHash: hashApiKey(input.key),
        ...(input.articleId ? { articleId: input.articleId as never } : {}),
    })) as { status: number; body: string } | null
}

export async function mutateClanApiEventSignup(input: {
    key: string
    eventId: string
    idempotencyKey: string
    bodyHash: string
    methodPath: string
    userId: string
    group: string | null
}) {
    return (await fetchMutation(mutateEventSignupReference, {
        secret: getInternalAuthSecret(),
        keyHash: hashApiKey(input.key),
        eventId: input.eventId as never,
        idempotencyKey: input.idempotencyKey,
        bodyHash: input.bodyHash,
        methodPath: input.methodPath,
        userId: input.userId,
        group: input.group,
    })) as { status: number; body: string } | null
}

export async function mutateClanApiEvent(input: {
    key: string
    idempotencyKey: string
    bodyHash: string
    methodPath: string
    operation: "create" | "update" | "conclude"
    eventId?: string
    event?: Record<string, unknown>
}) {
    return (await fetchMutation(mutateEventReference, {
        secret: getInternalAuthSecret(),
        keyHash: hashApiKey(input.key),
        idempotencyKey: input.idempotencyKey,
        bodyHash: input.bodyHash,
        methodPath: input.methodPath,
        operation: input.operation,
        ...(input.eventId ? { eventId: input.eventId as never } : {}),
        ...(input.event ? { event: input.event } : {}),
    })) as { status: number; body: string } | null
}

export async function mutateClanApiGroup(input: {
    key: string
    idempotencyKey: string
    bodyHash: string
    methodPath: string
    operation: "create" | "update" | "delete"
    groupId?: string
    gameId?: string
    name?: string
    color?: string
    order?: number
    parentId?: string
    description?: string
    discordRoleId?: string
    discordEmoji?: string
}) {
    return (await fetchMutation(mutateGroupReference, {
        secret: getInternalAuthSecret(),
        ...input,
        keyHash: hashApiKey(input.key),
        ...(input.groupId ? { groupId: input.groupId as never } : {}),
        ...(input.parentId ? { parentId: input.parentId as never } : {}),
    })) as { status: number; body: string } | null
}

export async function mutateClanApiCalendarItem(
    input: Record<string, unknown> & {
        key: string
        idempotencyKey: string
        bodyHash: string
        methodPath: string
        operation: "create" | "update" | "delete"
        calendarItemId?: string
    }
) {
    return (await fetchMutation(mutateCalendarItemReference, {
        secret: getInternalAuthSecret(),
        ...input,
        keyHash: hashApiKey(input.key),
        ...(input.calendarItemId
            ? { calendarItemId: input.calendarItemId as never }
            : {}),
    })) as { status: number; body: string } | null
}

export async function mutateClanApiPreset(input: {
    key: string
    idempotencyKey: string
    bodyHash: string
    methodPath: string
    resource: "stratmaps" | "topic-presets" | "squad-presets"
    operation: "create" | "update"
    presetId?: string
    payload: Record<string, unknown>
}) {
    return (await fetchMutation(mutatePresetReference, {
        secret: getInternalAuthSecret(),
        ...input,
        keyHash: hashApiKey(input.key),
        ...(input.presetId ? { presetId: input.presetId as never } : {}),
    })) as { status: number; body: string } | null
}

export async function mutateClanApiRoster(input: {
    key: string
    idempotencyKey: string
    bodyHash: string
    methodPath: string
    operation: "update" | "delete"
    rosterId: string
    payload?: Record<string, unknown>
}) {
    return (await fetchMutation(mutateRosterReference, {
        secret: getInternalAuthSecret(),
        ...input,
        keyHash: hashApiKey(input.key),
        rosterId: input.rosterId as never,
    })) as { status: number; body: string } | null
}

export async function mutateClanApiAssignment(input: {
    key: string
    idempotencyKey: string
    bodyHash: string
    methodPath: string
    operation: "create" | "update" | "delete"
    assignmentId?: string
    userId?: string
    gameId?: string
    type?: "member" | "reserve_member" | "mercenary"
    status?: "pending" | "recruit" | "active"
    primaryGroupId?: string
    secondaryGroupIds?: string[]
    paused?: boolean
    pausedNote?: string
}) {
    const { key, ...args } = input
    return (await fetchMutation(mutateAssignmentReference, {
        secret: getInternalAuthSecret(),
        ...args,
        keyHash: hashApiKey(key),
        ...(input.assignmentId
            ? { assignmentId: input.assignmentId as never }
            : {}),
        ...(input.primaryGroupId
            ? { primaryGroupId: input.primaryGroupId as never }
            : {}),
        ...(input.secondaryGroupIds
            ? { secondaryGroupIds: input.secondaryGroupIds as never }
            : {}),
    })) as { status: number; body: string } | null
}

export function readBearerToken(request: Request) {
    const value = request.headers.get("authorization")
    return value?.startsWith("Bearer ") ? value.slice(7).trim() : null
}

export function rateLimitHeaders(result: {
    remaining: number
    resetAt: number
}) {
    return {
        "RateLimit-Limit": "300",
        "RateLimit-Remaining": String(result.remaining),
        "RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
    }
}
