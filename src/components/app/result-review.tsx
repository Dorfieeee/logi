"use client"

import {
    Check,
    CheckCircle2,
    Clock3,
    Loader2,
    MessageSquareText,
    Send,
    Server,
    Trophy,
} from "lucide-react"
import { useEffect, useId, useMemo, useState } from "react"
import Link from "next/link"
import { z } from "zod"

import {
    resultReviewSchema,
    resultRevisionSchema,
    type ResultAction,
    type ResultRevision,
} from "@/domain/match-results/result-revision"
import {
    arrangeResultSides,
    resultFaction,
    type ResultFaction,
} from "@/domain/match-results/result-sides"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { suggestResultSession } from "@/domain/match-results/session-pick"
import type { MatchTeamAssignment } from "@/domain/teams/match-teams"
import type { Dictionary } from "@/i18n/dictionaries"
import type { GameId } from "@/domain/games/game"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type ReviewData = z.infer<typeof resultReviewSchema>
type Props = {
    serverId: string
    eventId: string
    gameId: GameId
    dictionary: Dictionary
    /** Server-rendered review, shown before the first refresh finishes. */
    initialData?: ReviewData | null
    /** Match start, used to suggest the server game the result came from. */
    matchStart?: string
    locale?: string
    timeZone?: string
    /** Names of the admins and importers in the history, by Discord ID. */
    actorNames?: Record<string, string>
    /** The faction the clan played, to put its side first. */
    ourSide?: string
    /** Teams picked for the match, for names and logos. */
    matchTeams?: MatchTeamAssignment[]
    clanName?: string
    opponentName?: string
    /** Discord results panel channel; null when none is set up. */
    resultsChannelName?: string | null
    /** Where the matched players are listed. */
    playersHref?: string
    /** The match is linked to a competition fixture. */
    competitionLinked?: boolean
}
type ScoreInput = { id: string; label: string; score: string }

export function ResultReview(props: Props) {
    return (
        <Review
            key={`${props.serverId}:${props.eventId}:${props.gameId}`}
            {...props}
        />
    )
}

function toInputs(
    participants: ReadonlyArray<{
        id: string
        label: string
        score: number | null
    }>
): ScoreInput[] {
    return participants.map((p) => ({
        ...p,
        score: p.score === null ? "" : String(p.score),
    }))
}

/** Editor fields for a review: the current result, else the server game
 * that matches the match time, else two empty participants. */
function editorState(
    data: ReviewData,
    matchStart: string | undefined,
    participantLabel: string,
    matchTeams: MatchTeamAssignment[] | undefined
) {
    const suggestion =
        !data.current && matchStart
            ? suggestResultSession(data.sessions, matchStart)
            : null
    return {
        scores: data.current
            ? toInputs(data.current.participants)
            : suggestion?.participants.length
              ? toInputs(suggestion.participants)
              : matchTeams?.length
                ? [...matchTeams]
                      .sort((left, right) =>
                          left.slot.localeCompare(right.slot)
                      )
                      .map((team, index) => ({
                          id: team.side?.trim() || `participant-${index + 1}`,
                          label: team.snapshot.name,
                          score: "",
                      }))
                : [1, 2].map((n) => ({
                      id: `participant-${n}`,
                      label: `${participantLabel} ${n}`,
                      score: "",
                  })),
        source: data.current?.sessionLinks.length
            ? "keep"
            : (suggestion?.id ?? ""),
        suggested: Boolean(suggestion),
    }
}

function scoreText(
    participants: ReadonlyArray<{ score: number | string | null }>
) {
    return participants
        .map((p) =>
            p.score === null || p.score === "" ? "–" : String(p.score)
        )
        .join(" : ")
}

/**
 * Review of a match result (design E2): the score, the server game it came
 * from, confirmation, and a history where a confirmed result changes only by
 * a correction with a reason.
 */
