import { CalendarClock, Swords } from "lucide-react"
import { SiDiscord } from "react-icons/si"
import Image from "next/image"
import Link from "next/link"

import type {
    CompetitionPlacement,
    PublicClanResult,
    PublicUpcomingMatch,
} from "@/domain/workspaces/public-clan-page"
import { PerformanceHistoryChart } from "@/components/app/performance-history-chart"
import type { PublicClanPageDetails } from "@/lib/read-models/public-clan-page"
import { GAME_LABELS, type GameId } from "@/domain/games/game"
import { EmptyState } from "@/components/app/empty-state"
import type { Dictionary } from "@/i18n/dictionaries"
import type { Locale } from "@/i18n/config"
import { pluralize } from "@/i18n/plural"
import { cn } from "@/lib/utils"

/** The clan profile `getPublicClan` reads. */
export type PublicClanProfile = {
    id: string
    name: string
    avatar: string
    description?: string
    memberCount: number
    stats: { matches: number; wins: number; winRate: number }
}

type PerformanceMatches = Parameters<
    typeof PerformanceHistoryChart
>[0]["matches"]

const GAME_SHORT: Record<GameId, string> = {
    hell_let_loose: "HLL",
    hell_let_loose_vietnam: "HLLV",
    wardogs: "Wardogs",
    world_of_warcraft_forever: "WoW:F",
}

/**
 * Public clan page (design J2): hero with the clan's games, member count and
 * Discord invite, the match/win/competition stats, announced upcoming matches
 * and recent results. The performance charts the page had before follow below.
 */
