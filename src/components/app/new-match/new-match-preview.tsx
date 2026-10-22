"use client"

import { useSyncExternalStore } from "react"

import {
    buildAnnouncementView,
    type MatchCardEvent,
} from "@/domain/discord-messages/match-announcement"
import { DiscordMessagePreview } from "@/components/app/discord-preview/discord-message-preview"
import type { MessageIconDensity } from "@/domain/discord-messages/message-style"
import { escapeMarkdownText } from "@/domain/discord-messages/message-view"
import { getAnnouncementMessages } from "@/lib/clan-language/announcements"
import type { NewMatchStep } from "@/domain/events/new-match-flow"
import { getEventMessages } from "@/lib/clan-language/events"
import type { Dictionary } from "@/i18n/dictionaries"

export type NewMatchPreviewModel = {
    kind: "match" | "training"
    /** The clan's bot language; the message is written in it. */
    language: string
    /** The clan's time zone, for the weekday of the dates. */
    timeZone: string
    /** The event name; the bot shows the team codes instead when there are teams. */
    title: string
    categoryLabel?: string | null
    /** Teams by slot with their stored side ("Allies", "Valkyra", ...). */
    teams: Array<{ code: string; side: string | null }>
    /** Map name and time-of-day key ("day", "night", ...). */
    map: { name: string; time: string | null } | null
    /** Logi's own picture of the map, which the bot puts top right. */
    mapImageUrl?: string | null
    cap: string | null
    /** A training shows its server on the card (never the password). */
    server?: string | null
    meetingStart: string | null
    gameStart: string | null
    gameEnd?: string | null
    registrationEnd: string | null
    signupRestriction?: string | null
    attendeeRole?: string | null
    groups: Array<{ name: string; max?: number }>
    /** Role names the announcement pings, shown above the card. */
    mentions: string[]
    forum: boolean
    /** The event category's colour: only the category chip's dot. */
    categoryColor?: string
    /** The clan's message style (Settings › Discord messages). */
    messageStyle?: { accentColor?: string; iconDensity?: MessageIconDensity }
    /** Long-form event briefing rendered below the match facts. */
    description?: string | null
    /** Short operational addendum rendered after the description. */
    notes?: string | null
    thumbnailUrl?: string | null
    imageUrl?: string | null
    /** Sign-ups of a published match; a new one shows zero. */
    signups?: { total: number; byGroup: Record<string, number> }
}

const MINUTE_MS = 60_000
const subscribeMinute = (onChange: () => void) => {
    const timer = setInterval(onChange, MINUTE_MS)
    return () => clearInterval(timer)
}
const currentMinute = () => Math.floor(Date.now() / MINUTE_MS) * MINUTE_MS
const noMinute = () => undefined
/**
 * The reader's clock to the minute. Discord shows times in each reader's zone,
 * so they render in the browser only; the server render has no clock.
 */
function useBrowserMinute(): number | undefined {
    return useSyncExternalStore(subscribeMinute, currentMinute, noMinute)
}

/** Role and channel IDs the preview's mention pills name. */
const FORUM_CHANNEL_ID = "1"
const roleId = (index: number) => String(100 + index)

/**
 * The announcement exactly as the bot posts it (board L1): the same view the
 * bot builds (`buildAnnouncementView`) drawn by the shared Discord preview,
 * with the ping above the card. Values the match does not have yet (sign-ups,
 * the forum) show as they will right after publishing.
 */
