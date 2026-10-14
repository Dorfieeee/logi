import { notFound } from "next/navigation"
import { formatKd } from "@/lib/format"
import type { Metadata } from "next"
import Link from "next/link"

import {
    PublicPage,
    PublicSiteShell,
} from "@/components/public/public-site-shell"
import { PerformanceHistoryChart } from "@/components/app/performance-history-chart"
import { PlayerTrendIndicators } from "@/components/app/player-trend-indicators"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PublicBreadcrumbs } from "@/components/public/public-breadcrumbs"
import { getPublicPlayerMatch } from "@/lib/read-models/public-profiles"
import { playerMatchSnapshot } from "@/lib/player-stat-presentation"
import { PublicStat } from "@/components/public/public-stat"
import { getDictionary } from "@/i18n/dictionaries"
import { getLocalizedCanonical } from "@/lib/seo"
import { Button } from "@/components/ui/button"
import { isLocale } from "@/i18n/config"

type Props = {
    params: Promise<{ locale: string; playerId: string; eventId: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { locale, playerId, eventId } = await params
    const safeLocale = isLocale(locale) ? locale : "en"
    const image = `/api/og/player-match/${playerId}/${eventId}`
    return {
        alternates: getLocalizedCanonical(
            safeLocale,
            `/players/${playerId}/matches/${eventId}`
        ),
        openGraph: { images: [image] },
        twitter: { card: "summary_large_image", images: [image] },
    }
}

export default async function PublicPlayerMatchPage({ params }: Props) {
    const { locale, playerId, eventId } = await params
    const resolvedLocale = isLocale(locale) ? locale : "en"
    const dictionary = getDictionary(resolvedLocale)
    // Looked up in the whole public history: the profile lists only the latest
    // 30 matches, but public match pages link every linked player.
    const playerMatch = await getPublicPlayerMatch(playerId, eventId)
    if (!playerMatch) notFound()
    const { player, match, previousMatches } = playerMatch
    const number = new Intl.NumberFormat(resolvedLocale)
    const averageNumber = new Intl.NumberFormat(resolvedLocale, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
    })
    const average = (metric: "kills" | "deaths" | "killDeathRatio") =>
        previousMatches.length
            ? previousMatches.reduce((sum, item) => sum + item[metric], 0) /
              previousMatches.length
            : null
    const trendMatches = [match, ...previousMatches].map(playerMatchSnapshot)

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
                            {
                                label: player.name,
                                href: `/${resolvedLocale}/players/${player.id}`,
                            },
                            { label: match.name },
                        ]}
                    />
                    <Button asChild variant="outline">
                        <Link href={`/${resolvedLocale}/matches/${eventId}`}>
                            {dictionary.wardogsMatchDetails.openReport}
                        </Link>
                    </Button>
                    <Card className="border-border/60 rounded-2xl">
                        <CardHeader>
                            <CardTitle>{match.name}</CardTitle>
                            <p className="text-muted-foreground text-sm">
                                {player.name} ·{" "}
                                {match.mapName ?? dictionary.shared.notSet}
                            </p>
                        </CardHeader>
                        <CardContent className="grid grid-cols-3 gap-5 text-center">
                            {match.gameId === "wardogs" ? (
                                <PublicStat
                                    label={dictionary.gameHistory.cash}
                                    help={dictionary.gameHistory.cashHelp}
                                    value={
                                        match.cashDelta == null
                                            ? dictionary.common.notAvailable
                                            : number.format(match.cashDelta)
                                    }
                                />
                            ) : null}
                            <PublicStat
                                label={dictionary.publicProfiles.kills}
                                value={number.format(match.kills)}
                            />
                            <PublicStat
                                label={dictionary.publicProfiles.deaths}
                                value={number.format(match.deaths)}
                            />
                            <PublicStat
                                label={dictionary.publicProfiles.kd}
                                value={formatKd(
                                    match.killDeathRatio,
                                    resolvedLocale
                                )}
                            />
                        </CardContent>
                    </Card>
                    {previousMatches.length ? (
                        <>
                            <Card className="border-border/60 rounded-2xl">
                                <CardHeader className="flex flex-row items-center justify-between gap-4">
                                    <CardTitle>
                                        {dictionary.userManagement.averageDescription.replace(
                                            "{count}",
                                            String(previousMatches.length)
                                        )}
                                    </CardTitle>
                                    <PlayerTrendIndicators
                                        matches={trendMatches}
                                        dictionary={dictionary}
                                        locale={resolvedLocale}
                                    />
                                </CardHeader>
                                <CardContent className="grid grid-cols-3 gap-5 text-center">
                                    <PublicStat
                                        label={
                                            dictionary.userManagement
                                                .averageKills
                                        }
                                        value={averageNumber.format(
                                            average("kills")!
                                        )}
                                    />
                                    <PublicStat
                                        label={
                                            dictionary.userManagement
                                                .averageDeaths
                                        }
                                        value={averageNumber.format(
                                            average("deaths")!
                                        )}
                                    />
                                    <PublicStat
                                        label={
                                            dictionary.userManagement.averageKd
                                        }
                                        value={formatKd(
                                            average("killDeathRatio")!,
                                            resolvedLocale
                                        )}
                                    />
                                </CardContent>
                            </Card>
                            <div className="grid gap-6 xl:grid-cols-2">
                                <PerformanceHistoryChart
                                    title={
                                        dictionary.clan.playerPerformanceTrend
                                    }
                                    matches={trendMatches}
                                    dictionary={dictionary}
                                    locale={resolvedLocale}
                                    kind="playerEffectiveness"
                                />
                                <PerformanceHistoryChart
                                    title={dictionary.clan.kd}
                                    matches={trendMatches}
                                    dictionary={dictionary}
                                    locale={resolvedLocale}
                                    kind="combat"
                                />
                            </div>
                        </>
                    ) : null}
                    <Link
                        href={`/${resolvedLocale}/matches/${eventId}`}
                        className="text-primary text-sm underline"
                    >
                        {dictionary.event.openMatch}
                    </Link>
                </div>
            </PublicPage>
        </PublicSiteShell>
    )
}
