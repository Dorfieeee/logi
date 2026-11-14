import type { AuthenticatedClanRequest } from "./authenticated-clan-route"
import { getInternalAuthSecret } from "@/lib/env"
import { NextResponse } from "next/server"
import { createHash } from "node:crypto"

export const PROJECTION_CACHE_TTL_MS = 5 * 60_000
const CACHEABLE_RESOURCES = new Set([
    "member-summaries",
    "roster-summaries",
    "player-stat-summaries",
    "event-summaries",
    "match-summaries",
    "result-summaries",
    "teams",
    "server-game-history",
])
type Snapshot = { body: string; status: number; contentType: string }
type Entry = { snapshot: Snapshot; expiresAt: number; bytes: number }

/** Cache only validated response bodies. Authentication/rate-limit headers are always fresh. */
export function createProjectionReadCache(
    options: {
        now?: () => number
        maxEntries?: number
        maxBytes?: number
        maxEntryBytes?: number
        maxPending?: number
    } = {}
) {
    const now = options.now ?? Date.now
    const maxEntries = options.maxEntries ?? 1024
    const maxBytes = options.maxBytes ?? 32 * 1024 * 1024
    const maxEntryBytes = options.maxEntryBytes ?? 2 * 1024 * 1024
    const maxPending = options.maxPending ?? 64
    const entries = new Map<string, Entry>()
    const pending = new Map<string, Promise<Snapshot>>()
    let bytes = 0
    const remove = (key: string) => {
        const entry = entries.get(key)
        if (entry) bytes -= entry.bytes
        entries.delete(key)
    }
    const response = (
        snapshot: Snapshot,
        headers: Record<string, string>,
        state: string
    ) =>
        new NextResponse(snapshot.body, {
            status: snapshot.status,
            headers: {
                ...headers,
                "Content-Type": snapshot.contentType,
                "Cache-Control": "no-store",
                "X-Logi-Cache": state,
            },
        })
    return async (
        key: string,
        headers: Record<string, string>,
        read: () => Promise<Response>
    ) => {
        const startedAt = now()
        for (const [id, entry] of entries)
            if (entry.expiresAt <= startedAt) remove(id)
        const cached = entries.get(key)
        if (cached) {
            entries.delete(key)
            entries.set(key, cached)
            return response(cached.snapshot, headers, "hit")
        }
        const active = pending.get(key)
        if (active) return response(await active, headers, "coalesced")
        if (pending.size >= maxPending) {
            const result = await read()
            result.headers.set("X-Logi-Cache", "bypass")
            return result
        }
        const load = async () => {
            const result = await read()
            const snapshot = {
                body: await result.text(),
                status: result.status,
                contentType:
                    result.headers.get("Content-Type") ?? "application/json",
            }
            const size = Buffer.byteLength(snapshot.body)
            if (
                snapshot.status === 200 &&
                size <= maxEntryBytes &&
                size <= maxBytes &&
                maxEntries > 0 &&
                now() < startedAt + PROJECTION_CACHE_TTL_MS
            ) {
                while (entries.size >= maxEntries || bytes + size > maxBytes) {
                    const oldest = entries.keys().next().value
                    if (oldest === undefined) break
                    remove(oldest)
                }
                entries.set(key, {
                    snapshot,
                    expiresAt: startedAt + PROJECTION_CACHE_TTL_MS,
                    bytes: size,
                })
                bytes += size
            }
            return snapshot
        }
        const work = load().finally(() => pending.delete(key))
        pending.set(key, work)
        return response(await work, headers, "miss")
    }
}

const readCached = createProjectionReadCache()

/** Call only after the HTTP adapter has authenticated and checked the requested grants. */
export async function readCachedProjection(
    request: Request,
    auth: AuthenticatedClanRequest,
    resource: string,
    read: () => Promise<Response>
) {
    if (!auth.projectionVersion || !CACHEABLE_RESOURCES.has(resource)) {
        const result = await read()
        result.headers.set("X-Logi-Cache", "bypass")
        return result
    }
    const url = new URL(request.url)
    url.searchParams.sort()
    // Hash the entire scope: no bearer token, secret, subject or cursor is retained as a cache key.
    const key = createHash("sha256")
        .update(
            JSON.stringify([
                getInternalAuthSecret(),
                auth.key,
                auth.guildId,
                auth.projectionVersion,
                request.method,
                url.toString(),
            ])
        )
        .digest("hex")
    return readCached(key, auth.headers, read)
}
