import { makeFunctionReference } from "convex/server"
import { fetchQuery } from "convex/nextjs"

import { appCacheTags, cachedRead } from "@/lib/cache-tags"
import type { GameScope } from "@/domain/games/game"
import { getInternalAuthSecret } from "@/lib/env"

const getRecentMatchSummaryReference = makeFunctionReference<"query">(
    "serverDashboard:getRecentMatchSummaryInternal"
)

export type RecentMatchSummary = {
    recentMatches: Array<{
        id: string
        name: string
        endedAt: string
        outcome: "victory" | "defeat" | "draw"
        scores: Array<number | null>
    }>
    wins: number
    losses: number
    winRate: number
    topPlayers: Array<{
        id: string
        name: string
        matches: number
        kills: number
        deaths: number
        roles: Array<{ name: string; icon?: string }>
    }>
}

/** Call only after the server-context access check has succeeded. */
export async function getRecentMatchSummary(
    serverId: string,
    gameScope: GameScope = "all"
): Promise<RecentMatchSummary | null> {
    return await cachedRead(
        ["server-recent-match-summary:v5", serverId, gameScope],
        [appCacheTags.serverContext(serverId), appCacheTags.matches(serverId)],
        async () =>
            (await fetchQuery(getRecentMatchSummaryReference, {
                secret: getInternalAuthSecret(),
                serverId: serverId as never,
                gameScope,
            })) as RecentMatchSummary | null,
        60 * 60 * 24
    )
}
