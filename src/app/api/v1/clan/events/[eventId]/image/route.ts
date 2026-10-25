import {
    authenticateClanRequest,
    isAuthError,
} from "@/lib/api/authenticated-clan-route"
import { getMatchImageContext } from "@/lib/read-models/match-image"
import { matchImageReadHandler } from "@/lib/api/match-image-route"
import { panelImageRenderer } from "@/lib/panel-image/service"
import { getClanApiResource } from "@/lib/public-api"

export const runtime = "nodejs"
export async function GET(
    request: Request,
    context: { params: Promise<{ eventId: string }> }
) {
    const auth = await authenticateClanRequest(request)
    if (isAuthError(auth)) return auth
    const view = new URL(request.url).searchParams.get("view") ?? "match"
    if (!["match", "result"].includes(view))
        return Response.json(
            { error: { code: "invalid_query" } },
            {
                status: 400,
                headers: { ...auth.headers, "Cache-Control": "no-store" },
            }
        )
    const { eventId } = await context.params
    // The normal resource read enforces the key's events grant, game and tenant.
    const event = await getClanApiResource(auth.key, "events", eventId)
    if (!event)
        return Response.json(
            { error: { code: "not_found" } },
            {
                status: 404,
                headers: { ...auth.headers, "Cache-Control": "no-store" },
            }
        )
    return matchImageReadHandler({
        context: () =>
            getMatchImageContext(eventId, auth.guildId, view === "result"),
        render: (model) => panelImageRenderer.render({ kind: "match", model }),
    })(auth.headers)
}
