import type { ExternalRegistration } from "../../domain/users/external-registration.schema"
import { externalPlatformId } from "../../domain/users/external-platform-id"

export class RegistrationConflict extends Error {}
export class RegistrationValidationError extends Error {}

export interface ExternalRegistrationPort {
    inspect(input: ExternalRegistration): Promise<{
        userId: string | null
        platformId: string | null
        primaryGuildId?: string
        assignmentId: string | null
    }>
    createUser(
        input: ExternalRegistration & { platformId: string }
    ): Promise<string>
    linkPlatform(
        input: ExternalRegistration & { platformId: string },
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
    const suppliedId = input.platformId ?? input.steamId
    const platformId = suppliedId
        ? externalPlatformId(suppliedId)
        : existing.platformId
    if (!platformId)
        throw new RegistrationValidationError(
            "A Steam or EOS player ID is required for a new user or an existing user without supported platform details."
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
    const resolved = { ...input, platformId }
    const userId = existing.userId ?? (await port.createUser(resolved))
    if (existing.userId) await port.linkPlatform(resolved, userId)
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
