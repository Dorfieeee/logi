import {
    CalendarDays,
    ClipboardList,
    Info,
    Radio,
    Target,
    Trophy,
    Users,
} from "lucide-react"
import Link from "next/link"

import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { PerformanceHistoryChart } from "@/components/app/performance-history-chart"
import type { PerformanceSnapshot } from "@/lib/read-models/performance-history"
import type { RecentMatchSummary } from "@/lib/read-models/server-dashboard"
import { StatCard } from "@/components/app/stat-card"
import type { Dictionary } from "@/i18n/dictionaries"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export type ClanStatTotals = {
    upcomingEvents: number
    nextEventName?: string
    publishedRosters: number
    rosters: number
    members: number
    assignments: number
    presets: number
}

const outcomeTone = {
    victory: "text-emerald-700 dark:text-emerald-400",
    defeat: "text-red-700 dark:text-red-400",
    draw: "text-muted-foreground",
} as const

/**
 * The clan's statistics under the overview: totals, performance charts over
 * the recorded matches, and the last ten results with the top players.
 */
export function ClanStatsSection({
    totals,
    performance,
    recent,
    matchHref,
    playerHref,
    dictionary,
    locale = "en",
}: {
    totals: ClanStatTotals
    performance: PerformanceSnapshot[]
    recent: RecentMatchSummary | null
    matchHref: (eventId: string) => string
    playerHref: (userId: string) => string
    dictionary: Dictionary
    locale?: string
}) {
    const text = dictionary.clan
    const outcomes = {
        victory: dictionary.publicProfiles.victory,
        defeat: dictionary.publicProfiles.defeat,
        draw: text.draw,
    }
    const topPlayers = recent?.topPlayers ?? []
    return (
        <section aria-labelledby="overview-stats" className="space-y-4 pt-2">
            <h2
                id="overview-stats"
                className="text-muted-foreground text-xs font-semibold tracking-wide uppercase"
            >
                {dictionary.clanOverview.statsTitle}
            </h2>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(13rem,100%),1fr))] gap-4">
                <StatCard
                    title={text.upcomingEvents}
                    value={totals.upcomingEvents}
                    description={
                        totals.nextEventName ?? dictionary.common.notAvailable
                    }
                    icon={CalendarDays}
                />
                <StatCard
                    title={text.publishedRosters}
                    value={totals.publishedRosters}
                    description={`${totals.rosters} ${dictionary.sidebar.rosters.toLowerCase()}`}
                    icon={Radio}
                />
                <StatCard
                    title={text.members}
                    value={totals.members}
                    description={`${totals.assignments} ${dictionary.userManagement.title.toLowerCase()}`}
                    icon={Users}
                />
                <StatCard
                    title={text.presets}
                    value={totals.presets}
                    description={dictionary.sidebar.configuration}
                    icon={ClipboardList}
                />
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
                <PerformanceHistoryChart
                    title={text.performanceTrend}
                    matches={performance}
                    dictionary={dictionary}
                    kind="effectiveness"
                    locale={locale}
                />
                <PerformanceHistoryChart
                    title={text.kd}
                    matches={performance}
                    dictionary={dictionary}
                    kind="combat"
                    locale={locale}
                />
                <div className="xl:col-span-2">
                    <PerformanceHistoryChart
                        title={text.points}
                        matches={performance}
                        dictionary={dictionary}
                        kind="points"
                        locale={locale}
                    />
                </div>
            </div>
            <section
                aria-labelledby="overview-recent-games"
                className="bg-card space-y-5 rounded-2xl border p-5 sm:p-6"
            >
                <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                        <h3
                            id="overview-recent-games"
                            className="text-base font-semibold"
                        >
                            {text.recentGames}
                        </h3>
                        <p className="text-muted-foreground text-sm">
                            {text.lastTenGames}
                        </p>
                    </div>
                    <Trophy
                        className="size-5 text-amber-500"
                        aria-hidden="true"
                    />
                </div>
                {recent?.recentMatches.length ? (
                    <>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <StatCard
                                title={text.record}
                                value={`${recent.wins}W - ${recent.losses}L`}
                                description={text.lastTenGames}
                                icon={Trophy}
                            />
                            <StatCard
                                title={text.winRate}
                                value={`${Math.round(recent.winRate * 100)}%`}
                                description={text.lastTenGames}
                                icon={Trophy}
                            />
                        </div>
                        <ul className="space-y-2">
                            {recent.recentMatches.map((match) => (
                                <li key={match.id}>
                                    <Link
                                        href={matchHref(match.id)}
                                        className="hover:bg-muted/60 focus-visible:ring-ring/50 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 transition outline-none focus-visible:ring-[3px]"
                                    >
                                        <span className="min-w-0 font-medium break-words">
                                            {match.name}
                                        </span>
                                        <span className="flex items-center gap-3">
                                            <span
                                                className={cn(
                                                    "text-sm font-medium",
                                                    outcomeTone[match.outcome]
                                                )}
                                            >
                                                {outcomes[match.outcome]}
                                            </span>
                                            <span className="font-semibold tabular-nums">
                                                {match.score.sideA} –{" "}
                                                {match.score.sideB}
                                            </span>
                                        </span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                        <div className="space-y-3 border-t pt-5">
                            <div className="flex items-center gap-1.5">
                                <h4 className="font-semibold">
                                    {text.topPlayers}
                                </h4>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            type="button"
                                            className="text-muted-foreground hover:text-foreground rounded-full"
                                            aria-label={
                                                text.topPlayersCalculation
                                            }
                                        >
                                            <Info className="size-4" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-72">
                                        {text.topPlayersCalculation}
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                            {topPlayers.length ? (
                                <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(11rem,100%),1fr))] gap-3">
                                    {topPlayers.map((player, index) => (
                                        <li key={player.id}>
                                            <Link
                                                href={playerHref(player.id)}
                                                className="hover:bg-muted/60 block h-full rounded-xl border p-3 transition"
                                            >
                                                <span className="flex items-center justify-between gap-2">
                                                    <span className="truncate font-medium">
                                                        #{index + 1}{" "}
                                                        {player.name}
                                                    </span>
                                                    <span className="flex shrink-0 items-center gap-1 text-sm font-semibold tabular-nums">
                                                        <Target
                                                            className="text-muted-foreground size-3.5"
                                                            aria-hidden="true"
                                                        />
                                                        {player.kills}{" "}
                                                        {text.kills}
                                                    </span>
                                                </span>
                                                <span className="text-muted-foreground mt-1 block text-xs">
                                                    {player.matches}{" "}
                                                    {text.matchesPlayed}
                                                </span>
                                                {player.roles.length ? (
                                                    <span className="mt-3 flex flex-wrap gap-1.5">
                                                        {player.roles.map(
                                                            (role) => (
                                                                <Badge
                                                                    key={`${role.name}:${role.icon ?? ""}`}
                                                                    variant="secondary"
                                                                    className="gap-1 rounded-full px-2 py-1 text-xs"
                                                                >
                                                                    {role.icon ? (
                                                                        <img
                                                                            src={
                                                                                role.icon
                                                                            }
                                                                            alt=""
                                                                            className="size-3.5 object-contain invert dark:invert-0"
                                                                        />
                                                                    ) : null}
                                                                    {role.name}
                                                                </Badge>
                                                            )
                                                        )}
                                                    </span>
                                                ) : null}
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-muted-foreground text-sm">
                                    {text.noPlayerStats}
                                </p>
                            )}
                        </div>
                    </>
                ) : (
                    <p className="text-muted-foreground rounded-xl border border-dashed px-4 py-8 text-center text-sm">
                        {text.noRecentGames}
                    </p>
                )}
            </section>
        </section>
    )
}
