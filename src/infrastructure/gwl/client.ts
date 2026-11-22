import {
    gwlEndpoint,
    gwlDiagnosticPath,
    type GwlDiagnostic,
} from "../../domain/gwl/diagnostics"
import { gwlScopeForPath } from "../../domain/gwl/save-feedback"
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
    let response: Response
    try {
        response = await (options.fetcher ?? fetch)(
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
    } catch {
        throw new GwlError("network", 0, gwlScopeForPath(path), {
            endpoint: gwlEndpoint(path),
            reason: "network",
        })
    }
    const contentType = response.headers.get("Content-Type") ?? ""
    const diagnostic: GwlDiagnostic = {
        endpoint: gwlEndpoint(path),
        status: response.status,
        format: contentType.includes("json")
            ? "json"
            : contentType.includes("html")
              ? "html"
              : contentType.includes("text/")
                ? "text"
                : "other",
    }
    const test =
        response.headers.get("X-GWL-Mode") === "test" ||
        key.startsWith("gwl_test_")
    if (response.status === 304) return { data: null, etag: options.etag, test }
    const reader = response.body?.getReader()
    if (!reader)
        throw new GwlError("empty_response", 0, gwlScopeForPath(path), {
            ...diagnostic,
            reason: "empty_body",
        })
    const chunks: Uint8Array[] = []
    let size = 0
    try {
        while (true) {
            const { done, value } = await reader.read()
            if (done) break
            size += value.length
            if (size > 16 * 1024 * 1024)
                throw new GwlError(
                    "response_too_large",
                    0,
                    gwlScopeForPath(path),
                    { ...diagnostic, reason: "too_large" }
                )
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
        throw new GwlError("invalid_response", 0, gwlScopeForPath(path), {
            ...diagnostic,
            reason: "invalid_json",
        })
    }
    if (!response.ok) {
        const error = z
            .object({
                error: z.object({
                    code: z.enum([
                        "invalid_request",
                        "invalid_json",
                        "missing_key",
                        "invalid_key",
                        "key_revoked",
                        "key_expired",
                        "missing_scope",
                        "scope_lost",
                        "wrong_key_type",
                        "team_suspended",
                        "key_maker_left",
                        "key_maker_no_access",
                        "not_found",
                        "method_not_allowed",
                        "application_closed",
                        "body_too_large",
                        "unsupported_media_type",
                        "rate_limited",
                        "daily_limit",
                        "too_many_bad_keys",
                        "internal_error",
                        "public_api_off",
                    ]),
                }),
            })
            .safeParse(body)
        const retry = Number(response.headers.get("Retry-After"))
        throw new GwlError(
            error.success ? error.data.error.code : "unavailable",
            Number.isFinite(retry) ? Math.max(0, retry) * 1000 : 0,
            gwlScopeForPath(path),
            { ...diagnostic, reason: "http_error" }
        )
    }
    const parsed = schema.safeParse(body)
    if (!parsed.success)
        throw new GwlError("invalid_response", 0, gwlScopeForPath(path), {
            ...diagnostic,
            reason: "invalid_shape",
            fields: [
                ...new Set(
                    parsed.error.issues.map((issue) =>
                        gwlDiagnosticPath(issue.path)
                    )
                ),
            ].slice(0, 20),
        })
    return {
        data: parsed.data,
        etag: response.headers.get("ETag") ?? undefined,
        test,
    }
}
