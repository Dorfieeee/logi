"use client"

import {
    ChevronDown,
    ChevronRight,
    ClipboardList,
    Loader2,
    Radio,
    Save,
} from "lucide-react"
import { signupListMembership } from "@/domain/events/signup-list"
import { Fragment, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import Link from "next/link"

import {
    applyAttendanceExcuses,
    buildMatchAttendance,
    buildMatchResponseRows,
    type MatchResponse,
    planAttendanceChanges,
    setRosterPresence,
    type AttendanceMark,
    type MatchAttendanceEntry,
} from "@/domain/rosters/match-attendance"
import {
    resolveRosterScoreCategory,
    type RosterScoreChangeSummary,
    type RosterScoreSettings,
} from "@/domain/events/score-policy"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    ReminderButton,
    type ReminderAudienceState,
} from "@/components/app/match-detail/reminder-button"
import { ConcludeEventButton } from "@/components/app/conclude-event-button"
import type { AppUser, EventRecord, Roster } from "@/types/domain"
import { EmptyState } from "@/components/app/empty-state"
import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Filter = "all" | MatchResponse

const MARKS: AttendanceMark[] = ["present", "excused", "absent"]

function formatDelta(delta: number) {
    return delta > 0 ? `+${delta}` : delta < 0 ? `−${Math.abs(delta)}` : "0"
}

function deltaClass(delta: number) {
    return delta > 0
        ? "text-emerald-700 dark:text-emerald-400"
        : delta < 0
          ? "text-red-600 dark:text-red-400"
          : undefined
}

/** Counts in a summary line are bold, as in the design. */
function BoldNumbers({ text }: { text: string }) {
    return (
        <>
            {text.split(/(\d+)/).map((part, index) =>
                /^\d+$/.test(part) ? (
                    <strong key={index} className="font-semibold">
                        {part}
                    </strong>
                ) : (
                    part
                )
            )}
        </>
    )
}

/**
 * Sign-ups and attendance of a match (design E3): counts, per-player
 * attendance with the points it gives, loading presence from the meeting
 * voice channel and closing the match with a summary of the points.
 * Attendance is stored on the roster, so it is saved through the roster.
 */
