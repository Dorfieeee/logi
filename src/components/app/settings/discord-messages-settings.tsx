"use client"

import {
    Archive,
    Bell,
    BellRing,
    Bug,
    CalendarCheck,
    CalendarDays,
    CircleCheck,
    ClipboardList,
    Clock,
    Flag,
    GraduationCap,
    ListChecks,
    Medal,
    MessageCircle,
    MessagesSquare,
    Megaphone,
    MousePointerClick,
    Plus,
    Radio,
    Shield,
    SlidersHorizontal,
    SquareTerminal,
    Ticket,
    Trophy,
    UserCheck,
    UserPlus,
    Users,
    Volume2,
    BarChart3,
    ChevronRight,
    Info,
    Layers,
} from "lucide-react"
import { useCallback, useEffect, useId, useState, useTransition } from "react"
import type { LucideIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import Link from "next/link"

import {
    normalizeAccentColor,
    normalizeMessageStyle,
    type MessageIconDensity,
} from "@/domain/discord-messages/message-style"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    resolveMessageSettings,
    type MessageSettings,
} from "@/domain/discord-messages/notification-settings"
import {
    ROSTER_MESSAGE_VARIANTS,
    type RosterMessageVariant,
} from "@/domain/discord-messages/roster-message"
import type {
    SettingsPreviewClan,
    SettingsPreviewKind,
} from "@/domain/discord-messages/settings-previews"
import {
    clearableId,
    saveDiscordSettings,
} from "@/components/app/settings/save-discord-settings"
import {
    channelOptions,
    DiscordChannelSelect,
} from "@/components/app/discord-channel-select"
import { UnsavedChangesBar } from "@/components/app/settings/unsaved-changes-bar"
import { useDiscordMetadataState } from "@/hooks/use-discord-metadata"
import type { Dictionary } from "@/i18n/dictionaries"
import type { DiscordConfig } from "@/types/domain"
import type { GameId } from "@/domain/games/game"
import { Button } from "@/components/ui/button"

import type { PanelOverviewResponse } from "@/components/app/discord-panels/panels-api"
import { usePanelOverview } from "@/components/app/discord-panels/use-panel-overview"
import type { PanelListGroup } from "@/domain/discord-publications/panel-list"

import {
    MessageGroup,
    MessageRow,
    MessageTargetView,
    PreviewButton,
    RowChip,
    type MessageTarget,
} from "./messages/message-row"
import {
    messagesPanelRows,
    panelToggleAction,
    type MessagesPanelRow,
} from "./messages/panel-overview"
import {
    PreviewPanel,
    SettingsMessagePreview,
} from "./messages/message-preview-panel"
import { MessagesLook } from "./messages/messages-look"

const GAME_SHORT: Record<GameId, string> = {
    hell_let_loose: "HLL",
    hell_let_loose_vietnam: "HLL: Vietnam",
    wardogs: "Wardogs",
    world_of_warcraft_forever: "WoW:F",
}

type Draft = {
    /** As typed; saved only when it is a hex colour or blank. */
    accentColor: string
    iconDensity: MessageIconDensity
    errorsChannelId?: string
    settings: MessageSettings
    /** Panel switches by saved panel ID. */
    panels: Record<string, boolean>
}

function initialDraft(config: DiscordConfig | null): Draft {
    const style = normalizeMessageStyle(config?.messageStyle)
    return {
        accentColor: style.accentColor ?? "",
        iconDensity: style.iconDensity ?? "sparse",
        errorsChannelId: config?.errorsChannelId,
        settings: resolveMessageSettings(config),
        panels: {},
    }
}

/**
 * The panels of "Panely v Discordu" (P1) and the seed switch behind
 * "Ovládání serveru", for the "Panely" group (N1-28..36, N1-B08).
 */
export type Overview = {
    status: "loading" | "ready" | "failed"
    /** The P1 overview (`GET /api/servers/{serverId}/discord-panels`). */
    panels: PanelOverviewResponse | null
    seed: { configured: boolean; enabled: boolean } | null
}

/** Whether the seed plan is set up and switched on (`/discord-seed`). */
function useSeedSwitch(serverId: string, version: number) {
    const [seed, setSeed] = useState<Overview["seed"]>(null)
    useEffect(() => {
        let active = true
        void fetch(`/api/servers/${encodeURIComponent(serverId)}/discord-seed`)
            .then((response) => (response.ok ? response.json() : null))
            .catch(() => null)
            .then((body: unknown) => {
                if (!active) return
                const selected = (
                    body as {
                        selected?: {
                            configured?: boolean
                            settings?: { enabled?: boolean }
                        } | null
                    } | null
                )?.selected
                setSeed(
                    selected
                        ? {
                              configured: Boolean(selected.configured),
                              enabled: Boolean(selected.settings?.enabled),
                          }
                        : null
                )
            })
        return () => {
            active = false
        }
    }, [serverId, version])
    return seed
}

