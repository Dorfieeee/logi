import { getServerContextUncached } from "@/lib/read-models/server-context"
import { revalidateCacheEntries, appCacheTags } from "@/lib/cache-tags"
import { eventResultsHandlers } from "@/lib/api/event-results-route"
import { getInternalAuthSecret, getSiteUrl } from "@/lib/env"
import { fetchMutation, fetchQuery } from "convex/nextjs"
import { resolveGameScope } from "@/domain/games/game"
import { makeFunctionReference } from "convex/server"
import { getSession } from "@/lib/auth"
function handlers(serverId: string) {
    return eventResultsHandlers({
        origin: getSiteUrl().replace(/\/$/, ""),
        authorize: async (serverId, eventId, gameId) => {
            const session = await getSession()
            if (!session) return null
            const context = await getServerContextUncached(serverId)
            const event = context?.events.find(
                (e) =>
                    e.id === eventId &&
                    resolveGameScope(e.gameId) === gameId &&
                    (e.kind ?? "match") === "match"
            )
            return context?.canAdmin && event
                ? {
                      guildId: context.server.discordId,
                      gameId,
                      eventId,
                      actorId: session.sub,
                  }
                : null
        },
        read: (scope) =>
            fetchQuery(makeFunctionReference<"query">("eventResults:get"), {
                secret: getInternalAuthSecret(),
                ...scope,
            }),
        write: async (scope, command) => {
            const revision = await fetchMutation(
                makeFunctionReference<"mutation">("eventResults:review"),
                { secret: getInternalAuthSecret(), ...scope, command }
            )
            revalidateCacheEntries([
                appCacheTags.matches(serverId),
                appCacheTags.publicDiscovery(),
            ])
            for (const player of revision.players ?? []) {
                if (player.logiUserId)
                    revalidateCacheEntries([
                        appCacheTags.playerStats(player.logiUserId),
                        appCacheTags.publicProfile(player.logiUserId),
                    ])
            }
            return revision
        },
    })
}
type Context = { params: Promise<{ serverId: string; eventId: string }> }
export async function GET(request: Request, context: Context) {
    const { serverId, eventId } = await context.params
    return handlers(serverId).get(request, serverId, eventId)
}
export async function POST(request: Request, context: Context) {
    const { serverId, eventId } = await context.params
    return handlers(serverId).post(request, serverId, eventId)
}
