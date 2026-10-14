import { gameLabel } from "@/domain/games/game"
import { notFound } from "next/navigation"
import { connection } from "next/server"
import type { Metadata } from "next"
import { Suspense } from "react"
import Image from "next/image"
import Link from "next/link"

import {
    getPublicImageDimensions,
    getPublicImageVersion,
} from "@/lib/public-image-version"
import {
    PublicPage,
    PublicSiteShell,
} from "@/components/public/public-site-shell"
import { PerformanceHistoryChart } from "@/components/app/performance-history-chart"
import { PlayerTrendIndicators } from "@/components/app/player-trend-indicators"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PublicBreadcrumbs } from "@/components/public/public-breadcrumbs"
import { getPublicPlayerProfile } from "@/lib/read-models/public-profiles"
import { getPublicPreviewMetadata } from "@/lib/public-preview-metadata"
import { playerMatchSnapshot } from "@/lib/player-stat-presentation"
import { PublicStat } from "@/components/public/public-stat"
import { GameBadge } from "@/components/app/game-badge"
import { getDictionary } from "@/i18n/dictionaries"
import { getLocalizedCanonical } from "@/lib/seo"
import { Badge } from "@/components/ui/badge"
import { isLocale } from "@/i18n/config"
import { formatKd } from "@/lib/format"

type Props = {
    params: Promise<{ locale: string; playerId: string }>
    searchParams?: Promise<{ game?: string }>
}

async function ConnectionMarker() {
    await connection()
    return null
}

function DynamicMetadataMarker() {
    return (
        <Suspense>
            <ConnectionMarker />
        </Suspense>
    )
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { locale, playerId } = await params
    const safeLocale = isLocale(locale) ? locale : "en"
    const preview = await getPublicPreviewMetadata("player", playerId)
    const title = preview?.title ?? "Player profile"
    const description =
        preview?.description ??
        "Public player profile and recorded match history."
    const imageVersion = getPublicImageVersion(
        preview?.imageVersion ?? "current"
    )
    const image = `/api/og/player/${playerId}?v=${encodeURIComponent(imageVersion)}&locale=${safeLocale}`
    const imageDimensions = getPublicImageDimensions(imageVersion)
    return {
        title,
        description,
        alternates: getLocalizedCanonical(safeLocale, `/players/${playerId}`),
        openGraph: {
            title,
            description,
            images: [{ url: image, ...imageDimensions }],
        },
        twitter: { card: "summary_large_image", images: [image] },
    }
}

