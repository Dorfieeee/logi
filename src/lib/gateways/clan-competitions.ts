import { getServerContextUncached } from "@/lib/read-models/server-context"
import { clanCompetitionHandlers } from "@/lib/api/clan-competition-route"
import { appCacheTags, revalidateCacheEntries } from "@/lib/cache-tags"
import { getInternalAuthSecret, getSiteUrl } from "@/lib/env"
import { currentDashboardActor } from "./dashboard-actor"
import { fetchMutation, fetchQuery } from "convex/nextjs"
import { makeFunctionReference } from "convex/server"
import { revalidatePath } from "next/cache"

export const clanCompetitionRoutes = clanCompetitionHandlers({
    origin: new URL(getSiteUrl()).origin,
    access: async (serverId) => {
        const context = await getServerContextUncached(serverId)
        const actor = await currentDashboardActor()
        return context?.canAdmin && actor
            ? {
                  secret: getInternalAuthSecret(),
                  actor,
                  guildId: context.server.discordId,
              }
            : null
    },
    list: (access) =>
        fetchQuery(
            makeFunctionReference<"query">("competitionEnrollment:list"),
            access
        ),
    execute: (access, input) =>
        fetchMutation(
            makeFunctionReference<"mutation">("competitionEnrollment:execute"),
            { ...access, input }
        ),
    mode: (access, mode) =>
        fetchMutation(
            makeFunctionReference<"mutation">(
                "competitionEnrollment:setWorkspaceMode"
            ),
            { ...access, mode }
        ),
    revalidate: (serverId, result) => {
        const slug =
            result &&
            typeof result === "object" &&
            "slug" in result &&
            typeof result.slug === "string"
                ? result.slug
                : null
        revalidateCacheEntries([
            appCacheTags.server(serverId),
            appCacheTags.serverContext(serverId),
            appCacheTags.users(),
            appCacheTags.publicDiscovery(),
            slug ? appCacheTags.competition(slug) : null,
        ])
        revalidatePath("/[locale]/dashboard", "layout")
    },
})
