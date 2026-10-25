import { NextResponse } from "next/server"

import { invalidPublicationDestination } from "@/domain/discord-publications/destinations"
import { discordSettingsPatchSchema } from "@/lib/validation/discord-settings"
import { isDashboardWriteOrigin } from "@/lib/api/dashboard-write-origin"
import { appCacheTags, revalidateCacheEntries } from "@/lib/cache-tags"
import { saveDiscordConfig } from "@/lib/server-discord-settings"
import { logNextError, logNextInfo } from "@/lib/system-logs"
import { fetchDiscordGuildChannels } from "@/lib/discord"
import { readBoundedJson } from "@/lib/api/request-json"
import { getServerContext } from "@/lib/server-context"
import { handleIfNotLoggedIn } from "@/lib/auth"

export async function POST(
    request: Request,
    context: { params: Promise<{ serverId: string }> }
) {
    const { serverId } = await context.params
    await handleIfNotLoggedIn(`/dashboard/servers/${serverId}/settings`)

    const serverContext = await getServerContext(serverId)
    if (!serverContext?.canAdmin || !isDashboardWriteOrigin(request)) {
        return NextResponse.json({ error: "Forbidden." }, { status: 403 })
    }

    try {
        // Settings pages send at most a few kilobytes; ticket and membership
        // forms with every category stay far below this bound.
        const json = await readBoundedJson(request, 256 * 1024)
        const parsed = discordSettingsPatchSchema.safeParse(json)

        if (!parsed.success) {
            return NextResponse.json(
                {
                    error:
                        parsed.error.issues[0]?.message ??
                        "Invalid Discord settings.",
                },
                { status: 400 }
            )
        }

        const invalidChannel = invalidPublicationDestination(
            {
                ...parsed.data,
                announcementsChannelId:
                    parsed.data.announcementsChannelId ?? undefined,
                eventInfoChannelId: parsed.data.eventInfoChannelId ?? undefined,
                eventResultsChannelId:
                    parsed.data.eventResultsChannelId ?? undefined,
                errorsChannelId: parsed.data.errorsChannelId ?? undefined,
                calendarChannelId: parsed.data.calendarChannelId ?? undefined,
            },
            await fetchDiscordGuildChannels(serverContext.server.discordId)
        )
        if (invalidChannel)
            return NextResponse.json(
                {
                    error:
                        invalidChannel.purpose === "private-thread"
                            ? "Ticket and application parents must be text channels in this Discord server."
                            : "Select a text or announcement channel in this Discord server.",
                },
                { status: 400 }
            )

        await saveDiscordConfig(serverId, parsed.data)

        revalidateCacheEntries([
            appCacheTags.serverContext(serverId),
            appCacheTags.discordConfig(serverId),
        ])

        logNextInfo("discord-settings", "Saved Discord settings", {
            serverId,
            userId: serverContext.user.discordId,
        })
        return NextResponse.json({ ok: true })
    } catch (error) {
        logNextError("discord-settings", "Failed to save Discord settings", {
            serverId,
            error,
        })
        return NextResponse.json(
            { error: "Unable to save Discord settings." },
            { status: 500 }
        )
    }
}
