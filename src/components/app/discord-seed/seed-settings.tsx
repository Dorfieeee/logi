"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

import {
    checkSeedPlanChannels,
    runSeedAction,
    saveSeedPlan,
    type SeedActionOutcome,
} from "@/lib/discord-seed-client"
import { SettingsSectionHeader } from "@/components/app/settings/settings-section-header"
import type { SeedDashboardResponse } from "@/application/discord-seed/read-dashboard"
import { SettingsSaveBar } from "@/components/app/settings/settings-save-bar"
import type { MessageStyle } from "@/domain/discord-messages/message-style"
import { channelOptions } from "@/components/app/discord-channel-select"
import { useDiscordMetadataState } from "@/hooks/use-discord-metadata"
import { seedControlView } from "@/domain/discord-seed/views"
import { getSeedMessages } from "@/lib/clan-language/seed"
import { seedMapFacts } from "@/domain/discord-seed/map"
import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import { pluralize } from "@/i18n/plural"
import { cn } from "@/lib/utils"

import {
    checkSeedPlanDraft,
    fillSeedText,
    seedCallPreviews,
    seedDayTime,
    seedIssueAt,
    seedPlanChangeCount,
    seedPlanDraft,
    seedTemplateTokens,
    type SeedPlanDraft,
} from "./seed-page-state"
import {
    SeedPlanForm,
    type SeedChannelCheckState,
    type SeedPickerOptions,
} from "./seed-plan-form"
import { SeedCallPreviews, SeedControlPreview } from "./seed-previews"
import { SeedControlSection } from "./seed-control-section"
import { SeedStatusRow } from "./seed-status-row"
import { SeedHistory } from "./seed-history"

type Text = Dictionary["seedPage"]

export type SeedSettingsProps = {
    serverId: string
    /** Dashboard locale (copy, numbers, plurals). */
    locale: string
    /** Clan language of the Discord messages in the previews. */
    language: string
    /** The clan's time zone: schedules, history and previews. */
    timeZone: string
    messageStyle: MessageStyle | null
    data: SeedDashboardResponse
    /** "Now" from the server render, so server and client agree. */
    now: number
    /** The signed-in admin, for the preview of a manual start. */
    actorName: string
    /** The `/join/<server>` page base; the preview only shows the button. */
    joinUrl: string
    hrefs: {
        /** This page without a query. */
        page: string
        /** "Panely v Discordu". */
        back: string
        gameServers: string
    }
    text: Text
    previewLabels: Dictionary["discordPreview"]
}

/**
 * "Seed serverů" (board P3): one tab per game server, the status row with
 * "Seed teď", the plan, the call previews, the private control channel, the
 * save bar and the 30-day history. Clan admins only; the routes re-check.
 */
