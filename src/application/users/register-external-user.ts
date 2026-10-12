import type { ExternalRegistration } from "../../domain/users/external-registration.schema"

export class RegistrationConflict extends Error {}

export interface ExternalRegistrationPort {
    inspect(input: ExternalRegistration): Promise<{
        userId: string | null
        steamMatches: boolean
        primaryGuildId?: string
        assignmentId: string | null
    }>
    createUser(input: ExternalRegistration): Promise<string>
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
    if (existing.userId && !existing.steamMatches)
        throw new RegistrationConflict(
            "The existing Discord profile has different platform details. Link the Steam ID in Logi first."
        )
    if (
        !existing.assignmentId &&
        input.type !== "mercenary" &&
        existing.primaryGuildId &&
        existing.primaryGuildId !== input.guildId
    )
        throw new RegistrationConflict(
            "This user already has a primary clan membership elsewhere."
        )
    const userId = existing.userId ?? (await port.createUser(input))
    const assignmentId =
        existing.assignmentId ?? (await port.createMembership(input, userId))
    return {
        userId,
        discordId: input.discordId,
        guildId: input.guildId,
        gameId: input.gameId,
        assignmentId,
        userCreated: !existing.userId,
        membershipCreated: !existing.assignmentId,
    }
}
