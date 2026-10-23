import {
    formatHllPresetLabel,
    inferHllSelection,
} from "../../src/lib/hll-map-presets"
import type { getEventMessages } from "../../src/lib/clan-language/events"
import type { GameId } from "../../src/domain/games/game"

const MARKDOWN = /([\\`*_{}[\]()#+\-.!|>~<@])/g

/**
 * "Foy · den" in the clan language: the map, its time of day and the mode when
 * it is not warfare. Unknown values are shown as stored, escaped and on one
 * line.
 */
export function formatMapLabel(
    map: string | null | undefined,
    gameId: GameId | undefined,
    messages: ReturnType<typeof getEventMessages>
) {
    const value = map?.trim()
    if (!value) return undefined
    const selection = inferHllSelection(value, gameId)
    if (!selection) {
        return (formatHllPresetLabel(value, gameId) ?? value)
            .replace(/[\s\p{Cc}]+/gu, " ")
            .replace(MARKDOWN, "\\$1")
    }
    return [
        formatHllPresetLabel(selection.mapId, gameId) ?? selection.mapId,
        messages.mapLabels.times[selection.time],
        selection.mode === "warfare"
            ? undefined
            : messages.mapLabels.modes[selection.mode],
    ]
        .filter(Boolean)
        .join(" · ")
}

/** The configured map facts, including an HLL strongpoint or another game-specific target. */
export function formatMapDetails(
    map: string | null | undefined,
    cap: string | null | undefined,
    gameId: GameId | undefined,
    messages: ReturnType<typeof getEventMessages>
) {
    const mapLabel = formatMapLabel(map, gameId, messages)
    const target = cap
        ?.trim()
        .replace(/[\s\p{Cc}]+/gu, " ")
        .replace(MARKDOWN, "\\$1")
    return (
        [mapLabel, target]
            .filter((value): value is string => Boolean(value))
            .join(" · ") || undefined
    )
}
