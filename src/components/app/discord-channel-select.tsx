"use client"

import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    canUseChannelType,
    type ChannelPurpose,
} from "@/domain/discord-publications/channel-types"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Check, ChevronsUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTranslations } from "next-intl"
import { useId, useState } from "react"
import { cn } from "@/lib/utils"

export type SelectableDiscordChannel = {
    id: string
    name: string
    type: number
    parentId?: string
}
export type ChannelOption = { id: string; name: string; disabled?: boolean }
export type ChannelKind = "text" | "category" | "voice"

export function channelOptions(
    channels: readonly SelectableDiscordChannel[],
    kind: ChannelKind,
    purpose: ChannelPurpose = "publication"
) {
    return channels
        .filter((channel) =>
            kind === "category"
                ? channel.type === 4
                : kind === "voice"
                  ? channel.type === 2 || channel.type === 13
                  : canUseChannelType(purpose, channel.type)
        )
        .map((channel) => ({ id: channel.id, name: channel.name }))
}

type Props = {
    id?: string
    channels?: SelectableDiscordChannel[]
    options?: ChannelOption[]
    kind?: ChannelKind
    placeholder: string
    noneLabel?: string
    allowNone?: boolean
    purpose?: ChannelPurpose
    loading?: boolean
    unavailable?: boolean
    disabled?: boolean
    attention?: boolean
    className?: string
} & (
    | { multiple?: false; value?: string; onChange(value?: string): void }
    | { multiple: true; value: string[]; onChange(value: string[]): void }
)

/** Shared searchable select for every Discord channel setting. */
export function DiscordChannelSelect(props: Props) {
    const {
        id,
        channels = [],
        options,
        kind = "text",
        placeholder,
        noneLabel,
        allowNone = true,
        purpose = "publication",
        loading = false,
        unavailable = false,
        disabled = false,
        attention,
        className,
    } = props
    const t = useTranslations("settingsHub.channelPicker")
    const generatedId = useId()
    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState("")
    const selected = props.multiple
        ? props.value
        : props.value
          ? [props.value]
          : []
    const known: ChannelOption[] =
        options ?? channelOptions(channels, kind, purpose)
    // Keep saved IDs visible even if Discord no longer returns their channels.
    const entries: ChannelOption[] = [
        ...known,
        ...selected
            .filter((value) => !known.some((option) => option.id === value))
            .map((id) => ({ id, name: id })),
    ]
    const names = selected.map((value) => {
        const option = known.find((option) => option.id === value)
        return option
            ? `${kind === "text" ? "# " : ""}${option.name}`
            : `${value} · ${t("checkAccess")}`
    })
    const choose = (value?: string) => {
        if (props.multiple) {
            props.onChange(
                value
                    ? selected.includes(value)
                        ? selected.filter((id) => id !== value)
                        : [...selected, value]
                    : []
            )
        } else {
            props.onChange(value)
            setOpen(false)
        }
    }
    const query = search.trim().toLowerCase().replace(/^#\s*/, "")
    const matches = entries.filter((option) =>
        `${option.name} ${option.id}`.toLowerCase().includes(query)
    )
    const manualId =
        unavailable &&
        /^\d{17,20}$/.test(query) &&
        !entries.some((option) => option.id === query)
            ? query
            : undefined
    return (
        <Popover
            open={open}
            onOpenChange={(next) => {
                setOpen(next)
                if (!next) setSearch("")
            }}
        >
            <PopoverTrigger asChild>
                <Button
                    id={id ?? generatedId}
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-label={placeholder}
                    aria-expanded={open}
                    disabled={disabled || loading}
                    className={cn(
                        "bg-background h-auto min-h-9 w-full justify-between rounded-lg px-3 py-2 font-normal",
                        attention &&
                            "border-amber-400 ring-[3px] ring-amber-400/20 dark:border-amber-500/70",
                        className
                    )}
                >
                    <span
                        className={cn(
                            "min-w-0 truncate text-left",
                            !selected.length && "text-muted-foreground"
                        )}
                        title={names.join(", ")}
                    >
                        {names.join(", ") || noneLabel || placeholder}
                    </span>
                    <ChevronsUpDown
                        className="ml-2 size-4 shrink-0 opacity-50"
                        aria-hidden="true"
                    />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                align="start"
                className="w-[var(--radix-popover-trigger-width)] min-w-64 p-0"
            >
                <Command shouldFilter={false}>
                    <CommandInput
                        aria-label={t("search")}
                        placeholder={t("searchPlaceholder")}
                        value={search}
                        onValueChange={setSearch}
                    />
                    <CommandList>
                        <CommandEmpty>
                            {unavailable ? t("manualHelp") : t("empty")}
                        </CommandEmpty>
                        <CommandGroup>
                            {allowNone && !query && (
                                <CommandItem
                                    value="__none__"
                                    onSelect={() => choose()}
                                >
                                    {noneLabel ?? placeholder}
                                    <Check
                                        aria-hidden="true"
                                        className={cn(
                                            "ml-auto",
                                            selected.length > 0 && "opacity-0"
                                        )}
                                    />
                                </CommandItem>
                            )}
                            {matches.map((option) => (
                                <CommandItem
                                    key={option.id}
                                    value={option.id}
                                    disabled={option.disabled}
                                    onSelect={() => choose(option.id)}
                                >
                                    <span className="min-w-0">
                                        <span className="block truncate">
                                            {kind === "text" &&
                                            option.name !== option.id
                                                ? "# "
                                                : ""}
                                            {option.name}
                                        </span>
                                        <span className="text-muted-foreground block text-xs">
                                            {option.id}
                                            {!known.some(
                                                (known) =>
                                                    known.id === option.id
                                            )
                                                ? ` · ${t("checkAccess")}`
                                                : ""}
                                        </span>
                                    </span>
                                    <Check
                                        aria-hidden="true"
                                        className={cn(
                                            "ml-auto shrink-0",
                                            !selected.includes(option.id) &&
                                                "opacity-0"
                                        )}
                                    />
                                </CommandItem>
                            ))}
                            {manualId && (
                                <CommandItem
                                    value={manualId}
                                    onSelect={() => choose(manualId)}
                                >
                                    {manualId} · {t("checkAccess")}
                                </CommandItem>
                            )}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
