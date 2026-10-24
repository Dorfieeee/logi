/** Explicit selectors never inherit the historical imported-ID lookup. */
export type PublicPlayerIdentifierKind = "discord"

export function isPublicPlayerDiscordSubject(value: string): boolean {
    return /^\d{17,20}$/.test(value)
}

/** Deterministic opaque account binding. It exposes neither input nor ownership
 * claims; consumers compare it to their already-authorized native identity. */
export async function publicPlayerIdentityBinding(
    nativeUserId: string,
    discordSubject: string
): Promise<string> {
    if (
        !nativeUserId ||
        nativeUserId.length > 200 ||
        !isPublicPlayerDiscordSubject(discordSubject)
    )
        throw new Error("Invalid public player identity.")
    const bytes = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(
            JSON.stringify([
                "public-player-native-v1",
                nativeUserId,
                discordSubject,
            ])
        )
    )
    return Array.from(new Uint8Array(bytes), (byte) =>
        byte.toString(16).padStart(2, "0")
    ).join("")
}

/** Default callers must omit the new argument while Next/Convex deploy separately. */
export function publicPlayerLookupArguments(
    playerId: string,
    game?: string,
    identifierKind?: PublicPlayerIdentifierKind
) {
    return {
        playerId,
        ...(game ? { game } : {}),
        ...(identifierKind ? { identifierKind } : {}),
    }
}

export function publicPlayerCacheKey(
    playerId: string,
    game?: string,
    identifierKind?: PublicPlayerIdentifierKind
): string[] {
    return [
        "public-player:v5",
        playerId,
        game ?? "default",
        identifierKind ?? "legacy",
    ]
}
