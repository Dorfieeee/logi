import {
    clanMemberSummarySchema,
    clanRosterSummarySchema,
    clanPlayerStatSummarySchema,
    PEOPLE_RESOURCES,
} from "@/domain/api/people-summaries"
import { GAME_IDS } from "@/domain/games/game"
import { z } from "zod"

export const peopleResponseSchemas = {
    ClanMemberSummaryV1: z.toJSONSchema(clanMemberSummarySchema),
    ClanRosterSummaryV1: z.toJSONSchema(clanRosterSummarySchema),
    ClanPlayerStatSummaryV1: z.toJSONSchema(clanPlayerStatSummarySchema),
}
const names = [
    "ClanMemberSummaryV1",
    "ClanRosterSummaryV1",
    "ClanPlayerStatSummaryV1",
]
const errors = Object.fromEntries(
    [400, 401, 403, 404, 410, 429].map((status) => [
        String(status),
        {
            description:
                status === 410
                    ? "reset_required: the dependency generation changed; rebuild the scope"
                    : status === 403
                      ? "insufficient_scope: an explicit resource and game grant is required; legacy keys denied"
                      : `Request rejected (${status})`,
            content: {
                "application/json": {
                    schema: {
                        type: "object",
                        required: ["error"],
                        properties: {
                            error: {
                                type: "object",
                                required: ["code", "message"],
                                properties: {
                                    code: { type: "string" },
                                    message: { type: "string" },
                                },
                            },
                        },
                    },
                },
            },
        },
    ])
)
const game = {
    name: "game",
    in: "query",
    required: true,
    schema: { type: "string", enum: [...GAME_IDS] },
    description:
        "Exactly one explicitly granted game; canonical Discord guild comes from the key.",
}
const projectionCaching =
    " Successful responses may be reused in Logi's private server-side cache for up to five minutes. Live key/grant/rate checks and current integration/dependency counters run on every request; tracked changes bypass old entries immediately. Concurrent identical reads share one fetch. Attribution timestamps are not refreshed on cache hits. X-Logi-Cache reports hit, miss, coalesced or bypass; browsers/proxies must still honor no-store."
export const peopleReadPaths = Object.fromEntries(
    PEOPLE_RESOURCES.flatMap((resource, index) => [
        [
            `/clan/${resource}`,
            {
                get: {
                    tags: ["Clan API — People"],
                    security: [{ clanApiKey: [] }],
                    summary: `Read minimized ${resource}`,
                    description:
                        "Private versioned operational facts, not public consent or role authorization. Explicit independent resource/game grant required; legacy keys denied. Always no-store. Member IDs identify assignments, identityId identifies an unambiguous native user record. Unresolved/conflicting bindings have no identity or name. Roster facts require a currently published roster; acknowledgement/confirmation never proves gameplay or no-show. Statistics cover collected server sessions only, not a career: current verified Steam ownership and a unique scoped member are required, unsupported metrics are null, and coverage counts unresolved players. eventRefs require an exact confirmed/corrected reviewed result and matching source digest. Source configuration changes suppress older generations until recollected. Consumers must combine revision polling with a full refresh and attribution age cap of at most five minutes, and explicit publication consent. Cross-row identity, group, membership, reviewed-result and source changes invalidate the signed cursor with 410; rebuild and suppress old public data during the reset. An empty list page can still have a nextCursor." +
                        projectionCaching,
                    parameters: [
                        game,
                        {
                            name: "limit",
                            in: "query",
                            schema: {
                                type: "integer",
                                minimum: 1,
                                maximum: 10,
                                default: 10,
                            },
                            description:
                                "Member lists scan up to this many rows. Roster and session lists scan at most one native parent/session per page to bound projection work.",
                        },
                        {
                            name: "cursor",
                            in: "query",
                            schema: { type: "string", maxLength: 4096 },
                            description:
                                "Signed cursor bound to key, guild, game, resource and dependency generation.",
                        },
                        {
                            name: "sort",
                            in: "query",
                            schema: { type: "string", enum: ["createdAt"] },
                            description:
                                "Native creation order; retain the opaque provider cursor, never synthesize one.",
                        },
                    ],
                    responses: {
                        ...errors,
                        "200": {
                            description: "Bounded projection page",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        required: ["data", "page"],
                                        additionalProperties: false,
                                        properties: {
                                            data: {
                                                type: "array",
                                                maxItems: 10,
                                                items: {
                                                    $ref: `#/components/schemas/${names[index]}`,
                                                },
                                            },
                                            page: {
                                                type: "object",
                                                required: [
                                                    "nextCursor",
                                                    "limit",
                                                ],
                                                additionalProperties: false,
                                                properties: {
                                                    nextCursor: {
                                                        type: [
                                                            "string",
                                                            "null",
                                                        ],
                                                    },
                                                    limit: {
                                                        type: "integer",
                                                        minimum: 1,
                                                        maximum: 10,
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
            },
        ],
        [
            `/clan/${resource}/{id}`,
            {
                get: {
                    tags: ["Clan API — People"],
                    security: [{ clanApiKey: [] }],
                    summary: `Read one ${resource} record`,
                    description:
                        "Same explicit independent grant, minimized projection and publication rules as the collection. Missing, foreign-game, foreign-guild, unpublished or unavailable-source records return 404. Use sync-records for an atomic revision; removed records return 404." +
                        projectionCaching,
                    parameters: [
                        game,
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: {
                                type: "string",
                                minLength: 1,
                                maxLength: 200,
                            },
                        },
                    ],
                    responses: {
                        ...errors,
                        "200": {
                            description: "Current scoped projection",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        required: ["data"],
                                        additionalProperties: false,
                                        properties: {
                                            data: {
                                                $ref: `#/components/schemas/${names[index]}`,
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        ],
    ])
)
