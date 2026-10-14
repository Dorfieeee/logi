import type { ComponentProps, ReactNode } from "react"
import { ClipboardList, Trophy } from "lucide-react"
import Link from "next/link"

import {
    MatchDetailActions,
    type MatchDetailAction,
} from "@/components/app/match-detail/match-detail-actions"
import {
    MatchDetailHeader,
    type MatchDetailTab,
} from "@/components/app/match-detail/match-detail-header"
import type {
    RosterScoreChangeSummary,
    RosterScoreSettings,
} from "@/domain/events/score-policy"
import type {
    AppUser,
    EventRecord,
    Roster,
    StratmapRecord,
} from "@/types/domain"
import { MatchAttendancePanel } from "@/components/app/match-detail/match-attendance-panel"
import type { ReminderAudienceState } from "@/components/app/match-detail/reminder-button"
import { SubmitMatchResultsButton } from "@/components/app/submit-match-results-button"
import { MatchDiscordPanel } from "@/components/app/match-detail/match-discord-panel"
import type { EventDiscordMessages } from "@/lib/read-models/match-detail"
import { playerMetricKind } from "@/domain/player-stats/game-metrics"
import type { MatchPhaseStep } from "@/domain/events/match-phase"
import { ResultReview } from "@/components/app/result-review"
import { MissingResultNotice } from "./missing-result-notice"
import { EmptyState } from "@/components/app/empty-state"
import type { Dictionary } from "@/i18n/dictionaries"
import type { GameId } from "@/domain/games/game"
import { Button } from "@/components/ui/button"

/** Everything the match detail shows, loaded by `MatchDetailPage`. */
export type MatchDetailViewModel = {
    locale: string
    serverId: string
    section: "matches" | "events"
    dictionary: Dictionary
    event: EventRecord
    activeTab: MatchDetailTab
    played: boolean
    closeAvailable: boolean
    canAdmin: boolean
    timeZone: string
    gameId: GameId
    guildDiscordId: string
    listHref: string
    basePath: string
    tabHref: (tab: MatchDetailTab) => string
    phases: MatchPhaseStep[]
    signedUpCount: number
    discordHref?: string
    roster: Roster | null
    users: AppUser[]
    memberIds: string[]
    scoreSettings: RosterScoreSettings
    closeSummary: RosterScoreChangeSummary
    messages: EventDiscordMessages | null
    review: ComponentProps<typeof ResultReview>["initialData"]
    reviewerNames: Record<string, string>
    attachedStratmaps: StratmapRecord[]
    meetingChannelId?: string
    meetingChannelName?: string
    eventInfoChannelId?: string
    /** Channel of the Discord results panel; null when none, undefined when unknown. */
    resultsChannelName?: string | null
    clanName?: string
    reminders: {
        unanswered: ReminderAudienceState
        unconfirmed: ReminderAudienceState
    }
    createRosterHref?: string
    rosterPageHref?: string
    signupHistoryHref: string
    /** The edit flow, for managers while the match can still change. */
    editHref?: string
    /** The overview and the live roster board come from the page. */
    overview: ReactNode
    rosterBoard: ReactNode
}

/**
 * The match detail (designs D3, E2, E3 and the phone screens): one header with
 * progress and tabs, and the selected section below it.
 */
