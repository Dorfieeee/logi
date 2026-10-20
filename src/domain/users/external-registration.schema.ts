import { parseSteamId } from "../player-stats/player-stats"
import { externalPlatformId } from "./external-platform-id"
import { z } from "zod"

export const externalRegistrationSchema = z
    .object({
        discordId: z.string().regex(/^\d{17,20}$/),
        guildId: z.string().regex(/^\d{17,20}$/),
        name: z.string().trim().min(1).max(100),
        steamId: z
            .string()
            .regex(/^\d{17}$/)
            .refine(
                (value) => parseSteamId(value) !== null,
                "Invalid SteamID64"
            )
            .optional(),
        steamName: z.string().trim().min(1).max(100).optional(),
        platformId: z
            .string()
            .trim()
            .regex(/^(?:\d{17}|[a-fA-F0-9]{32})$/)
            .refine(
                (value) => externalPlatformId(value) !== null,
                "Invalid Steam64 or EOS ID"
            )
            .optional(),
        avatar: z
            .union([
                z.literal(""),
                z
                    .string()
                    .url()
                    .max(2048)
                    .refine(
                        (value) => new URL(value).protocol === "https:",
                        "Avatar must use HTTPS"
                    ),
            ])
            .default(""),
        gameId: z
            .string()
            .trim()
            .min(1)
            .max(100)
            .refine((value) => value !== "all")
            .default("hell_let_loose"),
        type: z
            .enum(["member", "reserve_member", "mercenary"])
            .default("member"),
        status: z.enum(["pending", "recruit", "active"]).default("pending"),
        createMembership: z.boolean().default(false),
    })
    .strict()
    .refine(
        (input) =>
            !input.steamId ||
            !input.platformId ||
            externalPlatformId(input.steamId) ===
                externalPlatformId(input.platformId),
        {
            path: ["platformId"],
            message:
                "steamId and platformId must refer to the same account; submit one account per request.",
        }
    )

export type ExternalRegistration = z.infer<typeof externalRegistrationSchema>
