import { getGuildPerformanceHistory } from "@/lib/read-models/performance-history"
import type { ServerContextReadModel } from "@/lib/read-models/server-context"
import { DEFAULT_ROSTER_SCORE_SETTINGS } from "@/domain/events/score-policy"
import { getRecentMatchSummary } from "@/lib/read-models/server-dashboard"
import { monthAttendanceLeaders } from "@/domain/workspaces/clan-overview"
import { getUsersReadModelByIds } from "@/lib/read-models/users"
import type { GameScope } from "@/domain/games/game"

export type AttendanceLeader = {
    userId: string
    /** Missing when the member has never signed in to Logi. */
    name?: string
    points: number
}

/**
 * Members with the most attendance points this month. Only for managers:
 * they see every roster, so the points match what closing each match applied.
 */
async function attendanceLeaders(
    context: ServerContextReadModel,
    monthKey: string,
    monthKeyOf: (iso: string) => string
): Promise<AttendanceLeader[] | null> {
    if (!context.canAdmin) return null
    const { leaders } = monthAttendanceLeaders({
        events: context.events,
        rosters: context.rosters,
        assignments: context.assignments,
        settings:
            context.discordConfig?.membershipSettings?.rosterScoreSettings ??
            DEFAULT_ROSTER_SCORE_SETTINGS,
        monthKey,
        monthKeyOf,
    })
    if (!leaders.length) return []
    const users = await getUsersReadModelByIds(
        leaders.map((leader) => leader.userId),
        context.server.discordId
    )
    const names = new Map(users.map((user) => [user.discordId, user.name]))
    return leaders.map((leader) => ({
        ...leader,
        name: names.get(leader.userId),
    }))
}

/**
 * What the clan overview reads besides the server context: performance
 * history, the last ten results and the month's attendance leaders. Call only
 * after the server-context access check has succeeded.
 */
export async function getClanOverviewExtras(input: {
    serverId: string
    context: ServerContextReadModel
    gameScope: GameScope
    monthKey: string
    monthKeyOf: (iso: string) => string
}) {
    const { serverId, context } = input
    const [performance, recent, leaders] = await Promise.all([
        getGuildPerformanceHistory(
            context.server.discordId,
            serverId,
            input.gameScope
        ),
        getRecentMatchSummary(serverId, input.gameScope),
        attendanceLeaders(context, input.monthKey, input.monthKeyOf),
    ])
    return { performance, recent, leaders }
}