export function MatchDetailView(model: MatchDetailViewModel) {
    const {
        dictionary,
        event,
        activeTab,
        canAdmin,
        roster,
        locale,
        serverId,
        played,
        basePath,
        section,
    } = model
    const t = dictionary.matchDetail
    const reportHref =
        event.wardogsReportId && event.gameId === "wardogs"
            ? section === "matches"
                ? `${basePath}/match-stats`
                : `${basePath}/match`
            : undefined
    const actions: MatchDetailAction[] = canAdmin
        ? [
              ...(reportHref
                  ? [{ label: t.result.openStats, href: reportHref }]
                  : []),
              ...(model.discordHref
                  ? [
                        {
                            label: t.openInDiscord,
                            href: model.discordHref,
                            external: true,
                            phoneOnly: true,
                        },
                    ]
                  : []),
              ...(model.editHref
                  ? [{ label: t.actions.edit, href: model.editHref }]
                  : []),
              ...(model.rosterPageHref
                  ? [
                        {
                            label: t.actions.openRoster,
                            href: model.rosterPageHref,
                        },
                    ]
                  : []),
              { label: t.actions.signupHistory, href: model.signupHistoryHref },
          ]
        : model.discordHref
          ? [
                ...(reportHref
                    ? [{ label: t.result.openStats, href: reportHref }]
                    : []),
                {
                    label: t.openInDiscord,
                    href: model.discordHref,
                    external: true,
                    phoneOnly: true,
                },
            ]
          : reportHref
            ? [{ label: t.result.openStats, href: reportHref }]
            : []

    return (
        <div className="flex flex-col gap-5 pb-6">
            <MatchDetailHeader
                event={event}
                dictionary={dictionary}
                locale={locale}
                timeZone={model.timeZone}
                listHref={model.listHref}
                phases={model.phases}
                activeTab={activeTab}
                tabHref={model.tabHref}
                tabCounts={{ attendance: model.signedUpCount }}
                played={played}
                // After the match the announcement is history (E2, E3).
                discordHref={played ? undefined : model.discordHref}
                actions={
                    <MatchDetailActions
                        label={t.moreActions}
                        actions={actions}
                        deletion={
                            canAdmin
                                ? {
                                      serverId,
                                      eventId: event.id,
                                      eventName: event.name,
                                      listHref: model.listHref,
                                      copy: t.deletion,
                                  }
                                : undefined
                        }
                    />
                }
            />
            <div className="px-4 lg:px-6">
                {activeTab === "overview" ? (
                    <div className="space-y-3">
                        {model.attachedStratmaps.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {model.attachedStratmaps.map((stratmap) => (
                                    <Button
                                        key={stratmap.id}
                                        asChild
                                        variant="outline"
                                        size="sm"
                                        className="rounded-xl"
                                    >
                                        <Link
                                            href={`/${locale}/stratmaps/${stratmap.id}`}
                                        >
                                            {stratmap.title}
                                        </Link>
                                    </Button>
                                ))}
                            </div>
                        ) : null}
                        {canAdmin &&
                        played &&
                        !event.eventResult &&
                        !event.wardogsReportId &&
                        playerMetricKind(model.gameId) ? (
                            <MissingResultNotice
                                review={model.review ?? null}
                                start={event.gameStart}
                                end={event.gameEnd}
                                href={model.tabHref("result")}
                                dictionary={dictionary}
                                locale={locale}
                                timezone={model.timeZone}
                            />
                        ) : null}
                        {model.overview}
                    </div>
                ) : null}
                {activeTab === "attendance" ? (
                    <MatchAttendancePanel
                        serverId={serverId}
                        event={event}
                        roster={roster}
                        users={model.users}
                        memberIds={model.memberIds}
                        scoreSettings={model.scoreSettings}
                        closeSummary={model.closeSummary}
                        canAdmin={canAdmin}
                        closeAvailable={model.closeAvailable}
                        meetingChannelConfigured={Boolean(
                            model.meetingChannelId
                        )}
                        meetingChannelName={model.meetingChannelName}
                        reminder={model.reminders.unanswered}
                        locale={locale}
                        timeZone={model.timeZone}
                        signupHistoryHref={model.signupHistoryHref}
                        createRosterHref={model.createRosterHref}
                        dictionary={dictionary}
                    />
                ) : null}
                {activeTab === "roster" ? (
                    roster && (canAdmin || roster.published) ? (
                        model.rosterBoard
                    ) : (
                        <EmptyState
                            icon={ClipboardList}
                            title={
                                canAdmin
                                    ? t.roster.missingTitle
                                    : dictionary.roster.rosterNotAvailable
                            }
                            description={
                                canAdmin
                                    ? t.roster.missingDescription
                                    : undefined
                            }
                            actions={
                                model.createRosterHref ? (
                                    <Button asChild className="rounded-xl">
                                        <Link href={model.createRosterHref}>
                                            {t.roster.create}
                                        </Link>
                                    </Button>
                                ) : undefined
                            }
                        />
                    )
                ) : null}
                {activeTab === "discord" ? (
                    <MatchDiscordPanel
                        event={event}
                        guildDiscordId={model.guildDiscordId}
                        messages={model.messages}
                        eventInfoChannelId={model.eventInfoChannelId}
                        meetingChannelId={model.meetingChannelId}
                        dictionary={dictionary}
                    />
                ) : null}
                {activeTab === "result" ? (
                    <div className="space-y-4">
                        {canAdmin && !played && !model.review?.current ? (
                            <EmptyState
                                icon={Trophy}
                                title={t.result.notYetTitle}
                                description={t.result.notYetDescription}
                            />
                        ) : canAdmin ? (
                            <ResultReview
                                serverId={serverId}
                                eventId={event.id}
                                gameId={model.gameId}
                                dictionary={dictionary}
                                initialData={model.review}
                                matchStart={event.gameStart}
                                matchEnd={event.gameEnd}
                                locale={locale}
                                timeZone={model.timeZone}
                                actorNames={model.reviewerNames}
                                ourSide={event.side}
                                clanName={model.clanName}
                                opponentName={
                                    event.name
                                        .split(/\s+vs\.?\s+/i)[1]
                                        ?.split(" · ")[0]
                                        ?.trim() || undefined
                                }
                                matchTeams={event.matchTeams}
                                resultsChannelName={model.resultsChannelName}
                                competitionLinked={Boolean(
                                    event.competitionFixtureId
                                )}
                                playersHref={
                                    event.matchStatsId || event.wardogsReportId
                                        ? section === "matches"
                                            ? `${basePath}/match-stats`
                                            : `${basePath}/match`
                                        : undefined
                                }
                            />
                        ) : (
                            <EmptyState
                                title={t.result.title}
                                description={t.result.membersOnly}
                            />
                        )}
                        {event.matchStatsId ||
                        event.wardogsReportId ||
                        (canAdmin && event.status === "concluded") ? (
                            <section className="border-border/60 bg-card flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                                <div>
                                    <h2 className="text-base font-semibold">
                                        {t.result.stats}
                                    </h2>
                                    <p className="text-muted-foreground text-sm">
                                        {event.matchStatsId ||
                                        event.wardogsReportId
                                            ? t.result.statsDescription
                                            : dictionary.event.noMatchLinked}
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {event.matchStatsId ||
                                    event.wardogsReportId ? (
                                        <Button
                                            asChild
                                            variant="outline"
                                            className="rounded-xl"
                                        >
                                            <Link
                                                href={
                                                    section === "matches"
                                                        ? `${basePath}/match-stats`
                                                        : `${basePath}/match`
                                                }
                                            >
                                                {t.result.openStats}
                                            </Link>
                                        </Button>
                                    ) : null}
                                    {canAdmin &&
                                    event.status === "concluded" &&
                                    model.gameId !== "wardogs" ? (
                                        <SubmitMatchResultsButton
                                            serverId={serverId}
                                            eventId={event.id}
                                            gameId={model.gameId}
                                            reviewable={false}
                                            dictionary={dictionary}
                                        />
                                    ) : null}
                                </div>
                            </section>
                        ) : null}
                    </div>
                ) : null}
            </div>
        </div>
    )
}
