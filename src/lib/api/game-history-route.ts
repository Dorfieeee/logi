import {
    historyFiltersSchema,
    historyPageSchema,
    historyRecordSchema,
    historyGameSchema,
    type HistoryFilters,
} from "@/domain/game-data/history"
import { createHmac, timingSafeEqual } from "node:crypto"
import { z } from "zod"

const positionSchema = z.strictObject({
    position: z.string().min(1).max(4096),
    revision: z.string().regex(/^(0|[1-9][0-9]{0,127})$/),
    issuedAt: z.number().int().safe(),
})
type ReadInput = {
    gameId?: "hell_let_loose"
    filters: HistoryFilters
    id?: string
    cursor: string | null
    revision?: string
}

/** Wardogs predates the optional backend game argument. Preserve its old RPC
 * shape while the web application and Convex deploy independently. HLL must
 * remain explicit and must never fall back to the legacy Wardogs default. */
export function historyBackendGameArgs(gameId: "wardogs" | "hell_let_loose"): {
    gameId?: "hell_let_loose"
} {
    return gameId === "hell_let_loose" ? { gameId } : {}
}

export async function handleGameHistoryRead(
    request: Request,
    dependencies: {
        guildId: string
        binding: string
        secret: string
        headers?: Record<string, string>
        read: (input: ReadInput) => Promise<unknown>
    }
) {
    const headers = { ...dependencies.headers, "Cache-Control": "no-store" }
    const error = (code: string, status: number) =>
        Response.json({ error: { code } }, { status, headers })
    const success = (data: unknown) => {
        const body = JSON.stringify({ data })
        if (Buffer.byteLength(body, "utf8") > 2 * 1024 * 1024)
            throw new Error("History response exceeds budget.")
        return new Response(body, {
            headers: { ...headers, "Content-Type": "application/json" },
        })
    }
    const params = new URL(request.url).searchParams
    const known = ["game", "sourceId", "map", "from", "until", "id", "cursor"]
    if (
        request.method !== "GET" ||
        !historyGameSchema.safeParse(params.get("game")).success ||
        [...params.keys()].some(
            (key) => !known.includes(key) || params.getAll(key).length !== 1
        )
    )
        return error("invalid_query", 400)
    const filtersInput = Object.fromEntries(
        [...params].filter(([key]) =>
            ["sourceId", "map", "from", "until"].includes(key)
        )
    )
    const filters = historyFiltersSchema.safeParse(filtersInput),
        id = params.get("id"),
        cursor = params.get("cursor")
    if (
        !filters.success ||
        (id !== null &&
            (!id ||
                id.length > 200 ||
                Object.keys(filtersInput).length > 0 ||
                cursor !== null)) ||
        (cursor !== null && (!cursor || cursor.length > 8192))
    )
        return error("invalid_query", 400)
    if (!dependencies.secret) return error("unavailable", 503)
    const gameId = historyGameSchema.parse(params.get("game"))
    const binding = JSON.stringify([
        dependencies.guildId,
        dependencies.binding,
        gameId,
        filters.data,
    ])
    const sign = (body: string) =>
        createHmac("sha256", dependencies.secret)
            .update(`logi-history-page-v1:${binding}:${body}`)
            .digest()
    const input: ReadInput = {
        ...historyBackendGameArgs(gameId),
        filters: filters.data,
        cursor: null,
        ...(id !== null ? { id } : {}),
    }
    if (cursor) {
        try {
            const parts = cursor.split(".")
            if (parts.length !== 2) throw new Error()
            const received = Buffer.from(parts[1], "base64url"),
                expected = sign(parts[0])
            if (
                received.length !== expected.length ||
                !timingSafeEqual(received, expected)
            )
                throw new Error()
            const position = positionSchema.parse(
                JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"))
            )
            if (
                position.issuedAt > Date.now() ||
                Date.now() - position.issuedAt >= 86_400_000
            )
                throw new Error()
            input.cursor = position.position
            input.revision = position.revision
        } catch {
            return error("invalid_cursor", 400)
        }
    }
    try {
        const value = await dependencies.read(input)
        if (value === null)
            return error(
                id !== null ? "not_found" : "insufficient_scope",
                id !== null ? 404 : 403
            )
        if (
            typeof value === "object" &&
            value !== null &&
            "resetRequired" in value
        )
            return error("reset_required", 410)
        if (id !== null) {
            const record = historyRecordSchema.parse(value)
            if (
                record.id !== id ||
                record.guildId !== dependencies.guildId ||
                record.gameId !== gameId
            )
                throw new Error()
            return success(record)
        }
        const page = historyPageSchema.parse(value)
        if (
            page.items.some(
                (record) =>
                    record.guildId !== dependencies.guildId ||
                    record.gameId !== gameId ||
                    BigInt(record.revision) > BigInt(page.revision)
            ) ||
            (input.revision && page.revision !== input.revision)
        )
            throw new Error()
        if (page.nextCursor !== null) {
            const body = Buffer.from(
                JSON.stringify({
                    position: page.nextCursor,
                    revision: page.revision,
                    issuedAt: Date.now(),
                })
            ).toString("base64url")
            page.nextCursor = `${body}.${sign(body).toString("base64url")}`
        }
        // Never truncate a page after advancing its native cursor.
        return success(page)
    } catch {
        return error("unavailable", 503)
    }
}
