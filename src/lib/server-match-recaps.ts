import type { Id } from "../../convex/_generated/dataModel"
import { fetchMutation, fetchQuery } from "convex/nextjs"
import { api } from "../../convex/_generated/api"

import { getInternalAuthSecret } from "@/lib/env"

export async function captureMatchRecapBaselines(userIds: string[]) {
    return await fetchQuery(api.matchRecaps.captureBaselines, {
        secret: getInternalAuthSecret(),
        userIds,
    })
}

export async function queueMatchRecaps(
    eventId: string,
    baselines: Awaited<ReturnType<typeof captureMatchRecapBaselines>>
) {
    return await fetchMutation(api.matchRecaps.queueForPublishedResult, {
        secret: getInternalAuthSecret(),
        eventId: eventId as Id<"events">,
        baselines,
    })
}
