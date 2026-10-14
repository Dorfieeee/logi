import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import type { PerformanceSnapshot } from "@/lib/read-models/performance-history"
import { ArrowDownRight, ArrowUpRight, Crosshair, Swords } from "lucide-react"
import { playerStatProfile } from "@/domain/player-stats/game-metrics"
import { playerMetricLabels } from "@/lib/player-stat-presentation"
import { resolveGameScope } from "@/domain/games/game"
import type { Dictionary } from "@/i18n/dictionaries"
import { formatKd } from "@/lib/format"

export function PlayerTrendIndicators({
    matches,
    dictionary,
    locale = "en",
}: {
    matches: PerformanceSnapshot[]
    dictionary: Dictionary
    locale?: string
}) {
    const gameId = matches[0]?.gameId
    const profile = playerStatProfile(gameId)
    if (!profile) return null
    matches = matches.filter(
        (match) => resolveGameScope(match.gameId) === resolveGameScope(gameId)
    )
    const recent = matches.slice(0, 5),
        previous = matches.slice(5, 10)
    if (!previous.length)
        return <span className="text-muted-foreground text-xs">—</span>
    const labels = playerMetricLabels(dictionary)
    const metrics = profile.trends.map(
        (key) =>
            [
                key,
                labels[key],
                key === "offense" || key === "kills" ? Crosshair : Swords,
            ] as const
    )
    return (
        <div className="flex flex-wrap gap-x-2 gap-y-1">
            {metrics.map(([key, label, MetricIcon]) => {
                if ([...recent, ...previous].some((row) => row[key] == null))
                    return null
                const average = (rows: PerformanceSnapshot[]) =>
                    rows.reduce((total, row) => total + (row[key] ?? 0), 0) /
                    rows.length
                const rawDelta = average(recent) - average(previous)
                const delta =
                    key === "kd"
                        ? Number(rawDelta.toFixed(2))
                        : Math.round(rawDelta)
                const formattedDelta =
                    key === "kd"
                        ? `${delta >= 0 ? "+" : ""}${formatKd(delta, locale)}`
                        : `${delta >= 0 ? "+" : ""}${new Intl.NumberFormat(locale).format(delta)}`
                const Icon = delta >= 0 ? ArrowUpRight : ArrowDownRight
                return (
                    <Tooltip key={key}>
                        <TooltipTrigger asChild>
                            <span
                                className={
                                    delta >= 0
                                        ? "flex items-center text-xs font-medium text-emerald-600 dark:text-emerald-400"
                                        : "flex items-center text-xs font-medium text-rose-600 dark:text-rose-400"
                                }
                            >
                                <MetricIcon className="size-3" />
                                <Icon className="size-3" />
                                {formattedDelta}
                            </span>
                        </TooltipTrigger>
                        <TooltipContent>{label}</TooltipContent>
                    </Tooltip>
                )
            })}
        </div>
    )
}
