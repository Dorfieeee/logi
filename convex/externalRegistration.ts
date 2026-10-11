import {
    ConvexAssignmentCommandRepository,
    ConvexAssignmentRosterSyncPort,
} from "../src/infrastructure/convex/assignment-command-repositories"
import {
    registerExternalUser,
    RegistrationConflict,
} from "../src/application/users/register-external-user"
import { UpsertAssignmentUseCase } from "../src/application/assignments/upsert-assignment.use-case"
import { externalRegistrationSchema } from "../src/domain/users/external-registration.schema"
import { parseSteamId } from "../src/domain/player-stats/player-stats"
import { linkDiscordPlatformInTransaction } from "./platformLinkStore"
import { getGuildByDiscordId, getUserStableId } from "./identity"
import { startIdempotentMutation } from "./apiIdempotency"
import { systemClock } from "../src/domain/shared/clock"
import { assertInternalSecret } from "./publicApiShared"
import { mutation } from "./integrationMutation"
import { v, ConvexError } from "convex/values"

export const register = mutation({
    args: {
        secret: v.string(),
        keyHash: v.string(),
        idempotencyKey: v.string(),
        bodyHash: v.string(),
        input: v.object({
            discordId: v.string(),
            guildId: v.string(),
            name: v.string(),
            steamId: v.string(),
            steamName: v.string(),
            avatar: v.string(),
            gameId: v.string(),
            type: v.union(
                v.literal("member"),
                v.literal("reserve_member"),
                v.literal("mercenary")
            ),
            status: v.union(
                v.literal("pending"),
                v.literal("recruit"),
                v.literal("active")
            ),
        }),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const start = await startIdempotentMutation(ctx, {
            ...args,
            methodPath: "POST /clan/users/register",
        })
        if (start.kind === "unauthorized") return null
        if (start.kind === "complete") return start.result
        const finish = async (status: number, payload: unknown) => {
            const body = JSON.stringify(payload)
            await ctx.db.patch(start.idempotencyId, {
                status,
                responseBody: body,
            })
            return { status, body }
        }
        const parsed = externalRegistrationSchema.safeParse(args.input)
        if (!parsed.success)
            return finish(400, {
                error: {
                    code: "validation_error",
                    message: "Invalid registration details.",
                },
            })
        const input = parsed.data
        if (input.guildId !== start.key.guildId)
            return finish(403, {
                error: {
                    code: "insufficient_scope",
                    message: "guildId must match the API key's clan.",
                },
            })
        const guild = await getGuildByDiscordId(ctx, start.key.guildId)
        if (!guild)
            return finish(404, {
                error: { code: "not_found", message: "Clan not found." },
            })
        if (!(guild.enabledGames ?? ["hell_let_loose"]).includes(input.gameId))
            return finish(400, {
                error: {
                    code: "validation_error",
                    message: "The game is not enabled for this clan.",
                },
            })
        const repository = new ConvexAssignmentCommandRepository(ctx)
        try {
            const data = await registerExternalUser(input, {
                inspect: async () => {
                    const user = await ctx.db
                        .query("users")
                        .withIndex("discordId", (q) =>
                            q.eq("discordId", input.discordId)
                        )
                        .unique()
                    if (
                        !user &&
                        (await ctx.db
                            .query("users")
                            .withIndex("id", (q) => q.eq("id", input.discordId))
                            .unique())
                    )
                        throw new RegistrationConflict(
                            "Identity conflict. Contact an administrator."
                        )
                    const userId = user ? getUserStableId(user) : null
                    const assignment = userId
                        ? await repository.getByServerUser(
                              input.guildId,
                              userId,
                              input.gameId
                          )
                        : null
                    return {
                        userId,
                        steamMatches:
                            user?.platformIds?.some(
                                (value) => parseSteamId(value) === input.steamId
                            ) ?? false,
                        primaryGuildId: user?.guildId,
                        assignmentId: assignment?.id ?? null,
                    }
                },
                createUser: async () => {
                    await linkDiscordPlatformInTransaction(ctx, {
                        userId: input.discordId,
                        userName: input.name,
                        userAvatar: input.avatar,
                        platformId: input.steamId,
                    })
                    const user = await ctx.db
                        .query("users")
                        .withIndex("discordId", (q) =>
                            q.eq("discordId", input.discordId)
                        )
                        .unique()
                    if (!user)
                        throw new Error("Registration user was not created.")
                    await ctx.db.patch(user._id, { steamName: input.steamName })
                    return getUserStableId(user)
                },
                createMembership: async (_input, userId) =>
                    new UpsertAssignmentUseCase(
                        repository,
                        new ConvexAssignmentRosterSyncPort(ctx),
                        systemClock
                    ).execute({
                        userId,
                        serverDiscordId: input.guildId,
                        gameId: input.gameId,
                        type: input.type,
                        status: input.status,
                        secondaryGroupIds: [],
                        paused: false,
                    }),
            })
            return finish(
                data.userCreated || data.membershipCreated ? 201 : 200,
                { data }
            )
        } catch (error) {
            // Throw after any workflow failure: Convex rolls back the user, membership and receipt together.
            if (
                error instanceof RegistrationConflict ||
                (error instanceof Error &&
                    [
                        "This platform ID is already linked to another player.",
                        "Identity conflict. Contact an administrator.",
                        "Platform link requires administrator review.",
                    ].includes(error.message))
            )
                throw new ConvexError({
                    code: "registration_conflict",
                    message: error.message,
                })
            throw error
        }
    },
})
