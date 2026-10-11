"use client"

import {
    ArrowLeft,
    ArrowRight,
    Check,
    ChevronDown,
    ChevronRight,
    CircleCheck,
    EyeOff,
    Info,
    Loader2,
    RefreshCw,
    Repeat,
    Send,
    TriangleAlert,
    X,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import Link from "next/link"

import {
    NEW_MATCH_STEPS,
    reminderAudience,
    reminderStatusesFor,
    type NewMatchStep,
    type ReminderAudience,
} from "@/domain/events/new-match-flow"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    templatesFor,
    type MatchTemplate,
    type TemplateSignupStatus,
} from "@/domain/events/match-templates"
import {
    formatHllPresetLabel,
    getHllModeOptions,
    getHllTimeOptions,
} from "@/lib/hll-map-presets"
import type {
    EventCategory,
    EventRecord,
    Group,
    SquadPreset,
} from "@/types/domain"
import {
    matchTeamSaveErrorCode,
    requestMatchTeamRefresh,
} from "@/lib/teams/team-client"
import { DiscordMultiEntitySelect } from "@/components/app/discord-multi-entity-select"
import { ATTENDANCE_REMINDER_OFFSETS } from "@/domain/events/scheduled-job-policy"
import type { DiscordSelectOption } from "@/components/app/discord-entity-select"
import { ConfirmActionDialog } from "@/components/app/confirm-action-dialog"
import type { MessageStyle } from "@/domain/discord-messages/message-style"
import { DiscordMarkdownTextarea } from "@/components/app/discord-markdown"
import { TeamRequestDialog } from "@/components/app/team-request-dialog"
import { TacticalPlanEditor, TacticalPlanMap } from "./tactical-plan"
import { matchTeamGame } from "@/lib/teams/match-team-selection"
import { eventWriteErrorMessage } from "@/lib/event-write-error"
import type { TeamDto, TeamRecord } from "@/domain/teams/team"
import { GAME_LABELS, type GameId } from "@/domain/games/game"
import { AvatarPicker } from "@/components/app/avatar-picker"
import { matchTeamSides } from "@/domain/teams/match-teams"
import { tacticalPlanCopy } from "./tactical-plan-copy"
import { getStratmapMaps } from "@/lib/game-stratmaps"
import { TeamLogo } from "@/components/app/team-logo"
import type { Dictionary } from "@/i18n/dictionaries"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

import {
    applyTemplateValues,
    defaultTimeOfDay,
    effectiveReminderHours,
    flowEditPayload,
    flowEventPayload,
    flowSchedule,
    flowValuesFromEvent,
    FLOW_SIGNUP_STATUSES,
    gameGroups,
    newFlowValues,
    scheduleIsCoherent,
    usesActivitySelection,
    type ChannelDefaults,
    type FlowValues,
} from "./flow-values"
import {
    fill,
    flowChanges,
    flowFacts,
    flowPreviewModel,
    flowReviewRows,
    formatAt,
    formatTimeOnly,
    sideLabel as flowSideLabel,
    type FlowSummaryContext,
} from "./flow-summary"
import { NewMatchPreview, type NewMatchPreviewModel } from "./new-match-preview"
import { OpponentPicker } from "./opponent-picker"

const NO_SIDE = "__none"
const NONE = "__none"
const AUTOSAVE_DELAY_MS = 2500
type Metadata = {
    roles: DiscordSelectOption[]
    channels: Array<DiscordSelectOption & { type: number; parentId?: string }>
}

/** What edit mode needs besides the stored event (design D2 in edit mode). */
export type NewMatchEditContext = {
    event: EventRecord
    /** The match or training page the flow returns to. */
    detailHref: string
    listHref: string
    /** The step `?step=` opens. */
    initialStep: NewMatchStep
    /** A weekly series: this match carries it, or is one of its dates. */
    series:
        | { kind: "source" }
        | { kind: "occurrence"; sourceEditHref: string | null }
        | null
    /** A roster exists, so a new squad preset no longer applies. */
    rosterExists: boolean
    /** Current sign-ups, for the preview. */
    signups: NonNullable<NewMatchPreviewModel["signups"]>
}

export type NewMatchFlowProps = {
    serverId: string
    locale: string
    dictionary: Dictionary
    /** Preview copy in the clan's bot language. */
    previewCopy: Dictionary["newMatch"]["preview"]
    botLanguage: string
    initialKind: "match" | "training"
    initialGameId: GameId
    enabledGames: GameId[]
    gameCatalogue: Array<{
        id: GameId
        name: string
        capabilities: { maps: boolean; stratmaps: boolean }
        eventSelection: {
            primaryLabel: string
            primaryOptions: string[]
            targetLabel?: string
            targetOptional: boolean
        }
    }>
    templates: MatchTemplate[]
    groups: Group[]
    squadPresets: SquadPreset[]
    eventCategories: EventCategory[]
    topicPresets: Array<{ id: string; name: string }>
    stratmaps: Array<{ id: string; title: string; gameId?: GameId }>
    timezone: string
    clan: { name: string }
    linkedTeams: TeamDto[]
    /** Default announcement and roster channels per game. */
    channelDefaults: ChannelDefaults
    clanRoleId?: string
    /** Whether the clan has a forum category, without which no forum is made. */
    forumCategoryConfigured: boolean
    /** The clan's message style, so the preview has the bot's colour and icons. */
    messageStyle?: MessageStyle
    draft: EventRecord | null
    /** Edit mode: the published event to change. */
    edit?: NewMatchEditContext
}

function SegmentedControl<T extends string>({
    label,
    value,
    options,
    onChange,
    size = "md",
    disabled = false,
}: {
    label: string
    value: T
    options: Array<{ value: T; label: string }>
    onChange(value: T): void
    size?: "md" | "sm"
    disabled?: boolean
}) {
    return (
        <div
            role="radiogroup"
            aria-label={label}
            aria-disabled={disabled || undefined}
            className="bg-muted flex gap-0.5 rounded-[10px] p-[3px]"
        >
            {options.map((option) => {
                const checked = option.value === value
                return (
                    <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={checked}
                        disabled={disabled && !checked}
                        onClick={() => onChange(option.value)}
                        className={cn(
                            "flex-1 rounded-lg px-2 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50",
                            size === "md" ? "h-[34px]" : "h-8 text-[13px]",
                            checked
                                ? "bg-background text-foreground font-semibold shadow-sm"
                                : "text-muted-foreground hover:text-foreground font-medium"
                        )}
                    >
                        {option.label}
                    </button>
                )
            })}
        </div>
    )
}

function FieldLabel({
    htmlFor,
    id,
    children,
}: {
    htmlFor?: string
    id?: string
    children: React.ReactNode
}) {
    return htmlFor ? (
        <Label htmlFor={htmlFor} className="text-sm font-medium">
            {children}
        </Label>
    ) : (
        <span id={id} className="text-sm leading-none font-medium">
            {children}
        </span>
    )
}

function Hint({
    id,
    children,
    tone = "muted",
}: {
    id?: string
    children: React.ReactNode
    tone?: "muted" | "warning"
}) {
    return (
        <span
            id={id}
            className={cn(
                "text-xs leading-[18px]",
                tone === "warning"
                    ? "inline-flex items-start gap-1.5 text-amber-700 dark:text-amber-400"
                    : "text-muted-foreground"
            )}
        >
            {tone === "warning" ? (
                <TriangleAlert
                    className="mt-px size-3.5 shrink-0"
                    aria-hidden
                />
            ) : null}
            <span>{children}</span>
        </span>
    )
}

/**
 * Asks before leaving with unsaved changes: the browser's own prompt for a
 * reload or a closed tab, and a confirmation for links inside the app.
 */
function useLeaveGuard(active: boolean, message: string) {
    useEffect(() => {
        if (!active) return
        const beforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault()
            event.returnValue = ""
        }
        const click = (event: MouseEvent) => {
            if (
                event.defaultPrevented ||
                event.button !== 0 ||
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
            )
                return
            const anchor = (event.target as Element | null)?.closest?.(
                "a[href]"
            )
            if (!(anchor instanceof HTMLAnchorElement)) return
            if (anchor.target && anchor.target !== "_self") return
            const url = new URL(anchor.href, window.location.href)
            if (url.origin !== window.location.origin) return
            if (
                url.pathname === window.location.pathname &&
                url.search === window.location.search
            )
                return
            if (!window.confirm(message)) {
                event.preventDefault()
                event.stopPropagation()
            }
        }
        window.addEventListener("beforeunload", beforeUnload)
        document.addEventListener("click", click, true)
        return () => {
            window.removeEventListener("beforeunload", beforeUnload)
            document.removeEventListener("click", click, true)
        }
    }, [active, message])
}

function startingValues(props: NewMatchFlowProps): FlowValues {
    const stored = props.edit?.event ?? props.draft
    if (stored) return flowValuesFromEvent(stored, props.timezone)
    return newFlowValues({
        kind: props.initialKind,
        gameId: props.initialGameId,
        timezone: props.timezone,
        groups: props.groups,
        templates: props.templates,
        channelDefaults: props.channelDefaults,
        now: new Date(),
    })
}

/**
 * The new-match flow (design D2): five steps (match, time, sign-ups,
 * Discord, review) with the Discord preview beside them. Work in progress is
 * autosaved as a draft that only managers see; publishing turns the draft
 * into the match the bot announces. In edit mode the same steps start from
 * the published event, every step is open, nothing is autosaved, the review
 * lists what changes and saving updates the event and its announcement.
 */
