import { makeFunctionReference } from "convex/server"
import { getInternalAuthSecret } from "@/lib/env"
import { fetchQuery } from "convex/nextjs"

export async function getMatchImageContext(
    eventId: string,
    guildId: string,
    result: boolean
) {
    return fetchQuery(
        makeFunctionReference<"query">("eventAnnouncements:getImageContext"),
        {
            secret: getInternalAuthSecret(),
            eventId: eventId as never,
            guildId,
            result,
        }
    )
}
