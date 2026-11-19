import { PlayerScoresTable } from "@/components/app/player-scores-table"
import { playerStatProfile } from "@/domain/player-stats/game-metrics"
import { PlayersTable } from "@/components/app/players-table"
import { notFound } from "next/navigation"
import { formatKd } from "@/lib/format"

import { getPlayersPerformanceHistories } from "@/lib/read-models/performance-history"
import { MergeUsersButton } from "@/components/app/merge-users-button"
import { TablePageLayout } from "@/components/app/table-page-layout"
import { isGameId, resolveGameScope } from "@/domain/games/game"
import { getUsersByIds } from "@/lib/server-user-management"
import { PageHeader } from "@/components/app/page-header"
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

export async function ServerUsersView({
    params,
    searchParams,
    scoresView = false,
}: {
    scoresView?: boolean
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
                    title={
                        scoresView
                            ? dictionary.roster.scoresTitle
                            : dictionary.userManagement.title
                    }
                    description={dictionary.userManagement.description}
                    actions={
                        <div className="flex flex-wrap gap-2">
                            <Button asChild variant="outline">
                                <a
                                    href={`/${locale}/dashboard/servers/${serverId}/users${scoresView ? "" : "/scores"}${typeof game === "string" && isGameId(game) ? `?game=${encodeURIComponent(game)}` : ""}`}
                                >
                                    {scoresView
                                        ? dictionary.userManagement.title
                                        : dictionary.roster.scoresTitle}
                                </a>
                            </Button>
                            {canAdmin ? (
                                <>
                                    <MergeUsersButton
                                        serverId={serverId}
                                        dictionary={dictionary}
                                        users={mergeUserOptions}
                                    />
                                    <Button asChild className="rounded-xl">
                                        <a
                                            href={`/${locale}/dashboard/servers/${serverId}/users/create${typeof game === "string" && isGameId(game) ? `?game=${game}` : ""}`}
                                        >
                                            {
                                                dictionary.userManagement
                                                    .addPlayer
                                            }
                                        </a>
                                    </Button>
                                </>
                            ) : null}
                        </div>
                    }
                />
            }
        >
            {scoresView ? (
                <PlayerScoresTable
                    dictionary={dictionary}
                    locale={safeLocale}
                    rows={assignments.map((assignment) => {
                        const user = assignmentUserMap.get(assignment.userId)
                        const matches = getAssignmentPerformance(assignment)
                        const profile = playerStatProfile(assignment.gameId)
                        const average = (
                            key:
                                "kills" | "deaths" | "kd" | "combat" | "support"
                        ) =>
                            matches.length
                                ? matches.reduce(
                                      (sum, match) => sum + match[key],
                                      0
                                  ) / matches.length
                                : null
                        return {
                            id: assignment.id,
                            name: user?.name ?? dictionary.common.unknown,
                            group:
                                groupNameById.get(
                                    assignment.primaryGroupId ?? ""
                                ) ?? dictionary.userManagement.none,
                            game: resolveGameScope(assignment.gameId),
                            score: user
                                ? getUserScoreForGuild(
                                      user,
                                      context.server.discordId,
                                      assignment.gameId
                                  )
                                : 0,
                            matches: matches.length,
                            kills: average("kills"),
                            deaths: average("deaths"),
                            kd: average("kd"),
                            combat:
                                profile?.kind === "hll"
                                    ? average("combat")
                                    : null,
                            support: profile?.fields.includes("support")
                                ? average("support")
                                : null,
                            cash: (() => {
                                const values = matches.flatMap((match) =>
                                    match.cashDelta == null
                                        ? []
                                        : [match.cashDelta]
                                )
                                return profile?.fields.includes("cashDelta") &&
                                    values.length
                                    ? values.reduce(
                                          (sum, value) => sum + value,
                                          0
                                      ) / values.length
                                    : null
                            })(),
                            href: `/${locale}/dashboard/servers/${serverId}/users/${assignment.id}?game=${encodeURIComponent(resolveGameScope(assignment.gameId))}`,
                        }
                    })}
                />
            ) : (
                <PlayersTable
                    dictionary={dictionary}
                    locale={safeLocale}
                    page={paginated.page}
                    pageSize={paginated.pageSize}
                    pageCount={paginated.pageCount}
                    totalRows={paginated.totalRows}
                    search={paginated.search}
                    showGame={!(typeof game === "string" && isGameId(game))}
                    rows={paginated.rows.map((assignment) => {
                        const user = assignmentUserMap.get(assignment.userId)
                        const matches = getAssignmentPerformance(assignment)
                        const score = user
                            ? getUserScoreForGuild(
                                  user,
                                  context.server.discordId,
                                  assignment.gameId
                              )
                            : 0
                        const kd = matches.length
                            ? matches.reduce(
                                  (sum, match) => sum + match.kd,
                                  0
                              ) / matches.length
                            : null
                        return {
                            id: assignment.id,
                            gameId: assignment.gameId,
                            name: user?.name ?? dictionary.common.unknown,
                            avatar: user?.avatar ?? "",
                            discordId: user?.discordId ?? "",
                            platformIds: user?.platformIds ?? [],
                            type:
                                assignment.type === "member"
                                    ? dictionary.userManagement.memberLabel
                                    : assignment.type === "reserve_member"
                                      ? dictionary.userManagement
                                            .reserveMemberLabel
                                      : dictionary.userManagement.mercLabel,
                            group:
                                groupNameById.get(
                                    assignment.primaryGroupId ?? ""
                                ) ?? dictionary.userManagement.none,
                            score:
                                kd !== null
                                    ? `${score} • ${dictionary.userManagement.matchKd} ${formatKd(kd, safeLocale)}`
                                    : score,
                            status: getAssignmentStatusLabel(
                                assignment,
                                dictionary
                            ),
                            active: assignment.status === "active",
                            matches,
                            href: `/${locale}/dashboard/servers/${serverId}/users/${assignment.id}?game=${encodeURIComponent(assignment.gameId ?? "hell_let_loose")}`,
                        }
                    })}
                />
            )}
        </TablePageLayout>
    )
}