type MessagesSettingsProps = {
    serverId: string
    config: DiscordConfig | null
    enabledGames: readonly GameId[]
    siteUrl: string
    /** The clan's name, as the bot fills it into the default panel title. */
    clanName?: string
    hrefs: {
        channels: string
        matchTemplates: string
        commands: string
        membership: string
        tickets: string
        factionSigns: string
        league: string
        accountMessages: string
        /** "Panely v Discordu" (board P1), where every panel is edited. */
        panels: string
        /** "Seed serverů" (board P3), where the server control message is set. */
        seed: string
    }
    /** Event categories by ID, so the calendar row names them (N1-36). */
    categories?: ReadonlyArray<{ id: string; label: string }>
    /** Competition names for competition panels. */
    competitions?: ReadonlyArray<{ id: string; name: string }>
    dictionary: Dictionary
}

/**
 * "Zprávy a panely v Discordu" (board N1) with its live data: the server's
 * channels, the panels, their names and the seed control.
 */
export function DiscordMessagesSettings(props: MessagesSettingsProps) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const metadata = useDiscordMetadataState(props.serverId)
    // The same overview as "Panely v Discordu", read again every few seconds
    // so a chip turns from "Čeká na bota" to its result (N1-B08, P1-B09).
    const panels = usePanelOverview(props.serverId)
    const [seedVersion, setSeedVersion] = useState(0)
    const seed = useSeedSwitch(props.serverId, seedVersion)
    return (
        <DiscordMessagesSettingsView
            {...props}
            channels={metadata.metadata?.channels ?? []}
            channelsStatus={metadata.status}
            overview={{
                status: panels.status,
                panels: panels.overview,
                seed,
            }}
            refreshing={isPending}
            onSaved={() => startTransition(() => router.refresh())}
            onPanelsChanged={() => {
                void panels.refresh()
                setSeedVersion((value) => value + 1)
            }}
        />
    )
}

/**
 * The page without routing or fetching, so tests can render it: the look of
 * every bot message with a live preview, everything the bot sends with
 * where it goes, its switch and a rendered "Náhled", an overview of the
 * panels and the errors channel, all saved with one save bar. Channels
 * owned by another page show a lock and a link to it (N1-B04).
 */