function Review({
    serverId,
    eventId,
    gameId,
    dictionary,
    initialData,
    matchStart,
    locale = "en",
    timeZone = "UTC",
    actorNames = {},
    ourSide,
    matchTeams,
    clanName,
    opponentName,
    resultsChannelName,
    playersHref,
    competitionLinked = false,
}: Props) {
    const t = dictionary.resultReview
    const m = dictionary.matchDetail.result
    const heading = useId()
    const [initial] = useState(() =>
        initialData
            ? editorState(initialData, matchStart, t.participant, matchTeams)
            : null
    )
    const [data, setData] = useState<ReviewData | null>(initialData ?? null)
    const [scores, setScores] = useState<ScoreInput[]>(initial?.scores ?? [])
    const [source, setSource] = useState(initial?.source ?? "")
    const [suggested, setSuggested] = useState(initial?.suggested ?? false)
    const [choosingSource, setChoosingSource] = useState(false)
    const [reason, setReason] = useState("")
    const [dirty, setDirty] = useState(false)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(false)
    const [refresh, setRefresh] = useState(0)
    const endpoint = `/api/servers/${encodeURIComponent(serverId)}/events/${encodeURIComponent(eventId)}/results?game=${gameId}`

    useEffect(() => {
        const controller = new AbortController()
        void fetch(endpoint, { cache: "no-store", signal: controller.signal })
            .then(async (response) => {
                if (!response.ok) throw new Error()
                const result = resultReviewSchema.parse(await response.json())
                if (controller.signal.aborted) return
                const next = editorState(
                    result,
                    matchStart,
                    t.participant,
                    matchTeams
                )
                setData(result)
                setScores(next.scores)
                setSource(next.source)
                setSuggested(next.suggested)
                setChoosingSource(false)
                setReason("")
                setDirty(false)
                setError(false)
            })
            .catch(() => {
                if (!controller.signal.aborted) {
                    setData(null)
                    setError(true)
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false)
            })
        return () => controller.abort()
    }, [endpoint, refresh, t.participant, matchStart, matchTeams])

    const reload = () => {
        setLoading(true)
        setRefresh((n) => n + 1)
    }

    function formatTime(value: string | null | undefined) {
        if (!value) return t.unknownScore
        return new Intl.DateTimeFormat(locale, {
            timeZone,
            weekday: "short",
            day: "numeric",
            month: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        }).format(new Date(value))
    }

    function formatClock(value: string | null | undefined) {
        if (!value) return ""
        return new Intl.DateTimeFormat(locale, {
            timeZone,
            hour: "2-digit",
            minute: "2-digit",
        }).format(new Date(value))
    }

    async function send(action: ResultAction, expectedRevision: number) {
        const sessionLinks =
            source === "keep"
                ? (data?.current?.sessionLinks.map((s) => s.sessionId) ?? [])
                : source
                  ? [source]
                  : []
        const participants = scores.map((p) => ({
            ...p,
            score: p.score.trim() === "" ? null : Number(p.score),
        }))
        if (
            participants.some(
                (p) => p.score !== null && !Number.isFinite(p.score)
            )
        )
            throw new Error()
        const selected = data?.sessions.find((s) => s.id === source)
        const matchesSource =
            selected &&
            JSON.stringify(participants) ===
                JSON.stringify(selected.participants)
        const command = {
            action,
            expectedRevision,
            ...(action !== "confirm"
                ? {
                      sessionLinks,
                      ...(!matchesSource ? { participants } : {}),
                  }
                : {}),
            ...(action === "correct" ? { reason } : {}),
        }
        const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(command),
        })
        if (!response.ok) throw new Error()
        return resultRevisionSchema.parse(await response.json())
    }

    async function run(action: "stage" | "confirm" | "correct") {
        setLoading(true)
        setError(false)
        try {
            const version = data?.current?.version ?? 0
            if (action === "confirm") {
                // Unsaved edits are saved first, then confirmed as reviewed.
                const staged =
                    dirty || data?.current?.status !== "provisional"
                        ? await send("stage", version)
                        : null
                await send("confirm", staged?.version ?? version)
            } else {
                await send(action, version)
            }
            reload()
        } catch {
            setError(true)
            setLoading(false)
        }
    }

    async function stageLegacyImport() {
        setLoading(true)
        setError(false)
        try {
            const response = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "stage",
                    expectedRevision: data?.current?.version ?? 0,
                }),
            })
            if (!response.ok) throw new Error()
            reload()
        } catch {
            setError(true)
            setLoading(false)
        }
    }

    const current = data?.current ?? null
    const reviewed = current !== null && current.status !== "provisional"
    const status = current?.status ?? "none"
    const selectedSession = data?.sessions.find((s) => s.id === source)
    const linkedPlayers = current?.players.filter((p) => p.logiUserId).length
    const unlinkedPlayers = current?.players.filter((p) => !p.logiUserId).length
    // Oldest first, so the pending confirmation follows the last entry.
    const history = useMemo(
        () => [...(data?.history ?? [])].reverse(),
        [data?.history]
    )

    function sourceTitle() {
        if (source === "keep" && current?.sessionLinks.length) {
            const link = current.sessionLinks[0]!
            return m.sourceSession
                .replace("{map}", link.map ?? m.unknownMap)
                .replace(
                    "{time}",
                    `${formatTime(link.startedAt)}${link.endedAt ? `–${formatClock(link.endedAt)}` : ""}`
                )
        }
        if (selectedSession)
            return m.sourceSession
                .replace("{map}", selectedSession.map ?? m.unknownMap)
                .replace("{time}", formatTime(selectedSession.startedAt))
        return m.sourceManual
    }

    function sourceDetail() {
        const complete =
            source === "keep"
                ? current?.sessionLinks.every((s) => s.complete)
                : selectedSession?.complete
        if (source === "keep" || selectedSession)
            return [
                suggested && source !== "keep" ? m.sourceSuggested : null,
                complete ? m.complete : m.incomplete,
            ]
                .filter(Boolean)
                .join(" · ")
        return null
    }

    function revisionTitle(revision: ResultRevision) {
        const score = scoreText(
            arrangeResultSides(revision.participants, ourSide).ordered
        )
        return revision.origin !== "manual" && revision.status === "provisional"
            ? m.historyImport.replace("{score}", score)
            : m.historyEntry[revision.status].replace("{score}", score)
    }

    function revisionWho(revision: ResultRevision) {
        const id = revision.reviewerId ?? revision.createdBy
        return id ? (actorNames[id] ?? id) : m.automatic
    }

    const editable = !loading && Boolean(data)
    // The clan's side first (design E2), with the outcome from its view.
    const sides = arrangeResultSides(
        scores.map((row, index) => ({
            id: row.id,
            label: row.label,
            score: row.score.trim() === "" ? null : Number(row.score),
            index,
        })),
        ourSide
    )
    const confirmScore = scoreText(
        sides.ordered.map((side) => scores[side.index]!)
    )
    const factionLabels: Record<ResultFaction, string> =
        dictionary.publicPanelAppearance.factions
    const orderedTeams = useMemo(
        () =>
            [...(matchTeams ?? [])].sort((left, right) =>
                left.slot.localeCompare(right.slot)
            ),
        [matchTeams]
    )
    function teamFor(id: string, label: string, index: number, ours: boolean) {
        const faction = resultFaction(id) ?? resultFaction(label)
        const team =
            (faction &&
                orderedTeams.find(
                    (assignment) => resultFaction(assignment.side) === faction
                )) ||
            orderedTeams.find(
                (assignment) =>
                    assignment.snapshot.name.trim().toLowerCase() ===
                    label.trim().toLowerCase()
            ) ||
            orderedTeams[index] ||
            undefined
        const name =
            team?.snapshot.name ??
            (ours && clanName
                ? clanName
                : !ours && opponentName && faction
                  ? opponentName
                  : label)
        const short =
            team?.snapshot.shortCode ??
            (faction ? name : label).slice(0, 3).toUpperCase()
        return {
            name,
            short,
            logoUrl: team?.snapshot.logoUrl ?? null,
            side: faction ? factionLabels[faction] : null,
        }
    }
    function updateScore(index: number, value: string) {
        setScores(
            scores.map((s, i) => (i === index ? { ...s, score: value } : s))
        )
        setDirty(true)
    }
    function updateLabel(index: number, value: string) {
        setScores(
            scores.map((s, i) => (i === index ? { ...s, label: value } : s))
        )
        setDirty(true)
    }
    const twoSides = scores.length === 2
    const left = twoSides ? sides.ordered[0]! : null
    const right = twoSides ? sides.ordered[1]! : null

    // Plain render helpers, not components: a component declared here would
    // remount on every keystroke and lose the input focus.
    function scoreBox(side: { id: string; label: string; index: number }) {
        const team = teamFor(
            side.id,
            side.label,
            side.index,
            side.index === left?.index && sides.oursIndex === 0
        )
        return (
            <label className="flex flex-col items-center gap-1">
                <span className="text-muted-foreground text-[11px] font-medium uppercase">
                    {team.short}
                </span>
                <Input
                    aria-label={m.scoreLabel.replace("{name}", team.name)}
                    type="number"
                    step="any"
                    inputMode="numeric"
                    value={scores[side.index]?.score ?? ""}
                    disabled={!editable}
                    placeholder="—"
                    className="bg-background h-14 w-16 rounded-xl text-center text-3xl font-semibold tabular-nums sm:w-20 md:text-3xl"
                    onChange={(e) => updateScore(side.index, e.target.value)}
                />
            </label>
        )
    }

    function teamBlock(
        side: { id: string; label: string; index: number },
        align: "left" | "right"
    ) {
        const ours = sides.oursIndex === 0 && side.index === left?.index
        const team = teamFor(side.id, side.label, side.index, ours)
        const logo = (
            <Avatar aria-hidden="true" className="size-11 rounded-xl">
                {team.logoUrl ? (
                    <AvatarImage src={team.logoUrl} alt="" />
                ) : null}
                <AvatarFallback
                    className={cn(
                        "rounded-xl text-xs font-bold",
                        ours
                            ? "bg-foreground text-background"
                            : "bg-muted-foreground/15 text-foreground/80"
                    )}
                >
                    {team.short}
                </AvatarFallback>
            </Avatar>
        )
        return (
            <div
                className={cn(
                    "flex min-w-0 items-center gap-2.5",
                    align === "right" && "flex-row-reverse text-right"
                )}
            >
                {logo}
                <span className="flex min-w-0 flex-col">
                    <span className="truncate font-semibold">{team.name}</span>
                    {team.side ? (
                        <span className="text-muted-foreground truncate text-xs">
                            {team.side}
                        </span>
                    ) : null}
                </span>
            </div>
        )
    }

    const correctionTargets: string[] = []
    if (resultsChannelName) correctionTargets.push(m.correctionTargets.discord)
    if (competitionLinked)
        correctionTargets.push(m.correctionTargets.competition)
    const correctionNote = correctionTargets.length
        ? m.correctionNoteUpdates.replace(
              "{targets}",
              correctionTargets.join(m.correctionTargets.and)
          )
        : m.correctionNote
    const effects: Array<{ icon: typeof MessageSquareText; text: string }> = [
        resultsChannelName
            ? {
                  icon: MessageSquareText,
                  text: m.effectResultsChannel.replace(
                      "{channel}",
                      resultsChannelName
                  ),
              }
            : resultsChannelName === null
              ? { icon: MessageSquareText, text: m.effectNoResultsChannel }
              : null,
        { icon: Send, text: m.effectRecaps },
        competitionLinked ? { icon: Trophy, text: m.effectCompetition } : null,
    ].filter(
        (effect): effect is { icon: typeof MessageSquareText; text: string } =>
            effect !== null
    )

    return (
        <section
            className="@container"
            aria-labelledby={heading}
            aria-busy={loading}
        >
            <div className="grid gap-4 @3xl:grid-cols-[minmax(0,1fr)_17.5rem] @5xl:grid-cols-[minmax(0,1fr)_18.5rem]">
                <div className="border-border/70 bg-card space-y-5 rounded-2xl border p-5 sm:p-6">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <h2 id={heading} className="text-lg font-semibold">
                            {m.title}
                        </h2>
                        <span
                            role="status"
                            className={cn(
                                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs",
                                reviewed
                                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                    : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                            )}
                        >
                            {loading ? (
                                <Loader2 className="size-3.5 animate-spin" />
                            ) : reviewed ? (
                                <CheckCircle2 className="size-3.5" />
                            ) : (
                                <Clock3 className="size-3.5" />
                            )}
                            {m.status[status]}
                        </span>
                    </div>
                    {error ? (
                        <div
                            className="text-destructive flex flex-wrap items-center gap-2 text-sm"
                            role="alert"
                        >
                            {t.error}
                            <Button
                                variant="outline"
                                size="sm"
                                className="rounded-lg"
                                onClick={reload}
                            >
                                {t.refresh}
                            </Button>
                        </div>
                    ) : null}
                    {data ? (
                        <>
                            {left && right ? (
                                <div className="bg-muted/50 flex flex-col items-center gap-3 rounded-2xl px-4 py-6">
                                    {/* Phones stack team, scores, team (E2 phone). */}
                                    <div className="flex w-full flex-col items-center gap-3 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:gap-6">
                                        <div className="flex min-w-0 justify-end">
                                            {teamBlock(left, "left")}
                                        </div>
                                        <div className="flex items-end gap-2">
                                            {scoreBox(left)}
                                            <span
                                                aria-hidden="true"
                                                className="text-muted-foreground pb-3 text-2xl font-semibold"
                                            >
                                                :
                                            </span>
                                            {scoreBox(right)}
                                        </div>
                                        <div className="flex min-w-0 justify-start">
                                            {teamBlock(right, "right")}
                                        </div>
                                    </div>
                                    {sides.outcome ? (
                                        <span
                                            className={cn(
                                                "rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                                                sides.outcome === "win"
                                                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                                    : sides.outcome === "loss"
                                                      ? "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300"
                                                      : "border-border bg-background text-foreground"
                                            )}
                                        >
                                            {m.outcome[sides.outcome]}
                                        </span>
                                    ) : null}
                                </div>
                            ) : (
                                <div className="bg-muted/50 flex flex-wrap items-end gap-3 rounded-2xl p-4">
                                    {scores.map((row, index) => {
                                        const team = teamFor(
                                            row.id,
                                            row.label,
                                            index,
                                            sides.oursIndex === index
                                        )
                                        return (
                                            <div
                                                key={row.id}
                                                className="flex min-w-36 items-end gap-1"
                                            >
                                                <Avatar
                                                    aria-hidden="true"
                                                    className="mb-0.5 size-8 shrink-0 rounded-lg"
                                                >
                                                    {team.logoUrl ? (
                                                        <AvatarImage
                                                            src={team.logoUrl}
                                                            alt=""
                                                        />
                                                    ) : null}
                                                    <AvatarFallback className="rounded-lg text-[10px] font-bold">
                                                        {team.short}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <label className="flex flex-col gap-1">
                                                    <Input
                                                        aria-label={m.nameLabel.replace(
                                                            "{index}",
                                                            String(index + 1)
                                                        )}
                                                        value={row.label}
                                                        disabled={!editable}
                                                        className="h-7 w-28 text-xs"
                                                        onChange={(e) =>
                                                            updateLabel(
                                                                index,
                                                                e.target.value
                                                            )
                                                        }
                                                    />
                                                    <Input
                                                        aria-label={m.scoreLabel.replace(
                                                            "{name}",
                                                            row.label
                                                        )}
                                                        type="number"
                                                        step="any"
                                                        value={row.score}
                                                        disabled={!editable}
                                                        placeholder="—"
                                                        className="bg-background h-12 w-28 text-center text-2xl font-semibold tabular-nums"
                                                        onChange={(e) =>
                                                            updateScore(
                                                                index,
                                                                e.target.value
                                                            )
                                                        }
                                                    />
                                                </label>
                                                {scores.length > 2 ? (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        aria-label={`${t.remove} ${index + 1}`}
                                                        disabled={!editable}
                                                        onClick={() => {
                                                            setScores(
                                                                scores.filter(
                                                                    (_, i) =>
                                                                        i !==
                                                                        index
                                                                )
                                                            )
                                                            setDirty(true)
                                                        }}
                                                    >
                                                        −
                                                    </Button>
                                                ) : null}
                                            </div>
                                        )
                                    })}
                                </div>
                            )}

                            <div className="space-y-2">
                                <div className="text-sm font-medium">
                                    {m.source}
                                </div>
                                <div className="border-border/70 flex flex-wrap items-center gap-3 rounded-xl border px-3 py-2.5">
                                    <Server
                                        className="text-muted-foreground size-4 shrink-0"
                                        aria-hidden
                                    />
                                    <span className="flex min-w-0 flex-1 flex-col">
                                        <span className="text-sm break-words">
                                            {sourceTitle()}
                                        </span>
                                        {sourceDetail() ? (
                                            <span className="text-muted-foreground text-xs">
                                                {sourceDetail()}
                                            </span>
                                        ) : null}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="rounded-lg"
                                        aria-expanded={choosingSource}
                                        disabled={!editable}
                                        onClick={() =>
                                            setChoosingSource(!choosingSource)
                                        }
                                    >
                                        {m.otherGame}
                                    </Button>
                                </div>
                                {choosingSource ? (
                                    <select
                                        aria-label={t.source}
                                        className="bg-background w-full rounded-md border p-2 text-sm"
                                        value={source}
                                        disabled={!editable}
                                        onChange={(e) => {
                                            const value = e.target.value
                                            setSource(value)
                                            setSuggested(false)
                                            setDirty(true)
                                            const selected = data.sessions.find(
                                                (s) => s.id === value
                                            )
                                            if (selected?.participants.length)
                                                setScores(
                                                    toInputs(
                                                        selected.participants
                                                    )
                                                )
                                        }}
                                    >
                                        <option value="">
                                            {m.sourceManual}
                                        </option>
                                        {current?.sessionLinks.length ? (
                                            <option value="keep">
                                                {m.sourceKeep.replace(
                                                    "{count}",
                                                    String(
                                                        current.sessionLinks
                                                            .length
                                                    )
                                                )}
                                            </option>
                                        ) : null}
                                        {data.sessions.map((s) => (
                                            <option key={s.id} value={s.id}>
                                                {m.sourceSession
                                                    .replace(
                                                        "{map}",
                                                        s.map ?? m.unknownMap
                                                    )
                                                    .replace(
                                                        "{time}",
                                                        formatTime(s.startedAt)
                                                    )}{" "}
                                                ·{" "}
                                                {s.complete
                                                    ? m.complete
                                                    : m.incomplete}
                                            </option>
                                        ))}
                                    </select>
                                ) : null}
                                {current ? (
                                    <p className="text-muted-foreground text-sm">
                                        {m.attribution
                                            .replace(
                                                "{linked}",
                                                String(linkedPlayers ?? 0)
                                            )
                                            .replace(
                                                "{unlinked}",
                                                String(unlinkedPlayers ?? 0)
                                            )}
                                        {playersHref ? (
                                            <>
                                                {" "}
                                                <Link
                                                    href={playersHref}
                                                    className="text-foreground underline underline-offset-2"
                                                >
                                                    {m.showPlayers}
                                                </Link>
                                            </>
                                        ) : null}
                                    </p>
                                ) : null}
                            </div>

                            {!reviewed && effects.length > 0 ? (
                                <div className="bg-muted/50 space-y-2 rounded-xl px-4 py-3">
                                    <div className="text-sm font-semibold">
                                        {m.afterConfirm}
                                    </div>
                                    <ul className="space-y-1.5 text-sm">
                                        {effects.map((effect) => (
                                            <li
                                                key={effect.text}
                                                className="flex items-start gap-2"
                                            >
                                                <effect.icon
                                                    aria-hidden="true"
                                                    className="text-muted-foreground mt-0.5 size-4 shrink-0"
                                                />
                                                {effect.text}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ) : null}

                            {reviewed ? (
                                <label className="block space-y-1 text-sm">
                                    <span>{m.reason}</span>
                                    <Input
                                        aria-label={m.reason}
                                        value={reason}
                                        maxLength={500}
                                        disabled={!editable}
                                        onChange={(e) =>
                                            setReason(e.target.value)
                                        }
                                    />
                                    {!reason.trim() ? (
                                        <span className="text-muted-foreground text-xs">
                                            {m.reasonRequired}
                                        </span>
                                    ) : null}
                                </label>
                            ) : null}

                            <div className="border-border/70 flex flex-wrap justify-end gap-2 border-t pt-4">
                                {reviewed ? (
                                    <Button
                                        className="rounded-xl"
                                        disabled={!editable || !reason.trim()}
                                        onClick={() => run("correct")}
                                    >
                                        {m.correct}
                                    </Button>
                                ) : (
                                    <>
                                        {data.hasLegacyImport ? (
                                            <Button
                                                variant="ghost"
                                                className="rounded-xl"
                                                disabled={!editable}
                                                onClick={stageLegacyImport}
                                            >
                                                {t.useImport}
                                            </Button>
                                        ) : null}
                                        <Button
                                            variant="outline"
                                            className="rounded-xl"
                                            disabled={!editable}
                                            onClick={() => run("stage")}
                                        >
                                            {m.saveWithoutConfirm}
                                        </Button>
                                        <Button
                                            className="rounded-xl"
                                            disabled={!editable}
                                            onClick={() => run("confirm")}
                                        >
                                            <Check className="size-4" />
                                            {m.confirm.replace(
                                                "{score}",
                                                confirmScore
                                            )}
                                        </Button>
                                    </>
                                )}
                            </div>
                            {dirty && !reviewed ? (
                                <p className="text-muted-foreground text-xs">
                                    {t.unsaved}
                                </p>
                            ) : null}
                        </>
                    ) : null}
                </div>

                <aside
                    aria-labelledby={`${heading}-history`}
                    className="border-border/70 bg-card h-fit space-y-4 rounded-2xl border p-5"
                >
                    <h2
                        id={`${heading}-history`}
                        className="text-base font-semibold"
                    >
                        {m.history}
                    </h2>
                    {history.length === 0 && !current ? (
                        <p className="text-muted-foreground text-sm">
                            {m.historyEmpty}
                        </p>
                    ) : (
                        <ol className="space-y-3">
                            {history.map((revision) => (
                                <li
                                    key={revision.version}
                                    className="flex gap-2.5"
                                >
                                    <span
                                        aria-hidden="true"
                                        className={cn(
                                            "mt-1.5 size-2 shrink-0 rounded-full",
                                            revision.status === "provisional"
                                                ? "bg-amber-500"
                                                : "bg-emerald-500"
                                        )}
                                    />
                                    <span className="flex min-w-0 flex-col text-sm">
                                        <span>{revisionTitle(revision)}</span>
                                        <span className="text-muted-foreground text-xs">
                                            {m.historyAt
                                                .replace(
                                                    "{date}",
                                                    formatTime(
                                                        revision.createdAt
                                                    )
                                                )
                                                .replace(
                                                    "{who}",
                                                    revisionWho(revision)
                                                )}
                                        </span>
                                        {revision.reason ? (
                                            <span className="text-muted-foreground text-xs break-words">
                                                {t.reason}: {revision.reason}
                                            </span>
                                        ) : null}
                                    </span>
                                </li>
                            ))}
                            {current?.status === "provisional" ? (
                                <li className="flex gap-2.5">
                                    <span
                                        aria-hidden="true"
                                        className="border-muted-foreground/50 mt-1.5 size-2 shrink-0 rounded-full border"
                                    />
                                    <span className="flex flex-col text-sm">
                                        <span>{m.historyNext}</span>
                                        <span className="text-muted-foreground text-xs">
                                            {m.historyNextDetail}
                                        </span>
                                    </span>
                                </li>
                            ) : null}
                        </ol>
                    )}
                    <p className="text-muted-foreground border-border/70 border-t pt-3 text-sm">
                        {correctionNote}
                    </p>
                </aside>
            </div>
        </section>
    )
}