export default async function PublicPlayerPage({
    params,
    searchParams,
}: Props) {
    const { locale, playerId } = await params
    const resolvedLocale = isLocale(locale) ? locale : "en"
    const dictionary = getDictionary(resolvedLocale)
    const player = await getPublicPlayerProfile(
        playerId,
        (await searchParams)?.game
    )
    if (!player) notFound()
    const number = new Intl.NumberFormat(resolvedLocale)
    const performanceHistory = player.recentMatches.map(playerMatchSnapshot)

    return (
        <PublicSiteShell locale={resolvedLocale} current="community">
            <PublicPage>
                <div className="space-y-6">
                    <PublicBreadcrumbs
                        items={[
                            {
                                label: dictionary.app.name,
                                href: `/${resolvedLocale}`,
                            },
                            {
                                label: dictionary.publicProfiles.communityTitle,
                                href: `/${resolvedLocale}/community`,
                            },
                            { label: player.name },
                        ]}
                    />
                    <section className="bg-card flex flex-col gap-5 rounded-3xl border p-6 sm:flex-row sm:items-center">
                        <Image
                            src={player.avatar}
                            alt=""
                            width={112}
                            height={112}
                            className="size-24 rounded-2xl object-cover"
                        />
                        <div className="min-w-0 flex-1">
                            <h1 className="truncate text-3xl font-semibold tracking-tight">
                                {player.name}
                            </h1>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {player.clans.map((clan) => (
                                    <Badge
                                        key={clan.id}
                                        variant="secondary"
                                        className="max-w-full gap-2 whitespace-normal"
                                    >
                                        <span className="min-w-0 break-words">
                                            {clan.name}
                                        </span>
                                        <span className="inline-flex shrink-0 gap-1">
                                            {clan.gameIds.map((gameId) => (
                                                <GameBadge
                                                    key={gameId}
                                                    gameId={gameId}
                                                    dictionary={dictionary}
                                                    className="size-4"
                                                />
                                            ))}
                                        </span>
                                    </Badge>
                                ))}
                            </div>
                        </div>
                        <div
                            className={`grid gap-5 text-center ${player.gameId === "wardogs" ? "grid-cols-3 sm:grid-cols-5" : "grid-cols-3"}`}
                        >
                            <PublicStat
                                label={dictionary.publicProfiles.matches}
                                value={number.format(player.stats.matches)}
                            />
                            <PublicStat
                                label={dictionary.publicProfiles.kd}
                                value={formatKd(
                                    player.stats.kd,
                                    resolvedLocale
                                )}
                            />
                            <PublicStat
                                label={dictionary.publicProfiles.kills}
                                value={number.format(player.stats.kills)}
                            />
                            {player.gameId === "wardogs" ? (
                                <>
                                    <PublicStat
                                        label={dictionary.publicProfiles.deaths}
                                        value={number.format(
                                            player.stats.deaths
                                        )}
                                    />
                                    <PublicStat
                                        label={dictionary.gameHistory.cash}
                                        help={dictionary.gameHistory.cashHelp}
                                        value={
                                            player.stats.cashDelta == null
                                                ? dictionary.common.notAvailable
                                                : number.format(
                                                      player.stats.cashDelta
                                                  )
                                        }
                                    />
                                </>
                            ) : null}
                        </div>
                    </section>
                    <nav
                        aria-label={dictionary.games.filterLabel}
                        className="flex flex-wrap gap-2"
                    >
                        {player.games.map((game) => (
                            <Link
                                key={game}
                                href={`/${resolvedLocale}/players/${player.id}?game=${encodeURIComponent(game)}`}
                                aria-current={
                                    game === player.gameId ? "page" : undefined
                                }
                                className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm"
                            >
                                <GameBadge
                                    gameId={game}
                                    dictionary={dictionary}
                                />
                                {gameLabel(game)}
                            </Link>
                        ))}
                    </nav>
                    {performanceHistory.length ? (
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between gap-4">
                                <CardTitle>
                                    {dictionary.clan.playerPerformanceTrend}
                                </CardTitle>
                                <PlayerTrendIndicators
                                    matches={performanceHistory}
                                    dictionary={dictionary}
                                    locale={resolvedLocale}
                                />
                            </CardHeader>
                        </Card>
                    ) : null}
                    <div className="grid gap-6 xl:grid-cols-2">
                        <PerformanceHistoryChart
                            title={dictionary.clan.playerPerformanceTrend}
                            matches={performanceHistory}
                            dictionary={dictionary}
                            locale={resolvedLocale}
                            kind="playerEffectiveness"
                        />
                        <PerformanceHistoryChart
                            title={dictionary.clan.kd}
                            matches={performanceHistory}
                            dictionary={dictionary}
                            locale={resolvedLocale}
                            kind="combat"
                        />
                    </div>
                    <Card>
                        <CardHeader>
                            <CardTitle>
                                {dictionary.publicProfiles.matchHistory}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {player.recentMatches.map((match) => (
                                <Link
                                    key={match.eventId}
                                    href={`/${resolvedLocale}/players/${player.id}/matches/${match.eventId}`}
                                    className="hover:bg-muted grid gap-2 rounded-xl border p-4 transition-colors sm:grid-cols-[1fr_auto_auto_auto] sm:items-center"
                                >
                                    <div>
                                        <p className="font-medium">
                                            {match.name}
                                        </p>
                                        <p className="text-muted-foreground text-sm">
                                            {match.mapName ??
                                                dictionary.shared.notSet}{" "}
                                            ·{" "}
                                            {new Intl.DateTimeFormat(
                                                resolvedLocale === "cs"
                                                    ? "cs-CZ"
                                                    : resolvedLocale === "de"
                                                      ? "de-DE"
                                                      : "en-GB",
                                                { dateStyle: "medium" }
                                            ).format(new Date(match.endedAt))}
                                        </p>
                                    </div>
                                    <PublicStat
                                        label={dictionary.publicProfiles.kills}
                                        value={number.format(match.kills)}
                                    />
                                    <PublicStat
                                        label={dictionary.publicProfiles.deaths}
                                        value={number.format(match.deaths)}
                                    />
                                    {match.gameId === "wardogs" ? (
                                        <PublicStat
                                            label={dictionary.gameHistory.cash}
                                            help={
                                                dictionary.gameHistory.cashHelp
                                            }
                                            value={
                                                match.cashDelta == null
                                                    ? dictionary.common
                                                          .notAvailable
                                                    : number.format(
                                                          match.cashDelta
                                                      )
                                            }
                                        />
                                    ) : null}
                                    <PublicStat
                                        label={dictionary.publicProfiles.kd}
                                        value={formatKd(
                                            match.killDeathRatio,
                                            resolvedLocale
                                        )}
                                    />
                                </Link>
                            ))}
                        </CardContent>
                    </Card>
                    <DynamicMetadataMarker />
                </div>
            </PublicPage>
        </PublicSiteShell>
    )
}
