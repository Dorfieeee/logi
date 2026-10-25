"use client"

import { isApprovedRegistration } from "@/domain/competitions/enrollment"

import {
    defaultFixturePhase,
    fixtureRowState,
    groupFixturesByRound,
    rankLinkCandidates,
    suggestedRound,
    type FixtureRowState,
} from "@/domain/competitions/fixture-rounds"
import {
    FIXTURE_PHASES,
    FIXTURE_ROUND_MAX,
    FIXTURE_SCORE_MAX,
    FIXTURE_STATUSES,
    type FixturePhase,
    type FixtureStatus,
} from "@/domain/competitions/competition"
import {
    CompetitionRequestError,
    fetchFixtureEventCandidates,
    type CompetitionErrorCode,
} from "@/lib/competitions/competition-client"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    fixtureFormInput,
    fixtureFormValues,
    type FixtureFormValues,
} from "@/lib/competitions/competition-form"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    candidateWhen,
    fixtureTitle,
    fixtureWhen,
    roundDays,
} from "@/lib/competitions/fixture-format"
import type {
    CompetitionFixtureView,
    FixtureEventCandidate,
} from "@/domain/competitions/admin-view"
import {
    CalendarPlus,
    Link2,
    Loader2,
    Pencil,
    Plus,
    Search,
} from "lucide-react"
import type { CompetitionSectionProps } from "@/components/app/competition-manager"
import { ConfirmActionDialog } from "@/components/app/confirm-action-dialog"
import { adminAccent, adminTone } from "@/components/app/admin-page-header"
import { useEffect, useId, useRef, useState, type FormEvent } from "react"
import { EmptyState } from "@/components/app/empty-state"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const ALL = "__all"

type DialogState =
    | { kind: "closed" }
    | { kind: "fixture"; fixture: CompetitionFixtureView | null }

/**
 * Fixtures of one division and phase grouped by round (design I3); each row
 * shows the state of its link to a clan match, and "link to a match" opens
 * the side panel with the clan matches of both teams.
 */
