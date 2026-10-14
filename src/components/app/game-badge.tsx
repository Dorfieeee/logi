import { DEFAULT_GAME_ID, gameLabel, type GameId } from "@/domain/games/game"
import type { Dictionary } from "@/i18n/dictionaries"
import { cn } from "@/lib/utils"

export const GAME_ICON_SOURCES: Partial<Record<GameId, string>> = {
    hell_let_loose: "/img/games/hll.jpg",
    hell_let_loose_vietnam: "/img/games/hllv.png",
    wardogs: "/img/games/wardogs.jpg",
    world_of_warcraft_forever: "/img/games/wowf.png",
}

export function GameBadge({
    gameId,
    dictionary,
    className,
}: {
    gameId?: GameId
    dictionary: Dictionary
    className?: string
}) {
    const resolvedGame = gameId ?? DEFAULT_GAME_ID

    return (
        <span
            className={cn(
                "border-border/70 bg-muted inline-flex size-5 shrink-0 overflow-hidden rounded-full border shadow-sm",
                className
            )}
            role="img"
            aria-label={`${dictionary.games.column}: ${gameLabel(resolvedGame)}`}
            title={gameLabel(resolvedGame)}
        >
            {GAME_ICON_SOURCES[resolvedGame] ? (
                <img
                    src={GAME_ICON_SOURCES[resolvedGame]}
                    alt=""
                    className="size-full object-cover"
                />
            ) : (
                <span className="flex size-full items-center justify-center text-[9px] font-semibold">
                    {gameLabel(resolvedGame).slice(0, 1).toUpperCase()}
                </span>
            )}
        </span>
    )
}
