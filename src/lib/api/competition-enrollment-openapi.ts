import { clanEnrollmentCommandSchema } from "@/domain/competitions/enrollment.schema"
import { z } from "zod"
const parameters = [
    {
        name: "game",
        in: "query",
        required: true,
        schema: { type: "string", enum: ["hell_let_loose", "wardogs"] },
    },
]
const security = [{ clanApiKey: [], ssoActorToken: [] }]
const response = (
    description: string,
    schema: object = { type: "object" }
) => ({ description, content: { "application/json": { schema } } })
const errors = {
    "400": response("Invalid query or command."),
    "401": response("API key and X-Logi-Actor-Token required."),
    "403": response(
        "Current clan administrator required; key and actor must belong to the same clan. Restricted keys cannot write."
    ),
    "404": response(
        "Competition or registration not found in the requested game."
    ),
    "409": response(
        "Registration closed, minimum_players, archived team or registration limit."
    ),
    "429": response("Rate limit exceeded."),
    "503": response("Unavailable. Retrying an unchanged command is safe."),
}
const read = {
    security,
    parameters,
    "x-logi-read-access": {
        resource: "teams",
        gameSelection: "one-explicit-game",
    },
    description:
        "Requires an unrestricted existing key or an explicit teams read grant for this game, plus the live SSO clan administrator.",
    responses: {
        "200": response(
            "Clan-linked teams and published competitions in this game, own registration states, and distinct signed-in clan-member count. Pending and rejected requests are private to administrators."
        ),
        ...errors,
    },
}
const write = {
    security,
    parameters,
    "x-logi-read-access": null,
    description:
        "Requires an existing unrestricted (legacy full-access) clan key and the live SSO clan administrator. Restricted service keys are deliberately excluded: their existing grants authorize reads or event writes, never competition enrollment or clan-wide mode changes. No service-only or superadmin competition-catalogue writes. Enrollment, withdrawal and mode assignment are naturally idempotent. Withdrawals retain registration, division, fixtures and results. Re-enrollment checks the current policy and player count.",
    responses: {
        "200": response("Command applied or already applied."),
        ...errors,
    },
}
const modeSchema = {
    type: "object",
    additionalProperties: false,
    required: ["mode"],
    properties: { mode: { type: "string", enum: ["full", "competitions"] } },
}
const body = <T extends object>(schema: T) => ({
    required: true,
    content: { "application/json": { schema } },
})
export const competitionEnrollmentPaths = {
    "/clan/competitions": {
        get: { ...read, summary: "Read clan competition enrollment" },
        post: {
            ...write,
            summary: "Enroll or withdraw a clan-linked team",
            requestBody: body(z.toJSONSchema(clanEnrollmentCommandSchema)),
        },
    },
    "/clan/workspace-mode": {
        get: {
            ...read,
            summary: "Read clan workspace mode",
            responses: {
                ...errors,
                "200": response(
                    "Persisted clan-wide mode; missing means full.",
                    {
                        type: "object",
                        properties: { data: modeSchema },
                        required: ["data"],
                    }
                ),
            },
        },
        patch: {
            ...write,
            summary: "Set clan workspace mode",
            requestBody: body(modeSchema),
        },
    },
}