export function CompetitionFixtures({
    view,
    dictionary,
    run,
    pending,
    locale,
}: CompetitionSectionProps & { locale: string }) {
    const t = dictionary.competitionAdmin
    const [division, setDivision] = useState<string>(
        () => view.divisions[0]?.id ?? ALL
    )
    const divisionId = division === ALL ? null : division
    const [phase, setPhase] = useState<FixturePhase>(() =>
        defaultFixturePhase(view.fixtures, view.divisions[0]?.id ?? null)
    )
    const [dialog, setDialog] = useState<DialogState>({ kind: "closed" })
    const [linkingId, setLinkingId] = useState<string | null>(null)
    const panelRef = useRef<HTMLElement>(null)
    const groups = groupFixturesByRound(view.fixtures, { divisionId, phase })
    const linking =
        view.fixtures.find((fixture) => fixture.id === linkingId) ?? null

    function openLink(fixture: CompetitionFixtureView) {
        setLinkingId(fixture.id)
        if (window.matchMedia("(max-width: 1023px)").matches)
            requestAnimationFrame(() =>
                panelRef.current?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                })
            )
    }

    return (
        <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-2">
                    <Select
                        value={division}
                        onValueChange={(value) => {
                            setDivision(value)
                            setLinkingId(null)
                        }}
                    >
                        <SelectTrigger
                            aria-label={t.division}
                            className="h-[34px] min-w-28 text-[13px]"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {view.divisions.map((item) => (
                                <SelectItem key={item.id} value={item.id}>
                                    {item.name}
                                </SelectItem>
                            ))}
                            <SelectItem value={ALL}>
                                {t.allDivisions}
                            </SelectItem>
                        </SelectContent>
                    </Select>
                    <div
                        role="radiogroup"
                        aria-label={t.phase}
                        className="bg-muted flex gap-0.5 rounded-[10px] p-[3px]"
                    >
                        {FIXTURE_PHASES.map((value) => (
                            <button
                                key={value}
                                type="button"
                                role="radio"
                                aria-checked={phase === value}
                                onClick={() => {
                                    setPhase(value)
                                    setLinkingId(null)
                                }}
                                className="text-muted-foreground aria-checked:bg-background aria-checked:text-foreground focus-visible:ring-ring h-7 rounded-[7px] px-3 text-[13px] font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none aria-checked:font-semibold aria-checked:shadow-sm"
                            >
                                {t.phases[value]}
                            </button>
                        ))}
                    </div>
                </div>
                <Button
                    size="sm"
                    className="h-[34px]"
                    disabled={
                        pending ||
                        view.registrations.filter(isApprovedRegistration)
                            .length < 2
                    }
                    onClick={() =>
                        setDialog({ kind: "fixture", fixture: null })
                    }
                >
                    <Plus className="size-3.5" aria-hidden />
                    {t.addFixture}
                </Button>
            </div>
            <div className="flex flex-wrap items-start gap-5">
                <div className="flex min-w-0 flex-[999_1_28rem] flex-col gap-4">
                    {groups.length === 0 ? (
                        <EmptyState
                            icon={CalendarPlus}
                            title={
                                view.fixtures.length === 0
                                    ? t.noFixtures
                                    : t.noFixturesInView
                            }
                            description={t.fixturesDescription}
                        />
                    ) : (
                        groups.map((group) => {
                            const days = roundDays(group.from, group.to, locale)
                            const heading = [
                                group.round === null
                                    ? t.noRound
                                    : t.roundHeading.replace(
                                          "{round}",
                                          String(group.round)
                                      ),
                                days,
                            ]
                                .filter(Boolean)
                                .join(" · ")
                            const headingId = `round-${group.round ?? "none"}`
                            return (
                                <section
                                    key={headingId}
                                    aria-labelledby={headingId}
                                    className="flex flex-col gap-2"
                                >
                                    <h2
                                        id={headingId}
                                        className="text-muted-foreground text-xs font-semibold tracking-wider uppercase"
                                        suppressHydrationWarning
                                    >
                                        {heading}
                                    </h2>
                                    <ul className="bg-card divide-y overflow-hidden rounded-xl border">
                                        {group.fixtures.map((fixture) => (
                                            <FixtureRow
                                                key={fixture.id}
                                                fixture={fixture}
                                                dictionary={dictionary}
                                                locale={locale}
                                                pending={pending}
                                                linking={
                                                    linkingId === fixture.id
                                                }
                                                onLink={() => openLink(fixture)}
                                                onEdit={() =>
                                                    setDialog({
                                                        kind: "fixture",
                                                        fixture,
                                                    })
                                                }
                                            />
                                        ))}
                                    </ul>
                                </section>
                            )
                        })
                    )}
                </div>
                {linking ? (
                    <LinkPanel
                        key={linking.id}
                        panelRef={panelRef}
                        dictionary={dictionary}
                        run={run}
                        pending={pending}
                        fixture={linking}
                        locale={locale}
                        onDone={() => setLinkingId(null)}
                    />
                ) : null}
            </div>
            <Dialog
                open={dialog.kind !== "closed"}
                onOpenChange={(open) => {
                    if (!open) setDialog({ kind: "closed" })
                }}
            >
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
                    {dialog.kind === "fixture" ? (
                        <FixtureForm
                            view={view}
                            dictionary={dictionary}
                            run={run}
                            pending={pending}
                            fixture={dialog.fixture}
                            defaultDivisionId={
                                divisionId ?? view.divisions[0]?.id ?? ""
                            }
                            defaultPhase={phase}
                            defaultRound={suggestedRound(groups)}
                            onDone={() => setDialog({ kind: "closed" })}
                        />
                    ) : null}
                </DialogContent>
            </Dialog>
        </div>
    )
}

const PILL =
    "inline-flex h-[26px] shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium"

