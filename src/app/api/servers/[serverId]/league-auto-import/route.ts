import { wardogsFixtureUrlSchema } from "@/domain/wardogs-league/fixture-link"
import { verifyPublicChannel } from "@/lib/gateways/discord-public-channel"
import { getServerContextUncached } from "@/lib/read-models/server-context"
import { autoImportSettingsSchema } from "@/domain/wardogs-league/team-api"
import { providerKeySchema } from "@/domain/game-data/credentials.schema"
import { currentDashboardActor } from "@/lib/gateways/dashboard-actor"
import { clanAdminWriteDenied } from "@/lib/api/clan-admin-route"
import { gwlSaveFailureSchema } from "@/domain/gwl/save-feedback"
import { readBoundedJson } from "@/lib/api/request-json"
import { fetchAction, fetchQuery } from "convex/nextjs"
import { makeFunctionReference } from "convex/server"
import { getInternalAuthSecret } from "@/lib/env"
import { ConvexError } from "convex/values"
import { z } from "zod"

type Context = { params: Promise<{ serverId: string }> }
const json = (value: unknown, status = 200) =>
    Response.json(value, { status, headers: { "Cache-Control": "no-store" } })
async function access(serverId: string) {
    const [context, actor] = await Promise.all([
        getServerContextUncached(serverId),
        currentDashboardActor(),
    ])
    return context?.canAdmin && actor
        ? {
              secret: getInternalAuthSecret(),
              guildId: context.server.discordId,
              actor,
          }
        : null
}
export async function GET(_request: Request, context: Context) {
    const args = await access((await context.params).serverId)
    if (!args) return json({ error: "Forbidden." }, 403)
    try {
        if (new URL(_request.url).searchParams.get("fixtures") === "1")
            return json(
                await fetchAction(
                    makeFunctionReference<"action">(
                        "leagueAutoImportJobs:listFixtures"
                    ),
                    args
                )
            )
        return json(
            await fetchQuery(
                makeFunctionReference<"query">("leagueAutoImport:read"),
                args
            )
        )
    } catch {
        return json({ error: "unavailable" }, 503)
    }
}
const inputSchema = z.strictObject({
    settings: autoImportSettingsSchema,
    apiKey: providerKeySchema.optional(),
})
export async function PUT(request: Request, context: Context) {
    const { serverId } = await context.params
    const denied = await clanAdminWriteDenied(request, serverId)
    if (denied) return denied
    const args = await access(serverId)
    if (!args) return json({ error: "Forbidden." }, 403)
    try {
        const parsed = inputSchema.safeParse(
            await readBoundedJson(request, 12_000)
        )
        if (!parsed.success) return json({ error: "invalid_settings" }, 400)
        const input = parsed.data
        if (input.settings.enabled) {
            for (const id of new Set(
                [
                    input.settings.announcementChannelId,
                    input.settings.eventInfoChannelId,
                    input.settings.eventResultsChannelId,
                ].filter((id): id is string => Boolean(id))
            )) {
                const channel = await verifyPublicChannel(
                    args.guildId,
                    id
                ).catch(() => null)
                if (
                    !channel ||
                    channel.guildId !== args.guildId ||
                    !channel.canPublish ||
                    ![0, 5].includes(channel.type)
                )
                    return json({ error: "channel_access" }, 400)
            }
        }
        const result = await fetchAction(
            makeFunctionReference<"action">("leagueAutoImportJobs:save"),
            {
                ...args,
                settingsJson: JSON.stringify(input.settings),
                apiKey: input.apiKey,
            }
        )
        const failure = gwlSaveFailureSchema.safeParse(result)
        return failure.success ? json(failure.data, 400) : json({ ok: true })
    } catch (error) {
        const failure = gwlSaveFailureSchema.safeParse(
            error instanceof ConvexError ? error.data : null
        )
        return json(
            failure.success ? failure.data : { error: "save_failed" },
            400
        )
    }
}

export async function POST(request: Request, context: Context) {
    const { serverId } = await context.params
    const denied = await clanAdminWriteDenied(request, serverId)
    if (denied) return denied
    const args = await access(serverId)
    if (!args) return json({ error: "Forbidden." }, 403)
    try {
        const input = z
            .strictObject({
                sourceUrl: wardogsFixtureUrlSchema.pipe(z.string().min(1)),
            })
            .parse(await readBoundedJson(request, 1024))
        return json(
            await fetchAction(
                makeFunctionReference<"action">(
                    "leagueAutoImportJobs:readFixture"
                ),
                { ...args, sourceUrl: input.sourceUrl }
            )
        )
    } catch {
        return json({ error: "fixture_unavailable" }, 400)
    }
}
