"use client"

import {
    fetchAdminTeam,
    fetchAdminTeamPage,
    fetchAdminTeamUsage,
    sendAdminTeamCommand,
    TeamAdminReadError,
    TEAM_ADMIN_ERROR_CODES,
    type TeamAdminErrorCode,
} from "@/lib/teams-admin/team-admin-client"
import {
    TEAM_CATALOGUE_STATES,
    TEAM_USAGE_IDS_MAX,
    teamCatalogueState,
    type TeamCatalogueState,
    type TeamUsage,
} from "@/domain/teams/team-usage"
import {
    appendUnique,
    catalogueRowFacts,
    fillTemplate,
    removeById,
    type WorkspaceOption,
} from "@/lib/teams-admin/team-admin-list"
import {
    TEAM_GAMES,
    TEAM_PAGE_DEFAULT,
    normalizeTeamName,
    type TeamGame,
    type TeamRecord,
} from "@/domain/teams/team"
import {
    AdminPageHeader,
    adminAccent,
} from "@/components/app/admin-page-header"
import { TeamCatalogueDialog } from "@/components/app/team-catalogue-dialog"
import { TeamCatalogueDetail } from "@/components/app/team-catalogue-detail"
import type { TeamCatalogLabels } from "@/components/app/team-fields-editor"
import { TeamScrapeButton } from "@/components/app/team-scrape-button"
import { TeamMergeDialog } from "@/components/app/team-merge-dialog"
import { Loader2, Plus, Search, UsersRound } from "lucide-react"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { EmptyState } from "@/components/app/empty-state"
import { TeamLogo } from "@/components/app/team-logo"
import { useEffect, useRef, useState } from "react"
import { GAME_LABELS } from "@/domain/games/game"
import { Button } from "@/components/ui/button"
import { pluralize } from "@/i18n/plural"
import { cn } from "@/lib/utils"

type Notice = { tone: "error" | "success"; text: string }
type DialogState =
    | { kind: "closed" }
    | { kind: "create" }
    | { kind: "merge"; team: TeamRecord }

const errorCodeOf = (error: unknown): TeamAdminErrorCode =>
    error instanceof TeamAdminReadError &&
    (TEAM_ADMIN_ERROR_CODES as readonly string[]).includes(error.code)
        ? (error.code as TeamAdminErrorCode)
        : "unavailable"

/** Keeps a list in the order its state lists it: active by name, others as loaded. */
function placeTeam(
    items: readonly TeamRecord[],
    team: TeamRecord,
    state: TeamCatalogueState
): TeamRecord[] {
    if (teamCatalogueState(team) !== state) return removeById(items, team.id)
    if (items.some((item) => item.id === team.id))
        return items.map((item) => (item.id === team.id ? team : item))
    if (state !== "active") return [team, ...items]
    const name = normalizeTeamName(team.name)
    const index = items.findIndex((item) => normalizeTeamName(item.name) > name)
    return index === -1
        ? [...items, team]
        : [...items.slice(0, index), team, ...items.slice(index)]
}

/**
 * The global team catalogue (design I1): game tabs, lifecycle filter and
 * search above a list of teams, the chosen team edited beside the list.
 */
