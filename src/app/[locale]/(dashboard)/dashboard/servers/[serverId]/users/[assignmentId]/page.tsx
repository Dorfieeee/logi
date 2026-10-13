import { Activity, Shield, Skull, Swords, Target, Wrench } from "lucide-react"
import { notFound } from "next/navigation"
import type { Metadata } from "next"

import {
    buildPlayerStatsSummary,
    filterPlayerMatchesForEvents,
    flattenPlayerMatches,
    getPlayerStatsDocs,
    sortPlayerMatches,
} from "@/lib/server-player-stats"
import {
    getEligibleUsersForServer,
    getServerUserAssignment,
    getUsersByIds,
} from "@/lib/server-user-management"
import { PlayerAdminAccessButton } from "@/components/app/player-admin-access-button"
import { PerformanceHistoryChart } from "@/components/app/performance-history-chart"
import { getPlayerPerformanceHistory } from "@/lib/read-models/performance-history"
import { getAssignmentMetadata, getPlayerMetadata } from "@/lib/server-metadata"
import { UserAssignmentForm } from "@/components/app/user-assignment-form"
import { TablePageLayout } from "@/components/app/table-page-layout"
import { ResourceTable } from "@/components/app/resource-table"
import { PageHeader } from "@/components/app/page-header"
import { GameBadge } from "@/components/app/game-badge"
import { getServerContext } from "@/lib/server-context"
import { StatCard } from "@/components/app/stat-card"
import { getDictionary } from "@/i18n/dictionaries"
import { getPaginatedRows } from "@/lib/data-table"
import { isGameId } from "@/domain/games/game"
import { formatDateTime } from "@/lib/format"
import { isLocale } from "@/i18n/config"

export const metadata: Metadata = {
    title: "Edit assignment",
    description: "Manage a member's server assignment.",
}

export function generateStaticParams() {
    return [{ assignmentId: "sample-assignment" }]
}

