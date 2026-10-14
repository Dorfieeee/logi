import {
    attendingCount,
    isPlayed,
    matchListPhase,
    matchListQueue,
    weekOffset,
    weekStartDate,
    type MatchListResultReview,
    type MatchPhase,
} from "@/domain/events/match-list"
import {
    describeRepeat,
    formatDeadline,
    formatListDate,
} from "@/lib/match-list-format"
import type { MatchCompetitionLabel } from "@/lib/read-models/competition-labels"
import { DEFAULT_GAME_ID, GAME_LABELS, type GameId } from "@/domain/games/game"
import type { EventCategory, EventRecord, Roster } from "@/types/domain"
import { getEventCategoryLabel } from "@/lib/event-categories"
import { formatHllPresetLabel } from "@/lib/hll-map-presets"
import type { Dictionary } from "@/i18n/dictionaries"
import { pluralize } from "@/i18n/plural"

export type MatchBadgeTone = "info" | "attention" | "success" | "neutral"

/** One row of the match list, ready to render and filter in the browser. */
export type MatchListRow = {
    id: string
    href: string
    kind: "match" | "training"
    gameId: GameId
    played: boolean
    weekKey: number
    weekLabel: string
    date: string
    time: string
    title: string
    details: string
    /** Sign-ups, the score or the training outcome; empty when there is none. */
    metric: string
    metricTone: "strong" | "default" | "muted"
    badge: { label: string; tone: MatchBadgeTone }
    search: string
}

export type MatchListQueueRow = {
    kind: "publishRoster" | "confirmResult" | "confirmAttendance"
    href: string
    title: string
    detail: string
}

function fill(template: string, values: Record<string, string | number>) {
    return Object.entries(values).reduce(
        (text, [key, value]) => text.split(`{${key}}`).join(String(value)),
        template
    )
}

function scoreText(scores: readonly number[] | null) {
    return scores ? scores.join(" : ") : ""
}

function weekLabel(
    offset: number,
    weekStart: string,
    text: Dictionary["matchList"],
    locale: string
) {
    if (offset === 0) return text.weeks.thisWeek
    if (offset === 1) return text.weeks.nextWeek
    if (offset === -1) return text.weeks.lastWeek
    return fill(text.weeks.weekOf, {
        date: formatListDate(weekStart, locale, "UTC").day,
    })
}

function outcomeLabel(
    outcome: "victory" | "defeat" | "draw",
    dictionary: Dictionary
) {
    return outcome === "victory"
        ? dictionary.event.resultVictory
        : outcome === "defeat"
          ? dictionary.event.resultDefeat
          : dictionary.event.resultDraw
}

function phaseBadge(
    phase: MatchPhase,
    dictionary: Dictionary,
    deadline: (iso: string) => string
): MatchListRow["badge"] {
    const text = dictionary.matchList.phase
    switch (phase.kind) {
        case "draft":
            return { label: text.draft, tone: "neutral" }
        case "registration":
            return {
                label: fill(text.registration, {
                    when: deadline(phase.closesAt),
                }),
                tone: "info",
            }
        case "registrationClosed":
            return { label: text.registrationClosed, tone: "neutral" }
        case "rosterMissing":
            return { label: text.rosterMissing, tone: "attention" }
        case "rosterDraft":
            return { label: text.rosterDraft, tone: "attention" }
        case "rosterPublished":
            return phase.unconfirmed > 0
                ? {
                      label: fill(text.unconfirmed, {
                          count: phase.unconfirmed,
                      }),
                      tone: "attention",
                  }
                : { label: text.rosterPublished, tone: "success" }
        case "awaitingResult":
            return { label: text.awaitingResult, tone: "attention" }
        case "resultPending":
            return { label: text.resultPending, tone: "attention" }
        case "result": {
            const tone = phase.outcome === "victory" ? "success" : "neutral"
            if (!phase.outcome)
                return {
                    label:
                        phase.review === "corrected"
                            ? text.corrected
                            : text.confirmed,
                    tone,
                }
            const outcome = outcomeLabel(phase.outcome, dictionary)
            return {
                label: phase.review
                    ? fill(
                          phase.review === "corrected"
                              ? text.resultCorrected
                              : text.resultConfirmed,
                          { outcome }
                      )
                    : outcome,
                tone,
            }
        }
        case "trainingCompleted":
        case "concluded":
            return { label: text.concluded, tone: "success" }
    }
}

