import { Plus } from "lucide-react"
import Link from "next/link"

import {
    calendarDayKeys,
    eventsByDay,
    nextUpcomingMatch,
    pendingApplications,
    recentForm,
    resultsAwaitingConfirmation,
    upcomingEvents,
} from "@/domain/workspaces/clan-overview"
import {
    settingsSectionForRequirement,
    settingsSetupProgress,
    SETTINGS_SECTIONS,
    settingsSectionStatus,
} from "@/domain/workspaces/settings-sections"
import {
    WaitingCard,
    type WaitingItem,
} from "@/components/app/clan-overview/waiting-card"
import { AttendanceLeadersCard } from "@/components/app/clan-overview/attendance-leaders-card"
import {
    fill,
    overviewFormat,
} from "@/components/app/clan-overview/overview-format"
import { ClanStatsSection } from "@/components/app/clan-overview/clan-stats-section"
import { RecentFormCard } from "@/components/app/clan-overview/recent-form-card"
import { NextMatchCard } from "@/components/app/clan-overview/next-match-card"
import { settingsSnapshot } from "@/components/app/settings/settings-snapshot"
import type { getClanOverviewExtras } from "@/lib/read-models/clan-overview"
import { WeekStrip } from "@/components/app/clan-overview/week-strip"
import { GAME_LABELS, type GameId } from "@/domain/games/game"
import { formatHllPresetLabel } from "@/lib/hll-map-presets"
import { findEventCategory } from "@/lib/event-categories"
import type { ServerContext } from "@/lib/server-context"
import { getDictionary } from "@/i18n/dictionaries"
import type { EventRecord } from "@/types/domain"
import { Button } from "@/components/ui/button"
import type { Locale } from "@/i18n/config"

function greeting(
    dictionary: ReturnType<typeof getDictionary>,
    now: Date,
    timezone?: string
) {
    const hour = Number(
        new Intl.DateTimeFormat("en-US", {
            timeZone: timezone,
            hour: "numeric",
            hourCycle: "h23",
        }).format(now)
    )
    if (hour < 12) return dictionary.dashboard.greetingMorning
    if (hour < 18) return dictionary.dashboard.greetingAfternoon
    return dictionary.dashboard.greetingEvening
}

/**
 * Clan home (design G1): greeting, the next match with roster places,
 * sign-ups and a reminder for members without an answer, manager to-dos with
 * setup progress, this week, recent form and the month's attendance points,
 * then the clan's statistics: totals, performance charts and recent results.
 */
