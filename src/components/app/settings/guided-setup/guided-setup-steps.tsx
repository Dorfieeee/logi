"use client"

import {
    Bot,
    Check,
    CircleCheck,
    Loader2,
    Shield,
    TriangleAlert,
    Upload,
} from "lucide-react"
import { useRef, useState, type ReactNode } from "react"

import {
    channelOptions,
    DiscordChannelSelect,
} from "@/components/app/discord-channel-select"
import { RefreshBotStatusButton } from "@/components/app/refresh-bot-status-button"
import { DiscordEntitySelect } from "@/components/app/discord-entity-select"
import type { DiscordMetadataState } from "@/hooks/use-discord-metadata"
import { GAME_IDS, GAME_LABELS, type GameId } from "@/domain/games/game"
import { GameDataSources } from "@/components/app/game-data-sources"
import { BotInviteButton } from "@/components/app/bot-invite-button"
import { uploadFileToConvex } from "@/lib/client-uploads"
import type { Dictionary } from "@/i18n/dictionaries"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type Copy = Dictionary["settingsHub"]["guidedSetup"]

export type GuidedSetupProfile = {
    name: string
    avatar: string
    description: string
}
export type GuidedSetupChannels = {
    announcementsChannelId?: string
    eventInfoChannelId?: string
    eventResultsChannelId?: string
    errorsChannelId?: string
}
export type GuidedSetupRoles = {
    clanRoleId?: string
    dashboardAdminRoleId?: string
}

/** A label above its control and a help line below it (design B). */
function Field({
    htmlFor,
    label,
    optional,
    help,
    children,
}: {
    htmlFor: string
    label: string
    /** The muted "· optional" after the label. */
    optional?: string
    help?: string
    children: ReactNode
}) {
    return (
        <div className="flex flex-col gap-1.5">
            <Label htmlFor={htmlFor} className="leading-5">
                <span>
                    {label}
                    {optional ? (
                        <span className="text-muted-foreground font-normal">
                            {" "}
                            · {optional}
                        </span>
                    ) : null}
                </span>
            </Label>
            {children}
            {help ? (
                <p className="text-muted-foreground text-[13px] leading-5">
                    {help}
                </p>
            ) : null}
        </div>
    )
}

function DiscordUnavailable({ text }: { text: string }) {
    return (
        <p
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2.5 text-[13px] leading-5 text-amber-900 dark:text-amber-100"
        >
            <TriangleAlert
                className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
                aria-hidden="true"
            />
            {text}
        </p>
    )
}

/** Step 1: is the bot on the clan's Discord server, and can it see channels and roles? */
export function BotStep({
    botInside,
    metadata,
    inviteUrl,
    onChecked,
    copy,
    dictionary,
}: {
    botInside: boolean
    metadata: DiscordMetadataState["status"]
    inviteUrl: string
    /** After "Check again", so the channels and roles are read again too. */
    onChecked(): void
    copy: Copy["steps"]["bot"]
    dictionary: Dictionary
}) {
    const ready = botInside && metadata === "ready"
    const warning = !botInside || metadata === "failed"
    const message = !botInside
        ? copy.missing
        : metadata === "failed"
          ? copy.blind
          : metadata === "loading"
            ? copy.checking
            : copy.ready
    const Icon = warning ? TriangleAlert : CircleCheck
    return (
        <div
            role="status"
            className={cn(
                "flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4",
                warning
                    ? "border-amber-500/40 bg-amber-500/10"
                    : "border-emerald-500/30 bg-emerald-500/10"
            )}
        >
            <span
                className={cn(
                    "flex min-w-0 flex-[1_1_240px] items-start gap-2.5 text-sm leading-5",
                    warning
                        ? "text-amber-900 dark:text-amber-100"
                        : "text-emerald-900 dark:text-emerald-100"
                )}
            >
                <Icon
                    className={cn(
                        "size-5 shrink-0",
                        warning
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-emerald-700 dark:text-emerald-400",
                        !ready && !warning && "opacity-70"
                    )}
                    aria-hidden="true"
                />
                {message}
            </span>
            <span className="flex flex-wrap gap-2">
                {!botInside ? (
                    <BotInviteButton
                        dictionary={dictionary}
                        inviteUrl={inviteUrl}
                        roleHierarchyRelevant
                        className="h-8 rounded-lg px-3 text-[13px]"
                    >
                        <>
                            <Bot className="size-4" aria-hidden="true" />
                            {copy.invite}
                        </>
                    </BotInviteButton>
                ) : null}
                <RefreshBotStatusButton
                    dictionary={dictionary}
                    label={copy.checkAgain}
                    onRefreshed={onChecked}
                />
            </span>
        </div>
    )
}