function phaseMetric(
    phase: MatchPhase,
    signedUp: number,
    dictionary: Dictionary,
    locale: string
): { metric: string; tone: MatchListRow["metricTone"] } {
    const text = dictionary.matchList
    switch (phase.kind) {
        case "draft":
            return { metric: text.notAnnounced, tone: "muted" }
        case "result":
        case "resultPending":
            return phase.scores
                ? { metric: scoreText(phase.scores), tone: "strong" }
                : { metric: "", tone: "default" }
        case "trainingCompleted":
            return {
                metric: [
                    pluralize(locale, phase.passed, text.trainingPassed),
                    pluralize(locale, phase.failed, text.trainingFailed),
                ].join(", "),
                tone: "default",
            }
        default:
            return {
                metric: pluralize(locale, signedUp, text.signedUp),
                tone: "default",
            }
    }
}

/** "Allies" → "Spojenci"; an unknown side stays as entered. */
function sideLabel(side: string | undefined, dictionary: Dictionary) {
    if (!side) return undefined
    const factions: Record<string, string> =
        dictionary.publicPanelAppearance.factions
    return factions[side.trim().toLowerCase()] ?? side
}

function hasOpponent(event: EventRecord) {
    return Boolean(event.matchTeams?.some((team) => team.slot !== "a"))
}

/** "competition ECL 2026, playoffs"; the season is left out when the name has it. */
function competitionText(label: MatchCompetitionLabel, dictionary: Dictionary) {
    const text = dictionary.matchList
    const season = label.season.trim()
    const name =
        season && !label.name.includes(season)
            ? `${label.name} ${season}`
            : label.name
    const phase =
        label.phase === "league"
            ? undefined
            : text.competitionPhases[label.phase]
    return [text.competition.replace("{name}", name), phase]
        .filter(Boolean)
        .join(", ")
}

type BuildInput = {
    events: EventRecord[]
    rosters: Roster[]
    categories: EventCategory[] | undefined
    canAdmin: boolean
    locale: string
    serverId: string
    timeZone: string
    dictionary: Dictionary
    now: Date
    /** Result review state by event, read only for clan managers. */
    reviews?: ReadonlyMap<string, MatchListResultReview>
    /** Published competition of each linked match. */
    competitions?: ReadonlyMap<string, MatchCompetitionLabel>
}

/**
 * Rows, drafts and organiser tasks of the match list for one clan. Drafts are
 * separate from the other rows and only managers get them; members never see
 * an unpublished match.
 */
