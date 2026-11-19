import { z } from "zod"
export const gwlScopes = [
    "team.read",
    "matches.read",
    "matches.file",
    "events.read",
    "slots.read",
] as const
export type GwlScope = (typeof gwlScopes)[number]
export const gwlSaveErrorCodes = [
    "missing_scope",
    "key_rejected",
    "wrong_key_type",
    "test_key_cannot_sync_live_data",
    "team_change_requires_unlinking",
    "encryption_unavailable",
    "invalid_settings",
    "registration_timing",
    "channel_access",
    "rate_limited",
    "provider_unavailable",
    "save_failed",
] as const
export const gwlSaveFailureSchema = z.object({
    ok: z.literal(false).optional(),
    error: z.enum(gwlSaveErrorCodes),
    scope: z.enum(gwlScopes).optional(),
})
export type GwlSaveFailure = z.infer<typeof gwlSaveFailureSchema>
export function gwlScopeForPath(path: string): GwlScope | undefined {
    if (/^\/team\/matches\/[^/]+\/file$/.test(path)) return "matches.file"
    if (path.startsWith("/team/fixtures") || path.startsWith("/team/matches/"))
        return "matches.read"
    if (path.startsWith("/team/events")) return "events.read"
    if (path.startsWith("/team/slots")) return "slots.read"
    if (path === "/team") return "team.read"
}