/** One fixture: teams (with the score once played), when, its link state and edit. */
function FixtureRow({
    fixture,
    dictionary,
    locale,
    pending,
    linking,
    onLink,
    onEdit,
}: {
    fixture: CompetitionFixtureView
    dictionary: CompetitionSectionProps["dictionary"]
    locale: string
    pending: boolean
    linking: boolean
    onLink(): void
    onEdit(): void
}) {
    const t = dictionary.competitionAdmin
    const state: FixtureRowState = fixtureRowState(fixture)
    const title = fixtureTitle(fixture)
    const label = `${title.a} vs ${title.b}`
    const legacy = fixture.sideA.legacy || fixture.sideB.legacy
    const when = fixtureWhen(
        fixture.scheduledAt,
        state !== "linked" && state !== "unlinked",
        locale
    )
    return (
        <li
            className={cn(
                "flex flex-wrap items-center gap-x-3.5 gap-y-2.5 px-4 py-3",
                linking && adminAccent.surface
            )}
        >
            <span className="min-w-0 basis-full text-sm font-semibold sm:flex-[1_1_12.5rem]">
                {title.score ? (
                    <>
                        {title.a}{" "}
                        <span className="tabular-nums">{title.score}</span>{" "}
                        {title.b}
                    </>
                ) : (
                    label
                )}
            </span>
            {when ? (
                <span
                    className="text-foreground/80 text-[13px]"
                    suppressHydrationWarning
                >
                    {when}
                </span>
            ) : null}
            {legacy ? (
                <span className={cn(PILL, adminTone.warning)}>
                    {t.legacyBadge}
                </span>
            ) : fixture.resultConflict ? (
                <span className={cn(PILL, adminTone.warning)}>
                    {t.resultConflict}
                </span>
            ) : state === "unlinked" ? (
                <button
                    type="button"
                    aria-expanded={linking}
                    disabled={pending}
                    onClick={onLink}
                    className={cn(
                        PILL,
                        "bg-background h-7 hover:opacity-90",
                        adminAccent.border,
                        adminAccent.text
                    )}
                >
                    <Link2 className="size-3" aria-hidden />
                    {t.linkWithMatch}
                </button>
            ) : state === "linked" ? (
                <button
                    type="button"
                    aria-expanded={linking}
                    disabled={pending}
                    onClick={onLink}
                    className={cn(PILL, adminTone.success, "hover:opacity-90")}
                >
                    <Link2 className="size-3" aria-hidden />
                    {fixture.event?.workspace
                        ? t.clanMatch.replace("{clan}", fixture.event.workspace)
                        : t.clanMatchUnknown}
                </button>
            ) : state === "awaiting_confirmation" ? (
                <span className={cn(PILL, adminTone.warning)}>
                    {t.awaitingConfirmation}
                </span>
            ) : (
                <span className={cn(PILL, adminTone.neutral)}>
                    {state === "forfeit" ? t.statuses.forfeit : t.played}
                </span>
            )}
            <Button
                type="button"
                size="icon"
                variant="ghost"
                className="text-foreground/70 size-[30px]"
                aria-label={t.editFixtureNamed.replace("{teams}", label)}
                disabled={pending}
                onClick={onEdit}
            >
                <Pencil className="size-[15px]" aria-hidden />
            </Button>
        </li>
    )
}

