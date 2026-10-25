"use client"

import {
    ArrowDown,
    ArrowRight,
    ArrowUp,
    Award,
    CalendarDays,
    Check,
    Globe,
    GripVertical,
    Info,
    Layers,
    Lock,
    Radio,
    RefreshCw,
    Table2,
    Trophy,
    X,
    type LucideIcon,
} from "lucide-react"
import { useId, useState, type ReactNode } from "react"
import Link from "next/link"

import {
    freeResultsGame,
    moveServer,
    panelTypeOptions,
    passwordAllowed,
    serverJoinProblems,
    toggleServer,
    type PanelEditorDraft,
    type ServerJoinDraft,
} from "@/domain/discord-publications/panel-editor"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    PANEL_PERMISSIONS,
    type PanelPermission,
} from "@/domain/discord-publications/panel-delivery"
import {
    PANEL_STYLES,
    type PanelStyle,
} from "@/domain/discord-publications/panel-graphics"
import { DiscordChannelSelect } from "@/components/app/discord-channel-select"
import type { PanelKind } from "@/domain/discord-publications/settings"
import { SettingsStep } from "@/components/app/settings/settings-step"
import type { Dictionary } from "@/i18n/dictionaries"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

import type { PanelChannelCheck, PanelOverviewResponse } from "./panels-api"
import { Field, Note, StepSection, SwitchRow } from "./editor-fields"
import { fill, joinWords } from "./panel-copy"
import { BannerField } from "./banner-field"
import { GameChip } from "./panel-chips"
import { timeAgo } from "./panel-time"

type Source = PanelOverviewResponse["sources"][number]
type ServerInfo = PanelOverviewResponse["servers"][number]

export type ChannelCheckState =
    | { status: "idle" | "loading" | "failed" }
    | { status: "done"; result: PanelChannelCheck }

/** Everything a step reads; the editor owns the state. */
export type EditorContext = {
    serverId: string
    draft: PanelEditorDraft
    update: (patch: Partial<PanelEditorDraft>) => void
    dictionary: Dictionary
    locale: string
    now: number
    sent: boolean
    takenKinds: PanelKind[]
    /** Games that already have a results panel; results are one per game (P2-04). */
    resultsTaken: ReadonlyArray<"hell_let_loose" | "wardogs">
    sources: Source[]
    servers: Record<string, ServerInfo>
    joins: Record<string, ServerJoinDraft>
    setJoin: (connectionId: string, patch: Partial<ServerJoinDraft>) => void
    /** "Živá data ✓" or "omezená" per connection. */
    live: (connectionId: string) => "ok" | "limited" | null
    channels: ReadonlyArray<{ id: string; name: string; type: number }> | null
    roles: ReadonlyArray<{ id: string; name: string }> | null
    channelCheck: ChannelCheckState
    verifyChannel: () => void
    channelPrivate: boolean | null
    ticketCategories: ReadonlyArray<{ id: string; label: string }>
    eventCategories: ReadonlyArray<{ id: string; label: string }>
    competitions: ReadonlyArray<{ id: string; name: string; gameId: string }>
    enabledGames: readonly string[]
    defaultStyle: PanelStyle
    clanAccentHex: string
    /** The `logi.app/join/<server>` link of a server, predicted before the first save. */
    joinUrl: (connectionId: string) => string | null
    disabled: boolean
    setUploading: (uploading: boolean) => void
    hrefs: {
        gameServers: string
        tickets: string
        seed: string
        graphics: string
    }
}

const TYPE_ICONS: Record<PanelKind, LucideIcon> = {
    server: Radio,
    servers: Layers,
    results: Trophy,
    league: Award,
    calendar: CalendarDays,
    competition: Table2,
}

const gameOf = (ctx: EditorContext, connectionId: string) =>
    ctx.sources.find((source) => source.connectionId === connectionId)
        ?.gameId ?? "hell_let_loose"
const nameOf = (ctx: EditorContext, connectionId: string) =>
    ctx.sources.find((source) => source.connectionId === connectionId)?.name ??
    ctx.dictionary.discordPanelsPage.list.titles.unknownServer
const gameLabel = (ctx: EditorContext, game: string) =>
    game === "wardogs" || game === "hell_let_loose"
        ? ctx.dictionary.discordPanelsPage.games[game]
        : game

function InlineLink({ href, children }: { href: string; children: ReactNode }) {
    return (
        <Link
            href={href}
            className="text-foreground inline-flex items-center gap-1 underline underline-offset-3"
        >
            {children}
        </Link>
    )
}

// ---- 1 · Typ panelu --------------------------------------------------------------

export function TypeStep({
    ctx,
    number,
}: {
    ctx: EditorContext
    number: number
}) {
    const text = ctx.dictionary.discordPanelsPage.editor
    const options = panelTypeOptions({
        current: ctx.draft.kind,
        sent: ctx.sent,
        taken: ctx.takenKinds,
    })
    const name = useId()
    return (
        <SettingsStep id="panel-type" number={number} title={text.steps.type}>
            <fieldset className="space-y-3">
                <legend className="sr-only">{text.steps.type}</legend>
                <div className="grid grid-cols-2 gap-2">
                    {options.map((option) => {
                        const Icon = TYPE_ICONS[option.kind]
                        const copy = text.types[option.kind]
                        return (
                            <label
                                key={option.kind}
                                className={cn(
                                    "relative flex cursor-pointer flex-col gap-0.5 rounded-xl border px-3 py-2.5 transition-colors",
                                    option.selected
                                        ? "border-foreground ring-foreground ring-1"
                                        : "hover:bg-accent/50",
                                    option.disabled &&
                                        "cursor-not-allowed opacity-55 hover:bg-transparent"
                                )}
                            >
                                <input
                                    type="radio"
                                    name={name}
                                    value={option.kind}
                                    checked={option.selected}
                                    disabled={option.disabled || ctx.disabled}
                                    onChange={() =>
                                        ctx.update(
                                            option.kind === "results"
                                                ? {
                                                      kind: option.kind,
                                                      // A game without results yet (P2-04).
                                                      gameId: freeResultsGame({
                                                          current:
                                                              ctx.draft.gameId,
                                                          taken: ctx.resultsTaken,
                                                          enabledGames:
                                                              ctx.enabledGames,
                                                      }),
                                                  }
                                                : { kind: option.kind }
                                        )
                                    }
                                    className="peer sr-only"
                                />
                                <span className="flex items-center gap-2 text-sm font-semibold">
                                    <Icon
                                        className="size-4"
                                        aria-hidden="true"
                                    />
                                    {copy.title}
                                </span>
                                <span className="text-muted-foreground text-xs">
                                    {copy.text}
                                </span>
                                <span className="peer-focus-visible:ring-ring/50 pointer-events-none absolute inset-0 rounded-xl peer-focus-visible:ring-[3px]" />
                            </label>
                        )
                    })}
                </div>
                {ctx.sent ? (
                    <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
                        <Lock
                            className="mt-px size-3.5 shrink-0"
                            aria-hidden="true"
                        />
                        {text.typeLocked}
                    </p>
                ) : options.some(
                      (option) => option.disabled && !option.selected
                  ) ? (
                    <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
                        <Info
                            className="mt-px size-3.5 shrink-0"
                            aria-hidden="true"
                        />
                        {text.typeTaken}
                    </p>
                ) : null}
            </fieldset>
        </SettingsStep>
    )
}

