import { CircleCheck, Repeat } from "lucide-react"
import Link from "next/link"

import {
    flowPreviewModel,
    flowReviewRows,
    type FlowSummaryContext,
} from "@/components/app/new-match/flow-summary"
import {
    NewMatchPreview,
    type NewMatchPreviewModel,
} from "@/components/app/new-match/new-match-preview"
import {
    getDiscordChannelNames,
    getDiscordRoleNames,
} from "@/lib/read-models/discord-channel-names"
import {
    TacticalPlanMap,
    type TacticalTeam,
} from "@/components/app/new-match/tactical-plan"
import { flowValuesFromEvent } from "@/components/app/new-match/flow-values"
import { eventSeriesRole, signupCounts } from "@/domain/events/event-edit"
import { ResyncTopicThreadButton } from "./resync-topic-thread-button"
import { getDictionary, type Dictionary } from "@/i18n/dictionaries"
import type { TacticalPlan } from "@/domain/events/tactical-plan"
import { getLinkedClanTeams } from "@/lib/read-models/clan-teams"
import { matchTeamGame } from "@/lib/teams/match-team-selection"
import type { getServerContext } from "@/lib/server-context"
import type { EventRecord } from "@/types/domain"
import { cn } from "@/lib/utils"

type ServerContext = NonNullable<Awaited<ReturnType<typeof getServerContext>>>

/**
 * The "Overview" of a match or training (design D2 review rows): match,
 * time, sign-ups and Discord as short lines, each with "Edit" into that step
 * of the edit flow for managers, and the Discord announcement as players see
 * it now. Members get the same rows without the links.
 */
export async function EventOverview({
    event,
    context,
    dictionary,
    locale,
    serverId,
    editHref,
    seriesEditHref,
    canResyncTopics,
}: {
    event: EventRecord
    context: ServerContext
    dictionary: Dictionary
    locale: string
    serverId: string
    /** The edit route, for managers while the event can still change. */
    editHref: string | null
    /** The edit route of the match that carries this date's weekly series. */
    seriesEditHref: string | null
    /** Managers may ask the bot to post the forum topics again. */
    canResyncTopics: boolean
}) {
    const t = dictionary.newMatch
    const config = context.discordConfig
    const timezone = config?.timezone ?? "UTC"
    const botLanguage = config?.defaultLanguage ?? "en"
    const guildId = context.server.discordId
    const storedOwn = event.matchTeams?.find((team) => team.slot === "a")
    const teamGame = matchTeamGame(event.gameId)
    const [channelNames, roleNames, linkedTeams] = await Promise.all([
        getDiscordChannelNames(serverId, guildId),
        getDiscordRoleNames(serverId, guildId),
        !storedOwn && teamGame && event.kind === "match"
            ? getLinkedClanTeams(guildId).catch(() => [])
            : Promise.resolve([]),
    ])
    const linked = linkedTeams.find((team) => team.gameId === teamGame)
    const summaryContext: FlowSummaryContext = {
        t,
        intl: locale === "cs" ? "cs-CZ" : locale === "de" ? "de-DE" : "en-GB",
        timezone,
        clanName: context.server.name,
        ownTeam: storedOwn
            ? {
                  name: storedOwn.snapshot.name,
                  shortCode: storedOwn.snapshot.shortCode,
              }
            : linked
              ? { name: linked.name, shortCode: linked.shortCode }
              : null,
        templateName: null,
        groups: context.groups,
        categories: context.server.eventCategories ?? [],
        squadPresets: context.squadPresets,
        topicPresets: context.topicPresets,
        stratmaps: context.stratmaps,
        channelName: (id) => channelNames.get(id) ?? null,
        roleName: (id) => roleNames.get(id) ?? null,
    }
    const values = flowValuesFromEvent(event, timezone)
    const rows = flowReviewRows(values, summaryContext)
    const preview = flowPreviewModel(values, {
        ...summaryContext,
        botLanguage,
        clanRoleId: config?.clanRoleId,
        messageStyle: config?.messageStyle,
        signups: signupCounts(event.participants),
    })
    const isMatch = event.kind === "match"

    return (
        <EventOverviewView
            kind={event.kind}
            eventId={event.id}
            serverId={serverId}
            dictionary={dictionary}
            rows={rows}
            preview={preview}
            previewCopy={getDictionary(botLanguage).newMatch.preview}
            editHref={editHref}
            series={isMatch ? (eventSeriesRole(event)?.kind ?? null) : null}
            seriesEditHref={seriesEditHref}
            canResyncTopics={canResyncTopics}
            tacticalPlan={event.tacticalPlan}
            tacticalTimeLabel={
                event.timeOfDay
                    ? ((t.match.timesOfDay as Record<string, string>)[
                          event.timeOfDay
                      ] ?? event.timeOfDay)
                    : undefined
            }
            tacticalTeams={(event.matchTeams ?? []).map((team) => ({
                slot: team.slot,
                name: team.snapshot.name,
                side: team.side,
            }))}
            locale={locale}
        />
    )
}