/** Step 2: the games the clan plays, as option cards. */
export function GamesStep({
    value,
    onChange,
    copy,
}: {
    value: readonly GameId[]
    onChange(value: GameId[]): void
    copy: Copy["steps"]["games"]
}) {
    return (
        <div
            role="group"
            aria-label={copy.groupLabel}
            className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-3"
        >
            {GAME_IDS.map((game) => {
                const on = value.includes(game)
                return (
                    <button
                        key={game}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                            onChange(
                                on
                                    ? value.filter((item) => item !== game)
                                    : GAME_IDS.filter(
                                          (item) =>
                                              item === game ||
                                              value.includes(item)
                                      )
                            )
                        }
                        className={cn(
                            "focus-visible:ring-ring/50 flex min-h-14 items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium transition outline-none focus-visible:ring-[3px]",
                            on
                                ? "border-foreground bg-muted/50"
                                : "bg-background hover:bg-muted/40"
                        )}
                    >
                        <span
                            aria-hidden="true"
                            className={cn(
                                "flex size-[18px] shrink-0 items-center justify-center rounded-[5px]",
                                on
                                    ? "bg-primary text-primary-foreground"
                                    : "border-muted-foreground/60 bg-background border"
                            )}
                        >
                            {on ? (
                                <Check className="size-3" strokeWidth={3} />
                            ) : null}
                        </span>
                        <span>{GAME_LABELS[game]}</span>
                    </button>
                )
            })}
        </div>
    )
}

/** The clan logo: the stored picture or an empty tile, and an upload button. */
function LogoField({
    value,
    onChange,
    copy,
    labelId,
}: {
    value: string
    onChange(value: string): void
    copy: Copy["steps"]["profile"]
    labelId: string
}) {
    const input = useRef<HTMLInputElement>(null)
    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    async function upload(file: File | undefined) {
        if (!file) return
        setUploading(true)
        setError(null)
        try {
            onChange((await uploadFileToConvex(file)).url)
        } catch (failure) {
            setError(
                failure instanceof Error ? failure.message : copy.logoRequired
            )
        } finally {
            setUploading(false)
            if (input.current) input.current.value = ""
        }
    }
    return (
        <div
            role="group"
            aria-labelledby={labelId}
            className="flex flex-col gap-1.5"
        >
            <div className="flex flex-wrap items-center gap-3">
                <span className="bg-muted/40 border-muted-foreground/40 text-muted-foreground flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed">
                    {value ? (
                        // A stored upload or Discord icon of any size; the tile crops it.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={value}
                            alt={copy.logoAlt}
                            className="size-full object-cover"
                        />
                    ) : (
                        <Shield className="size-5" aria-hidden="true" />
                    )}
                </span>
                <Button
                    type="button"
                    variant="outline"
                    className="rounded-lg"
                    disabled={uploading}
                    onClick={() => input.current?.click()}
                >
                    {uploading ? (
                        <Loader2 className="size-4 animate-spin" />
                    ) : (
                        <Upload className="size-4" aria-hidden="true" />
                    )}
                    {uploading ? copy.uploading : copy.upload}
                </Button>
                <span className="text-muted-foreground text-[13px]">
                    {copy.formats}
                </span>
                <input
                    ref={input}
                    type="file"
                    accept="image/png,image/jpeg"
                    className="hidden"
                    onChange={(event) => void upload(event.target.files?.[0])}
                />
            </div>
            {error ? (
                <p role="alert" className="text-destructive text-[13px]">
                    {error}
                </p>
            ) : null}
        </div>
    )
}

