import type { Metadata } from "next"
import Link from "next/link"

import { ResourceTable, StatusBadge } from "@/components/app/resource-table"
import { TablePageLayout } from "@/components/app/table-page-layout"
import { PageHeader } from "@/components/app/page-header"
import { getGuildMetadata } from "@/lib/server-metadata"
import { getServerContext } from "@/lib/server-context"
import { getDictionary } from "@/i18n/dictionaries"
import { getPaginatedRows } from "@/lib/data-table"
import { Button } from "@/components/ui/button"
import { isGameId } from "@/domain/games/game"
import { isLocale } from "@/i18n/config"

export const metadata: Metadata = {
    title: "Rosters",
    description: "Manage event rosters.",
}

export default async function RostersPage({
    params,
    searchParams,
}: {
    params: Promise<{ locale: string; serverId: string }>
    searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
    const { locale, serverId } = await params
    const resolvedSearchParams = await searchParams
    const dictionary = getDictionary(isLocale(locale) ? locale : "en")
    const game = resolvedSearchParams?.game
    const context = await getServerContext(
        serverId,
        typeof game === "string" && isGameId(game) ? game : "all"
    )
    if (!context) return null
    const { rosters, events, canAdmin } = context
    const eventById = new Map(events.map((event) => [event.id, event]))
    const sortedRosters = [...rosters].sort((left, right) => {
        const leftMeetingStart = eventById.get(left.eventId)?.meetingStart
        const rightMeetingStart = eventById.get(right.eventId)?.meetingStart

        if (!leftMeetingStart) return rightMeetingStart ? 1 : 0
        if (!rightMeetingStart) return -1

        return (
            new Date(rightMeetingStart).getTime() -
            new Date(leftMeetingStart).getTime()
        )
    })
    const paginated = getPaginatedRows({
        rows: sortedRosters,
        searchParams: resolvedSearchParams,
        getSearchText: (roster) => {
            const eventName = eventById.get(roster.eventId)?.name
            return [
                eventName,
                roster.published
                    ? dictionary.common.published
                    : dictionary.tables.hidden,
            ]
                .filter(Boolean)
                .join(" ")
        },
    })

    return (
        <TablePageLayout
            header={
                <PageHeader
                    title={dictionary.sidebar.rosters}
                    description={dictionary.roster.listDescription}
                    actions={
                        canAdmin ? (
                            <Button asChild className="rounded-xl">
                                <a
                                    href={`/${locale}/dashboard/servers/${serverId}/rosters/create`}
                                >
                                    {dictionary.common.createRoster}
                                </a>
                            </Button>
                        ) : undefined
                    }
                />
            }
        >
            <ResourceTable
                clickableRows
                className="h-full"
                dictionary={dictionary}
                rows={paginated.rows}
                page={paginated.page}
                pageSize={paginated.pageSize}
                pageCount={paginated.pageCount}
                totalRows={paginated.totalRows}
                search={paginated.search}
                searchPlaceholder={dictionary.shared.searchTable}
                gameColumn={{
                    show: !(typeof game === "string" && isGameId(game)),
                    getGameId: (roster) =>
                        eventById.get(roster.eventId)?.gameId,
                }}
                getHref={(roster) =>
                    `/${locale}/dashboard/servers/${serverId}/rosters/${roster.id}`
                }
                columns={[
                    {
                        key: "event",
                        title: dictionary.tables.event,
                        render: (roster) => (
                            <Link
                                className="font-medium hover:underline focus-visible:underline"
                                href={`/${locale}/dashboard/servers/${serverId}/rosters/${roster.id}`}
                            >
                                {eventById.get(roster.eventId)?.name ??
                                    dictionary.tables.unassigned}
                            </Link>
                        ),
                    },
                    {
                        key: "squads",
                        title: dictionary.tables.squads,
                        render: (roster) => roster.squads.length,
                    },
                    {
                        key: "reserves",
                        title: dictionary.tables.reserves,
                        render: (roster) => roster.reservePlayerIds.length,
                    },
                    {
                        key: "published",
                        title: dictionary.tables.visibility,
                        render: (roster) => (
                            <StatusBadge
                                active={roster.published}
                                activeLabel={dictionary.common.published}
                                inactiveLabel={dictionary.tables.hidden}
                            />
                        ),
                    },
                ]}
            />
        </TablePageLayout>
    )
}