export function DiscordMessagesSettingsView({
    serverId,
    config,
    enabledGames,
    siteUrl,
    clanName,
    hrefs,
    categories = [],
    competitions = [],
    dictionary,
    channels,
    channelsStatus,
    overview,
    refreshing = false,
    onSaved,
    onPanelsChanged,
}: MessagesSettingsProps & {
    channels: ReadonlyArray<{
        id: string
        name: string
        type: number
        parentId?: string
    }>
    channelsStatus: "loading" | "ready" | "failed"
    overview: Overview
    refreshing?: boolean
    onSaved(): void
    onPanelsChanged(): void
}) {
    const text = dictionary.settingsHub.messagesPage
    const ids = useId()
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState<Draft>(() => initialDraft(config))
    const [draft, setDraft] = useState<Draft>(saved)
    const [open, setOpen] = useState<string | null>(null)
    const metadata = { status: channelsStatus }
    const language = config?.defaultLanguage ?? "en"
    const timeZone = config?.timezone || "UTC"

    const accentColor = normalizeAccentColor(draft.accentColor.trim())
    const colorInvalid = Boolean(draft.accentColor.trim()) && !accentColor
    const style = {
        iconDensity: draft.iconDensity,
        ...(accentColor ? { accentColor } : {}),
    }
    const styleChanged =
        (accentColor ?? "") !==
            (normalizeAccentColor(saved.accentColor) ?? "") ||
        draft.iconDensity !== saved.iconDensity
    const changedSettings = (
        Object.keys(draft.settings) as Array<keyof MessageSettings>
    ).filter((key) => draft.settings[key] !== saved.settings[key])
    const errorsChanged =
        (draft.errorsChannelId || undefined) !==
        (saved.errorsChannelId || undefined)
    // Every panel of "Panely v Discordu" with its state, chip and switch.
    const panelRows = overview.panels
        ? messagesPanelRows({
              overview: overview.panels,
              dictionary,
              channels,
              categories,
              competitions,
              seed: overview.seed,
              calendarSetting: config?.calendarChannelId
                  ? {
                        channelId: config.calendarChannelId,
                        posted: Boolean(config.calendarMessageId),
                    }
                  : null,
              hrefs,
          })
        : []
    // A switch is on while its panel runs (not paused).
    const savedEnabled = new Map<string, boolean>(
        panelRows.flatMap((row): Array<[string, boolean]> =>
            row.panelId && row.toggleable ? [[row.panelId, row.enabled]] : []
        )
    )
    const changedPanels = Object.entries(draft.panels).filter(
        ([id, enabled]) => savedEnabled.get(id) !== enabled
    )
    const changes =
        (accentColor ?? "") !== (normalizeAccentColor(saved.accentColor) ?? "")
            ? 1
            : 0
    const count =
        changes +
        (draft.iconDensity !== saved.iconDensity ? 1 : 0) +
        changedSettings.length +
        (errorsChanged ? 1 : 0) +
        changedPanels.length

    function setSetting<K extends keyof MessageSettings>(
        key: K,
        value: MessageSettings[K]
    ) {
        setDraft((current) => ({
            ...current,
            settings: { ...current.settings, [key]: value },
        }))
    }

    const togglePreview = useCallback(
        (key: string) => setOpen((current) => (current === key ? null : key)),
        []
    )

    async function save() {
        if (colorInvalid) {
            toast.error(text.clanColorInvalid)
            return
        }
        setSaving(true)
        try {
            const settingsChanged =
                styleChanged || errorsChanged || changedSettings.length > 0
            // Only panel switches changed: the settings route is not needed,
            // so a Discord outage there never blocks a pause or resume.
            const result = !settingsChanged
                ? ({ ok: true } as const)
                : await saveDiscordSettings(serverId, {
                      ...(styleChanged
                          ? {
                                messageStyle: {
                                    accentColor: accentColor ?? null,
                                    iconDensity: draft.iconDensity,
                                },
                            }
                          : {}),
                      ...(errorsChanged
                          ? {
                                errorsChannelId: clearableId(
                                    draft.errorsChannelId
                                ),
                            }
                          : {}),
                      ...(changedSettings.length
                          ? {
                                messageSettings: Object.fromEntries(
                                    changedSettings.map((key) => [
                                        key,
                                        draft.settings[key],
                                    ])
                                ),
                            }
                          : {}),
                  })
            if (!result.ok) {
                toast.error(
                    result.error ??
                        dictionary.serverSettings.discordSettingsSaveError
                )
                return
            }
            // A panel switch is "Pozastavit" / "Spustit" of "Panely v Discordu".
            for (const [id, enabled] of changedPanels) {
                const response = await fetch(
                    `/api/servers/${encodeURIComponent(serverId)}/discord-panels/${encodeURIComponent(id)}/actions`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            action: panelToggleAction(enabled),
                        }),
                    }
                ).catch(() => null)
                if (!response?.ok) {
                    toast.error(
                        dictionary.serverSettings.discordSettingsSaveError
                    )
                    return
                }
            }
            const next = {
                ...draft,
                accentColor: accentColor ?? "",
                panels: {},
            }
            setSaved(next)
            setDraft(next)
            if (changedPanels.length) onPanelsChanged()
            toast.success(dictionary.serverSettings.discordSettingsSaved)
            onSaved()
        } finally {
            setSaving(false)
        }
    }

    // --- Targets ------------------------------------------------------------

    const channelName = (id: string | undefined) => {
        if (!id) return undefined
        return (
            channels.find((channel) => channel.id === id)?.name ??
            text.channelUnknown
        )
    }
    const from = (label: string, href: string) => ({
        prefix: text.fromPage,
        label,
        href,
    })
    /** A clan-wide channel and each game's own one, owned by Kanály a jazyk. */
    function routed(
        field:
            | "announcementsChannelId"
            | "eventInfoChannelId"
            | "forumCategoryId"
            | "meetingChannelId",
        kind: "channel" | "category" | "voice"
    ): MessageTarget {
        const line = (id: string | undefined, game?: GameId) => {
            const name = channelName(id)
            return {
                text: name
                    ? kind === "category"
                        ? text.category.replace("{name}", name)
                        : name
                    : text.notSet,
                kind: name
                    ? kind === "voice"
                        ? ("voice" as const)
                        : kind === "channel"
                          ? ("channel" as const)
                          : ("plain" as const)
                    : ("plain" as const),
                game,
            }
        }
        return {
            lines: [
                line(config?.[field]),
                ...enabledGames.flatMap((game) => {
                    const own = config?.gameOverrides?.[game]?.[field]
                    return own ? [line(own, game)] : []
                }),
            ],
            from: from(text.pages.channels, hrefs.channels),
        }
    }
    const plain = (value: string): MessageTarget => ({
        lines: [{ text: value, kind: "plain" }],
    })
    /** A channel owned by another page; `format` writes it as "vlákna pod # x". */
    const owned = (
        id: string | undefined,
        page: string,
        href: string,
        format?: (name: string) => string
    ): MessageTarget => {
        const name = channelName(id)
        return {
            lines: [
                !name
                    ? { text: text.notSet, kind: "plain" }
                    : format
                      ? { text: format(name), kind: "plain" }
                      : { text: name, kind: "channel" },
            ],
            from: from(page, href),
        }
    }

    // --- Rows ---------------------------------------------------------------

    // The clan's own recruitment and ticket panels in their previews (N1-B07).
    const membership = config?.membershipSettings
    const ticketSettings = config?.ticketSettings
    const previewClan: SettingsPreviewClan = {
        membership: membership?.categories?.length
            ? {
                  title: membership.panelTitle,
                  text: membership.panelDescription,
                  ...(clanName ? { clanName } : {}),
                  imageUrl: membership.panelImageUrl ?? null,
                  accentColor:
                      normalizeAccentColor(membership.panelAccentColor) ?? null,
                  categories: membership.categories,
                  form: membership.applicationForm,
                  webFormUrl:
                      membership.webFormEnabled && config?.guildId
                          ? `${siteUrl.replace(/\/+$/, "")}/${language}/apply/${config.guildId}`
                          : null,
              }
            : null,
        tickets: ticketSettings?.categories?.length
            ? {
                  title: ticketSettings.panelTitle,
                  description: ticketSettings.panelDescription,
                  imageUrl: ticketSettings.panelImageUrl,
                  accentColor:
                      normalizeAccentColor(ticketSettings.panelAccentColor) ??
                      null,
                  categories: ticketSettings.categories,
              }
            : null,
    }
    const previewProps = {
        language,
        style,
        rosterVariant: draft.settings.rosterMessageVariant,
        timeZone,
        siteUrl,
        clan: previewClan,
        dictionary,
    }
    const previewOf = (
        key: SettingsPreviewKind,
        title: string,
        options: { panelTitle?: string; aside?: React.ReactNode } = {}
    ) => ({
        action: (
            <PreviewButton
                open={open === key}
                onClick={() => togglePreview(key)}
                controls={`${ids}-preview-${key}`}
                previewLabel={text.preview}
                closeLabel={text.close}
            />
        ),
        children:
            open === key ? (
                <PreviewPanel
                    id={`${ids}-preview-${key}`}
                    label={text.previewRegion.replace("{message}", title)}
                    title={options.panelTitle}
                    aside={options.aside}
                >
                    <SettingsMessagePreview kind={key} {...previewProps} />
                </PreviewPanel>
            ) : null,
    })
    const settingToggle = (key: keyof MessageSettings, label: string) => {
        const value = draft.settings[key]
        return typeof value === "boolean"
            ? {
                  checked: value,
                  onChange: (checked: boolean) =>
                      setSetting(key, checked as never),
                  label,
              }
            : undefined
    }
    const row = (input: {
        key: SettingsPreviewKind
        icon: LucideIcon
        title: string
        detail: string
        target?: MessageTarget
        chips?: React.ReactNode
        toggle?: ReturnType<typeof settingToggle>
        extra?: React.ReactNode
        panelTitle?: string
        aside?: React.ReactNode
    }) => {
        const preview = previewOf(input.key, input.title, input)
        return (
            <MessageRow
                key={input.key}
                icon={input.icon}
                title={input.title}
                chips={input.chips}
                detail={input.detail}
                extra={input.extra}
                target={
                    input.target ? (
                        <MessageTargetView target={input.target} />
                    ) : undefined
                }
                toggle={input.toggle}
                action={preview.action}
            >
                {preview.children}
            </MessageRow>
        )
    }

    const rows = text.rows
    const variantOther = ROSTER_MESSAGE_VARIANTS.find(
        (variant) => variant !== draft.settings.rosterMessageVariant
    )!
    // "Nahlásit hráče" goes to the ticket category the live panels use.
    const reportCategoryId = (overview.panels?.panels ?? [])
        .map((panel) => panel.settings.reportCategoryId)
        .find((id): id is string => Boolean(id))
    const reportCategory = config?.ticketSettings?.enabled
        ? (config.ticketSettings.categories ?? []).find(
              (category) => category.id === reportCategoryId
          )
        : undefined

    return (
        <div className="space-y-6">
            <header className="space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight">
                    {text.title}
                </h1>
                <p className="text-muted-foreground text-sm">
                    {text.description}
                </p>
            </header>
            <MessagesLook
                accentColor={draft.accentColor}
                iconDensity={draft.iconDensity}
                onChange={(patch) =>
                    setDraft((current) => ({ ...current, ...patch }))
                }
                language={language}
                timeZone={timeZone}
                siteUrl={siteUrl}
                hrefs={{
                    channels: hrefs.channels,
                    factionSigns: hrefs.factionSigns,
                }}
                dictionary={dictionary}
            />
            <section
                aria-labelledby={`${ids}-list`}
                className="bg-card overflow-hidden rounded-2xl border"
            >
                <div className="space-y-1.5 px-4 py-4 sm:px-6">
                    <h2 id={`${ids}-list`} className="text-base font-semibold">
                        {text.listTitle}
                    </h2>
                    <p className="text-muted-foreground flex items-start gap-1.5 text-[13px] leading-5">
                        <Info
                            className="mt-0.5 size-3.5 shrink-0"
                            aria-hidden="true"
                        />
                        {text.listIntro}
                    </p>
                </div>
                <ul className="divide-y">
                    <MessageGroup title={text.groups.matches}>
                        {row({
                            key: "announcement",
                            icon: Megaphone,
                            title: rows.announcement.title,
                            detail: rows.announcement.detail,
                            target: routed("announcementsChannelId", "channel"),
                        })}
                        {row({
                            key: "roster",
                            icon: Users,
                            title: rows.roster.title,
                            detail: rows.roster.detail,
                            target: routed("eventInfoChannelId", "channel"),
                            extra: (
                                <div className="space-y-1">
                                    <div className="flex flex-wrap items-center gap-2 text-[13px]">
                                        <span id={`${ids}-variant`}>
                                            {rows.roster.variantLabel}
                                        </span>
                                        <Select
                                            value={
                                                draft.settings
                                                    .rosterMessageVariant
                                            }
                                            onValueChange={(value) =>
                                                setSetting(
                                                    "rosterMessageVariant",
                                                    value as RosterMessageVariant
                                                )
                                            }
                                        >
                                            <SelectTrigger
                                                size="sm"
                                                aria-labelledby={`${ids}-variant`}
                                                className="h-8 w-auto rounded-lg"
                                            >
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {ROSTER_MESSAGE_VARIANTS.map(
                                                    (variant) => (
                                                        <SelectItem
                                                            key={variant}
                                                            value={variant}
                                                        >
                                                            {
                                                                rows.roster
                                                                    .variants[
                                                                    variant
                                                                ]
                                                            }
                                                        </SelectItem>
                                                    )
                                                )}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <p className="text-muted-foreground text-xs">
                                        {rows.roster.variantNote.replace(
                                            "{other}",
                                            rows.roster.variants[variantOther]
                                        )}
                                    </p>
                                </div>
                            ),
                        })}
                        {row({
                            key: "rosterChanges",
                            icon: ListChecks,
                            title: rows.rosterChanges.title,
                            detail: rows.rosterChanges.detail,
                            target: plain(rows.rosterChanges.target),
                            toggle: settingToggle(
                                "rosterChangesPost",
                                rows.rosterChanges.switchLabel
                            ),
                        })}
                        {row({
                            key: "forum",
                            icon: MessagesSquare,
                            title: rows.forum.title,
                            detail: rows.forum.detail,
                            target: routed("forumCategoryId", "category"),
                        })}
                        {row({
                            key: "debrief",
                            icon: ClipboardList,
                            title: rows.debrief.title,
                            detail: rows.debrief.detail,
                            target: plain(rows.debrief.target),
                            toggle: settingToggle(
                                "debriefPost",
                                rows.debrief.switchLabel
                            ),
                        })}
                        {row({
                            key: "attendanceNotice",
                            icon: Clock,
                            title: rows.notices.title,
                            chips: <RowChip tone="new">{text.newChip}</RowChip>,
                            detail: rows.notices.detail,
                            target: plain(rows.notices.target),
                            toggle: settingToggle(
                                "attendanceNoticesInThread",
                                rows.notices.switchLabel
                            ),
                        })}
                        {row({
                            key: "scheduledEvent",
                            icon: CalendarCheck,
                            title: rows.scheduledEvent.title,
                            detail: rows.scheduledEvent.detail,
                            target: routed("meetingChannelId", "voice"),
                            toggle: settingToggle(
                                "scheduledEvent",
                                rows.scheduledEvent.switchLabel
                            ),
                        })}
                        <MessageRow
                            icon={Volume2}
                            title={rows.squadRoles.title}
                            detail={rows.squadRoles.detail}
                            target={
                                <MessageTargetView
                                    target={{
                                        lines: [
                                            {
                                                text: channelName(
                                                    config?.squadVoiceCategoryId
                                                )
                                                    ? text.category.replace(
                                                          "{name}",
                                                          channelName(
                                                              config?.squadVoiceCategoryId
                                                          )!
                                                      )
                                                    : text.notSet,
                                                kind: "plain",
                                            },
                                        ],
                                        from: from(
                                            text.pages.channels,
                                            hrefs.channels
                                        ),
                                    }}
                                />
                            }
                        />
                    </MessageGroup>
                    <MessageGroup
                        title={text.groups.direct}
                        note={text.groups.directNote}
                    >
                        {row({
                            key: "signupReminder",
                            icon: Bell,
                            title: rows.signupReminder.title,
                            detail: rows.signupReminder.detail,
                            target: {
                                ...plain(rows.signupReminder.target),
                                from: from(
                                    text.pages.matchTemplates,
                                    hrefs.matchTemplates
                                ),
                            },
                        })}
                        {row({
                            key: "attendanceReminder",
                            icon: BellRing,
                            title: rows.attendanceReminder.title,
                            detail: rows.attendanceReminder.detail,
                            target: {
                                ...plain(rows.attendanceReminder.target),
                                from: from(
                                    text.pages.matchTemplates,
                                    hrefs.matchTemplates
                                ),
                            },
                        })}
                        {row({
                            key: "matchRecap",
                            icon: BarChart3,
                            title: rows.recap.title,
                            detail: rows.recap.detail,
                            target: plain(rows.recap.target),
                            toggle: settingToggle(
                                "matchRecapDm",
                                rows.recap.switchLabel
                            ),
                            panelTitle: rows.recap.previewTitle,
                            aside: (
                                <div className="space-y-2">
                                    <h4 className="text-sm font-semibold">
                                        {rows.recap.whoTitle}
                                    </h4>
                                    <p className="text-muted-foreground">
                                        {rows.recap.who}
                                    </p>
                                    <p className="text-muted-foreground">
                                        {rows.recap.whoOff.split("{link}")[0]}
                                        <Link
                                            href={hrefs.accountMessages}
                                            className="text-foreground underline underline-offset-3"
                                        >
                                            {rows.recap.whoLink}
                                        </Link>
                                        {rows.recap.whoOff.split("{link}")[1]}
                                    </p>
                                </div>
                            ),
                        })}
                        {row({
                            key: "trainingResult",
                            icon: GraduationCap,
                            title: rows.trainingResult.title,
                            detail: rows.trainingResult.detail,
                            target: plain(rows.trainingResult.target),
                            toggle: settingToggle(
                                "trainingResultDm",
                                rows.trainingResult.switchLabel
                            ),
                        })}
                        {row({
                            key: "rosterChangeDm",
                            icon: SlidersHorizontal,
                            title: rows.rosterChangeDm.title,
                            detail: rows.rosterChangeDm.detail,
                            target: plain(rows.rosterChangeDm.target),
                            toggle: settingToggle(
                                "rosterChangesDm",
                                rows.rosterChangeDm.switchLabel
                            ),
                        })}
                        {row({
                            key: "teamRequest",
                            icon: CircleCheck,
                            title: rows.teamRequest.title,
                            detail: rows.teamRequest.detail,
                            target: plain(rows.teamRequest.target),
                        })}
                        {row({
                            key: "buttonReplies",
                            icon: MousePointerClick,
                            title: rows.buttonReplies.title,
                            detail: rows.buttonReplies.detail,
                            target: plain(rows.buttonReplies.target),
                        })}
                        <MessageRow
                            icon={SquareTerminal}
                            title={rows.commandReplies.title}
                            detail={rows.commandReplies.detail}
                            target={
                                <MessageTargetView
                                    target={owned(
                                        config?.statsSettings
                                            ?.defaultShareChannelId,
                                        text.pages.commands,
                                        hrefs.commands
                                    )}
                                />
                            }
                            action={
                                <Button
                                    asChild
                                    variant="outline"
                                    size="sm"
                                    className="rounded-lg"
                                >
                                    <Link href={hrefs.commands}>
                                        {text.pages.commands}
                                        <ChevronRight
                                            className="size-3.5"
                                            aria-hidden="true"
                                        />
                                    </Link>
                                </Button>
                            }
                        />
                    </MessageGroup>
                    <MessageGroup title={text.groups.panels}>
                        <li
                            id={`${ids}-panels`}
                            className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6"
                        >
                            <p className="text-muted-foreground flex items-start gap-1.5 text-[13px] leading-5">
                                <Info
                                    className="mt-0.5 size-3.5 shrink-0"
                                    aria-hidden="true"
                                />
                                <span>
                                    {text.panels.intro.split("{link}")[0]}
                                    <Link
                                        href={hrefs.panels}
                                        className="text-foreground underline underline-offset-3"
                                    >
                                        {text.pages.panels}
                                    </Link>
                                    {text.panels.intro.split("{link}")[1]}
                                </span>
                            </p>
                            <Button
                                asChild
                                variant="outline"
                                size="sm"
                                className="rounded-lg"
                            >
                                <Link href={`${hrefs.panels}/new`}>
                                    <Plus
                                        className="size-3.5"
                                        aria-hidden="true"
                                    />
                                    {text.panels.add}
                                </Link>
                            </Button>
                        </li>
                        {overview.status === "loading" ? (
                            <li
                                role="status"
                                className="text-muted-foreground px-4 py-3 text-sm sm:px-6"
                            >
                                {text.panels.loading}
                            </li>
                        ) : overview.status === "failed" ? (
                            <li
                                role="alert"
                                className="text-muted-foreground px-4 py-3 text-sm sm:px-6"
                            >
                                {text.panels.unavailable}
                            </li>
                        ) : null}
                        {panelRows.map((item) => (
                            <PanelRow
                                key={item.key}
                                item={item}
                                enabled={
                                    item.panelId && item.panelId in draft.panels
                                        ? draft.panels[item.panelId]!
                                        : item.enabled
                                }
                                onToggle={(enabled) =>
                                    item.panelId &&
                                    setDraft((current) => ({
                                        ...current,
                                        panels: {
                                            ...current.panels,
                                            [item.panelId!]: enabled,
                                        },
                                    }))
                                }
                                channelName={channelName}
                                dictionary={dictionary}
                            />
                        ))}
                    </MessageGroup>
                    <MessageGroup title={text.groups.membership}>
                        {row({
                            key: "recruitmentPanel",
                            icon: UserPlus,
                            title: rows.recruitmentPanel.title,
                            detail: rows.recruitmentPanel.detail,
                            target: owned(
                                config?.membershipSettings?.submitChannelId,
                                text.pages.membership,
                                hrefs.membership
                            ),
                        })}
                        {row({
                            key: "application",
                            icon: UserCheck,
                            title: rows.application.title,
                            detail: rows.application.detail,
                            target: owned(
                                config?.membershipSettings
                                    ?.applicationParentChannelId,
                                text.pages.membership,
                                hrefs.membership,
                                (name) =>
                                    text.threadsUnder.replace(
                                        "{channel}",
                                        `# ${name}`
                                    )
                            ),
                        })}
                        {row({
                            key: "applicationClose",
                            icon: Archive,
                            title: rows.applicationClose.title,
                            detail: rows.applicationClose.detail,
                            target: plain(rows.applicationClose.target),
                            toggle: settingToggle(
                                "applicationCloseDm",
                                rows.applicationClose.switchLabel
                            ),
                        })}
                        {row({
                            key: "ticketPanel",
                            icon: Ticket,
                            title: rows.ticketPanel.title,
                            detail: rows.ticketPanel.detail,
                            target: owned(
                                config?.ticketSettings?.submitChannelId,
                                text.pages.tickets,
                                hrefs.tickets
                            ),
                        })}
                        {row({
                            key: "ticket",
                            icon: MessageCircle,
                            title: rows.ticket.title,
                            detail: rows.ticket.detail,
                            target: owned(
                                config?.ticketSettings?.ticketParentChannelId,
                                text.pages.tickets,
                                hrefs.tickets,
                                (name) =>
                                    text.threadsUnder.replace(
                                        "{channel}",
                                        `# ${name}`
                                    )
                            ),
                        })}
                        {row({
                            key: "ticketClose",
                            icon: Archive,
                            title: rows.ticketClose.title,
                            detail: rows.ticketClose.detail,
                            target: plain(rows.ticketClose.target),
                            toggle: settingToggle(
                                "ticketCloseDm",
                                rows.ticketClose.switchLabel
                            ),
                        })}
                        {row({
                            key: "playerReport",
                            icon: Flag,
                            title: rows.playerReport.title,
                            detail: rows.playerReport.detail,
                            target: {
                                lines: [
                                    {
                                        text: reportCategory
                                            ? text.category.replace(
                                                  "{name}",
                                                  reportCategory.label ||
                                                      reportCategory.id
                                              )
                                            : text.notSet,
                                        kind: "plain",
                                    },
                                ],
                                from: from(text.pages.tickets, hrefs.tickets),
                            },
                        })}
                    </MessageGroup>
                    <MessageGroup title={text.groups.system}>
                        {(() => {
                            const preview = previewOf(
                                "errors",
                                rows.errors.title
                            )
                            return (
                                <MessageRow
                                    icon={Bug}
                                    title={rows.errors.title}
                                    detail={rows.errors.detail}
                                    target={
                                        <div className="space-y-1">
                                            <label
                                                htmlFor={`${ids}-errors`}
                                                className="sr-only"
                                            >
                                                {rows.errors.selectLabel}
                                            </label>
                                            <DiscordChannelSelect
                                                id={`${ids}-errors`}
                                                value={draft.errorsChannelId}
                                                onChange={(value) =>
                                                    setDraft((current) => ({
                                                        ...current,
                                                        errorsChannelId: value,
                                                    }))
                                                }
                                                options={channelOptions(
                                                    channels,
                                                    "text"
                                                )}
                                                kind="text"
                                                placeholder={
                                                    rows.errors.selectLabel
                                                }
                                                noneLabel={
                                                    rows.errors.noChannel
                                                }
                                                loading={
                                                    metadata.status ===
                                                    "loading"
                                                }
                                                unavailable={
                                                    metadata.status === "failed"
                                                }
                                            />
                                        </div>
                                    }
                                    action={preview.action}
                                >
                                    {preview.children}
                                </MessageRow>
                            )
                        })()}
                    </MessageGroup>
                </ul>
            </section>
            <UnsavedChangesBar
                changes={count}
                saving={saving || refreshing}
                onDiscard={() => setDraft(saved)}
                onSave={() => void save()}
                dictionary={dictionary}
            />
        </div>
    )
}

