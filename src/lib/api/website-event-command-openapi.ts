import {
    websiteEventCommandSchema,
    websiteEventEditorSchema,
    websiteEventReceiptSchema,
} from "../../domain/events/website-command"
import { z } from "zod"

export const websiteEventCommandSchemas = {
    WebsiteEventCommand: z.toJSONSchema(websiteEventCommandSchema),
    WebsiteEventReceipt: z.toJSONSchema(websiteEventReceiptSchema),
    WebsiteEventEditor: z.toJSONSchema(websiteEventEditorSchema),
}
const security = [{ clanApiKey: [], ssoActorToken: [] }]
const access = {
    "x-logi-read-access": null,
    "x-logi-write-access": {
        resource: "event-commands",
        gameSelection: "one-explicit-game",
        actor: "current-bound-SSO-token",
        policy: "enabled-application-game-role-allowlist",
    },
}
const game = {
    name: "game",
    in: "query",
    required: true,
    description:
        "Exactly one explicit permitted game. Repeated games, all and other query parameters are rejected.",
    schema: { type: "string", enum: ["hell_let_loose", "wardogs"] },
}
const error = {
    type: "object",
    additionalProperties: false,
    required: ["error"],
    properties: {
        error: {
            type: "object",
            additionalProperties: false,
            required: ["code"],
            properties: { code: { type: "string" } },
        },
    },
}
const failure = (description: string) => ({
    description,
    content: { "application/json": { schema: error } },
})
const failures = {
    "400": failure(
        "invalid_request: strict request, UTC timeline, ID, or body limit failed outside event.matchTeams. invalid_match_teams: every schema failure lies in event.matchTeams (more than three entries, a slot other than a, b or c, a side that is empty or over 32 characters, a team ID outside 1-64 characters, or unknown keys such as a snapshot), or a team selection or snapshot refresh named an unknown, unassigned, archived, foreign or cross-game team, used a slot or side the game does not have, duplicated a team, slot or non-null side, assigned teams to a training, or refreshed a snapshot of a training. Cancellation after meeting start or of a concluded event is 409 invalid_state. Updates, team corrections and snapshot refreshes remain available after conclusion."
    ),
    "401": failure(
        "unauthorized: current service key, central session, SSO actor or exact guild/application binding failed."
    ),
    "403": failure(
        "insufficient_scope, policy_denied or membership_denied: an explicit write grant and current allowed Discord role are required."
    ),
    "404": failure("not_found: no event in this exact guild and game."),
    "409": failure(
        "revision_conflict, idempotency_conflict or invalid_state. Refresh the editor before a new intentional edit; never overwrite a conflict automatically."
    ),
    "429": {
        ...failure(
            "rate_limited: wait for Retry-After; keep the same command and idempotency key."
        ),
        headers: { "Retry-After": { schema: { type: "integer", minimum: 1 } } },
    },
    "503": failure(
        "membership_stale or unavailable. A POST may have committed before an unavailable response; preserve the exact key/body when retrying."
    ),
}
const success = (name: string, description: string) => ({
    description,
    content: {
        "application/json": {
            schema: {
                type: "object",
                additionalProperties: false,
                required: ["data"],
                properties: { data: { $ref: `#/components/schemas/${name}` } },
            },
        },
    },
})
const permission =
    "Requires a restricted service key with explicit writeAccess event-commands/game, its enabled SSO application policy and nonempty per-game Discord role allowlist, plus the current opaque SSO actor token. The actor, key, policy and observed membership (at most 60 seconds old, current guild epoch) are revalidated inside the transaction, including receipt replays. Login or a legacy key alone grants no write access."
export const websiteEventCommandPaths = {
    "/clan/event-commands": {
        post: {
            summary:
                "Create, update, cancel or refresh a match team as the current SSO actor",
            tags: ["Clan API — Events"],
            security,
            ...access,
            description: `${permission} Creates native Logi events and emits normal summary invalidations. Updates use the event-summary revision and preserve native private fields. Match/training kind changes are rejected. Updates remain available after meeting start and conclusion. Cancellation uses existing pre-meeting conclusion semantics: no result or attendance points. The delete operation permanently removes the event, roster, sign-ups and event-specific result records, also after conclusion; it requires the same current actor policy, expectedRevision and idempotency key. Discord cleanup is queued durably and retried by the bot. Shared strategy maps, competition fixtures, other occurrences and previously collected player statistics remain. Delete receipts replay successfully after the event has gone. Request JSON is limited to 16 KiB; dates must satisfy registrationStart <= registrationEnd <= meetingStart <= gameStart < gameEnd. Creation requires a future meeting time; updates may retain or correct historical times. Receipts are retained without a time expiry; replay uses the same application, subject, game and key. Timeouts, malformed success and server errors have unknown outcome: retain the original key and body. The Discord behavior flags createSignupThread and deleteForumAfterConclusion are accepted; channel locations, results, role management, passwords, publication and two-team score inference are not. deleteForumAfterConclusion defaults to true for new matches and preserves its stored value when omitted on update (false for legacy events). After manual or automatic conclusion it creates a private debrief in results → event info → registration, invites participants, then deletes the match forum and all its posts. Match team assignments: event.matchTeams lists directory team IDs with slot (a, b; c for Wardogs) and nullable side; Logi captures each team's name, short code and logo when first selected and never accepts client snapshots. Omitting matchTeams preserves the saved selection, an explicit [] clears it, and concluded matches allow explicit assignment corrections. The refresh_match_team operation re-captures one assigned team's presentation (name, short code, logo, team revision) from its active directory entry. It is audited and follows the same expectedRevision and idempotency receipt rules as an update, including after conclusion; a training returns invalid_match_teams.`,
            parameters: [
                game,
                {
                    name: "Idempotency-Key",
                    in: "header",
                    required: true,
                    description:
                        "One durable key per intentional command. Retain it after unknown outcomes; identical semantic body replays the original receipt after current authorization. Changed body with that key returns 409.",
                    schema: {
                        type: "string",
                        minLength: 16,
                        maxLength: 128,
                        pattern: "^[A-Za-z0-9_-]+$",
                    },
                },
            ],
            requestBody: {
                required: true,
                content: {
                    "application/json": {
                        schema: {
                            $ref: "#/components/schemas/WebsiteEventCommand",
                        },
                    },
                },
            },
            responses: {
                "200": success(
                    "WebsiteEventReceipt",
                    "Update, cancellation or team snapshot refresh committed, or its authorized receipt replayed."
                ),
                "201": success(
                    "WebsiteEventReceipt",
                    "Native event created, or its authorized receipt replayed."
                ),
                ...failures,
            },
        },
    },
    "/clan/event-commands/{eventId}": {
        get: {
            summary:
                "Read the bounded editor and current revision for a website command",
            description: `${permission} Returns only editable native schedule fields, the current matchTeams inputs for round-tripping, the captured team summaries (matchTeams, null for trainings and legacy events) and canEdit/canCancel. Never exposes server passwords, Discord channels, rosters, private notes or logo asset identifiers.`,
            tags: ["Clan API — Events"],
            security,
            ...access,
            parameters: [
                game,
                {
                    name: "eventId",
                    in: "path",
                    required: true,
                    schema: { type: "string" },
                },
            ],
            responses: {
                "200": success(
                    "WebsiteEventEditor",
                    "Bounded event editor at its current event-summary revision."
                ),
                ...failures,
            },
        },
    },
}
