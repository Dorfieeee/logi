import { SearchX } from "lucide-react"
import Link from "next/link"

import {
    discordUrl,
    getEventDiscordMessages,
    getEventResultReview,
    getResultsPanelChannelId,
} from "@/lib/read-models/match-detail"
import {
    isMatchDetailTab,
    type MatchDetailTab,
} from "@/components/app/match-detail/match-detail-header"
import {
    DEFAULT_ROSTER_SCORE_SETTINGS,
    summarizeRosterScoreChanges,
} from "@/domain/events/score-policy"
import { ReminderDeliveryNotice } from "@/components/app/match-detail/reminder-delivery-notice"
import {
    deriveMatchPhases,
    type MatchResultState,
} from "@/domain/events/match-phase"
import { getRosterPublishContext } from "@/lib/read-models/roster-publish-context"
import { MatchDetailView } from "@/components/app/match-detail/match-detail-view"
import { describeManualReminderAudience } from "@/domain/events/manual-reminders"
import { getDiscordChannelNames } from "@/lib/read-models/discord-channel-names"
import { getReminderDeliveryNotice } from "@/lib/read-models/reminder-delivery"
import { eventEditability, eventSeriesRole } from "@/domain/events/event-edit"
import { EventOverview } from "@/components/app/match-detail/event-overview"
import { currentDashboardActor } from "@/lib/gateways/dashboard-actor"
import { LiveRosterBoard } from "@/components/app/live-roster-board"
import { clientGrantScopes } from "@/domain/identity/client-grant"
import { getUsersByIds } from "@/lib/server-user-management"
import { currentEventStatus } from "@/domain/events/status"
import { isGameId, type GameId } from "@/domain/games/game"
import { EmptyState } from "@/components/app/empty-state"
import { getServerContext } from "@/lib/server-context"
import { issueClientGrant } from "@/lib/client-grants"
import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import { getSession } from "@/lib/auth"

/**
 * The match detail (designs D3, E2, E3): loads the match, its roster,
 * attendance, Discord messages and result for `MatchDetailView`. Used by the
 * match and the event detail routes, which differ only in their URLs.
 */
