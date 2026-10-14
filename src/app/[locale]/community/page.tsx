import { connection } from "next/server"
import Image from "next/image"
import Link from "next/link"

import {
    listPublicClans,
    listPublicMatches,
    searchPublicClans,
    searchPublicPlayers,
} from "@/lib/read-models/public-profiles"
import {
    PublicPage,
    PublicSiteShell,
} from "@/components/public/public-site-shell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PublicPlayerSearch } from "@/components/public/public-player-search"
import { GAME_IDS, GAME_LABELS, isGameId } from "@/domain/games/game"
import { GAME_ICON_SOURCES } from "@/components/app/game-badge"
import { getDictionary } from "@/i18n/dictionaries"
import { getLocalizedCanonical } from "@/lib/seo"
import { isLocale } from "@/i18n/config"
import type { Metadata } from "next"

type Props = {
    params: Promise<{ locale: string }>
    searchParams: Promise<{
        q?: string
        matchesCursor?: string
        clansCursor?: string
        playersCursor?: string
        game?: string | string[]
    }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { locale } = (await params) ?? { locale: "en" }
    const safeLocale = isLocale(locale) ? locale : "en"
    return {
        title: "Hell Let Loose community, clans, players, and match results",
        description:
            "Explore Hell Let Loose communities, clan profiles, player statistics, and recorded match results.",
        alternates: getLocalizedCanonical(safeLocale, "/community"),
    }
}

