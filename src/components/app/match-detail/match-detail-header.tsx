import { ArrowLeft, CircleCheck, ExternalLink } from "lucide-react"
import type { ReactNode } from "react"
import Link from "next/link"

import type {
    MatchPhaseDetail,
    MatchPhaseStep,
} from "@/domain/events/match-phase"
import { GAME_LABELS, type GameId } from "@/domain/games/game"
import { formatHllPresetLabel } from "@/lib/hll-map-presets"
import type { Dictionary } from "@/i18n/dictionaries"
import type { EventRecord } from "@/types/domain"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export const MATCH_DETAIL_TABS = [
    "overview",
    "attendance",
    "history",
    "roster",
    "discord",
    "result",
] as const

export type MatchDetailTab = (typeof MATCH_DETAIL_TABS)[number]

export function isMatchDetailTab(value: unknown): value is MatchDetailTab {
    return MATCH_DETAIL_TABS.some((tab) => tab === value)
}

function formatDay(value: string, locale: string, timeZone: string) {
    return new Intl.DateTimeFormat(locale, {
        timeZone,
        weekday: "short",
        day: "numeric",
        month: "numeric",
    }).format(new Date(value))
}

function formatClock(value: string, locale: string, timeZone: string) {
    return new Intl.DateTimeFormat(locale, {
        timeZone,
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date(value))
}

function formatDayTime(value: string, locale: string, timeZone: string) {
    return `${formatDay(value, locale, timeZone)} ${formatClock(value, locale, timeZone)}`
}

function phaseDetailText(
    detail: MatchPhaseDetail,
    dictionary: Dictionary,
    locale: string,
    timeZone: string
) {
    const t = dictionary.matchDetail.phaseDetail
    switch (detail.kind) {
        case "createdAt":
            return t.createdAt.replace(
                "{date}",
                formatDay(detail.at, locale, timeZone)
            )
        case "opensAt":
            return t.opensAt.replace(
                "{date}",
                formatDayTime(detail.at, locale, timeZone)
            )
        case "closesAt":
            return t.closesAt.replace(
                "{date}",
                formatDayTime(detail.at, locale, timeZone)
            )
        case "closedAt":
            return t.closedAt.replace(
                "{date}",
                formatDayTime(detail.at, locale, timeZone)
            )
        case "signedUp":
            return t.signedUp.replace("{count}", String(detail.count))
        case "rosterMissing":
            return t.rosterMissing
        case "rosterDraft":
            return t.rosterDraft
        case "rosterPublished":
            return t.rosterPublished.replace("{count}", String(detail.count))
        case "meetingAt":
            return t.meetingAt.replace(
                "{date}",
                formatDayTime(detail.at, locale, timeZone)
            )
        case "present":
            return t.present.replace("{count}", String(detail.count))
        case "result":
            return t.result[detail.state]
    }
}

/** A step that waits for the admin, such as a result to confirm. */
function needsAttention(phase: MatchPhaseStep) {
    return (
        phase.state === "current" &&
        phase.detail.kind === "result" &&
        (phase.detail.state === "imported" ||
            phase.detail.state === "provisional")
    )
}

/**
 * The shared top of a match (designs D3, E2, E3 and the phone screens):
 * breadcrumb, title with game, map and time, the Discord link and the "⋯"
 * menu, the five-step progress and the section tabs. On phones the top
 * shrinks to a back arrow, the name and the current step. Tabs are links,
 * so every section is its own server-rendered page state.
 */
export function MatchDetailHeader({
    event,
    dictionary,
    locale,
    timeZone,
    listHref,
    phases,
    activeTab,
    tabHref,
    tabCounts,
    played,
    showProgress = true,
    discordHref,
    actions,
}: {
    event: EventRecord
    dictionary: Dictionary
    locale: string
    timeZone: string
    listHref: string
    phases: MatchPhaseStep[]
    activeTab: MatchDetailTab
    tabHref: (tab: MatchDetailTab) => string
    tabCounts?: Partial<Record<MatchDetailTab, number>>
    /** After the match the sign-ups tab is about attendance as well. */
    played: boolean
    showProgress?: boolean
    discordHref?: string
    /** The "⋯" menu; it also carries the Discord link on phones. */
    actions?: ReactNode
}) {
    const t = dictionary.matchDetail
    const gameId: GameId = event.gameId ?? "hell_let_loose"
    const map = formatHllPresetLabel(event.map) ?? event.map
    // The board's meta line is game, map and time; the side is on the roster.
    const mapLine = map ?? ""
    const timeLine = played
        ? t.playedLine
              .replace("{date}", formatDay(event.gameStart, locale, timeZone))
              .replace("{time}", formatClock(event.gameStart, locale, timeZone))
        : t.scheduleLine
              .replace("{date}", formatDay(event.gameStart, locale, timeZone))
              .replace(
                  "{meeting}",
                  formatClock(event.meetingStart, locale, timeZone)
              )
              .replace(
                  "{start}",
                  formatClock(event.gameStart, locale, timeZone)
              )
    const currentIndex = phases.findIndex((phase) => phase.state === "current")
    const stepIndex = currentIndex >= 0 ? currentIndex : phases.length - 1
    const stepLine = t.stepOf
        .replace("{current}", String(stepIndex + 1))
        .replace("{total}", String(phases.length))
        .replace("{label}", t.phases[phases[stepIndex]?.id ?? "result"])
    // Phones always say "Sign-ups" (Mobile board); wider screens name
    // attendance once the match has been played (E2, E3).
    const tabLabel = (tab: MatchDetailTab) =>
        tab === "attendance" ? (
            played ? (
                <>
                    <span className="sm:hidden">{t.tabSignups}</span>
                    <span className="hidden sm:inline">{t.tabs[tab]}</span>
                </>
            ) : (
                t.tabSignups
            )
        ) : tab === "history" ? (
            t.actions.signupHistory
        ) : (
            t.tabs[tab]
        )

    return (
        <div className="flex flex-col gap-4 px-4 lg:px-6">
            {/* Phone: back arrow, name and the current step (Mobile board). */}
            <div className="flex items-center gap-3 sm:hidden">
                <Link
                    href={listHref}
                    aria-label={t.backLabel}
                    className="hover:bg-muted -ml-1 flex size-9 shrink-0 items-center justify-center rounded-xl"
                >
                    <ArrowLeft className="size-5" />
                </Link>
                <div className="min-w-0 flex-1">
                    <h1 className="truncate text-base font-semibold">
                        {event.name}
                    </h1>
                    <p className="text-muted-foreground truncate text-xs">
                        {stepLine}
                    </p>
                </div>
                {actions}
            </div>

            {/* DashboardShell owns the desktop breadcrumb. This header keeps
                back navigation on phones only, avoiding duplicate trails. */}
            <header className="hidden items-start justify-between gap-3 sm:flex">
                <div className="min-w-0 space-y-2">
                    <h1 className="text-2xl font-semibold tracking-tight break-words">
                        {event.name}
                    </h1>
                    <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                        <span className="border-border/80 text-foreground/80 rounded-md border px-2 py-0.5 text-xs">
                            {GAME_LABELS[gameId]}
                        </span>
                        {mapLine ? <span>{mapLine}</span> : null}
                        <span aria-hidden="true">·</span>
                        <span>{timeLine}</span>
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    {discordHref ? (
                        <Button
                            asChild
                            variant="outline"
                            className="rounded-xl"
                        >
                            <a
                                href={discordHref}
                                target="_blank"
                                rel="noreferrer"
                            >
                                {t.openInDiscord}
                                <ExternalLink className="size-4" />
                            </a>
                        </Button>
                    ) : null}
                    {actions}
                </div>
            </header>
            {showProgress ? (
                <ol
                    aria-label={t.progressLabel}
                    className="border-border/70 bg-card hidden grid-cols-5 gap-4 rounded-2xl border px-5 py-4 sm:grid"
                >
                    {phases.map((phase) => (
                        <li
                            key={phase.id}
                            aria-current={
                                phase.state === "current" ? "step" : undefined
                            }
                            className="flex min-w-0 items-start gap-2.5"
                        >
                            {phase.state === "done" ? (
                                <CircleCheck
                                    aria-hidden="true"
                                    className="mt-0.5 size-[18px] shrink-0 text-emerald-600 dark:text-emerald-400"
                                />
                            ) : (
                                <span
                                    aria-hidden="true"
                                    className={cn(
                                        "mt-0.5 size-[18px] shrink-0 rounded-full",
                                        phase.state === "current"
                                            ? "border-foreground border-[5px]"
                                            : "border-muted-foreground/40 border-[1.5px]"
                                    )}
                                />
                            )}
                            <span className="flex min-w-0 flex-col">
                                <span
                                    className={cn(
                                        "text-sm",
                                        phase.state === "current"
                                            ? "font-semibold"
                                            : phase.state === "upcoming"
                                              ? "text-foreground/80"
                                              : undefined
                                    )}
                                >
                                    {t.phases[phase.id]}
                                    <span className="sr-only">
                                        {` (${t.phaseState[phase.state]})`}
                                    </span>
                                </span>
                                <span
                                    className={cn(
                                        "truncate text-xs",
                                        needsAttention(phase)
                                            ? "text-amber-700 dark:text-amber-400"
                                            : "text-muted-foreground"
                                    )}
                                >
                                    {phaseDetailText(
                                        phase.detail,
                                        dictionary,
                                        locale,
                                        timeZone
                                    )}
                                </span>
                            </span>
                        </li>
                    ))}
                </ol>
            ) : null}
            <nav
                aria-label={t.tabsLabel}
                className="border-border/70 -mx-4 overflow-x-auto border-b px-4 lg:mx-0 lg:px-0"
            >
                <ul className="flex min-w-max gap-1">
                    {MATCH_DETAIL_TABS.map((tab) => {
                        const active = tab === activeTab
                        const count = played ? undefined : tabCounts?.[tab]
                        return (
                            <li
                                key={tab}
                                // The phone board leaves Discord out; its
                                // messages are a desktop concern.
                                className={cn(
                                    tab === "discord" &&
                                        !active &&
                                        "hidden sm:block"
                                )}
                            >
                                <Link
                                    href={tabHref(tab)}
                                    aria-current={active ? "page" : undefined}
                                    scroll={false}
                                    className={cn(
                                        "-mb-px inline-flex h-11 items-center gap-1.5 border-b-2 px-3 text-sm whitespace-nowrap transition-colors",
                                        active
                                            ? "border-foreground text-foreground font-semibold"
                                            : "text-muted-foreground hover:text-foreground border-transparent"
                                    )}
                                >
                                    {tabLabel(tab)}
                                    {count !== undefined ? (
                                        <span className="bg-muted text-muted-foreground rounded-md px-1.5 text-[11px] font-medium tabular-nums">
                                            {count}
                                        </span>
                                    ) : null}
                                </Link>
                            </li>
                        )
                    })}
                </ul>
            </nav>
        </div>
    )
}
