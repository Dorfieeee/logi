import {
    authenticateClanRequest,
    isAuthError,
} from "@/lib/api/authenticated-clan-route"
import { parseLeagueFixtureQuery } from "@/lib/api/league-fixtures-route"
import { makeFunctionReference } from "convex/server"
import { getInternalAuthSecret } from "@/lib/env"
import { hashApiKey } from "@/lib/public-api"
import { fetchQuery } from "convex/nextjs"
export const runtime = "nodejs"
export async function GET(request: Request) {
    const auth = await authenticateClanRequest(request)
    if (isAuthError(auth)) {
        auth.headers.set("Cache-Control", "no-store")
        return auth
    }
    const headers = { ...auth.headers, "Cache-Control": "no-store" },
        input = parseLeagueFixtureQuery(request)
    if (!input)
        return Response.json(
            {
                error: {
                    code: "invalid_query",
                    message:
                        "One Wardogs game and bounded pagination are required.",
                },
            },
            { status: 400, headers }
        )
    try {
        const data = await fetchQuery(
            makeFunctionReference<"query">(
                input.provider === "gwl"
                    ? "leagueFixtureReads:listGwl"
                    : "leagueFixtureReads:list"
            ),
            {
                secret: getInternalAuthSecret(),
                keyHash: hashApiKey(auth.key),
                guildId: auth.guildId,
                cursor: input.cursor,
                limit: input.limit,
            }
        )
        return data
            ? Response.json({ data }, { headers })
            : Response.json(
                  { error: { code: "insufficient_scope" } },
                  { status: 403, headers }
              )
    } catch {
        return Response.json(
            { error: { code: "unavailable" } },
            { status: 503, headers }
        )
    }
}
