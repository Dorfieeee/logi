"use client"

import { ManageGroupsLink } from "@/components/app/manage-groups-link"

import {
    AlertTriangle,
    CalendarClock,
    Check,
    Megaphone,
    Plus,
    Settings2,
    Trash2,
    UserPlus,
    Users,
    type LucideIcon,
} from "lucide-react"
import { useEffect, useMemo, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import Link from "next/link"

import {
    SIGNUP_STATUSES,
    defaultMatchTemplate,
    templateSchedule,
    type MatchTemplate,
    type MatchTemplateError,
} from "@/domain/events/match-templates"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    reminderAudience,
    reminderStatusesFor,
    type ReminderAudience,
} from "@/domain/events/new-match-flow"
import type {
    EventCategory,
    Group,
    SquadPreset,
    TopicPreset,
} from "@/types/domain"
import { DiscordMultiEntitySelect } from "@/components/app/discord-multi-entity-select"
import { ATTENDANCE_REMINDER_OFFSETS } from "@/domain/events/scheduled-job-policy"
import type { DiscordSelectOption } from "@/components/app/discord-entity-select"
import { ConfirmActionDialog } from "@/components/app/confirm-action-dialog"
import { MAX_SIGNUP_GROUP_LIMIT } from "@/domain/events/upsert-policy"
import { GAME_LABELS, type GameId } from "@/domain/games/game"
import { EmptyState } from "@/components/app/empty-state"
import type { Dictionary } from "@/i18n/dictionaries"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const NONE = "__none"
const ALL_GAMES = "__all"
/** The example timeline shows a Sunday 20:00 start, as in the design. */
const EXAMPLE_START = "2026-10-11T20:00:00.000Z"
const DEFAULT_LIMIT = 6

const GAME_SHORT: Record<GameId, string> = {
    hell_let_loose: "HLL",
    hell_let_loose_vietnam: "HLL V",
    wardogs: "Wardogs",
    world_of_warcraft_forever: "WoW:F",
}

function Section({
    id,
    title,
    icon: Icon,
    children,
}: {
    id: string
    title: string
    icon: LucideIcon
    children: ReactNode
}) {
    return (
        <section
            aria-labelledby={id}
            className="bg-card text-card-foreground border-border rounded-[14px] border px-5 pt-4 pb-5 shadow-xs"
        >
            <div className="border-border/60 flex items-center gap-2 border-b pb-3">
                <Icon className="size-[18px]" aria-hidden />
                <h2 id={id} className="text-base font-semibold">
                    {title}
                </h2>
            </div>
            <div className="divide-border/60 flex flex-col divide-y">
                {children}
            </div>
        </section>
    )
}

function Row({
    label,
    hint,
    htmlFor,
    labelId,
    children,
}: {
    label: string
    hint?: string
    htmlFor?: string
    labelId?: string
    children: ReactNode
}) {
    return (
        <div className="grid gap-3 py-4 last:pb-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] sm:gap-6">
            <div className="flex flex-col gap-0.5">
                {htmlFor ? (
                    <Label htmlFor={htmlFor} className="text-sm font-medium">
                        {label}
                    </Label>
                ) : (
                    <span id={labelId} className="text-sm font-medium">
                        {label}
                    </span>
                )}
                {hint ? (
                    <span className="text-muted-foreground text-xs leading-snug">
                        {hint}
                    </span>
                ) : null}
            </div>
            <div className="min-w-0">{children}</div>
        </div>
    )
}

function Chip({
    pressed,
    onClick,
    check = true,
    children,
}: {
    pressed: boolean
    onClick: () => void
    /** Pressed chips show a check mark, except plain choices such as hours. */
    check?: boolean
    children: ReactNode
}) {
    return (
        <button
            type="button"
            aria-pressed={pressed}
            onClick={onClick}
            className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
                pressed
                    ? "border-foreground text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
            )}
        >
            {pressed && check ? (
                <Check className="size-3" strokeWidth={3} aria-hidden />
            ) : null}
            {children}
        </button>
    )
}

function NumberField({
    id,
    label,
    value,
    unit,
    min = 0,
    onChange,
}: {
    id: string
    label: string
    value: number
    unit: string
    min?: number
    onChange: (value: number) => void
}) {
    return (
        <div className="flex flex-col gap-1.5">
            <Label htmlFor={id} className="text-sm font-medium">
                {label}
            </Label>
            <div className="flex items-center gap-2">
                <Input
                    id={id}
                    type="number"
                    inputMode="numeric"
                    min={min}
                    step={1}
                    value={Number.isFinite(value) ? value : ""}
                    onChange={(event) =>
                        onChange(
                            Math.max(
                                min,
                                Math.trunc(Number(event.target.value))
                            )
                        )
                    }
                    className="h-9 w-[4.5rem]"
                />
                <span className="text-muted-foreground text-xs leading-tight">
                    {unit}
                </span>
            </div>
        </div>
    )
}

