import { historyRetentionSettingsSchema } from "@/domain/game-data/history-retention"
import { getServerContextUncached } from "@/lib/read-models/server-context"
import { currentDashboardActor } from "@/lib/gateways/dashboard-actor"
import { historyBackendGameArgs } from "@/lib/api/game-history-route"
import { historyGameSchema } from "@/domain/game-data/history"
import { getInternalAuthSecret, getSiteUrl } from "@/lib/env"
import { fetchMutation, fetchQuery } from "convex/nextjs"
import { readBoundedJson } from "@/lib/api/request-json"
import { makeFunctionReference } from "convex/server"

export const runtime = "nodejs"
type Context = { params: Promise<{ serverId: string }> }
const json = (value: unknown, status = 200) =>
    Response.json(value, { status, headers: { "Cache-Control": "no-store" } })
async function access(context: Context) {
    const server = await getServerContextUncached(
            (await context.params).serverId
        ),
        actor = await currentDashboardActor()
    return server?.canAdmin && actor
        ? {
              secret: getInternalAuthSecret(),
              guildId: server.server.discordId,
              actor,
          }
        : null
}

function requestedGame(request: Request) {
    const params = new URL(request.url).searchParams
    if (
        [...params.keys()].some((key) => key !== "game") ||
        params.getAll("game").length > 1
    )
        return null
    const parsed = historyGameSchema.safeParse(params.get("game") ?? "wardogs")
    return parsed.success ? parsed.data : null
}

export async function GET(request: Request, context: Context) {
    const gameId = requestedGame(request)
    if (!gameId) return json({ error: "Invalid game." }, 400)
    const args = await access(context)
    if (!args) return json({ error: "Forbidden." }, 403)
    try {
        return json(
            await fetchQuery(
                makeFunctionReference<"query">("gameHistoryRetention:read"),
                { ...args, ...historyBackendGameArgs(gameId) }
            )
        )
    } catch {
        return json({ error: "Retention settings unavailable." }, 503)
    }
}

export async function POST(request: Request, context: Context) {
    const gameId = requestedGame(request)
    if (!gameId) return json({ error: "Invalid game." }, 400)
    if (request.headers.get("origin") !== new URL(getSiteUrl()).origin)
        return json({ error: "Forbidden." }, 403)
    const args = await access(context)
    if (!args) return json({ error: "Forbidden." }, 403)
    const input = historyRetentionSettingsSchema.safeParse(
        await readBoundedJson(request, 1024)
    )
    if (!input.success)
        return json(
            { error: "Choose one of the offered retention windows." },
            400
        )
    try {
        return json(
            await fetchMutation(
                makeFunctionReference<"mutation">(
                    "gameHistoryRetention:configure"
                ),
                {
                    ...args,
                    ...historyBackendGameArgs(gameId),
                    retentionDays: input.data.retentionDays,
                }
            )
        )
    } catch {
        return json({ error: "Unable to save retention settings." }, 503)
    }
}
