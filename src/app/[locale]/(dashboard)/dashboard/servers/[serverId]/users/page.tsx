import { notFound } from "next/navigation"
import { formatKd } from "@/lib/format"
import type { Metadata } from "next"

import {
    getServerUserAssignments,
    getUsersByIds,
} from "@/lib/server-user-management"
import { getPlayersPerformanceHistories } from "@/lib/read-models/performance-history"
import { PlayerTrendIndicators } from "@/components/app/player-trend-indicators"
import { ResourceTable, StatusBadge } from "@/components/app/resource-table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { MergeUsersButton } from "@/components/app/merge-users-button"
import { PlatformIdList } from "@/components/app/platform-id-display"
import { TablePageLayout } from "@/components/app/table-page-layout"
import { isGameId, resolveGameScope } from "@/domain/games/game"
import { PageHeader } from "@/components/app/page-header"
import { getGuildMetadata } from "@/lib/server-metadata"
import { getUserScoreForGuild } from "@/lib/user-scores"
import { getServerContext } from "@/lib/server-context"
import { getDictionary } from "@/i18n/dictionaries"
import { getPaginatedRows } from "@/lib/data-table"
import { Button } from "@/components/ui/button"
import { isLocale } from "@/i18n/config"

function getAssignmentStatusLabel(
    assignment: {
        type: "member" | "reserve_member" | "mercenary"
        status: "pending" | "recruit" | "active"
    },
    dictionary: ReturnType<typeof getDictionary>
) {
    if (assignment.status === "pending")
        return dictionary.userManagement.pendingLabel
    if (assignment.status === "recruit")
        return dictionary.userManagement.recruitLabel
    if (assignment.type === "mercenary")
        return dictionary.userManagement.mercLabel
    if (assignment.type === "reserve_member")
        return dictionary.userManagement.reserveMemberLabel
    return dictionary.userManagement.memberLabel
}

export const metadata: Metadata = {
    title: "Members",
    description: "Manage server members.",
}

