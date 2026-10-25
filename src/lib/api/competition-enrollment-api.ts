import {
    clanEnrollmentCommandSchema,
    workspaceModeInputSchema,
} from "@/domain/competitions/enrollment.schema"
import {
    authenticateClanRequest,
    isAuthError,
} from "./authenticated-clan-route"
import { appCacheTags, revalidateCacheEntries } from "@/lib/cache-tags"
import { fetchMutation, fetchQuery } from "convex/nextjs"
import { makeFunctionReference } from "convex/server"
import { teamGameSchema } from "@/domain/teams/team"
import { getInternalAuthSecret } from "@/lib/env"
import { readBoundedJson } from "./request-json"
import { hashApiKey } from "@/lib/public-api"
import { revalidatePath } from "next/cache"

export async function competitionEnrollmentApi(
    request: Request,
    kind: "competitions" | "workspace-mode"
) {
    const auth = await authenticateClanRequest(request)
    if (isAuthError(auth)) return auth
    const headers = { ...auth.headers, "Cache-Control": "no-store" }
    const reply = (value: unknown, status = 200) =>
        Response.json(value, { status, headers })
    const params = new URL(request.url).searchParams
    const game = teamGameSchema.safeParse(params.get("game"))
    if (
        !game.success ||
        params.getAll("game").length !== 1 ||
        [...params.keys()].some((key) => key !== "game")
    )
        return reply({ error: { code: "invalid_query" } }, 400)
    const token = request.headers.get("x-logi-actor-token")
    if (!token || token.length > 1024)
        return reply({ error: { code: "unauthorized" } }, 401)
    const access = {
        secret: getInternalAuthSecret(),
        guildId: auth.guildId,
        keyHash: hashApiKey(auth.key),
        actorTokenHash: hashApiKey(token),
        gameId: game.data,
    }
    try {
        let result: unknown
        if (request.method === "GET")
            result = await fetchQuery(
                makeFunctionReference<"query">(
                    `competitionEnrollmentApi:${kind === "competitions" ? "list" : "readMode"}`
                ),
                access
            )
        else {
            let raw: unknown
            try {
                raw = await readBoundedJson(request, 4096)
            } catch {
                return reply({ error: { code: "invalid_request" } }, 400)
            }
            const parsed =
                kind === "competitions"
                    ? clanEnrollmentCommandSchema.safeParse(raw)
                    : workspaceModeInputSchema
                          .transform((value) => value.mode)
                          .safeParse(raw)
            if (!parsed.success)
                return reply({ error: { code: "invalid_request" } }, 400)
            result = await fetchMutation(
                makeFunctionReference<"mutation">(
                    `competitionEnrollmentApi:${kind === "competitions" ? "execute" : "mode"}`
                ),
                {
                    ...access,
                    ...(typeof parsed.data === "string"
                        ? { mode: parsed.data }
                        : { input: parsed.data }),
                }
            )
        }
        if (result && typeof result === "object" && "error" in result)
            return reply(
                { error: { code: result.error } },
                result.error === "forbidden" ||
                    result.error === "team_not_owned"
                    ? 403
                    : result.error === "not_found"
                      ? 404
                      : 409
            )
        if (request.method !== "GET") {
            revalidateCacheEntries([
                appCacheTags.publicDiscovery(),
                appCacheTags.users(),
                result &&
                typeof result === "object" &&
                "slug" in result &&
                typeof result.slug === "string"
                    ? appCacheTags.competition(result.slug)
                    : null,
                result &&
                typeof result === "object" &&
                "serverId" in result &&
                typeof result.serverId === "string"
                    ? appCacheTags.serverContext(result.serverId)
                    : null,
            ])
            revalidatePath("/[locale]/dashboard", "layout")
        }
        return reply(result)
    } catch {
        return reply({ error: { code: "unavailable" } }, 503)
    }
}