export default async function CommunityPage({ params, searchParams }: Props) {
    // Convex data changes outside Next's cache invalidation lifecycle.
    await connection()
    const [{ locale }, { q, matchesCursor, clansCursor, playersCursor, game }] =
        await Promise.all([params, searchParams])
    const resolvedLocale = isLocale(locale) ? locale : "en"
    const dictionary = getDictionary(resolvedLocale)
    const query = q?.trim() ?? ""
    const requestedGames = (Array.isArray(game) ? game : game ? [game] : [])
        .flatMap((value) => value.split(","))
        .filter(isGameId)
    const selectedGames = [...new Set(requestedGames)]
    const selectedGame = selectedGames.length === 1 ? selectedGames[0] : null
    const queryString = (overrides: Record<string, string | undefined>) => {
        const next = new URLSearchParams(query ? { q: query } : undefined)
        selectedGames.forEach((gameId) => next.append("game", gameId))
        Object.entries(overrides).forEach(([key, value]) =>
            value ? next.set(key, value) : next.delete(key)
        )
        return next.toString()
    }
    const [clans, matches, players, searchedClans] = await Promise.all([
        selectedGame
            ? listPublicClans(clansCursor ?? null, selectedGame)
            : Promise.resolve({ page: [], isDone: true, continueCursor: "" }),
        selectedGame
            ? listPublicMatches(matchesCursor ?? null, 25, [], selectedGame)
            : Promise.resolve({ page: [], isDone: true, continueCursor: "" }),
        query.length >= 2 && selectedGame
            ? searchPublicPlayers(query, playersCursor ?? null, selectedGame)
            : Promise.resolve({ page: [], isDone: true, continueCursor: "" }),
        query.length >= 2 && selectedGame
            ? searchPublicClans(query, clansCursor ?? null, selectedGame)
            : Promise.resolve({ page: [], isDone: true, continueCursor: "" }),
    ])
    const displayedClans = query.length >= 2 ? searchedClans : clans

    return (
        <PublicSiteShell locale={resolvedLocale} current="community">
            <PublicPage>
                <div className="space-y-10">
                    {/* The navigation marks Community; the heading follows the J1/J2 pages. */}
                    <header className="flex flex-col gap-1.5">
                        <h1 className="text-3xl leading-9 font-bold">
                            {dictionary.publicProfiles.communityTitle}
                        </h1>
                        <p className="text-muted-foreground max-w-[60ch] text-[15px] leading-[22px]">
                            {dictionary.publicProfiles.communityDescription}
                        </p>
                    </header>
                    {selectedGame ? (
                        <>
                            <section className="bg-card rounded-2xl border p-5 sm:p-6">
                                <div className="max-w-xl">
                                    <h2 className="text-xl font-semibold">
                                        {
                                            dictionary.publicProfiles
                                                .findCommunity
                                        }
                                    </h2>
                                    <p className="text-muted-foreground mt-1 text-sm">
                                        {
                                            dictionary.publicProfiles
                                                .findPlayerDescription
                                        }
                                    </p>
                                    <PublicPlayerSearch
                                        initialQuery={query}
                                        label={
                                            dictionary.publicProfiles
                                                .findCommunity
                                        }
                                        placeholder={
                                            dictionary.publicProfiles
                                                .communitySearchPlaceholder
                                        }
                                    />
                                </div>
                                {query.length >= 2 ? (
                                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                                        {players.page.length ? (
                                            players.page.map((player) => (
                                                <Link
                                                    key={player.id}
                                                    href={`/${resolvedLocale}/players/${player.id}`}
                                                    className="hover:bg-muted flex items-center gap-3 rounded-xl border p-3 transition-colors"
                                                >
                                                    <Image
                                                        src={player.avatar}
                                                        alt=""
                                                        width={40}
                                                        height={40}
                                                        className="size-10 rounded-lg object-cover"
                                                    />
                                                    <span className="font-medium">
                                                        {player.name}
                                                    </span>
                                                </Link>
                                            ))
                                        ) : (
                                            <p className="text-muted-foreground text-sm">
                                                {
                                                    dictionary.publicProfiles
                                                        .noPlayersFound
                                                }
                                            </p>
                                        )}
                                    </div>
                                ) : null}
                                {query.length >= 2 && !players.isDone ? (
                                    <Link
                                        className="text-primary mt-4 inline-block text-sm font-medium hover:underline"
                                        href={`/${resolvedLocale}/community?${queryString({ playersCursor: players.continueCursor })}`}
                                    >
                                        {dictionary.publicProfiles.loadMore}
                                    </Link>
                                ) : null}
                            </section>
                            <section>
                                <h2 className="mb-4 text-2xl font-semibold">
                                    {dictionary.publicProfiles.clans}
                                </h2>
                                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                    {displayedClans.page.map((clan) => (
                                        <Link
                                            key={clan.id}
                                            href={`/${resolvedLocale}/clans/${clan.id}`}
                                        >
                                            <Card className="hover:bg-muted h-full transition-colors">
                                                <CardHeader className="flex-row items-center gap-3 space-y-0">
                                                    <Image
                                                        src={clan.avatar}
                                                        alt=""
                                                        width={48}
                                                        height={48}
                                                        className="size-12 rounded-xl object-cover"
                                                    />
                                                    <CardTitle className="truncate">
                                                        {clan.name}
                                                    </CardTitle>
                                                </CardHeader>
                                                <CardContent>
                                                    <p className="text-muted-foreground line-clamp-2 text-sm">
                                                        {clan.description ??
                                                            dictionary.shared
                                                                .notSet}
                                                    </p>
                                                    <p className="mt-3 text-sm font-medium">
                                                        {clan.memberCount}{" "}
                                                        {
                                                            dictionary
                                                                .publicProfiles
                                                                .activeMembers
                                                        }
                                                    </p>
                                                </CardContent>
                                            </Card>
                                        </Link>
                                    ))}
                                </div>
                                {query.length >= 2 &&
                                !displayedClans.page.length ? (
                                    <p className="text-muted-foreground mt-4 text-sm">
                                        {dictionary.publicProfiles.noClansFound}
                                    </p>
                                ) : null}
                                {!displayedClans.isDone ? (
                                    <Link
                                        className="text-primary mt-4 inline-block text-sm font-medium hover:underline"
                                        href={`/${resolvedLocale}/community?${queryString({ clansCursor: displayedClans.continueCursor })}`}
                                    >
                                        {dictionary.publicProfiles.loadMore}
                                    </Link>
                                ) : null}
                            </section>
                            <section>
                                <div className="mb-4">
                                    <h2 className="text-2xl font-semibold">
                                        {dictionary.publicProfiles.matchHistory}
                                    </h2>
                                    <p className="text-muted-foreground mt-1 text-sm">
                                        {
                                            dictionary.publicProfiles
                                                .platformMatchHistoryDescription
                                        }
                                    </p>
                                </div>
                                <div className="bg-card mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-3">
                                    <div className="flex items-center gap-3">
                                        <span className="flex size-10 overflow-hidden rounded-xl border">
                                            <img
                                                src={
                                                    GAME_ICON_SOURCES[
                                                        selectedGame
                                                    ]
                                                }
                                                alt=""
                                                className="size-full object-cover"
                                            />
                                        </span>
                                        <div>
                                            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                                                {dictionary.games.filterLabel}
                                            </p>
                                            <p className="font-semibold">
                                                {GAME_LABELS[selectedGame]}
                                            </p>
                                        </div>
                                    </div>
                                    <Link
                                        href={`/${resolvedLocale}/community${query ? `?q=${encodeURIComponent(query)}` : ""}`}
                                        className="text-primary hover:bg-muted rounded-lg px-3 py-2 text-sm font-medium"
                                    >
                                        {dictionary.games.all}
                                    </Link>
                                </div>
                                <div className="grid gap-3 md:grid-cols-2">
                                    {matches.page.map((match) => (
                                        <Link
                                            key={match.eventId}
                                            href={`/${resolvedLocale}/matches/${match.eventId}`}
                                        >
                                            <Card className="hover:bg-muted h-full transition-colors">
                                                <CardHeader className="space-y-1">
                                                    <div className="flex items-start justify-between gap-4">
                                                        <CardTitle className="line-clamp-1">
                                                            {match.name}
                                                        </CardTitle>
                                                        <span
                                                            className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${match.outcome === "victory" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : match.outcome === "defeat" ? "bg-red-500/15 text-red-700 dark:text-red-300" : "bg-muted text-muted-foreground"}`}
                                                        >
                                                            {match.outcome ===
                                                            "victory"
                                                                ? dictionary
                                                                      .publicProfiles
                                                                      .victory
                                                                : match.outcome ===
                                                                    "defeat"
                                                                  ? dictionary
                                                                        .publicProfiles
                                                                        .defeat
                                                                  : dictionary
                                                                        .publicProfiles
                                                                        .recorded}
                                                        </span>
                                                    </div>
                                                    <p className="text-muted-foreground text-sm">
                                                        {match.clan?.name ??
                                                            dictionary.shared
                                                                .notSet}
                                                        {` · ${GAME_LABELS[match.gameId]}`}
                                                        {match.category
                                                            ? ` · ${match.category}`
                                                            : ""}
                                                    </p>
                                                </CardHeader>
                                                <CardContent className="flex items-end justify-between gap-4">
                                                    <div>
                                                        <p className="text-2xl font-semibold tabular-nums">
                                                            {match.score
                                                                ? `${match.score.allied} – ${match.score.axis}`
                                                                : match.participants
                                                                      ?.map(
                                                                          (
                                                                              side
                                                                          ) =>
                                                                              side.score ??
                                                                              "—"
                                                                      )
                                                                      .join(
                                                                          " : "
                                                                      )}
                                                        </p>
                                                        <p className="text-muted-foreground text-sm">
                                                            {match.mapName}
                                                        </p>
                                                    </div>
                                                    <time className="text-muted-foreground text-right text-sm">
                                                        {new Intl.DateTimeFormat(
                                                            resolvedLocale ===
                                                                "cs"
                                                                ? "cs-CZ"
                                                                : resolvedLocale ===
                                                                    "de"
                                                                  ? "de-DE"
                                                                  : "en-GB",
                                                            {
                                                                dateStyle:
                                                                    "medium",
                                                            }
                                                        ).format(
                                                            new Date(
                                                                match.gameEnd
                                                            )
                                                        )}
                                                    </time>
                                                </CardContent>
                                            </Card>
                                        </Link>
                                    ))}
                                </div>
                                {selectedGame && !matches.page.length ? (
                                    <p className="text-muted-foreground text-sm">
                                        {dictionary.publicProfiles.noMatches}
                                    </p>
                                ) : null}
                                {selectedGame && !matches.isDone ? (
                                    <Link
                                        className="text-primary mt-4 inline-block text-sm font-medium hover:underline"
                                        href={`/${resolvedLocale}/community?${queryString({ matchesCursor: matches.continueCursor })}`}
                                    >
                                        {dictionary.publicProfiles.loadMore}
                                    </Link>
                                ) : null}
                            </section>
                        </>
                    ) : (
                        <section className="bg-card relative isolate overflow-hidden rounded-3xl border px-5 py-10 sm:px-10 sm:py-14">
                            <div className="bg-primary/10 absolute -top-24 -right-20 size-72 rounded-full blur-3xl" />
                            <div className="relative mx-auto max-w-4xl">
                                <p className="text-primary text-sm font-medium tracking-wide uppercase">
                                    {dictionary.games.filterLabel}
                                </p>
                                <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                                    {
                                        dictionary.publicSite.community
                                            .pickGameTitle
                                    }
                                </h2>
                                <p className="text-muted-foreground mt-2 max-w-xl">
                                    {
                                        dictionary.publicSite.community
                                            .pickGameDescription
                                    }
                                </p>
                                <div className="mt-8 grid gap-4 md:grid-cols-3">
                                    {GAME_IDS.map((gameId) => {
                                        const params = new URLSearchParams(
                                            query ? { q: query } : undefined
                                        )
                                        params.set("game", gameId)
                                        return (
                                            <Link
                                                key={gameId}
                                                href={`/${resolvedLocale}/community?${params.toString()}`}
                                                className="group bg-background hover:border-primary/50 focus-visible:ring-ring relative min-h-44 overflow-hidden rounded-2xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:ring-2 focus-visible:outline-none"
                                            >
                                                <img
                                                    src={
                                                        GAME_ICON_SOURCES[
                                                            gameId
                                                        ]
                                                    }
                                                    alt=""
                                                    className="absolute inset-0 size-full object-cover opacity-25 transition duration-300 group-hover:scale-105 group-hover:opacity-35"
                                                />
                                                <div className="from-background via-background/75 absolute inset-0 bg-gradient-to-t to-transparent" />
                                                <div className="relative flex h-full flex-col justify-end">
                                                    <span className="bg-background/80 mb-auto flex size-11 overflow-hidden rounded-xl border shadow-sm backdrop-blur">
                                                        <img
                                                            src={
                                                                GAME_ICON_SOURCES[
                                                                    gameId
                                                                ]
                                                            }
                                                            alt=""
                                                            className="size-full object-cover"
                                                        />
                                                    </span>
                                                    <span className="mt-6 text-lg font-semibold">
                                                        {GAME_LABELS[gameId]}
                                                    </span>
                                                    <span className="text-primary mt-1 text-sm font-medium">
                                                        {
                                                            dictionary
                                                                .publicProfiles
                                                                .search
                                                        }{" "}
                                                        →
                                                    </span>
                                                </div>
                                            </Link>
                                        )
                                    })}
                                </div>
                            </div>
                        </section>
                    )}
                </div>
            </PublicPage>
        </PublicSiteShell>
    )
}