// ---- 2 · Server(y) -----------------------------------------------------------------

function HealthLine({
    ctx,
    connectionId,
    compact = false,
}: {
    ctx: EditorContext
    connectionId: string
    compact?: boolean
}) {
    const t = ctx.dictionary.discordPanelsPage.editor.server
    const source = ctx.sources.find(
        (entry) => entry.connectionId === connectionId
    )
    if (!source) return null
    const live = ctx.live(connectionId)
    const collecting = !source.collecting
        ? t.healthNotCollecting
        : source.lastDataAt && !compact
          ? fill(t.healthCollecting, {
                ago: timeAgo(source.lastDataAt, ctx.now, ctx.locale),
            })
          : source.lastDataAt
            ? t.healthCollecting.split(" · ")[0]
            : t.healthNoData
    const ok = source.collecting && source.freshness === "fresh"
    const parts = [
        collecting,
        live === "ok" ? t.liveOk : live === "limited" ? t.liveLimited : null,
    ].filter(Boolean)
    return (
        <p
            className={cn(
                "flex items-start gap-1.5 text-xs",
                compact
                    ? "text-muted-foreground"
                    : ok && live !== "limited"
                      ? "text-emerald-700 dark:text-emerald-400"
                      : "text-amber-700 dark:text-amber-400"
            )}
        >
            {compact ? null : (
                <Check className="mt-px size-3.5 shrink-0" aria-hidden="true" />
            )}
            {parts.join(" · ")}
        </p>
    )
}

