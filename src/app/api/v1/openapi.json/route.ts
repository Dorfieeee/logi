import {
    DEFAULT_LEAGUE_PANEL_OPTIONS,
    leagueOverviewSchema,
} from "@/domain/wardogs-league/panels"
import {
    integrationChangeSchema,
    syncRecordSchema,
} from "@/domain/integrations/change.schema"
import {
    clanEventSummarySchema,
    clanMatchSummarySchema,
} from "@/domain/api/event-summaries"
import {
    serverSnapshotSchema,
    integrationHealthSchema,
} from "@/domain/game-data/contracts"
import {
    historyReadPaths,
    historyResponseSchemas,
} from "@/lib/api/game-history-openapi"
import {
    tacticalPlanSchema,
    eventTimeOfDaySchema,
} from "@/domain/events/tactical-plan"
import {
    peopleReadPaths,
    peopleResponseSchemas,
} from "@/lib/api/people-openapi"
import { membershipObservationSchema } from "@/domain/membership/observation.schema"
import { warconEnvelopeSchema } from "@/domain/game-data/warcon-contracts"
import { clanResultSummarySchema } from "@/domain/api/result-summaries"
import { leagueFixtureSchema } from "@/domain/wardogs-league/fixture"
import { leagueReadSchema } from "@/domain/wardogs-league/contracts"
import { PANEL_WINDOW } from "@/domain/wardogs-league/all-fixtures"
import { warconQuerySchema } from "@/domain/game-data/warcon-query"
import { hllLiveEnvelopeSchema } from "@/domain/game-data/hll-live"
import { matchTeamSummarySchema } from "@/domain/teams/match-teams"
import { API_KEY_READ_RESOURCES } from "@/domain/api/key-access"
import { SYNC_RESOURCES } from "@/domain/integrations/change"
import { NextResponse } from "next/server"
import { z } from "zod"

import {
    TEAM_DESCRIPTION_MAX,
    TEAM_GAMES,
    TEAM_LINKS_MAX,
    TEAM_PAGE_MAX,
    teamDtoSchema,
} from "@/domain/teams/team"
import {
    websiteEventCommandPaths,
    websiteEventCommandSchemas,
} from "@/lib/api/website-event-command-openapi"
import {
    clanSettingsOpenApiPath,
    clanSettingsOpenApiSchemas,
} from "@/lib/api/settings-openapi"
import { generatedOpenApiSchemas } from "@/lib/api/generated-openapi-schemas"

/** One division of a public competition, shared by the full and the paged response. */
const publicCompetitionDivisionSchema = {
    type: "object",
    required: ["id", "name", "teams", "fixtures"],
    properties: {
        id: { type: "string" },
        name: {
            type: "string",
        },
        teams: {
            type: "array",
            items: {
                type: "object",
                required: ["id", "name", "shortCode", "logoUrl", "withdrawn"],
                properties: {
                    id: {
                        type: "string",
                        description:
                            "Global team catalogue ID (guild:<id> for a legacy record).",
                    },
                    name: {
                        type: "string",
                    },
                    shortCode: {
                        type: ["string", "null"],
                    },
                    logoUrl: {
                        type: ["string", "null"],
                        format: "uri",
                    },
                    withdrawn: {
                        type: "boolean",
                    },
                },
            },
        },
        fixtures: {
            type: "array",
            items: {
                type: "object",
                required: ["id", "phase", "teamAId", "teamBId", "status"],
                properties: {
                    id: {
                        type: "string",
                    },
                    phase: {
                        type: "string",
                        enum: ["league", "playoff", "relegation"],
                    },
                    teamAId: {
                        type: "string",
                    },
                    teamBId: {
                        type: "string",
                    },
                    scoreA: {
                        type: "integer",
                    },
                    scoreB: {
                        type: "integer",
                    },
                    status: {
                        type: "string",
                        enum: ["scheduled", "final", "forfeit"],
                    },
                    scheduledAt: {
                        type: "string",
                        description:
                            "ISO 8601 for fixtures scheduled in Logi; imported legacy fixtures may hold free text.",
                    },
                    eventId: {
                        type: "string",
                        description:
                            "Linked Logi match event; its public page is /matches/{eventId}.",
                    },
                },
            },
        },
    },
} as const

const summaryResponseSchemas = {
    ...historyResponseSchemas,
    LeagueFixture: z.toJSONSchema(leagueFixtureSchema),
    LeagueMatchRead: z.toJSONSchema(leagueReadSchema),
    LeagueOverview: z.toJSONSchema(leagueOverviewSchema),
    WarconEnvelope: z.toJSONSchema(warconEnvelopeSchema),
    HllLiveEnvelope: z.toJSONSchema(hllLiveEnvelopeSchema),
    WarconQuery: z.toJSONSchema(warconQuerySchema),
    MembershipObservation: z.toJSONSchema(membershipObservationSchema),
    IntegrationChange: z.toJSONSchema(integrationChangeSchema),
    IntegrationSyncRecord: z.toJSONSchema(syncRecordSchema),
    ClanServerSnapshotsDocument: z.toJSONSchema(serverSnapshotSchema),
    ClanIntegrationHealthDocument: z.toJSONSchema(integrationHealthSchema),
    ClanEventSummariesDocument: z.toJSONSchema(clanEventSummarySchema),
    ClanMatchSummariesDocument: z.toJSONSchema(clanMatchSummarySchema),
    ClanResultSummariesDocument: z.toJSONSchema(clanResultSummarySchema),
    /** Minimized global catalogue entry; actor identifiers, asset IDs and administration fields are excluded. */
    ClanTeam: z.toJSONSchema(
        teamDtoSchema.extend({
            description: teamDtoSchema.shape.description.describe(
                `Plain-text team description of at most ${TEAM_DESCRIPTION_MAX} characters, or null; may contain line breaks. Render as text.`
            ),
            links: teamDtoSchema.shape.links.describe(
                `Up to ${TEAM_LINKS_MAX} unique public https URLs (for example a team site or Discord invite), or an empty array. Render as external links; they grant nothing.`
            ),
        })
    ),
    ClanTeamPage: {
        type: "object",
        required: ["items", "nextCursor"],
        additionalProperties: false,
        properties: {
            items: {
                type: "array",
                maxItems: TEAM_PAGE_MAX,
                items: { $ref: "#/components/schemas/ClanTeam" },
            },
            nextCursor: { type: ["string", "null"] },
        },
    },
    /** Immutable team snapshot captured for one native match slot; delivered inside summaries. */
    ClanMatchTeam: z.toJSONSchema(matchTeamSummarySchema),
}

const error = {
    type: "object",
    properties: {
        error: {
            type: "object",
            properties: {
                code: { type: "string" },
                message: { type: "string" },
            },
        },
    },
}
const pageParameters = [
    {
        name: "limit",
        in: "query",
        schema: { type: "integer", minimum: 1, maximum: 100, default: 25 },
    },
    {
        name: "cursor",
        in: "query",
        description:
            "Opaque value returned by the previous page. Reuse it only with the same resource, game scope, and createdAt sort.",
        schema: { type: "string", nullable: true },
    },
    {
        name: "sort",
        in: "query",
        description:
            "Stable creation order used by the opaque cursor. The only supported value is createdAt.",
        schema: { type: "string", enum: ["createdAt"], default: "createdAt" },
    },
]
const gameParameter = {
    name: "game",
    in: "query",
    description:
        "Game scope for game-owned records. Legacy keys may omit it for Hell Let Loose or use game=all. Keys with readAccess require an explicit permitted game or combination and cannot use all. Repeat game (for example game=hell_let_loose&game=wardogs) or use a comma-separated combination.",
    schema: {
        type: "string",
        enum: ["hell_let_loose", "hell_let_loose_vietnam", "wardogs", "all"],
        default: "hell_let_loose",
    },
    style: "form",
    explode: true,
}
const updatedSinceParameter = {
    name: "updatedSince",
    in: "query",
    description:
        "Only records updated at or after this ISO-8601 timestamp, for incremental synchronization.",
    schema: { type: "string", format: "date-time" },
}
const resources = [
    "server-snapshots",
    "integration-health",
    "event-summaries",
    "match-summaries",
    "result-summaries",
    "events",
    "groups",
    "rosters",
    "assignments",
    "calendar-items",
    "stratmaps",
    "topic-presets",
    "squad-presets",
    "matches",
    "articles",
    "users",
]
const resourceTags: Record<string, string> = {
    "server-snapshots": "Clan API — Game data",
    "integration-health": "Clan API — Game data",
    "event-summaries": "Clan API — Events",
    "match-summaries": "Clan API — Matches",
    "result-summaries": "Clan API — Matches",
    events: "Clan API — Events",
    groups: "Clan API — Groups",
    rosters: "Clan API — Rosters",
    assignments: "Clan API — Assignments",
    "calendar-items": "Clan API — Calendar",
    stratmaps: "Clan API — Stratmaps",
    "topic-presets": "Clan API — Topic presets",
    "squad-presets": "Clan API — Squad presets",
    matches: "Clan API — Matches",
    articles: "Clan API — Articles",
    users: "Clan API — Users",
}
const responses = {
    "200": {
        description:
            "Success. List responses use { data, page: { nextCursor, limit } }.",
        headers: {
            "RateLimit-Limit": { schema: { type: "integer", example: 300 } },
            "RateLimit-Remaining": { schema: { type: "integer" } },
            "RateLimit-Reset": {
                description: "Unix timestamp in seconds.",
                schema: { type: "integer" },
            },
        },
    },
    "400": {
        description: "Invalid request",
        content: {
            "application/json": {
                schema: error,
                example: {
                    error: {
                        code: "validation_error",
                        message: "name is required.",
                    },
                },
            },
        },
    },
    "401": {
        description: "Invalid API key",
        content: { "application/json": { schema: error } },
    },
    "403": {
        description:
            "insufficient_scope: the read-only key does not grant this resource, operation or game selection.",
        content: { "application/json": { schema: error } },
    },
    "404": {
        description: "Not found",
        content: { "application/json": { schema: error } },
    },
    "429": {
        description: "Rate limited",
        content: { "application/json": { schema: error } },
    },
}
const { "200": _genericSuccessResponse, ...nonSuccessResponses } = responses
type OpenApiOperation = { responses?: Record<string, unknown> }