const PANEL_ICONS: Record<PanelListGroup, LucideIcon> = {
    live: Radio,
    combined: Layers,
    control: Shield,
    results: Trophy,
    league: Medal,
    calendar: CalendarDays,
    competition: ListChecks,
}

const CHIP_TONES = {
    error: "error",
    waiting: "new",
    unsent: "warning",
    paused: "neutral",
} as const

/** One panel of the overview (N1-29..36) with its live state chip and switch. */
function PanelRow({
    item,
    enabled,
    onToggle,
    channelName,
    dictionary,
}: {
    item: MessagesPanelRow
    enabled: boolean
    onToggle(enabled: boolean): void
    channelName(id: string | undefined): string | undefined
    dictionary: Dictionary
}) {
    const text = dictionary.settingsHub.messagesPage
    const t = text.panels
    const hintId = useId()
    const channels = item.channelIds.flatMap((id) => {
        const name = channelName(id)
        return name ? [name] : []
    })
    return (
        <MessageRow
            icon={PANEL_ICONS[item.group]}
            title={item.title}
            chips={
                <>
                    {item.game ? (
                        <RowChip tone="game">{GAME_SHORT[item.game]}</RowChip>
                    ) : null}
                    {item.chip ? (
                        <RowChip tone={CHIP_TONES[item.chip]}>
                            {t.chips[item.chip]}
                        </RowChip>
                    ) : null}
                </>
            }
            detail={
                <>
                    {item.detail}
                    {item.group === "calendar" ? (
                        <span id={hintId} className="sr-only">
                            {t.calendarHint}
                        </span>
                    ) : null}
                </>
            }
            target={
                <MessageTargetView
                    target={{
                        lines: channels.length
                            ? channels.map((name) => ({
                                  text: name,
                                  kind: "channel" as const,
                              }))
                            : [{ text: text.notSet, kind: "plain" }],
                    }}
                />
            }
            toggle={{
                checked: enabled,
                onChange: onToggle,
                label: item.switchLabel,
                disabled: !item.toggleable,
                describedBy: item.group === "calendar" ? hintId : undefined,
            }}
            action={
                <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="rounded-lg"
                >
                    <Link href={item.href}>
                        {text.edit}
                        <ChevronRight className="size-3.5" aria-hidden="true" />
                    </Link>
                </Button>
            }
        />
    )
}