/** The overview's look, fed with rows and a preview built from the event. */
export function EventOverviewView({
    kind,
    eventId,
    serverId,
    dictionary,
    rows,
    preview,
    previewCopy,
    editHref,
    series,
    seriesEditHref,
    canResyncTopics,
    tacticalPlan,
    tacticalTimeLabel,
    tacticalTeams = [],
    locale = "en",
}: {
    kind: "match" | "training"
    eventId: string
    serverId: string
    dictionary: Dictionary
    rows: ReturnType<typeof flowReviewRows>
    preview: NewMatchPreviewModel
    previewCopy: Dictionary["newMatch"]["preview"]
    editHref: string | null
    series: "source" | "occurrence" | null
    seriesEditHref: string | null
    canResyncTopics: boolean
    tacticalPlan?: TacticalPlan
    tacticalTimeLabel?: string
    tacticalTeams?: TacticalTeam[]
    locale?: string
}) {
    const t = dictionary.newMatch
    const isMatch = kind === "match"
    return (
        <div className="flex flex-wrap items-start gap-6">
            <section
                aria-labelledby="event-overview"
                className="bg-card text-card-foreground border-border flex min-w-0 flex-[999_1_440px] flex-col gap-[18px] rounded-[14px] border p-5 shadow-xs sm:p-7"
            >
                <div className="flex flex-col gap-1">
                    <h2
                        id="event-overview"
                        className="text-lg leading-[26px] font-semibold"
                    >
                        {t.overview.title}
                    </h2>
                    <p className="text-muted-foreground text-sm">
                        {isMatch
                            ? t.overview.description
                            : t.overview.descriptionTraining}
                    </p>
                </div>
                <ul className="border-border m-0 flex list-none flex-col rounded-[10px] border p-0">
                    {rows.map((row, index) => (
                        <li
                            key={row.step}
                            className={cn(
                                "flex items-start gap-2.5 px-3.5 py-3",
                                index && "border-border/60 border-t"
                            )}
                        >
                            <CircleCheck
                                className="mt-px size-[18px] shrink-0 text-green-700 dark:text-green-500"
                                aria-hidden
                            />
                            <span className="flex min-w-0 flex-1 flex-col leading-5">
                                <span className="text-sm font-medium">
                                    {row.step === "match" && !isMatch
                                        ? t.steps.training
                                        : t.steps[row.step]}
                                </span>
                                <span className="text-muted-foreground text-[13px] break-words">
                                    {row.text}
                                </span>
                            </span>
                            {editHref ? (
                                <Link
                                    href={`${editHref}?step=${row.step}`}
                                    className="text-foreground inline-flex h-7 items-center rounded-md px-2.5 text-[13px] font-medium underline underline-offset-[3px]"
                                >
                                    {t.overview.edit}
                                    <span className="sr-only">
                                        {` – ${t.steps[row.step]}`}
                                    </span>
                                </Link>
                            ) : null}
                        </li>
                    ))}
                </ul>
                {tacticalPlan ? (
                    <TacticalPlanMap
                        plan={tacticalPlan}
                        teams={tacticalTeams}
                        locale={locale}
                        timeLabel={tacticalTimeLabel}
                    />
                ) : null}
                {series ? (
                    <p className="bg-muted text-foreground/80 m-0 flex flex-wrap items-start gap-2.5 rounded-[10px] px-3.5 py-3 text-sm leading-5">
                        <Repeat
                            className="mt-px size-[18px] shrink-0"
                            aria-hidden
                        />
                        <span className="min-w-0 flex-1">
                            {series === "occurrence"
                                ? t.edit.series
                                : t.edit.seriesSource}
                        </span>
                        {series === "occurrence" && seriesEditHref ? (
                            <Link
                                href={seriesEditHref}
                                className="text-foreground font-medium underline underline-offset-[3px]"
                            >
                                {t.edit.seriesEdit}
                            </Link>
                        ) : null}
                    </p>
                ) : null}
                {canResyncTopics ? (
                    <div className="border-border/60 flex flex-wrap gap-2 border-t pt-[18px]">
                        <ResyncTopicThreadButton
                            serverId={serverId}
                            eventId={eventId}
                            dictionary={dictionary}
                        />
                    </div>
                ) : null}
            </section>
            <div className="flex max-w-[460px] min-w-0 flex-[1_1_360px] flex-col">
                <NewMatchPreview
                    model={preview}
                    step="review"
                    dictionary={dictionary}
                    copy={previewCopy}
                    hint={t.overview.previewHint}
                    note={null}
                />
            </div>
        </div>
    )
}