export function TeamCatalogueAdmin({
    labels,
    eyebrow,
    locale,
    workspaces,
    initialGame,
    workspaceQuery,
}: {
    labels: TeamCatalogLabels
    eyebrow: string
    locale: string
    workspaces: readonly WorkspaceOption[]
    initialGame: TeamGame
    /** `?workspace=` of the clan the administrator came from, kept on links. */
    workspaceQuery: string
}) {
    const [game, setGame] = useState<TeamGame>(initialGame)
    const [state, setState] = useState<TeamCatalogueState>("active")
    const [search, setSearch] = useState("")
    const term = useDebouncedValue(search.trim(), 300)
    const [items, setItems] = useState<TeamRecord[]>([])
    const [nextCursor, setNextCursor] = useState<string | null>(null)
    const [status, setStatus] = useState<"loading" | "ready" | "error">(
        "loading"
    )
    const [listError, setListError] =
        useState<TeamAdminErrorCode>("unavailable")
    const [loadingMore, setLoadingMore] = useState(false)
    const [reload, setReload] = useState(0)
    const [usage, setUsage] = useState<Map<string, TeamUsage | null>>(
        () => new Map()
    )
    const [usageFailed, setUsageFailed] = useState<Set<string>>(() => new Set())
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [notice, setNotice] = useState<Notice | null>(null)
    const [pendingId, setPendingId] = useState<string | null>(null)
    const [dialog, setDialog] = useState<DialogState>({ kind: "closed" })
    const [mergeSource, setMergeSource] = useState<TeamRecord | null>(null)
    const [mergedNames, setMergedNames] = useState<Map<string, string>>(
        () => new Map()
    )
    const detailRef = useRef<HTMLDivElement>(null)
    // Responses from a superseded query (game, state, search or reload) are ignored.
    const generation = useRef(0)

    useEffect(() => {
        const controller = new AbortController(),
            current = ++generation.current
        async function load() {
            setStatus("loading")
            try {
                const page = await fetchAdminTeamPage(
                    {
                        gameId: game,
                        archived: state !== "active",
                        state,
                        search: term,
                        limit: TEAM_PAGE_DEFAULT,
                    },
                    { signal: controller.signal }
                )
                if (current !== generation.current) return
                setItems(page.items)
                setNextCursor(page.nextCursor)
                setStatus("ready")
            } catch (error) {
                if (controller.signal.aborted || current !== generation.current)
                    return
                setListError(errorCodeOf(error))
                setStatus("error")
            }
        }
        void load()
        return () => controller.abort()
    }, [game, state, term, reload])

    // Usage of every loaded team, read in batches of one page.
    const missingUsage = items
        .map((team) => team.id)
        .filter((teamId) => !usage.has(teamId) && !usageFailed.has(teamId))
    const missingKey = missingUsage.join(",")
    useEffect(() => {
        if (!missingKey) return
        const controller = new AbortController()
        const teamIds = missingKey.split(",").slice(0, TEAM_USAGE_IDS_MAX)
        fetchAdminTeamUsage(teamIds, { signal: controller.signal })
            .then((rows) =>
                setUsage((known) => {
                    const next = new Map(known)
                    for (const teamId of teamIds) next.set(teamId, null)
                    for (const row of rows) next.set(row.teamId, row)
                    return next
                })
            )
            .catch(() => {
                if (controller.signal.aborted) return
                setUsageFailed((failed) => new Set([...failed, ...teamIds]))
            })
        return () => controller.abort()
    }, [missingKey])

    const selected =
        items.find((team) => team.id === selectedId) ?? items[0] ?? null

    // A merged entry names the team it points to.
    const mergedTarget = selected?.mergedIntoTeamId ?? null
    useEffect(() => {
        if (!mergedTarget || mergedNames.has(mergedTarget)) return
        const controller = new AbortController()
        fetchAdminTeam(mergedTarget, { signal: controller.signal })
            .then((team) => {
                if (team)
                    setMergedNames((names) =>
                        new Map(names).set(mergedTarget, team.name)
                    )
            })
            .catch(() => undefined)
        return () => controller.abort()
    }, [mergedTarget, mergedNames])

    async function loadMore() {
        if (!nextCursor) return
        const current = generation.current
        setLoadingMore(true)
        try {
            const page = await fetchAdminTeamPage({
                gameId: game,
                archived: state !== "active",
                state,
                search: term,
                cursor: nextCursor,
                limit: TEAM_PAGE_DEFAULT,
            })
            if (current !== generation.current) return
            setItems((loaded) => appendUnique(loaded, page.items))
            setNextCursor(page.nextCursor)
        } catch (error) {
            if (current !== generation.current) return
            setNotice({
                tone: "error",
                text: labels.errors[errorCodeOf(error)],
            })
        } finally {
            setLoadingMore(false)
        }
    }

    function applyRecord(teamId: string, team: TeamRecord | null) {
        setItems((loaded) =>
            team && team.gameId === game
                ? placeTeam(loaded, team, state)
                : removeById(loaded, teamId)
        )
        // Usage is re-read for a changed team.
        setUsage((known) => {
            const next = new Map(known)
            next.delete(teamId)
            return next
        })
    }

    async function refreshRow(teamId: string) {
        const latest = await fetchAdminTeam(teamId).catch(() => undefined)
        if (latest !== undefined) applyRecord(teamId, latest)
    }

    async function lifecycle(team: TeamRecord, action: "archive" | "restore") {
        setPendingId(team.id)
        setNotice(null)
        try {
            const result = await sendAdminTeamCommand({
                action,
                teamId: team.id,
                input: { expectedRevision: team.revision },
            })
            await refreshRow(team.id)
            if (result.ok)
                setNotice({
                    tone: "success",
                    text:
                        action === "archive"
                            ? labels.archivedNotice
                            : labels.restoredNotice,
                })
            else
                setNotice({
                    tone: "error",
                    text:
                        result.code === "revision_conflict" ||
                        result.code === "archived" ||
                        result.code === "not_archived"
                            ? labels.staleRow
                            : labels.errors[result.code],
                })
        } finally {
            setPendingId(null)
        }
    }

    function choose(teamId: string) {
        setSelectedId(teamId)
        setNotice(null)
        // On phones the detail sits below the list.
        if (window.matchMedia("(max-width: 1023px)").matches)
            requestAnimationFrame(() =>
                detailRef.current?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                })
            )
    }

    const searching = term.length > 0
    const requestHref = (requestId: string) =>
        `/${locale}/dashboard/team-requests?${new URLSearchParams({
            request: requestId,
            ...(workspaceQuery ? { workspace: workspaceQuery } : {}),
        }).toString()}`

    return (
        <div className="flex flex-col gap-5">
            <AdminPageHeader
                className="px-0 lg:px-0"
                eyebrow={eyebrow}
                title={labels.title}
                description={labels.description}
                primaryAction={
                    <Button
                        type="button"
                        onClick={() => {
                            setNotice(null)
                            setDialog({ kind: "create" })
                        }}
                    >
                        <Plus className="size-4" aria-hidden />
                        {labels.add}
                    </Button>
                }
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div
                    role="tablist"
                    aria-label={labels.gamesLabel}
                    className="bg-muted flex gap-0.5 rounded-[10px] p-[3px]"
                >
                    {TEAM_GAMES.map((gameId) => (
                        <button
                            key={gameId}
                            type="button"
                            role="tab"
                            aria-selected={game === gameId}
                            onClick={() => {
                                setGame(gameId)
                                setSelectedId(null)
                                setNotice(null)
                            }}
                            className="text-muted-foreground aria-selected:bg-background aria-selected:text-foreground focus-visible:ring-ring h-8 rounded-lg px-3.5 text-[13px] font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none aria-selected:font-semibold aria-selected:shadow-sm"
                        >
                            {GAME_LABELS[gameId]}
                        </button>
                    ))}
                </div>
                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                    <div
                        role="group"
                        aria-label={labels.statesLabel}
                        className="flex flex-wrap gap-1.5"
                    >
                        {TEAM_CATALOGUE_STATES.map((value) => (
                            <button
                                key={value}
                                type="button"
                                aria-pressed={state === value}
                                onClick={() => {
                                    setState(value)
                                    setSelectedId(null)
                                    setNotice(null)
                                }}
                                className="border-border bg-background text-muted-foreground aria-pressed:border-foreground aria-pressed:bg-muted aria-pressed:text-foreground hover:text-foreground focus-visible:ring-ring h-8 rounded-full border px-3 text-[13px] font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
                            >
                                {labels.states[value]}
                            </button>
                        ))}
                    </div>
                    <label className="border-input text-muted-foreground focus-within:ring-ring flex h-8 w-full items-center gap-2 rounded-lg border px-2.5 focus-within:ring-2 sm:w-56">
                        <Search className="size-3.5 shrink-0" aria-hidden />
                        <input
                            type="search"
                            value={search}
                            maxLength={64}
                            placeholder={labels.search}
                            aria-label={labels.searchLabel}
                            className="text-foreground placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-[13px] outline-none"
                            onChange={(event) => {
                                setSearch(event.target.value)
                                setSelectedId(null)
                            }}
                        />
                    </label>
                </div>
            </div>
            <TeamScrapeButton
                key={game}
                gameId={game}
                labels={labels}
                onImported={() => setReload((value) => value + 1)}
            />
            <div aria-live="polite" className="min-h-0 empty:hidden">
                {notice ? (
                    <p
                        role={notice.tone === "error" ? "alert" : "status"}
                        className={
                            notice.tone === "error"
                                ? "text-destructive text-sm"
                                : "text-muted-foreground text-sm"
                        }
                    >
                        {notice.text}
                    </p>
                ) : null}
            </div>
            {status === "loading" && items.length === 0 ? (
                <p
                    role="status"
                    className="text-muted-foreground flex items-center gap-2 text-sm"
                >
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    {labels.loading}
                </p>
            ) : status === "error" ? (
                <div className="flex flex-wrap items-center gap-3">
                    <p role="alert" className="text-destructive text-sm">
                        {labels.errors[listError]}
                    </p>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setReload((value) => value + 1)}
                    >
                        {labels.retry}
                    </Button>
                </div>
            ) : items.length === 0 ? (
                <EmptyState
                    icon={UsersRound}
                    title={searching ? labels.emptySearch : labels.empty}
                />
            ) : (
                <div className="flex flex-wrap items-start gap-5">
                    <ul
                        aria-label={labels.listLabel}
                        aria-busy={status === "loading"}
                        className="bg-card min-w-0 flex-[1_1_22rem] divide-y overflow-hidden rounded-2xl border"
                    >
                        {items.map((team) => (
                            <li key={team.id}>
                                <CatalogueRow
                                    labels={labels}
                                    locale={locale}
                                    team={team}
                                    usage={usage.get(team.id)}
                                    current={selected?.id === team.id}
                                    onSelect={() => choose(team.id)}
                                />
                            </li>
                        ))}
                        {status === "ready" && nextCursor ? (
                            <li className="flex justify-center px-4 py-2.5">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="text-foreground/80 text-[13px] font-medium"
                                    disabled={loadingMore}
                                    onClick={() => void loadMore()}
                                >
                                    {loadingMore ? (
                                        <Loader2
                                            className="size-4 animate-spin"
                                            aria-hidden
                                        />
                                    ) : null}
                                    {labels.loadMore}
                                </Button>
                            </li>
                        ) : null}
                    </ul>
                    <div
                        ref={detailRef}
                        className="min-w-0 flex-[1_1_22rem] scroll-mt-4"
                    >
                        {selected ? (
                            <TeamCatalogueDetail
                                key={selected.id}
                                labels={labels}
                                locale={locale}
                                team={selected}
                                workspaces={workspaces}
                                requestHref={requestHref}
                                lifecycleBusy={pendingId === selected.id}
                                mergedIntoName={
                                    selected.mergedIntoTeamId
                                        ? (mergedNames.get(
                                              selected.mergedIntoTeamId
                                          ) ?? null)
                                        : null
                                }
                                onSaved={(team) => {
                                    applyRecord(team.id, team)
                                    setNotice({
                                        tone: "success",
                                        text: labels.saved,
                                    })
                                }}
                                onStale={applyRecord}
                                onMerge={() => {
                                    setMergeSource(selected)
                                    setNotice(null)
                                    setDialog({ kind: "merge", team: selected })
                                }}
                                onLifecycle={(action) =>
                                    lifecycle(selected, action)
                                }
                            />
                        ) : (
                            <p className="text-muted-foreground text-sm">
                                {labels.selectTeam}
                            </p>
                        )}
                    </div>
                </div>
            )}
            <TeamCatalogueDialog
                labels={labels}
                gameId={game}
                team={null}
                workspaces={workspaces}
                open={dialog.kind === "create"}
                onOpenChange={(open) => {
                    if (!open) setDialog({ kind: "closed" })
                }}
                onSaved={(team) => {
                    applyRecord(team.id, team)
                    if (teamCatalogueState(team) === state)
                        setSelectedId(team.id)
                    setNotice({ tone: "success", text: labels.saved })
                }}
                onStale={applyRecord}
            />
            {mergeSource ? (
                <TeamMergeDialog
                    key={mergeSource.id}
                    labels={labels}
                    source={dialog.kind === "merge" ? dialog.team : mergeSource}
                    open={dialog.kind === "merge"}
                    onOpenChange={(open) => {
                        if (!open) setDialog({ kind: "closed" })
                    }}
                    onMerged={(source, target, names) => {
                        if (source) applyRecord(source.id, source)
                        else void refreshRow(mergeSource.id)
                        if (target) applyRecord(target.id, target)
                        setNotice({
                            tone: "success",
                            text: fillTemplate(labels.mergedNotice, names),
                        })
                    }}
                    onStale={applyRecord}
                />
            ) : null}
        </div>
    )
}

