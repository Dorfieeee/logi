"use client"

import {
    TEAM_SEARCH_MAX,
    TEAM_DIRECTORY_LIMIT,
    normalizeTeamName,
    teamGameSchema,
    type TeamRecord,
} from "@/domain/teams/team"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import type { CompetitionSectionProps } from "@/components/app/competition-manager"
import type { CompetitionRegistrationView } from "@/domain/competitions/admin-view"
import { COMPETITION_REGISTRATION_LIMIT } from "@/domain/competitions/competition"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ConfirmActionDialog } from "@/components/app/confirm-action-dialog"
import { fetchAdminTeamPage } from "@/lib/teams-admin/team-admin-client"
import { ChevronsUpDown, Loader2, Plus, Trash2 } from "lucide-react"
import { TeamLogo } from "@/components/app/team-logo"
import type { Dictionary } from "@/i18n/dictionaries"
import { useEffect, useId, useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

const NO_DIVISION = "__none"

/** Register catalogue teams per division, move, withdraw, reinstate and remove them. */
export function CompetitionRegistrations({
    view,
    dictionary,
    run,
    pending,
}: CompetitionSectionProps) {
    const t = dictionary.competitionAdmin
    const id = useId()
    const [teams, setTeams] = useState<TeamRecord[]>([])
    const [divisionId, setDivisionId] = useState(view.divisions[0]?.id ?? "")
    const registered = new Set(view.registrations.map((row) => row.team.id))
    const division =
        view.divisions.find((row) => row.id === divisionId)?.id ??
        view.divisions[0]?.id ??
        ""
    const groups = [
        ...view.divisions.map((row) => ({ id: row.id, name: row.name })),
        { id: NO_DIVISION, name: t.unassigned },
    ]
        .map((group) => ({
            ...group,
            rows: view.registrations
                .filter((row) => (row.divisionId ?? NO_DIVISION) === group.id)
                .sort((a, b) => a.team.name.localeCompare(b.team.name)),
        }))
        .filter((group) => group.id !== NO_DIVISION || group.rows.length)

    async function register() {
        if (!teams.length || !division) return
        const result = await run({
            action: "registerTeams",
            competitionId: view.competition.id,
            input: {
                teamIds: teams
                    .filter((team) => !registered.has(team.id))
                    .map((team) => team.id),
                divisionId: division,
            },
        })
        if (result.ok) setTeams([])
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t.teamsTitle}</CardTitle>
                <p className="text-muted-foreground text-sm">
                    {t.teamsDescription}
                </p>
            </CardHeader>
            <CardContent className="space-y-6">
                {view.divisions.length ? (
                    <div className="grid gap-3 rounded-xl border p-3 md:grid-cols-[minmax(0,1fr)_14rem_auto] md:items-end">
                        <div className="min-w-0 space-y-2">
                            <Label htmlFor={`${id}-team`}>{t.teamsTitle}</Label>
                            <CatalogueTeamPicker
                                id={`${id}-team`}
                                gameId={view.competition.gameId}
                                dictionary={dictionary}
                                value={teams}
                                registered={registered}
                                disabled={pending}
                                onChange={setTeams}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor={`${id}-division`}>
                                {t.division}
                            </Label>
                            <Select
                                value={division}
                                onValueChange={setDivisionId}
                                disabled={pending}
                            >
                                <SelectTrigger
                                    id={`${id}-division`}
                                    className="w-full"
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {view.divisions.map((row) => (
                                        <SelectItem key={row.id} value={row.id}>
                                            {row.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button
                            disabled={
                                pending ||
                                !teams.some((team) => !registered.has(team.id))
                            }
                            onClick={() => void register()}
                        >
                            <Plus className="size-4" aria-hidden />
                            {t.registerSelected.replace(
                                "{count}",
                                String(
                                    teams.filter(
                                        (team) => !registered.has(team.id)
                                    ).length
                                )
                            )}
                        </Button>
                    </div>
                ) : (
                    <p className="text-muted-foreground text-sm">
                        {t.addDivisionFirst}
                    </p>
                )}
                {groups.map((group) => (
                    <section key={group.id} className="space-y-2">
                        <h3 className="text-sm font-semibold">{group.name}</h3>
                        {group.rows.length ? (
                            <ul className="divide-y rounded-xl border">
                                {group.rows.map((row) => (
                                    <RegistrationRow
                                        key={row.id}
                                        row={row}
                                        divisions={view.divisions}
                                        hasFixtures={view.fixtures.some(
                                            (fixture) =>
                                                fixture.sideA.id ===
                                                    row.team.id ||
                                                fixture.sideB.id === row.team.id
                                        )}
                                        dictionary={dictionary}
                                        run={run}
                                        pending={pending}
                                    />
                                ))}
                            </ul>
                        ) : (
                            <p className="text-muted-foreground text-sm">
                                {t.noTeams}
                            </p>
                        )}
                    </section>
                ))}
            </CardContent>
        </Card>
    )
}

function RegistrationRow({
    row,
    divisions,
    hasFixtures,
    dictionary,
    run,
    pending,
}: {
    row: CompetitionRegistrationView
    divisions: CompetitionSectionProps["view"]["divisions"]
    hasFixtures: boolean
    dictionary: Dictionary
    run: CompetitionSectionProps["run"]
    pending: boolean
}) {
    const t = dictionary.competitionAdmin
    const locked = pending || row.team.legacy
    return (
        <li className="flex flex-wrap items-center gap-3 p-3">
            <TeamLogo
                name={row.team.name}
                shortCode={row.team.shortCode}
                logoUrl={row.team.logoUrl}
                className="size-8"
            />
            <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{row.team.name}</p>
                <div className="flex flex-wrap gap-1">
                    {row.withdrawn ? (
                        <Badge variant="secondary">{t.withdrawnBadge}</Badge>
                    ) : null}
                    {row.team.archived ? (
                        <Badge variant="outline">{t.archivedBadge}</Badge>
                    ) : null}
                    {row.team.legacy ? (
                        <Badge variant="outline">{t.legacyBadge}</Badge>
                    ) : null}
                </div>
            </div>
            {row.status === "pending" || row.status === "rejected" ? (
                <Badge variant="outline">
                    {dictionary.competitionEnrollment[row.status]}
                </Badge>
            ) : null}
            {row.status === "pending" && !row.withdrawn ? (
                <>
                    <Button
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                            void run({
                                action: "updateRegistration",
                                registrationId: row.id,
                                input: { status: "approved" },
                            })
                        }
                    >
                        {dictionary.competitionEnrollment.approve}
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() =>
                            void run({
                                action: "updateRegistration",
                                registrationId: row.id,
                                input: { status: "rejected" },
                            })
                        }
                    >
                        {dictionary.competitionEnrollment.reject}
                    </Button>
                </>
            ) : null}
            <Select
                value={row.divisionId ?? NO_DIVISION}
                disabled={locked}
                onValueChange={(divisionId) => {
                    if (divisionId !== NO_DIVISION)
                        void run({
                            action: "updateRegistration",
                            registrationId: row.id,
                            input: { divisionId },
                        })
                }}
            >
                <SelectTrigger
                    className="w-44"
                    aria-label={`${t.moveTo}: ${row.team.name}`}
                >
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {row.divisionId ? null : (
                        <SelectItem value={NO_DIVISION}>
                            {t.unassigned}
                        </SelectItem>
                    )}
                    {divisions.map((division) => (
                        <SelectItem key={division.id} value={division.id}>
                            {division.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() =>
                    void run({
                        action: "updateRegistration",
                        registrationId: row.id,
                        input: { withdrawn: !row.withdrawn },
                    })
                }
            >
                {row.withdrawn ? t.reinstate : t.withdraw}
            </Button>
            <ConfirmActionDialog
                trigger={
                    <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`${t.remove}: ${row.team.name}`}
                        disabled={pending || hasFixtures}
                        title={
                            hasFixtures
                                ? t.errors.registration_has_fixtures
                                : undefined
                        }
                    >
                        <Trash2 className="size-4" />
                    </Button>
                }
                title={t.confirmRemoveTeam.replace("{name}", row.team.name)}
                description={t.confirmRemoveTeamDescription}
                confirmLabel={t.remove}
                cancelLabel={t.cancel}
                onConfirm={async () =>
                    (
                        await run({
                            action: "removeRegistration",
                            registrationId: row.id,
                        })
                    ).ok
                }
            />
        </li>
    )
}

/** Multi-select catalogue picker. All pages are loaded so bulk selection is not limited to search's first page. */
function CatalogueTeamPicker({
    id,
    gameId,
    dictionary,
    value,
    registered,
    disabled,
    onChange,
}: {
    id: string
    gameId: string
    dictionary: Dictionary
    value: TeamRecord[]
    registered: ReadonlySet<string>
    disabled: boolean
    onChange(teams: TeamRecord[]): void
}) {
    const t = dictionary.competitionAdmin
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState("")
    const [items, setItems] = useState<TeamRecord[]>([])
    const [status, setStatus] = useState<"loading" | "ready" | "error">(
        "loading"
    )
    const [retry, setRetry] = useState(0)
    useEffect(() => {
        if (!open) return
        const controller = new AbortController()
        async function load() {
            setStatus("loading")
            try {
                const game = teamGameSchema.parse(gameId)
                const loaded: TeamRecord[] = []
                let cursor: string | null = null
                do {
                    const page = await fetchAdminTeamPage(
                        { gameId: game, archived: false, cursor, limit: 100 },
                        { signal: controller.signal }
                    )
                    if (controller.signal.aborted) return
                    loaded.push(...page.items)
                    if (loaded.length > TEAM_DIRECTORY_LIMIT)
                        throw new Error("Catalogue exceeds limit")
                    cursor = page.nextCursor
                } while (cursor)
                setItems(loaded)
                setStatus("ready")
            } catch {
                if (!controller.signal.aborted) setStatus("error")
            }
        }
        void load()
        return () => controller.abort()
    }, [open, gameId, retry])
    const selected = value.filter((team) => !registered.has(team.id))
    const selectedIds = new Set(selected.map((team) => team.id))
    const term = normalizeTeamName(query)
    const available = items.filter(
        (team) =>
            !registered.has(team.id) &&
            normalizeTeamName(`${team.name} ${team.shortCode ?? ""}`).includes(
                term
            )
    )
    const capacity = Math.max(
        0,
        COMPETITION_REGISTRATION_LIMIT - registered.size
    )
    function toggle(team: TeamRecord) {
        onChange(
            selectedIds.has(team.id)
                ? selected.filter((item) => item.id !== team.id)
                : [...selected, team]
        )
    }
    return (
        <div className="space-y-2">
            <Popover open={open && !disabled} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        id={id}
                        type="button"
                        variant="outline"
                        aria-expanded={open}
                        disabled={disabled}
                        className="w-full justify-between"
                    >
                        {selected.length
                            ? t.selectedTeams.replace(
                                  "{count}",
                                  String(selected.length)
                              )
                            : t.chooseTeams}
                        <ChevronsUpDown
                            className="size-4 shrink-0 opacity-50"
                            aria-hidden
                        />
                    </Button>
                </PopoverTrigger>
                <PopoverContent
                    className="w-[min(480px,calc(100vw-2rem))] space-y-3"
                    align="start"
                >
                    <Input
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        maxLength={TEAM_SEARCH_MAX}
                        placeholder={t.searchTeams}
                        aria-label={t.searchTeams}
                    />
                    {status === "ready" ? (
                        <>
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={
                                        !available.length ||
                                        selected.length >= capacity
                                    }
                                    onClick={() =>
                                        onChange(
                                            [
                                                ...selected,
                                                ...available.filter(
                                                    (team) =>
                                                        !selectedIds.has(
                                                            team.id
                                                        )
                                                ),
                                            ].slice(0, capacity)
                                        )
                                    }
                                >
                                    {t.selectAllMatching}
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    disabled={!selected.length}
                                    onClick={() => onChange([])}
                                >
                                    {t.clearSelection}
                                </Button>
                            </div>
                            <fieldset className="max-h-72 space-y-1 overflow-y-auto">
                                <legend className="sr-only">
                                    {t.chooseTeams}
                                </legend>
                                {available.map((team) => (
                                    <label
                                        key={team.id}
                                        className="hover:bg-accent flex cursor-pointer items-center gap-3 rounded-md p-2"
                                    >
                                        <input
                                            type="checkbox"
                                            className="accent-primary size-4"
                                            checked={selectedIds.has(team.id)}
                                            disabled={
                                                !selectedIds.has(team.id) &&
                                                selected.length >= capacity
                                            }
                                            onChange={() => toggle(team)}
                                        />
                                        <TeamLogo
                                            name={team.name}
                                            shortCode={team.shortCode}
                                            logoUrl={team.logoUrl}
                                            className="size-6"
                                        />
                                        <span className="min-w-0 flex-1 text-sm">
                                            {team.name}
                                        </span>
                                        <span className="text-muted-foreground text-xs">
                                            {team.shortCode}
                                        </span>
                                    </label>
                                ))}
                                {!available.length && (
                                    <p className="text-muted-foreground p-2 text-sm">
                                        {t.noTeamResults}
                                    </p>
                                )}
                            </fieldset>
                        </>
                    ) : status === "loading" ? (
                        <p
                            role="status"
                            className="flex items-center gap-2 text-sm"
                        >
                            <Loader2
                                className="size-4 animate-spin"
                                aria-hidden
                            />
                            {t.loadingTeams}
                        </p>
                    ) : (
                        <div className="space-y-2">
                            <p
                                role="alert"
                                className="text-destructive text-sm"
                            >
                                {t.errors.unavailable}
                            </p>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setRetry((value) => value + 1)}
                            >
                                {t.retryTeams}
                            </Button>
                        </div>
                    )}
                    <div className="flex items-center justify-between gap-2 border-t pt-3">
                        <span role="status" className="text-sm">
                            {t.selectedTeams.replace(
                                "{count}",
                                String(selected.length)
                            )}
                        </span>
                        <Button
                            type="button"
                            size="sm"
                            onClick={() => setOpen(false)}
                        >
                            {t.doneSelecting}
                        </Button>
                    </div>
                </PopoverContent>
            </Popover>
            {selected.length > 0 && (
                <ul
                    className="flex max-h-24 flex-wrap gap-1 overflow-y-auto"
                    aria-label={t.chooseTeams}
                >
                    {selected.map((team) => (
                        <li key={team.id}>
                            <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                disabled={disabled}
                                onClick={() =>
                                    onChange(
                                        selected.filter(
                                            (item) => item.id !== team.id
                                        )
                                    )
                                }
                                aria-label={`${t.remove}: ${team.name}`}
                            >
                                {team.shortCode ?? team.name} ×
                            </Button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}