function Segmented<T extends string>({
    labelledBy,
    value,
    options,
    onChange,
}: {
    labelledBy: string
    value: T
    options: Array<{ value: T; label: string }>
    onChange(value: T): void
}) {
    return (
        <div
            role="radiogroup"
            aria-labelledby={labelledBy}
            className="bg-muted flex gap-0.5 rounded-[10px] p-[3px]"
        >
            {options.map((option) => (
                <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={option.value === value}
                    onClick={() => onChange(option.value)}
                    className={cn(
                        "h-8 flex-1 rounded-lg px-2 text-[13px] transition-colors focus-visible:ring-2 focus-visible:outline-none",
                        option.value === value
                            ? "bg-background text-foreground font-semibold shadow-sm"
                            : "text-muted-foreground hover:text-foreground font-medium"
                    )}
                >
                    {option.label}
                </button>
            ))}
        </div>
    )
}

function statusLabel(
    status: (typeof SIGNUP_STATUSES)[number],
    dictionary: Dictionary
) {
    switch (status) {
        case "member":
            return dictionary.newMatch.signups.statuses.member
        case "recruit":
            return dictionary.newMatch.signups.statuses.recruit
        case "reserve_member":
            return dictionary.newMatch.signups.statuses.reserve_member
        case "mercenary":
            return dictionary.newMatch.signups.statuses.mercenary
    }
}

function newTemplateId() {
    return `tpl_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`
}

