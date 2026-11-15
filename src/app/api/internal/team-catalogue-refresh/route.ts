import { scrapeTeamCatalogue } from "@/lib/gateways/team-scrape"
import { readBoundedJson } from "@/lib/api/request-json"
import { teamGameSchema } from "@/domain/teams/team"
import { getInternalAuthSecret } from "@/lib/env"
import { timingSafeEqual } from "node:crypto"
import { z } from "zod"

export const runtime = "nodejs"
export const maxDuration = 300

export async function POST(request: Request) {
    const secret = getInternalAuthSecret()
    const expected = Buffer.from(`Bearer ${secret}`)
    const supplied = Buffer.from(request.headers.get("authorization") ?? "")
    if (
        expected.length !== supplied.length ||
        !timingSafeEqual(expected, supplied)
    )
        return Response.json({ error: "forbidden" }, { status: 403 })
    const input = z
        .strictObject({ gameId: teamGameSchema })
        .safeParse(await readBoundedJson(request, 1024))
    if (!input.success)
        return Response.json({ error: "invalid_game" }, { status: 400 })
    return Response.json(
        await scrapeTeamCatalogue({ secret }, input.data.gameId),
        { headers: { "Cache-Control": "no-store" } }
    )
}