export function ClanOverview({
    locale,
    serverId,
    gameId,
    context,
    extras,
    now,
}: {
    locale: Locale
    serverId: string
    gameId?: GameId
    context: Pick<
        ServerContext,
        | "server"
        | "events"
        | "rosters"
        | "canAdmin"
        | "assignments"
        | "discordConfig"
        | "groups"
        | "squadPresets"
        | "topicPresets"
    >
    extras: Awaited<ReturnType<typeof getClanOverviewExtras>>
    now: Date
}) {
    const dictionary = getDictionary(locale)
    const text = dictionary.clanOverview
    const {
        server,
        events,
        rosters,
        canAdmin,
        assignments = [],
        discordConfig,
        groups = [],
        squadPresets = [],
        topicPresets = [],
    } = context
    const timezone = discordConfig?.timezone
    const format = overviewFormat(locale, timezone)
    const base = `/${locale}/dashboard/servers/${serverId}`
    const gameQuery = gameId ? `?game=${gameId}` : ""
    const matchHref = (eventId: string) =>
        `${base}/matches/${eventId}${gameQuery}`
    const eventHref = (event: EventRecord) =>
        `${base}/${event.kind === "training" ? "trainings" : "matches"}/${event.id}${gameQuery}`
    const settingsHref = (section?: string) =>
        `${base}/settings${section ? `/${section}` : ""}${gameQuery}`

    const snapshot = settingsSnapshot(server.enabledGames, discordConfig)
    const games = gameId ? [gameId] : snapshot.enabledGames
    const nextMatch = nextUpcomingMatch(events, now)
    const nextRoster = nextMatch
        ? (rosters.find((roster) => roster.eventId === nextMatch.id) ?? null)
        : null
    const todayKey = format.dayKey(now.toISOString())
    const week = eventsByDay(
        events,
        calendarDayKeys(todayKey, 7),
        format.dayKey
    )
    const form = recentForm(events)
    const setup = settingsSetupProgress(snapshot)

    const applications = pendingApplications(assignments)
    const waiting: WaitingItem[] = [
        ...resultsAwaitingConfirmation(events)
            .slice(0, 3)
            .map((result): WaitingItem => ({
                key: `result:${result.eventId}`,
                href: matchHref(result.eventId),
                title: fill(text.confirmResult, { name: result.name }),
                detail: result.score
                    ? fill(text.resultScore, {
                          score: `${result.score.sideA} : ${result.score.sideB}`,
                          date: format.shortDate(result.gameEnd),
                      })
                    : fill(text.resultNoScore, {
                          date: format.shortDate(result.gameEnd),
                      }),
                tone: "warning",
            })),
        ...SETTINGS_SECTIONS.flatMap(
            (section) => settingsSectionStatus(section.id, snapshot).missing
        ).map((requirement): WaitingItem => ({
            key: `setting:${requirement}`,
            href: settingsHref(settingsSectionForRequirement(requirement)),
            title: dictionary.settingsHub.requirements[requirement],
            detail: text.requirementHints[requirement],
            tone: "warning",
        })),
        ...(applications.count
            ? [
                  {
                      key: "applications",
                      href: `${base}/users${gameQuery}`,
                      title: format.count(
                          applications.count,
                          text.applications
                      ),
                      detail: applications.oldestAt
                          ? fill(text.applicationsOldest, {
                                date: format.shortDate(applications.oldestAt),
                            })
                          : undefined,
                      tone: "neutral" as const,
                  },
              ]
            : []),
    ]

    const upcoming = upcomingEvents(events, now)
    const category = nextMatch
        ? findEventCategory(server.eventCategories, nextMatch.matchType)
        : null
    const mapLabel = nextMatch?.map
        ? (formatHllPresetLabel(nextMatch.map, nextMatch.gameId) ??
          nextMatch.map)
        : undefined

    return (
        <div className="mx-auto flex w-full max-w-[70rem] flex-col gap-6 px-4 pb-10 lg:px-6">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-2xl font-semibold tracking-tight">
                        {greeting(dictionary, now, timezone)}
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        {fill(text.dateLine, {
                            date: format.longDate(now.toISOString()),
                            games: format.list(
                                games.map((game) => GAME_LABELS[game]),
                                text.listAnd
                            ),
                        })}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button asChild variant="outline" className="rounded-xl">
                        <Link href={`${base}/matches${gameQuery}`}>
                            {text.allMatches}
                        </Link>
                    </Button>
                    {canAdmin ? (
                        <Button asChild className="rounded-xl">
                            <Link href={`${base}/matches/create${gameQuery}`}>
                                <Plus className="size-4" aria-hidden="true" />
                                {text.newMatch}
                            </Link>
                        </Button>
                    ) : null}
                </div>
            </header>
            <div className="flex flex-wrap items-stretch gap-4">
                <NextMatchCard
                    serverId={serverId}
                    event={nextMatch}
                    roster={nextRoster}
                    assignments={assignments}
                    categoryLabel={category?.label}
                    mapLabel={mapLabel}
                    canAdmin={canAdmin}
                    hrefs={{
                        match: matchHref,
                        roster: (rosterId) =>
                            `${base}/rosters/${rosterId}${gameQuery}`,
                        createRoster: `${base}/rosters/create${gameQuery}`,
                        newMatch: `${base}/matches/create${gameQuery}`,
                    }}
                    format={format}
                    now={now}
                    dictionary={dictionary}
                />
                {canAdmin ? (
                    <WaitingCard
                        items={waiting}
                        setup={{
                            label: fill(text.setupProgress, {
                                done: setup.done,
                                total: setup.total,
                            }),
                            href: settingsHref(),
                        }}
                        dictionary={dictionary}
                    />
                ) : null}
            </div>
            <WeekStrip
                days={week}
                todayKey={todayKey}
                eventHref={eventHref}
                format={format}
                dictionary={dictionary}
            />
            <div className="flex flex-wrap items-stretch gap-4">
                <RecentFormCard
                    form={form}
                    matchHref={matchHref}
                    format={format}
                    dictionary={dictionary}
                />
                {extras.leaders ? (
                    <AttendanceLeadersCard
                        month={format.monthName(now.toISOString())}
                        leaders={extras.leaders}
                        dictionary={dictionary}
                    />
                ) : null}
            </div>
            <ClanStatsSection
                locale={locale}
                totals={{
                    upcomingEvents: upcoming.length,
                    nextEventName: upcoming[0]?.name,
                    publishedRosters: rosters.filter(
                        (roster) => roster.published
                    ).length,
                    rosters: rosters.length,
                    members: server.memberIds.length,
                    assignments: assignments.length,
                    presets:
                        groups.length +
                        squadPresets.length +
                        topicPresets.length,
                }}
                performance={extras.performance}
                recent={extras.recent}
                matchHref={matchHref}
                playerHref={(userId) => `/${locale}/players/${userId}`}
                dictionary={dictionary}
            />
        </div>
    )
}
