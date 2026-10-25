import { panelImageRequestHash } from "@/domain/discord-publications/panel-image-model"
import { matchImageSchema } from "@/domain/events/match-image.schema"
import { createRosterImageCache } from "@/lib/roster-image-cache"
import type { MatchImage } from "@/domain/events/match-image"

const cache = createRosterImageCache(32)
const pending = new Map<string, Promise<Uint8Array>>()

/** Authorization and tenant scoping must finish before calling this handler. */
export function matchImageReadHandler(ports: {
    context(): Promise<unknown>
    render(model: MatchImage): Promise<Uint8Array>
}) {
    return async (headers: Record<string, string> = {}) => {
        const responseHeaders = {
            ...headers,
            "Cache-Control": "private, no-store",
        }
        const fail = (code: string, status: number, extra = {}) =>
            Response.json(
                { error: { code, ...extra } },
                { status, headers: responseHeaders }
            )
        const value = await ports.context()
        if (!value || typeof value !== "object" || !("model" in value))
            return fail("not_found", 404)
        if (
            "customImageUrl" in value &&
            typeof value.customImageUrl === "string" &&
            value.customImageUrl.trim()
        )
            return fail("custom_image", 409, { imageUrl: value.customImageUrl })
        const parsed = matchImageSchema.safeParse(value.model)
        if (!parsed.success) return fail("invalid_image_context", 422)
        const key = panelImageRequestHash({ kind: "match", model: parsed.data })
        try {
            let bytes = cache.get(key)
            if (!bytes) {
                let render = pending.get(key)
                if (!render) {
                    render = ports.render(parsed.data)
                    pending.set(key, render)
                }
                try {
                    bytes = await render
                    cache.set(key, bytes)
                } finally {
                    pending.delete(key)
                }
            }
            return new Response(new Uint8Array(bytes).buffer, {
                headers: {
                    ...responseHeaders,
                    "Content-Type": "image/png",
                    "X-Content-Type-Options": "nosniff",
                },
            })
        } catch {
            return fail("render_failed", 503)
        }
    }
}