export function MatchAttendancePanel({
    serverId,
    event,
    roster,
    users,
    memberIds,
    scoredUserIds,
    assignments,
    scoreSettings,
    closeSummary,
    canAdmin,
    meetingChannelConfigured,
    meetingChannelName,
    reminder,
    locale,
    timeZone,
    closeAvailable,
    signupHistoryHref,
    createRosterHref,
    dictionary,
}: {
    serverId: string
    event: EventRecord
    roster: Roster | null
    users: AppUser[]
    memberIds: string[]
    scoredUserIds: string[]
    assignments: Array<{
        userId: string
        type: "member" | "reserve_member" | "mercenary"
        status: "pending" | "recruit" | "active"
    }>
    scoreSettings: RosterScoreSettings
    closeSummary: RosterScoreChangeSummary
    canAdmin: boolean
    meetingChannelConfigured: boolean
    /** Name of the meeting voice channel from Discord, when known. */
    meetingChannelName?: string
    /** Members who have not answered, for the reminder in that filter. */
    reminder: ReminderAudienceState
    locale: string
    timeZone: string
    /** Closing is possible once the meeting has started. */
    closeAvailable: boolean
    signupHistoryHref: string
    createRosterHref?: string
    dictionary: Dictionary
}) {
    const t = dictionary.matchDetail.attendance
    const router = useRouter()
    const [overrides, setOverrides] = useState<Map<string, AttendanceMark>>(
        () => new Map()
    )
    const [filter, setFilter] = useState<Filter>("all")
    const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
    const [isSaving, startSaving] = useTransition()
    const [isLoadingVoice, setIsLoadingVoice] = useState(false)
    const concluded = event.status === "concluded"
    const editable = canAdmin && !concluded && Boolean(roster)

    const usersById = useMemo(
        () => new Map(users.map((user) => [user.discordId, user])),
        [users]
    )
    const membershipById = useMemo(
        () =>
            new Map(
                assignments.map((assignment) => [
                    assignment.userId,
                    signupListMembership(assignment),
                ])
            ),
        [assignments]
    )
    const membershipLabels = dictionary.newMatch.signups.statuses
    function groupPlayers<T>(items: T[], idOf: (item: T) => string) {
        const categories = [
            "member",
            "recruit",
            "reserve_member",
            "mercenary",
            "unknown",
        ] as const
        return categories
            .map((category) => ({
                category,
                label:
                    category === "unknown"
                        ? dictionary.common.unknown
                        : membershipLabels[category],
                items: items
                    .filter(
                        (item) =>
                            (membershipById.get(idOf(item)) ?? "unknown") ===
                            category
                    )
                    .sort((a, b) =>
                        (usersById.get(idOf(a))?.name ?? "").localeCompare(
                            usersById.get(idOf(b))?.name ?? "",
                            locale
                        )
                    ),
            }))
            .filter((group) => group.items.length)
    }
    const savedAttendance = useMemo(
        () =>
            buildMatchAttendance({
                roster,
                participants: event.participants,
                notices: event.absenceNotices,
                memberIds,
            }),
        [event.absenceNotices, event.participants, memberIds, roster]
    )
    // Presence is saved on the roster, admin excuses on the match; only real
    // differences from the saved state count as changes.
    const plan = useMemo(
        () =>
            planAttendanceChanges({
                entries: savedAttendance.entries,
                marks: overrides,
            }),
        [overrides, savedAttendance.entries]
    )
    const changeCount = new Set([
        ...plan.presence.keys(),
        ...plan.excuses.keys(),
    ]).size
    const board = useMemo(() => {
        if (!roster) return null
        let next = roster
        for (const [userId, present] of plan.presence) {
            next = setRosterPresence(next, userId, present)
        }
        return next
    }, [plan.presence, roster])
    const notices = useMemo(
        () =>
            plan.excuses.size === 0
                ? event.absenceNotices
                : applyAttendanceExcuses({
                      notices: event.absenceNotices,
                      excuses: plan.excuses,
                      actorId: "pending",
                      now: event.updatedAt,
                  }),
        [event.absenceNotices, event.updatedAt, plan.excuses]
    )
    const attendance = useMemo(
        () =>
            changeCount === 0
                ? savedAttendance
                : buildMatchAttendance({
                      roster: board,
                      participants: event.participants,
                      notices,
                      memberIds,
                  }),
        [
            board,
            changeCount,
            event.participants,
            memberIds,
            notices,
            savedAttendance,
        ]
    )

    function pointsFor(userId: string) {
        if (
            !scoredUserIds.includes(userId) ||
            event.scoreResolution === "skipped"
        )
            return null
        return scoreSettings[
            resolveRosterScoreCategory({
                userId,
                participants: event.participants,
                notices,
                roster: board,
            })
        ]
    }

    function placeOf(entry: MatchAttendanceEntry) {
        return entry.placement.kind === "slot"
            ? [entry.placement.squadName, entry.placement.roleName]
                  .filter(Boolean)
                  .join(" · ")
            : t.eventReserve
    }

    function nameOf(userId: string) {
        return usersById.get(userId)?.name ?? dictionary.common.unknown
    }

    function setMark(entry: MatchAttendanceEntry, mark: AttendanceMark) {
        setOverrides((current) => {
            const next = new Map(current)
            next.set(entry.userId, mark)
            return next
        })
    }

    function save() {
        if (!board || changeCount === 0) return
        startSaving(async () => {
            if (plan.presence.size > 0) {
                const response = await fetch(
                    `/api/servers/${serverId}/rosters`,
                    {
                        method: "POST",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({
                            rosterId: board.id,
                            eventId: event.id,
                            squadPresetId: board.squadPresetId || undefined,
                            squads: board.squads,
                            reservePlayerIds: board.reservePlayerIds,
                            reserveAttendances: board.reserveAttendances ?? [],
                            notAttendingPlayerIds: board.notAttendingPlayerIds,
                            streamerId: board.streamerId,
                            published: board.published,
                        }),
                    }
                ).catch(() => null)
                const body = (await response?.json().catch(() => null)) as {
                    error?: string
                } | null
                if (!response?.ok) {
                    toast.error(body?.error ?? dictionary.common.error)
                    return
                }
            }
            if (plan.excuses.size > 0) {
                const response = await fetch(
                    `/api/servers/${encodeURIComponent(serverId)}/events/${encodeURIComponent(event.id)}/excuses`,
                    {
                        method: "POST",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({
                            excuses: [...plan.excuses].map(
                                ([userId, excused]) => ({ userId, excused })
                            ),
                        }),
                    }
                ).catch(() => null)
                if (!response?.ok) {
                    toast.error(dictionary.common.error)
                    router.refresh()
                    return
                }
            }
            setOverrides(new Map())
            toast.success(t.saved)
            router.refresh()
        })
    }

    async function loadFromVoice() {
        if (!roster) return
        setIsLoadingVoice(true)
        try {
            const response = await fetch(
                `/api/servers/${serverId}/rosters/${roster.id}/confirm-meeting-attendance`,
                { method: "POST" }
            )
            const body = (await response.json().catch(() => null)) as {
                error?: string
                updatedCount?: number
            } | null
            if (!response.ok) {
                toast.error(body?.error ?? dictionary.common.error)
                return
            }
            toast.success(
                t.loadedFromVoice.replace(
                    "{count}",
                    String(body?.updatedCount ?? 0)
                )
            )
            router.refresh()
        } catch {
            toast.error(dictionary.common.error)
        } finally {
            setIsLoadingVoice(false)
        }
    }

    const foundInVoice = new Set(roster?.meetingAttendance?.foundUserIds ?? [])
    const lastLoaded = roster?.meetingAttendance
        ? t.lastLoaded
              .replace(
                  "{time}",
                  new Intl.DateTimeFormat(locale, {
                      timeZone,
                      hour: "2-digit",
                      minute: "2-digit",
                  }).format(new Date(roster.meetingAttendance.loadedAt))
              )
              .replace("{count}", String(roster.meetingAttendance.voiceCount))
              .replace(
                  "{channel}",
                  meetingChannelName ??
                      dictionary.matchDetail.discord.meetingChannel
              )
        : null
    const responseRows = buildMatchResponseRows({
        attendance,
        participants: event.participants,
        memberIds,
    })
    const responseLabels = {
        attending: t.signedUp,
        declined: t.before.declined,
        noResponse: t.before.noResponse,
    }
    const responseCounts = { attending: 0, declined: 0, noResponse: 0 }
    for (const row of responseRows) responseCounts[row.response] += 1
    const summaryCards = (["attending", "declined", "noResponse"] as const).map(
        (id) => ({
            id,
            label: responseLabels[id],
            value: t.playerCount.replace("{count}", String(responseCounts[id])),
        })
    )
    const filters: Array<{ id: Filter; label: string }> = [
        { id: "all", label: `${t.allResponses} (${responseRows.length})` },
        ...summaryCards.map((card) => ({
            id: card.id,
            label: `${card.label} (${responseCounts[card.id]})`,
        })),
    ]
    const visibleRows = responseRows.filter(
        (row) => filter === "all" || row.response === filter
    )
    const groups = groupPlayers(visibleRows, (row) => row.userId)

    return (
        <div className="space-y-4 pb-24 sm:pb-0">
            <section
                aria-label={t.summaryLabel}
                className="border-border/70 bg-card grid grid-cols-3 overflow-hidden rounded-2xl border"
            >
                {summaryCards.map((card) => (
                    <button
                        type="button"
                        aria-pressed={filter === card.id}
                        onClick={() => setFilter(card.id)}
                        key={card.label}
                        className={cn(
                            "border-border/70 hover:bg-muted/50 border-r px-3 py-4 text-left last:border-r-0",
                            filter === card.id && "bg-muted/60"
                        )}
                    >
                        <div className="text-muted-foreground text-[11px] font-semibold tracking-[0.08em] uppercase">
                            {card.label}
                        </div>
                        <div className="mt-1 text-sm">
                            <BoldNumbers text={card.value} />
                        </div>
                    </button>
                ))}
            </section>

            {concluded ? (
                <p
                    role="status"
                    className="border-border/60 bg-muted/40 rounded-xl border px-4 py-3 text-sm"
                >
                    {event.scoreResolution === "skipped"
                        ? t.closedSkipped
                        : event.scoreResolution === "applied"
                          ? t.closedApplied
                          : t.closedPending}
                </p>
            ) : canAdmin ? (
                <div className="space-y-2">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-wrap items-center gap-2">
                            {roster ? (
                                <Button
                                    variant="outline"
                                    className="rounded-xl"
                                    onClick={loadFromVoice}
                                    disabled={
                                        !meetingChannelConfigured ||
                                        isLoadingVoice ||
                                        isSaving
                                    }
                                >
                                    {isLoadingVoice ? (
                                        <Loader2 className="size-4 animate-spin" />
                                    ) : (
                                        <Radio className="size-4" />
                                    )}
                                    {isLoadingVoice
                                        ? t.loadingFromVoice
                                        : t.loadFromVoice}
                                </Button>
                            ) : null}
                            {roster && !meetingChannelConfigured ? (
                                <span className="text-muted-foreground text-xs">
                                    {t.voiceNotConfigured}
                                </span>
                            ) : lastLoaded ? (
                                <span className="text-muted-foreground text-sm">
                                    {lastLoaded}
                                </span>
                            ) : null}
                        </div>
                        <ConcludeEventButton
                            serverId={serverId}
                            eventId={event.id}
                            disabled={
                                !closeAvailable || changeCount > 0 || isSaving
                            }
                            dictionary={dictionary}
                            summary={closeSummary}
                            label={t.closeMatch}
                            primary
                        />
                    </div>
                    <p className="text-muted-foreground text-sm">
                        {t.help}
                        {changeCount > 0 ? ` ${t.saveFirst}` : ""}
                    </p>
                </div>
            ) : null}

            {!roster ? (
                <EmptyState
                    icon={ClipboardList}
                    title={t.noRosterTitle}
                    description={t.noRosterDescription}
                    actions={
                        createRosterHref ? (
                            <Button asChild className="rounded-xl">
                                <Link href={createRosterHref}>
                                    {dictionary.matchDetail.roster.create}
                                </Link>
                            </Button>
                        ) : undefined
                    }
                />
            ) : null}

            <div
                role="group"
                aria-label={t.filterLabel}
                className="flex flex-wrap gap-2"
            >
                {filters.map((item) => (
                    <button
                        key={item.id}
                        type="button"
                        aria-pressed={filter === item.id}
                        className={cn(
                            "h-8 rounded-full border px-3 text-sm transition-colors",
                            filter === item.id
                                ? "border-foreground text-foreground font-medium"
                                : "border-border text-muted-foreground hover:text-foreground"
                        )}
                        onClick={() => setFilter(item.id)}
                    >
                        {item.label}
                    </button>
                ))}
                <Link
                    href={signupHistoryHref}
                    className="border-border text-muted-foreground hover:text-foreground inline-flex h-8 items-center rounded-full border px-3 text-sm transition-colors"
                >
                    {t.signupHistory}
                </Link>
            </div>

            <p className="text-muted-foreground text-sm">{t.responseHelp}</p>
            <details className="border-border/70 rounded-xl border px-4 py-3 text-sm">
                <summary className="cursor-pointer font-medium">
                    {t.scoringRules}
                </summary>
                <p className="text-muted-foreground mt-2">{t.pointsHelp}</p>
                <ul className="mt-2 space-y-1">
                    {Object.entries(scoreSettings).map(([category, delta]) => (
                        <li key={category}>
                            {dictionary.matchDetail.close.categories[
                                category as keyof RosterScoreSettings
                            ].replace("{count}", "1")}
                            : {formatDelta(delta)}
                        </li>
                    ))}
                </ul>
            </details>
            {(filter === "all" || filter === "noResponse") &&
            canAdmin &&
            !concluded ? (
                <div className="border-border/70 bg-card flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-3">
                    <span className="text-muted-foreground text-sm">
                        {t.noResponseHint.replace(
                            "{count}",
                            String(responseCounts.noResponse)
                        )}
                    </span>
                    <ReminderButton
                        serverId={serverId}
                        eventId={event.id}
                        audience="unanswered"
                        state={reminder}
                        dictionary={dictionary}
                    />
                </div>
            ) : null}
            {event.requiredRoleIds?.length ? (
                <p className="text-muted-foreground text-sm">
                    {t.roleEligibilityUnknown}
                </p>
            ) : null}
            <div className="border-border/70 bg-card overflow-x-auto rounded-2xl border">
                <Table>
                    <TableHeader className="bg-muted/40">
                        <TableRow>
                            <TableHead scope="col">
                                {t.columns.player}
                            </TableHead>
                            <TableHead scope="col">
                                {t.responseColumn}
                            </TableHead>
                            <TableHead scope="col">{t.columns.place}</TableHead>
                            <TableHead
                                scope="col"
                                className="hidden lg:table-cell"
                            >
                                {t.columns.before}
                            </TableHead>
                            <TableHead scope="col">
                                {t.columns.attendance}
                            </TableHead>
                            <TableHead scope="col" className="text-right">
                                {concluded
                                    ? t.currentRulePoints
                                    : t.previewPoints}
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {groups.length === 0 ? (
                            <TableRow>
                                <TableCell
                                    colSpan={6}
                                    className="text-muted-foreground py-8 text-center"
                                >
                                    {t.empty}
                                </TableCell>
                            </TableRow>
                        ) : null}
                        {groups.map((group) => {
                            const closed = collapsed.has(group.category)
                            return (
                                <Fragment key={group.category}>
                                    <TableRow className="bg-muted/70 hover:bg-muted/70">
                                        <TableHead
                                            colSpan={6}
                                            scope="rowgroup"
                                            className="p-0"
                                        >
                                            <button
                                                type="button"
                                                aria-expanded={!closed}
                                                aria-controls={group.items
                                                    .map(
                                                        (row) =>
                                                            `attendance-${group.category}-${row.userId}`
                                                    )
                                                    .join(" ")}
                                                className="flex w-full items-center gap-2 px-4 py-3 text-left font-semibold"
                                                onClick={() =>
                                                    setCollapsed((current) => {
                                                        const next = new Set(
                                                            current
                                                        )
                                                        if (
                                                            next.has(
                                                                group.category
                                                            )
                                                        )
                                                            next.delete(
                                                                group.category
                                                            )
                                                        else
                                                            next.add(
                                                                group.category
                                                            )
                                                        return next
                                                    })
                                                }
                                            >
                                                {closed ? (
                                                    <ChevronRight className="size-4" />
                                                ) : (
                                                    <ChevronDown className="size-4" />
                                                )}
                                                {group.label}
                                                <span className="bg-background rounded-md px-2 py-0.5 text-xs tabular-nums">
                                                    {group.items.length}
                                                </span>
                                            </button>
                                        </TableHead>
                                    </TableRow>
                                    {group.items.map((row) => {
                                        const entry = row.entry
                                        const points = pointsFor(row.userId)
                                        const category =
                                            resolveRosterScoreCategory({
                                                userId: row.userId,
                                                participants:
                                                    event.participants,
                                                notices,
                                                roster: board,
                                            })
                                        return (
                                            <TableRow
                                                key={row.userId}
                                                hidden={closed}
                                                id={`attendance-${group.category}-${row.userId}`}
                                            >
                                                <TableHead
                                                    scope="row"
                                                    className="font-normal"
                                                >
                                                    <span className="text-foreground">
                                                        {nameOf(row.userId)}
                                                    </span>
                                                    {entry ? (
                                                        <span className="text-muted-foreground mt-1 block max-w-48 text-xs whitespace-normal lg:hidden">
                                                            {entry.before
                                                                .kind ===
                                                            "notice"
                                                                ? t.before.notice.replace(
                                                                      "{reason}",
                                                                      entry
                                                                          .before
                                                                          .reason
                                                                  )
                                                                : t.before[
                                                                      entry
                                                                          .before
                                                                          .kind
                                                                  ]}
                                                        </span>
                                                    ) : null}
                                                </TableHead>
                                                <TableCell>
                                                    <span
                                                        className={cn(
                                                            "inline-flex rounded-md px-2 py-1 text-xs font-medium whitespace-nowrap",
                                                            row.response ===
                                                                "attending"
                                                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                                                : row.response ===
                                                                    "declined"
                                                                  ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                                                                  : "bg-muted text-muted-foreground"
                                                        )}
                                                    >
                                                        {
                                                            responseLabels[
                                                                row.response
                                                            ]
                                                        }
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-muted-foreground">
                                                    {entry
                                                        ? placeOf(entry)
                                                        : row.response ===
                                                            "attending"
                                                          ? t.unplacedTitle
                                                          : "—"}
                                                </TableCell>
                                                <TableCell className="text-muted-foreground hidden max-w-64 whitespace-normal lg:table-cell">
                                                    {entry
                                                        ? entry.before.kind ===
                                                          "notice"
                                                            ? t.before.notice.replace(
                                                                  "{reason}",
                                                                  entry.before
                                                                      .reason
                                                              )
                                                            : t.before[
                                                                  entry.before
                                                                      .kind
                                                              ]
                                                        : "—"}
                                                </TableCell>
                                                <TableCell>
                                                    {entry ? (
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <MarkGroup
                                                                entry={entry}
                                                                label={t.markGroupLabel.replace(
                                                                    "{name}",
                                                                    nameOf(
                                                                        row.userId
                                                                    )
                                                                )}
                                                                labels={t.marks}
                                                                excusedHelp={
                                                                    t.excusedHelp
                                                                }
                                                                disabled={
                                                                    !editable ||
                                                                    isSaving
                                                                }
                                                                onChange={(
                                                                    mark
                                                                ) =>
                                                                    setMark(
                                                                        entry,
                                                                        mark
                                                                    )
                                                                }
                                                            />
                                                            {entry.mark ===
                                                                "present" &&
                                                            foundInVoice.has(
                                                                row.userId
                                                            ) ? (
                                                                <span className="text-muted-foreground text-xs">
                                                                    {
                                                                        t.fromVoice
                                                                    }
                                                                </span>
                                                            ) : null}
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground">
                                                            —
                                                        </span>
                                                    )}
                                                </TableCell>
                                                <TableCell
                                                    className={cn(
                                                        "text-right text-xs font-semibold tabular-nums",
                                                        points !== null &&
                                                            deltaClass(points)
                                                    )}
                                                    title={
                                                        points === null
                                                            ? t.notScored
                                                            : dictionary.matchDetail.close.categories[
                                                                  category
                                                              ].replace(
                                                                  "{count}",
                                                                  "1"
                                                              )
                                                    }
                                                >
                                                    {points === null
                                                        ? t.notScored
                                                        : formatDelta(points)}
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </Fragment>
                            )
                        })}
                    </TableBody>
                </Table>
            </div>

            {changeCount > 0 ? (
                <div className="bg-background/95 border-border/70 fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t px-4 py-3 sm:static sm:rounded-xl sm:border sm:px-4">
                    <span className="text-muted-foreground text-sm">
                        {t.unsavedChanges.replace(
                            "{count}",
                            String(changeCount)
                        )}
                    </span>
                    <Button
                        className="rounded-xl"
                        onClick={save}
                        disabled={isSaving}
                    >
                        {isSaving ? (
                            <Loader2 className="size-4 animate-spin" />
                        ) : (
                            <Save className="size-4" />
                        )}
                        {t.save}
                    </Button>
                </div>
            ) : null}
        </div>
    )
}

function MarkGroup({
    entry,
    label,
    labels,
    excusedHelp,
    disabled,
    onChange,
}: {
    entry: MatchAttendanceEntry
    label: string
    labels: Record<AttendanceMark, string>
    excusedHelp: string
    disabled: boolean
    onChange: (mark: AttendanceMark) => void
}) {
    return (
        <div
            role="radiogroup"
            aria-label={label}
            className="bg-muted inline-flex rounded-lg p-0.5"
        >
            {MARKS.map((mark) => {
                const checked = entry.mark === mark
                // A player who sent a late notice stays excused at least;
                // an admin can excuse anyone else.
                const unavailable = mark === "absent" && entry.hasNotice
                return (
                    <button
                        key={mark}
                        type="button"
                        role="radio"
                        aria-checked={checked}
                        disabled={disabled || unavailable}
                        title={unavailable ? excusedHelp : undefined}
                        onClick={() => onChange(mark)}
                        className={cn(
                            "rounded-md px-1.5 py-1 text-[11px] whitespace-nowrap transition-colors disabled:cursor-not-allowed sm:px-2.5 sm:text-xs",
                            checked
                                ? "bg-background text-foreground font-semibold shadow-sm"
                                : "text-muted-foreground hover:text-foreground disabled:opacity-40"
                        )}
                    >
                        {labels[mark]}
                    </button>
                )
            })}
        </div>
    )
}