/** Settings › Match templates (design D1): what a new match or training starts with. */
export function MatchTemplatesSettings({
    serverId,
    templates: savedTemplates,
    categories,
    groups: initialGroups,
    topicPresets,
    squadPresets,
    enabledGames,
    announcementChannelId,
    channelsHref,
    locale,
    dictionary,
}: {
    serverId: string
    templates: MatchTemplate[]
    categories: EventCategory[]
    groups: Group[]
    topicPresets: TopicPreset[]
    squadPresets: SquadPreset[]
    enabledGames: readonly GameId[]
    /** The clan's announcement channel from Channels and language. */
    announcementChannelId?: string
    channelsHref: string
    locale: string
    dictionary: Dictionary
}) {
    const text = dictionary.matchTemplates
    const router = useRouter()
    const [templates, setTemplates] = useState(savedTemplates)
    const [groups, setGroups] = useState(initialGroups)
    const [selectedId, setSelectedId] = useState(savedTemplates[0]?.id)
    const [saving, setSaving] = useState(false)
    const [metadata, setMetadata] = useState<{
        roles: DiscordSelectOption[]
        channels: DiscordSelectOption[]
    }>({ roles: [], channels: [] })
    const dirty = JSON.stringify(templates) !== JSON.stringify(savedTemplates)
    const selected = templates.find((template) => template.id === selectedId)

    const receiveGroups = (next: Group[]) => {
        setGroups(next)
        const ids = new Set(next.map((group) => group.id))
        setTemplates((current) =>
            current.map((template) => ({
                ...template,
                signupGroupIds: template.signupGroupIds?.filter((id) =>
                    ids.has(id)
                ),
                signupGroupLimits: template.signupGroupLimits?.filter((limit) =>
                    ids.has(limit.groupId)
                ),
            }))
        )
    }

    useEffect(() => {
        fetch(`/api/servers/${serverId}/discord-metadata`)
            .then(async (response) => {
                const body = (await response.json()) as {
                    roles?: DiscordSelectOption[]
                    channels?: DiscordSelectOption[]
                }
                if (response.ok)
                    setMetadata({
                        roles: Array.isArray(body.roles) ? body.roles : [],
                        channels: Array.isArray(body.channels)
                            ? body.channels
                            : [],
                    })
            })
            .catch(() => setMetadata({ roles: [], channels: [] }))
    }, [serverId])

    function update(patch: Partial<MatchTemplate>) {
        if (!selected) return
        setTemplates((current) =>
            current.map((template) =>
                template.id === selected.id
                    ? { ...template, ...patch }
                    : template
            )
        )
    }

    function addTemplate() {
        const template = defaultMatchTemplate(newTemplateId(), text.newName)
        setTemplates((current) => [...current, template])
        setSelectedId(template.id)
    }

    function removeSelected() {
        if (!selected) return
        const remaining = templates.filter(
            (template) => template.id !== selected.id
        )
        setTemplates(remaining)
        setSelectedId(remaining[0]?.id)
    }

    async function save() {
        setSaving(true)
        try {
            const response = await fetch(
                `/api/servers/${serverId}/match-templates`,
                {
                    method: "PUT",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ templates }),
                }
            )
            const body = (await response.json().catch(() => null)) as {
                ok?: boolean
                error?: MatchTemplateError | string
                index?: number
                templates?: MatchTemplate[]
            } | null
            if (!response.ok || !body?.ok) {
                const reason =
                    body?.error && body.error in text.errors
                        ? text.errors[body.error as keyof typeof text.errors]
                        : response.status === 403
                          ? text.errors.forbidden
                          : text.errors.save_failed
                const name =
                    body?.index !== undefined
                        ? templates[body.index]?.name
                        : undefined
                toast.error(name ? `${name}: ${reason}` : reason)
                if (body?.index !== undefined && templates[body.index])
                    setSelectedId(templates[body.index].id)
                return
            }
            setTemplates(body.templates ?? templates)
            toast.success(text.saved)
            router.refresh()
        } finally {
            setSaving(false)
        }
    }

    const gameGroups = useMemo(
        () =>
            selected?.gameId
                ? groups
                      .filter(
                          (group) =>
                              (group.gameId ?? "hell_let_loose") ===
                              selected.gameId
                      )
                      .sort((left, right) => left.order - right.order)
                : [],
        [groups, selected?.gameId]
    )
    const gamePresets = squadPresets.filter(
        (preset) =>
            selected?.gameId &&
            (preset.gameId ?? "hell_let_loose") === selected.gameId
    )
    const example = selected ? templateSchedule(selected, EXAMPLE_START) : null
    const intl = locale === "cs" ? "cs-CZ" : locale === "de" ? "de-DE" : "en-GB"
    const exampleFormat = new Intl.DateTimeFormat(intl, {
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
    })
    const isMatch = selected?.kind === "match"
    const channelName = announcementChannelId
        ? (metadata.channels.find(
              (channel) => channel.id === announcementChannelId
          )?.name ?? announcementChannelId)
        : null
    const audience = selected
        ? reminderAudience(selected.signupReminderStatuses)
        : "off"
    const limitOf = (groupId: string) =>
        selected?.signupGroupLimits?.find((limit) => limit.groupId === groupId)
            ?.max
    function setLimit(groupId: string, max: number | null) {
        if (!selected) return
        const others = (selected.signupGroupLimits ?? []).filter(
            (limit) => limit.groupId !== groupId
        )
        update({
            signupGroupLimits:
                max === null ? others : [...others, { groupId, max }],
        })
    }
    const reminderHours = selected?.attendanceReminderHours ?? [
        ...ATTENDANCE_REMINDER_OFFSETS,
    ]

    return (
        <div className="flex flex-col gap-4">
            <div
                role="group"
                aria-label={text.chooserLabel}
                className="flex flex-wrap gap-2"
            >
                {templates.map((template) => {
                    const pressed = template.id === selectedId
                    return (
                        <button
                            key={template.id}
                            type="button"
                            aria-pressed={pressed}
                            onClick={() => setSelectedId(template.id)}
                            className={cn(
                                "inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none",
                                pressed
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-border hover:bg-muted/60"
                            )}
                        >
                            {template.name}
                            <span
                                className={cn(
                                    "text-xs font-normal",
                                    pressed
                                        ? "text-primary-foreground/70"
                                        : "text-muted-foreground"
                                )}
                            >
                                {template.gameId
                                    ? GAME_SHORT[template.gameId]
                                    : text.allGames}
                            </span>
                        </button>
                    )
                })}
                <Button
                    type="button"
                    variant="outline"
                    className="h-9 rounded-lg border-dashed"
                    onClick={addTemplate}
                >
                    <Plus className="size-4" aria-hidden="true" />
                    {text.add}
                </Button>
            </div>

            {!selected ? (
                <EmptyState
                    title={text.emptyTitle}
                    description={text.emptyDescription}
                    actions={
                        <Button
                            type="button"
                            className="rounded-xl"
                            onClick={addTemplate}
                        >
                            {text.add}
                        </Button>
                    }
                />
            ) : (
                <>
                    <Section
                        id="tpl-times"
                        title={text.times.title}
                        icon={CalendarClock}
                    >
                        <div className="flex flex-col gap-4 pt-4">
                            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(130px,100%),1fr))] gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <Label
                                        htmlFor="tpl-announce"
                                        className="text-sm font-medium"
                                    >
                                        {text.times.announcement}
                                    </Label>
                                    <Select
                                        value={
                                            selected.announcementHoursBeforeStart ===
                                            undefined
                                                ? "now"
                                                : "before"
                                        }
                                        onValueChange={(mode) =>
                                            update({
                                                announcementHoursBeforeStart:
                                                    mode === "now"
                                                        ? undefined
                                                        : (selected.announcementHoursBeforeStart ??
                                                          72),
                                            })
                                        }
                                    >
                                        <SelectTrigger
                                            id="tpl-announce"
                                            className="h-9 w-full"
                                        >
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="now">
                                                {text.times.immediately}
                                            </SelectItem>
                                            <SelectItem value="before">
                                                {text.times.scheduled}
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                    {selected.announcementHoursBeforeStart !==
                                    undefined ? (
                                        <div className="flex items-center gap-2">
                                            <Input
                                                type="number"
                                                inputMode="numeric"
                                                aria-label={
                                                    text.times.hoursBeforeStart
                                                }
                                                min={0}
                                                value={
                                                    selected.announcementHoursBeforeStart
                                                }
                                                onChange={(event) =>
                                                    update({
                                                        announcementHoursBeforeStart:
                                                            Math.max(
                                                                0,
                                                                Math.trunc(
                                                                    Number(
                                                                        event
                                                                            .target
                                                                            .value
                                                                    )
                                                                )
                                                            ),
                                                    })
                                                }
                                                className="h-9 w-[4.5rem]"
                                            />
                                            <span className="text-muted-foreground text-xs">
                                                {text.times.hoursBeforeStart}
                                            </span>
                                        </div>
                                    ) : null}
                                </div>
                                <NumberField
                                    id="tpl-reg"
                                    label={text.times.registrationEnd}
                                    value={
                                        selected.registrationHoursBeforeMeeting
                                    }
                                    unit={text.times.hoursBeforeMeeting}
                                    onChange={(value) =>
                                        update({
                                            registrationHoursBeforeMeeting:
                                                value,
                                        })
                                    }
                                />
                                {isMatch ? (
                                    <NumberField
                                        id="tpl-meet"
                                        label={text.times.meeting}
                                        value={
                                            selected.meetingMinutesBeforeStart
                                        }
                                        unit={text.times.minutesBeforeStart}
                                        onChange={(value) =>
                                            update({
                                                meetingMinutesBeforeStart:
                                                    value,
                                            })
                                        }
                                    />
                                ) : null}
                                <NumberField
                                    id="tpl-dur"
                                    label={text.times.duration}
                                    value={selected.durationMinutes}
                                    unit={text.times.minutes}
                                    min={1}
                                    onChange={(value) =>
                                        update({ durationMinutes: value })
                                    }
                                />
                            </div>
                            {example ? (
                                <figure className="bg-muted/50 m-0 rounded-[10px] px-4 py-3">
                                    <figcaption className="text-muted-foreground mb-3 text-xs">
                                        {text.times.exampleCaption}
                                    </figcaption>
                                    <ol className="m-0 grid list-none grid-cols-2 gap-y-3 p-0 sm:grid-cols-5">
                                        {[
                                            {
                                                label: text.times.announcement,
                                                value: example.registrationStart
                                                    ? exampleFormat.format(
                                                          new Date(
                                                              example.registrationStart
                                                          )
                                                      )
                                                    : text.times.onPublish,
                                            },
                                            {
                                                label: text.times
                                                    .registrationEnd,
                                                value: exampleFormat.format(
                                                    new Date(
                                                        example.registrationEnd
                                                    )
                                                ),
                                            },
                                            ...(isMatch
                                                ? [
                                                      {
                                                          label: text.times
                                                              .meeting,
                                                          value: exampleFormat.format(
                                                              new Date(
                                                                  example.meetingStart
                                                              )
                                                          ),
                                                      },
                                                  ]
                                                : []),
                                            {
                                                label: text.times.start,
                                                value: exampleFormat.format(
                                                    new Date(example.gameStart)
                                                ),
                                            },
                                            {
                                                label: text.times.end,
                                                value: exampleFormat.format(
                                                    new Date(example.gameEnd)
                                                ),
                                            },
                                        ].map((step, index, steps) => (
                                            <li
                                                key={step.label}
                                                className="flex flex-col gap-0.5"
                                            >
                                                <span
                                                    aria-hidden
                                                    className="mb-1.5 flex items-center"
                                                >
                                                    <span className="bg-foreground size-2 shrink-0 rounded-full" />
                                                    {index <
                                                    steps.length - 1 ? (
                                                        <span className="bg-border mx-1 hidden h-px flex-1 sm:block" />
                                                    ) : null}
                                                </span>
                                                <span className="text-xs font-medium">
                                                    {step.label}
                                                </span>
                                                <span className="text-muted-foreground text-xs">
                                                    {step.value}
                                                </span>
                                            </li>
                                        ))}
                                    </ol>
                                </figure>
                            ) : null}
                        </div>
                    </Section>

                    {isMatch ? (
                        <Section
                            id="tpl-signup"
                            title={text.signup.title}
                            icon={UserPlus}
                        >
                            <Row
                                label={text.signup.who}
                                hint={text.signup.whoHint}
                                labelId="tpl-who"
                            >
                                <div
                                    role="group"
                                    aria-labelledby="tpl-who"
                                    className="flex flex-wrap gap-2"
                                >
                                    {SIGNUP_STATUSES.map((status) => {
                                        const allowed =
                                            !selected.allowedSignupStatuses
                                                .length ||
                                            selected.allowedSignupStatuses.includes(
                                                status
                                            )
                                        return (
                                            <Chip
                                                key={status}
                                                pressed={allowed}
                                                onClick={() => {
                                                    const current = selected
                                                        .allowedSignupStatuses
                                                        .length
                                                        ? selected.allowedSignupStatuses
                                                        : [...SIGNUP_STATUSES]
                                                    const next = allowed
                                                        ? current.filter(
                                                              (item) =>
                                                                  item !==
                                                                  status
                                                          )
                                                        : [...current, status]
                                                    update({
                                                        // Everyone allowed is stored as no restriction.
                                                        allowedSignupStatuses:
                                                            next.length ===
                                                                SIGNUP_STATUSES.length ||
                                                            !next.length
                                                                ? []
                                                                : next,
                                                    })
                                                }}
                                            >
                                                {statusLabel(
                                                    status,
                                                    dictionary
                                                )}
                                            </Chip>
                                        )
                                    })}
                                </div>
                            </Row>
                            <Row
                                label={text.signup.groups}
                                hint={text.signup.groupsHint}
                                labelId="tpl-groups"
                            >
                                <div className="flex flex-col gap-3">
                                    {selected.gameId ? (
                                        gameGroups.length ? (
                                            gameGroups.map((group) => {
                                                const checked =
                                                    !selected.signupGroupIds ||
                                                    selected.signupGroupIds.includes(
                                                        group.id
                                                    )
                                                const limit = limitOf(group.id)
                                                return (
                                                    <div
                                                        key={group.id}
                                                        className="flex min-h-9 items-center gap-3 text-sm"
                                                    >
                                                        <Switch
                                                            id={`tpl-group-${group.id}`}
                                                            checked={checked}
                                                            onCheckedChange={(
                                                                value
                                                            ) => {
                                                                const current =
                                                                    selected.signupGroupIds ??
                                                                    gameGroups.map(
                                                                        (
                                                                            item
                                                                        ) =>
                                                                            item.id
                                                                    )
                                                                update({
                                                                    signupGroupIds:
                                                                        value
                                                                            ? [
                                                                                  ...current,
                                                                                  group.id,
                                                                              ]
                                                                            : current.filter(
                                                                                  (
                                                                                      id
                                                                                  ) =>
                                                                                      id !==
                                                                                      group.id
                                                                              ),
                                                                })
                                                            }}
                                                        />
                                                        <Label
                                                            htmlFor={`tpl-group-${group.id}`}
                                                            className="flex-1 text-sm font-normal"
                                                        >
                                                            {group.name}
                                                        </Label>
                                                        {checked ? (
                                                            limit ===
                                                            undefined ? (
                                                                <button
                                                                    type="button"
                                                                    aria-label={text.signup.setLimit.replace(
                                                                        "{group}",
                                                                        group.name
                                                                    )}
                                                                    onClick={() =>
                                                                        setLimit(
                                                                            group.id,
                                                                            DEFAULT_LIMIT
                                                                        )
                                                                    }
                                                                    className="text-muted-foreground hover:text-foreground text-[13px] underline-offset-[3px] hover:underline"
                                                                >
                                                                    {
                                                                        text
                                                                            .signup
                                                                            .noLimit
                                                                    }
                                                                </button>
                                                            ) : (
                                                                <label className="text-muted-foreground flex items-center gap-2 text-[13px]">
                                                                    {
                                                                        text
                                                                            .signup
                                                                            .max
                                                                    }
                                                                    <Input
                                                                        type="number"
                                                                        inputMode="numeric"
                                                                        min={0}
                                                                        max={
                                                                            MAX_SIGNUP_GROUP_LIMIT
                                                                        }
                                                                        aria-label={text.signup.limitFor.replace(
                                                                            "{group}",
                                                                            group.name
                                                                        )}
                                                                        value={
                                                                            limit
                                                                        }
                                                                        onChange={(
                                                                            event
                                                                        ) => {
                                                                            const next =
                                                                                Math.trunc(
                                                                                    Number(
                                                                                        event
                                                                                            .target
                                                                                            .value
                                                                                    )
                                                                                )
                                                                            // Zero or empty removes the cap.
                                                                            setLimit(
                                                                                group.id,
                                                                                next >=
                                                                                    1
                                                                                    ? Math.min(
                                                                                          MAX_SIGNUP_GROUP_LIMIT,
                                                                                          next
                                                                                      )
                                                                                    : null
                                                                            )
                                                                        }}
                                                                        className="text-foreground h-9 w-[3.25rem]"
                                                                    />
                                                                </label>
                                                            )
                                                        ) : null}
                                                    </div>
                                                )
                                            })
                                        ) : (
                                            <p className="text-muted-foreground text-sm">
                                                {text.signup.noGroups}
                                            </p>
                                        )
                                    ) : (
                                        <p className="text-muted-foreground text-sm">
                                            {text.signup.groupsAllGames}
                                        </p>
                                    )}
                                    <ManageGroupsLink
                                        serverId={serverId}
                                        locale={locale}
                                        gameId={selected.gameId}
                                        dictionary={dictionary}
                                        onGroupsUpdated={receiveGroups}
                                    />
                                    <div className="flex min-h-9 items-center gap-3 text-sm">
                                        <Switch
                                            id="tpl-general"
                                            checked={selected.useGeneralSignup}
                                            onCheckedChange={(value) =>
                                                update({
                                                    useGeneralSignup: value,
                                                })
                                            }
                                        />
                                        <Label
                                            htmlFor="tpl-general"
                                            className="text-sm font-normal"
                                        >
                                            {text.signup.general}
                                        </Label>
                                    </div>
                                </div>
                            </Row>
                            <Row
                                label={text.signup.reminder}
                                hint={text.signup.reminderHint}
                                htmlFor="tpl-reminder"
                            >
                                <div className="grid grid-cols-[repeat(auto-fit,minmax(min(150px,100%),1fr))] gap-2">
                                    <Select
                                        value={
                                            audience === "off" ? "off" : "daily"
                                        }
                                        onValueChange={(value) =>
                                            update({
                                                signupReminderStatuses:
                                                    value === "off"
                                                        ? []
                                                        : reminderStatusesFor(
                                                              "member"
                                                          ),
                                            })
                                        }
                                    >
                                        <SelectTrigger
                                            id="tpl-reminder"
                                            className="h-9 w-full"
                                        >
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="daily">
                                                {text.signup.reminderDaily}
                                            </SelectItem>
                                            <SelectItem value="off">
                                                {text.signup.reminderOff}
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                    {audience !== "off" ? (
                                        <Select
                                            value={audience}
                                            onValueChange={(value) =>
                                                update({
                                                    signupReminderStatuses:
                                                        reminderStatusesFor(
                                                            value as ReminderAudience
                                                        ),
                                                })
                                            }
                                        >
                                            <SelectTrigger
                                                aria-label={
                                                    text.signup.audienceLabel
                                                }
                                                className="h-9 w-full"
                                            >
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="member">
                                                    {
                                                        text.signup.audience
                                                            .member
                                                    }
                                                </SelectItem>
                                                <SelectItem value="memberRecruit">
                                                    {
                                                        text.signup.audience
                                                            .memberRecruit
                                                    }
                                                </SelectItem>
                                                <SelectItem value="all">
                                                    {text.signup.audience.all}
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    ) : null}
                                </div>
                            </Row>
                        </Section>
                    ) : null}

                    <Section
                        id="tpl-discord"
                        title={text.discord.title}
                        icon={Megaphone}
                    >
                        <Row
                            label={text.discord.channel}
                            hint={text.discord.channelHint}
                        >
                            <div className="flex flex-wrap items-center gap-3">
                                {channelName ? (
                                    <span className="border-border inline-flex h-9 items-center gap-1 rounded-lg border px-3 text-sm">
                                        <span className="text-muted-foreground">
                                            #
                                        </span>
                                        {channelName}
                                    </span>
                                ) : (
                                    <span className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
                                        <AlertTriangle
                                            className="size-4"
                                            aria-hidden
                                        />
                                        {text.discord.channelMissing}
                                    </span>
                                )}
                                <Link
                                    href={channelsHref}
                                    className="text-sm underline underline-offset-[3px]"
                                >
                                    {text.discord.channelSet}
                                </Link>
                            </div>
                        </Row>
                        <Row label={text.discord.ping} labelId="tpl-ping">
                            <div className="flex flex-col gap-3">
                                <Segmented
                                    labelledBy="tpl-ping"
                                    value={selected.pingMode}
                                    onChange={(pingMode) =>
                                        update({ pingMode })
                                    }
                                    options={[
                                        {
                                            value: "none",
                                            label: text.discord.pingNone,
                                        },
                                        {
                                            value: "clan",
                                            label: text.discord.pingClan,
                                        },
                                        {
                                            value: "roles",
                                            label: text.discord.pingRoles,
                                        },
                                    ]}
                                />
                                {selected.pingMode === "roles" ? (
                                    <DiscordMultiEntitySelect
                                        value={selected.pingRoleIds}
                                        onChange={(pingRoleIds) =>
                                            update({ pingRoleIds })
                                        }
                                        options={metadata.roles}
                                        placeholder={
                                            dictionary.event.fields.pingRoleIds
                                        }
                                    />
                                ) : null}
                            </div>
                        </Row>
                        <Row label={text.discord.create}>
                            <div className="flex flex-col gap-3">
                                {(
                                    [
                                        ...(isMatch
                                            ? [
                                                  {
                                                      id: "tpl-forum",
                                                      label: text.discord.forum,
                                                      hint: text.discord
                                                          .forumHint,
                                                      checked:
                                                          selected.createForumChannel,
                                                      onChange: (
                                                          value: boolean
                                                      ) =>
                                                          update({
                                                              createForumChannel:
                                                                  value,
                                                          }),
                                                  },
                                              ]
                                            : []),
                                        {
                                            id: "tpl-voice",
                                            label: text.discord.voice,
                                            hint: text.discord.voiceHint,
                                            checked:
                                                selected.createSquadVoiceChannels,
                                            onChange: (value: boolean) =>
                                                update({
                                                    createSquadVoiceChannels:
                                                        value,
                                                }),
                                        },
                                        ...(isMatch
                                            ? [
                                                  {
                                                      id: "tpl-roles",
                                                      label: text.discord.roles,
                                                      hint: text.discord
                                                          .rolesHint,
                                                      checked:
                                                          selected.createParticipantRoles !==
                                                          false,
                                                      onChange: (
                                                          value: boolean
                                                      ) =>
                                                          update({
                                                              createParticipantRoles:
                                                                  value,
                                                          }),
                                                  },
                                              ]
                                            : []),
                                    ] as const
                                ).map((entry) => (
                                    <div
                                        key={entry.id}
                                        className="flex items-start gap-3"
                                    >
                                        <Switch
                                            id={entry.id}
                                            checked={entry.checked}
                                            onCheckedChange={entry.onChange}
                                            className="mt-0.5"
                                        />
                                        <Label
                                            htmlFor={entry.id}
                                            className="flex flex-col items-start gap-0.5 text-sm font-normal"
                                        >
                                            <span>{entry.label}</span>
                                            <span className="text-muted-foreground text-xs">
                                                {entry.hint}
                                            </span>
                                        </Label>
                                    </div>
                                ))}
                            </div>
                        </Row>
                        <Row
                            label={text.discord.password}
                            hint={text.discord.passwordHint}
                            labelId="tpl-pass"
                        >
                            <div
                                role="radiogroup"
                                aria-labelledby="tpl-pass"
                                className="flex flex-col gap-2"
                            >
                                <div
                                    role="radio"
                                    aria-checked="true"
                                    aria-disabled="true"
                                    className="border-foreground flex items-start gap-3 rounded-[10px] border px-3 py-2.5"
                                >
                                    <span
                                        aria-hidden
                                        className="border-foreground mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2"
                                    >
                                        <span className="bg-foreground size-1.5 rounded-full" />
                                    </span>
                                    <span className="flex flex-col">
                                        <span className="text-sm">
                                            {text.discord.passwordRoster}
                                        </span>
                                        <span className="text-muted-foreground text-xs">
                                            {text.discord.passwordRosterHint}
                                        </span>
                                    </span>
                                </div>
                            </div>
                        </Row>
                    </Section>

                    {isMatch ? (
                        <Section
                            id="tpl-roster"
                            title={text.roster.title}
                            icon={Users}
                        >
                            <Row
                                label={text.roster.preset}
                                hint={text.roster.presetHint}
                                htmlFor="tpl-preset"
                            >
                                {selected.gameId ? (
                                    <Select
                                        value={selected.squadPresetId ?? NONE}
                                        onValueChange={(value) =>
                                            update({
                                                squadPresetId:
                                                    value === NONE
                                                        ? undefined
                                                        : value,
                                            })
                                        }
                                    >
                                        <SelectTrigger
                                            id="tpl-preset"
                                            className="h-9 w-full"
                                        >
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={NONE}>
                                                {text.roster.presetNone}
                                            </SelectItem>
                                            {gamePresets.map((preset) => (
                                                <SelectItem
                                                    key={preset.id}
                                                    value={preset.id}
                                                >
                                                    {preset.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <p className="text-muted-foreground text-sm">
                                        {text.roster.presetAllGames}
                                    </p>
                                )}
                            </Row>
                            <Row
                                label={text.roster.attendance}
                                hint={text.roster.attendanceHint}
                                labelId="tpl-attendance"
                            >
                                <div
                                    role="group"
                                    aria-labelledby="tpl-attendance"
                                    className="flex flex-wrap items-center gap-2"
                                >
                                    {ATTENDANCE_REMINDER_OFFSETS.map(
                                        (hours) => {
                                            const on =
                                                reminderHours.includes(hours)
                                            return (
                                                <Chip
                                                    key={hours}
                                                    check={false}
                                                    pressed={on}
                                                    onClick={() =>
                                                        update({
                                                            attendanceReminderHours:
                                                                ATTENDANCE_REMINDER_OFFSETS.filter(
                                                                    (entry) =>
                                                                        entry ===
                                                                        hours
                                                                            ? !on
                                                                            : reminderHours.includes(
                                                                                  entry
                                                                              )
                                                                ),
                                                        })
                                                    }
                                                >
                                                    {text.roster.hours.replace(
                                                        "{count}",
                                                        String(hours)
                                                    )}
                                                </Chip>
                                            )
                                        }
                                    )}
                                    <span className="text-muted-foreground text-xs">
                                        {text.roster.beforeMeeting}
                                    </span>
                                </div>
                            </Row>
                        </Section>
                    ) : null}
                    <Section
                        id="tpl-basics"
                        title={text.basics.title}
                        icon={Settings2}
                    >
                        <Row label={text.basics.name} htmlFor="tpl-name">
                            <Input
                                id="tpl-name"
                                value={selected.name}
                                maxLength={60}
                                onChange={(event) =>
                                    update({ name: event.target.value })
                                }
                                className="h-9"
                            />
                        </Row>
                        <Row label={text.basics.kind} labelId="tpl-kind">
                            <Segmented
                                labelledBy="tpl-kind"
                                value={selected.kind}
                                onChange={(kind) => update({ kind })}
                                options={[
                                    {
                                        value: "match",
                                        label: text.basics.match,
                                    },
                                    {
                                        value: "training",
                                        label: text.basics.training,
                                    },
                                ]}
                            />
                        </Row>
                        <Row label={text.basics.game} htmlFor="tpl-game">
                            <Select
                                value={selected.gameId ?? ALL_GAMES}
                                onValueChange={(value) =>
                                    update({
                                        gameId:
                                            value === ALL_GAMES
                                                ? undefined
                                                : (value as GameId),
                                        signupGroupIds: undefined,
                                        signupGroupLimits: undefined,
                                        squadPresetId: undefined,
                                    })
                                }
                            >
                                <SelectTrigger
                                    id="tpl-game"
                                    className="h-9 w-full"
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={ALL_GAMES}>
                                        {text.allGames}
                                    </SelectItem>
                                    {enabledGames.map((gameId) => (
                                        <SelectItem key={gameId} value={gameId}>
                                            {GAME_LABELS[gameId]}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </Row>
                        <Row
                            label={text.basics.category}
                            hint={text.basics.categoryHint}
                            htmlFor="tpl-category"
                        >
                            <Select
                                value={selected.categoryId ?? NONE}
                                onValueChange={(value) =>
                                    update({
                                        categoryId:
                                            value === NONE ? undefined : value,
                                    })
                                }
                            >
                                <SelectTrigger
                                    id="tpl-category"
                                    className="h-9 w-full"
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={NONE}>
                                        {dictionary.shared.notSet}
                                    </SelectItem>
                                    {categories.map((category) => (
                                        <SelectItem
                                            key={category.id}
                                            value={category.id}
                                        >
                                            {category.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </Row>
                        {isMatch ? (
                            <Row
                                label={dictionary.event.topicPreset}
                                htmlFor="tpl-topic"
                            >
                                <Select
                                    value={selected.topicPresetId ?? NONE}
                                    onValueChange={(value) =>
                                        update({
                                            topicPresetId:
                                                value === NONE
                                                    ? undefined
                                                    : value,
                                        })
                                    }
                                >
                                    <SelectTrigger
                                        id="tpl-topic"
                                        className="h-9 w-full"
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={NONE}>
                                            {dictionary.event.noPreset}
                                        </SelectItem>
                                        {topicPresets.map((preset) => (
                                            <SelectItem
                                                key={preset.id}
                                                value={preset.id}
                                            >
                                                {preset.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </Row>
                        ) : null}
                    </Section>
                </>
            )}

            <div
                className={cn(
                    "bg-muted/50 border-border flex flex-wrap items-center justify-between gap-3 rounded-[14px] border px-4 py-3",
                    // Unsaved changes keep the save bar in reach on larger screens.
                    dirty && "sm:sticky sm:bottom-0"
                )}
            >
                <span className="text-muted-foreground text-sm">
                    {text.appliesToNew}
                </span>
                <div className="flex flex-wrap gap-2">
                    {selected ? (
                        <ConfirmActionDialog
                            trigger={
                                <Button
                                    type="button"
                                    variant="ghost"
                                    className="text-destructive"
                                >
                                    <Trash2
                                        className="size-4"
                                        aria-hidden="true"
                                    />
                                    {text.remove}
                                </Button>
                            }
                            title={text.removeTitle.replace(
                                "{name}",
                                selected.name
                            )}
                            description={text.removeDescription}
                            confirmLabel={text.remove}
                            cancelLabel={dictionary.common.cancel}
                            onConfirm={removeSelected}
                        />
                    ) : null}
                    <Button
                        type="button"
                        variant="outline"
                        disabled={!dirty || saving}
                        onClick={() => {
                            setTemplates(savedTemplates)
                            setSelectedId(savedTemplates[0]?.id)
                        }}
                    >
                        {text.discard}
                    </Button>
                    <Button
                        type="button"
                        disabled={!dirty || saving}
                        onClick={() => void save()}
                    >
                        {text.save}
                    </Button>
                </div>
            </div>
        </div>
    )
}