export default async function ServerUserDetailPage({
    params,
    searchParams,
}: {
    params: Promise<{ locale: string; serverId: string; assignmentId: string }>
    searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
    const { locale, serverId, assignmentId } = await params
    const resolvedSearchParams = await searchParams
    const requestedGame = resolvedSearchParams?.game
    const game = Array.isArray(requestedGame) ? requestedGame[0] : requestedGame
    const gameScope = isGameId(game) ? game : "all"
    const safeLocale = isLocale(locale) ? locale : "en"
    const dictionary = getDictionary(safeLocale)
    const context = await getServerContext(serverId, gameScope)
    if (!context) notFound()
    const { server, groups = [], assignments } = context

    const found = await getServerUserAssignment(assignmentId).catch(() => null)
    // The ID comes from the URL: only this clan's assignments may be shown.
    const assignment = found?.serverId === server.discordId ? found : null
    const users = assignment
        ? await getUsersByIds([assignment.userId], server.discordId)
        : []
    const user = users[0]
    const eligibleUsers = await getEligibleUsersForServer(server, assignments)

    if (!assignment || !user) notFound()

    const playerStatsDocs = await getPlayerStatsDocs(user.id)
    const sortedMatches = sortPlayerMatches(
        filterPlayerMatchesForEvents(
            flattenPlayerMatches(playerStatsDocs),
            context.events,
            gameScope
        ),
        new Map(context.events.map((event) => [event.id, event]))
    )
    const recentSummary = buildPlayerStatsSummary(sortedMatches)
    const performanceHistory = await getPlayerPerformanceHistory(
        server.discordId,
        user.id,
        serverId,
        gameScope
    )
    const paginatedMatches = getPaginatedRows({
        rows: sortedMatches,
        searchParams: resolvedSearchParams,
        getSearchText: (match) => {
            const event = context.events.find(
                (item) => item.id === match.eventId
            )
            return [
                event?.name,
                match.mapName,
                match.playerName,
                match.sourceUrl,
            ]
                .filter(Boolean)
                .join(" ")
        },
    })
    // A player can have several stats rows for one event (one per linked
    // platform account), so the event ID alone is not a unique row ID.
    const matchRows = paginatedMatches.rows.map((match, index) => ({
        ...match,
        id: `${match.eventId}:${paginatedMatches.page}:${index}`,
    }))

    function formatAverage(value: number) {
        return new Intl.NumberFormat(safeLocale, {
            maximumFractionDigits: 2,
            minimumFractionDigits: value % 1 === 0 ? 0 : 2,
        }).format(value)
    }

    return (
        <TablePageLayout
            header={
                <PageHeader
                    title={user.name}
                    description={
                        user.platformIds.length
                            ? dictionary.userSettings.platformConnected
                            : dictionary.userManagement.platformNotConnected
                    }
                    badges={
                        gameScope === "all" ? (
                            <GameBadge
                                gameId={assignment.gameId}
                                dictionary={dictionary}
                            />
                        ) : undefined
                    }
                    actions={
                        context.canAdmin ? (
                            <PlayerAdminAccessButton
                                serverId={server.id}
                                playerId={user.discordId}
                                playerName={user.name}
                                initialIsAdmin={
                                    server.adminAccessOverrides?.[
                                        user.discordId
                                    ] ?? false
                                }
                                dictionary={dictionary}
                            />
                        ) : undefined
                    }
                />
            }
        >
            <div className="flex min-h-0 flex-col gap-6 overflow-y-auto pb-6">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <StatCard
                        title={dictionary.userManagement.averageKills}
                        value={formatAverage(recentSummary.averages.kills)}
                        description={dictionary.userManagement.storedAverageDescription.replace(
                            "{count}",
                            String(sortedMatches.length)
                        )}
                        icon={Target}
                    />
                    <StatCard
                        title={dictionary.userManagement.averageKd}
                        value={formatAverage(
                            recentSummary.averages.killDeathRatio
                        )}
                        description={dictionary.userManagement.storedAverageDescription.replace(
                            "{count}",
                            String(sortedMatches.length)
                        )}
                        icon={Swords}
                    />
                    <StatCard
                        title={dictionary.userManagement.averageDeaths}
                        value={formatAverage(recentSummary.averages.deaths)}
                        description={dictionary.userManagement.storedAverageDescription.replace(
                            "{count}",
                            String(sortedMatches.length)
                        )}
                        icon={Skull}
                    />
                    <StatCard
                        title={dictionary.userManagement.averageOffense}
                        value={formatAverage(recentSummary.averages.offense)}
                        description={dictionary.userManagement.storedAverageDescription.replace(
                            "{count}",
                            String(sortedMatches.length)
                        )}
                        icon={Activity}
                    />
                    <StatCard
                        title={dictionary.userManagement.averageDefense}
                        value={formatAverage(recentSummary.averages.defense)}
                        description={dictionary.userManagement.storedAverageDescription.replace(
                            "{count}",
                            String(sortedMatches.length)
                        )}
                        icon={Shield}
                    />
                    <StatCard
                        title={dictionary.userManagement.averageSupport}
                        value={formatAverage(recentSummary.averages.support)}
                        description={dictionary.userManagement.storedAverageDescription.replace(
                            "{count}",
                            String(sortedMatches.length)
                        )}
                        icon={Wrench}
                    />
                </div>
                <div className="grid gap-6 xl:grid-cols-2">
                    <PerformanceHistoryChart
                        title={dictionary.clan.playerPerformanceTrend}
                        matches={performanceHistory}
                        dictionary={dictionary}
                        kind="playerEffectiveness"
                    />
                    <PerformanceHistoryChart
                        title={dictionary.clan.kd}
                        matches={performanceHistory}
                        dictionary={dictionary}
                        kind="combat"
                    />
                </div>
                <ResourceTable
                    className="h-auto max-h-[32rem]"
                    dictionary={dictionary}
                    rows={matchRows}
                    page={paginatedMatches.page}
                    pageSize={paginatedMatches.pageSize}
                    pageCount={paginatedMatches.pageCount}
                    totalRows={paginatedMatches.totalRows}
                    search={paginatedMatches.search}
                    searchPlaceholder={
                        dictionary.userManagement.matchHistorySearch
                    }
                    getHref={(match) =>
                        `/${safeLocale}/dashboard/servers/${serverId}/matches/${match.eventId}`
                    }
                    columns={[
                        {
                            key: "event",
                            title: dictionary.userManagement.matchHistoryEvent,
                            render: (match) => {
                                const event = context.events.find(
                                    (item) => item.id === match.eventId
                                )
                                return (
                                    <div>
                                        <div className="font-medium">
                                            {event?.name ??
                                                dictionary.common.unknown}
                                        </div>
                                        <div className="text-muted-foreground text-xs">
                                            {match.mapName ?? match.mapId}
                                        </div>
                                    </div>
                                )
                            },
                        },
                        {
                            key: "playedAt",
                            title: dictionary.userManagement
                                .matchHistoryPlayedAt,
                            render: (match) =>
                                formatDateTime(
                                    match.endedAt ?? match.importedAt,
                                    context.discordConfig?.timezone,
                                    safeLocale === "cs"
                                        ? "cs-CZ"
                                        : safeLocale === "de"
                                          ? "de-DE"
                                          : "en-GB"
                                ),
                        },
                        {
                            key: "kills",
                            title: dictionary.userManagement.matchKills,
                            render: (match) => match.kills,
                        },
                        {
                            key: "kd",
                            title: dictionary.userManagement.matchKd,
                            render: (match) =>
                                formatAverage(match.killDeathRatio),
                        },
                        {
                            key: "deaths",
                            title: dictionary.userManagement.matchDeaths,
                            render: (match) => match.deaths,
                        },
                        {
                            key: "offense",
                            title: dictionary.userManagement.matchOffense,
                            render: (match) => match.offense,
                        },
                        {
                            key: "defense",
                            title: dictionary.userManagement.matchDefense,
                            render: (match) => match.defense,
                        },
                        {
                            key: "support",
                            title: dictionary.userManagement.matchSupport,
                            render: (match) => match.support,
                        },
                    ]}
                />
                <UserAssignmentForm
                    locale={safeLocale}
                    server={server}
                    dictionary={dictionary}
                    eligibleUsers={eligibleUsers}
                    groups={groups}
                    assignment={assignment}
                    config={context.discordConfig}
                    canManage={context.canAdmin}
                />
            </div>
        </TablePageLayout>
    )
}
