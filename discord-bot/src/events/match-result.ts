import {
    escapeMarkdownText,
    type MessageView,
} from "../../../src/domain/discord-messages/message-view"
import { matchImageCopy } from "../../../src/domain/events/match-image"
import { loadAnnouncementContext } from "./announcement-sync"
import { publishManagedMessage } from "../sync/publication"
import type { EventRecord, SyncPayload } from "../types"
import { announcementMessage } from "./announcement"
import { matchImageAttachment } from "./match-image"
import { buildPublicMatchUrl } from "../utils"
import type { Client } from "discord.js"
import { env } from "../environment"

export function publicStatsLink(value: string | null | undefined) {
    if (!value) return null
    try {
        const url = new URL(value)
        if (
            !["https:", "http:"].includes(url.protocol) ||
            url.username ||
            url.password ||
            url.href.length > 512
        )
            return null
        // Imported share links only. Provider credentials must never appear in a result.
        if (
            [...url.searchParams.keys()].some((key) =>
                /token|secret|password|api.?key|auth/i.test(key)
            )
        )
            return null
        return url.href
    } catch {
        return null
    }
}

/** A reviewed correction edits the same durable publication, without a ping. */
export type MatchResultSyncPorts = {
    context(eventId: string): ReturnType<typeof loadAnnouncementContext>
    image: typeof matchImageAttachment
    publish(
        input: Parameters<typeof publishManagedMessage>[1]
    ): ReturnType<typeof publishManagedMessage>
}
export async function synchronizeMatchResult(
    payload: SyncPayload,
    event: EventRecord,
    ports: MatchResultSyncPorts
) {
    if (event.kind !== "match") return
    const channelId = payload.config.eventResultsChannelId
    const context =
        channelId && event.status === "concluded"
            ? await ports.context(event.id)
            : null
    const revision = Math.max(
        Date.parse(event.updatedAt),
        Date.parse(payload.config.updatedAt),
        context?.resultVersion ?? 0
    )
    const key = `event:${event.id}:result`
    if (!channelId || !context?.imageResult) {
        await ports.publish({
            guildId: payload.config.guildId,
            key,
            revision,
            channelId: null,
            message: {},
        })
        return
    }
    const image = await ports.image(payload, event, {
        league: context.leagueLabel,
        result: context.imageResult,
    })
    const words = matchImageCopy(payload.config.defaultLanguage)
    const outcome = image.model.result?.outcome
    const stats = context.publicMatch
        ? buildPublicMatchUrl(event.id, payload.config.defaultLanguage)
        : (publicStatsLink(context.sourceUrl) ??
          (context.hasCollectedData && context.dashboardServerId
              ? new URL(
                    `/${payload.config.defaultLanguage}/dashboard/servers/${encodeURIComponent(context.dashboardServerId)}/matches/${encodeURIComponent(event.id)}?tab=result`,
                    env.appSiteUrl
                ).href
              : null))
    const statsLabel = {
        en: "Match statistics",
        cs: "Statistiky zápasu",
        de: "Spielstatistiken",
    }[payload.config.defaultLanguage]
    const view: MessageView = {
        accent: "clan",
        header: {
            title: event.name,
            label: image.model.gameName,
            chips: [
                {
                    label: outcome ? words[outcome] : words.result,
                    tone:
                        outcome === "win"
                            ? "success"
                            : outcome === "loss"
                              ? "danger"
                              : "neutral",
                },
            ],
        },
        blocks: [
            { kind: "gallery", items: [image.media] },
            {
                kind: "text",
                markdown: escapeMarkdownText(image.model.result!.scores),
            },
            ...(stats
                ? [
                      {
                          kind: "buttons" as const,
                          buttons: [
                              {
                                  kind: "link" as const,
                                  url: stats,
                                  label: statsLabel,
                              },
                          ],
                      },
                  ]
                : []),
        ],
    }
    await ports.publish({
        guildId: payload.config.guildId,
        key,
        revision,
        channelId,
        message: announcementMessage(view, {
            config: payload.config,
            files: [image.file],
        }),
    })
}

export async function syncMatchResult(
    client: Client,
    payload: SyncPayload,
    event: EventRecord
) {
    return synchronizeMatchResult(payload, event, {
        context: (eventId) => loadAnnouncementContext(eventId, true),
        image: matchImageAttachment,
        publish: (input) => publishManagedMessage(client, input),
    })
}
