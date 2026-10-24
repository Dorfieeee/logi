import {
    commandDecisionCard,
    type CommandAccessCopy,
} from "../discord-commands/access-view"
import type { MessageView } from "../discord-messages/message-view"
import type { CommandReplyMode } from "../discord-commands/catalog"
import type { StatsCommandSettings } from "./command-settings"
import { buildStatsView, statsErrorCard } from "./stats-reply"
import type { WardogsPlayerStats } from "./player-stats"
import { statsCopy } from "./stats-copy"

const EXAMPLE_STEAM_ID = "76561198000000017"

/** Made-up numbers for the "Příkazy" page's preview (N3-14), labelled as an example. */
export function exampleWardogsStats(name: string): WardogsPlayerStats {
    const metric = (value: number) => ({ value, knownGames: 23 })
    return {
        player: {
            platform: "steam",
            platformId: EXAMPLE_STEAM_ID,
            name,
            lastSeen: "2026-10-03T18:00:00.000Z",
            matches: 23,
            wins: 14,
            losses: 9,
            draws: 0,
            unknownResults: 0,
            eligible: true,
            winRate: 14 / 23,
            kd: 1.37,
            metrics: {
                seconds: metric(111_600),
                kills: metric(412),
                deaths: metric(301),
                cashDelta: metric(18_400),
                headshots: metric(0),
                teamKills: metric(0),
                suicides: metric(0),
                vehicleKills: metric(0),
                combat: { value: null, knownGames: 0 },
                offense: { value: null, knownGames: 0 },
                defense: { value: null, knownGames: 0 },
                support: { value: null, knownGames: 0 },
            },
        },
        factions: [],
        recent: [],
    }
}

/**
 * What a member gets from `/stats` with the page's current settings: the
 * Wardogs overview with example data, or the reply people get when the
 * command or Wardogs statistics are off. Same builder as the bot.
 */
export function statsPreviewView(input: {
    language: string
    locale: string
    settings: StatsCommandSettings
    reply: CommandReplyMode
    accessCopy: CommandAccessCopy
    playerName: string
}): MessageView {
    const copy = statsCopy(input.language)
    if (!input.settings.enabled)
        return commandDecisionCard(
            { kind: "disabled" },
            { command: "stats", copy: input.accessCopy }
        )
    if (!input.settings.games.wardogs)
        return statsErrorCard(copy, "game_disabled", {
            gameLabel: copy.games.wardogs,
        })
    return buildStatsView({
        copy,
        locale: input.locale,
        game: "wardogs",
        period: "30d",
        result: {
            kind: "wardogs",
            steamId: EXAMPLE_STEAM_ID,
            name: input.playerName,
            stats: exampleWardogsStats(input.playerName),
            fetchedAt: null,
        },
        view: "overview",
        self: true,
        controls: {
            id: (action) => `preview:${action}`,
            share: input.reply === "privateShare",
        },
    })
}
