"use client"

import * as SelectPrimitive from "@radix-ui/react-select"
import { Check, ChevronDown, Lock } from "lucide-react"
import type { ReactNode } from "react"
import Link from "next/link"

import {
    COMMAND_CAPABILITIES,
    type CommandAudience,
    type CommandReplyMode,
    type ConfigurableCommand,
} from "@/domain/discord-commands/catalog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    RoleChips,
    type RoleOption,
} from "@/components/app/settings/role-chips"
import type { CommandSettingsEntry } from "@/domain/discord-commands/command-settings"
import type { Dictionary } from "@/i18n/dictionaries"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

import {
    DiscordChannelSelect,
    type ChannelOption,
} from "@/components/app/discord-channel-select"

type Text = Dictionary["settingsHub"]["commandsPage"]["commands"]

const fieldBox =
    "bg-muted/60 text-foreground flex min-h-9 items-start gap-2 rounded-md px-3 py-2 text-sm"

/** A fixed value with a lock: the design does not let the clan change it. */
function Fixed({ children }: { children: ReactNode }) {
    return (
        <div className={fieldBox}>
            <Lock
                className="text-muted-foreground mt-0.5 size-3.5 shrink-0"
                aria-hidden="true"
            />
            <span className="min-w-0">{children}</span>
        </div>
    )
}

function Field({
    id,
    label,
    children,
}: {
    id: string
    label: string
    children: ReactNode
}) {
    return (
        <div className="min-w-0 space-y-1.5">
            <div id={id} className="text-muted-foreground text-[13px]">
                {label}
            </div>
            {children}
        </div>
    )
}

/** The command's header: name, "Nový", the switch and its description. */
function RowHeader({
    command,
    badge,
    description,
    switchControl,
}: {
    command: string
    badge?: string
    description: string
    switchControl: ReactNode
}) {
    // On a phone a long name and "zapíná se s Členstvím" do not fit on one
    // line: the switch wraps below, right-aligned, instead of overlapping
    // the name (N3-25).
    return (
        <div className="space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <div className="flex min-w-0 items-center gap-2">
                    <code className="font-mono text-base font-semibold break-all">
                        /{command}
                    </code>
                    {badge ? (
                        <Badge
                            variant="outline"
                            className="border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-200"
                        >
                            {badge}
                        </Badge>
                    ) : null}
                </div>
                <div className="ml-auto shrink-0">{switchControl}</div>
            </div>
            <p className="text-muted-foreground text-sm">{description}</p>
        </div>
    )
}

/** The audience select with a description per group (N3-15). */
function AudienceSelect({
    value,
    options,
    onChange,
    label,
    text,
    disabled,
}: {
    value: CommandAudience
    options: readonly CommandAudience[]
    onChange(value: CommandAudience): void
    /** "Kdo smí použít /player": names the command for screen readers. */
    label: string
    text: Text
    disabled?: boolean
}) {
    return (
        <SelectPrimitive.Root
            value={value}
            onValueChange={(next) => onChange(next as CommandAudience)}
            disabled={disabled}
        >
            <SelectPrimitive.Trigger
                aria-label={label}
                className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 flex h-9 w-full items-center justify-between gap-2 rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] disabled:opacity-50"
            >
                <SelectPrimitive.Value />
                <ChevronDown className="size-4 opacity-50" aria-hidden="true" />
            </SelectPrimitive.Trigger>
            <SelectPrimitive.Portal>
                <SelectPrimitive.Content
                    position="popper"
                    sideOffset={4}
                    className="bg-popover text-popover-foreground z-50 w-(--radix-select-trigger-width) min-w-64 overflow-hidden rounded-md border shadow-md"
                >
                    <SelectPrimitive.Viewport className="p-1">
                        {options.map((audience) => (
                            <SelectPrimitive.Item
                                key={audience}
                                value={audience}
                                className="focus:bg-accent relative flex cursor-default flex-col rounded-sm py-1.5 pr-2 pl-7 text-sm outline-none select-none"
                            >
                                <span className="absolute top-2 left-2 flex size-3.5 items-center justify-center">
                                    <SelectPrimitive.ItemIndicator>
                                        <Check
                                            className="size-3.5"
                                            aria-hidden="true"
                                        />
                                    </SelectPrimitive.ItemIndicator>
                                </span>
                                <SelectPrimitive.ItemText>
                                    {text.audiences[audience].label}
                                </SelectPrimitive.ItemText>
                                <span className="text-muted-foreground text-xs">
                                    {text.audiences[audience].description}
                                </span>
                            </SelectPrimitive.Item>
                        ))}
                    </SelectPrimitive.Viewport>
                    <div className="text-muted-foreground border-t px-3 py-2 text-xs">
                        {text.rolesHint}
                    </div>
                </SelectPrimitive.Content>
            </SelectPrimitive.Portal>
        </SelectPrimitive.Root>
    )
}