export function PublicClanView({
    clan,
    details,
    performanceHistory,
    locale,
    dictionary,
}: {
    clan: PublicClanProfile
    details: PublicClanPageDetails
    performanceHistory: PerformanceMatches
    locale: Locale
    dictionary: Dictionary
}) {
    const t = dictionary.publicSite.clan
    const placement = details.placements[0]
    return (
        <div className="flex flex-col gap-7">
            <section
                aria-labelledby="clan-title"
                className="flex flex-wrap items-center gap-5"
            >
                <Image
                    src={clan.avatar}
                    alt=""
                    width={88}
                    height={88}
                    className="size-[88px] flex-none rounded-[20px] object-cover"
                />
                <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-1.5">
                    <h1
                        id="clan-title"
                        className="text-3xl leading-9 font-bold break-words"
                    >
                        {clan.name}
                    </h1>
                    {clan.description ? (
                        <p className="text-foreground/80 max-w-[60ch] text-[15px] leading-[22px]">
                            {clan.description}
                        </p>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-2 text-[13px]">
                        {details.games.map((gameId) => (
                            <span
                                key={gameId}
                                className="inline-flex h-6 items-center rounded-md border px-2"
                            >
                                {GAME_LABELS[gameId]}
                            </span>
                        ))}
                        <span className="text-muted-foreground inline-flex h-6 items-center px-2">
                            {pluralize(
                                locale,
                                clan.memberCount,
                                t.activeMembers
                            )}
                        </span>
                    </div>
                </div>
                {details.inviteUrl ? (
                    <a
                        href={details.inviteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-[#5865F2] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#4752c4] focus-visible:ring-2 focus-visible:ring-[#5865F2]/50 focus-visible:outline-none"
                    >
                        <SiDiscord aria-hidden="true" className="size-4" />
                        {t.joinDiscord}
                    </a>
                ) : null}
            </section>

            <dl
                aria-label={t.statsLabel}
                className="grid grid-cols-[repeat(auto-fit,minmax(min(160px,100%),1fr))] gap-3"
            >
                <Stat label={dictionary.publicProfiles.matches}>
                    <span className="text-2xl font-bold tabular-nums">
                        {clan.stats.matches}
                    </span>
                </Stat>
                <Stat label={dictionary.publicProfiles.wins}>
                    <span className="text-2xl font-bold tabular-nums">
                        {clan.stats.wins}
                    </span>
                    {clan.stats.matches > 0 ? (
                        <span className="text-muted-foreground text-sm font-medium">
                            {" · "}
                            {new Intl.NumberFormat(locale, {
                                style: "percent",
                            }).format(clan.stats.winRate)}
                        </span>
                    ) : null}
                </Stat>
                {placement ? (
                    <Stat label={t.competition}>
                        <span className="text-[15px] font-semibold">
                            <Link
                                href={`/${locale}/competitions/${placement.slug}`}
                                className="underline underline-offset-4"
                            >
                                {placementText(placement, t.place)}
                            </Link>
                        </span>
                    </Stat>
                ) : null}
            </dl>

            <div className="grid items-start gap-6 lg:grid-cols-2">
                <section
                    aria-labelledby="clan-upcoming"
                    className="flex min-w-0 flex-col gap-2.5"
                >
                    <h2 id="clan-upcoming" className="text-base font-semibold">
                        {t.upcoming}
                    </h2>
                    {details.upcoming.length ? (
                        <UpcomingList
                            matches={details.upcoming}
                            locale={locale}
                            dictionary={dictionary}
                        />
                    ) : (
                        <EmptyState
                            icon={CalendarClock}
                            title={t.noUpcoming}
                            className="p-5"
                        />
                    )}
                </section>
                <section
                    aria-labelledby="clan-recent"
                    className="flex min-w-0 flex-col gap-2.5"
                >
                    <h2 id="clan-recent" className="text-base font-semibold">
                        {t.recent}
                    </h2>
                    {details.results.length ? (
                        <ResultList
                            results={details.results}
                            locale={locale}
                            dictionary={dictionary}
                        />
                    ) : (
                        <EmptyState
                            icon={Swords}
                            title={t.noMatchesTitle}
                            description={t.noMatchesDescription}
                            className="p-5"
                        />
                    )}
                </section>
            </div>

            {performanceHistory.length ? (
                <section
                    aria-labelledby="clan-performance"
                    className="flex flex-col gap-2.5"
                >
                    <h2
                        id="clan-performance"
                        className="text-base font-semibold"
                    >
                        {dictionary.clan.performanceTrend}
                    </h2>
                    <div className="grid gap-6 xl:grid-cols-3">
                        <PerformanceHistoryChart
                            title={dictionary.clan.performanceTrend}
                            matches={performanceHistory}
                            dictionary={dictionary}
                            kind="effectiveness"
                            locale={locale}
                        />
                        <PerformanceHistoryChart
                            title={dictionary.clan.kd}
                            matches={performanceHistory}
                            dictionary={dictionary}
                            kind="combat"
                            locale={locale}
                        />
                        <PerformanceHistoryChart
                            title={dictionary.clan.points}
                            matches={performanceHistory}
                            dictionary={dictionary}
                            kind="points"
                            locale={locale}
                        />
                    </div>
                </section>
            ) : null}
        </div>
    )
}

function Stat({
    label,
    children,
}: {
    label: string
    children: React.ReactNode
}) {
    return (
        <div className="bg-card rounded-[14px] border px-[18px] py-4">
            <dt className="text-muted-foreground text-xs font-semibold tracking-[0.04em] uppercase">
                {label}
            </dt>
            <dd className="mt-1">{children}</dd>
        </div>
    )
}

function placementText(placement: CompetitionPlacement, placeTemplate: string) {
    return [
        `${placement.name} ${placement.season}`,
        placement.position
            ? placeTemplate.replace("{place}", String(placement.position))
            : null,
        placement.divisionCount > 1 ? placement.divisionName : null,
    ]
        .filter(Boolean)
        .join(" · ")
}

function UpcomingList({
    matches,
    locale,
    dictionary,
}: {
    matches: PublicUpcomingMatch[]
    locale: Locale
    dictionary: Dictionary
}) {
    const t = dictionary.publicSite.clan
    const format = new Intl.DateTimeFormat(locale, {
        weekday: "short",
        day: "numeric",
        month: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    })
    return (
        <ul className="divide-y overflow-hidden rounded-[14px] border">
            {matches.map((match) => (
                <li
                    key={match.eventId}
                    className="flex items-center gap-3 px-4 py-3"
                >
                    <time
                        dateTime={match.startsAt}
                        className="text-muted-foreground min-w-[5.5rem] shrink-0 text-xs whitespace-nowrap"
                    >
                        {format.format(new Date(match.startsAt))}
                    </time>
                    <span className="min-w-0 flex-1 text-sm font-semibold break-words">
                        {[
                            match.opponent
                                ? t.versus.replace("{opponent}", match.opponent)
                                : match.name,
                            match.label,
                        ]
                            .filter(Boolean)
                            .join(" · ")}
                    </span>
                    <abbr
                        title={GAME_LABELS[match.gameId]}
                        className="text-muted-foreground shrink-0 text-xs no-underline"
                    >
                        {GAME_SHORT[match.gameId]}
                    </abbr>
                </li>
            ))}
        </ul>
    )
}

function ResultList({
    results,
    locale,
    dictionary,
}: {
    results: PublicClanResult[]
    locale: Locale
    dictionary: Dictionary
}) {
    const t = dictionary.publicSite.clan
    const date = new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "numeric",
    })
    const outcomeLabel = {
        victory: dictionary.event.resultVictory,
        defeat: dictionary.event.resultDefeat,
        draw: dictionary.event.resultDraw,
    }
    return (
        <ul className="divide-y overflow-hidden rounded-[14px] border">
            {results.map((result) => {
                const score =
                    result.clanScore !== null && result.opponentScore !== null
                        ? `${result.clanScore} : ${result.opponentScore}`
                        : null
                return (
                    <li key={result.eventId}>
                        <Link
                            href={`/${locale}/matches/${result.eventId}`}
                            className="hover:bg-muted/50 flex items-center gap-3 px-4 py-3 transition-colors"
                        >
                            <span
                                className={cn(
                                    "flex size-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold",
                                    result.outcome === "victory"
                                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
                                        : "bg-muted text-muted-foreground"
                                )}
                            >
                                {result.outcome ? (
                                    <>
                                        <span aria-hidden="true">
                                            {t.outcomeShort[result.outcome]}
                                        </span>
                                        <span className="sr-only">
                                            {outcomeLabel[result.outcome]}
                                        </span>
                                    </>
                                ) : (
                                    "–"
                                )}
                            </span>
                            <span className="min-w-0 flex-1 text-sm font-semibold break-words">
                                {result.opponent
                                    ? t.versus.replace(
                                          "{opponent}",
                                          result.opponent
                                      )
                                    : result.name}
                                {score ? (
                                    <>
                                        {" "}
                                        <span className="tabular-nums">
                                            {score}
                                        </span>
                                    </>
                                ) : null}
                            </span>
                            <span className="text-muted-foreground shrink-0 text-xs">
                                {[
                                    result.mapName,
                                    date.format(new Date(result.endedAt)),
                                ]
                                    .filter(Boolean)
                                    .join(" · ")}
                            </span>
                        </Link>
                    </li>
                )
            })}
        </ul>
    )
}