function resourceSchemaName(resource: string) {
    return `Clan${resource
        .replace(
            /(^|-)([a-z])/g,
            (_, separator: string, letter: string) =>
                `${separator}${letter.toUpperCase()}`
        )
        .replace(/-/g, "")}Document`
}

function successResponse(resource: string, isList: boolean) {
    const document = {
        $ref: `#/components/schemas/${resourceSchemaName(resource)}`,
    }
    return {
        description: "Success",
        headers: responses["200"].headers,
        content: {
            "application/json": {
                schema: isList
                    ? {
                          type: "object",
                          required: ["data", "page"],
                          properties: {
                              data: { type: "array", items: document },
                              page: {
                                  type: "object",
                                  required: ["nextCursor", "limit"],
                                  properties: {
                                      nextCursor: { type: ["string", "null"] },
                                      limit: { type: "integer" },
                                  },
                              },
                          },
                      }
                    : {
                          type: "object",
                          required: ["data"],
                          properties: { data: document },
                      },
            },
        },
    }
}

function deletedResponse(resource: string) {
    return {
        description: `Deleted ${resource} record`,
        headers: responses["200"].headers,
        content: {
            "application/json": {
                schema: {
                    type: "object",
                    required: ["data"],
                    properties: {
                        data: {
                            type: "object",
                            required: ["id", "deleted"],
                            properties: {
                                id: { type: "string" },
                                deleted: { const: true },
                            },
                        },
                    },
                },
            },
        },
    }
}
const paths: Record<string, unknown> = {
    "/public/matches": {
        get: {
            summary: "List public matches",
            tags: ["Public API — no key required"],
            description:
                "Public, rate-limited match feed. No Authorization header is required. Omit game or use game=all for every game; repeat game for a combination.",
            parameters: [
                {
                    ...gameParameter,
                    description:
                        "Optional public game filter. Omit or use game=all for every game; repeat game to select a combination.",
                },
                {
                    name: "cursor",
                    in: "query",
                    schema: { type: "string", nullable: true },
                },
                {
                    name: "limit",
                    in: "query",
                    schema: { type: "integer", minimum: 1, maximum: 100 },
                },
            ],
            responses,
        },
    },
    "/public/matches/{eventId}": {
        get: {
            summary: "Get a public match",
            tags: ["Public API — no key required"],
            description:
                "Public, rate-limited match details. Use collection=playerStats for player statistics.",
            parameters: [
                {
                    name: "eventId",
                    in: "path",
                    required: true,
                    schema: { type: "string" },
                },
            ],
            responses,
        },
    },
    "/public/clans/{clanId}": {
        get: {
            summary: "Get a public clan profile",
            tags: ["Public API — no key required"],
            description:
                "Public, rate-limited clan profile, the data of the public clan page. Besides the profile and recentMatches it carries inviteUrl (the clan's own Discord invite as https://discord.gg/<code>, or null), games, upcomingMatches (announced, non-draft matches that have not started: eventId, gameId, startsAt, opponent, name, label; trainings, drafts, server details and sign-ups are never included), clanResults (recent recorded matches from the clan's side: outcome, clanScore, opponentScore, opponent, mapName) and competitions (placements in published competitions: slug, name, season, divisionName, position, teamCount; position is null before the division has a result). Use collection=recentMatches, upcomingMatches, clanResults or competitions for a paginated list.",
            parameters: [
                {
                    name: "clanId",
                    in: "path",
                    required: true,
                    schema: { type: "string" },
                },
            ],
            responses,
        },
    },
    "/public/players/{playerId}": {
        get: {
            summary: "Get a public player profile",
            tags: ["Public API — no key required"],
            description:
                "Public, rate-limited player profile. Use collection=clans or collection=recentMatches for related records.",
            parameters: [
                {
                    name: "playerId",
                    in: "path",
                    required: true,
                    schema: { type: "string" },
                },
            ],
            responses,
        },
    },
    "/public/competitions/{slug}": {
        get: {
            summary: "Get a public competition",
            tags: ["Public API — no key required"],
            description:
                "Public, rate-limited details of a published competition: its gameId, season, divisions with registered teams, and fixtures with results. Team IDs are global Logi team catalogue IDs, shared by every competition the team plays in (breaking change: they were Logi workspace IDs before). Teams carry name, shortCode and logoUrl (null when the team has none); fixtures reference them with teamAId and teamBId and carry an optional round number (missing on fixtures saved before rounds). An ID of the form guild:<id> marks a legacy record that has not been migrated yet. Unpublished and unknown competitions return 404. Use collection=divisions for a paginated division list.",
            parameters: [
                {
                    name: "slug",
                    in: "path",
                    required: true,
                    schema: {
                        type: "string",
                        pattern: "^[a-z0-9][a-z0-9-]{1,63}$",
                    },
                },
            ],
            responses: {
                ...responses,
                "200": {
                    description:
                        "The published competition (or a page of its divisions with collection=divisions).",
                    headers: responses["200"].headers,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                required: ["data"],
                                properties: {
                                    data: {
                                        oneOf: [
                                            {
                                                type: "object",
                                                required: [
                                                    "id",
                                                    "gameId",
                                                    "slug",
                                                    "name",
                                                    "season",
                                                    "description",
                                                    "divisions",
                                                ],
                                                properties: {
                                                    id: { type: "string" },
                                                    gameId: {
                                                        type: "string",
                                                        enum: [
                                                            "hell_let_loose",
                                                            "hell_let_loose_vietnam",
                                                            "wardogs",
                                                        ],
                                                    },
                                                    slug: { type: "string" },
                                                    name: { type: "string" },
                                                    season: { type: "string" },
                                                    description: {
                                                        type: [
                                                            "string",
                                                            "null",
                                                        ],
                                                    },
                                                    divisions: {
                                                        type: "array",
                                                        items: publicCompetitionDivisionSchema,
                                                    },
                                                },
                                            },
                                            {
                                                description:
                                                    "With collection=divisions: one page of divisions.",
                                                type: "object",
                                                required: [
                                                    "page",
                                                    "total",
                                                    "offset",
                                                    "limit",
                                                    "nextOffset",
                                                ],
                                                properties: {
                                                    page: {
                                                        type: "array",
                                                        items: publicCompetitionDivisionSchema,
                                                    },
                                                    total: { type: "integer" },
                                                    offset: { type: "integer" },
                                                    limit: { type: "integer" },
                                                    nextOffset: {
                                                        type: [
                                                            "integer",
                                                            "null",
                                                        ],
                                                    },
                                                },
                                            },
                                        ],
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
    },
    "/clan/meta": {
        get: {
            summary:
                "Get authenticated guild identity, enabled games, resource counts, API limits, and server time",
            description:
                "guild, enabledGames, updatedAt (the clan's sync marker), limits and serverTime are current on every call. counts come from the clan's stored summary, which Logi recomputes at most once a minute off the request path, so they can lag the clan's records by up to 60 seconds; computedAt says when they were computed. The first call after a deployment computes the summary before answering. Use counts as a hint for sweeps, never as proof that a record exists or is absent; the resource lists and /clan/changes stay authoritative.",
            tags: ["Clan API — Overview"],
            security: [{ clanApiKey: [] }],
            responses,
        },
    },
    "/clan/performance-history": {
        get: {
            summary:
                "Get stored clan performance history (up to ten matches per game)",
            tags: ["Clan API — Matches"],
            security: [{ clanApiKey: [] }],
            parameters: [gameParameter],
            responses,
        },
    },
}
/** Complete event records keep internal snapshot fields; summaries are the presentation contract. */
const completeEventRecordDescription =
    "Complete native event records for the events grant. When present, matchTeams holds the stored team assignments with their full snapshots ({teamId, slot, side, snapshot: {name, shortCode, logoAssetId, logoUrl, teamRevision, capturedAt}}); snapshot.logoAssetId is an internal image-asset record ID, not a URL, and grants nothing. Present teams from the minimized event-summaries or match-summaries matchTeams (ClanMatchTeam, logoUrl only). matchTeams is absent when no assignment was ever stored."
for (const resource of resources) {
    const gameDataDescription = [
        "server-snapshots",
        "integration-health",
    ].includes(resource)
        ? "Stored game-provider observations and sanitized collection health. Requires the matching resource grant and permitted game. No provider calls or controls are performed by these reads. IDs identify Logi connections. Unknown fields are null and zero is preserved. Stale at 180 seconds, unavailable at 900 seconds; errors can make data stale earlier. Freshness can change with time without a new updatedSince record. Not carried by /clan/changes: poll this collection for the current state. Live scores and imported sessions are not confirmed results. Source addresses, credentials and player identities are excluded."
        : undefined
    const isGameOwned = [
        "server-snapshots",
        "integration-health",
        "event-summaries",
        "match-summaries",
        "result-summaries",
        "events",
        "groups",
        "rosters",
        "assignments",
        "stratmaps",
        "matches",
    ].includes(resource)
    paths[`/clan/${resource}`] = {
        get: {
            summary: `List clan ${resource}`,
            ...(gameDataDescription
                ? { description: gameDataDescription }
                : {}),
            ...(resource.endsWith("-summaries")
                ? {
                      description:
                          "Allowlisted operational summaries. A separate matching readAccess resource grant is required for restricted keys. Website publication still requires its own approval. Match summaries use event IDs, exclude training events and report imported results as provisional; absent results remain unknown.",
                  }
                : {}),
            ...(resource === "events"
                ? { description: completeEventRecordDescription }
                : {}),
            ...(resource === "result-summaries"
                ? {
                      description:
                          "Reviewed event-result snapshots with independent result-summaries/game grants. States unknown, provisional, confirmed and corrected. Scores preserve null and zero and support 2-16 factions. Private player/reviewer identities, free-text reasons and source addresses are excluded. Confirmation/correction are account-session-only; bearer writes are unavailable. Publication remains consumer-owned.",
                  }
                : {}),
            tags: [resourceTags[resource]!],
            security: [{ clanApiKey: [] }],
            parameters: [
                ...pageParameters,
                updatedSinceParameter,
                ...(isGameOwned ? [gameParameter] : []),
            ],
            responses,
        },
    }
    const itemPath = [
        "matches",
        "match-summaries",
        "result-summaries",
    ].includes(resource)
        ? `/clan/${resource}/{eventId}`
        : `/clan/${resource}/{id}`
    paths[itemPath] = {
        get: {
            summary: [
                "matches",
                "match-summaries",
                "result-summaries",
            ].includes(resource)
                ? "Get match details for a clan event"
                : `Get a clan ${resource} record`,
            ...(gameDataDescription
                ? { description: gameDataDescription }
                : {}),
            ...(resource === "events"
                ? { description: completeEventRecordDescription }
                : {}),
            tags: [resourceTags[resource]!],
            security: [{ clanApiKey: [] }],
            parameters: [
                {
                    name: [
                        "matches",
                        "match-summaries",
                        "result-summaries",
                    ].includes(resource)
                        ? "eventId"
                        : "id",
                    in: "path",
                    required: true,
                    schema: { type: "string" },
                },
            ],
            responses,
        },
    }
}

const idempotencyParameter = {
    name: "Idempotency-Key",
    in: "header",
    required: true,
    description:
        "Use one new visible key for each write, for example `event-create-42`. Retrying the identical method, path, and body with that key replays the original status and body for 24 hours. Reusing it with a different request returns `409 idempotency_conflict`; generate a new key for that request.",
    schema: { type: "string", maxLength: 200, example: "event-create-42" },
}
// Settings fields and every feature settings slice (src/lib/api/settings-openapi.ts).
paths["/clan/settings"] = clanSettingsOpenApiPath({
    responses,
    idempotencyParameter,
})
paths["/clan/articles"] = {
    get: (paths["/clan/articles"] as { get: unknown }).get,
    post: {
        summary: "Create a clan article",
        tags: ["Clan API — Articles"],
        security: [{ clanApiKey: [] }],
        parameters: [idempotencyParameter],
        responses: {
            ...responses,
            "201": { description: "Created" },
            "409": { description: "Idempotency conflict" },
        },
    },
}
paths["/clan/articles/{id}"] = {
    get: (paths["/clan/articles/{id}"] as { get: unknown }).get,
    patch: {
        summary: "Update a clan article",
        tags: ["Clan API — Articles"],
        security: [{ clanApiKey: [] }],
        parameters: [
            {
                name: "id",
                in: "path",
                required: true,
                schema: { type: "string" },
            },
            idempotencyParameter,
        ],
        responses: {
            ...responses,
            "409": { description: "Idempotency conflict" },
        },
    },
    delete: {
        summary: "Delete a clan article",
        tags: ["Clan API — Articles"],
        security: [{ clanApiKey: [] }],
        parameters: [
            {
                name: "id",
                in: "path",
                required: true,
                schema: { type: "string" },
            },
            idempotencyParameter,
        ],
        responses: {
            ...responses,
            "409": { description: "Idempotency conflict" },
        },
    },
}

paths["/clan/events/{eventId}/signup"] = {
    post: {
        summary: "Set a clan member's event signup state",
        tags: ["Clan API — Events"],
        description:
            "Uses the same membership and registration rules as the dashboard. A successful change enqueues roster.updated webhooks.",
        security: [{ clanApiKey: [] }],
        parameters: [
            {
                name: "eventId",
                in: "path",
                required: true,
                schema: { type: "string" },
            },
            idempotencyParameter,
        ],
        requestBody: {
            required: true,
            content: {
                "application/json": {
                    schema: {
                        type: "object",
                        required: ["userId", "group"],
                        properties: {
                            userId: { type: "string" },
                            group: { type: ["string", "null"] },
                        },
                    },
                },
            },
        },
        responses: {
            ...responses,
            "409": { description: "Idempotency conflict" },
        },
    },
}

const eventMutation = {
    tags: ["Clan API — Events"],
    security: [{ clanApiKey: [] }],
    description:
        "Creates or updates a native event with a service key. matchTeams is read-only on these bearer-key writes: an API key alone is not a writing actor, so a matchTeams field in the body is ignored (a GET -> PATCH round trip stays valid) and the saved team assignments are kept. When gameId or kind changes, the kept assignments are re-validated: a match that becomes a training drops them unless it has concluded, and a game the saved teams no longer fit is 400 validation_error with the message match_teams:<code> (for example match_teams:team_game_mismatch). Assign, clear or refresh teams with the actor-backed POST /clan/event-commands (operations create, update and refresh_match_team) or in the Logi dashboard. The response and the event.created/event.updated webhooks carry the complete event record; its matchTeams snapshots include the internal logoAssetId, so present teams from the event-summaries or match-summaries matchTeams (ClanMatchTeam, logoUrl only).",
    parameters: [idempotencyParameter],
    requestBody: {
        required: true,
        content: {
            "application/json": {
                schema: {
                    type: "object",
                    required: [
                        "kind",
                        "name",
                        "registrationEnd",
                        "meetingStart",
                        "pingClan",
                    ],
                    properties: {
                        gameId: gameParameter.schema,
                        kind: { type: "string", enum: ["match", "training"] },
                        name: { type: "string", minLength: 1 },
                        map: {
                            type: "string",
                            description:
                                "Map or preset code; an empty string clears a map to TBD.",
                        },
                        timeOfDay: {
                            ...z.toJSONSchema(eventTimeOfDaySchema),
                            description:
                                "Planned map lighting. Empty clears; omission preserves the saved value on update.",
                        },
                        tacticalPlan: {
                            ...z.toJSONSchema(tacticalPlanSchema.nullable()),
                            description:
                                "Manual Wardogs plan for the selected map. Positions and zone radius/half-width are image percentages. Null clears; omission preserves unless the map changes.",
                        },
                        registrationStart: {
                            type: "string",
                            format: "date-time",
                            description:
                                "Optional time to publish Discord registration announcements. Omit for immediate publishing.",
                        },
                        registrationEnd: {
                            type: "string",
                            format: "date-time",
                        },
                        meetingStart: { type: "string", format: "date-time" },
                        gameStart: { type: "string", format: "date-time" },
                        gameEnd: { type: "string", format: "date-time" },
                        pingClan: { type: "boolean" },
                        signupGroupIds: {
                            type: "array",
                            items: { type: "string" },
                        },
                        topicPresetId: { type: "string" },
                        stratmapIds: {
                            type: "array",
                            items: { type: "string" },
                        },
                        signupGroupLimits: {
                            type: "array",
                            maxItems: 50,
                            description:
                                "Caps of offered signup groups (matches only); caps of groups not in signupGroupIds are dropped. A full group offers a reserve place instead. On PATCH, omitted keeps the saved caps and [] removes them. Lowering a cap below the current sign-ups removes nobody: players with a place keep it and only new sign-ups go to the reserve.",
                            items: {
                                type: "object",
                                additionalProperties: false,
                                required: ["groupId", "max"],
                                properties: {
                                    groupId: {
                                        type: "string",
                                        minLength: 1,
                                        maxLength: 64,
                                    },
                                    max: {
                                        type: "integer",
                                        minimum: 1,
                                        maximum: 100,
                                    },
                                },
                            },
                        },
                        attendanceReminderHours: {
                            type: "array",
                            maxItems: 4,
                            items: { type: "integer", enum: [24, 18, 12, 6] },
                            description:
                                "Hours before the meeting when unconfirmed roster players get an attendance DM. Missing on the event means all four. On PATCH, omitted keeps the saved offsets, [] sends none, and a change reschedules the reminders that have not been sent yet.",
                        },
                        createParticipantRoles: {
                            type: "boolean",
                            description:
                                "Whether the bot keeps attendee and reserve Discord roles for the event (missing means yes). Turning it off makes the bot delete the roles it created; on PATCH, omitted keeps the saved value.",
                        },
                        squadPresetId: {
                            type: "string",
                            maxLength: 64,
                            description:
                                "Squad preset of this clan that a new roster for the match starts from. It does not change a roster that already exists. On PATCH, omitted keeps the saved preset and an empty string removes it.",
                        },
                        matchTeams: {
                            readOnly: true,
                            description:
                                "Read-only on bearer-key writes and ignored when sent; the saved assignments are kept. Use POST /clan/event-commands to change them.",
                        },
                    },
                },
            },
        },
    },
    responses: {
        ...responses,
        "201": { description: "Created" },
        "409": { description: "Idempotency conflict" },
    },
}
paths["/clan/events"] = {
    get: (paths["/clan/events"] as { get: unknown }).get,
    post: { summary: "Create a clan event", ...eventMutation },
}
paths["/clan/events/{id}"] = {
    get: (paths["/clan/events/{id}"] as { get: unknown }).get,
    patch: { summary: "Update a clan event", ...eventMutation },
}
paths["/clan/events/{eventId}/actions/conclude"] = {
    post: {
        summary: "Conclude a clan event",
        tags: ["Clan API — Events"],
        description:
            "Applies the dashboard-equivalent conclude and roster scoring workflow.",
        security: [{ clanApiKey: [] }],
        parameters: [
            {
                name: "eventId",
                in: "path",
                required: true,
                schema: { type: "string" },
            },
            idempotencyParameter,
        ],
        responses: {
            ...responses,
            "409": { description: "Idempotency conflict" },
        },
    },
}

const groupMutation = {
    tags: ["Clan API — Groups"],
    security: [{ clanApiKey: [] }],
    parameters: [idempotencyParameter],
    requestBody: {
        required: true,
        content: {
            "application/json": {
                schema: {
                    type: "object",
                    required: ["name", "color", "order"],
                    properties: {
                        gameId: gameParameter.schema,
                        name: { type: "string" },
                        color: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
                        order: { type: "integer" },
                        parentId: { type: "string" },
                        description: { type: "string" },
                        discordRoleId: { type: "string" },
                        discordEmoji: { type: "string" },
                    },
                },
            },
        },
    },
    responses: {
        ...responses,
        "201": { description: "Created" },
        "409": { description: "Idempotency conflict" },
    },
}
paths["/clan/groups"] = {
    get: (paths["/clan/groups"] as { get: unknown }).get,
    post: { summary: "Create a clan group", ...groupMutation },
}
paths["/clan/groups/{id}"] = {
    get: (paths["/clan/groups/{id}"] as { get: unknown }).get,
    patch: {
        summary: "Update a clan group",
        ...groupMutation,
        parameters: [
            {
                name: "id",
                in: "path",
                required: true,
                schema: { type: "string" },
            },
            idempotencyParameter,
        ],
    },
    delete: {
        summary: "Delete a clan group and clear its assignment references",
        tags: ["Clan API — Groups"],
        security: [{ clanApiKey: [] }],
        parameters: [
            {
                name: "id",
                in: "path",
                required: true,
                schema: { type: "string" },
            },
            idempotencyParameter,
        ],
        responses: {
            ...responses,
            "409": { description: "Idempotency conflict" },
        },
    },
}

const calendarItemMutation = {
    tags: ["Clan API — Calendar"],
    security: [{ clanApiKey: [] }],
    parameters: [idempotencyParameter],
    requestBody: {
        required: true,
        content: {
            "application/json": {
                schema: {
                    type: "object",
                    required: ["title", "color", "startAt", "endAt", "allDay"],
                    properties: {
                        title: { type: "string" },
                        description: { type: "string" },
                        color: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
                        emoji: { type: "string" },
                        label: { type: "string" },
                        startAt: { type: "string", format: "date-time" },
                        endAt: { type: "string", format: "date-time" },
                        allDay: { type: "boolean" },
                        recurrence: {
                            type: "object",
                            properties: {
                                frequency: {
                                    type: "string",
                                    enum: [
                                        "weekly",
                                        "monthly_date",
                                        "monthly_nth_weekday",
                                        "yearly",
                                    ],
                                },
                                interval: { type: "integer", minimum: 1 },
                                until: { type: "string", format: "date-time" },
                            },
                        },
                    },
                },
            },
        },
    },
    responses: {
        ...responses,
        "201": { description: "Created" },
        "409": { description: "Idempotency conflict" },
    },
}
paths["/clan/calendar-items"] = {
    get: (paths["/clan/calendar-items"] as { get: unknown }).get,
    post: { summary: "Create a calendar item", ...calendarItemMutation },
}
paths["/clan/calendar-items/{id}"] = {
    get: (paths["/clan/calendar-items/{id}"] as { get: unknown }).get,
    patch: {
        summary: "Update a calendar item",
        ...calendarItemMutation,
        parameters: [
            {
                name: "id",
                in: "path",
                required: true,
                schema: { type: "string" },
            },
            idempotencyParameter,
        ],
    },
    delete: {
        summary: "Delete a calendar item",
        tags: ["Clan API — Calendar"],
        security: [{ clanApiKey: [] }],
        parameters: [
            {
                name: "id",
                in: "path",
                required: true,
                schema: { type: "string" },
            },
            idempotencyParameter,
        ],
        responses: {
            ...responses,
            "409": { description: "Idempotency conflict" },
        },
    },
}

const assignmentMutation = {
    tags: ["Clan API — Assignments"],
    security: [{ clanApiKey: [] }],
    parameters: [idempotencyParameter],
    requestBody: {
        required: true,
        content: {
            "application/json": {
                schema: {
                    type: "object",
                    required: [
                        "userId",
                        "type",
                        "status",
                        "secondaryGroupIds",
                        "paused",
                    ],
                    properties: {
                        gameId: gameParameter.schema,
                        userId: { type: "string" },
                        type: {
                            type: "string",
                            enum: ["member", "reserve_member", "mercenary"],
                        },
                        status: {
                            type: "string",
                            enum: ["pending", "recruit", "active"],
                        },
                        primaryGroupId: { type: "string" },
                        secondaryGroupIds: {
                            type: "array",
                            items: { type: "string" },
                        },
                        paused: { type: "boolean" },
                        pausedNote: { type: "string" },
                    },
                },
            },
        },
    },
    responses: {
        ...responses,
        "201": { description: "Created" },
        "409": { description: "Idempotency conflict" },
    },
}
paths["/clan/assignments"] = {
    get: (paths["/clan/assignments"] as { get: unknown }).get,
    post: {
        summary:
            "Create a clan assignment and synchronize membership/roster state",
        ...assignmentMutation,
    },
}
paths["/clan/assignments/{id}"] = {
    get: (paths["/clan/assignments/{id}"] as { get: unknown }).get,
    patch: {
        summary:
            "Update a clan assignment without moving it to another user or game",
        ...assignmentMutation,
        parameters: [
            {
                name: "id",
                in: "path",
                required: true,
                schema: { type: "string" },
            },
            idempotencyParameter,
        ],
    },
    delete: {
        summary:
            "Delete a clan assignment and synchronize membership/roster state",
        tags: ["Clan API — Assignments"],
        security: [{ clanApiKey: [] }],
        parameters: [
            {
                name: "id",
                in: "path",
                required: true,
                schema: { type: "string" },
            },
            idempotencyParameter,
        ],
        responses: {
            ...responses,
            "409": { description: "Idempotency conflict" },
        },
    },
}

const rosterMutation = {
    tags: ["Clan API — Rosters"],
    security: [{ clanApiKey: [] }],
    parameters: [idempotencyParameter],
    requestBody: {
        required: true,
        content: {
            "application/json": {
                schema: {
                    type: "object",
                    required: [
                        "eventId",
                        "squads",
                        "reservePlayerIds",
                        "notAttendingPlayerIds",
                        "published",
                    ],
                    properties: {
                        eventId: { type: "string" },
                        squadPresetId: { type: "string" },
                        squads: {
                            type: "array",
                            description:
                                "Complete squad layout. The order field controls squad order; each section is positioned by its first squad. Changing group moves a whole squad between sections without changing its players. Reassign a player by updating players and removing that ID from reserves or their previous slot.",
                            items: {
                                type: "object",
                                required: [
                                    "name",
                                    "group",
                                    "order",
                                    "color",
                                    "players",
                                ],
                                properties: {
                                    name: { type: "string" },
                                    group: { type: "string" },
                                    order: { type: "number" },
                                    color: { type: "string" },
                                    icon: { type: "string" },
                                    players: {
                                        type: "array",
                                        items: {
                                            type: "object",
                                            required: ["ack"],
                                            properties: {
                                                id: { type: "string" },
                                                customName: { type: "string" },
                                                ack: { type: "boolean" },
                                                confirmed: { type: "boolean" },
                                                note: { type: "string" },
                                                roleName: { type: "string" },
                                                roleIcon: { type: "string" },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                        reservePlayerIds: {
                            type: "array",
                            items: { type: "string" },
                        },
                        reserveAttendances: { type: "array" },
                        notAttendingPlayerIds: {
                            type: "array",
                            items: { type: "string" },
                        },
                        streamerId: { type: "string" },
                        published: { type: "boolean" },
                    },
                },
            },
        },
    },
    responses: { ...responses, "409": { description: "Idempotency conflict" } },
}
paths["/clan/rosters/{id}"] = {
    get: (paths["/clan/rosters/{id}"] as { get: unknown }).get,
    patch: {
        summary:
            "Update a clan roster using its complete dashboard-equivalent form",
        ...rosterMutation,
        parameters: [
            {
                name: "id",
                in: "path",
                required: true,
                schema: { type: "string" },
            },
            idempotencyParameter,
        ],
    },
    delete: {
        summary: "Delete an unpublished clan roster",
        tags: ["Clan API — Rosters"],
        security: [{ clanApiKey: [] }],
        parameters: [
            {
                name: "id",
                in: "path",
                required: true,
                schema: { type: "string" },
            },
            idempotencyParameter,
        ],
        responses: {
            ...responses,
            "409": { description: "Idempotency conflict" },
        },
    },
}

const presetMutation = {
    security: [{ clanApiKey: [] }],
    parameters: [idempotencyParameter],
    requestBody: {
        required: true,
        content: {
            "application/json": {
                schema: {
                    type: "object",
                    description:
                        "Use the complete dashboard-equivalent preset form. Stratmap eventId references must belong to this clan and use the stratmap's game. Wardogs match map codes use bakurani, ozeti, or zestafona with KOTH as the only mode; its sides are Valkyra, Lonestar, and Manticore.",
                },
            },
        },
    },
    responses: {
        ...responses,
        "201": { description: "Created" },
        "409": { description: "Idempotency conflict" },
    },
}
for (const resource of ["stratmaps", "topic-presets", "squad-presets"]) {
    paths[`/clan/${resource}`] = {
        get: (paths[`/clan/${resource}`] as { get: unknown }).get,
        post: {
            summary: `Create a clan ${resource.slice(0, -1)}`,
            tags: [resourceTags[resource]!],
            ...presetMutation,
        },
    }
    paths[`/clan/${resource}/{id}`] = {
        get: (paths[`/clan/${resource}/{id}`] as { get: unknown }).get,
        patch: {
            summary: `Update a clan ${resource.slice(0, -1)}`,
            tags: [resourceTags[resource]!],
            ...presetMutation,
            parameters: [
                {
                    name: "id",
                    in: "path",
                    required: true,
                    schema: { type: "string" },
                },
                idempotencyParameter,
            ],
        },
    }
}

// The CRUD read models return Convex documents through apiDocument(). Keep the
// field-level response contract tied to convex/schema.ts and the explicit
// domain DTO schemas rather than a second hand-maintained list in this route.
for (const resource of resources) {
    const collection = paths[`/clan/${resource}`] as {
        get?: OpenApiOperation
    }
    if (collection.get)
        collection.get.responses = {
            ...responses,
            "200": successResponse(resource, true),
        }
    const itemPath = [
        "matches",
        "match-summaries",
        "result-summaries",
    ].includes(resource)
        ? `/clan/${resource}/{eventId}`
        : `/clan/${resource}/{id}`
    const item = paths[itemPath] as { get?: OpenApiOperation }
    if (item.get)
        item.get.responses = {
            ...responses,
            "200": successResponse(resource, false),
        }

    const create = paths[`/clan/${resource}`] as {
        post?: OpenApiOperation
    }
    if (create.post) {
        create.post.responses = {
            ...nonSuccessResponses,
            "201": {
                ...successResponse(resource, false),
                description: `Created ${resource} record`,
            },
        }
    }
    const mutation = paths[itemPath] as {
        patch?: OpenApiOperation
        delete?: OpenApiOperation
    }
    if (mutation.patch)
        mutation.patch.responses = {
            ...responses,
            "200": successResponse(resource, false),
        }
    if (mutation.delete)
        mutation.delete.responses = {
            ...responses,
            "200": deletedResponse(resource),
        }
}

const syncParameters = [
    {
        ...gameParameter,
        required: true,
        description:
            "Exactly one explicit permitted game. No legacy or game=all fallback.",
        schema: {
            type: "string",
            enum: ["hell_let_loose", "hell_let_loose_vietnam", "wardogs"],
        },
    },
]
paths["/clan/changes"] = {
    get: {
        tags: ["Clan API — Synchronization"],
        security: [{ clanApiKey: [] }],
        summary: "Read scoped transactional invalidations",
        description:
            "Requires explicit underlying read grants. Obtain start=now before a baseline sweep and keep resources and game fixed. Logi intentionally retains no mutation replay log: any cursor returns 410 reset_required and requires a new baseline. Revisions are canonical decimal strings (compare as integers). Webhooks can notify consumers, but each consumer owns outage recovery. server-snapshots and integration-health are still accepted but are never notified: they are live state, read from /clan/server-snapshots and /clan/integration-health. A league-fixtures change is notified only when the served fixture changes, not when only its revision, stale, ageSeconds, lastAttemptAt or snapshot fetchedAt moved. The teams resource exists only for hell_let_loose and wardogs; requesting it with another game (alone or with other resources) is 400 invalid_query, not an empty page.",
        parameters: [
            ...syncParameters,
            {
                name: "subject",
                in: "query",
                description:
                    "Required exactly once when resources includes membership-summaries; forbidden otherwise. One Discord user ID. Requires an enabled per-key role policy. The signed cursor binds this subject and resets after policy or guild epoch changes; no membership enumeration.",
                schema: { type: "string", pattern: "^[0-9]{17,20}$" },
            },
            {
                name: "resources",
                in: "query",
                required: true,
                description: `Comma-separated subset of ${SYNC_RESOURCES.join(", ")}.`,
                schema: { type: "string" },
            },
            {
                name: "start",
                in: "query",
                schema: { type: "string", enum: ["now"] },
            },
            {
                name: "cursor",
                in: "query",
                description:
                    "Use exactly one of cursor or start=now. Bound to key, guild, game and resources.",
                schema: { type: "string", maxLength: 4096 },
            },
            pageParameters[0],
        ],
        responses: {
            ...responses,
            "410": {
                description: "reset_required: cursor replay is not retained",
                content: { "application/json": { schema: error } },
            },
            "200": {
                description:
                    "Filtered change page and next polling/continuation cursor",
                content: {
                    "application/json": {
                        schema: {
                            type: "object",
                            required: ["data", "page"],
                            additionalProperties: false,
                            properties: {
                                data: {
                                    type: "array",
                                    items: {
                                        $ref: "#/components/schemas/IntegrationChange",
                                    },
                                },
                                page: {
                                    type: "object",
                                    required: [
                                        "nextCursor",
                                        "hasMore",
                                        "limit",
                                    ],
                                    additionalProperties: false,
                                    properties: {
                                        nextCursor: { type: "string" },
                                        hasMore: { type: "boolean" },
                                        limit: {
                                            type: "integer",
                                            minimum: 1,
                                            maximum: 100,
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
    },
}
paths["/clan/sync-records/{resource}/{id}"] = {
    get: {
        tags: ["Clan API — Synchronization"],
        security: [{ clanApiKey: [] }],
        summary: "Atomically read a safe projection and its revision",
        description:
            "Requires an explicit grant for the underlying resource and game. Returns the current upsert projection. Logi keeps no removal tombstones: removed, unknown and foreign IDs return 404. Dynamic freshness is computed at read time, so consumers must also enforce observedAt age; passage of time does not emit an invalidation. server-snapshots and integration-health records stay readable here, but the change feed no longer announces them; read their current state from /clan/server-snapshots and /clan/integration-health.",
        parameters: [
            ...syncParameters,
            {
                name: "resource",
                in: "path",
                required: true,
                schema: { type: "string", enum: [...SYNC_RESOURCES] },
            },
            {
                name: "id",
                in: "path",
                required: true,
                schema: { type: "string" },
            },
        ],
        responses: {
            ...responses,
            "200": {
                description: "Atomic current projection",
                content: {
                    "application/json": {
                        schema: {
                            type: "object",
                            required: ["data"],
                            additionalProperties: false,
                            properties: {
                                data: {
                                    $ref: "#/components/schemas/IntegrationSyncRecord",
                                },
                            },
                        },
                    },
                },
            },
        },
    },
}

paths["/clan/membership-summaries/{discordUserId}"] = {
    get: {
        tags: ["Clan API — Membership"],
        security: [{ clanApiKey: [] }],
        summary: "Observe one member with explicit game and role permissions",
        description:
            "Requires an explicit membership-summaries read grant AND enabled per-key role policy configured by a signed-in server administrator. Legacy full-access keys are denied. No collection endpoint exists. Returns only allowlisted role IDs and an independent Logi assignment. Default maximum observation age is 60 seconds (configurable 1–300 seconds); receivedAt does not confer freshness. Stale, unavailable, rate-limited or invalidated observations have state=unknown, completeness=unavailable and no roles. Only Discord Unknown Member proves absence. Direct refresh rechecks stored key and policy after the network wait. Always no-store; consumers must enforce observedAt age at authorization time. This endpoint never grants website privileges. Policy management deliberately has no bearer-key write API.",
        parameters: [
            ...syncParameters,
            {
                name: "discordUserId",
                in: "path",
                required: true,
                schema: { type: "string", pattern: "^[0-9]{17,20}$" },
            },
            {
                name: "maxAgeMs",
                in: "query",
                schema: {
                    type: "integer",
                    minimum: 1000,
                    maximum: 300000,
                    default: 60000,
                },
            },
        ],
        responses: {
            ...responses,
            "503": {
                description:
                    "Membership storage unavailable; deny protected access",
                content: { "application/json": { schema: error } },
            },
            "200": {
                description:
                    "Exact scoped observation; unavailable is an explicit state",
                content: {
                    "application/json": {
                        schema: {
                            type: "object",
                            required: ["data"],
                            additionalProperties: false,
                            properties: {
                                data: {
                                    $ref: "#/components/schemas/MembershipObservation",
                                },
                            },
                        },
                    },
                },
            },
        },
    },
}

paths["/clan/league-fixtures"] = {
    get: {
        tags: ["Clan API — Matches"],
        summary: "List this guild's tracked Wardogs League fixtures",
        description:
            "Requires explicit league-fixtures and wardogs grants. Bounded collection of automatically watched or explicitly included fixtures, with optional native event binding, source provenance and independent freshness. Unknown results remain null. Use the collection as the baseline and sync-records with resource league-fixtures for current details; Logi retains no update/removal replay log. A fixture ID is the external League match ID, not a native event ID. Administration, channel selection and native-event binding require a current dashboard administrator; service keys cannot grant or alter tracking policy. Native event writes retain their separate actor-backed event-commands contract. Responses are no-store.",
        security: [{ clanApiKey: [] }],
        "x-logi-read-access": {
            resource: "league-fixtures",
            games: ["wardogs"],
            explicitGrantRequired: true,
        },
        parameters: [
            {
                name: "game",
                in: "query",
                required: true,
                schema: { type: "string", enum: ["wardogs"] },
            },
            {
                name: "limit",
                in: "query",
                schema: {
                    type: "integer",
                    minimum: 1,
                    maximum: 100,
                    default: 50,
                },
            },
            {
                name: "cursor",
                in: "query",
                schema: { type: "string", maxLength: 4096 },
            },
        ],
        responses: {
            "200": {
                description:
                    "Tracked fixture page, including explicitly stale snapshots",
                content: {
                    "application/json": {
                        schema: {
                            type: "object",
                            required: ["data"],
                            properties: {
                                data: {
                                    type: "object",
                                    required: ["items", "nextCursor"],
                                    properties: {
                                        items: {
                                            type: "array",
                                            items: {
                                                $ref: "#/components/schemas/LeagueFixture",
                                            },
                                        },
                                        nextCursor: {
                                            type: ["string", "null"],
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
            "400": { description: "Invalid game or pagination" },
            "401": { description: "Invalid or revoked key" },
            "403": { description: "Missing explicit grant" },
            "429": { description: "API rate limit" },
            "503": { description: "Read unavailable" },
        },
    },
}
paths["/clan/league-fixtures/overview"] = {
    get: {
        tags: ["Clan API — Matches"],
        summary:
            "Read the whole Wardogs League as the WD League panels show it",
        description:
            "Requires explicit league-fixtures and wardogs grants (the same grant as the tracked collection). Website parity of the two WD League Discord panels: `standings` is the table of the current season (calendar year in Europe/Prague) that Logi computes from League placements with the points rule published on each match page (1st 3 · 2nd 2 · 3rd 1 by default), sorted by points, then 1st, 2nd and 3rd places, then fewer matches; teams equal on all of these share the rank. Until the first result of the season exists `standings.state` is waiting_for_results. `fixtures` lists the nearest live and upcoming fixtures of the whole League (not only the clan's) with teams, nationality, member count, faction, map, host and League preparation chips (rules, map vote, moderator, ready check; done/running/pending), plus the podiums of the last seven days. `fixtures.recentResults.state` is waiting_for_results until Logi has collected any League result and ready afterwards; an empty `items` list in the ready state means the League had no results in those seven days. Results are read from wardogsleague.net and are not verified by Logi; the parser does not read placements yet, so results stay empty until it does. `ours` marks this guild's watched team codes. Data is shared across guilds and refreshed by a one-minute collector through the shared five-minute detail cache; `stale` marks shown fixtures whose last read failed or is older than fifteen minutes. Panel placement, posting and refreshing in Discord are live Discord actions and are not part of the API. Responses are no-store.",
        security: [{ clanApiKey: [] }],
        "x-logi-read-access": {
            resource: "league-fixtures",
            games: ["wardogs"],
            explicitGrantRequired: true,
        },
        parameters: [
            {
                name: "game",
                in: "query",
                required: true,
                schema: { type: "string", enum: ["wardogs"] },
            },
            {
                name: "limit",
                in: "query",
                description:
                    "Nearest fixtures to return (the panel default is 6).",
                schema: {
                    type: "integer",
                    minimum: 1,
                    maximum: PANEL_WINDOW,
                    default: DEFAULT_LEAGUE_PANEL_OPTIONS.fixtureCount,
                },
            },
        ],
        responses: {
            "200": {
                description:
                    "League table, nearest fixtures and recent results",
                content: {
                    "application/json": {
                        schema: {
                            type: "object",
                            required: ["data"],
                            properties: {
                                data: {
                                    $ref: "#/components/schemas/LeagueOverview",
                                },
                            },
                        },
                    },
                },
            },
            "400": { description: "Invalid game or limit" },
            "401": { description: "Invalid or revoked key" },
            "403": { description: "Missing explicit grant" },
            "429": { description: "API rate limit" },
            "503": { description: "Read unavailable" },
        },
    },
}
const teamGames = [...TEAM_GAMES]
const teamGameParameter = {
    name: "game",
    in: "query",
    required: true,
    description:
        "Exactly one catalogue game. No legacy default, game=all or combination; Hell Let Loose: Vietnam has no team catalogue.",
    schema: { type: "string", enum: teamGames },
}
const teamReadAccess = {
    resource: "teams",
    games: teamGames,
    explicitGrantRequired: true,
}
const teamErrorResponse = (description: string) => ({
    description,
    content: { "application/json": { schema: error } },
})
const teamReadResponses = {
    "400": teamErrorResponse(
        "invalid_query: the key's grant allows the request but the route rejects it: combined or repeated game, a game without a team catalogue, unknown or repeated parameters, invalid pagination or a malformed team ID; on the detail read also a missing game or game=all"
    ),
    "401": teamErrorResponse(
        "missing_api_key or invalid_api_key: missing, invalid or revoked API key"
    ),
    "403": teamErrorResponse(
        "insufficient_scope: no explicit teams grant for the requested game(s), or a legacy broad key; on the collection the gateway also refuses a missing or empty game, game=all and unknown game values"
    ),
    "429": teamErrorResponse(
        "rate_limited: API rate limit; respect Retry-After"
    ),
    "503": teamErrorResponse("unavailable: catalogue read failed"),
}
paths["/clan/teams"] = {
    get: {
        tags: ["Clan API — Teams"],
        summary: "List the global catalogue's active teams for one game",
        description:
            "Requires an explicit teams grant for the requested game. The team catalogue is global: Logi's global administrators own one catalogue per game (hell_let_loose or wardogs), no workspace owns or keeps a private team list, and every workspace whose key holds the grant reads the same teams. The key supplies the workspace and must still belong to the workspace that authenticated the request; the caller cannot choose another one, and Convex rechecks key revocation, workspace and game grants on every read. Exactly one supported game is required and pagination is validated: limit 1–100 (default 50), opaque cursor at most 4,096 characters, no other parameters. Returns active teams ordered by normalized name as minimized DTOs (stable global catalogue ID, game, name, short code, public logo URL, description, up to three https links, revision, updated time) with absent optional values as null and links as an array; archived and merged teams are excluded. Use the collection as the baseline and sync-records with resource teams for current details; Logi does not retain a per-workspace change log. Legacy broad keys do not acquire this resource. Catalogue writes (create, edit, archive, restore, link, merge), logo uploads and team requests (submission, cancellation and moderation decisions) are session-bound Logi administration and deliberately have no bearer-key API (documented API-parity exception). Teams selected for a native match travel as immutable matchTeams snapshots (ClanMatchTeam) inside the event-summaries and match-summaries documents; those keep the captured ID, labels and logo after a team is archived or merged, and receiving them does not grant the catalogue. Responses are no-store.",
        security: [{ clanApiKey: [] }],
        "x-logi-read-access": teamReadAccess,
        parameters: [
            teamGameParameter,
            {
                name: "limit",
                in: "query",
                schema: {
                    type: "integer",
                    minimum: 1,
                    maximum: TEAM_PAGE_MAX,
                    default: 50,
                },
            },
            {
                name: "cursor",
                in: "query",
                description:
                    "Opaque nextCursor from the previous page, signed for this workspace and game. A cursor Logi did not issue for the same workspace and game is 400 invalid_query.",
                schema: { type: "string", maxLength: 4096 },
            },
        ],
        responses: {
            "200": {
                description: "Active catalogue page for one game",
                content: {
                    "application/json": {
                        schema: {
                            type: "object",
                            required: ["data"],
                            additionalProperties: false,
                            properties: {
                                data: {
                                    $ref: "#/components/schemas/ClanTeamPage",
                                },
                            },
                        },
                    },
                },
            },
            ...teamReadResponses,
        },
    },
}
paths["/clan/teams/{id}"] = {
    get: {
        tags: ["Clan API — Teams"],
        summary: "Read one active catalogue team",
        description:
            "Requires the same explicit teams grant and exactly one supported game, rechecked inside Convex. The ID is a stable global catalogue team ID from the collection, a teams change, a matchTeams snapshot or a public competition; it is never a Discord guild or League identifier. Unknown, archived, merged and other-game IDs return a generic 404 without labels; the merge target is not disclosed, so a matchTeams snapshot whose team was merged keeps its captured presentation. Returns one minimized ClanTeam. Responses are no-store.",
        security: [{ clanApiKey: [] }],
        "x-logi-read-access": teamReadAccess,
        parameters: [
            {
                name: "id",
                in: "path",
                required: true,
                description:
                    "Opaque global catalogue team ID: 1–64 letters, digits, underscores or hyphens.",
                schema: {
                    type: "string",
                    minLength: 1,
                    maxLength: 64,
                    pattern: "^[A-Za-z0-9_-]+$",
                },
            },
            teamGameParameter,
        ],
        responses: {
            "200": {
                description: "Active catalogue team",
                content: {
                    "application/json": {
                        schema: {
                            type: "object",
                            required: ["data"],
                            additionalProperties: false,
                            properties: {
                                data: {
                                    $ref: "#/components/schemas/ClanTeam",
                                },
                            },
                        },
                    },
                },
            },
            ...teamReadResponses,
            "404": teamErrorResponse(
                "not_found: unknown, archived, merged or other-game team"
            ),
        },
    },
}
paths["/clan/league-matches"] = {
    get: {
        tags: ["Clan API — Matches"],
        summary: "Preview a public Wardogs League match URL",
        description:
            "Requires explicit league-matches and wardogs read grants; legacy keys are denied. Reads anonymous server-rendered HTML only, with no Team API key, cookies or browser. URL must be HTTPS wardogsleague.net/matches/{id}, without credentials/query/fragment. Shared cache by match ID for five minutes, 20 origin requests/minute and a shared Retry-After cooldown. Data is public and cached across authorized clans. On refresh failures a last valid snapshot returns HTTP 200 with stale=true, its original fetchedAt, ageSeconds and an error; with no snapshot returns 429 or 503. Consumers should poll no faster than 5–10 minutes and respect nextRefreshAt/Retry-After. Missing values are null. Displayed membership is not a match roster. Only Scheduled HTML has live acceptance evidence; results remain null and unverified states generate warnings. No event/result creation, server passwords, join IDs or authenticated League data. Reads are not emitted in the changes feed. Timestamps use UTC ISO 8601; dashboard renders Europe/Prague. Response is always no-store to consumers.",
        security: [{ clanApiKey: [] }],
        "x-logi-read-access": {
            resource: "league-matches",
            games: ["wardogs"],
            explicitGrantRequired: true,
        },
        parameters: [
            {
                name: "game",
                in: "query",
                required: true,
                schema: { type: "string", enum: ["wardogs"] },
            },
            {
                name: "url",
                in: "query",
                required: true,
                schema: { type: "string", format: "uri", maxLength: 125 },
                description:
                    "Public detail URL; duplicate or unknown parameters are rejected.",
            },
        ],
        responses: {
            "200": {
                description: "Fresh or explicitly stale last-valid match",
                content: {
                    "application/json": {
                        schema: {
                            type: "object",
                            required: ["data"],
                            properties: {
                                data: {
                                    $ref: "#/components/schemas/LeagueMatchRead",
                                },
                            },
                        },
                    },
                },
            },
            "400": { description: "Invalid URL or query" },
            "401": { description: "Missing, invalid or revoked API key" },
            "403": { description: "Missing explicit Wardogs League grant" },
            "429": {
                description:
                    "No cached snapshot; shared or upstream rate limit. Retry-After and data.nextRefreshAt apply.",
            },
            "503": {
                description:
                    "No cached snapshot; source or refresh unavailable. Retry metadata is included when known.",
            },
        },
    },
}
paths["/clan/hll-live/{connectionId}"] = {
    get: {
        tags: ["Game data"],
        summary: "Read the current HLL round and connected-player scoreboard",
        "x-logi-read-access": {
            resource: "hll-live",
            games: ["hell_let_loose"],
            explicitGrantRequired: true,
        },
        description:
            "Requires explicit hll-live and hell_let_loose readAccess grants; legacy and aggregate server-snapshots keys are denied. Uses an enabled Logi connection ID, never a provider address. Includes game display names and provider player IDs, not verified Logi membership or lifetime statistics. Status and players have independent timestamps/freshness. Disconnected players are excluded; missing metrics remain null. Unknown or changing round identity suppresses player rows. A failed player read preserves aggregate status; status failure can return clearly stale last-known status with no players. Always no-store to consumers. Reads share a persisted per-connection cache/lease and respect upstream refresh interval and Retry-After; source, key and panel revocation are rechecked after network access. No query parameters. No administration URLs, credentials, raw Steam profiles or ban data are returned.",
        parameters: [
            {
                name: "connectionId",
                in: "path",
                required: true,
                schema: { type: "string" },
            },
        ],
        responses: {
            "200": {
                description:
                    "Typed observations; inspect freshness and warnings",
                content: {
                    "application/json": {
                        schema: {
                            type: "object",
                            properties: {
                                data: {
                                    $ref: "#/components/schemas/HllLiveEnvelope",
                                },
                            },
                        },
                    },
                },
            },
            "400": { description: "Unexpected query parameters" },
            "401": { description: "Invalid API key" },
            "403": {
                description:
                    "Explicit resource/game grant or enabled source missing",
            },
            "429": {
                description:
                    "A read is already in progress or provider backoff applies; Retry-After is returned",
            },
            "503": { description: "Read unavailable" },
        },
    },
}
paths["/clan/warcon-data/{connectionId}"] = {
    get: {
        tags: ["Clan API — Game data"],
        security: [{ clanApiKey: [] }],
        summary: "Read Warcon gameplay data for one configured connection",
        description:
            "Requires explicit warcon-data and wardogs readAccess grants. Legacy keys are denied. Includes game display names and Steam IDs; never treat these as verified Logi identity or membership. Uses a Logi connection ID from server-snapshots, not the panel UUID or game join code. Only an enabled, matching guild/game/source is readable. Credential provisioning and connection enable/disable are operator/session-only operations. Live includes per-player K/D, cash, ping and separate status/player timestamps and freshness. Closed match detail is null for an unfinished or missing match. Kills exposes configured=false when the upstream feed is disabled; this API never enables it. Career requires a Warcon key restricted to exactly this one server, because upstream career otherwise aggregates its visible organisation. Unknown/admin fields are stripped. Always no-store to consumers. Logi shares a 10-second live cache, 15-second kills cache, 5-minute catalog/capabilities cache and 60-second cache for other views. Provider misses share a 30/minute/connection budget and a lease. Authorization and configuration are rechecked after fetch. On errors return 429/503, never stale data relabeled as live. See WarconQuery for the closed, view-specific parameter combinations: unknown, duplicate and inapplicable parameters are rejected. Warcon reads use polling and are not part of the change feed; reviewed results retain their existing change feed.",
        "x-logi-query-schema": "#/components/schemas/WarconQuery",
        parameters: [
            {
                name: "connectionId",
                in: "path",
                required: true,
                schema: { type: "string" },
            },
            {
                name: "game",
                in: "query",
                required: true,
                schema: { type: "string", const: "wardogs" },
            },
            {
                name: "view",
                in: "query",
                required: true,
                schema: {
                    type: "string",
                    enum: warconQuerySchema.options.map(
                        (option) => option.shape.view.value
                    ),
                },
            },
            {
                name: "range",
                in: "query",
                description:
                    "analytics: 24h (default), 7d, 30d; leaderboard: 7d, 30d (default), 90d, all",
                schema: {
                    type: "string",
                    enum: ["24h", "7d", "30d", "90d", "all"],
                },
            },
            {
                name: "page",
                in: "query",
                description:
                    "matches/leaderboard only; 50 upstream rows per page",
                schema: {
                    type: "integer",
                    minimum: 1,
                    maximum: 100000,
                    default: 1,
                },
            },
            {
                name: "matchId",
                in: "query",
                description: "Required for view=match",
                schema: { type: "string", pattern: "^[1-9][0-9]{0,14}$" },
            },
            {
                name: "steamId",
                in: "query",
                description: "Required for view=career",
                schema: { type: "string", pattern: "^7656119[0-9]{10}$" },
            },
            {
                name: "sort",
                in: "query",
                description:
                    "Leaderboard: kills, deaths, kd, perHour, playtime, seeded, matches, wins, winRate, cash. Players: lastSeen, firstSeen, minutes, sessions, kills, deaths, name.",
                schema: { type: "string" },
            },
            {
                name: "dir",
                in: "query",
                schema: {
                    type: "string",
                    enum: ["asc", "desc"],
                    default: "desc",
                },
            },
            {
                name: "minMinutes",
                in: "query",
                description: "Leaderboard playtime floor",
                schema: {
                    type: "integer",
                    minimum: 0,
                    maximum: 100000,
                    default: 60,
                },
            },
            {
                name: "q",
                in: "query",
                description: "Seen-player name or Steam ID search",
                schema: { type: "string", maxLength: 100 },
            },
            {
                name: "since",
                in: "query",
                description:
                    "Players: last N days, 0=all. Cash: ISO timestamp, defaults to last hour, upstream clamps to 24 hours and newest 3000 samples.",
                schema: {
                    oneOf: [
                        { type: "integer", minimum: 0, maximum: 3650 },
                        { type: "string", format: "date-time" },
                    ],
                },
            },
            {
                name: "offset",
                in: "query",
                description: "Seen players only",
                schema: {
                    type: "integer",
                    minimum: 0,
                    maximum: 1000000,
                    default: 0,
                },
            },
            {
                name: "limit",
                in: "query",
                description: "Seen players: 1–100; kills: 1–200",
                schema: {
                    type: "integer",
                    minimum: 1,
                    maximum: 200,
                    default: 50,
                },
            },
            {
                name: "map",
                in: "query",
                description:
                    "Catalog map ID (for example Kavkazi), NOT the live display name (Bakurani). Required for alternators, optional for experiences.",
                schema: { type: "string", pattern: "^[\\w .-]{1,100}$" },
            },
            {
                name: "before",
                in: "query",
                description: "Kills cursor receipt timestamp",
                schema: { type: "string", format: "date-time" },
            },
            {
                name: "beforeTime",
                in: "query",
                description:
                    "Kills cursor match-clock seconds, requires before",
                schema: { type: "number", minimum: 0 },
            },
            {
                name: "match",
                in: "query",
                description: "Kills match ID filter",
                schema: { type: "string", pattern: "^[1-9][0-9]{0,14}$" },
            },
            ...["player", "killer", "victim"].map((name) => ({
                name,
                in: "query",
                description: "Kills: exact Steam ID or part of name",
                schema: { type: "string", maxLength: 100 },
            })),
            {
                name: "cause",
                in: "query",
                description: "Kills weapon/vehicle tag",
                schema: { type: "string", maxLength: 200 },
            },
            {
                name: "kind",
                in: "query",
                description: "Kills only",
                schema: {
                    type: "string",
                    enum: [
                        "headshot",
                        "teamKill",
                        "suicide",
                        "vehicle",
                        "environment",
                    ],
                },
            },
            {
                name: "minM",
                in: "query",
                description: "Kills minimum distance",
                schema: { type: "integer", minimum: 0, maximum: 100000 },
            },
        ],
        responses: {
            ...responses,
            "200": {
                description:
                    "Validated gameplay data, including provider timestamps",
                content: {
                    "application/json": {
                        schema: {
                            type: "object",
                            required: ["data"],
                            properties: {
                                data: {
                                    $ref: "#/components/schemas/WarconEnvelope",
                                },
                            },
                        },
                    },
                },
            },
            "503": {
                description:
                    "Provider or local storage unavailable; fixed error category only",
                content: { "application/json": { schema: error } },
            },
        },
    },
}

// Document every endpoint's effective permission boundary, including legacy-only reads.
Object.assign(paths, peopleReadPaths)
Object.assign(paths, historyReadPaths)
for (const [path, operations] of Object.entries(paths)) {
    if (!path.startsWith("/clan/")) continue
    for (const [method, operation] of Object.entries(
        operations as Record<string, Record<string, unknown>>
    )) {
        const resource = path.split("/")[2]
        if (
            [
                "league-matches",
                "league-fixtures",
                "server-game-history",
                "hll-live",
                "teams",
            ].includes(resource) &&
            method === "get"
        )
            continue
        operation["x-logi-read-access"] =
            resource === "membership-summaries" && method === "get"
                ? {
                      resource,
                      gameSelection: "one-explicit-game",
                      policy: "enabled-per-key-role-allowlist",
                      subject: "exact-discord-user-id",
                  }
                : method === "get" &&
                    ["changes", "sync-records"].includes(resource)
                  ? {
                        resources: "underlying-explicit-grants",
                        gameSelection: "one-explicit-game",
                    }
                  : method === "get" &&
                      (API_KEY_READ_RESOURCES as readonly string[]).includes(
                          resource
                      )
                    ? {
                          resource,
                          gameSelection: path.includes("{")
                              ? "persisted-record"
                              : "explicit-permitted-games",
                      }
                    : null
    }
}

export async function GET() {
    return NextResponse.json(
        {
            openapi: "3.1.1",
            info: {
                title: "Logi Clan API",
                version: "1.11.0",
                description: `The **Public API — no key required** section contains rate-limited public profiles, matches, and competitions. The **Clan API — API key required** sections contain tenant-scoped dashboard-equivalent data and writes. Clan API traffic is limited to 60 requests per second per API key; public endpoints are limited per client IP. A limited request returns \`429\` with \`Retry-After\` and \`RateLimit-*\` headers. A clan key can access only its own clan; identifiers from another clan return no data. Game-owned records default to hell_let_loose, including legacy records without gameId. Use game=all for every game, or repeat game (for example game=hell_let_loose&game=wardogs) for an explicit combination. Cursors are opaque and valid only for the resource, game selection, and createdAt ordering that produced them.

### Authenticate and read

For minimized website reads, grant event-summaries and/or match-summaries and use their matching clan endpoints. Each grant is independent of raw events/matches access. Summary DTOs exclude passwords, notes, player identities, source URLs and raw telemetry. They remain private operational content requiring website publication review. Match summaries identify Logi events and expose unknown or provisional results, never automatic confirmation.

Read-only people integrations have three additional independent grants: member-summaries, roster-summaries and player-stat-summaries. Legacy keys do not grant these reads. They expose closed versioned native identity references, published roster/attendance facts and current verified collected-session player facts. Publication consent and fresh role authorization remain separate. Their opaque cursors reset after cross-row identity/source changes; rebuild the entire scope before public display. See the [people integration handoff](https://github.com/Ninjonik/logi/blob/main/docs/integrations/website/v0.14/README.md) for coverage, null metrics, current proof and five-minute reconciliation rules.

Keys with a \`readAccess\` policy can only read their explicitly granted resources and games. Collections require explicit \`game\` values; \`game=all\`, writes, metadata, settings, users, calendar, presets and performance-history return \`403 insufficient_scope\`. Detail reads enforce the persisted record's game and return \`404\` outside it. Revoked keys return \`401\`. Legacy keys without this policy retain their existing access. A manager can issue restricted keys through the session-authenticated \`POST /api/servers/{serverId}/api-keys\` endpoint; bearer keys cannot issue or escalate keys. The System > Website API form defaults to read-only summary resources and requires explicit game selection; full legacy access must be selected separately. See the [read-only integration handoff](https://github.com/Ninjonik/logi/blob/main/docs/integrations/website/v0.4/README.md) for provisioning, compatibility and safe publication rules.


\`curl -H "Authorization: Bearer YOUR_API_KEY" "https://YOUR_LOGI_HOST/api/v1/clan/events?game=wardogs&limit=25&updatedSince=2026-01-01T00:00:00Z"\`

Use \`page.nextCursor\` from that response as \`cursor\` for the next request. Fetch one record with \`GET /clan/events/{id}\`.

### Make retry-safe writes


Send a new \`Idempotency-Key\` for each write, for example \`event-create-42\`. If a timeout occurs, retry the identical method, path, body, and key; Logi replays the original status and body for 24 hours. Changing the request while reusing the key returns \`409 idempotency_conflict\`; use a new key instead. Invalid input returns a \`400\` body shaped as \`{ error: { code, message } }\`.

### Webhooks


Webhook subscriptions are configured by a workspace administrator in the dashboard's **Settings → Webhooks** page, rather than through this bearer-key API. Each delivery is an HTTP POST with JSON \`{ id, type, createdAt, guildId, resource }\`, plus \`X-Logi-Event\`, \`X-Logi-Delivery\`, \`X-Logi-Timestamp\`, and \`X-Logi-Signature\` headers. Verify \`X-Logi-Signature\` as \`sha256=<HMAC_SHA256(X-Logi-Timestamp + "." + rawBody, signingSecret)>\` before parsing the raw body, and reject stale timestamps. Network failures, 408, 429, and 5xx responses retry with bounded backoff; other 4xx responses are final. See the [clan settings webhook guide](/wiki/configuration/settings#webhooks) for every event's trigger and resource shape.

Article, group, calendar-item, roster, assignment, event, signup, stratmap, and preset write operations are documented below. Event, stratmap, topic-preset, and squad-preset deletion is intentionally unsupported because their dependent roster, match, Discord, and scheduled-job data has no safe deletion lifecycle.`,
            },
            servers: [{ url: "/api/v1" }],
            tags: [
                {
                    name: "Clan API — People",
                    description:
                        "Minimized member, published roster and verified collected-session facts; website remains read-only.",
                },
                {
                    name: "Public API — no key required",
                    description:
                        "Rate-limited public profiles, match data, and competitions. These endpoints never require a bearer key.",
                },
                {
                    name: "Clan API — Overview",
                    description: "Authenticated clan identity and limits.",
                },
                {
                    name: "Clan API — Settings",
                    description: "Safe clan and Discord settings.",
                },
                {
                    name: "Clan API — Articles",
                    description: "Clan knowledge-base articles.",
                },
                {
                    name: "Clan API — Events",
                    description: "Events, conclusion, and signups.",
                },
                {
                    name: "Clan API — Groups",
                    description: "Clan membership groups.",
                },
                {
                    name: "Clan API — Calendar",
                    description: "Manual calendar items.",
                },
                { name: "Clan API — Rosters", description: "Event rosters." },
                {
                    name: "Clan API — Assignments",
                    description: "Clan memberships and roles.",
                },
                {
                    name: "Clan API — Stratmaps",
                    description: "Tactical map presets.",
                },
                {
                    name: "Clan API — Topic presets",
                    description: "Forum topic templates.",
                },
                {
                    name: "Clan API — Squad presets",
                    description: "Roster squad templates.",
                },
                {
                    name: "Clan API — Matches",
                    description: "Stored match results and history.",
                },
                {
                    name: "Clan API — Teams",
                    description:
                        "Global team catalogue reads; match snapshots travel in summaries.",
                },
                {
                    name: "Clan API — Users",
                    description: "Tenant-scoped member projections.",
                },
            ],
            components: {
                schemas: {
                    ...peopleResponseSchemas,
                    ...generatedOpenApiSchemas,
                    ...summaryResponseSchemas,
                    ...websiteEventCommandSchemas,
                    ...clanSettingsOpenApiSchemas(),
                },
                securitySchemes: {
                    clanApiKey: {
                        type: "http",
                        scheme: "bearer",
                        bearerFormat: "logi API key",
                        description:
                            "Send `Authorization: Bearer YOUR_API_KEY`. API keys are scoped to one clan and revoked keys are rejected. Optional readAccess restricts resources and games and forbids generic writes; x-logi-read-access describes each read. Only the separate actor-backed event-commands boundary accepts an explicit writeAccess grant together with an SSO actor token. No readAccess means legacy access to generic routes, never an event-commands grant.",
                    },
                    ssoActorToken: {
                        type: "apiKey",
                        in: "header",
                        name: "X-Logi-Actor-Token",
                        description:
                            "Current opaque SSO access token for this application, subject, central session and guild. Send only from the website backend together with its explicitly permitted service key.",
                    },
                },
            },
            paths: { ...paths, ...websiteEventCommandPaths },
        },
        { headers: { "Cache-Control": "no-store" } }
    )
}
