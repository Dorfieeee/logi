"use client"

import {
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts"
import type { PerformanceSnapshot } from "@/lib/read-models/performance-history"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { playerStatProfile } from "@/domain/player-stats/game-metrics"
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react"
import { resolveGameScope } from "@/domain/games/game"
import type { Dictionary } from "@/i18n/dictionaries"
import { formatKd } from "@/lib/format"

type ChartKind =
    | "effectiveness"
    | "playerEffectiveness"
    | "combat"
    | "points"
    | "kd"
    | "cash"

function PerformanceTooltip({
    active,
    label,
    payload,
    matches,
    fallbackLabel,
    locale,
}: {
    active?: boolean
    label?: string | number
    payload?: ReadonlyArray<{
        name?: string
        dataKey?: unknown
        value?: string | number
        color?: string
    }>
    matches: PerformanceSnapshot[]
    fallbackLabel: string
    locale: string
}) {
    if (!active || !payload?.length) return null
    const match =
        typeof label === "number" ? matches[Number(label) - 1] : undefined
    return (
        <div className="border-border bg-popover text-popover-foreground min-w-40 rounded-xl border px-3 py-2 text-sm shadow-lg">
            <p className="mb-2 font-medium">
                {match?.label ?? `${fallbackLabel} ${label ?? ""}`}
            </p>
            <div className="space-y-1">
                {payload.map((item) => (
                    <div
                        key={item.name}
                        className="flex items-center justify-between gap-5"
                    >
                        <span className="text-muted-foreground flex items-center gap-2">
                            <span
                                className="size-2 rounded-full"
                                style={{ backgroundColor: item.color }}
                            />
                            {item.name}
                        </span>
                        <span className="font-medium tabular-nums">
                            {item.dataKey === "kd" &&
                            typeof item.value === "number"
                                ? formatKd(item.value, locale)
                                : typeof item.value === "number"
                                  ? new Intl.NumberFormat(locale, {
                                        maximumFractionDigits: 2,
                                    }).format(item.value)
                                  : item.value}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    )
}

export function PerformanceHistoryChart({
    title,
    matches,
    dictionary,
    kind = "effectiveness",
    gameId,
    locale = "en",
}: {
    title: string
    matches: PerformanceSnapshot[]
    dictionary: Dictionary
    kind?: ChartKind
    gameId?: string
    locale?: string
}) {
    const activeGame = gameId ?? matches[0]?.gameId
    const profile = playerStatProfile(activeGame)
    if (!profile || (profile.kind === "wardogs" && kind === "points"))
        return null
    matches = matches.filter(
        (match) =>
            resolveGameScope(match.gameId) === resolveGameScope(activeGame)
    )
    if (
        profile.kind === "wardogs" &&
        (kind === "effectiveness" || kind === "playerEffectiveness")
    )
        kind = profile.primaryChart
    if (kind === "cash") title = dictionary.gameHistory.cash
    const data = [...matches]
        .reverse()
        .map((match, index) => ({ ...match, match: index + 1 }))
    const recent = matches.slice(0, 5),
        previous = matches.slice(5, 10)
    const field =
        kind === "cash"
            ? "cashDelta"
            : kind === "points"
              ? "points"
              : kind === "kd"
                ? "kd"
                : kind === "combat"
                  ? "kd"
                  : "combat"
    const average = (rows: PerformanceSnapshot[]) =>
        rows.length
            ? rows.reduce((sum, row) => sum + (row[field] ?? 0), 0) /
              rows.length
            : 0
    const change =
        previous.length &&
        (kind !== "cash" ||
            [...recent, ...previous].every((row) => row.cashDelta != null))
            ? average(recent) - average(previous)
            : null
    const Trend =
        change === null ? Minus : change >= 0 ? ArrowUpRight : ArrowDownRight
    const copy = dictionary.clan
    const isKdComparison = kind === "kd" || kind === "combat"
    const roundedChange =
        change === null
            ? ""
            : `${change >= 0 ? "+" : ""}${isKdComparison ? formatKd(change, locale) : Math.round(change)}`
    const metricName =
        kind === "cash"
            ? dictionary.gameHistory.cash
            : kind === "points"
              ? copy.points
              : copy.kd
    const comparisonMetric =
        kind === "cash"
            ? dictionary.gameHistory.cash
            : kind === "points"
              ? copy.points
              : kind === "kd" || kind === "combat"
                ? copy.kd
                : copy.combatEffectiveness
    const playerTrendFields: Array<["kd" | "offense" | "support", string]> = [
        ["kd", copy.kd],
        ["offense", copy.combatEffectiveness],
        ["support", copy.supportEffectiveness],
    ]

    return (
        <Card className="border-border/60 overflow-hidden rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
                <div>
                    <CardTitle>{title}</CardTitle>
                    <p className="text-muted-foreground mt-1 text-sm">
                        {copy.performanceLastMatches.replace(
                            "{count}",
                            String(matches.length)
                        )}
                    </p>
                </div>
                {kind === "playerEffectiveness" && previous.length ? (
                    <div className="flex flex-wrap justify-end gap-3">
                        {playerTrendFields.map(([key, label]) => {
                            const rawDelta =
                                (recent.length
                                    ? recent.reduce(
                                          (sum, row) => sum + row[key],
                                          0
                                      ) / recent.length
                                    : 0) -
                                previous.reduce(
                                    (sum, row) => sum + row[key],
                                    0
                                ) /
                                    previous.length
                            const delta =
                                key === "kd"
                                    ? Number(rawDelta.toFixed(2))
                                    : Math.round(rawDelta)
                            const formattedDelta =
                                key === "kd"
                                    ? `${delta >= 0 ? "+" : ""}${formatKd(delta, locale)}`
                                    : `${delta >= 0 ? "+" : ""}${delta}`
                            const Icon =
                                delta >= 0 ? ArrowUpRight : ArrowDownRight
                            return (
                                <span
                                    key={key}
                                    className={
                                        delta >= 0
                                            ? "flex items-center text-xs font-medium text-emerald-600"
                                            : "flex items-center text-xs font-medium text-rose-600"
                                    }
                                >
                                    <Icon className="size-3.5" />
                                    {label} {formattedDelta}
                                </span>
                            )
                        })}
                    </div>
                ) : change !== null ? (
                    <span
                        className={
                            change >= 0
                                ? "flex items-center text-sm font-medium text-emerald-600"
                                : "flex items-center text-sm font-medium text-rose-600"
                        }
                    >
                        <Trend className="size-4" />
                        {copy.performanceComparedWithPrevious
                            .replace("{change}", roundedChange)
                            .replace("{metric}", comparisonMetric)
                            .replace("{count}", String(previous.length))}
                    </span>
                ) : null}
            </CardHeader>
            <CardContent>
                {data.length ? (
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={data}>
                                <CartesianGrid
                                    vertical={false}
                                    strokeDasharray="3 3"
                                />
                                <XAxis
                                    dataKey="match"
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    allowDecimals={isKdComparison}
                                    tickFormatter={
                                        isKdComparison
                                            ? (val: number) =>
                                                  formatKd(val, locale)
                                            : undefined
                                    }
                                    tickLine={false}
                                    axisLine={false}
                                    width="auto"
                                />
                                <Tooltip
                                    content={(props) => (
                                        <PerformanceTooltip
                                            {...props}
                                            matches={data}
                                            fallbackLabel={copy.matchesPlayed}
                                            locale={locale}
                                        />
                                    )}
                                />
                                <Legend />
                                {kind === "effectiveness" ? (
                                    <>
                                        <Line
                                            type="monotone"
                                            dataKey="combat"
                                            name={copy.combatEffectiveness}
                                            stroke="#f59e0b"
                                            strokeWidth={2.5}
                                            dot={false}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="support"
                                            name={copy.supportEffectiveness}
                                            stroke="#8b5cf6"
                                            strokeWidth={2.5}
                                            dot={false}
                                        />
                                    </>
                                ) : kind === "playerEffectiveness" ? (
                                    <>
                                        <Line
                                            type="monotone"
                                            dataKey="offense"
                                            name={copy.combatEffectiveness}
                                            stroke="#10b981"
                                            strokeWidth={2.5}
                                            dot={false}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="support"
                                            name={copy.supportEffectiveness}
                                            stroke="#8b5cf6"
                                            strokeWidth={2.5}
                                            dot={false}
                                        />
                                    </>
                                ) : kind === "combat" ? (
                                    <>
                                        <Line
                                            type="monotone"
                                            dataKey="kills"
                                            name={copy.kills}
                                            stroke="#10b981"
                                            strokeWidth={2.5}
                                            dot={false}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="deaths"
                                            name={copy.deaths}
                                            stroke="#f43f5e"
                                            strokeWidth={2.5}
                                            dot={false}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="kd"
                                            name={copy.kd}
                                            stroke="#f59e0b"
                                            strokeWidth={2.5}
                                            dot={false}
                                        />
                                    </>
                                ) : (
                                    <Line
                                        type="monotone"
                                        dataKey={field}
                                        name={metricName}
                                        stroke={
                                            kind === "points"
                                                ? "#38bdf8"
                                                : "#f59e0b"
                                        }
                                        strokeWidth={3}
                                        dot={{ r: 3 }}
                                    />
                                )}
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <p className="text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">
                        {copy.performanceNoData}
                    </p>
                )}
            </CardContent>
        </Card>
    )
}