/** Step 3: the clan name, logo and an optional description. */
export function ProfileStep({
    value,
    onChange,
    copy,
    optional,
}: {
    value: GuidedSetupProfile
    onChange(value: GuidedSetupProfile): void
    copy: Copy["steps"]["profile"]
    optional: string
}) {
    return (
        <>
            <Field htmlFor="guided-setup-name" label={copy.name}>
                <Input
                    id="guided-setup-name"
                    value={value.name}
                    maxLength={100}
                    placeholder={copy.namePlaceholder}
                    className="rounded-lg"
                    onChange={(event) =>
                        onChange({ ...value, name: event.target.value })
                    }
                />
            </Field>
            <div className="flex flex-col gap-1.5">
                <span
                    id="guided-setup-logo"
                    className="text-sm leading-5 font-medium"
                >
                    {copy.logo}
                </span>
                <LogoField
                    value={value.avatar}
                    onChange={(avatar) => onChange({ ...value, avatar })}
                    copy={copy}
                    labelId="guided-setup-logo"
                />
            </div>
            <Field
                htmlFor="guided-setup-description"
                label={copy.about}
                optional={optional}
            >
                <Textarea
                    id="guided-setup-description"
                    rows={3}
                    value={value.description}
                    maxLength={2000}
                    placeholder={copy.aboutPlaceholder}
                    className="[field-sizing:fixed] min-h-[76px] resize-y rounded-lg"
                    onChange={(event) =>
                        onChange({ ...value, description: event.target.value })
                    }
                />
            </Field>
        </>
    )
}

/** Step 4: the announcement, event information and error channels. */
export function ChannelsStep({
    value,
    onChange,
    metadata,
    copy,
    optional,
    unavailable,
}: {
    value: GuidedSetupChannels
    onChange(value: GuidedSetupChannels): void
    metadata: DiscordMetadataState
    copy: Copy["steps"]["channels"]
    optional: string
    unavailable: string
}) {
    const options = channelOptions(metadata.metadata?.channels ?? [], "text")
    const fields = [
        {
            key: "announcementsChannelId",
            label: copy.announcements,
            help: copy.announcementsHelp,
        },
        {
            key: "eventInfoChannelId",
            label: copy.eventInfo,
            help: copy.eventInfoHelp,
        },
        {
            key: "eventResultsChannelId",
            label: copy.eventResults,
            help: copy.eventResultsHelp,
            optional: true,
        },
        {
            key: "errorsChannelId",
            label: copy.errors,
            help: copy.errorsHelp,
            optional: true,
        },
    ] as const
    return (
        <>
            {metadata.status === "failed" ? (
                <DiscordUnavailable text={unavailable} />
            ) : null}
            {fields.map((field) => (
                <Field
                    key={field.key}
                    htmlFor={`guided-setup-${field.key}`}
                    label={field.label}
                    optional={"optional" in field ? optional : undefined}
                    help={field.help}
                >
                    <DiscordChannelSelect
                        id={`guided-setup-${field.key}`}
                        value={value[field.key]}
                        onChange={(next) =>
                            onChange({ ...value, [field.key]: next })
                        }
                        options={options}
                        kind="text"
                        placeholder={copy.choose}
                        noneLabel={copy.choose}
                        loading={metadata.status === "loading"}
                        unavailable={metadata.status === "failed"}
                    />
                </Field>
            ))}
        </>
    )
}

/** Step 5: the clan role and the role that may manage Logi. */
export function RolesStep({
    value,
    onChange,
    metadata,
    copy,
    unavailable,
}: {
    value: GuidedSetupRoles
    onChange(value: GuidedSetupRoles): void
    metadata: DiscordMetadataState
    copy: Copy["steps"]["roles"]
    unavailable: string
}) {
    const roles = metadata.metadata?.roles ?? []
    const fields = [
        {
            key: "clanRoleId",
            label: copy.clanRole,
            help: copy.clanRoleHelp,
        },
        {
            key: "dashboardAdminRoleId",
            label: copy.adminRole,
            help: copy.adminRoleHelp,
        },
    ] as const
    return (
        <>
            {metadata.status === "failed" ? (
                <DiscordUnavailable text={unavailable} />
            ) : null}
            {fields.map((field) => (
                <Field
                    key={field.key}
                    htmlFor={`guided-setup-${field.key}`}
                    label={field.label}
                    help={field.help}
                >
                    <DiscordEntitySelect
                        id={`guided-setup-${field.key}`}
                        value={value[field.key]}
                        onChange={(next) =>
                            onChange({ ...value, [field.key]: next })
                        }
                        options={roles}
                        placeholder={copy.choose}
                        noneLabel={copy.none}
                        emptyLabel={copy.noResults}
                    />
                </Field>
            ))}
        </>
    )
}

/** Step 6: connect a game server with the same form as the game servers page. */
export function GameServersStep({
    serverId,
    dictionary,
    onChanged,
}: {
    serverId: string
    dictionary: Dictionary
    onChanged(): void
}) {
    return (
        <GameDataSources
            serverId={serverId}
            dictionary={dictionary}
            onChanged={onChanged}
            variant="setup"
        />
    )
}
