import { createRosterImageCache } from "@/lib/roster-image-cache"
import { panelImageHandler } from "@/lib/api/panel-image-route"
import { panelImageRenderer } from "@/lib/panel-image/service"
import { getInternalAuthSecret } from "@/lib/env"

export const runtime = "nodejs"

const handle = panelImageHandler({
    secret: getInternalAuthSecret,
    render: (request) => panelImageRenderer.render(request),
    // Panels × versions within the bot's 60 s cadence; identical content is reused.
    cache: createRosterImageCache(48),
})

/** Bot-only: renders a validated panel image model (style A score, style B banner). */
export async function POST(request: Request) {
    return handle(request)
}
