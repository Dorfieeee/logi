import {
    externalRegistrationSchema,
    type ExternalRegistration,
} from "@/domain/users/external-registration.schema"
import type { AuthenticatedClanRequest } from "./authenticated-clan-route"
import { validateIdempotencyKey } from "@/domain/api/idempotency"
import { ConvexError } from "convex/values"
import { createHash } from "node:crypto"

export async function handleExternalRegistration(
    request: Request,
    dependencies: {
        authenticate: (
            request: Request
        ) => Promise<AuthenticatedClanRequest | Response>
        register: (input: {
            key: string
            idempotencyKey: string
            bodyHash: string
            input: ExternalRegistration
        }) => Promise<{ status: number; body: string } | null>
    }
) {
    const auth = await dependencies.authenticate(request)
    if (auth instanceof Response) return auth
    const headers = { ...auth.headers, "Cache-Control": "no-store" }
    const error = (status: number, code: string, message: string) =>
        Response.json({ error: { code, message } }, { status, headers })
    const idempotencyKey = request.headers.get("idempotency-key")
    const invalidKey = validateIdempotencyKey(idempotencyKey)
    if (!idempotencyKey || invalidKey)
        return error(
            400,
            "missing_idempotency_key",
            invalidKey ?? "Idempotency-Key is required."
        )
    const raw = await request.text()
    let body: unknown
    try {
        body = JSON.parse(raw)
    } catch {
        return error(400, "invalid_json", "Request body must be JSON.")
    }
    const parsed = externalRegistrationSchema.safeParse(body)
    if (!parsed.success)
        return error(
            400,
            "validation_error",
            parsed.error.issues
                .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
                .join("; ")
        )
    if (parsed.data.guildId !== auth.guildId)
        return error(
            403,
            "insufficient_scope",
            "guildId must match the API key's clan."
        )
    try {
        const result = await dependencies.register({
            key: auth.key,
            idempotencyKey,
            bodyHash: createHash("sha256").update(raw).digest("hex"),
            input: parsed.data,
        })
        if (!result)
            return error(
                401,
                "invalid_api_key",
                "The API key is invalid or revoked."
            )
        return new Response(result.body, {
            status: result.status,
            headers: { ...headers, "Content-Type": "application/json" },
        })
    } catch (cause) {
        if (
            cause instanceof ConvexError &&
            typeof cause.data === "object" &&
            cause.data !== null &&
            "code" in cause.data &&
            (cause.data.code === "registration_conflict" ||
                cause.data.code === "validation_error")
        )
            return error(
                cause.data.code === "validation_error" ? 400 : 409,
                String(cause.data.code),
                String(cause.data.message)
            )
        return error(
            500,
            "registration_failed",
            "Registration failed. Retry with the same Idempotency-Key."
        )
    }
}