export function ServerStep({
    ctx,
    number,
}: {
    ctx: EditorContext
    number: number
}) {
    const text = ctx.dictionary.discordPanelsPage.editor
    const id = useId()
    return (
        <SettingsStep
            id="panel-server"
            number={number}
            title={text.steps.server}
        >
            {ctx.sources.length ? (
                <div className="space-y-2">
                    <label htmlFor={id} className="block text-sm">
                        {text.server.label}
                    </label>
                    <Select
                        value={ctx.draft.connectionId || undefined}
                        disabled={ctx.disabled}
                        onValueChange={(connectionId) =>
                            ctx.update({ connectionId })
                        }
                    >
                        <SelectTrigger id={id} className="w-full rounded-lg">
                            <SelectValue
                                placeholder={text.server.placeholder}
                            />
                        </SelectTrigger>
                        <SelectContent>
                            {ctx.sources.map((source) => (
                                <SelectItem
                                    key={source.connectionId}
                                    value={source.connectionId}
                                >
                                    <span className="flex items-center gap-2">
                                        {source.name ??
                                            ctx.dictionary.discordPanelsPage
                                                .list.titles.unknownServer}
                                        <GameChip
                                            game={source.gameId}
                                            label={gameLabel(
                                                ctx,
                                                source.gameId
                                            )}
                                        />
                                    </span>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {ctx.draft.connectionId ? (
                        <HealthLine
                            ctx={ctx}
                            connectionId={ctx.draft.connectionId}
                        />
                    ) : null}
                </div>
            ) : (
                <p className="text-muted-foreground text-sm">
                    {text.server.empty}{" "}
                    <InlineLink href={ctx.hrefs.gameServers}>
                        {text.server.emptyLink}
                    </InlineLink>
                </p>
            )}
        </SettingsStep>
    )
}

export function ServersStep({
    ctx,
    number,
}: {
    ctx: EditorContext
    number: number
}) {
    const text = ctx.dictionary.discordPanelsPage.editor
    const [dragging, setDragging] = useState<number | null>(null)
    const selected = ctx.draft.connectionIds
    // Chosen servers first in message order, then the others.
    const ordered = [
        ...selected,
        ...ctx.sources
            .map((source) => source.connectionId)
            .filter((id) => !selected.includes(id)),
    ]
    return (
        <SettingsStep
            id="panel-servers"
            number={number}
            title={text.steps.servers}
        >
            {ctx.sources.length ? (
                <div className="space-y-2">
                    <ul className="space-y-1.5">
                        {ordered.map((connectionId) => {
                            const index = selected.indexOf(connectionId)
                            const chosen = index >= 0
                            const name = nameOf(ctx, connectionId)
                            const game = gameOf(ctx, connectionId)
                            return (
                                <li
                                    key={connectionId}
                                    draggable={chosen && !ctx.disabled}
                                    onDragStart={() => setDragging(index)}
                                    onDragOver={(event) => {
                                        if (chosen && dragging !== null)
                                            event.preventDefault()
                                    }}
                                    onDrop={() => {
                                        if (dragging !== null && chosen)
                                            ctx.update({
                                                connectionIds: moveServer(
                                                    selected,
                                                    dragging,
                                                    index
                                                ),
                                            })
                                        setDragging(null)
                                    }}
                                    onDragEnd={() => setDragging(null)}
                                    className={cn(
                                        "flex items-start gap-2.5 rounded-lg px-1 py-1",
                                        dragging === index && "bg-accent/60"
                                    )}
                                >
                                    <Checkbox
                                        id={`server-${connectionId}`}
                                        checked={chosen}
                                        disabled={ctx.disabled}
                                        onCheckedChange={(on) =>
                                            ctx.update({
                                                connectionIds: toggleServer(
                                                    selected,
                                                    connectionId,
                                                    on === true
                                                ),
                                            })
                                        }
                                        className="mt-0.5"
                                    />
                                    <div className="min-w-0 flex-1">
                                        <label
                                            htmlFor={`server-${connectionId}`}
                                            className="flex flex-wrap items-center gap-1.5 text-sm"
                                        >
                                            {name}
                                            <GameChip
                                                game={game}
                                                label={gameLabel(ctx, game)}
                                            />
                                        </label>
                                        <HealthLine
                                            ctx={ctx}
                                            connectionId={connectionId}
                                            compact
                                        />
                                    </div>
                                    {chosen && selected.length > 1 ? (
                                        <div className="flex shrink-0 items-center">
                                            <GripVertical
                                                className="text-muted-foreground size-4 cursor-grab"
                                                aria-label={fill(
                                                    text.servers.drag,
                                                    {
                                                        server: name,
                                                    }
                                                )}
                                            />
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="size-7"
                                                disabled={
                                                    index === 0 || ctx.disabled
                                                }
                                                aria-label={fill(
                                                    text.servers.moveUp,
                                                    {
                                                        server: name,
                                                    }
                                                )}
                                                onClick={() =>
                                                    ctx.update({
                                                        connectionIds:
                                                            moveServer(
                                                                selected,
                                                                index,
                                                                index - 1
                                                            ),
                                                    })
                                                }
                                            >
                                                <ArrowUp className="size-3.5" />
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="size-7"
                                                disabled={
                                                    index ===
                                                        selected.length - 1 ||
                                                    ctx.disabled
                                                }
                                                aria-label={fill(
                                                    text.servers.moveDown,
                                                    { server: name }
                                                )}
                                                onClick={() =>
                                                    ctx.update({
                                                        connectionIds:
                                                            moveServer(
                                                                selected,
                                                                index,
                                                                index + 1
                                                            ),
                                                    })
                                                }
                                            >
                                                <ArrowDown className="size-3.5" />
                                            </Button>
                                        </div>
                                    ) : null}
                                </li>
                            )
                        })}
                    </ul>
                    <p className="text-muted-foreground text-xs">
                        {text.servers.order}
                    </p>
                </div>
            ) : (
                <p className="text-muted-foreground text-sm">
                    {text.server.empty}{" "}
                    <InlineLink href={ctx.hrefs.gameServers}>
                        {text.server.emptyLink}
                    </InlineLink>
                </p>
            )}
        </SettingsStep>
    )
}

export function GameStep({
    ctx,
    number,
}: {
    ctx: EditorContext
    number: number
}) {
    const text = ctx.dictionary.discordPanelsPage
    const name = useId()
    const games = (["hell_let_loose", "wardogs"] as const).filter(
        (game) => ctx.enabledGames.includes(game) || ctx.draft.gameId === game
    )
    return (
        <SettingsStep
            id="panel-game"
            number={number}
            title={text.editor.steps.game}
        >
            <fieldset className="space-y-2">
                <legend className="sr-only">{text.editor.game.label}</legend>
                <div className="flex flex-wrap gap-2">
                    {games.map((game) => (
                        <label
                            key={game}
                            className={cn(
                                "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                                ctx.draft.gameId === game &&
                                    "border-foreground ring-foreground ring-1"
                            )}
                        >
                            <input
                                type="radio"
                                name={name}
                                checked={ctx.draft.gameId === game}
                                disabled={
                                    ctx.disabled ||
                                    ctx.sent ||
                                    // One results panel per game (P2-04).
                                    (ctx.draft.gameId !== game &&
                                        ctx.resultsTaken.includes(game))
                                }
                                onChange={() => ctx.update({ gameId: game })}
                            />
                            {text.gameNames[game]}
                        </label>
                    ))}
                </div>
                <p className="text-muted-foreground text-xs">
                    {text.editor.game.help}
                </p>
            </fieldset>
        </SettingsStep>
    )
}

export function CalendarStep({
    ctx,
    number,
}: {
    ctx: EditorContext
    number: number
}) {
    const text = ctx.dictionary.discordPanelsPage.editor
    return (
        <SettingsStep
            id="panel-calendar"
            number={number}
            title={text.steps.calendar}
        >
            <fieldset className="space-y-2">
                <legend className="text-sm">{text.calendar.label}</legend>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {ctx.eventCategories.map((category) => {
                        const id = `category-${category.id}`
                        const on = ctx.draft.calendarCategories.includes(
                            category.id
                        )
                        return (
                            <div
                                key={category.id}
                                className="flex items-center gap-2"
                            >
                                <Checkbox
                                    id={id}
                                    checked={on}
                                    disabled={ctx.disabled}
                                    onCheckedChange={(checked) =>
                                        ctx.update({
                                            calendarCategories:
                                                checked === true
                                                    ? [
                                                          ...ctx.draft
                                                              .calendarCategories,
                                                          category.id,
                                                      ]
                                                    : ctx.draft.calendarCategories.filter(
                                                          (value) =>
                                                              value !==
                                                              category.id
                                                      ),
                                        })
                                    }
                                />
                                <label htmlFor={id} className="text-sm">
                                    {category.label}
                                </label>
                            </div>
                        )
                    })}
                </div>
                <p className="text-muted-foreground text-xs">
                    {text.calendar.help}
                </p>
            </fieldset>
        </SettingsStep>
    )
}

export function CompetitionStep({
    ctx,
    number,
}: {
    ctx: EditorContext
    number: number
}) {
    const text = ctx.dictionary.discordPanelsPage.editor
    const id = useId()
    return (
        <SettingsStep
            id="panel-competition"
            number={number}
            title={text.steps.competition}
        >
            {ctx.competitions.length ? (
                <div className="space-y-2">
                    <label htmlFor={id} className="block text-sm">
                        {text.competition.label}
                    </label>
                    <Select
                        value={ctx.draft.competitionId || undefined}
                        disabled={ctx.disabled}
                        onValueChange={(competitionId) =>
                            ctx.update({ competitionId })
                        }
                    >
                        <SelectTrigger id={id} className="w-full rounded-lg">
                            <SelectValue
                                placeholder={text.competition.placeholder}
                            />
                        </SelectTrigger>
                        <SelectContent>
                            {ctx.competitions.map((competition) => (
                                <SelectItem
                                    key={competition.id}
                                    value={competition.id}
                                >
                                    {competition.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            ) : (
                <p className="text-muted-foreground text-sm">
                    {text.competition.empty}
                </p>
            )}
        </SettingsStep>
    )
}

// ---- 3 · Kanál ---------------------------------------------------------------------

export function ChannelStep({
    ctx,
    number,
}: {
    ctx: EditorContext
    number: number
}) {
    const text = ctx.dictionary.discordPanelsPage.editor.channel
    const permissions = ctx.dictionary.discordPanelStatus.permissions
    const id = useId()
    const check = ctx.channelCheck
    const result = check.status === "done" ? check.result : null
    const rolesText = (() => {
        const ids = result?.viewerRoleIds ?? []
        const names = ids.flatMap((roleId) => {
            const role = ctx.roles?.find((entry) => entry.id === roleId)
            return role ? [fill(text.role, { name: `@${role.name}` })] : []
        })
        return names.length
            ? fill(text.privateRoles, {
                  roles: joinWords(
                      names,
                      ctx.dictionary.discordPanelsPage.list.meta.and
                  ),
              })
            : text.privateAdmins
    })()
    return (
        <SettingsStep
            id="panel-channel"
            number={number}
            title={ctx.dictionary.discordPanelsPage.editor.steps.channel}
        >
            <div className="space-y-3">
                <div className="flex gap-2">
                    <div className="min-w-0 flex-1">
                        <label htmlFor={id} className="sr-only">
                            {text.label}
                        </label>
                        <DiscordChannelSelect
                            id={id}
                            value={ctx.draft.channelId || undefined}
                            onChange={(channelId) =>
                                ctx.update({ channelId: channelId ?? "" })
                            }
                            options={(ctx.channels ?? [])
                                .filter((channel) =>
                                    [0, 5].includes(channel.type)
                                )
                                .map((channel) => ({
                                    id: channel.id,
                                    name: channel.name,
                                }))}
                            kind="text"
                            placeholder={text.placeholder}
                            loading={ctx.channels === null}
                        />
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        className="shrink-0 rounded-lg"
                        disabled={
                            !ctx.draft.channelId ||
                            check.status === "loading" ||
                            ctx.disabled
                        }
                        onClick={ctx.verifyChannel}
                    >
                        <RefreshCw
                            className={cn(
                                "size-3.5",
                                check.status === "loading" && "animate-spin"
                            )}
                            aria-hidden="true"
                        />
                        {check.status === "loading"
                            ? text.verifying
                            : text.verify}
                    </Button>
                </div>
                {result ? (
                    <div className="space-y-3" role="status">
                        {!result.supported ? (
                            <Note tone="danger">{text.unsupported}</Note>
                        ) : null}
                        {result.timedOut ? (
                            <Note tone="danger">{text.timedOut}</Note>
                        ) : null}
                        <ul className="space-y-1">
                            {PANEL_PERMISSIONS.map(
                                (permission: PanelPermission) => {
                                    const has = result.permissions[permission]
                                    return (
                                        <li
                                            key={permission}
                                            className="flex items-start gap-2 text-[13px]"
                                        >
                                            {has ? (
                                                <Check
                                                    className="mt-0.5 size-3.5 shrink-0 text-emerald-600"
                                                    aria-hidden="true"
                                                />
                                            ) : (
                                                <X
                                                    className="mt-0.5 size-3.5 shrink-0 text-red-600"
                                                    aria-hidden="true"
                                                />
                                            )}
                                            <span>
                                                <span className="sr-only">
                                                    {has
                                                        ? text.has
                                                        : text.missing}{" "}
                                                </span>
                                                {permissions[permission]}
                                                {!has &&
                                                permission ===
                                                    "attach_files" ? (
                                                    <span className="block text-xs text-red-700 dark:text-red-400">
                                                        {text.attachHint}
                                                    </span>
                                                ) : null}
                                            </span>
                                        </li>
                                    )
                                }
                            )}
                        </ul>
                        {ctx.draft.kind !== "server" &&
                        ctx.draft.kind !==
                            "servers" ? null : result.everyoneCanView ? (
                            <Note
                                icon={
                                    <Globe
                                        className="size-3.5"
                                        aria-hidden="true"
                                    />
                                }
                            >
                                {text.public}
                            </Note>
                        ) : (
                            <Note
                                tone="success"
                                icon={
                                    <Lock
                                        className="size-3.5"
                                        aria-hidden="true"
                                    />
                                }
                            >
                                <span className="font-semibold">
                                    {text.private}
                                </span>{" "}
                                {rolesText}
                            </Note>
                        )}
                    </div>
                ) : check.status === "failed" ? (
                    <p role="alert" className="text-destructive text-xs">
                        {text.failed}
                    </p>
                ) : ctx.draft.channelId ? (
                    <p className="text-muted-foreground text-xs">
                        {text.unverified}
                    </p>
                ) : null}
            </div>
        </SettingsStep>
    )
}

// ---- 4 · Obsah ---------------------------------------------------------------------

function JoinInputs({
    ctx,
    connectionId,
    field,
}: {
    ctx: EditorContext
    connectionId: string
    field: "address" | "joinCode"
}) {
    const text = ctx.dictionary.discordPanelsPage.editor
    const id = useId()
    const join = ctx.joins[connectionId]
    if (!join) return null
    const problems = serverJoinProblems(join)
    const name = nameOf(ctx, connectionId)
    return (
        <Field
            label={fill(
                field === "address"
                    ? text.content.address.field
                    : text.content.joinCode.field,
                { server: name }
            )}
            htmlFor={id}
            error={problems.includes(field) ? text.errors[field] : null}
        >
            <div className="flex flex-wrap items-center gap-2">
                <Input
                    id={id}
                    value={join[field]}
                    disabled={ctx.disabled}
                    maxLength={field === "address" ? 100 : 24}
                    placeholder={
                        field === "address"
                            ? text.content.address.placeholder
                            : "VLCI-7Q2"
                    }
                    spellCheck={false}
                    autoComplete="off"
                    className="max-w-56 rounded-lg font-mono"
                    aria-invalid={problems.includes(field) || undefined}
                    onChange={(event) =>
                        ctx.setJoin(connectionId, {
                            [field]: event.target.value,
                        })
                    }
                />
                {/* A saved address or code stays editable and can be removed (P2-15, P2-39). */}
                {join[field].trim() ? (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground h-8 rounded-lg px-2 text-xs"
                        disabled={ctx.disabled}
                        aria-label={fill(
                            field === "address"
                                ? text.content.address.clearFor
                                : text.content.joinCode.clearFor,
                            { server: name }
                        )}
                        onClick={() =>
                            ctx.setJoin(connectionId, { [field]: "" })
                        }
                    >
                        <X className="size-3.5" aria-hidden="true" />
                        {field === "address"
                            ? text.content.address.clear
                            : text.content.joinCode.clear}
                    </Button>
                ) : null}
            </div>
        </Field>
    )
}

function PasswordInput({
    ctx,
    connectionId,
    label,
    enabled,
}: {
    ctx: EditorContext
    connectionId: string
    label: string
    enabled: boolean
}) {
    const text = ctx.dictionary.discordPanelsPage.editor
    const id = useId()
    const join = ctx.joins[connectionId]
    const stored = ctx.servers[connectionId]?.hasPassword ?? false
    if (!join) return null
    const problems = serverJoinProblems(join)
    return (
        <Field
            label={label}
            htmlFor={id}
            error={problems.includes("password") ? text.errors.password : null}
            help={
                enabled
                    ? stored
                        ? text.content.password.stored
                        : text.content.password.help
                    : undefined
            }
        >
            <Input
                id={id}
                type="password"
                value={join.password}
                disabled={!enabled || ctx.disabled}
                autoComplete="new-password"
                maxLength={64}
                placeholder={stored ? "••••••••" : undefined}
                className="max-w-56 rounded-lg"
                onChange={(event) =>
                    ctx.setJoin(connectionId, {
                        password: event.target.value,
                        clearPassword: false,
                    })
                }
            />
            {enabled && stored ? (
                <label className="text-muted-foreground flex items-center gap-2 text-xs">
                    <Checkbox
                        checked={join.clearPassword}
                        disabled={ctx.disabled}
                        onCheckedChange={(checked) =>
                            ctx.setJoin(connectionId, {
                                clearPassword: checked === true,
                                password: "",
                            })
                        }
                    />
                    {text.content.password.clear}
                </label>
            ) : null}
        </Field>
    )
}

export function ServerContentStep({
    ctx,
    number,
}: {
    ctx: EditorContext
    number: number
}) {
    const text = ctx.dictionary.discordPanelsPage.editor
    const c = text.content
    const { draft } = ctx
    const content = draft.content
    const set = (patch: Partial<typeof content>) =>
        ctx.update({ content: { ...content, ...patch } })
    const game = gameOf(ctx, draft.connectionId)
    const hll = game !== "wardogs"
    const server = ctx.servers[draft.connectionId]
    const join = ctx.joins[draft.connectionId]
    // The address as edited here; the saved one until the join details load.
    const address = join
        ? join.address.trim() || null
        : (server?.address ?? null)
    const allowed = passwordAllowed({
        kind: "server",
        channelPrivate: ctx.channelPrivate,
    })
    const joinUrl = ctx.joinUrl(draft.connectionId)?.replace(/^https?:\/\//, "")
    const source = ctx.sources.find(
        (entry) => entry.connectionId === draft.connectionId
    )
    const reportProvider =
        source?.provider === "hll_crcon" ||
        source?.provider === "wardogs_warcon"
    return (
        <SettingsStep
            id="panel-content"
            number={number}
            title={text.steps.content}
        >
            <StepSection title={c.show}>
                <SwitchRow
                    label={c.score.label}
                    help={c.score.help}
                    checked={draft.layout.showScoreboard}
                    disabled={ctx.disabled}
                    onChange={(showScoreboard) =>
                        ctx.update({
                            layout: { ...draft.layout, showScoreboard },
                        })
                    }
                />
                <SwitchRow
                    label={c.leaders.label}
                    help={c.leaders.help}
                    checked={draft.showLeaders}
                    disabled={ctx.disabled}
                    onChange={(showLeaders) => ctx.update({ showLeaders })}
                />
                {hll ? (
                    <>
                        <SwitchRow
                            label={c.nextMap.label}
                            checked={content.nextMap}
                            disabled={ctx.disabled}
                            onChange={(nextMap) => set({ nextMap })}
                        />
                        <SwitchRow
                            label={c.queue.label}
                            help={c.queue.help}
                            checked={content.queue}
                            disabled={ctx.disabled}
                            onChange={(queue) => set({ queue })}
                        />
                    </>
                ) : null}
            </StepSection>
            <StepSection title={c.connection} divided>
                {hll ? (
                    <SwitchRow
                        label={c.address.label}
                        help={
                            address
                                ? fill(c.address.help, { address })
                                : c.address.missing
                        }
                        checked={content.address}
                        disabled={ctx.disabled}
                        onChange={(value) => set({ address: value })}
                    >
                        {content.address ? (
                            <JoinInputs
                                ctx={ctx}
                                connectionId={draft.connectionId}
                                field="address"
                            />
                        ) : null}
                    </SwitchRow>
                ) : (
                    <SwitchRow
                        label={c.joinCode.label}
                        help={c.joinCode.help}
                        checked={content.joinCode}
                        disabled={ctx.disabled}
                        onChange={(joinCode) => set({ joinCode })}
                    >
                        {content.joinCode ? (
                            <JoinInputs
                                ctx={ctx}
                                connectionId={draft.connectionId}
                                field="joinCode"
                            />
                        ) : null}
                    </SwitchRow>
                )}
                <SwitchRow
                    label={c.joinButton.label}
                    help={
                        joinUrl
                            ? fill(
                                  hll
                                      ? c.joinButton.help
                                      : c.joinButton.helpWardogs,
                                  {
                                      url: joinUrl,
                                  }
                              )
                            : undefined
                    }
                    checked={content.joinButton}
                    disabled={ctx.disabled}
                    onChange={(joinButton) => set({ joinButton })}
                />
                {hll ? (
                    <SwitchRow
                        label={c.password.label}
                        checked={allowed && content.password}
                        disabled={!allowed || ctx.disabled}
                        onChange={(password) => set({ password })}
                    >
                        <PasswordInput
                            ctx={ctx}
                            connectionId={draft.connectionId}
                            label={c.password.field}
                            enabled={allowed && content.password}
                        />
                        {ctx.channelPrivate === false ? (
                            <p className="flex items-start gap-1.5 text-xs text-amber-800 dark:text-amber-300">
                                <Lock
                                    className="mt-px size-3.5 shrink-0"
                                    aria-hidden="true"
                                />
                                <span>
                                    <span className="font-semibold">
                                        {c.password.publicTitle}
                                    </span>{" "}
                                    {c.password.publicFix}
                                </span>
                            </p>
                        ) : ctx.channelPrivate === true ? (
                            <p className="flex items-start gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
                                <Check
                                    className="mt-px size-3.5 shrink-0"
                                    aria-hidden="true"
                                />
                                <span>
                                    <span className="font-semibold">
                                        {text.channel.private}
                                    </span>{" "}
                                    {text.channel.privatePassword}
                                </span>
                            </p>
                        ) : (
                            <p className="text-muted-foreground text-xs">
                                {c.password.unverified}
                            </p>
                        )}
                    </SwitchRow>
                ) : null}
            </StepSection>
            <StepSection title={c.buttons} divided>
                <SwitchRow
                    label={c.players.label}
                    help={c.players.help}
                    checked={draft.showPlayers}
                    disabled={ctx.disabled}
                    onChange={(showPlayers) => ctx.update({ showPlayers })}
                />
                <SwitchRow
                    label={c.report.label}
                    help={reportProvider ? c.report.help : c.report.provider}
                    checked={draft.report}
                    disabled={ctx.disabled || !reportProvider}
                    onChange={(report) => ctx.update({ report })}
                >
                    {draft.report ? (
                        ctx.ticketCategories.length ? (
                            <ReportCategory ctx={ctx} />
                        ) : (
                            <p className="text-muted-foreground text-xs">
                                {c.report.noCategories}{" "}
                                <InlineLink href={ctx.hrefs.tickets}>
                                    {c.ticketsLink}
                                </InlineLink>
                            </p>
                        )
                    ) : null}
                </SwitchRow>
            </StepSection>
            <StepSection title={c.seed} divided>
                <SwitchRow
                    label={c.seedProgress.label}
                    help={c.seedProgress.help}
                    checked={content.seedProgress}
                    disabled={ctx.disabled}
                    onChange={(seedProgress) => set({ seedProgress })}
                >
                    <p className="text-muted-foreground text-xs">
                        {c.seedNote}
                    </p>
                    <p className="text-xs">
                        <InlineLink href={ctx.hrefs.seed}>
                            {c.seedPlan}
                            <ArrowRight
                                className="size-3.5"
                                aria-hidden="true"
                            />
                        </InlineLink>
                    </p>
                </SwitchRow>
            </StepSection>
        </SettingsStep>
    )
}

function ReportCategory({ ctx }: { ctx: EditorContext }) {
    const c = ctx.dictionary.discordPanelsPage.editor.content
    const id = useId()
    return (
        <div className="space-y-1.5">
            <label htmlFor={id} className="block text-sm">
                {c.report.category}
            </label>
            <Select
                value={ctx.draft.reportCategoryId || undefined}
                disabled={ctx.disabled}
                onValueChange={(reportCategoryId) =>
                    ctx.update({ reportCategoryId })
                }
            >
                <SelectTrigger id={id} className="w-full rounded-lg">
                    <SelectValue placeholder={c.report.categoryPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                    {ctx.ticketCategories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                            {category.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <Lock className="size-3.5" aria-hidden="true" />
                <span>
                    {c.report.note}{" "}
                    <InlineLink href={ctx.hrefs.tickets}>
                        {c.ticketsLink}
                    </InlineLink>
                </span>
            </p>
        </div>
    )
}

/**
 * "Obsah" of the results panel (L3-31, L3-B05): the compact look, which
 * shows each result and its correction as a shorter card.
 */
export function ResultsContentStep({
    ctx,
    number,
}: {
    ctx: EditorContext
    number: number
}) {
    const text = ctx.dictionary.discordPanelsPage.editor
    const c = text.content
    const { draft } = ctx
    return (
        <SettingsStep
            id="panel-content"
            number={number}
            title={text.steps.content}
        >
            <StepSection title={c.show}>
                <SwitchRow
                    label={c.compact.label}
                    help={c.compact.help}
                    checked={draft.layout.compact}
                    disabled={ctx.disabled}
                    onChange={(compact) =>
                        ctx.update({ layout: { ...draft.layout, compact } })
                    }
                />
            </StepSection>
        </SettingsStep>
    )
}

export function ServersContentStep({
    ctx,
    number,
}: {
    ctx: EditorContext
    number: number
}) {
    const text = ctx.dictionary.discordPanelsPage.editor
    const c = text.content
    const { draft } = ctx
    const content = draft.content
    const set = (patch: Partial<typeof content>) =>
        ctx.update({ content: { ...content, ...patch } })
    const hllServers = draft.connectionIds.filter(
        (id) => gameOf(ctx, id) !== "wardogs"
    )
    const wdServers = draft.connectionIds.filter(
        (id) => gameOf(ctx, id) === "wardogs"
    )
    return (
        <SettingsStep
            id="panel-content"
            number={number}
            title={text.steps.content}
        >
            <StepSection title={c.show}>
                <SwitchRow
                    label={c.score.label}
                    checked={draft.layout.showScoreboard}
                    disabled={ctx.disabled}
                    onChange={(showScoreboard) =>
                        ctx.update({
                            layout: { ...draft.layout, showScoreboard },
                        })
                    }
                />
                <SwitchRow
                    label={c.nextMap.label}
                    checked={content.nextMap}
                    disabled={ctx.disabled}
                    onChange={(nextMap) => set({ nextMap })}
                />
                <SwitchRow
                    label={c.queue.label}
                    checked={content.queue}
                    disabled={ctx.disabled}
                    onChange={(queue) => set({ queue })}
                />
            </StepSection>
            <StepSection title={c.connection} divided>
                <SwitchRow
                    label={c.address.label}
                    help={c.address.helpCombined}
                    checked={content.address}
                    disabled={ctx.disabled}
                    onChange={(address) => set({ address })}
                >
                    {content.address
                        ? hllServers.map((id) => (
                              <JoinInputs
                                  key={id}
                                  ctx={ctx}
                                  connectionId={id}
                                  field="address"
                              />
                          ))
                        : null}
                </SwitchRow>
                <SwitchRow
                    label={c.joinCode.label}
                    help={c.joinCode.help}
                    checked={content.joinCode}
                    disabled={ctx.disabled}
                    onChange={(joinCode) => set({ joinCode })}
                >
                    {content.joinCode
                        ? wdServers.map((id) => (
                              <JoinInputs
                                  key={id}
                                  ctx={ctx}
                                  connectionId={id}
                                  field="joinCode"
                              />
                          ))
                        : null}
                </SwitchRow>
                <SwitchRow
                    label={c.joinButton.label}
                    help={c.joinButton.helpCombined}
                    checked={content.joinButton}
                    disabled={ctx.disabled}
                    onChange={(joinButton) => set({ joinButton })}
                />
                <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
                    <Lock
                        className="mt-px size-3.5 shrink-0"
                        aria-hidden="true"
                    />
                    {c.password.combined}
                </p>
            </StepSection>
            <StepSection title={c.seed} divided>
                <SwitchRow
                    label={c.seedProgress.label}
                    help={c.seedProgress.helpCombined}
                    checked={content.seedProgress}
                    disabled={ctx.disabled}
                    onChange={(seedProgress) => set({ seedProgress })}
                />
            </StepSection>
        </SettingsStep>
    )
}

export function LeagueContentStep({
    ctx,
    number,
    channelName,
}: {
    ctx: EditorContext
    number: number
    channelName: string | null
}) {
    const text = ctx.dictionary.discordPanelsPage.editor
    const l = text.league
    const league = ctx.draft.league
    const set = (patch: Partial<typeof league>) =>
        ctx.update({ league: { ...league, ...patch } })
    const id = useId()
    const rows: Array<
        [
            "table" | "fixtures" | "recentResults",
            { label: string; help: string },
        ]
    > = [
        ["table", l.table],
        ["fixtures", l.fixtures],
        ["recentResults", l.recent],
    ]
    return (
        <SettingsStep
            id="panel-content"
            number={number}
            title={text.steps.contentLeague}
        >
            <div className="space-y-3">
                {rows.map(([key, copy]) => (
                    <div key={key} className="flex items-start gap-2.5">
                        <Checkbox
                            id={`${id}-${key}`}
                            checked={league[key]}
                            disabled={ctx.disabled}
                            onCheckedChange={(checked) =>
                                set({ [key]: checked === true })
                            }
                            className="mt-0.5"
                        />
                        <div>
                            <label htmlFor={`${id}-${key}`} className="text-sm">
                                {copy.label}
                            </label>
                            <p className="text-muted-foreground text-xs">
                                {copy.help}
                            </p>
                        </div>
                    </div>
                ))}
                <Field
                    label={l.count.label}
                    htmlFor={`${id}-count`}
                    help={l.count.help}
                >
                    <Input
                        id={`${id}-count`}
                        type="number"
                        min={1}
                        max={10}
                        inputMode="numeric"
                        value={league.fixtureCount}
                        disabled={ctx.disabled || !league.fixtures}
                        className="w-20 rounded-lg"
                        onChange={(event) =>
                            set({
                                fixtureCount: Math.max(
                                    1,
                                    Math.min(
                                        10,
                                        Math.trunc(
                                            Number(event.target.value)
                                        ) || 1
                                    )
                                ),
                            })
                        }
                    />
                </Field>
                <Note icon={<Info className="size-3.5" aria-hidden="true" />}>
                    {fill(l.note, {
                        channel: channelName ?? l.channelFallback,
                    })}
                </Note>
            </div>
        </SettingsStep>
    )
}

// ---- 5 · Vzhled --------------------------------------------------------------------

function Collapsible({
    collapsed,
    summary,
    onToggle,
    editLabel,
    children,
}: {
    collapsed: boolean
    summary: string
    onToggle: () => void
    editLabel: string
    children: ReactNode
}) {
    return collapsed ? (
        <div className="flex items-start justify-between gap-3">
            <p className="text-muted-foreground text-[13px]">{summary}</p>
            <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 rounded-lg"
                onClick={onToggle}
            >
                {editLabel}
            </Button>
        </div>
    ) : (
        <>{children}</>
    )
}

export function LookStep({
    ctx,
    number,
    collapsed,
    onToggle,
    defaultTitle,
}: {
    ctx: EditorContext
    number: number
    collapsed: boolean
    onToggle: () => void
    defaultTitle: string
}) {
    const text = ctx.dictionary.discordPanelsPage.editor
    const look = text.look
    const styles = ctx.dictionary.panelGraphicsPage.style.options
    const { draft } = ctx
    const id = useId()
    const accentName = useId()
    const styleName = useId()
    // P7-19: "Naše servery" has the three styles as well.
    const hasStyle = draft.kind === "server" || draft.kind === "servers"
    const summary = [
        draft.title.trim()
            ? fill(look.summary.title, { title: draft.title.trim() })
            : look.summary.titleDefault,
        draft.description.trim()
            ? look.summary.description
            : look.summary.noDescription,
        ...(hasStyle
            ? [
                  draft.bannerAssetId
                      ? look.summary.banner
                      : look.summary.noBanner,
              ]
            : []),
        draft.accent === "custom"
            ? fill(look.summary.accentCustom, { color: draft.accentColor })
            : look.summary.accentClan,
        ...(hasStyle && draft.style ? [styles[draft.style].title] : []),
    ].join(" · ")
    const accentInvalid =
        draft.accent === "custom" &&
        !/^#[0-9a-fA-F]{6}$/.test(draft.accentColor.trim())
    return (
        <SettingsStep
            id="panel-look"
            number={number}
            title={text.steps.look}
            actions={
                collapsed ? null : (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="rounded-lg"
                        onClick={onToggle}
                    >
                        {text.collapse}
                    </Button>
                )
            }
        >
            <Collapsible
                collapsed={collapsed}
                summary={summary}
                onToggle={onToggle}
                editLabel={text.edit}
            >
                <div className="space-y-4">
                    <Field
                        label={look.title.label}
                        htmlFor={`${id}-title`}
                        help={look.title.help}
                    >
                        <Input
                            id={`${id}-title`}
                            value={draft.title}
                            maxLength={80}
                            placeholder={defaultTitle}
                            disabled={ctx.disabled}
                            className="rounded-lg"
                            onChange={(event) =>
                                ctx.update({ title: event.target.value })
                            }
                        />
                    </Field>
                    <Field
                        label={look.description.label}
                        htmlFor={`${id}-description`}
                        help={look.description.help}
                    >
                        <Textarea
                            id={`${id}-description`}
                            value={draft.description}
                            maxLength={300}
                            rows={2}
                            disabled={ctx.disabled}
                            className="rounded-lg"
                            onChange={(event) =>
                                ctx.update({ description: event.target.value })
                            }
                        />
                    </Field>
                    {hasStyle ? (
                        <BannerField
                            serverId={ctx.serverId}
                            value={{
                                assetId: draft.bannerAssetId,
                                url: draft.bannerUrl,
                            }}
                            disabled={ctx.disabled}
                            onChange={(banner) =>
                                ctx.update({
                                    bannerAssetId: banner.assetId,
                                    bannerUrl: banner.url,
                                })
                            }
                            onUploadingChange={ctx.setUploading}
                            dictionary={ctx.dictionary}
                        />
                    ) : null}
                    <fieldset className="space-y-2">
                        <legend className="text-sm">{look.accent.label}</legend>
                        <div className="grid gap-2 sm:grid-cols-2">
                            {(["clan", "custom"] as const).map((value) => (
                                <label
                                    key={value}
                                    className={cn(
                                        "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5",
                                        draft.accent === value &&
                                            "border-foreground ring-foreground ring-1"
                                    )}
                                >
                                    <input
                                        type="radio"
                                        name={accentName}
                                        checked={draft.accent === value}
                                        disabled={ctx.disabled}
                                        onChange={() =>
                                            ctx.update({ accent: value })
                                        }
                                        className="accent-foreground"
                                    />
                                    <span
                                        aria-hidden="true"
                                        className={cn(
                                            "size-6 shrink-0 rounded-md border",
                                            value === "custom" &&
                                                draft.accent !== "custom" &&
                                                "bg-[repeating-linear-gradient(45deg,#e5e7eb_0_4px,#f9fafb_4px_8px)]"
                                        )}
                                        style={
                                            value === "clan"
                                                ? {
                                                      backgroundColor:
                                                          ctx.clanAccentHex,
                                                  }
                                                : draft.accent === "custom" &&
                                                    !accentInvalid
                                                  ? {
                                                        backgroundColor:
                                                            draft.accentColor,
                                                    }
                                                  : undefined
                                        }
                                    />
                                    <span className="min-w-0">
                                        <span className="block text-sm">
                                            {value === "clan"
                                                ? look.accent.clan
                                                : look.accent.custom}
                                        </span>
                                        <span
                                            className={cn(
                                                "text-muted-foreground block text-[11px]",
                                                value === "clan" && "font-mono"
                                            )}
                                        >
                                            {value === "clan"
                                                ? ctx.clanAccentHex.toUpperCase()
                                                : look.accent.customHelp}
                                        </span>
                                    </span>
                                </label>
                            ))}
                        </div>
                        {draft.accent === "custom" ? (
                            <div className="flex items-center gap-2">
                                <span className="relative size-9 shrink-0 overflow-hidden rounded-lg border">
                                    <span
                                        aria-hidden="true"
                                        className="absolute inset-0"
                                        style={{
                                            backgroundColor: accentInvalid
                                                ? "#ffffff"
                                                : draft.accentColor,
                                        }}
                                    />
                                    <input
                                        type="color"
                                        aria-label={look.accent.picker}
                                        value={
                                            accentInvalid
                                                ? "#2bb3a3"
                                                : draft.accentColor.toLowerCase()
                                        }
                                        disabled={ctx.disabled}
                                        onChange={(event) =>
                                            ctx.update({
                                                accentColor:
                                                    event.target.value.toUpperCase(),
                                            })
                                        }
                                        className="absolute inset-0 size-full cursor-pointer opacity-0"
                                    />
                                </span>
                                <Input
                                    aria-label={look.accent.field}
                                    value={draft.accentColor}
                                    maxLength={7}
                                    spellCheck={false}
                                    disabled={ctx.disabled}
                                    aria-invalid={accentInvalid || undefined}
                                    className="w-28 rounded-lg font-mono uppercase"
                                    onChange={(event) =>
                                        ctx.update({
                                            accentColor: event.target.value,
                                        })
                                    }
                                />
                                {accentInvalid ? (
                                    <span
                                        role="alert"
                                        className="text-destructive text-xs"
                                    >
                                        {look.accent.invalid}
                                    </span>
                                ) : null}
                            </div>
                        ) : null}
                    </fieldset>
                    {hasStyle ? (
                        <fieldset className="space-y-2">
                            <legend className="text-sm">
                                {look.style.label}
                            </legend>
                            <div className="grid gap-2">
                                {([null, ...PANEL_STYLES] as const).map(
                                    (style) => (
                                        <label
                                            key={style ?? "clan"}
                                            className={cn(
                                                "flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2",
                                                draft.style === style &&
                                                    "border-foreground ring-foreground ring-1"
                                            )}
                                        >
                                            <input
                                                type="radio"
                                                name={styleName}
                                                checked={draft.style === style}
                                                disabled={ctx.disabled}
                                                onChange={() =>
                                                    ctx.update({ style })
                                                }
                                                className="accent-foreground mt-1"
                                            />
                                            <span className="min-w-0">
                                                <span className="block text-sm">
                                                    {style
                                                        ? styles[style].title
                                                        : look.style.clan}
                                                </span>
                                                <span className="text-muted-foreground block text-xs">
                                                    {style
                                                        ? styles[style]
                                                              .description
                                                        : fill(
                                                              look.style
                                                                  .clanHelp,
                                                              {
                                                                  style: styles[
                                                                      ctx
                                                                          .defaultStyle
                                                                  ].title,
                                                              }
                                                          )}
                                                </span>
                                            </span>
                                        </label>
                                    )
                                )}
                            </div>
                            <p className="text-muted-foreground text-xs">
                                {look.style.help}{" "}
                                <InlineLink href={ctx.hrefs.graphics}>
                                    {look.style.link}
                                </InlineLink>
                            </p>
                        </fieldset>
                    ) : null}
                </div>
            </Collapsible>
        </SettingsStep>
    )
}

// ---- 6 · Obnova --------------------------------------------------------------------

export function RefreshStep({
    ctx,
    number,
    collapsed,
    onToggle,
}: {
    ctx: EditorContext
    number: number
    collapsed: boolean
    onToggle: () => void
}) {
    const text = ctx.dictionary.discordPanelsPage.editor
    const r = text.refresh
    const live = ctx.draft.kind === "server" || ctx.draft.kind === "servers"
    const footer = ctx.draft.content.footerTiming
    return (
        <SettingsStep
            id="panel-refresh"
            number={number}
            title={text.steps.refresh}
            actions={
                collapsed ? null : (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="rounded-lg"
                        onClick={onToggle}
                    >
                        {text.collapse}
                    </Button>
                )
            }
        >
            <Collapsible
                collapsed={collapsed}
                summary={footer || !live ? r.summaryFooter : r.summaryNoFooter}
                onToggle={onToggle}
                editLabel={text.edit}
            >
                <div className="space-y-3">
                    <span className="bg-muted inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[13px]">
                        <Lock className="size-3.5" aria-hidden="true" />
                        {r.locked}
                    </span>
                    {live ? (
                        <SwitchRow
                            label={r.footer.label}
                            help={r.footer.help}
                            checked={footer}
                            disabled={ctx.disabled}
                            onChange={(footerTiming) =>
                                ctx.update({
                                    content: {
                                        ...ctx.draft.content,
                                        footerTiming,
                                    },
                                })
                            }
                        />
                    ) : null}
                </div>
            </Collapsible>
        </SettingsStep>
    )
}