export function NewMatchFlow(props: NewMatchFlowProps) {
    const {
        serverId,
        locale,
        dictionary,
        timezone,
        templates,
        groups,
        linkedTeams,
        channelDefaults,
    } = props
    const edit = props.edit ?? null
    const isEdit = edit !== null
    const t = dictionary.newMatch
    const router = useRouter()
    const [initial, setInitial] = useState<FlowValues>(() =>
        startingValues(props)
    )
    const [values, setValues] = useState<FlowValues>(initial)
    const gameDefinition = props.gameCatalogue.find(
        (game) => game.id === values.gameId
    )
    const isActivityGame = gameDefinition
        ? !gameDefinition.capabilities.maps
        : usesActivitySelection(values.gameId)
    const activityOptions = gameDefinition?.eventSelection.primaryOptions ?? []
    const activityLabel =
        gameDefinition?.eventSelection.primaryLabel ?? t.match.activity
    const targetLabel =
        gameDefinition?.eventSelection.targetLabel ?? t.match.target
    const targetOptional = gameDefinition?.eventSelection.targetOptional ?? true
    const hasStratmaps = gameDefinition
        ? gameDefinition.capabilities.stratmaps
        : ["hell_let_loose", "wardogs"].includes(values.gameId)
    // Saved team assignments; a snapshot refresh saves at once and updates them.
    const [storedTeams, setStoredTeams] = useState(edit?.event.matchTeams)
    const [refreshing, setRefreshing] = useState<string | null>(null)
    const [step, setStep] = useState<NewMatchStep>(edit?.initialStep ?? "match")
    const [draftId, setDraftId] = useState<string | null>(
        props.draft?.id ?? null
    )
    const [dirty, setDirty] = useState(false)
    const [saveState, setSaveState] = useState<
        | { kind: "idle" }
        | { kind: "saving" }
        | { kind: "saved"; at: Date }
        | { kind: "failed" }
    >({ kind: "idle" })
    const [busy, setBusy] = useState<"publish" | "draft" | "save" | null>(null)
    const [editingTimes, setEditingTimes] = useState(isEdit)
    const [moreOpen, setMoreOpen] = useState(false)
    const [metadata, setMetadata] = useState<Metadata | null>(null)
    const [requestOpen, setRequestOpen] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)
    const [leaveOpen, setLeaveOpen] = useState(false)
    const saving = useRef<Promise<unknown> | null>(null)
    const draftIdRef = useRef(draftId)
    draftIdRef.current = draftId

    // Counts edits so a save only clears "dirty" for the values it sent.
    const edits = useRef(0)
    const markDirty = useCallback(() => {
        edits.current += 1
        setDirty(true)
    }, [])

    const update = useCallback(
        (patch: Partial<FlowValues>) => {
            setValues((current) => ({ ...current, ...patch }))
            markDirty()
        },
        [markDirty]
    )

    useEffect(() => {
        fetch(`/api/servers/${serverId}/discord-metadata`)
            .then(async (response) => {
                const body = (await response.json()) as Metadata
                if (!response.ok || !Array.isArray(body?.channels))
                    throw new Error()
                setMetadata(body)
            })
            .catch(() => setMetadata(null))
    }, [serverId])

    const isMatch = values.kind === "match"
    const teamGame = matchTeamGame(values.gameId)
    const ownTeam = teamGame
        ? (linkedTeams.find((team) => team.gameId === teamGame) ?? null)
        : null
    // A saved match shows the team it stored in slot a.
    const storedOwn = storedTeams?.find((team) => team.slot === "a")
    const ownDisplay = storedOwn
        ? {
              name: storedOwn.snapshot.name,
              shortCode: storedOwn.snapshot.shortCode,
              logoUrl: storedOwn.snapshot.logoUrl,
          }
        : ownTeam
    const savedTeamIds = new Set((storedTeams ?? []).map((team) => team.teamId))
    const sides: readonly string[] = teamGame
        ? matchTeamSides(teamGame)
        : ["Allies", "Axis"]
    const sideLabel = (side: string | null) => flowSideLabel(t, side)
    const template =
        templates.find((entry) => entry.id === values.templateId) ?? null
    const offeredTemplates = useMemo(
        () =>
            templates.filter(
                (entry) => !entry.gameId || entry.gameId === values.gameId
            ),
        [templates, values.gameId]
    )
    const groupsOfGame = gameGroups(groups, values.gameId)
    const intl = locale === "cs" ? "cs-CZ" : locale === "de" ? "de-DE" : "en-GB"

    const textChannels = (metadata?.channels ?? []).filter(
        (channel) => channel.type === 0 || channel.type === 5
    )
    const voiceChannels = (metadata?.channels ?? []).filter(
        (channel) => channel.type === 2 || channel.type === 13
    )
    const categoryChannels = (metadata?.channels ?? []).filter(
        (channel) => channel.type === 4
    )
    const channelName = (id: string) =>
        metadata?.channels.find((channel) => channel.id === id)?.name ?? null
    const roleName = (id: string) =>
        metadata?.roles.find((role) => role.id === id)?.name ?? null
    const squadPresetsOfGame = props.squadPresets.filter(
        (preset) => (preset.gameId ?? "hell_let_loose") === values.gameId
    )
    const stratmapsOfGame = props.stratmaps.filter(
        (stratmap) => (stratmap.gameId ?? "hell_let_loose") === values.gameId
    )

    const summaryContext: FlowSummaryContext = {
        t,
        intl,
        timezone,
        clanName: props.clan.name,
        ownTeam: ownDisplay,
        templateName: template?.name ?? null,
        groups,
        categories: props.eventCategories,
        squadPresets: props.squadPresets,
        topicPresets: props.topicPresets,
        stratmaps: props.stratmaps,
        channelName,
        roleName,
    }
    const facts = flowFacts(values, summaryContext)
    const { ownCode, name, map: selectedMap } = facts
    const schedule = flowSchedule(values, timezone)

    // Map choices.
    const maps = getStratmapMaps(values.gameId)
    const timeOptions =
        values.gameId === "wardogs"
            ? ["day", "morning", "evening", "night"].map((value) => ({ value }))
            : values.mapId
              ? getHllTimeOptions(values.mapId, values.gameId)
              : []
    const modeOptions =
        values.mapId && values.timeOfDay
            ? getHllModeOptions(values.mapId, values.timeOfDay, values.gameId)
            : []
    const strongpoints =
        values.gameId === "wardogs" ? [] : (selectedMap?.strongpoints ?? [])
    const timeLabel = (time: string) =>
        (t.match.timesOfDay as Record<string, string>)[time] ?? time
    const modeLabel = (mode: string) =>
        (t.match.modes as Record<string, string>)[mode] ?? mode
    // A stored map Logi cannot read as a preset is kept until another is picked.
    const unknownStoredMap =
        isEdit && isMatch && edit.event.map && !initial.mapId
            ? (formatHllPresetLabel(edit.event.map, values.gameId) ??
              edit.event.map)
            : null

    const limitOf = (groupId: string) =>
        values.signupGroupLimits.find((limit) => limit.groupId === groupId)?.max

    const previewModel: NewMatchPreviewModel = flowPreviewModel(
        values,
        {
            ...summaryContext,
            botLanguage: props.botLanguage,
            clanRoleId: props.clanRoleId,
            messageStyle: props.messageStyle,
            signups: edit?.signups,
        },
        schedule
    )
    const changes = useMemo(
        () => (isEdit ? flowChanges(initial, values, summaryContext) : []),
        // The summary context is derived from props, metadata and values.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [isEdit, initial, values, metadata]
    )
    const unsaved = isEdit && changes.length > 0
    useLeaveGuard(unsaved && busy !== "save", t.edit.leavePrompt)

    const stepOfField = (field: string): NewMatchStep => {
        if (
            [
                "registrationStart",
                "registrationEnd",
                "meetingStart",
                "gameStart",
                "gameEnd",
                "durationMinutes",
                "recurrence",
            ].includes(field)
        )
            return "time"
        if (
            field.startsWith("signup") ||
            field === "allowedSignupStatuses" ||
            field === "useGeneralSignup"
        )
            return "signups"
        if (
            [
                "announcementChannelId",
                "eventInfoChannelId",
                "pingMode",
                "pingRoleIds",
                "pingClan",
                "createForumChannel",
                "createSquadVoiceChannels",
                "server",
                "serverPassword",
            ].includes(field)
        )
            return "discord"
        return "match"
    }

    const errorMessage = (
        body: { error?: string; fields?: string[] } | null
    ) => {
        const code = body?.error ?? "save_failed"
        if (code === "invalid_event") {
            const steps = [
                ...new Set((body?.fields ?? []).map(stepOfField)),
            ].map((entry) => t.steps[entry])
            return fill(t.errors.invalid_event, {
                fields: steps.join(", ") || t.steps.match,
            })
        }
        const teamErrors = dictionary.teams.picker.errors as Record<
            string,
            string
        >
        return (
            (t.errors as Record<string, string>)[code] ??
            teamErrors[code] ??
            t.errors.save_failed
        )
    }

    const write = useCallback(
        async (publish: boolean) => {
            const response = await fetch(
                `/api/servers/${serverId}/event-drafts`,
                {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                        ...(draftIdRef.current
                            ? { eventId: draftIdRef.current }
                            : {}),
                        publish,
                        event: flowEventPayload(values, {
                            timezone,
                            name,
                            ownTeamId: ownTeam?.id ?? null,
                        }),
                    }),
                }
            )
            const body = (await response.json().catch(() => null)) as {
                ok?: boolean
                eventId?: string
                error?: string
                fields?: string[]
            } | null
            return { ok: response.ok && Boolean(body?.eventId), body }
        },
        [serverId, values, name, timezone, ownTeam?.id]
    )

    const rememberDraft = useCallback((eventId: string) => {
        setDraftId(eventId)
        const url = new URL(window.location.href)
        if (url.searchParams.get("draftId") !== eventId) {
            url.searchParams.set("draftId", eventId)
            window.history.replaceState(window.history.state, "", url)
        }
    }, [])

    const saveDraft = useCallback(
        async (manual: boolean) => {
            if (!schedule) return
            setSaveState({ kind: "saving" })
            const sentEdits = edits.current
            const run = write(false)
            saving.current = run
            try {
                const result = await run
                if (result.ok && result.body?.eventId) {
                    rememberDraft(result.body.eventId)
                    setSaveState({ kind: "saved", at: new Date() })
                    if (edits.current === sentEdits) setDirty(false)
                    if (manual) toast.success(t.draftSaved)
                } else {
                    setSaveState({ kind: "failed" })
                    if (manual) toast.error(errorMessage(result.body))
                }
            } catch {
                setSaveState({ kind: "failed" })
                if (manual) toast.error(t.errors.save_failed)
            } finally {
                saving.current = null
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [write, schedule?.registrationEnd]
    )

    // Autosave a little after the last change; edit mode saves only on purpose.
    useEffect(() => {
        if (isEdit || !dirty || busy) return
        const timer = setTimeout(() => {
            if (!saving.current) void saveDraft(false)
        }, AUTOSAVE_DELAY_MS)
        return () => clearTimeout(timer)
    }, [isEdit, busy, dirty, saveDraft, values])

    async function publish() {
        setBusy("publish")
        try {
            if (saving.current) await saving.current.catch(() => undefined)
            const result = await write(true)
            if (!result.ok || !result.body?.eventId) {
                toast.error(errorMessage(result.body))
                return
            }
            setDirty(false)
            toast.success(isMatch ? t.published : t.publishedTraining)
            router.push(
                `/${locale}/dashboard/servers/${serverId}/${isMatch ? "matches" : "trainings"}/${result.body.eventId}?game=${values.gameId}`
            )
            router.refresh()
        } catch {
            toast.error(t.errors.save_failed)
        } finally {
            setBusy(null)
        }
    }

    async function saveAsDraft() {
        setBusy("draft")
        try {
            if (saving.current) await saving.current.catch(() => undefined)
            await saveDraft(true)
        } finally {
            setBusy(null)
        }
    }

    async function deleteDraft() {
        if (!draftId) return
        const response = await fetch(
            `/api/servers/${serverId}/event-drafts/${draftId}`,
            { method: "DELETE" }
        )
        const body = (await response.json().catch(() => null)) as {
            error?: string
        } | null
        if (!response.ok) {
            toast.error(errorMessage(body))
            return
        }
        setDirty(false)
        toast.success(t.draftDeleted)
        router.push(`/${locale}/dashboard/servers/${serverId}/matches`)
        router.refresh()
    }

    /** Saves an edit through the event update route; the bot updates the announcement. */
    async function saveChanges() {
        if (!edit) return
        if (!name.trim()) {
            toast.error(t.errors.nameRequired)
            setStep("match")
            return
        }
        if (!scheduleIsCoherent(schedule)) {
            toast.error(t.edit.invalidSchedule)
            setStep("time")
            return
        }
        setBusy("save")
        try {
            const response = await fetch(
                `/api/servers/${serverId}/events/${edit.event.id}`,
                {
                    method: "PATCH",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify(
                        flowEditPayload(
                            values,
                            initial,
                            { ...edit.event, matchTeams: storedTeams },
                            {
                                timezone,
                                name,
                                ownTeamId: ownTeam?.id ?? null,
                            }
                        )
                    ),
                }
            )
            const body = (await response.json().catch(() => null)) as {
                eventId?: string
                error?: string
            } | null
            if (!response.ok) {
                const teamError = matchTeamSaveErrorCode(body)
                toast.error(
                    teamError
                        ? dictionary.teams.picker.errors[teamError]
                        : eventWriteErrorMessage(body, {
                              forbidden: dictionary.event.writeForbidden,
                              fallback: t.errors.save_failed,
                          })
                )
                setBusy(null)
                return
            }
            toast.success(t.edit.saved)
            router.push(edit.detailHref)
            router.refresh()
        } catch {
            toast.error(t.errors.save_failed)
            setBusy(null)
        }
    }

    function leaveEdit() {
        if (edit) router.push(edit.detailHref)
    }

    /**
     * Re-captures a saved team's name and logo from the catalogue. It saves
     * at once (like before); a merged team moves to the surviving one.
     */
    async function refreshTeam(teamId: string) {
        if (!edit) return
        const slot = storedTeams?.find((team) => team.teamId === teamId)?.slot
        setRefreshing(teamId)
        const result = await requestMatchTeamRefresh(
            serverId,
            edit.event.id,
            teamId
        )
        setRefreshing(null)
        if (!result.ok) {
            toast.error(
                (dictionary.teams.picker.errors as Record<string, string>)[
                    result.code
                ] ?? t.errors.save_failed
            )
            return
        }
        setStoredTeams(result.matchTeams)
        const next = result.matchTeams.find((team) => team.slot === slot)
        const apply = (current: FlowValues): FlowValues => {
            if (!next) return current
            const display = {
                teamId: next.teamId,
                name: next.snapshot.name,
                shortCode: next.snapshot.shortCode,
                logoUrl: next.snapshot.logoUrl,
            }
            if (slot === "b" && current.opponent?.teamId === teamId)
                return { ...current, opponent: display }
            if (slot === "c" && current.extraTeam?.teamId === teamId)
                return { ...current, extraTeam: display }
            return current
        }
        setInitial(apply)
        setValues(apply)
        toast.success(dictionary.teams.picker.snapshotRefreshed)
        router.refresh()
    }

    const refreshButton = (teamId: string) =>
        isEdit && savedTeamIds.has(teamId) ? (
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                disabled={refreshing !== null}
                aria-label={dictionary.teams.picker.refreshSnapshot}
                title={dictionary.teams.picker.refreshSnapshot}
                onClick={() => void refreshTeam(teamId)}
            >
                {refreshing === teamId ? (
                    <Loader2 className="size-4 animate-spin" />
                ) : (
                    <RefreshCw className="size-4" />
                )}
            </Button>
        ) : null

    function changeGame(gameId: GameId) {
        const next: FlowValues = {
            ...values,
            gameId,
            opponent: null,
            ownSide: null,
            opponentSide: null,
            extraTeam: null,
            extraSide: null,
            mapId: "",
            timeOfDay: "",
            tacticalPlan: null,
            mapMode: "",
            cap: "",
            activity: "",
            activityTarget: "",
            signupGroupIds: gameGroups(groups, gameId).map((group) => group.id),
            signupGroupLimits: [],
            announcementChannelId:
                channelDefaults[gameId]?.announcementChannelId ??
                values.announcementChannelId,
            eventInfoChannelId: isMatch
                ? (channelDefaults[gameId]?.eventInfoChannelId ??
                  values.eventInfoChannelId)
                : "",
        }
        const current = templates.find(
            (entry) => entry.id === values.templateId
        )
        const keep =
            current && (!current.gameId || current.gameId === gameId)
                ? current
                : templatesFor(templates, values.kind, gameId)[0]
        setValues(
            keep
                ? applyTemplateValues(next, keep, groups, channelDefaults)
                : { ...next, templateId: null }
        )
        markDirty()
    }

    function pickTemplate(entry: MatchTemplate) {
        setValues((current) =>
            applyTemplateValues(current, entry, groups, channelDefaults)
        )
        markDirty()
    }

    function setOwnSide(side: string | null) {
        const other =
            side && sides.length === 2
                ? (sides.find((entry) => entry !== side) ?? null)
                : values.opponentSide
        update({
            ownSide: side,
            opponentSide:
                values.opponentSide === side || (side && !values.opponentSide)
                    ? other
                    : values.opponentSide,
        })
    }

    function setOpponentSide(side: string | null) {
        const other =
            side && sides.length === 2
                ? (sides.find((entry) => entry !== side) ?? null)
                : values.ownSide
        update({
            opponentSide: side,
            ownSide:
                values.ownSide === side || (side && !values.ownSide)
                    ? other
                    : values.ownSide,
        })
    }

    function setGroupOffered(groupId: string, offered: boolean) {
        update({
            signupGroupIds: offered
                ? groupsOfGame
                      .map((group) => group.id)
                      .filter(
                          (id) =>
                              id === groupId ||
                              values.signupGroupIds.includes(id)
                      )
                : values.signupGroupIds.filter((id) => id !== groupId),
        })
    }

    function setGroupLimit(groupId: string, raw: string) {
        const others = values.signupGroupLimits.filter(
            (limit) => limit.groupId !== groupId
        )
        const max = Number(raw)
        if (raw.trim() === "") {
            update({ signupGroupLimits: others })
            return
        }
        if (Number.isInteger(max) && max >= 1 && max <= 100)
            update({ signupGroupLimits: [...others, { groupId, max }] })
    }

    const stepIndex = NEW_MATCH_STEPS.indexOf(step)
    const stepTitle = (entry: NewMatchStep) =>
        entry === "match" && !isMatch ? t.steps.training : t.steps[entry]
    const autosaveText =
        saveState.kind === "saving"
            ? t.autosave.saving
            : saveState.kind === "saved"
              ? fill(t.autosave.saved, {
                    time: formatTimeOnly(saveState.at.toISOString(), {
                        intl,
                        timezone,
                    }),
                })
              : saveState.kind === "failed"
                ? t.autosave.failed
                : t.autosave.idle

    const sideSelect = (
        value: string | null,
        onChange: (side: string | null) => void,
        label: string
    ) => (
        <Select
            value={value ?? NO_SIDE}
            onValueChange={(next) => onChange(next === NO_SIDE ? null : next)}
        >
            <SelectTrigger
                aria-label={label}
                size="sm"
                className="h-8 rounded-lg text-[13px]"
            >
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value={NO_SIDE}>{t.match.noSide}</SelectItem>
                {value && !sides.includes(value) ? (
                    <SelectItem value={value}>{value}</SelectItem>
                ) : null}
                {sides.map((side) => (
                    <SelectItem key={side} value={side}>
                        {sideLabel(side)}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    )

    const reviewRows = flowReviewRows(values, summaryContext, schedule)
    const squadPreset = props.squadPresets.find(
        (preset) => preset.id === values.squadPresetId
    )
    const announcementChannelText = values.announcementChannelId
        ? `#${channelName(values.announcementChannelId) ?? values.announcementChannelId}`
        : t.review.channelFallback
    const notice = isEdit
        ? fill(t.review.noticeEdit, { channel: announcementChannelText })
        : fill(t.review.notice, {
              channel: announcementChannelText,
              forum:
                  isMatch && values.createForumChannel
                      ? t.review.noticeForum
                      : "",
              preset:
                  isMatch && squadPreset
                      ? fill(t.review.noticePreset, { name: squadPreset.name })
                      : "",
          })

    const statusChip = (status: TemplateSignupStatus) => {
        const pressed = values.allowedSignupStatuses.length
            ? values.allowedSignupStatuses.includes(status)
            : true
        return (
            <button
                key={status}
                type="button"
                aria-pressed={pressed}
                onClick={() => {
                    const current = values.allowedSignupStatuses.length
                        ? values.allowedSignupStatuses
                        : FLOW_SIGNUP_STATUSES
                    const next = pressed
                        ? current.filter((entry) => entry !== status)
                        : [...current, status]
                    // Every status chosen is stored as "no restriction".
                    update({
                        allowedSignupStatuses:
                            next.length === FLOW_SIGNUP_STATUSES.length
                                ? []
                                : next,
                    })
                }}
                className={chipClass(pressed)}
            >
                {pressed ? (
                    <Check className="size-3" strokeWidth={3} aria-hidden />
                ) : null}
                {t.signups.statuses[status]}
            </button>
        )
    }

    const reminderHours = effectiveReminderHours(values.attendanceReminderHours)
    const reminderChip = (hours: number) => {
        const pressed = reminderHours.includes(hours)
        return (
            <button
                key={hours}
                type="button"
                aria-pressed={pressed}
                onClick={() =>
                    update({
                        attendanceReminderHours: pressed
                            ? reminderHours.filter((entry) => entry !== hours)
                            : ATTENDANCE_REMINDER_OFFSETS.filter(
                                  (offset) =>
                                      offset === hours ||
                                      reminderHours.includes(offset)
                              ),
                    })
                }
                className={chipClass(pressed)}
            >
                {pressed ? (
                    <Check className="size-3" strokeWidth={3} aria-hidden />
                ) : null}
                {fill(t.signups.attendanceHour, { hours })}
            </button>
        )
    }

    const timeRow = (label: string, value: string, first = false) => (
        <div
            className={cn(
                "flex justify-between gap-3 px-3.5 py-2.5 text-sm",
                !first && "border-border/50 border-t"
            )}
        >
            <span className="text-muted-foreground">{label}</span>
            <span className="text-right font-medium">{value}</span>
        </div>
    )

    const numberField = (
        id: string,
        label: string,
        value: number,
        unit: string,
        onChange: (value: number) => void,
        max: number,
        fractional = false
    ) => (
        <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor={id}>{label}</FieldLabel>
            <div className="flex items-center gap-2">
                <Input
                    id={id}
                    type="number"
                    inputMode={fractional ? "decimal" : "numeric"}
                    min={0}
                    max={max}
                    step={fractional ? "any" : 1}
                    value={fractional ? Math.round(value * 100) / 100 : value}
                    onChange={(event) => {
                        const next = Number(event.target.value)
                        if (
                            Number.isFinite(next) &&
                            (fractional || Number.isInteger(next)) &&
                            next >= 0 &&
                            next <= max
                        )
                            onChange(next)
                    }}
                    className="h-9 w-20"
                />
                <span className="text-muted-foreground text-xs leading-tight">
                    {unit}
                </span>
            </div>
        </div>
    )

    const channelSelect = (
        id: string,
        label: string,
        value: string,
        options: Array<{ id: string; name: string }>,
        onChange: (id: string) => void,
        noneLabel: string,
        disabled = false
    ) => (
        <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor={id}>{label}</FieldLabel>
            <Select
                value={value || NONE}
                disabled={disabled}
                onValueChange={(next) => onChange(next === NONE ? "" : next)}
            >
                <SelectTrigger id={id} className="h-9 w-full">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value={NONE}>{noneLabel}</SelectItem>
                    {value && !options.some((option) => option.id === value) ? (
                        <SelectItem value={value}>
                            <span className="text-muted-foreground">#</span>{" "}
                            {channelName(value) ?? value}
                        </SelectItem>
                    ) : null}
                    {options.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                            <span className="text-muted-foreground">#</span>{" "}
                            {option.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    )

    const switchRow = (
        id: string,
        label: string,
        checked: boolean,
        onChange: (checked: boolean) => void,
        hint?: React.ReactNode
    ) => (
        <div className="flex items-start gap-3">
            <Switch
                id={id}
                checked={checked}
                onCheckedChange={onChange}
                className="mt-0.5"
                aria-describedby={hint ? `${id}-hint` : undefined}
            />
            <span className="flex flex-col gap-0.5 leading-5">
                <Label htmlFor={id} className="text-sm font-normal">
                    {label}
                </Label>
                {hint ? <Hint id={`${id}-hint`}>{hint}</Hint> : null}
            </span>
        </div>
    )

    const listHref =
        edit?.listHref ??
        `/${locale}/dashboard/servers/${serverId}/${isMatch ? "matches" : "trainings"}`
    const listLabel = isMatch
        ? dictionary.matchDetail.backToMatches
        : t.edit.breadcrumbTrainings
    const footerSave = isEdit ? (
        <>
            <Button
                type="button"
                variant="outline"
                disabled={busy !== null}
                onClick={() => (unsaved ? setLeaveOpen(true) : leaveEdit())}
            >
                {t.edit.cancel}
            </Button>
            <Button
                type="button"
                disabled={busy !== null || !unsaved}
                onClick={() => void saveChanges()}
            >
                <Check aria-hidden />
                {t.edit.save}
            </Button>
        </>
    ) : null

    return (
        <div className="flex flex-col gap-6 px-4 pb-12 lg:px-6">
            {isEdit ? (
                <nav
                    aria-label={dictionary.matchDetail.breadcrumbLabel}
                    className="text-muted-foreground -mb-2 hidden min-w-0 items-center gap-1 text-sm"
                >
                    <Link href={listHref} className="hover:text-foreground">
                        {listLabel}
                    </Link>
                    <ChevronRight className="size-3.5 shrink-0" aria-hidden />
                    <Link
                        href={edit.detailHref}
                        className="hover:text-foreground truncate"
                    >
                        {edit.event.name}
                    </Link>
                    <ChevronRight className="size-3.5 shrink-0" aria-hidden />
                    <span aria-current="page" className="text-foreground">
                        {t.edit.breadcrumb}
                    </span>
                </nav>
            ) : null}
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl leading-8 font-semibold tracking-tight">
                        {isEdit
                            ? isMatch
                                ? t.edit.title
                                : t.edit.titleTraining
                            : isMatch
                              ? t.title
                              : t.titleTraining}
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        {isEdit ? t.edit.description : t.description}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    {isEdit ? (
                        <span
                            role="status"
                            aria-live="polite"
                            className={cn(
                                "text-[13px]",
                                unsaved
                                    ? "text-foreground font-medium"
                                    : "text-muted-foreground"
                            )}
                        >
                            {unsaved
                                ? fill(t.edit.unsaved, {
                                      count: changes.length,
                                  })
                                : t.edit.noChanges}
                        </span>
                    ) : (
                        <span
                            role="status"
                            aria-live="polite"
                            className={cn(
                                "text-[13px]",
                                saveState.kind === "failed"
                                    ? "text-destructive"
                                    : "text-muted-foreground"
                            )}
                        >
                            {autosaveText}
                        </span>
                    )}
                    {!isEdit && draftId ? (
                        <ConfirmActionDialog
                            open={deleteOpen}
                            onOpenChange={setDeleteOpen}
                            trigger={
                                <Button type="button" variant="ghost" size="sm">
                                    {t.deleteDraft}
                                </Button>
                            }
                            title={fill(t.deleteDraftTitle, {
                                name: name || t.untitled,
                            })}
                            description={t.deleteDraftDescription}
                            confirmLabel={t.deleteDraft}
                            cancelLabel={dictionary.common.cancel}
                            onConfirm={deleteDraft}
                        />
                    ) : null}
                    {isEdit ? (
                        <ConfirmActionDialog
                            open={leaveOpen}
                            onOpenChange={setLeaveOpen}
                            title={t.edit.leaveTitle}
                            description={t.edit.leaveDescription}
                            confirmLabel={t.edit.leaveConfirm}
                            cancelLabel={dictionary.common.cancel}
                            onConfirm={leaveEdit}
                        />
                    ) : null}
                </div>
            </div>

            <ol
                aria-label={t.steps.label}
                className="m-0 flex list-none flex-wrap gap-2 p-0"
            >
                {NEW_MATCH_STEPS.map((entry, index) => {
                    const current = entry === step
                    // In edit mode every step is filled in already.
                    const done = isEdit ? !current : index < stepIndex
                    return (
                        <li key={entry}>
                            <button
                                type="button"
                                aria-current={current ? "step" : undefined}
                                onClick={() => setStep(entry)}
                                className={cn(
                                    "inline-flex h-10 items-center gap-2 rounded-full border pr-3.5 pl-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
                                    current
                                        ? "border-primary bg-primary text-primary-foreground"
                                        : "border-border bg-background text-foreground hover:bg-muted"
                                )}
                            >
                                {done ? (
                                    <span className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-full">
                                        <Check
                                            className="size-3.5"
                                            strokeWidth={3}
                                            aria-label={t.steps.done}
                                        />
                                    </span>
                                ) : current ? (
                                    <span className="bg-background text-foreground flex size-7 items-center justify-center rounded-full text-[13px] font-semibold">
                                        {index + 1}
                                    </span>
                                ) : (
                                    <span className="border-border text-muted-foreground flex size-7 items-center justify-center rounded-full border text-[13px]">
                                        {index + 1}
                                    </span>
                                )}
                                {stepTitle(entry)}
                            </button>
                        </li>
                    )
                })}
            </ol>

            <div className="flex flex-wrap items-start gap-6">
                <section
                    aria-live="polite"
                    aria-labelledby="new-match-step"
                    className="bg-card text-card-foreground border-border flex min-w-0 flex-[999_1_440px] flex-col gap-[22px] rounded-[14px] border p-5 shadow-xs sm:p-7"
                >
                    {step === "match" ? (
                        <div className="flex flex-col gap-[22px]">
                            <h2
                                id="new-match-step"
                                className="text-lg leading-[26px] font-semibold"
                            >
                                {stepTitle("match")}
                            </h2>
                            {props.enabledGames.length > 1 ? (
                                <div className="flex flex-col gap-2">
                                    <FieldLabel id="nm-game">
                                        {t.match.game}
                                    </FieldLabel>
                                    <SegmentedControl
                                        label={t.match.game}
                                        value={values.gameId}
                                        onChange={changeGame}
                                        // A published match keeps its game.
                                        disabled={isEdit}
                                        options={props.enabledGames.map(
                                            (gameId) => ({
                                                value: gameId,
                                                label: GAME_LABELS[gameId],
                                            })
                                        )}
                                    />
                                </div>
                            ) : null}
                            {isEdit ? (
                                props.eventCategories.length ? (
                                    <div className="flex flex-col gap-2">
                                        <FieldLabel id="nm-category">
                                            {t.match.category}
                                        </FieldLabel>
                                        <div
                                            role="radiogroup"
                                            aria-labelledby="nm-category"
                                            className="grid grid-cols-[repeat(auto-fit,minmax(min(150px,100%),1fr))] gap-2"
                                        >
                                            {[
                                                {
                                                    id: "",
                                                    label: t.match.noCategory,
                                                    color: undefined as
                                                        string | undefined,
                                                },
                                                ...props.eventCategories,
                                            ].map((entry) => {
                                                const checked =
                                                    (values.matchType ?? "") ===
                                                    entry.id
                                                return (
                                                    <button
                                                        key={entry.id || NONE}
                                                        type="button"
                                                        role="radio"
                                                        aria-checked={checked}
                                                        onClick={() =>
                                                            update({
                                                                matchType:
                                                                    entry.id ||
                                                                    undefined,
                                                            })
                                                        }
                                                        className={cn(
                                                            "flex items-center gap-2 rounded-[10px] border p-3 text-left text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none",
                                                            checked
                                                                ? "border-foreground bg-muted/50"
                                                                : "border-border bg-background hover:bg-muted/40"
                                                        )}
                                                    >
                                                        {entry.color ? (
                                                            <span
                                                                aria-hidden
                                                                className="size-2.5 shrink-0 rounded-full"
                                                                style={{
                                                                    backgroundColor:
                                                                        entry.color,
                                                                }}
                                                            />
                                                        ) : null}
                                                        <span className="truncate">
                                                            {entry.label}
                                                        </span>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                ) : null
                            ) : (
                                <div className="flex flex-col gap-2">
                                    <FieldLabel id="nm-template">
                                        {t.match.template}
                                    </FieldLabel>
                                    {offeredTemplates.length ? (
                                        <div
                                            role="radiogroup"
                                            aria-labelledby="nm-template"
                                            className="grid grid-cols-[repeat(auto-fit,minmax(min(180px,100%),1fr))] gap-2"
                                        >
                                            {offeredTemplates.map((entry) => {
                                                const checked =
                                                    entry.id ===
                                                    values.templateId
                                                return (
                                                    <button
                                                        key={entry.id}
                                                        type="button"
                                                        role="radio"
                                                        aria-checked={checked}
                                                        onClick={() =>
                                                            pickTemplate(entry)
                                                        }
                                                        className={cn(
                                                            "flex flex-col items-start gap-0.5 rounded-[10px] border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none",
                                                            checked
                                                                ? "border-foreground bg-muted/50"
                                                                : "border-border bg-background hover:bg-muted/40"
                                                        )}
                                                    >
                                                        <span className="text-sm font-semibold">
                                                            {entry.name}
                                                        </span>
                                                        <span className="text-muted-foreground text-xs leading-4">
                                                            {entry.kind ===
                                                            "training"
                                                                ? t.match
                                                                      .templateTraining
                                                                : fill(
                                                                      t.match
                                                                          .templateRegistration,
                                                                      {
                                                                          hours: entry.registrationHoursBeforeMeeting,
                                                                      }
                                                                  )}
                                                        </span>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    ) : (
                                        <p className="text-muted-foreground text-sm">
                                            {t.match.noTemplates}{" "}
                                            <Link
                                                href={`/${locale}/dashboard/servers/${serverId}/settings/match-templates`}
                                                className="text-foreground underline underline-offset-[3px]"
                                            >
                                                {t.match.manageTemplates}
                                            </Link>
                                        </p>
                                    )}
                                </div>
                            )}
                            {isMatch && isActivityGame ? (
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="flex min-w-0 flex-col gap-1.5">
                                        <FieldLabel htmlFor="nm-activity">
                                            {activityLabel}
                                        </FieldLabel>
                                        <Select
                                            value={values.activity || NONE}
                                            onValueChange={(activity) =>
                                                update({
                                                    activity:
                                                        activity === NONE
                                                            ? ""
                                                            : activity,
                                                })
                                            }
                                        >
                                            <SelectTrigger
                                                id="nm-activity"
                                                className="h-9 w-full"
                                            >
                                                <SelectValue
                                                    placeholder={
                                                        t.match.chooseActivity
                                                    }
                                                />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value={NONE}>
                                                    {t.match.chooseActivity}
                                                </SelectItem>
                                                {(activityOptions.length
                                                    ? activityOptions
                                                    : [t.match.otherActivity]
                                                ).map((activity) => (
                                                    <SelectItem
                                                        key={activity}
                                                        value={activity}
                                                    >
                                                        {activity}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="flex min-w-0 flex-col gap-1.5">
                                        <FieldLabel htmlFor="nm-activity-target">
                                            {targetOptional
                                                ? `${targetLabel} (optional)`
                                                : targetLabel}
                                        </FieldLabel>
                                        <Input
                                            id="nm-activity-target"
                                            value={values.activityTarget}
                                            maxLength={120}
                                            placeholder={
                                                t.match.targetPlaceholder
                                            }
                                            onChange={(event) =>
                                                update({
                                                    activityTarget:
                                                        event.target.value,
                                                })
                                            }
                                        />
                                    </div>
                                </div>
                            ) : isMatch ? (
                                <div className="flex flex-col gap-2">
                                    <FieldLabel id="nm-teams">
                                        {t.match.teams}
                                    </FieldLabel>
                                    <div className="border-border flex flex-wrap items-center gap-2 rounded-[10px] border px-3 py-2.5">
                                        {ownDisplay?.logoUrl ? (
                                            <TeamLogo
                                                name={ownDisplay.name}
                                                shortCode={ownDisplay.shortCode}
                                                logoUrl={ownDisplay.logoUrl}
                                                className="size-8"
                                            />
                                        ) : (
                                            <span
                                                aria-hidden
                                                className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold"
                                            >
                                                {ownCode}
                                            </span>
                                        )}
                                        <span className="flex min-w-0 flex-[1_1_140px] flex-col leading-[18px]">
                                            <span className="truncate text-sm font-medium">
                                                {ownDisplay?.name ??
                                                    props.clan.name}
                                            </span>
                                            <span className="text-muted-foreground text-xs">
                                                {t.match.yourTeam}
                                            </span>
                                        </span>
                                        <span className="flex shrink-0 items-center gap-1">
                                            {sideSelect(
                                                values.ownSide,
                                                setOwnSide,
                                                t.match.yourSide
                                            )}
                                            {storedOwn
                                                ? refreshButton(
                                                      storedOwn.teamId
                                                  )
                                                : null}
                                        </span>
                                    </div>
                                    {teamGame ? (
                                        values.opponent ? (
                                            <div className="border-border flex flex-wrap items-center gap-2 rounded-[10px] border px-3 py-2.5">
                                                <TeamLogo
                                                    name={values.opponent.name}
                                                    shortCode={
                                                        values.opponent
                                                            .shortCode
                                                    }
                                                    logoUrl={
                                                        values.opponent.logoUrl
                                                    }
                                                    className="size-8"
                                                />
                                                <span className="flex min-w-0 flex-[1_1_140px] flex-col leading-[18px]">
                                                    <span className="truncate text-sm font-medium">
                                                        {values.opponent.name}
                                                    </span>
                                                    <span className="text-muted-foreground text-xs">
                                                        {
                                                            t.match
                                                                .opponentFromCatalogue
                                                        }
                                                    </span>
                                                </span>
                                                <span className="flex shrink-0 items-center gap-1">
                                                    {sideSelect(
                                                        values.opponentSide,
                                                        setOpponentSide,
                                                        t.match.opponentSide
                                                    )}
                                                    {refreshButton(
                                                        values.opponent.teamId
                                                    )}
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="size-8"
                                                        aria-label={
                                                            t.match
                                                                .changeOpponent
                                                        }
                                                        onClick={() =>
                                                            update({
                                                                opponent: null,
                                                                opponentSide:
                                                                    null,
                                                            })
                                                        }
                                                    >
                                                        <X className="size-4" />
                                                    </Button>
                                                </span>
                                            </div>
                                        ) : (
                                            <OpponentPicker
                                                serverId={serverId}
                                                gameId={teamGame}
                                                excludeIds={[
                                                    storedOwn?.teamId ??
                                                        ownTeam?.id,
                                                    values.extraTeam?.teamId,
                                                ].filter((id): id is string =>
                                                    Boolean(id)
                                                )}
                                                dictionary={dictionary}
                                                onPick={(team: TeamRecord) =>
                                                    update({
                                                        opponent: {
                                                            teamId: team.id,
                                                            name: team.name,
                                                            shortCode:
                                                                team.shortCode,
                                                            logoUrl:
                                                                team.logoUrl,
                                                        },
                                                    })
                                                }
                                            />
                                        )
                                    ) : null}
                                    {/* Wardogs: a third team (slot c) when editing. */}
                                    {isEdit &&
                                    teamGame === "wardogs" &&
                                    (values.opponent || values.extraTeam) ? (
                                        values.extraTeam ? (
                                            <div className="border-border flex flex-wrap items-center gap-2 rounded-[10px] border px-3 py-2.5">
                                                <TeamLogo
                                                    name={values.extraTeam.name}
                                                    shortCode={
                                                        values.extraTeam
                                                            .shortCode
                                                    }
                                                    logoUrl={
                                                        values.extraTeam.logoUrl
                                                    }
                                                    className="size-8"
                                                />
                                                <span className="flex min-w-0 flex-[1_1_140px] flex-col leading-[18px]">
                                                    <span className="truncate text-sm font-medium">
                                                        {values.extraTeam.name}
                                                    </span>
                                                    <span className="text-muted-foreground text-xs">
                                                        {t.match.otherTeam}
                                                    </span>
                                                </span>
                                                <span className="flex shrink-0 items-center gap-1">
                                                    {sideSelect(
                                                        values.extraSide,
                                                        (extraSide) =>
                                                            update({
                                                                extraSide,
                                                            }),
                                                        t.match.otherSide
                                                    )}
                                                    {refreshButton(
                                                        values.extraTeam.teamId
                                                    )}
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="size-8"
                                                        aria-label={
                                                            t.match.removeTeam
                                                        }
                                                        onClick={() =>
                                                            update({
                                                                extraTeam: null,
                                                                extraSide: null,
                                                            })
                                                        }
                                                    >
                                                        <X className="size-4" />
                                                    </Button>
                                                </span>
                                            </div>
                                        ) : (
                                            <OpponentPicker
                                                serverId={serverId}
                                                gameId="wardogs"
                                                label={t.match.addTeam}
                                                excludeIds={[
                                                    ...(storedOwn
                                                        ? [storedOwn.teamId]
                                                        : ownTeam
                                                          ? [ownTeam.id]
                                                          : []),
                                                    ...(values.opponent
                                                        ? [
                                                              values.opponent
                                                                  .teamId,
                                                          ]
                                                        : []),
                                                ]}
                                                dictionary={dictionary}
                                                onPick={(team: TeamRecord) =>
                                                    update({
                                                        extraTeam: {
                                                            teamId: team.id,
                                                            name: team.name,
                                                            shortCode:
                                                                team.shortCode,
                                                            logoUrl:
                                                                team.logoUrl,
                                                        },
                                                    })
                                                }
                                            />
                                        )
                                    ) : null}
                                    {teamGame ? (
                                        <span className="text-muted-foreground text-[13px]">
                                            {t.match.missingTeam}{" "}
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setRequestOpen(true)
                                                }
                                                className="text-foreground underline underline-offset-[3px]"
                                            >
                                                {t.match.requestTeam}
                                            </button>
                                        </span>
                                    ) : null}
                                    {teamGame ? (
                                        <TeamRequestDialog
                                            serverId={serverId}
                                            dictionary={dictionary}
                                            open={requestOpen}
                                            onOpenChange={setRequestOpen}
                                            target={{
                                                kind: "create",
                                                gameId: teamGame,
                                            }}
                                            onSubmitted={() => {
                                                setRequestOpen(false)
                                                toast.success(
                                                    t.match.requestSent
                                                )
                                            }}
                                        />
                                    ) : null}
                                </div>
                            ) : null}
                            {isMatch && !isActivityGame ? (
                                <div className="flex flex-col gap-2">
                                    <div
                                        className={cn(
                                            "grid gap-3",
                                            isEdit && modeOptions.length > 1
                                                ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4"
                                                : "grid-cols-[repeat(auto-fit,minmax(min(160px,100%),1fr))]"
                                        )}
                                    >
                                        <div className="flex min-w-0 flex-col gap-1.5">
                                            <FieldLabel htmlFor="nm-map">
                                                {t.match.map}
                                            </FieldLabel>
                                            <Select
                                                value={
                                                    values.mapId ||
                                                    (unknownStoredMap &&
                                                    !values.mapCleared
                                                        ? "__stored_map"
                                                        : NONE)
                                                }
                                                onValueChange={(mapId) =>
                                                    update({
                                                        mapId:
                                                            mapId === NONE
                                                                ? ""
                                                                : mapId,
                                                        mapCleared:
                                                            mapId === NONE,
                                                        timeOfDay:
                                                            mapId === NONE
                                                                ? ""
                                                                : defaultTimeOfDay(
                                                                      mapId,
                                                                      values.gameId
                                                                  ),
                                                        cap: "",
                                                        tacticalPlan: null,
                                                    })
                                                }
                                            >
                                                <SelectTrigger
                                                    id="nm-map"
                                                    className="h-9 w-full"
                                                >
                                                    <SelectValue
                                                        placeholder={
                                                            t.match.choose
                                                        }
                                                    />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {unknownStoredMap ? (
                                                        <SelectItem
                                                            value="__stored_map"
                                                            disabled
                                                        >
                                                            {unknownStoredMap}
                                                        </SelectItem>
                                                    ) : null}
                                                    <SelectItem value={NONE}>
                                                        {
                                                            tacticalPlanCopy(
                                                                locale
                                                            ).tbd
                                                        }
                                                    </SelectItem>
                                                    {maps.map((map) => (
                                                        <SelectItem
                                                            key={map.id}
                                                            value={map.id}
                                                        >
                                                            {map.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="flex min-w-0 flex-col gap-1.5">
                                            <FieldLabel htmlFor="nm-tod">
                                                {t.match.timeOfDay}
                                            </FieldLabel>
                                            <Select
                                                value={values.timeOfDay || NONE}
                                                disabled={!timeOptions.length}
                                                onValueChange={(timeOfDay) =>
                                                    update({
                                                        timeOfDay:
                                                            timeOfDay === NONE
                                                                ? ""
                                                                : timeOfDay,
                                                    })
                                                }
                                            >
                                                <SelectTrigger
                                                    id="nm-tod"
                                                    className="h-9 w-full"
                                                >
                                                    <SelectValue
                                                        placeholder={
                                                            t.match.choose
                                                        }
                                                    />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value={NONE}>
                                                        {
                                                            tacticalPlanCopy(
                                                                locale
                                                            ).tbd
                                                        }
                                                    </SelectItem>
                                                    {timeOptions.map(
                                                        (option) => (
                                                            <SelectItem
                                                                key={
                                                                    option.value
                                                                }
                                                                value={
                                                                    option.value
                                                                }
                                                            >
                                                                {timeLabel(
                                                                    option.value
                                                                )}
                                                            </SelectItem>
                                                        )
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        {isEdit && modeOptions.length > 1 ? (
                                            <div className="flex min-w-0 flex-col gap-1.5">
                                                <FieldLabel htmlFor="nm-mode">
                                                    {t.match.mode}
                                                </FieldLabel>
                                                <Select
                                                    value={
                                                        modeOptions.some(
                                                            (option) =>
                                                                option.value ===
                                                                values.mapMode
                                                        )
                                                            ? values.mapMode
                                                            : (modeOptions.find(
                                                                  (option) =>
                                                                      option.value ===
                                                                      "warfare"
                                                              )?.value ??
                                                              modeOptions[0]
                                                                  .value)
                                                    }
                                                    onValueChange={(mapMode) =>
                                                        update({ mapMode })
                                                    }
                                                >
                                                    <SelectTrigger
                                                        id="nm-mode"
                                                        className="h-9 w-full"
                                                    >
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {modeOptions.map(
                                                            (option) => (
                                                                <SelectItem
                                                                    key={
                                                                        option.value
                                                                    }
                                                                    value={
                                                                        option.value
                                                                    }
                                                                >
                                                                    {modeLabel(
                                                                        option.value
                                                                    )}
                                                                </SelectItem>
                                                            )
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        ) : null}
                                        {values.gameId !== "wardogs" ? (
                                            <div className="flex min-w-0 flex-col gap-1.5">
                                                <FieldLabel htmlFor="nm-cap">
                                                    {t.match.strongpoint}
                                                </FieldLabel>
                                                <Select
                                                    value={values.cap || NONE}
                                                    disabled={
                                                        !strongpoints.length &&
                                                        !values.cap
                                                    }
                                                    onValueChange={(cap) =>
                                                        update({
                                                            cap:
                                                                cap === NONE
                                                                    ? ""
                                                                    : cap,
                                                        })
                                                    }
                                                >
                                                    <SelectTrigger
                                                        id="nm-cap"
                                                        className="h-9 w-full"
                                                    >
                                                        <SelectValue
                                                            placeholder={
                                                                t.match.choose
                                                            }
                                                        />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem
                                                            value={NONE}
                                                        >
                                                            {t.match.choose}
                                                        </SelectItem>
                                                        {values.cap &&
                                                        !strongpoints.some(
                                                            (point) =>
                                                                point.label ===
                                                                values.cap
                                                        ) ? (
                                                            <SelectItem
                                                                value={
                                                                    values.cap
                                                                }
                                                            >
                                                                {values.cap}
                                                            </SelectItem>
                                                        ) : null}
                                                        {strongpoints.map(
                                                            (point) => (
                                                                <SelectItem
                                                                    key={
                                                                        point.id
                                                                    }
                                                                    value={
                                                                        point.label
                                                                    }
                                                                >
                                                                    {
                                                                        point.label
                                                                    }
                                                                </SelectItem>
                                                            )
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        ) : null}
                                    </div>
                                    {unknownStoredMap &&
                                    !values.mapId &&
                                    !values.mapCleared ? (
                                        <Hint>
                                            {fill(t.match.storedMap, {
                                                map: unknownStoredMap,
                                            })}
                                        </Hint>
                                    ) : null}
                                    {values.gameId === "wardogs" ? (
                                        <TacticalPlanEditor
                                            mapId={values.mapId}
                                            value={values.tacticalPlan ?? null}
                                            onChange={(tacticalPlan) =>
                                                update({ tacticalPlan })
                                            }
                                            locale={locale}
                                            timeLabel={timeLabel(
                                                values.timeOfDay
                                            )}
                                            teams={[
                                                {
                                                    slot: "a",
                                                    name:
                                                        ownDisplay?.name ??
                                                        props.clan.name,
                                                    side: values.ownSide,
                                                },
                                                ...(values.opponent
                                                    ? [
                                                          {
                                                              slot: "b" as const,
                                                              name: values
                                                                  .opponent
                                                                  .name,
                                                              side: values.opponentSide,
                                                          },
                                                      ]
                                                    : []),
                                                ...(values.extraTeam
                                                    ? [
                                                          {
                                                              slot: "c" as const,
                                                              name: values
                                                                  .extraTeam
                                                                  .name,
                                                              side: values.extraSide,
                                                          },
                                                      ]
                                                    : []),
                                            ]}
                                        />
                                    ) : null}
                                </div>
                            ) : null}
                            <div className="flex flex-col gap-1.5">
                                <FieldLabel htmlFor="nm-name">
                                    {t.match.name}
                                </FieldLabel>
                                <Input
                                    id="nm-name"
                                    value={name}
                                    maxLength={200}
                                    aria-describedby={
                                        isEdit ? undefined : "nm-name-hint"
                                    }
                                    onChange={(event) =>
                                        update({
                                            name: event.target.value,
                                            nameTouched: true,
                                        })
                                    }
                                    className="h-9"
                                />
                                {isEdit ? null : (
                                    <span
                                        id="nm-name-hint"
                                        className="text-muted-foreground text-xs"
                                    >
                                        {t.match.nameHint}
                                    </span>
                                )}
                            </div>
                            {isEdit ? (
                                <div className="border-border rounded-[10px] border">
                                    <button
                                        type="button"
                                        aria-expanded={moreOpen}
                                        aria-controls="nm-more"
                                        onClick={() =>
                                            setMoreOpen((open) => !open)
                                        }
                                        className="hover:bg-muted/40 flex w-full items-center gap-3 rounded-[10px] px-3.5 py-3 text-left focus-visible:ring-2 focus-visible:outline-none"
                                    >
                                        <span className="flex min-w-0 flex-1 flex-col leading-5">
                                            <span className="text-sm font-medium">
                                                {t.more.title}
                                            </span>
                                            <span className="text-muted-foreground truncate text-[13px]">
                                                {t.more.summary}
                                            </span>
                                        </span>
                                        <ChevronDown
                                            aria-hidden
                                            className={cn(
                                                "text-muted-foreground size-4 shrink-0 transition-transform",
                                                moreOpen && "rotate-180"
                                            )}
                                        />
                                    </button>
                                    {moreOpen ? (
                                        <div
                                            id="nm-more"
                                            className="border-border/60 flex flex-col gap-[18px] border-t px-3.5 py-4"
                                        >
                                            <div className="flex flex-col gap-1.5">
                                                <FieldLabel id="nm-description">
                                                    {t.more.description}
                                                </FieldLabel>
                                                <DiscordMarkdownTextarea
                                                    value={
                                                        values.description ?? ""
                                                    }
                                                    onChange={(description) =>
                                                        update({ description })
                                                    }
                                                    compactToolbar
                                                    preview="edit"
                                                    height={140}
                                                    rows={4}
                                                    maxLength={4000}
                                                    className="rounded-lg"
                                                />
                                                <Hint>
                                                    {t.more.descriptionHint}
                                                </Hint>
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <FieldLabel id="nm-notes">
                                                    {t.more.notes}
                                                </FieldLabel>
                                                <DiscordMarkdownTextarea
                                                    value={values.notes ?? ""}
                                                    onChange={(notes) =>
                                                        update({ notes })
                                                    }
                                                    compactToolbar
                                                    preview="edit"
                                                    height={140}
                                                    rows={4}
                                                    maxLength={4000}
                                                    className="rounded-lg"
                                                />
                                                <Hint>{t.more.notesHint}</Hint>
                                            </div>
                                            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-3">
                                                {(
                                                    [
                                                        [
                                                            "thumbnailUrl",
                                                            t.more.thumbnail,
                                                        ],
                                                        ...(isMatch
                                                            ? ([
                                                                  [
                                                                      "imageUrl",
                                                                      t.more
                                                                          .image,
                                                                  ],
                                                              ] as const)
                                                            : []),
                                                    ] as const
                                                ).map(([field, label]) => (
                                                    <div
                                                        key={field}
                                                        className="flex flex-col gap-1.5"
                                                    >
                                                        <AvatarPicker
                                                            value={
                                                                values[field] ??
                                                                ""
                                                            }
                                                            onChange={(url) =>
                                                                update({
                                                                    [field]:
                                                                        url ||
                                                                        undefined,
                                                                })
                                                            }
                                                            fallback={(
                                                                name || "EV"
                                                            )
                                                                .slice(0, 2)
                                                                .toUpperCase()}
                                                            label={label}
                                                            buttonLabel={
                                                                t.more.upload
                                                            }
                                                            disabled={
                                                                busy !== null
                                                            }
                                                            className="border-border rounded-[10px] border p-3"
                                                        />
                                                        {values[field] ? (
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    update({
                                                                        [field]:
                                                                            undefined,
                                                                    })
                                                                }
                                                                className="text-muted-foreground hover:text-foreground self-start text-xs underline underline-offset-[3px]"
                                                            >
                                                                {t.more.remove}
                                                            </button>
                                                        ) : null}
                                                    </div>
                                                ))}
                                            </div>
                                            {isMatch && hasStratmaps ? (
                                                <div className="flex flex-col gap-1.5">
                                                    <FieldLabel id="nm-stratmaps">
                                                        {t.more.stratmaps}
                                                    </FieldLabel>
                                                    {stratmapsOfGame.length ||
                                                    values.stratmapIds
                                                        .length ? (
                                                        <DiscordMultiEntitySelect
                                                            value={
                                                                values.stratmapIds
                                                            }
                                                            onChange={(
                                                                stratmapIds
                                                            ) =>
                                                                update({
                                                                    stratmapIds,
                                                                })
                                                            }
                                                            options={props.stratmaps
                                                                .filter(
                                                                    (
                                                                        stratmap
                                                                    ) =>
                                                                        stratmapsOfGame.includes(
                                                                            stratmap
                                                                        ) ||
                                                                        values.stratmapIds.includes(
                                                                            stratmap.id
                                                                        )
                                                                )
                                                                .map(
                                                                    (
                                                                        stratmap
                                                                    ) => ({
                                                                        id: stratmap.id,
                                                                        name: stratmap.title,
                                                                    })
                                                                )}
                                                            placeholder={
                                                                t.more
                                                                    .stratmapsPlaceholder
                                                            }
                                                        />
                                                    ) : (
                                                        <Hint>
                                                            {t.more.noStratmaps}
                                                        </Hint>
                                                    )}
                                                </div>
                                            ) : null}
                                        </div>
                                    ) : null}
                                </div>
                            ) : null}
                        </div>
                    ) : null}

                    {step === "time" ? (
                        <div className="flex flex-col gap-[22px]">
                            <h2
                                id="new-match-step"
                                className="text-lg leading-[26px] font-semibold"
                            >
                                {t.steps.time}
                            </h2>
                            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(180px,100%),1fr))] gap-3">
                                <div className="flex flex-col gap-1.5">
                                    <FieldLabel htmlFor="nm-date">
                                        {isMatch
                                            ? t.time.date
                                            : t.time.trainingDate}
                                    </FieldLabel>
                                    <Input
                                        id="nm-date"
                                        type="date"
                                        value={values.date}
                                        onChange={(event) =>
                                            update({ date: event.target.value })
                                        }
                                        className="h-9"
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <FieldLabel htmlFor="nm-time">
                                        {isMatch
                                            ? t.time.time
                                            : t.time.trainingTime}
                                    </FieldLabel>
                                    <Input
                                        id="nm-time"
                                        type="time"
                                        value={values.time}
                                        onChange={(event) =>
                                            update({ time: event.target.value })
                                        }
                                        className="h-9"
                                    />
                                </div>
                            </div>
                            <div className="border-border flex flex-col rounded-[10px] border">
                                <div className="border-border/60 flex flex-wrap items-center justify-between gap-3 border-b px-3.5 py-3">
                                    <span className="text-muted-foreground text-[13px] font-medium">
                                        {template
                                            ? fill(t.time.fromTemplate, {
                                                  name: template.name,
                                              })
                                            : isEdit
                                              ? t.edit.savedTimes
                                              : t.time.defaults}
                                    </span>
                                    <button
                                        type="button"
                                        aria-expanded={editingTimes}
                                        onClick={() =>
                                            setEditingTimes((open) => !open)
                                        }
                                        className="text-foreground h-7 rounded-md px-2.5 text-[13px] font-medium underline underline-offset-[3px]"
                                    >
                                        {editingTimes
                                            ? t.time.doneEditing
                                            : isMatch
                                              ? t.time.editHere
                                              : t.time.editHereTraining}
                                    </button>
                                </div>
                                {editingTimes ? (
                                    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(150px,100%),1fr))] gap-3 px-3.5 py-3">
                                        <div className="flex flex-col gap-1.5">
                                            <FieldLabel htmlFor="nm-ann">
                                                {t.time.announcement}
                                            </FieldLabel>
                                            <Select
                                                value={
                                                    values.announcementHours ===
                                                    null
                                                        ? "now"
                                                        : "before"
                                                }
                                                onValueChange={(mode) =>
                                                    update({
                                                        announcementHours:
                                                            mode === "now"
                                                                ? null
                                                                : (values.announcementHours ??
                                                                  72),
                                                    })
                                                }
                                            >
                                                <SelectTrigger
                                                    id="nm-ann"
                                                    className="h-9 w-full"
                                                >
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="now">
                                                        {t.time.immediately}
                                                    </SelectItem>
                                                    <SelectItem value="before">
                                                        {t.time.beforeStart}
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                            {values.announcementHours !==
                                            null ? (
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        type="number"
                                                        aria-label={
                                                            t.time
                                                                .hoursBeforeStart
                                                        }
                                                        min={0}
                                                        max={720}
                                                        step="any"
                                                        value={
                                                            Math.round(
                                                                values.announcementHours *
                                                                    100
                                                            ) / 100
                                                        }
                                                        onChange={(event) => {
                                                            const next = Number(
                                                                event.target
                                                                    .value
                                                            )
                                                            if (
                                                                Number.isFinite(
                                                                    next
                                                                ) &&
                                                                next >= 0 &&
                                                                next <= 720
                                                            )
                                                                update({
                                                                    announcementHours:
                                                                        next,
                                                                })
                                                        }}
                                                        className="h-9 w-20"
                                                    />
                                                    <span className="text-muted-foreground text-xs">
                                                        {
                                                            t.time
                                                                .hoursBeforeStart
                                                        }
                                                    </span>
                                                </div>
                                            ) : null}
                                        </div>
                                        {numberField(
                                            "nm-reg",
                                            t.time.registrationEnd,
                                            values.registrationHours,
                                            t.time.hoursBeforeMeeting,
                                            (registrationHours) =>
                                                update({ registrationHours }),
                                            720,
                                            true
                                        )}
                                        {isMatch
                                            ? numberField(
                                                  "nm-meet",
                                                  t.time.meeting,
                                                  values.meetingMinutes,
                                                  t.time.minutesBeforeStart,
                                                  (meetingMinutes) =>
                                                      update({
                                                          meetingMinutes,
                                                      }),
                                                  1440
                                              )
                                            : null}
                                        {numberField(
                                            "nm-dur",
                                            t.time.duration,
                                            values.durationMinutes,
                                            t.time.minutes,
                                            (durationMinutes) =>
                                                update({
                                                    durationMinutes: Math.max(
                                                        1,
                                                        durationMinutes
                                                    ),
                                                }),
                                            1440
                                        )}
                                    </div>
                                ) : null}
                                {timeRow(
                                    t.time.announcement,
                                    schedule?.registrationStart
                                        ? formatAt(
                                              schedule.registrationStart,
                                              summaryContext
                                          )
                                        : t.time.onPublish,
                                    editingTimes ? false : true
                                )}
                                {timeRow(
                                    t.time.registrationEnd,
                                    schedule
                                        ? formatAt(
                                              schedule.registrationEnd,
                                              summaryContext
                                          )
                                        : "—"
                                )}
                                {timeRow(
                                    t.time.meeting,
                                    schedule
                                        ? formatAt(
                                              schedule.meetingStart,
                                              summaryContext
                                          )
                                        : "—"
                                )}
                                {timeRow(
                                    isMatch ? t.time.end : t.time.endTraining,
                                    schedule
                                        ? formatAt(
                                              schedule.gameEnd,
                                              summaryContext
                                          )
                                        : "—"
                                )}
                            </div>
                            {isEdit && !scheduleIsCoherent(schedule) ? (
                                <Hint tone="warning">
                                    {t.edit.invalidSchedule}
                                </Hint>
                            ) : null}
                            {isMatch && edit?.series?.kind === "occurrence" ? (
                                <p className="bg-muted text-foreground/80 m-0 flex flex-wrap items-start gap-2.5 rounded-[10px] px-3.5 py-3 text-sm leading-5">
                                    <Repeat
                                        className="mt-px size-[18px] shrink-0"
                                        aria-hidden
                                    />
                                    <span className="min-w-0 flex-1">
                                        {t.edit.series}
                                    </span>
                                    {edit.series.sourceEditHref ? (
                                        <Link
                                            href={edit.series.sourceEditHref}
                                            className="text-foreground font-medium underline underline-offset-[3px]"
                                        >
                                            {t.edit.seriesEdit}
                                        </Link>
                                    ) : null}
                                </p>
                            ) : isMatch ? (
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-start gap-3">
                                        <Switch
                                            id="nm-repeat"
                                            checked={values.repeatWeekly}
                                            onCheckedChange={(repeatWeekly) =>
                                                update({ repeatWeekly })
                                            }
                                            className="mt-0.5"
                                        />
                                        <label
                                            htmlFor="nm-repeat"
                                            className="flex flex-col leading-5"
                                        >
                                            <span className="text-sm">
                                                {t.time.repeat}
                                            </span>
                                            <span className="text-muted-foreground text-[13px]">
                                                {isEdit && initial.repeatWeekly
                                                    ? t.edit.stopHint
                                                    : t.time.repeatHint}
                                            </span>
                                        </label>
                                    </div>
                                    {edit?.series?.kind === "source" ? (
                                        <p className="bg-muted text-foreground/80 m-0 flex gap-2.5 rounded-[10px] px-3.5 py-3 text-sm leading-5">
                                            <Repeat
                                                className="mt-px size-[18px] shrink-0"
                                                aria-hidden
                                            />
                                            {t.edit.seriesSource}
                                        </p>
                                    ) : null}
                                </div>
                            ) : null}
                        </div>
                    ) : null}

                    {step === "signups" ? (
                        <div className="flex flex-col gap-[22px]">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <h2
                                    id="new-match-step"
                                    className="text-lg leading-[26px] font-semibold"
                                >
                                    {t.steps.signups}
                                </h2>
                                {template ? (
                                    <span className="border-border text-muted-foreground rounded-md border px-2 py-0.5 text-xs font-medium">
                                        {fill(t.signups.fromTemplate, {
                                            name: template.name,
                                        })}
                                    </span>
                                ) : null}
                            </div>
                            {isMatch ? (
                                <>
                                    <div className="flex flex-col gap-2">
                                        <FieldLabel id="nm-who">
                                            {t.signups.who}
                                        </FieldLabel>
                                        <div
                                            role="group"
                                            aria-labelledby="nm-who"
                                            className="flex flex-wrap gap-2"
                                        >
                                            {FLOW_SIGNUP_STATUSES.map(
                                                statusChip
                                            )}
                                        </div>
                                    </div>
                                    {
                                        <div className="flex flex-col gap-1.5">
                                            <FieldLabel id="nm-required-match">
                                                {t.signups.requiredRoles}
                                            </FieldLabel>
                                            <DiscordMultiEntitySelect
                                                value={values.requiredRoleIds}
                                                onChange={(requiredRoleIds) =>
                                                    update({ requiredRoleIds })
                                                }
                                                options={metadata?.roles ?? []}
                                                placeholder={
                                                    t.signups.rolesPlaceholder
                                                }
                                            />
                                        </div>
                                    }
                                    {groupsOfGame.length ? (
                                        <div className="flex flex-col gap-2">
                                            <div className="border-border flex flex-col rounded-[10px] border">
                                                {groupsOfGame.map(
                                                    (group, index) => {
                                                        const offered =
                                                            values.signupGroupIds.includes(
                                                                group.id
                                                            )
                                                        return (
                                                            <div
                                                                key={group.id}
                                                                className={cn(
                                                                    "flex min-h-11 items-center justify-between gap-3 px-3.5 py-1.5 text-sm",
                                                                    index &&
                                                                        "border-border/50 border-t"
                                                                )}
                                                            >
                                                                <label className="flex min-w-0 items-center gap-2.5">
                                                                    <Checkbox
                                                                        checked={
                                                                            offered
                                                                        }
                                                                        onCheckedChange={(
                                                                            checked
                                                                        ) =>
                                                                            setGroupOffered(
                                                                                group.id,
                                                                                checked ===
                                                                                    true
                                                                            )
                                                                        }
                                                                        aria-label={fill(
                                                                            t
                                                                                .signups
                                                                                .groupOffered,
                                                                            {
                                                                                name: group.name,
                                                                            }
                                                                        )}
                                                                    />
                                                                    <span
                                                                        className={cn(
                                                                            "truncate",
                                                                            !offered &&
                                                                                "text-muted-foreground"
                                                                        )}
                                                                    >
                                                                        {
                                                                            group.name
                                                                        }
                                                                    </span>
                                                                </label>
                                                                {offered ? (
                                                                    <span className="flex items-center gap-1.5">
                                                                        {limitOf(
                                                                            group.id
                                                                        ) ? (
                                                                            <span
                                                                                aria-hidden
                                                                                className="text-muted-foreground text-[13px]"
                                                                            >
                                                                                max
                                                                            </span>
                                                                        ) : null}
                                                                        <Input
                                                                            type="number"
                                                                            inputMode="numeric"
                                                                            min={
                                                                                1
                                                                            }
                                                                            max={
                                                                                100
                                                                            }
                                                                            aria-label={fill(
                                                                                t
                                                                                    .signups
                                                                                    .capLabel,
                                                                                {
                                                                                    name: group.name,
                                                                                }
                                                                            )}
                                                                            placeholder={
                                                                                t
                                                                                    .signups
                                                                                    .capPlaceholder
                                                                            }
                                                                            value={
                                                                                limitOf(
                                                                                    group.id
                                                                                ) ??
                                                                                ""
                                                                            }
                                                                            onChange={(
                                                                                event
                                                                            ) =>
                                                                                setGroupLimit(
                                                                                    group.id,
                                                                                    event
                                                                                        .target
                                                                                        .value
                                                                                )
                                                                            }
                                                                            className="h-8 w-[104px] text-right text-[13px]"
                                                                        />
                                                                    </span>
                                                                ) : null}
                                                            </div>
                                                        )
                                                    }
                                                )}
                                                <div className="border-border/50 flex min-h-11 items-center justify-between gap-3 border-t px-3.5 py-1.5 text-sm">
                                                    <Label
                                                        htmlFor="nm-general"
                                                        className="text-sm font-normal"
                                                    >
                                                        {t.signups.general}
                                                    </Label>
                                                    <Switch
                                                        id="nm-general"
                                                        checked={
                                                            values.useGeneralSignup
                                                        }
                                                        onCheckedChange={(
                                                            useGeneralSignup
                                                        ) =>
                                                            update({
                                                                useGeneralSignup,
                                                            })
                                                        }
                                                    />
                                                </div>
                                            </div>
                                            <Hint>{t.signups.capHint}</Hint>
                                        </div>
                                    ) : (
                                        <p className="text-muted-foreground text-sm">
                                            {t.signups.noGroups}
                                        </p>
                                    )}
                                    {isEdit ? (
                                        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                                            <Label
                                                htmlFor="nm-reminder"
                                                className="text-muted-foreground font-normal"
                                            >
                                                {t.signups.reminder}
                                            </Label>
                                            <Select
                                                value={reminderAudience(
                                                    values.signupReminderStatuses
                                                )}
                                                onValueChange={(audience) =>
                                                    update({
                                                        signupReminderStatuses:
                                                            reminderStatusesFor(
                                                                audience as ReminderAudience
                                                            ),
                                                    })
                                                }
                                            >
                                                <SelectTrigger
                                                    id="nm-reminder"
                                                    size="sm"
                                                    className="h-8 min-w-[180px] rounded-lg text-[13px]"
                                                >
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {(
                                                        [
                                                            "off",
                                                            "member",
                                                            "memberRecruit",
                                                            "all",
                                                        ] as const
                                                    ).map((audience) => (
                                                        <SelectItem
                                                            key={audience}
                                                            value={audience}
                                                        >
                                                            {
                                                                t.signups
                                                                    .reminderOptions[
                                                                    audience
                                                                ]
                                                            }
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    ) : (
                                        <div className="flex flex-wrap justify-between gap-3 text-sm">
                                            <span className="text-muted-foreground">
                                                {t.signups.reminder}
                                            </span>
                                            <span className="font-medium">
                                                {reminderAudience(
                                                    values.signupReminderStatuses
                                                ) === "off"
                                                    ? t.signups.reminderOff
                                                    : fill(
                                                          t.signups.reminderOn,
                                                          {
                                                              audience:
                                                                  t.signups
                                                                      .audience[
                                                                      reminderAudience(
                                                                          values.signupReminderStatuses
                                                                      ) as
                                                                          | "member"
                                                                          | "memberRecruit"
                                                                          | "all"
                                                                  ],
                                                          }
                                                      )}
                                            </span>
                                        </div>
                                    )}
                                    {isEdit ? (
                                        <div className="flex flex-col gap-2">
                                            <FieldLabel id="nm-attendance">
                                                {t.signups.attendanceReminders}
                                            </FieldLabel>
                                            <div
                                                role="group"
                                                aria-labelledby="nm-attendance"
                                                aria-describedby="nm-attendance-hint"
                                                className="flex flex-wrap gap-2"
                                            >
                                                {ATTENDANCE_REMINDER_OFFSETS.map(
                                                    reminderChip
                                                )}
                                            </div>
                                            <Hint id="nm-attendance-hint">
                                                {t.signups.attendanceHint}{" "}
                                                {t.signups.attendanceEditHint}
                                            </Hint>
                                        </div>
                                    ) : null}
                                    {isEdit ? (
                                        <div className="flex flex-col gap-1.5">
                                            <FieldLabel htmlFor="nm-preset">
                                                {t.signups.squadPreset}
                                            </FieldLabel>
                                            <Select
                                                value={
                                                    values.squadPresetId || NONE
                                                }
                                                onValueChange={(presetId) =>
                                                    update({
                                                        squadPresetId:
                                                            presetId === NONE
                                                                ? undefined
                                                                : presetId,
                                                    })
                                                }
                                            >
                                                <SelectTrigger
                                                    id="nm-preset"
                                                    className="h-9 w-full"
                                                    aria-describedby="nm-preset-hint"
                                                >
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value={NONE}>
                                                        {
                                                            t.signups
                                                                .squadPresetNone
                                                        }
                                                    </SelectItem>
                                                    {values.squadPresetId &&
                                                    !squadPresetsOfGame.some(
                                                        (preset) =>
                                                            preset.id ===
                                                            values.squadPresetId
                                                    ) ? (
                                                        <SelectItem
                                                            value={
                                                                values.squadPresetId
                                                            }
                                                        >
                                                            {squadPreset?.name ??
                                                                values.squadPresetId}
                                                        </SelectItem>
                                                    ) : null}
                                                    {squadPresetsOfGame.map(
                                                        (preset) => (
                                                            <SelectItem
                                                                key={preset.id}
                                                                value={
                                                                    preset.id
                                                                }
                                                            >
                                                                {preset.name}
                                                            </SelectItem>
                                                        )
                                                    )}
                                                </SelectContent>
                                            </Select>
                                            <Hint id="nm-preset-hint">
                                                {edit.rosterExists
                                                    ? t.signups
                                                          .squadPresetRosterExists
                                                    : t.signups.squadPresetHint}
                                            </Hint>
                                        </div>
                                    ) : null}
                                </>
                            ) : (
                                <>
                                    <p className="text-muted-foreground text-sm">
                                        {t.signups.trainingNote}
                                    </p>
                                    {isEdit ? (
                                        <>
                                            <div className="flex flex-col gap-1.5">
                                                <FieldLabel id="nm-required">
                                                    {t.signups.requiredRoles}
                                                </FieldLabel>
                                                <DiscordMultiEntitySelect
                                                    value={
                                                        values.requiredRoleIds
                                                    }
                                                    onChange={(
                                                        requiredRoleIds
                                                    ) =>
                                                        update({
                                                            requiredRoleIds,
                                                        })
                                                    }
                                                    options={
                                                        metadata?.roles ?? []
                                                    }
                                                    placeholder={
                                                        t.signups
                                                            .rolesPlaceholder
                                                    }
                                                />
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <FieldLabel id="nm-reward">
                                                    {t.signups.rewardRoles}
                                                </FieldLabel>
                                                <DiscordMultiEntitySelect
                                                    value={values.rewardRoleIds}
                                                    onChange={(rewardRoleIds) =>
                                                        update({
                                                            rewardRoleIds,
                                                        })
                                                    }
                                                    options={
                                                        metadata?.roles ?? []
                                                    }
                                                    placeholder={
                                                        t.signups
                                                            .rolesPlaceholder
                                                    }
                                                />
                                            </div>
                                        </>
                                    ) : null}
                                </>
                            )}
                        </div>
                    ) : null}

                    {step === "discord" ? (
                        <div className="flex flex-col gap-[22px]">
                            <h2
                                id="new-match-step"
                                className="text-lg leading-[26px] font-semibold"
                            >
                                {t.steps.discord}
                            </h2>
                            <div className="flex flex-col gap-2">
                                <div className="grid grid-cols-[repeat(auto-fit,minmax(min(180px,100%),1fr))] gap-3">
                                    {channelSelect(
                                        "nm-ch",
                                        t.discord.announcement,
                                        values.announcementChannelId,
                                        textChannels,
                                        (announcementChannelId) =>
                                            update({ announcementChannelId }),
                                        t.discord.defaultChannel,
                                        isEdit
                                    )}
                                    {isMatch
                                        ? channelSelect(
                                              "nm-ch2",
                                              t.discord.roster,
                                              values.eventInfoChannelId,
                                              textChannels,
                                              (eventInfoChannelId) =>
                                                  update({
                                                      eventInfoChannelId,
                                                  }),
                                              t.discord.defaultChannel,
                                              isEdit
                                          )
                                        : null}
                                </div>
                                {isEdit ? (
                                    <Hint>{t.discord.channelsLocked}</Hint>
                                ) : null}
                            </div>
                            <div className="flex flex-col gap-2">
                                <FieldLabel id="nm-ping">
                                    {t.discord.ping}
                                </FieldLabel>
                                <SegmentedControl
                                    label={t.discord.ping}
                                    size="sm"
                                    value={values.pingMode}
                                    onChange={(pingMode) =>
                                        update({ pingMode })
                                    }
                                    options={[
                                        {
                                            value: "none",
                                            label: t.discord.pingNone,
                                        },
                                        {
                                            value: "clan",
                                            label: t.discord.pingClan,
                                        },
                                        {
                                            value: "roles",
                                            label: t.discord.pingRoles,
                                        },
                                    ]}
                                />
                                {values.pingMode === "roles" ? (
                                    <DiscordMultiEntitySelect
                                        value={values.pingRoleIds}
                                        onChange={(pingRoleIds) =>
                                            update({ pingRoleIds })
                                        }
                                        options={metadata?.roles ?? []}
                                        placeholder={t.discord.pingRolesLabel}
                                    />
                                ) : null}
                            </div>
                            <div className="flex flex-col gap-3">
                                {isMatch ? (
                                    isEdit ? (
                                        <div className="flex flex-col gap-2">
                                            {switchRow(
                                                "nm-forum",
                                                t.discord.forum,
                                                values.createForumChannel,
                                                (createForumChannel) =>
                                                    update({
                                                        createForumChannel,
                                                    })
                                            )}
                                            {values.createForumChannel ? (
                                                <div className="ml-12 flex flex-col gap-2">
                                                    {!props.forumCategoryConfigured ? (
                                                        <Hint tone="warning">
                                                            {
                                                                t.discord
                                                                    .forumMissing
                                                            }{" "}
                                                            <Link
                                                                href={`/${locale}/dashboard/servers/${serverId}/settings/channels`}
                                                                className="underline underline-offset-[3px]"
                                                            >
                                                                {
                                                                    t.discord
                                                                        .openChannelSettings
                                                                }
                                                            </Link>
                                                        </Hint>
                                                    ) : null}
                                                    <div className="flex flex-col gap-1.5">
                                                        <FieldLabel htmlFor="nm-topics">
                                                            {
                                                                t.discord
                                                                    .topicPreset
                                                            }
                                                        </FieldLabel>
                                                        <Select
                                                            value={
                                                                values.topicPresetId ||
                                                                NONE
                                                            }
                                                            onValueChange={(
                                                                presetId
                                                            ) =>
                                                                update({
                                                                    topicPresetId:
                                                                        presetId ===
                                                                        NONE
                                                                            ? undefined
                                                                            : presetId,
                                                                })
                                                            }
                                                        >
                                                            <SelectTrigger
                                                                id="nm-topics"
                                                                className="h-9 w-full"
                                                            >
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem
                                                                    value={NONE}
                                                                >
                                                                    {
                                                                        t
                                                                            .discord
                                                                            .topicPresetNone
                                                                    }
                                                                </SelectItem>
                                                                {props.topicPresets.map(
                                                                    (
                                                                        preset
                                                                    ) => (
                                                                        <SelectItem
                                                                            key={
                                                                                preset.id
                                                                            }
                                                                            value={
                                                                                preset.id
                                                                            }
                                                                        >
                                                                            {
                                                                                preset.name
                                                                            }
                                                                        </SelectItem>
                                                                    )
                                                                )}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                            ) : null}
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-3">
                                            <Switch
                                                id="nm-forum"
                                                checked={
                                                    values.createForumChannel
                                                }
                                                onCheckedChange={(
                                                    createForumChannel
                                                ) =>
                                                    update({
                                                        createForumChannel,
                                                    })
                                                }
                                            />
                                            <Label
                                                htmlFor="nm-forum"
                                                className="text-sm font-normal"
                                            >
                                                {t.discord.forum}
                                            </Label>
                                        </div>
                                    )
                                ) : null}
                                {isEdit ? (
                                    <div className="flex flex-col gap-2">
                                        {switchRow(
                                            "nm-voice",
                                            t.discord.voice,
                                            values.createSquadVoiceChannels,
                                            (createSquadVoiceChannels) =>
                                                update({
                                                    createSquadVoiceChannels,
                                                })
                                        )}
                                        {values.createSquadVoiceChannels ? (
                                            <div className="ml-12">
                                                {channelSelect(
                                                    "nm-voice-category",
                                                    t.discord.voiceCategory,
                                                    values.squadVoiceCategoryId ??
                                                        "",
                                                    categoryChannels,
                                                    (squadVoiceCategoryId) =>
                                                        update({
                                                            squadVoiceCategoryId:
                                                                squadVoiceCategoryId ||
                                                                undefined,
                                                        }),
                                                    t.discord
                                                        .voiceCategoryDefault
                                                )}
                                            </div>
                                        ) : null}
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3">
                                        <Switch
                                            id="nm-voice"
                                            checked={
                                                values.createSquadVoiceChannels
                                            }
                                            onCheckedChange={(
                                                createSquadVoiceChannels
                                            ) =>
                                                update({
                                                    createSquadVoiceChannels,
                                                })
                                            }
                                        />
                                        <Label
                                            htmlFor="nm-voice"
                                            className="text-sm font-normal"
                                        >
                                            {t.discord.voice}
                                        </Label>
                                    </div>
                                )}
                                {isEdit
                                    ? switchRow(
                                          "nm-roles",
                                          t.discord.participantRoles,
                                          values.createParticipantRoles ?? true,
                                          (createParticipantRoles) =>
                                              update({
                                                  createParticipantRoles,
                                              }),
                                          (values.createParticipantRoles ??
                                              true) ||
                                              !(
                                                  initial.createParticipantRoles ??
                                                  true
                                              )
                                              ? t.discord.participantRolesHint
                                              : t.discord
                                                    .participantRolesOffHint
                                      )
                                    : null}
                            </div>
                            {isEdit && isMatch ? (
                                <div className="flex flex-col gap-1.5">
                                    {channelSelect(
                                        "nm-meeting",
                                        t.discord.meetingChannel,
                                        values.meetingChannelId ?? "",
                                        voiceChannels,
                                        (meetingChannelId) =>
                                            update({
                                                meetingChannelId:
                                                    meetingChannelId ||
                                                    undefined,
                                            }),
                                        t.discord.meetingChannelDefault
                                    )}
                                    <Hint>{t.discord.meetingChannelHint}</Hint>
                                </div>
                            ) : null}
                            <div className="flex flex-col gap-1.5">
                                <FieldLabel htmlFor="nm-pass">
                                    {t.discord.serverAndPassword}
                                </FieldLabel>
                                <div className="flex flex-wrap gap-2">
                                    <Input
                                        aria-label={t.discord.server}
                                        placeholder={
                                            t.discord.serverPlaceholder
                                        }
                                        value={values.server}
                                        maxLength={200}
                                        onChange={(event) =>
                                            update({
                                                server: event.target.value,
                                            })
                                        }
                                        className="h-9 flex-[2_1_180px]"
                                    />
                                    <Input
                                        id="nm-pass"
                                        type="password"
                                        autoComplete="off"
                                        placeholder={t.discord.password}
                                        value={values.serverPassword}
                                        maxLength={200}
                                        onChange={(event) =>
                                            update({
                                                serverPassword:
                                                    event.target.value,
                                            })
                                        }
                                        className="h-9 flex-[1_1_120px]"
                                    />
                                </div>
                                <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
                                    <EyeOff className="size-3" aria-hidden />
                                    {t.discord.passwordHint}
                                </span>
                            </div>
                        </div>
                    ) : null}

                    {step === "review" ? (
                        <div className="flex flex-col gap-[18px]">
                            <h2
                                id="new-match-step"
                                className="text-lg leading-[26px] font-semibold"
                            >
                                {t.steps.review}
                            </h2>
                            <ul className="border-border m-0 flex list-none flex-col rounded-[10px] border p-0">
                                {reviewRows.map((row, index) => (
                                    <li
                                        key={row.step}
                                        className={cn(
                                            "flex items-start gap-2.5 px-3.5 py-3",
                                            index && "border-border/60 border-t"
                                        )}
                                    >
                                        <CircleCheck
                                            className="mt-px size-[18px] shrink-0 text-green-700 dark:text-green-500"
                                            role="img"
                                            aria-label={t.steps.done}
                                        />
                                        <span className="flex min-w-0 flex-1 flex-col leading-5">
                                            <span className="text-sm font-medium">
                                                {stepTitle(row.step)}
                                            </span>
                                            <span className="text-muted-foreground text-[13px] break-words">
                                                {row.text}
                                            </span>
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setStep(row.step)}
                                            className="text-foreground h-7 rounded-md px-2.5 text-[13px] font-medium underline underline-offset-[3px]"
                                        >
                                            {t.review.edit}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                            {isEdit ? (
                                <div className="flex flex-col gap-2">
                                    <h3 className="text-sm font-semibold">
                                        {t.review.changes}
                                    </h3>
                                    {changes.length ? (
                                        <ul className="border-border m-0 flex list-none flex-col rounded-[10px] border p-0">
                                            {changes.map((change, index) => (
                                                <li
                                                    key={change.key}
                                                    className={cn(
                                                        "flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-3.5 py-2.5 text-sm",
                                                        index &&
                                                            "border-border/60 border-t"
                                                    )}
                                                >
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setStep(change.step)
                                                        }
                                                        className="text-muted-foreground hover:text-foreground w-full text-left text-[13px] sm:w-44 sm:shrink-0"
                                                    >
                                                        {change.label}
                                                    </button>
                                                    <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 break-words">
                                                        <del className="text-muted-foreground decoration-muted-foreground/60">
                                                            {change.before}
                                                        </del>
                                                        <ArrowRight
                                                            aria-hidden
                                                            className="text-muted-foreground size-3.5 shrink-0 self-center"
                                                        />
                                                        <ins className="font-medium no-underline">
                                                            {change.after}
                                                        </ins>
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="border-border text-muted-foreground m-0 rounded-[10px] border border-dashed px-3.5 py-3 text-sm">
                                            {t.review.noChanges}
                                        </p>
                                    )}
                                </div>
                            ) : null}
                            <p className="bg-muted text-foreground/80 m-0 flex gap-2.5 rounded-[10px] px-3.5 py-3 text-sm leading-5">
                                <Info
                                    className="mt-px size-[18px] shrink-0"
                                    aria-hidden
                                />
                                {notice}
                            </p>
                        </div>
                    ) : null}

                    <div className="border-border/60 flex flex-wrap items-center justify-between gap-3 border-t pt-[18px]">
                        <div className="flex">
                            {stepIndex > 0 ? (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() =>
                                        setStep(NEW_MATCH_STEPS[stepIndex - 1])
                                    }
                                >
                                    <ArrowLeft aria-hidden />
                                    {t.back}
                                </Button>
                            ) : null}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {step !== "review" ? (
                                <Button
                                    type="button"
                                    variant={isEdit ? "outline" : "default"}
                                    onClick={() =>
                                        setStep(NEW_MATCH_STEPS[stepIndex + 1])
                                    }
                                >
                                    {t.next}
                                    <ArrowRight aria-hidden />
                                </Button>
                            ) : isEdit ? null : (
                                <>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        disabled={busy !== null}
                                        onClick={() => void saveAsDraft()}
                                    >
                                        {t.saveDraft}
                                    </Button>
                                    <Button
                                        type="button"
                                        disabled={busy !== null}
                                        onClick={() => void publish()}
                                    >
                                        <Send aria-hidden />
                                        {t.publish}
                                    </Button>
                                </>
                            )}
                            {footerSave}
                        </div>
                    </div>
                </section>

                <div className="flex max-w-[460px] min-w-0 flex-[1_1_360px] flex-col">
                    <NewMatchPreview
                        model={previewModel}
                        step={step}
                        dictionary={dictionary}
                        copy={props.previewCopy}
                    />
                    {step === "review" && values.tacticalPlan ? (
                        <div className="mt-4">
                            <TacticalPlanMap
                                plan={values.tacticalPlan}
                                locale={locale}
                                timeLabel={timeLabel(values.timeOfDay)}
                                teams={[
                                    {
                                        slot: "a",
                                        name:
                                            ownDisplay?.name ?? props.clan.name,
                                        side: values.ownSide,
                                    },
                                    ...(values.opponent
                                        ? [
                                              {
                                                  slot: "b" as const,
                                                  name: values.opponent.name,
                                                  side: values.opponentSide,
                                              },
                                          ]
                                        : []),
                                    ...(values.extraTeam
                                        ? [
                                              {
                                                  slot: "c" as const,
                                                  name: values.extraTeam.name,
                                                  side: values.extraSide,
                                              },
                                          ]
                                        : []),
                                ]}
                            />
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    )
}

function chipClass(pressed: boolean) {
    return cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
        pressed
            ? "border-foreground bg-muted text-foreground"
            : "border-border bg-background text-muted-foreground"
    )
}
