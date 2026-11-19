import { GwlError } from "../../domain/gwl/errors"
import { z } from "zod"
export { GwlError } from "../../domain/gwl/errors"
/** Fixed credential destination, bounded body, deadline, no credential-bearing redirects. */
export async function gwlGet<T>(
    key: string,
    path: string,
    schema: z.ZodType<T>,
    options: {
        fetcher?: typeof fetch
        reserve?: () => Promise<void>
        etag?: string
    } = {}
): Promise<{ data: T | null; etag?: string; test: boolean }> {
    if (!/^\/team(?:\/|\?|$)/.test(path) || path.includes(".."))
        throw new GwlError("invalid_path")
    await options.reserve?.()
    const response = await (options.fetcher ?? fetch)(
        `https://gwl.gg/api/v1${path}`,
        {
            headers: {
                Authorization: `Bearer ${key}`,
                Accept: "application/json",
                ...(options.etag ? { "If-None-Match": options.etag } : {}),
            },
            redirect: "error",
            signal: AbortSignal.timeout(15000),
        }
    )
    const test =
        response.headers.get("X-GWL-Mode") === "test" ||
        key.startsWith("gwl_test_")
    if (response.status === 304) return { data: null, etag: options.etag, test }
    const reader = response.body?.getReader()
    if (!reader) throw new GwlError("empty_response")
    const chunks: Uint8Array[] = []
    let size = 0
    try {
        while (true) {
            const { done, value } = await reader.read()
            if (done) break
            size += value.length
            if (size > 16 * 1024 * 1024)
                throw new GwlError("response_too_large")
            chunks.push(value)
        }
    } finally {
        await reader.cancel()
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) {
        bytes.set(chunk, offset)
        offset += chunk.length
    }
    let body: unknown
    try {
        body = JSON.parse(new TextDecoder().decode(bytes))
    } catch {
        throw new GwlError("invalid_response")
    }
    if (!response.ok) {
        const error = z
            .object({
                error: z.object({ code: z.string().regex(/^[a-z_]{1,60}$/) }),
            })
            .safeParse(body)
        const retry = Number(response.headers.get("Retry-After"))
        throw new GwlError(
            error.success ? error.data.error.code : "unavailable",
            Number.isFinite(retry) ? Math.max(0, retry) * 1000 : 0
        )
    }
    return {
        data: schema.parse(body),
        etag: response.headers.get("ETag") ?? undefined,
        test,
    }
}