export function NewMatchPreview({
    model,
    dictionary,
    copy,
    hint,
    note,
}: {
    model: NewMatchPreviewModel
    /** The step being filled; the preview is the whole message at every step. */
    step: NewMatchStep
    dictionary: Dictionary
    /** The preview copy in the clan's bot language. */
    copy: Dictionary["newMatch"]["preview"]
    /** Replaces the hint beside the title. */
    hint?: string
    /** Replaces the note below the message; null leaves it out. */
    note?: string | null
}) {
    const now = useBrowserMinute()
    const text = dictionary.newMatch.preview
    const messages = getEventMessages(model.language)
    const announcement = getAnnouncementMessages(model.language)
    const timeLabel = (time: string) =>
        (copy.times as Record<string, string>)[time] ?? time
    const mapLabel = model.map
        ? [
              escapeMarkdownText(model.map.name),
              model.map.time ? timeLabel(model.map.time) : null,
          ]
              .filter(Boolean)
              .join(" · ")
        : null
    const card: MatchCardEvent = {
        kind: model.kind,
        eventId: "preview",
        guildId: "preview",
        name: model.title || dictionary.newMatch.untitled,
        category: model.categoryLabel
            ? { label: model.categoryLabel, color: model.categoryColor }
            : null,
        teams: model.kind === "match" ? model.teams : [],
        mapLabel,
        server: model.kind === "training" ? (model.server ?? null) : null,
        meetingStart: model.meetingStart ?? "",
        gameStart: model.gameStart ?? "",
        gameEnd: model.gameEnd ?? null,
        registrationEnd: model.registrationEnd ?? "",
        signupRestriction: model.signupRestriction,
        attendeeRole: model.attendeeRole,
        timeZone: model.timeZone,
        locale: messages.locale,
    }
    const view = buildAnnouncementView({
        event: card,
        state: "open",
        counts: {
            groups:
                model.kind === "match"
                    ? model.groups.map((group) => ({
                          id: group.name,
                          name: group.name,
                          count: model.signups?.byGroup[group.name] ?? 0,
                          ...(group.max ? { max: group.max } : {}),
                      }))
                    : [],
            withoutGroup: 0,
            total: model.signups?.total ?? 0,
            declined: 0,
        },
        signupRoster:
            model.kind === "match"
                ? {
                      groups: model.groups.map((group) => ({
                          name: group.name,
                          icon: "⚪",
                          names: [],
                      })),
                      declined: [],
                  }
                : null,
        description: model.description,
        notes: model.notes,
        forumChannelId:
            model.kind === "match" && model.forum ? FORUM_CHANNEL_ID : null,
        thumbnail:
            model.thumbnailUrl || (model.kind === "match" && model.mapImageUrl)
                ? {
                      url:
                          model.thumbnailUrl ||
                          (model.kind === "match" ? model.mapImageUrl : null)!,
                      description: model.map
                          ? announcement.card.mapAlt.replace(
                                "{map}",
                                model.map.name
                            )
                          : undefined,
                  }
                : null,
        image: model.imageUrl
            ? { url: model.imageUrl, description: model.title }
            : null,
        links: {
            calendar:
                "https://calendar.google.com/calendar/render?action=TEMPLATE",
        },
        copy: announcement,
    })
    const ping = model.mentions.map((_, index) => `<@&${roleId(index)}>`)

    return (
        <aside aria-labelledby="new-match-preview" className="space-y-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="new-match-preview" className="text-sm font-semibold">
                    {text.title}
                </h2>
                <span className="text-muted-foreground text-xs">
                    {hint ?? text.hint}
                </span>
            </div>
            <DiscordMessagePreview
                view={view}
                content={ping.length ? ping.join(" ") : undefined}
                language={model.language}
                style={model.messageStyle}
                labels={dictionary.discordPreview}
                now={now}
                timeZone={now === undefined ? model.timeZone : undefined}
                mentions={{
                    roles: Object.fromEntries(
                        model.mentions.map((name, index) => [
                            roleId(index),
                            name,
                        ])
                    ),
                    channels: { [FORUM_CHANNEL_ID]: copy.forum },
                }}
                author={{ time: copy.today }}
            />
            {note === null ? null : (
                <p className="text-muted-foreground text-xs leading-[18px]">
                    {note ?? text.note}
                </p>
            )}
        </aside>
    )
}