export default async function ServerUsersPage({
    params,
    searchParams,
}: {
    params: Promise<{ locale: string; serverId: string }>
    searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
    const { locale, serverId } = await params
    const resolvedSearchParams = await searchParams
    const safeLocale = isLocale(locale) ? locale : "en"
    const dictionary = getDictionary(safeLocale)
    const game = resolvedSearchParams?.game
    const context = await getServerContext(
        serverId,
        typeof game === "string" && isGameId(game) ? game : "all"
    )
    if (!context) notFound()

    const { groups, canAdmin } = context
    const assignments = context.assignments
    const groupNameById = new Map(groups.map((group) => [group.id, group.name]))
    const assignmentUsers = await getUsersByIds(
        assignments.map((assignment) => assignment.userId),
        context.server.discordId
    )
    const assignmentUserMap = new Map(
        assignmentUsers.map((user) => [user.discordId, user])
    )
    // A person can have multiple assignments in one clan. Histories are
    // therefore keyed by both user and game, not only the user ID.
    const userIdsByGame = new Map<string, string[]>()
    for (const assignment of assignments) {
        const gameId = resolveGameScope(assignment.gameId)
        const userIds = userIdsByGame.get(gameId) ?? []
        if (!userIds.includes(assignment.userId)) {
            userIds.push(assignment.userId)
        }
        userIdsByGame.set(gameId, userIds)
    }
    const performanceByUserAndGame = new Map<
        string,
        Awaited<ReturnType<typeof getPlayersPerformanceHistories>>[string]
    >()
    await Promise.all(
        [...userIdsByGame].map(async ([gameId, userIds]) => {
            const histories = await getPlayersPerformanceHistories(
                context.server.discordId,
                userIds,
                serverId,
                gameId
            )
            for (const [userId, matches] of Object.entries(histories)) {
                performanceByUserAndGame.set(`${userId}:${gameId}`, matches)
            }
        })
    )
    const getAssignmentPerformance = (
        assignment: (typeof assignments)[number]
    ) =>
        performanceByUserAndGame.get(
            `${assignment.userId}:${resolveGameScope(assignment.gameId)}`
        ) ?? []
    const mergeUserOptions = assignmentUsers
        .map((user) => ({
            id: user.id,
            name: `${user.name} (${user.discordId})${user.platformIds.length ? ` • ${user.platformIds.join(", ")}` : ""}`,
        }))
        .sort((left, right) => left.name.localeCompare(right.name))

    const paginated = getPaginatedRows({
        rows: assignments,
        searchParams: resolvedSearchParams,
        getSearchText: (assignment) => {
            const user = assignmentUserMap.get(assignment.userId)
            return [
                user?.name,
                user?.id,
                user?.platformIds?.join(" "),
                String(
                    user
                        ? getUserScoreForGuild(
                              user,
                              context.server.discordId,
                              assignment.gameId
                          )
                        : ""
                ),
                groupNameById.get(assignment.primaryGroupId ?? ""),
                assignment.type,
                getAssignmentStatusLabel(assignment, dictionary),
            ]
                .filter(Boolean)
                .join(" ")
        },
    })

    return (
        <TablePageLayout
            header={
                <PageHeader
                    title={dictionary.userManagement.title}
                    description={dictionary.userManagement.description}
                    actions={
                        canAdmin ? (
                            <div className="flex flex-wrap gap-2">
                                <MergeUsersButton
                                    serverId={serverId}
                                    dictionary={dictionary}
                                    users={mergeUserOptions}
                                />
                                <Button asChild className="rounded-xl">
                                    <a
                                        href={`/${locale}/dashboard/servers/${serverId}/users/create${typeof game === "string" && isGameId(game) ? `?game=${game}` : ""}`}
                                    >
                                        {dictionary.userManagement.addPlayer}
                                    </a>
                                </Button>
                            </div>
                        ) : undefined
                    }
                />
            }
        >
            <ResourceTable
                className="h-full"
                dictionary={dictionary}
                rows={paginated.rows}
                page={paginated.page}
                pageSize={paginated.pageSize}
                pageCount={paginated.pageCount}
                totalRows={paginated.totalRows}
                search={paginated.search}
                searchPlaceholder={dictionary.userManagement.searchPlaceholder}
                gameColumn={{
                    show: !(typeof game === "string" && isGameId(game)),
                    getGameId: (assignment) => assignment.gameId,
                }}
                getHref={(assignment) =>
                    `/${locale}/dashboard/servers/${serverId}/users/${assignment.id}?game=${encodeURIComponent(assignment.gameId ?? "hell_let_loose")}`
                }
                columns={[
                    {
                        key: "player",
                        title: dictionary.userManagement.tablePlayer,
                        render: (assignment) => {
                            const user = assignmentUserMap.get(
                                assignment.userId
                            )
                            if (!user) return dictionary.common.unknown

                            return (
                                <div className="flex items-center gap-3">
                                    <Avatar className="size-9 rounded-lg">
                                        <AvatarImage
                                            src={user.avatar}
                                            alt={user.name}
                                        />
                                        <AvatarFallback>
                                            {user.name.slice(0, 2)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <div className="font-medium">
                                            {user.name}
                                        </div>
                                        <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                                            <span>{user.discordId}</span>
                                            {user.platformIds.length ? (
                                                <PlatformIdList
                                                    platformIds={
                                                        user.platformIds
                                                    }
                                                    dictionary={dictionary}
                                                    compact
                                                />
                                            ) : null}
                                        </div>
                                    </div>
                                </div>
                            )
                        },
                    },
                    {
                        key: "type",
                        title: dictionary.userManagement.tableType,
                        render: (assignment) =>
                            assignment.type === "member"
                                ? dictionary.userManagement.memberLabel
                                : assignment.type === "reserve_member"
                                  ? dictionary.userManagement.reserveMemberLabel
                                  : dictionary.userManagement.mercLabel,
                    },
                    {
                        key: "group",
                        title: dictionary.userManagement.tableGroup,
                        render: (assignment) =>
                            assignment.primaryGroupId
                                ? (groupNameById.get(
                                      assignment.primaryGroupId
                                  ) ?? dictionary.userManagement.none)
                                : dictionary.userManagement.none,
                    },
                    {
                        key: "score",
                        title: dictionary.userManagement.tableScore,
                        render: (assignment) => {
                            const user = assignmentUserMap.get(
                                assignment.userId
                            )
                            if (!user) {
                                return 0
                            }

                            const score = getUserScoreForGuild(
                                user,
                                context.server.discordId,
                                assignment.gameId
                            )
                            const matches = getAssignmentPerformance(assignment)
                            const kd = matches.length
                                ? matches.reduce(
                                      (sum, match) => sum + match.kd,
                                      0
                                  ) / matches.length
                                : null
                            return kd !== null
                                ? `${score} • ${dictionary.userManagement.matchKd} ${formatKd(kd, safeLocale)}`
                                : score
                        },
                    },
                    {
                        key: "trends",
                        title: dictionary.clan.playerPerformanceTrend,
                        render: (assignment) => (
                            <PlayerTrendIndicators
                                matches={getAssignmentPerformance(assignment)}
                                locale={safeLocale}
                                dictionary={dictionary}
                            />
                        ),
                    },
                    {
                        key: "status",
                        title: dictionary.userManagement.tableStatus,
                        render: (assignment) => (
                            <StatusBadge
                                active={assignment.status === "active"}
                                activeLabel={getAssignmentStatusLabel(
                                    assignment,
                                    dictionary
                                )}
                                inactiveLabel={getAssignmentStatusLabel(
                                    assignment,
                                    dictionary
                                )}
                            />
                        ),
                    },
                ]}
            />
        </TablePageLayout>
    )
}