export function SeedSettings(props: SeedSettingsProps) {
    const { data, text, hrefs } = props
    const selected = data.selected
    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <Link
                    href={hrefs.back}
                    className="text-muted-foreground hover:text-foreground inline-flex min-h-8 items-center gap-1 text-sm"
                >
                    <ChevronLeft className="size-4" aria-hidden="true" />
                    {text.back}
                </Link>
                <SettingsSectionHeader
                    title={text.title}
                    description={text.description}
                />
            </div>
            {data.servers.length ? (
                <nav
                    aria-label={text.serversLabel}
                    className="bg-muted/60 flex flex-col gap-1 rounded-xl p-1 sm:flex-row sm:flex-wrap"
                >
                    {data.servers.map((server) => {
                        const current =
                            server.connectionId ===
                            selected?.server.connectionId
                        return (
                            <Link
                                key={server.connectionId}
                                href={`${hrefs.page}?server=${encodeURIComponent(server.connectionId)}`}
                                aria-current={current ? "page" : undefined}
                                scroll={false}
                                className={cn(
                                    "inline-flex min-h-9 items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition",
                                    current
                                        ? "bg-background font-medium shadow-sm"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <span className="truncate">
                                    {server.name ?? text.games[server.gameId]}
                                </span>
                                <span
                                    className={cn(
                                        "rounded border px-1 text-[10px] font-semibold",
                                        server.gameId === "wardogs"
                                            ? "border-indigo-400/50 text-indigo-700 dark:text-indigo-300"
                                            : "text-muted-foreground"
                                    )}
                                >
                                    {text.games[server.gameId]}
                                </span>
                            </Link>
                        )
                    })}
                </nav>
            ) : (
                <p className="bg-card text-muted-foreground rounded-2xl border p-5 text-sm">
                    {text.noServers}{" "}
                    <Link
                        href={hrefs.gameServers}
                        className="text-foreground underline underline-offset-4"
                    >
                        {text.gameServersLink}
                    </Link>
                </p>
            )}
            {selected ? (
                <SeedServerEditor
                    key={selected.server.connectionId}
                    {...props}
                    selected={selected}
                />
            ) : data.servers.length ? (
                <p role="alert" className="text-muted-foreground text-sm">
                    {text.unavailable}
                </p>
            ) : null}
        </div>
    )
}

type Selected = NonNullable<SeedDashboardResponse["selected"]>

function SeedServerEditor({
    serverId,
    locale,
    language,
    timeZone,
    messageStyle,
    now,
    actorName,
    joinUrl,
    text,
    previewLabels,
    selected,
}: SeedSettingsProps & { selected: Selected }) {
    const router = useRouter()
    const connectionId = selected.server.connectionId
    const serverName =
        selected.server.name ?? text.games[selected.server.gameId]
    const copy = getSeedMessages(language)
    const [saved, setSaved] = useState<SeedPlanDraft>(() =>
        seedPlanDraft(selected.settings, locale)
    )
    const [draft, setDraft] = useState<SeedPlanDraft>(saved)
    const [revision, setRevision] = useState(selected.revision)
    const [attempted, setAttempted] = useState(false)
    const [saving, setSaving] = useState(false)
    const [conflict, setConflict] = useState(false)
    const [acting, setActing] = useState(false)
    const [check, setCheck] = useState<SeedChannelCheckState>({
        status: "idle",
    })
    const metadata = useDiscordMetadataState(serverId)
    // P5-22: a role made here shows before Discord's role list reloads.
    const [createdRoles, setCreatedRoles] = useState<
        Array<{ id: string; name: string }>
    >([])
    const [roleBusy, setRoleBusy] = useState(false)
    const [roleMessage, setRoleMessage] = useState<{
        text: string
        error: boolean
    } | null>(null)

    const pickers: SeedPickerOptions = useMemo(() => {
        const ready = metadata.status === "ready" ? metadata.metadata : null
        const roles = ready
            ? ready.roles
                  .filter((role) => role.name !== "@everyone")
                  .map((role) => ({ id: role.id, name: role.name }))
            : []
        return {
            channels: ready ? channelOptions(ready.channels, "text") : [],
            roles: [
                ...roles,
                ...createdRoles.filter(
                    (role) => !roles.some((known) => known.id === role.id)
                ),
            ],
            loading: metadata.status === "loading",
            unavailable: metadata.status === "failed",
        }
    }, [metadata, createdRoles])

    async function createRole() {
        setRoleBusy(true)
        setRoleMessage(null)
        try {
            const response = await fetch(
                `/api/servers/${encodeURIComponent(serverId)}/discord-seed/role`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: "{}",
                }
            )
            const body = (await response.json().catch(() => null)) as {
                role?: { id: string; name: string; created: boolean }
                error?: string
            } | null
            const role = body?.role
            if (response.ok && role) {
                setCreatedRoles((current) =>
                    current.some((entry) => entry.id === role.id)
                        ? current
                        : [...current, { id: role.id, name: role.name }]
                )
                change({ seedRoleId: role.id })
                setRoleMessage({
                    text: role.created
                        ? text.plan.roleCreated
                        : text.plan.roleReused,
                    error: false,
                })
            } else
                setRoleMessage({
                    text:
                        body?.error === "role_permission"
                            ? text.plan.rolePermission
                            : text.plan.roleUnavailable,
                    error: true,
                })
        } catch {
            setRoleMessage({ text: text.plan.roleUnavailable, error: true })
        } finally {
            setRoleBusy(false)
        }
    }
    const channelName = (id: string) =>
        pickers.channels.find((channel) => channel.id === id)?.name ?? null
    const roleName = (id: string) =>
        pickers.roles.find((role) => role.id === id)?.name ?? null
    const hashed = (id: string | null) => {
        const name = id ? channelName(id) : null
        return name ? `#${name}` : text.previews.noChannel
    }

    const changes = seedPlanChangeCount(saved, draft)
    const result = checkSeedPlanDraft(draft, selected.status.capacity)
    const issues = attempted && !result.ok ? result.issues : []

    // Discord's checks follow the channels and the role as they are picked.
    const checkKey = JSON.stringify([
        draft.seedChannelId,
        draft.controlChannelId,
        draft.seedRoleId,
        draft.roleSelfService,
    ])
    const checkRun = useRef(0)
    useEffect(() => {
        const [seedChannelId, controlChannelId, seedRoleId, roleSelfService] =
            JSON.parse(checkKey) as [
                string | null,
                string | null,
                string | null,
                boolean,
            ]
        if (!seedChannelId && !controlChannelId) {
            setCheck({ status: "idle" })
            return
        }
        const run = ++checkRun.current
        setCheck({ status: "checking" })
        const timer = setTimeout(() => {
            void checkSeedPlanChannels(serverId, connectionId, {
                seedChannelId,
                controlChannelId,
                seedRoleId,
                roleSelfService,
            }).then((answer) => {
                if (run !== checkRun.current) return
                setCheck(
                    answer.ok
                        ? { status: "ready", report: answer.channels }
                        : { status: "unavailable" }
                )
            })
        }, 500)
        return () => clearTimeout(timer)
    }, [checkKey, serverId, connectionId])

    function change(patch: Partial<SeedPlanDraft>) {
        setDraft((current) => ({ ...current, ...patch }))
    }

    async function submit() {
        setAttempted(true)
        if (!result.ok) {
            toast.error(text.save.failed)
            return
        }
        setSaving(true)
        try {
            const answer = await saveSeedPlan(serverId, connectionId, {
                expectedRevision: revision,
                settings: result.plan,
            })
            if (answer.ok) {
                const next = seedPlanDraft(result.plan, locale)
                setSaved(next)
                setDraft(next)
                setRevision(answer.revision)
                setAttempted(false)
                setCheck({ status: "ready", report: answer.channels })
                toast.success(text.save.saved)
                router.refresh()
            } else if (answer.error === "channels") {
                setCheck({ status: "ready", report: answer.channels })
                toast.error(text.save.failed)
            } else if (answer.error === "conflict") {
                setConflict(true)
            } else if (answer.error === "verification_unavailable") {
                setCheck({ status: "unavailable" })
                toast.error(text.problems.verification_unavailable)
            } else toast.error(text.save.failed)
        } finally {
            setSaving(false)
        }
    }

    function refusal(answer: Extract<SeedActionOutcome, { ok: false }>) {
        if (answer.error === "cooldown" && answer.retryAt)
            return fillSeedText(text.actionErrors.cooldown, {
                time: seedDayTime(
                    answer.retryAt,
                    Date.now(),
                    timeZone,
                    locale,
                    text.time
                ),
            })
        return text.actionErrors[answer.error]
    }

    async function act(action: "start" | "stop") {
        if (changes > 0) {
            toast.error(text.actionErrors.unsaved)
            return
        }
        setActing(true)
        try {
            const answer = await runSeedAction(
                serverId,
                connectionId,
                action === "start"
                    ? { action, requestKey: crypto.randomUUID() }
                    : { action }
            )
            if (answer.ok)
                toast.success(
                    answer.action === "started"
                        ? fillSeedText(text.status.started, {
                              channel: hashed(answer.channelId),
                          })
                        : text.status.stopped
                )
            else toast.error(refusal(answer))
            router.refresh()
        } finally {
            setActing(false)
        }
    }

    const fallback = selected.settings
    const typedLiveFrom = Number(draft.liveFrom)
    const liveFrom =
        Number.isInteger(typedLiveFrom) && typedLiveFrom >= 1
            ? typedLiveFrom
            : fallback.liveFrom
    // The bot's own map rule: "Foy · Warfare · Den" and the built-in map picture.
    const map = seedMapFacts(
        { gameId: selected.server.gameId, map: selected.status.map },
        language
    )
    const previews = seedCallPreviews({
        draft,
        fallback,
        server: { name: serverName, gameId: selected.server.gameId },
        reading: {
            players: selected.status.players,
            capacity: selected.status.capacity,
        },
        map,
        actorName,
        joinUrl,
        now,
        timeZone,
        copy,
    })
    const control = seedControlView({
        connectionId,
        server: { name: serverName, gameId: selected.server.gameId },
        status: selected.status.serverStatus,
        seeding: selected.status.running,
        players: selected.status.players,
        capacity: selected.status.capacity,
        mapName: map.mapName,
        liveFrom,
        panel: selected.panel ? { paused: selected.panel.paused } : null,
        locale: copy.locale,
        copy,
    })
    const previewContext = {
        language,
        style: messageStyle,
        labels: previewLabels,
        now,
        timeZone,
        authorTime: fillSeedText(text.previews.author, {
            time: new Intl.DateTimeFormat(copy.locale, {
                timeZone,
                hour: "2-digit",
                minute: "2-digit",
                hourCycle: "h23",
            }).format(now),
        }),
    }
    return (
        <div className="space-y-6">
            <SeedStatusRow
                status={selected.status}
                activeRun={selected.activeRun}
                locale={locale}
                timeZone={timeZone}
                now={now}
                busy={acting}
                text={text}
                onStart={() => void act("start")}
                onStop={() => void act("stop")}
            />
            <div className="grid gap-5 xl:grid-cols-2 xl:items-start">
                <SeedPlanForm
                    serverName={serverName}
                    draft={draft}
                    issues={issues}
                    roleMembers={
                        draft.seedRoleId === selected.settings.seedRoleId
                            ? selected.roleMembers
                            : null
                    }
                    pickers={pickers}
                    check={check}
                    tokens={seedTemplateTokens(language)}
                    templatePlaceholder={copy.call.startingText(
                        new Intl.NumberFormat(copy.locale).format(liveFrom)
                    )}
                    locale={locale}
                    text={text}
                    onChange={change}
                    roleCreator={{
                        busy: roleBusy,
                        message: roleMessage,
                        onCreate: () => void createRole(),
                    }}
                />
                <div className="min-w-0 xl:sticky xl:top-4">
                    <SeedCallPreviews
                        seeding={previews.seeding}
                        live={previews.live}
                        leadRole={
                            previews.leadRoleId
                                ? (roleName(previews.leadRoleId) ??
                                  text.history.unknownRole.replace(/^@/, ""))
                                : null
                        }
                        channel={hashed(draft.seedChannelId)}
                        liveFrom={liveFrom}
                        context={previewContext}
                        text={text.previews}
                    />
                </div>
            </div>
            <SeedControlSection
                channelId={draft.controlChannelId}
                pickers={pickers}
                check={check}
                issue={seedIssueAt(issues, "controlChannelId")}
                text={text}
                onChange={(controlChannelId) => change({ controlChannelId })}
                preview={
                    <SeedControlPreview
                        view={control}
                        channel={hashed(draft.controlChannelId)}
                        context={previewContext}
                        text={text.previews}
                    />
                }
            />
            {conflict ? (
                <div
                    role="alert"
                    className="border-destructive/40 bg-destructive/5 text-destructive flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm"
                >
                    <span>{text.save.conflict}</span>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => window.location.reload()}
                    >
                        {text.save.reload}
                    </Button>
                </div>
            ) : null}
            <SettingsSaveBar
                note={fillSeedText(text.save.note, { server: serverName })}
                dirty={changes > 0}
                saving={saving}
                discardLabel={text.save.discard}
                saveLabel={saving ? text.save.saving : text.save.save}
                unsavedLabel={pluralize(locale, changes, text.save.unsaved)}
                onDiscard={() => {
                    setDraft(saved)
                    setAttempted(false)
                    setConflict(false)
                }}
                onSave={() => void submit()}
            />
            <SeedHistory
                serverName={serverName}
                history={selected.history}
                locale={locale}
                timeZone={timeZone}
                text={text}
                channelName={channelName}
                roleName={roleName}
            />
        </div>
    )
}
