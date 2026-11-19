import { CredentialCipherError } from "../game-data/credential-cipher"
import type { GwlSaveFailure } from "../../domain/gwl/save-feedback"
import { GwlError } from "../../domain/gwl/errors"
import { ZodError } from "zod"
/** Only fixed codes and known scope names cross the dashboard boundary. */
export function gwlSaveFailure(error: unknown): GwlSaveFailure {
    if (error instanceof GwlError) {
        if (error.code === "missing_scope")
            return {
                ok: false,
                error: "missing_scope",
                ...(error.scope ? { scope: error.scope } : {}),
            }
        if (
            error.code === "wrong_key_type" ||
            error.code === "test_key_cannot_sync_live_data" ||
            error.code === "team_change_requires_unlinking"
        )
            return { ok: false, error: error.code }
        if (
            [
                "scope_lost",
                "invalid_key",
                "key_expired",
                "key_revoked",
                "key_maker_left",
                "key_maker_no_access",
                "team_suspended",
            ].includes(error.code)
        )
            return { ok: false, error: "key_rejected" }
        if (
            ["rate_limited", "daily_limit", "too_many_bad_keys"].includes(
                error.code
            )
        )
            return { ok: false, error: "rate_limited" }
        return { ok: false, error: "provider_unavailable" }
    }
    if (
        error instanceof CredentialCipherError ||
        (error instanceof Error &&
            error.message === "Credential encryption is not configured.")
    )
        return { ok: false, error: "encryption_unavailable" }
    if (error instanceof ZodError)
        return { ok: false, error: "invalid_settings" }
    if (
        error instanceof Error &&
        error.message.includes("Registration must open before it closes.")
    )
        return { ok: false, error: "registration_timing" }
    if (
        error instanceof Error &&
        error.message.includes("Select a Wardogs match template.")
    )
        return { ok: false, error: "invalid_settings" }
    return { ok: false, error: "save_failed" }
}