export type CommandRowProps = {
    command: ConfigurableCommand
    entry: CommandSettingsEntry
    description: string
    onChange(entry: CommandSettingsEntry): void
    roles: RoleOption[] | null
    channels: ChannelOption[] | null
    dictionary: Dictionary
    /** Extra settings under the row, e.g. `/stats`'s games and preview. */
    children?: ReactNode
    /** The note under "Odpověď" (`/player`'s Sdílet). */
    replyHint?: string
}

/**
 * One configurable command (N3-09..19): name and switch, its description,
 * then "Kdo smí použít", "Odpověď" and "Kde jde použít" side by side, stacked
 * on phones (N3-25). Fixed values show a lock.
 */
export function CommandRow({
    command,
    entry,
    description,
    onChange,
    roles,
    channels,
    dictionary,
    children,
    replyHint,
}: CommandRowProps) {
    const text = dictionary.settingsHub.commandsPage.commands
    const capabilities = COMMAND_CAPABILITIES[command]
    const name = `/${command}`
    const id = `command-${command}`
    const update = (patch: Partial<CommandSettingsEntry>) =>
        onChange({ ...entry, ...patch })
    const roleName = (roleId: string) =>
        roles?.find((role) => role.id === roleId)?.name ?? roleId
    const someChannels = entry.channelIds.length > 0
    return (
        <li className="space-y-4 px-4 py-5 sm:px-5">
            <RowHeader
                command={command}
                badge={command === "help" ? text.new : undefined}
                description={description}
                switchControl={
                    <label className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">
                            {entry.enabled ? text.on : text.off}
                        </span>
                        <Switch
                            id={`${id}-enabled`}
                            aria-label={name}
                            checked={entry.enabled}
                            onCheckedChange={(enabled) => update({ enabled })}
                        />
                    </label>
                }
            />
            <div
                className={cn(
                    "grid gap-4 md:grid-cols-3",
                    !entry.enabled && "opacity-60"
                )}
            >
                <Field id={`${id}-who`} label={text.who}>
                    {capabilities.audience ? (
                        <div className="space-y-2">
                            <AudienceSelect
                                value={entry.audience}
                                options={capabilities.audience}
                                onChange={(audience) =>
                                    update({
                                        audience,
                                        roleIds:
                                            audience === "everyone"
                                                ? []
                                                : entry.roleIds,
                                    })
                                }
                                label={text.whoLabel.replace("{command}", name)}
                                text={text}
                            />
                            {entry.audience !== "everyone" ? (
                                <>
                                    <RoleChips
                                        value={entry.roleIds}
                                        onChange={(roleIds) =>
                                            update({ roleIds })
                                        }
                                        roles={roles}
                                        labels={{
                                            add: text.addRole,
                                            addAria: text.addRoleAria.replace(
                                                "{command}",
                                                name
                                            ),
                                            remove: (role) =>
                                                text.removeRole.replace(
                                                    "{role}",
                                                    role
                                                ),
                                            search: text.searchRoles,
                                            empty: text.noRoles,
                                        }}
                                    />
                                    {entry.roleIds.length ? (
                                        <p className="text-muted-foreground text-[13px]">
                                            {text.audienceWithRoles
                                                .replace(
                                                    "{group}",
                                                    text.audiences[
                                                        entry.audience
                                                    ].label
                                                )
                                                .replace(
                                                    "{roles}",
                                                    entry.roleIds
                                                        .map(roleName)
                                                        .join(", ")
                                                )}
                                        </p>
                                    ) : null}
                                </>
                            ) : null}
                        </div>
                    ) : (
                        <Fixed>
                            {command === "help" ||
                            command === "link" ||
                            command === "notice"
                                ? text.fixedWho[command]
                                : text.audiences[entry.audience].label}
                        </Fixed>
                    )}
                </Field>
                <Field id={`${id}-reply`} label={text.reply}>
                    {capabilities.reply ? (
                        <div className="space-y-1.5">
                            <Select
                                value={entry.reply}
                                onValueChange={(reply) =>
                                    update({
                                        reply: reply as CommandReplyMode,
                                    })
                                }
                            >
                                <SelectTrigger
                                    className="bg-background w-full"
                                    aria-label={text.replyLabel.replace(
                                        "{command}",
                                        name
                                    )}
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {capabilities.reply.map((reply) => (
                                        <SelectItem key={reply} value={reply}>
                                            {text.replies[reply]}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {replyHint && entry.reply === "privateShare" ? (
                                <p className="text-muted-foreground text-[13px]">
                                    {replyHint}
                                </p>
                            ) : null}
                        </div>
                    ) : (
                        <Fixed>{text.replies[entry.reply]}</Fixed>
                    )}
                </Field>
                <Field id={`${id}-where`} label={text.where}>
                    <div
                        className="space-y-2"
                        aria-label={text.whereLabel.replace("{command}", name)}
                    >
                        {someChannels ? (
                            <DiscordChannelSelect
                                multiple
                                value={entry.channelIds}
                                onChange={(channelIds) =>
                                    update({ channelIds })
                                }
                                options={channels ?? []}
                                unavailable={!channels}
                                placeholder={text.whereLabel.replace(
                                    "{command}",
                                    name
                                )}
                                noneLabel={text.allChannels}
                            />
                        ) : (
                            <ChannelScopeSelect
                                text={text}
                                channels={channels}
                                onPick={(channelId) =>
                                    update({ channelIds: [channelId] })
                                }
                                label={text.whereLabel.replace(
                                    "{command}",
                                    name
                                )}
                            />
                        )}
                        {someChannels ? (
                            <p className="text-muted-foreground text-[13px]">
                                {text.channelsHint}
                            </p>
                        ) : null}
                    </div>
                </Field>
            </div>
            {children}
        </li>
    )
}

/**
 * "Všechny kanály" with the channels to limit the command to; picking one
 * switches the field to channel chips.
 */
function ChannelScopeSelect({
    text,
    channels,
    onPick,
    label,
}: {
    text: Text
    channels: ChannelOption[] | null
    onPick(channelId: string): void
    label: string
}) {
    return (
        <DiscordChannelSelect
            options={channels ?? []}
            unavailable={!channels}
            placeholder={label}
            noneLabel={text.allChannels}
            onChange={(value) => {
                if (value) onPick(value)
            }}
        />
    )
}

/** A close command row (N3-20, N3-21): switched with Tickety/Členství. */
export function CloseCommandRow({
    command,
    enabled,
    description,
    href,
    dictionary,
}: {
    command: "close_ticket" | "close_application"
    enabled: boolean
    description: string
    href: string
    dictionary: Dictionary
}) {
    const text = dictionary.settingsHub.commandsPage.commands
    const copy =
        command === "close_ticket" ? text.closeTicket : text.closeApplication
    const name = `/${command}`
    return (
        <li className="space-y-4 px-4 py-5 sm:px-5">
            <RowHeader
                command={command}

                description={description}
                switchControl={
                    <span className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">
                            {copy.toggle}
                        </span>
                        <Switch aria-label={name} checked={enabled} disabled />
                    </span>
                }
            />
            <div className="grid gap-4 md:grid-cols-3">
                <Field id={`command-${command}-who`} label={text.who}>
                    <Fixed>
                        {copy.who} ·{" "}
                        <Link
                            href={href}
                            className="underline underline-offset-3"
                        >
                            {copy.whoLink}
                        </Link>
                    </Fixed>
                </Field>
                <Field id={`command-${command}-reply`} label={text.reply}>
                    <Fixed>{copy.reply}</Fixed>
                </Field>
                <Field id={`command-${command}-where`} label={text.where}>
                    <Fixed>{copy.where}</Fixed>
                </Field>
            </div>
        </li>
    )
}