/** One catalogue row: logo, name, facts and the request marker. */
function CatalogueRow({
    labels,
    locale,
    team,
    usage,
    current,
    onSelect,
}: {
    labels: TeamCatalogLabels
    locale: string
    team: TeamRecord
    usage: TeamUsage | null | undefined
    current: boolean
    onSelect(): void
}) {
    const facts = catalogueRowFacts(team, usage).map((fact) =>
        fact.kind === "code"
            ? fact.value
            : fact.kind === "linked"
              ? labels.rowLinked
              : fact.kind === "competitions"
                ? pluralize(locale, fact.count, labels.rowCompetitions)
                : labels.rowPendingChange
    )
    const requested = (usage?.pendingRequests ?? 0) > 0
    return (
        <button
            type="button"
            aria-current={current ? "true" : undefined}
            onClick={onSelect}
            className={cn(
                "focus-visible:ring-ring flex w-full items-center gap-3 px-4 py-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset",
                current ? adminAccent.surface : "hover:bg-muted/50"
            )}
        >
            <TeamLogo
                name={team.name}
                shortCode={team.shortCode}
                logoUrl={team.logoUrl}
                className="size-9 text-[11px]"
            />
            <span className="flex min-w-0 flex-1 flex-col leading-5">
                <span className="truncate text-sm font-semibold">
                    {team.name}
                </span>
                {facts.length > 0 ? (
                    <span className="text-muted-foreground truncate text-xs">
                        {facts.join(" · ")}
                    </span>
                ) : null}
            </span>
            {requested ? (
                <span
                    className={cn(
                        "inline-flex h-[22px] shrink-0 items-center rounded-md px-2 text-[11px] font-semibold",
                        adminAccent.badge
                    )}
                    title={labels.requestBadgeLabel}
                >
                    {labels.requestBadge}
                </span>
            ) : null}
        </button>
    )
}
