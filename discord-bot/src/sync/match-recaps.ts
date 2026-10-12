/**
 * The match recap DM (board L2 1.6): sent after a confirmed match to players
 * with a linked account who have not turned recaps off. The clan card in
 * the clan language: game, match and category, date, map and place, the
 * result and side, three numbers with the clan's decimal comma, the
 * comparison with earlier matches and the data source. "Vypnout shrnutí"
 * edits the same DM (see `interactions/match-recap-preference.ts`).
 */

import type { Client } from "discord.js"

import {
    matchRecapView,
    type RecapStats,
} from "../../../src/domain/discord-messages/direct-message-views"
import { isMessageEnabled } from "../../../src/domain/discord-messages/notification-settings"
import type { MessageView } from "../../../src/domain/discord-messages/message-view"
import { getDirectMessages } from "../../../src/lib/clan-language/direct-messages"
import { dmFrame, dmSettingsUrl, eventMapLabel } from "../events/match-context"
import { matchTitle } from "../../../src/domain/discord-messages/match-text"
import { sideKind } from "../../../src/domain/discord-messages/match-text"
import { getRosterMessages } from "../../../src/lib/clan-language/rosters"
import { resolveClanLanguage } from "../../../src/lib/clan-language/core"
import { loadForumContext, type MatchForumContext } from "../forum"
import type { EventInteractionContext } from "../types"
import { messagePayload } from "../ui/message-kit"
import { convex, references } from "../convex"
import { env } from "../environment"
import { logWarn } from "../log"

export type MatchRecapData = {
    userId: string
    mapName?: string
    kills: number
    deaths: number
    kd: number
    previousTen?: {
        matches: number
        kills: number
        deaths: number
        kd: number
    }
}
type PendingMatchRecap = MatchRecapData & {
    recapId: string
    discordUserId: string
    eventName: string
}

/** The inputs every recap of a match shares. */
export type RecapInputs = {
    context: EventInteractionContext
    forum: MatchForumContext | null
}

export async function loadRecapInputs(
    eventId: string
): Promise<RecapInputs | null> {
    const [context, forum] = await Promise.all([
        convex
            .query(references.getEventInteractionContext, {
                secret: env.internalSecret,
                eventId: eventId as never,
            })
            .catch(() => null) as Promise<EventInteractionContext | null>,
        loadForumContext(eventId),
    ])
    return context ? { context, forum } : null
}

/** The player's public statistics of this match. */
export function recapStatsUrl(
    language: string,
    userId: string,
    eventId: string
) {
    return `${env.appSiteUrl}/${resolveClanLanguage(language)}/players/${encodeURIComponent(userId)}/matches/${encodeURIComponent(eventId)}`
}

/** The rendered, Discord-safe performance card that accompanies a recap DM. */
export function recapPerformanceImageUrl(userId: string, eventId: string) {
    return `${env.appSiteUrl}/api/og/player-match/${encodeURIComponent(userId)}/${encodeURIComponent(eventId)}`
}

/** The recap card for one player, turned on or off. */
export function buildMatchRecapView(input: {
    inputs: RecapInputs
    recap: MatchRecapData
    discordUserId: string
    enabled: boolean
}): MessageView {
    const { context, forum } = input.inputs
    const { config, event, roster } = context
    const language = config.defaultLanguage
    const squad = roster?.squads.find((item) =>
        item.players.some((player) => player.id === input.discordUserId)
    )
    const role = squad?.players
        .find((player) => player.id === input.discordUserId)
        ?.roleName?.trim()
    const side = event.side?.trim()
    const team = event.matchTeams?.find(
        (item) =>
            side &&
            item.side &&
            (item.side.trim().toLowerCase() === side.toLowerCase() ||
                (sideKind(item.side) && sideKind(item.side) === sideKind(side)))
    )
    const stats: RecapStats = {
        kills: input.recap.kills,
        deaths: input.recap.deaths,
        kd: input.recap.kd,
        previous: input.recap.previousTen,
    }
    const provider =
        forum?.provider ?? (event.gameId === "wardogs" ? undefined : "CRCON")
    return matchRecapView({
        event: {
            id: event.id,
            title: matchTitle(event),
            category: forum?.category
                ? {
                      label: forum.category.label,
                      color: forum.category.color,
                  }
                : undefined,
            gameStart: event.gameStart,
            mapLabel:
                eventMapLabel(event, language) ?? input.recap.mapName?.trim(),
        },
        gameId: event.gameId ?? "hell_let_loose",
        place: squad
            ? { squad: squad.name, ...(role ? { role } : {}) }
            : undefined,
        result: forum?.result
            ? {
                  ...forum.result,
                  team: team?.snapshot.shortCode ?? team?.snapshot.name,
                  side,
              }
            : null,
        stats,
        source: provider
            ? { server: event.server?.trim() || undefined, provider }
            : undefined,
        performanceImage: recapPerformanceImageUrl(
            input.recap.userId,
            event.id
        ),
        statsUrl: recapStatsUrl(language, input.recap.userId, event.id),
        settingsUrl: dmSettingsUrl(language),
        enabled: input.enabled,
        copy: getDirectMessages(language),
        rosterCopy: getRosterMessages(language),
        frame: dmFrame(config, forum?.clanName ?? ""),
    })
}

export async function processMatchRecaps(client: Client, eventId: string) {
    const recaps = (await convex.query(references.getPendingMatchRecaps, {
        secret: env.internalSecret,
        eventId: eventId as never,
        deliveryVersion: 2,
    })) as PendingMatchRecap[]
    if (!recaps.length) return
    const inputs = await loadRecapInputs(eventId)
    if (!inputs) {
        logWarn("match-recaps", "Match context is not available", { eventId })
        return
    }
    // "Shrnutí zápasu" is a clan switch on "Zprávy a panely" (N1-20); the
    // player's own switch still applies when it is on.
    if (!isMessageEnabled(inputs.context.config, "matchRecapDm")) return
    const options = {
        language: inputs.context.config.defaultLanguage,
        style: inputs.context.config.messageStyle,
    }
    for (const candidate of recaps) {
        if (!candidate.recapId || !/^\d{17,20}$/.test(candidate.discordUserId))
            continue
        const user = await client.users
            .fetch(candidate.discordUserId)
            .catch(() => null)
        if (!user) continue
        // Fetching Discord can take time. Re-read the binding and opt-out immediately before sending.
        const recap = (await convex.query(
            references.prepareMatchRecapDelivery,
            {
                secret: env.internalSecret,
                recapId: candidate.recapId,
                eventId,
                discordUserId: candidate.discordUserId,
            }
        )) as PendingMatchRecap | null
        if (
            !recap ||
            recap.recapId !== candidate.recapId ||
            recap.discordUserId !== candidate.discordUserId ||
            recap.userId !== candidate.userId
        )
            continue
        const sent = await user
            .send(
                messagePayload(
                    buildMatchRecapView({
                        inputs,
                        recap,
                        discordUserId: recap.discordUserId,
                        enabled: true,
                    }),
                    options
                )
            )
            .then(() => true)
            .catch(() => false)
        if (sent)
            await convex.mutation(references.markMatchRecapSent, {
                secret: env.internalSecret,
                recapId: recap.recapId,
                discordUserId: recap.discordUserId,
            })
    }
}