function FixtureForm({
    view,
    dictionary,
    run,
    pending,
    fixture,
    defaultDivisionId,
    defaultPhase,
    defaultRound,
    onDone,
}: CompetitionSectionProps & {
    fixture: CompetitionFixtureView | null
    defaultDivisionId: string
    defaultPhase: FixturePhase
    defaultRound: number
    onDone(): void
}) {
    const t = dictionary.competitionAdmin
    const id = useId()
    const [values, setValues] = useState<FixtureFormValues>(() =>
        fixtureFormValues(fixture, defaultDivisionId, {
            phase: defaultPhase,
            round: defaultRound,
        })
    )
    const [failure, setFailure] = useState<string | null>(null)
    const set = <K extends keyof FixtureFormValues>(
        key: K,
        value: FixtureFormValues[K]
    ) => setValues((current) => ({ ...current, [key]: value }))
    // League fixtures are played inside one division; playoffs may cross divisions.
    const teams = view.registrations
        .filter(
            (row) =>
                isApprovedRegistration(row) &&
                !row.team.legacy &&
                (values.phase !== "league" ||
                    row.divisionId === values.divisionId)
        )
        .sort((a, b) => a.team.name.localeCompare(b.team.name))
    const scored = values.status !== "scheduled"

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const input = fixtureFormInput(values)
        if (!input) {
            setFailure(t.invalidFixture)
            return
        }
        setFailure(null)
        const result = await run(
            fixture
                ? { action: "updateFixture", fixtureId: fixture.id, input }
                : {
                      action: "createFixture",
                      competitionId: view.competition.id,
                      input,
                  },
            t.saved
        )
        if (result.ok) onDone()
    }

    const teamSelect = (
        key: "sideATeamId" | "sideBTeamId" | "sideCTeamId",
        label: string
    ) => (
        <div className="space-y-2">
            <Label htmlFor={`${id}-${key}`}>{label}</Label>
            <Select
                value={values[key] || undefined}
                onValueChange={(value) => set(key, value)}
                disabled={pending}
            >
                <SelectTrigger id={`${id}-${key}`} className="w-full">
                    <SelectValue placeholder={t.chooseTeam} />
                </SelectTrigger>
                <SelectContent>
                    {teams.map((row) => (
                        <SelectItem key={row.team.id} value={row.team.id}>
                            {row.team.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    )

    return (
        <form onSubmit={submit} className="space-y-5" noValidate>
            <DialogHeader>
                <DialogTitle>
                    {fixture ? t.editFixture : t.addFixture}
                </DialogTitle>
                <DialogDescription>{t.fixtureHelp}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor={`${id}-division`}>{t.division}</Label>
                    <Select
                        value={values.divisionId || undefined}
                        onValueChange={(value) => set("divisionId", value)}
                        disabled={pending}
                    >
                        <SelectTrigger id={`${id}-division`} className="w-full">
                            <SelectValue placeholder={t.division} />
                        </SelectTrigger>
                        <SelectContent>
                            {view.divisions.map((division) => (
                                <SelectItem
                                    key={division.id}
                                    value={division.id}
                                >
                                    {division.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label htmlFor={`${id}-phase`}>{t.phase}</Label>
                    <Select
                        value={values.phase}
                        onValueChange={(value) =>
                            set("phase", value as FixturePhase)
                        }
                        disabled={pending}
                    >
                        <SelectTrigger id={`${id}-phase`} className="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {FIXTURE_PHASES.map((phase) => (
                                <SelectItem key={phase} value={phase}>
                                    {t.phases[phase]}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                {teamSelect("sideATeamId", t.teamA)}
                {teamSelect("sideBTeamId", t.teamB)}
                {view.competition.gameId === "wardogs"
                    ? teamSelect("sideCTeamId", t.teamC)
                    : null}
                <div className="space-y-2">
                    <Label htmlFor={`${id}-round`}>{t.round}</Label>
                    <Input
                        id={`${id}-round`}
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={FIXTURE_ROUND_MAX}
                        step={1}
                        value={values.round}
                        disabled={pending}
                        aria-describedby={`${id}-round-help`}
                        onChange={(event) => set("round", event.target.value)}
                    />
                    <p
                        id={`${id}-round-help`}
                        className="text-muted-foreground text-xs"
                    >
                        {t.roundHelp}
                    </p>
                </div>
                <div className="space-y-2">
                    <Label htmlFor={`${id}-scheduled`}>{t.scheduledAt}</Label>
                    <Input
                        id={`${id}-scheduled`}
                        type="datetime-local"
                        value={values.scheduledAt}
                        disabled={pending}
                        onChange={(event) =>
                            set("scheduledAt", event.target.value)
                        }
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor={`${id}-status`}>{t.status}</Label>
                    <Select
                        value={values.status}
                        onValueChange={(value) =>
                            set("status", value as FixtureStatus)
                        }
                        disabled={pending}
                    >
                        <SelectTrigger id={`${id}-status`} className="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {FIXTURE_STATUSES.map((status) => (
                                <SelectItem key={status} value={status}>
                                    {t.statuses[status]}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid grid-cols-2 gap-4 sm:col-span-2">
                    {(values.sideCTeamId
                        ? (["scoreA", "scoreB", "scoreC"] as const)
                        : (["scoreA", "scoreB"] as const)
                    ).map((key) => (
                        <div key={key} className="space-y-2">
                            <Label htmlFor={`${id}-${key}`}>{t[key]}</Label>
                            <Input
                                id={`${id}-${key}`}
                                type="number"
                                inputMode="numeric"
                                min={0}
                                max={FIXTURE_SCORE_MAX}
                                step={1}
                                value={scored ? values[key] : ""}
                                disabled={pending || !scored}
                                required={scored}
                                onChange={(event) =>
                                    set(key, event.target.value)
                                }
                            />
                        </div>
                    ))}
                </div>
            </div>
            {failure ? (
                <p role="alert" className="text-destructive text-sm">
                    {failure}
                </p>
            ) : null}
            <DialogFooter className="gap-2 sm:justify-between">
                {fixture ? (
                    <ConfirmActionDialog
                        trigger={
                            <Button
                                type="button"
                                variant="outline"
                                className="text-destructive hover:text-destructive"
                                disabled={pending}
                            >
                                {t.deleteFixture}
                            </Button>
                        }
                        title={t.confirmDeleteFixture}
                        description={t.confirmDeleteFixtureDescription.replace(
                            "{teams}",
                            `${fixture.sideA.name} – ${fixture.sideB.name}`
                        )}
                        confirmLabel={t.delete}
                        cancelLabel={t.cancel}
                        onConfirm={async () => {
                            const result = await run({
                                action: "deleteFixture",
                                fixtureId: fixture.id,
                            })
                            if (result.ok) onDone()
                            return result.ok
                        }}
                    />
                ) : (
                    <span aria-hidden />
                )}
                <div className="flex flex-col-reverse gap-2 sm:flex-row">
                    <Button
                        type="button"
                        variant="outline"
                        disabled={pending}
                        onClick={onDone}
                    >
                        {t.cancel}
                    </Button>
                    <Button type="submit" disabled={pending}>
                        {pending ? t.saving : t.save}
                    </Button>
                </div>
            </DialogFooter>
        </form>
    )
}

type CandidateState =
    | { status: "loading" }
    | { status: "ready"; events: FixtureEventCandidate[] }
    | { status: "error"; code: CompetitionErrorCode }

/**
 * Side panel that links a fixture to a clan's match (design I3 "Propojit"):
 * the clan matches of both teams around the fixture's date, searchable by
 * name; an event ID can still be entered by hand.
 */
function LinkPanel({
    panelRef,
    dictionary,
    run,
    pending,
    fixture,
    locale,
    onDone,
}: Omit<CompetitionSectionProps, "view"> & {
    panelRef: React.RefObject<HTMLElement | null>
    fixture: CompetitionFixtureView
    locale: string
    onDone(): void
}) {
    const t = dictionary.competitionAdmin
    const id = useId()
    const [state, setState] = useState<CandidateState>({ status: "loading" })
    const [search, setSearch] = useState("")
    const [eventId, setEventId] = useState(fixture.event?.id ?? "")
    const [manual, setManual] = useState(false)
    const title = fixtureTitle(fixture)
    const teams = `${title.a} vs ${title.b}`

    useEffect(() => {
        const controller = new AbortController()
        fetchFixtureEventCandidates(fixture.id, controller.signal)
            .then((events) => {
                if (!controller.signal.aborted)
                    setState({ status: "ready", events })
            })
            .catch((error: unknown) => {
                if (!controller.signal.aborted)
                    setState({
                        status: "error",
                        code:
                            error instanceof CompetitionRequestError
                                ? error.code
                                : "unavailable",
                    })
            })
        return () => controller.abort()
    }, [fixture.id])

    async function link(next: string | null) {
        const result = await run(
            {
                action: "linkEvent",
                fixtureId: fixture.id,
                input: { eventId: next },
            },
            t.saved
        )
        if (result.ok) onDone()
    }

    const shown =
        state.status === "ready"
            ? rankLinkCandidates(state.events, {
                  scheduledAt: fixture.scheduledAt,
                  search,
              })
            : []

    return (
        <aside
            ref={panelRef}
            aria-labelledby={`${id}-title`}
            className={cn(
                "bg-card flex min-w-0 flex-[1_1_18.75rem] scroll-mt-4 flex-col gap-3 rounded-2xl border px-5 py-[18px] lg:max-w-[23.75rem]",
                adminAccent.border
            )}
        >
            <h2 id={`${id}-title`} className="text-[15px] font-semibold">
                {t.linkPanelTitle.replace("{teams}", teams)}
            </h2>
            <p className="text-foreground/80 text-[13px] leading-[19px]">
                {t.linkPanelDescription}
            </p>
            {fixture.event ? (
                <p className="text-muted-foreground text-[13px]">
                    {t.linked.replace("{name}", fixture.event.name)}
                </p>
            ) : null}
            <form
                className="flex flex-col gap-3"
                noValidate
                onSubmit={(event) => {
                    event.preventDefault()
                    if (eventId.trim()) void link(eventId.trim())
                }}
            >
                <label className="border-input text-muted-foreground focus-within:ring-ring flex h-[34px] items-center gap-2 rounded-lg border px-2.5 focus-within:ring-2">
                    <Search className="size-3.5 shrink-0" aria-hidden />
                    <input
                        type="search"
                        value={search}
                        maxLength={64}
                        placeholder={t.searchMatches}
                        aria-label={t.searchMatches}
                        className="text-foreground placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-[13px] outline-none"
                        onChange={(event) => setSearch(event.target.value)}
                    />
                </label>
                {state.status === "loading" ? (
                    <p
                        role="status"
                        className="text-muted-foreground flex items-center gap-2 text-sm"
                    >
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                        {t.loadingCandidates}
                    </p>
                ) : state.status === "error" ? (
                    <p role="alert" className="text-destructive text-sm">
                        {t.errors[state.code]}
                    </p>
                ) : shown.length ? (
                    <div
                        role="radiogroup"
                        aria-label={t.candidates}
                        className="flex max-h-80 flex-col gap-1.5 overflow-y-auto"
                    >
                        {shown.map((event) => {
                            const checked = eventId === event.id
                            return (
                                <button
                                    key={event.id}
                                    type="button"
                                    role="radio"
                                    aria-checked={checked}
                                    onClick={() => setEventId(event.id)}
                                    className={cn(
                                        "hover:bg-muted/50 focus-visible:ring-ring flex flex-col gap-0.5 rounded-[10px] border px-3 py-2.5 text-left focus-visible:ring-2 focus-visible:outline-none",
                                        checked && [
                                            adminAccent.surface,
                                            adminAccent.border,
                                        ]
                                    )}
                                >
                                    <span className="text-sm font-semibold">
                                        {event.name}
                                    </span>
                                    <span
                                        className={cn(
                                            "text-xs",
                                            event.teamsMatch
                                                ? "text-foreground/80"
                                                : adminTone.warningText
                                        )}
                                        suppressHydrationWarning
                                    >
                                        {[
                                            t.candidateClan.replace(
                                                "{clan}",
                                                event.workspace
                                            ),
                                            candidateWhen(
                                                event.gameStart,
                                                locale
                                            ),
                                            event.teamsMatch
                                                ? t.teamsMatch
                                                : t.teamsUnassigned,
                                            event.hasResult
                                                ? t.hasResult
                                                : null,
                                        ]
                                            .filter(Boolean)
                                            .join(" · ")}
                                    </span>
                                </button>
                            )
                        })}
                    </div>
                ) : (
                    <p className="text-muted-foreground text-sm">
                        {state.events.length
                            ? t.noCandidateResults
                            : t.noCandidates}
                    </p>
                )}
                {manual ? (
                    <div className="space-y-2">
                        <Label htmlFor={`${id}-manual`}>{t.eventId}</Label>
                        <Input
                            id={`${id}-manual`}
                            value={eventId}
                            maxLength={64}
                            spellCheck={false}
                            autoComplete="off"
                            disabled={pending}
                            aria-describedby={`${id}-manual-help`}
                            onChange={(event) => setEventId(event.target.value)}
                        />
                        <p
                            id={`${id}-manual-help`}
                            className="text-muted-foreground text-xs"
                        >
                            {t.eventIdHelp}
                        </p>
                    </div>
                ) : (
                    <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground self-start text-xs underline-offset-2 hover:underline"
                        onClick={() => setManual(true)}
                    >
                        {t.manualEventId}
                    </button>
                )}
                <div className="flex flex-wrap justify-end gap-2 pt-1">
                    {fixture.event ? (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mr-auto h-[34px]"
                            disabled={pending}
                            onClick={() => void link(null)}
                        >
                            {t.unlink}
                        </Button>
                    ) : null}
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-[34px]"
                        disabled={pending}
                        onClick={onDone}
                    >
                        {t.cancel}
                    </Button>
                    <Button
                        type="submit"
                        size="sm"
                        className="h-[34px]"
                        disabled={
                            pending ||
                            !eventId.trim() ||
                            eventId.trim() === fixture.event?.id
                        }
                    >
                        {t.link}
                    </Button>
                </div>
            </form>
        </aside>
    )
}