export function buildMatchListRows(input: BuildInput) {
    const { dictionary, locale, timeZone, now, canAdmin } = input
    const text = dictionary.matchList
    const reviews = canAdmin
        ? (input.reviews ?? new Map<string, MatchListResultReview>())
        : new Map<string, MatchListResultReview>()
    const base = `/${locale}/dashboard/servers/${input.serverId}`
    const visibleEvents = canAdmin
        ? input.events
        : input.events.filter((event) => !event.isDraft)
    const rosterByEvent = new Map(
        input.rosters.map((roster) => [roster.eventId, roster])
    )
    const eventById = new Map(visibleEvents.map((event) => [event.id, event]))
    const detailHref = (event: EventRecord, tab?: string) =>
        `${base}/${event.kind === "training" ? "trainings" : "matches"}/${event.id}${tab ? `?tab=${tab}` : ""}`
    const startOf = (event: EventRecord) =>
        event.kind === "training" ? event.meetingStart : event.gameStart
    const deadline = (iso: string) => formatDeadline(iso, now, locale, timeZone)

    function rowHref(event: EventRecord, phase: MatchPhase) {
        if (phase.kind === "draft")
            return `${base}/matches/create?draftId=${encodeURIComponent(event.id)}`
        // A reviewed Wardogs result has its own report. Once it exists, the
        // played-match list should take people straight to that report rather
        // than making them find the secondary "match details" action on the
        // event screen.
        if (event.kind === "match" && event.wardogsReportId)
            return `${base}/matches/${event.id}/match-stats`
        if (!canAdmin || event.kind === "training") return detailHref(event)
        // A manager lands on the part of the match that needs them.
        if (phase.kind === "rosterMissing" || phase.kind === "rosterDraft")
            return detailHref(event, "roster")
        if (phase.kind === "resultPending" || phase.kind === "awaitingResult")
            return detailHref(event, "result")
        return detailHref(event)
    }

    function details(event: EventRecord, phase: MatchPhase, gameId: GameId) {
        const competition = input.competitions?.get(event.id)
        if (event.kind === "training")
            return [
                text.training,
                phase.kind === "trainingCompleted" || phase.kind === "concluded"
                    ? pluralize(
                          locale,
                          attendingCount(event),
                          text.participants
                      )
                    : event.recurrence
                      ? describeRepeat(event.recurrence, dictionary, locale)
                      : GAME_LABELS[gameId],
            ]
        return [
            GAME_LABELS[gameId],
            event.map
                ? (formatHllPresetLabel(event.map, event.gameId) ?? event.map)
                : undefined,
            sideLabel(event.side, dictionary),
            phase.kind === "draft" && !hasOpponent(event)
                ? text.noOpponent
                : undefined,
            competition ? competitionText(competition, dictionary) : undefined,
        ]
    }

    const all = visibleEvents.map((event) => {
        const gameId = event.gameId ?? DEFAULT_GAME_ID
        const phase = matchListPhase(
            event,
            rosterByEvent.get(event.id),
            now,
            reviews.get(event.id)
        )
        const start = startOf(event)
        const offset = weekOffset(start, now, timeZone)
        const { date, time } = formatListDate(start, locale, timeZone)
        const category = getEventCategoryLabel(event, input.categories)
        const metric = phaseMetric(
            phase,
            attendingCount(event),
            dictionary,
            locale
        )
        const title = [event.name, category].filter(Boolean).join(" · ")
        const detailText = details(event, phase, gameId)
            .filter(Boolean)
            .join(" · ")
        const row: MatchListRow = {
            id: event.id,
            href: rowHref(event, phase),
            kind: event.kind,
            gameId,
            played: isPlayed(event, now),
            weekKey: offset,
            weekLabel: weekLabel(
                offset,
                weekStartDate(start, timeZone),
                text,
                locale
            ),
            date,
            time,
            title,
            details: detailText,
            metric: metric.metric,
            metricTone: metric.tone,
            badge: phaseBadge(phase, dictionary, deadline),
            search: `${title} ${detailText}`.toLocaleLowerCase(locale),
        }
        return { row, draft: Boolean(event.isDraft), start: Date.parse(start) }
    })
    all.sort((left, right) => left.start - right.start)
    const rows = all.filter((item) => !item.draft).map((item) => item.row)
    const drafts = all.filter((item) => item.draft).map((item) => item.row)

    const queue: MatchListQueueRow[] = canAdmin
        ? matchListQueue(visibleEvents, input.rosters, now, reviews).flatMap(
              (item): MatchListQueueRow[] => {
                  const event = eventById.get(item.eventId)
                  if (!event) return []
                  switch (item.kind) {
                      case "publishRoster":
                          return [
                              {
                                  kind: item.kind,
                                  href: detailHref(event, "roster"),
                                  title: text.queue.publishRoster,
                                  detail: [
                                      event.name,
                                      deadline(item.gameStart),
                                      item.openSlots
                                          ? pluralize(
                                                locale,
                                                item.openSlots,
                                                text.queue.openSlots
                                            )
                                          : pluralize(
                                                locale,
                                                item.signedUp,
                                                text.signedUp
                                            ),
                                  ].join(" · "),
                              },
                          ]
                      case "confirmResult": {
                          const source = text.queue.sources[item.origin]
                          return [
                              {
                                  kind: item.kind,
                                  href: detailHref(event, "result"),
                                  title: text.queue.confirmResult,
                                  detail: [
                                      event.name,
                                      item.scores
                                          ? fill(text.queue.resultWaiting, {
                                                source,
                                                score: scoreText(item.scores),
                                            })
                                          : fill(
                                                text.queue.resultWaitingNoScore,
                                                { source }
                                            ),
                                  ].join(" · "),
                              },
                          ]
                      }
                      case "confirmAttendance":
                          return [
                              {
                                  kind: item.kind,
                                  href: detailHref(event, "attendance"),
                                  title: text.queue.confirmAttendance,
                                  detail: [
                                      event.name,
                                      item.unconfirmed
                                          ? pluralize(
                                                locale,
                                                item.unconfirmed,
                                                text.queue.unconfirmed
                                            )
                                          : formatListDate(
                                                item.gameStart,
                                                locale,
                                                timeZone
                                            ).date,
                                  ].join(" · "),
                              },
                          ]
                  }
              }
          )
        : []

    return { rows, drafts, queue }
}

/**
 * Recurring match series as list rows: each row's details start with its
 * schedule; upcoming series first, soonest first, then past ones.
 */
export function buildRecurringMatchRows(input: BuildInput) {
    const series = input.events.filter(
        (event) => event.kind === "match" && event.recurrence && !event.isDraft
    )
    const recurrenceById = new Map(
        series.map((event) => [event.id, event.recurrence])
    )
    const { rows } = buildMatchListRows({ ...input, events: series })
    return rows
        .map((row) => {
            const recurrence = recurrenceById.get(row.id)
            if (!recurrence) return row
            const details = [
                describeRepeat(recurrence, input.dictionary, input.locale),
                row.details,
            ]
                .filter(Boolean)
                .join(" · ")
            return {
                ...row,
                details,
                search: `${row.title} ${details}`.toLocaleLowerCase(
                    input.locale
                ),
            }
        })
        .sort((left, right) => Number(left.played) - Number(right.played))
}
