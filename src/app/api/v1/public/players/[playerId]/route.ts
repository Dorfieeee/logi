import {
    getNamedCollection,
    isCollectionQueryError,
    parseCollectionQuery,
} from "@/lib/api/collection-query"
import {
    filterCollection,
    paginateCollection,
} from "@/domain/shared/collection-query"
import { getPublicPlayerProfile } from "@/lib/read-models/public-profiles"
import { checkPublicApiRateLimit } from "@/lib/public-api"
import { NextResponse } from "next/server"

export async function GET(
    request: Request,
    { params }: { params: Promise<{ playerId: string }> }
) {
    const rateLimit = await checkPublicApiRateLimit(
        `public:${request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"}`,
        60
    )
    if (!rateLimit.allowed)
        return NextResponse.json(
            { error: { code: "rate_limited", message: "Too many requests." } },
            { status: 429 }
        )
    const { playerId } = await params
    const data = await getPublicPlayerProfile(
        playerId,
        new URL(request.url).searchParams.get("game") ?? undefined
    )
    if (!data)
        return NextResponse.json(
            { error: { code: "not_found", message: "Player not found." } },
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
        collection === "clans" || collection === "recentMatches"
            ? getNamedCollection(data, [collection])
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
