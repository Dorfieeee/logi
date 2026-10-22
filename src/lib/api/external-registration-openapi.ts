import { externalRegistrationSchema } from "@/domain/users/external-registration.schema"
import { z } from "zod"

export const externalRegistrationPaths = {
    "/clan/users/register": {
        post: {
            tags: ["Clan API — Assignments"],
            summary:
                "Create or update a Discord user's Steam/EOS account, optionally adding game membership",
            description:
                "Requires a full-access clan API key; read-only keys are denied. guildId must match the key. The external service must authenticate the submitted Discord identity. By default creates or reuses only a user account and safely appends a self-declared player ID; no memberships or native Logi applications are created or changed. Supply platformId as a raw valid 17-digit Steam64 or 32-character hexadecimal EOS ID (normalized to lowercase). The legacy steamId field remains Steam-only. When both fields are supplied they must identify the same account. One account is linked per request. Both may be omitted if the existing Discord user already has a supported Steam/EOS ID, preferring Steam when several are linked. steamName is optional historical metadata for the in-game name on either platform. A supplied unclaimed ID is appended without replacing existing IDs, identity, name or avatar. IDs recorded by another user, including legacy fields, epic-prefixed and case-varied EOS IDs and verified Steam links, return 409 and roll back the entire request; this endpoint never transfers accounts or grants verified identity. Set createMembership=true explicitly to add a missing assignment for the requested game, preserving all existing assignments. Only that opt-in checks enabled games and primary membership conflicts within the requested game; pending applications may coexist with other memberships. assignmentId is null and membershipCreated=false in account-only mode. No Discord roles or application threads are created. Defaults: createMembership=false, HLL, pending member, empty avatar. Identical retries replay the original response for 24 hours; changing the body with the same key returns 409.",
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
                        "Invalid details, conflicting steamId/platformId, no supported Steam/EOS ID on request or user, disabled game or missing Idempotency-Key",
                },
                "401": { description: "Missing, invalid or revoked API key" },
                "403": { description: "Read-only key or guild scope mismatch" },
                "404": { description: "Clan not found" },
                "409": {
                    description:
                        "Identity, platform ownership, primary membership or idempotency conflict",
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
