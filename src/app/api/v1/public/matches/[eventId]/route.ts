import { NextResponse } from "next/server"

import {
    getNamedCollection,
    isCollectionQueryError,
    parseCollectionQuery,
} from "@/lib/api/collection-query"
import {
    filterCollection,
    paginateCollection,
} from "@/domain/shared/collection-query"
import { getWardogsMatchReport } from "@/lib/read-models/wardogs-match-reports"
import { getPublicMatch } from "@/lib/read-models/public-profiles"
import { checkPublicApiRateLimit } from "@/lib/public-api"

export async function GET(
    request: Request,
    { params }: { params: Promise<{ eventId: string }> }
) {
    const limit = await checkPublicApiRateLimit(
        `public:${request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"}`,
        30
    )
    if (!limit.allowed)
        return NextResponse.json(
            { error: { code: "rate_limited", message: "Too many requests." } },
            {
                status: 429,
                headers: {
                    "Retry-After": String(
                        Math.max(
                            1,
                            Math.ceil((limit.resetAt - Date.now()) / 1000)
                        )
                    ),
                },
            }
        )
    const { eventId } = await params
    const data =
        (await getPublicMatch(eventId)) ??
        (await getWardogsMatchReport(eventId))
    if (!data)
        return NextResponse.json(
            { error: { code: "not_found", message: "Match not found." } },
            { status: 404 }
        )
    const collection = new URL(request.url).searchParams.get("collection")
    if (!collection)
        return NextResponse.json(
            { data },
            { headers: { "Cache-Control": "public, max-age=60" } }
        )
    const query = parseCollectionQuery(request)
    if (isCollectionQueryError(query))
        return NextResponse.json(
            { error: { code: "invalid_query", message: query.error } },
            { status: 400 }
        )
    const items =
        collection === "playerStats"
            ? getNamedCollection(
                  data as Record<string, unknown>,
                  "schemaVersion" in data && data.gameId === "wardogs"
                      ? ["players"]
                      : ["raw", "player_stats"]
              )
            : null
    if (!items)
        return NextResponse.json(
            { error: { code: "not_found", message: "Collection not found." } },
            { status: 404 }
        )
    return NextResponse.json(
        {
            data: paginateCollection(
                filterCollection(items, query.filters),
                query.offset,
                query.limit
            ),
        },
        { headers: { "Cache-Control": "public, max-age=60" } }
    )
}
