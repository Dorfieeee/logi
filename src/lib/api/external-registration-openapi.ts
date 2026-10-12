import { externalRegistrationSchema } from "@/domain/users/external-registration.schema"
import { z } from "zod"

export const externalRegistrationPaths = {
    "/clan/users/register": {
        post: {
            tags: ["Clan API — Assignments"],
            summary:
                "Create or update a Discord user's Steam account, optionally adding game membership",
            description:
                "Requires a full-access clan API key; read-only keys are denied. guildId must match the key. The external service must authenticate the submitted Discord identity. By default creates or reuses only a user account and safely appends a self-declared Steam ID; no memberships or native Logi applications are created or changed. steamId is required for a new user or a user without Steam details; otherwise it can be omitted to reuse a linked ID. A supplied unclaimed Steam ID is appended without replacing existing IDs, identity, name or avatar. IDs recorded by another user, including legacy and verified links, return 409 and roll back the entire request; this endpoint never transfers Steam accounts or grants verified identity. Set createMembership=true explicitly to add a missing assignment for the requested game, preserving all existing assignments. Only that opt-in checks enabled games and primary membership conflicts within the requested game; pending applications may coexist with other memberships. assignmentId is null and membershipCreated=false in account-only mode. No Discord roles or application threads are created. Defaults: createMembership=false, HLL, pending member, empty avatar. Identical retries replay the original response for 24 hours; changing the body with the same key returns 409.",
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
                    description:
                        "Existing account reused or updated; optional membership already exists",
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
                        "Invalid details, Steam ID absent on both request and user, disabled game or missing Idempotency-Key",
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
                    assignmentId: { type: ["string", "null"] },
                    userCreated: { type: "boolean" },
                    membershipCreated: { type: "boolean" },
                },
            },
        },
    }
}
