import { externalRegistrationSchema } from "@/domain/users/external-registration.schema"
import { z } from "zod"

export const externalRegistrationPaths = {
    "/clan/users/register": {
        post: {
            tags: ["Clan API — Assignments"],
            summary: "Register a Discord user and clan membership atomically",
            description:
                "Requires a full-access clan API key; read-only keys are denied. guildId must match the key. The external service must authenticate the submitted Discord identity. Steam metadata is self-declared, never verified identity. Existing profiles must already contain the submitted Steam ID and are preserved; existing game assignments are preserved. No Discord roles are granted. Defaults: HLL, active member, empty avatar. A primary member of another clan cannot gain a new primary membership here. Identical retries replay the original response for 24 hours; changing the body with the same key returns 409.",
            security: [{ clanApiKey: [] }],
            parameters: [
                {
                    name: "Idempotency-Key",
                    in: "header",
                    required: true,
                    schema: { type: "string", minLength: 1, maxLength: 200 },
                },
            ],
            requestBody: {
                required: true,
                content: {
                    "application/json": {
                        schema: z.toJSONSchema(externalRegistrationSchema, {
                            io: "input",
                        }),
                    },
                },
            },
            responses: {
                "200": {
                    description: "Profile and membership already exist",
                    content: {
                        "application/json": {
                            schema: registrationResponseSchema(),
                        },
                    },
                },
                "201": {
                    description: "User and/or membership created",
                    content: {
                        "application/json": {
                            schema: registrationResponseSchema(),
                        },
                    },
                },
                "400": {
                    description:
                        "Invalid details, disabled game or missing Idempotency-Key",
                },
                "401": { description: "Missing, invalid or revoked API key" },
                "403": { description: "Read-only key or guild scope mismatch" },
                "404": { description: "Clan not found" },
                "409": {
                    description:
                        "Identity, Steam ownership, primary membership or idempotency conflict",
                },
                "429": { description: "Rate limit exceeded" },
                "500": {
                    description:
                        "Transaction failed; retry the identical request",
                },
            },
        },
    },
}

function registrationResponseSchema() {
    return {
        type: "object",
        required: ["data"],
        properties: {
            data: {
                type: "object",
                required: [
                    "userId",
                    "discordId",
                    "guildId",
                    "gameId",
                    "assignmentId",
                    "userCreated",
                    "membershipCreated",
                ],
                properties: {
                    userId: { type: "string" },
                    discordId: { type: "string" },
                    guildId: { type: "string" },
                    gameId: { type: "string" },
                    assignmentId: { type: "string" },
                    userCreated: { type: "boolean" },
                    membershipCreated: { type: "boolean" },
                },
            },
        },
    }
}
