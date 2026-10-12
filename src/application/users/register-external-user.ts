import type { ExternalRegistration } from "../../domain/users/external-registration.schema"

export class RegistrationConflict extends Error {}
export class RegistrationValidationError extends Error {}

export interface ExternalRegistrationPort {
    inspect(input: ExternalRegistration): Promise<{
        userId: string | null
        steamId: string | null
        primaryGuildId?: string
        assignmentId: string | null
    }>
    createUser(input: ExternalRegistration): Promise<string>
    linkSteam(
        input: ExternalRegistration & { steamId: string },
        userId: string
    ): Promise<void>
    createMembership(
        input: ExternalRegistration,
        userId: string
    ): Promise<string>
}

/** The adapter executes this workflow in one transaction; failures must roll back all writes. */
export async function registerExternalUser(
    input: ExternalRegistration,
    port: ExternalRegistrationPort
) {
    const existing = await port.inspect(input)
    const steamId = input.steamId ?? existing.steamId
    if (!steamId)
        throw new RegistrationValidationError(
            "Steam ID is required for a new user or an existing user without Steam details."
        )
    if (
        input.createMembership &&
        !existing.assignmentId &&
        input.status !== "pending" &&
        input.type !== "mercenary" &&
        existing.primaryGuildId &&
        existing.primaryGuildId !== input.guildId
    )
        throw new RegistrationConflict(
            "This user already has a primary clan membership elsewhere."
        )
    const resolved = { ...input, steamId }
    const userId = existing.userId ?? (await port.createUser(resolved))
    if (existing.userId) await port.linkSteam(resolved, userId)
    const assignmentId = input.createMembership
        ? (existing.assignmentId ??
          (await port.createMembership(input, userId)))
        : null
    return {
        userId,
        discordId: input.discordId,
        guildId: input.guildId,
        gameId: input.gameId,
        assignmentId,
        userCreated: !existing.userId,
        membershipCreated: input.createMembership && !existing.assignmentId,
    }
}