export async function MatchDetailPage({
    locale,
    serverId,
    eventId,
    game,
    tab,
    section,
    dictionary,
}: {
    locale: string
    serverId: string
    eventId: string
    game?: string
    tab?: string
    /** The route the page lives under: `matches` or `events`. */
    section: "matches" | "events"
    dictionary: Dictionary
}) {
    const gameScope = isGameId(game) ? game : "all"
    const listHref = `/${locale}/dashboard/servers/${serverId}/${section}${isGameId(game) ? `?game=${game}` : ""}`
    const [context, session] = await Promise.all([
        getServerContext(serverId, gameScope),
        getSession(),
    ])
    const event = context?.events.find(
        (item) => item.id === eventId && (item.kind ?? "match") === "match"
    )
    if (!context || !event || !session) {
        return (
            <div className="px-4 lg:px-6">
                <EmptyState
                    icon={SearchX}
                    title={dictionary.matchDetail.notFoundTitle}
                    description={dictionary.matchDetail.notFoundDescription}
                    actions={
                        <Button
                            asChild
                            variant="outline"
                            className="rounded-xl"
                        >
                            <Link href={listHref}>
                                {dictionary.matchDetail.backToMatches}
                            </Link>
                        </Button>
                    }
                />
            </div>
        )
    }

    const activeTab: MatchDetailTab = isMatchDetailTab(tab) ? tab : "overview"
    // The result is reviewed once the match has been played; the schedule
    // decides this before the bot records the conclusion.
    const now = new Date()
    const played = currentEventStatus(event, now) === "concluded"
    // Logi refuses to close a match before its meeting starts.
    const closeAvailable =
        now.getTime() >= new Date(event.meetingStart).getTime()
    const { canAdmin, discordConfig } = context
    const timeZone = discordConfig?.timezone ?? "UTC"
    const gameId: GameId = event.gameId ?? "hell_let_loose"
    const guildDiscordId = context.server.discordId
    const roster =
        context.rosters.find((item) => item.eventId === eventId) ?? null
    const attachedStratmaps = context.stratmaps.filter((stratmap) =>
        event.stratmapIds.includes(stratmap.id)
    )
    // Closing a match scores every active member of the clan, whatever game.
    const allAssignments =
        gameScope === "all"
            ? context.assignments
            : ((await getServerContext(serverId, "all"))?.assignments ??
              context.assignments)
    const memberIds = [
        ...new Set(
            allAssignments
                .filter((assignment) => !assignment.paused)
                .map((assignment) => assignment.userId)
        ),
    ]
    const scoreSettings =
        discordConfig?.membershipSettings?.rosterScoreSettings ??
        DEFAULT_ROSTER_SCORE_SETTINGS
    const closeSummary = summarizeRosterScoreChanges({
        userIds: memberIds,
        settings: scoreSettings,
        participants: event.participants,
        notices: event.absenceNotices,
        roster,
    })
    const reminderInput = {
        event: { ...event, participants: event.participants },
        roster,
        assignments: allAssignments,
        now,
    }
    const reminderState = (audience: "unanswered" | "unconfirmed") => {
        const described = describeManualReminderAudience({
            audience,
            ...reminderInput,
        })
        return {
            count: described.userIds.length,
            unavailable: described.unavailable,
        }
    }

    const meetingChannelId =
        event.meetingChannelId ?? discordConfig?.meetingChannelId
    const actor = canAdmin ? await currentDashboardActor() : null
    const [messages, review, channelNames, resultsChannelId] =
        await Promise.all([
            getEventDiscordMessages(event.id),
            canAdmin
                ? getEventResultReview({
                      guildId: guildDiscordId,
                      gameId,
                      eventId: event.id,
                      actorId: session.sub,
                  })
                : Promise.resolve(null),
            canAdmin &&
            (activeTab === "attendance" ||
                activeTab === "roster" ||
                activeTab === "result")
                ? getDiscordChannelNames(serverId, guildDiscordId)
                : Promise.resolve(new Map<string, string>()),
            actor && activeTab === "result"
                ? (event.eventResultsChannelId ??
                  discordConfig?.eventResultsChannelId)
                    ? Promise.resolve(
                          event.eventResultsChannelId ??
                              discordConfig?.eventResultsChannelId
                      )
                    : getResultsPanelChannelId({
                          guildId: guildDiscordId,
                          gameId,
                          actor,
                      })
                : Promise.resolve(undefined),
        ])
    const resultState: MatchResultState =
        review?.current?.status ?? (event.eventResult ? "imported" : "none")
    const rosterPlayerIds =
        roster?.squads.flatMap((squad) =>
            squad.players.flatMap((player) => (player.id ? [player.id] : []))
        ) ?? []
    const presentCount =
        (roster?.squads.reduce(
            (sum, squad) =>
                sum +
                squad.players.filter((player) => player.id && player.confirmed)
                    .length,
            0
        ) ?? 0) +
        (roster?.reserveAttendances?.filter((item) => item.confirmed).length ??
            0)
    const signedUpCount = event.participants.filter(
        (participant) => participant.status === "attending"
    ).length
    const phases = deriveMatchPhases(
        {
            createdAt: event.createdAt,
            registrationStart: event.registrationStart,
            registrationEnd: event.registrationEnd,
            meetingStart: event.meetingStart,
            gameEnd: event.gameEnd,
            status: event.status,
            signedUpCount,
            roster: roster
                ? {
                      published: roster.published,
                      assignedCount: rosterPlayerIds.length,
                  }
                : null,
            presentCount,
            result: resultState,
        },
        now
    )

    const basePath = `/${locale}/dashboard/servers/${serverId}/${section}/${event.id}`
    // Managers edit in the new-match flow until the match concludes.
    const editHref =
        canAdmin && eventEditability(event, now) === "editable"
            ? `${basePath}/edit`
            : undefined
    const series = eventSeriesRole(event)
    const seriesSource =
        series?.kind === "occurrence"
            ? context.events.find((item) => item.id === series.sourceId)
            : undefined
    const seriesEditHref =
        canAdmin &&
        seriesSource &&
        eventEditability(seriesSource, now) === "editable"
            ? `/${locale}/dashboard/servers/${serverId}/matches/${seriesSource.id}/edit?step=time`
            : null
    const tabHref = (target: MatchDetailTab) => {
        const params = new URLSearchParams()
        if (isGameId(game)) params.set("game", game)
        if (target !== "overview") params.set("tab", target)
        const query = params.toString()
        return query ? `${basePath}?${query}` : basePath
    }
    const announcementChannelId =
        messages?.announcementChannelId ?? event.announcementChannelId
    const discordHref =
        announcementChannelId && messages?.announcementMessageId
            ? discordUrl(
                  guildDiscordId,
                  announcementChannelId,
                  messages.announcementMessageId
              )
            : undefined
    const createRosterHref = canAdmin
        ? `/${locale}/dashboard/servers/${serverId}/rosters/create?game=${gameId}`
        : undefined
    const signupHistoryHref = `/${locale}/dashboard/servers/${serverId}/signup-activity?eventId=${event.id}`
    const reviewerIds =
        activeTab === "result" && review
            ? [
                  ...new Set(
                      review.history.flatMap((revision) =>
                          [revision.reviewerId, revision.createdBy].filter(
                              (id): id is string => Boolean(id)
                          )
                      )
                  ),
              ]
            : []
    const reviewerNames = Object.fromEntries(
        (reviewerIds.length
            ? await getUsersByIds(reviewerIds, guildDiscordId)
            : []
        ).map((user) => [user.discordId, user.name])
    )
    const needsUsers = activeTab === "attendance" || activeTab === "roster"
    const users = needsUsers
        ? await getUsersByIds(
              [
                  ...new Set([
                      ...allAssignments.map((assignment) => assignment.userId),
                      ...event.participants.map((item) => item.userId),
                      ...event.signUps.map((item) => item.userId),
                      ...(roster?.reservePlayerIds ?? []),
                      ...(roster?.notAttendingPlayerIds ?? []),
                      ...rosterPlayerIds,
                  ]),
              ],
              guildDiscordId
          )
        : []
    const meetingChannelName = meetingChannelId
        ? channelNames.get(meetingChannelId)
        : undefined
    const publishContext =
        canAdmin && activeTab === "roster" && roster
            ? await getRosterPublishContext({
                  serverId,
                  locale,
                  server: context.server,
                  event,
                  discordConfig,
                  channelNames,
              })
            : undefined
    // Who the last manual reminder missed (board L2-60..62), for admins.
    const reminderDelivery =
        canAdmin && activeTab === "overview"
            ? await getReminderDeliveryNotice({
                  guildId: guildDiscordId,
                  eventId: event.id,
              })
            : null
    const resultsChannelName =
        resultsChannelId === undefined
            ? undefined
            : resultsChannelId === null
              ? null
              : (channelNames.get(resultsChannelId) ?? resultsChannelId)

    return (
        <MatchDetailView
            locale={locale}
            serverId={serverId}
            section={section}
            dictionary={dictionary}
            event={event}
            activeTab={activeTab}
            played={played}
            closeAvailable={closeAvailable}
            canAdmin={canAdmin}
            timeZone={timeZone}
            gameId={gameId}
            guildDiscordId={guildDiscordId}
            listHref={listHref}
            basePath={basePath}
            tabHref={tabHref}
            phases={phases}
            signedUpCount={signedUpCount}
            discordHref={discordHref}
            roster={roster}
            users={users}
            memberIds={memberIds}
            scoreSettings={scoreSettings}
            closeSummary={closeSummary}
            messages={messages}
            review={review}
            reviewerNames={reviewerNames}
            attachedStratmaps={attachedStratmaps}
            meetingChannelId={meetingChannelId}
            meetingChannelName={meetingChannelName}
            eventInfoChannelId={
                event.eventInfoChannelId ?? discordConfig?.eventInfoChannelId
            }
            resultsChannelName={resultsChannelName}
            clanName={context.server.name}
            reminders={{
                unanswered: reminderState("unanswered"),
                unconfirmed: reminderState("unconfirmed"),
            }}
            createRosterHref={createRosterHref}
            rosterPageHref={
                roster
                    ? `/${locale}/dashboard/servers/${serverId}/rosters/${roster.id}`
                    : undefined
            }
            signupHistoryHref={signupHistoryHref}
            editHref={editHref}
            overview={
                activeTab === "overview" ? (
                    <>
                        {reminderDelivery ? (
                            <ReminderDeliveryNotice
                                notice={reminderDelivery}
                                copy={dictionary.reminderDelivery}
                                errorLabel={dictionary.common.error}
                                clanName={context.server.name}
                                locale={locale}
                                timeZone={timeZone}
                            />
                        ) : null}
                        <EventOverview
                            event={event}
                            context={context}
                            dictionary={dictionary}
                            locale={locale}
                            serverId={serverId}
                            editHref={editHref ?? null}
                            seriesEditHref={seriesEditHref}
                            canResyncTopics={
                                canAdmin &&
                                !played &&
                                event.createForumChannel &&
                                Boolean(event.topicPresetId)
                            }
                        />
                    </>
                ) : null
            }
            rosterBoard={
                activeTab === "roster" && roster ? (
                    <LiveRosterBoard
                        rosterId={roster.id}
                        serverId={serverId}
                        locale={locale}
                        grant={issueClientGrant(
                            { discordId: session.sub, sid: session.sid },
                            clientGrantScopes.roster(serverId, roster.id)
                        )}
                        dictionary={dictionary}
                        initialRoster={roster}
                        initialEvent={event}
                        initialUsers={users}
                        initialAssignments={context.assignments}
                        initialGroups={context.groups}
                        initialSquadPresets={context.squadPresets}
                        initialCanAdmin={canAdmin}
                        initialDiscordConfig={
                            discordConfig
                                ? {
                                      timezone: discordConfig.timezone,
                                      meetingChannelId:
                                          discordConfig.meetingChannelId,
                                  }
                                : null
                        }
                        meetingChannelName={meetingChannelName}
                        reminder={
                            canAdmin ? reminderState("unanswered") : undefined
                        }
                        publishContext={publishContext}
                    />
                ) : null
            }
        />
    )
}
