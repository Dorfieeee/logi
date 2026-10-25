import {
    historyPageSchema,
    historyRecordSchema,
} from "@/domain/game-data/history"
import { z } from "zod"

export const historyResponseSchemas = {
    ServerGameHistory: z.toJSONSchema(historyRecordSchema),
    ServerGameHistoryPage: z.toJSONSchema(historyPageSchema),
}
export const historyReadPaths = {
    "/clan/server-game-history": {
        get: {
            tags: ["Clan API — Game data"],
            operationId: "readServerGameHistory",
            summary: "Read retained completed HLL or Wardogs server games",
            description:
                "Explicit server-game-history and the exact requested game read grants required; legacy keys denied. game=wardogs pairs provider=wardogs_warcon; game=hell_let_loose pairs provider=hll_crcon. Retained source facts survive disabled collection. Provider player names/platform IDs are not verified Logi identities or clan results. HLL retains allied/axis scores and observed kills/deaths/combat/offense/defense/support; no inferred winner, player result, playtime or Warcon metadata. Completed maps only; coverage begins at successfully retained provider records and may have gaps. End-time filters: from inclusive, until exclusive. At most 20 scanned native rows and a 1 MB native read budget per page, 2 MiB response bound; empty pages can continue. Finish every page at one game-scoped revision before publishing totals. On 410 discard the partial scan and restart. Cursors bind caller/workspace/game/filters. Read id alone for one record. Capture a game-scoped changes cursor before bootstrap, then reconcile server-game-history through sync-records. Always no-store.",
            "x-logi-read-access": {
                resource: "server-game-history",
                games: ["wardogs", "hell_let_loose"],
                explicitGrantRequired: true,
            },
            parameters: [
                {
                    name: "game",
                    in: "query",
                    required: true,
                    schema: {
                        type: "string",
                        enum: ["wardogs", "hell_let_loose"],
                    },
                },
                ...["id", "cursor", "sourceId", "map", "from", "until"].map(
                    (name) => ({
                        name,
                        in: "query",
                        schema: {
                            type: "string",
                            ...(name === "from" || name === "until"
                                ? { format: "date-time" }
                                : {}),
                        },
                    })
                ),
            ],
            responses: {
                "200": {
                    description:
                        "One retained game or a revision-consistent page",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                required: ["data"],
                                properties: {
                                    data: {
                                        oneOf: [
                                            {
                                                $ref: "#/components/schemas/ServerGameHistory",
                                            },
                                            {
                                                $ref: "#/components/schemas/ServerGameHistoryPage",
                                            },
                                        ],
                                    },
                                },
                            },
                        },
                    },
                },
                ...Object.fromEntries(
                    [400, 401, 403, 404, 410, 429, 503].map((status) => [
                        String(status),
                        {
                            description:
                                status === 410
                                    ? "reset_required: history changed during pagination"
                                    : `Request rejected or unavailable (${status})`,
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        required: ["error"],
                                        properties: {
                                            error: {
                                                type: "object",
                                                required: ["code"],
                                                properties: {
                                                    code: { type: "string" },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    ])
                ),
            },
        },
    },
}
