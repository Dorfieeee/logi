"use client"

import { useMemo, useState, useTransition, type ReactNode } from "react"
import { Lock, Plus, TriangleAlert, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import {
    GAME_EXCEPTION_CHANNEL_FIELDS,
    gameExceptions,
    withGameExceptions,
    type GameExceptionChannelField,
} from "@/domain/workspaces/game-exceptions"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    channelOptions,
    DiscordChannelSelect,
    type ChannelKind,
} from "@/components/app/discord-channel-select"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    clearableId,
    saveDiscordSettings,
} from "@/components/app/settings/save-discord-settings"
import {
    supportedClanLanguages,
    type ClanLanguage,
} from "@/lib/clan-language/core"
import { remapLocalizedDefaults } from "@/components/app/settings/localized-panel-defaults"
import { UnsavedChangesBar } from "@/components/app/settings/unsaved-changes-bar"
import type { DiscordConfig, GameDiscordOverrides } from "@/types/domain"
import { SettingsField } from "@/components/app/settings/settings-panel"
import { useDiscordMetadataState } from "@/hooks/use-discord-metadata"
import { GAME_LABELS, type GameId } from "@/domain/games/game"
import { supportedTimezones } from "@/lib/discord-timezones"
import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Exceptions = Record<
    GameExceptionChannelField,
    Partial<Record<GameId, string>>
>
/**
 * The errors channel moved to "Zprávy a panely" (board N1-47), where it is
 * edited next to the error messages themselves; the calendar and its channel
 * moved to "Panely v Discordu" (N1-47, N1-48). This page never sends either,
 * so saving it keeps them.
 */
type Values = {
    timezone: string
    defaultLanguage: ClanLanguage
    eventResultsChannelId?: string
} & Record<GameExceptionChannelField, string | undefined>

const KINDS: Record<GameExceptionChannelField, ChannelKind> = {
    announcementsChannelId: "text",
    eventInfoChannelId: "text",
    forumCategoryId: "category",
    squadVoiceCategoryId: "category",
    meetingChannelId: "voice",
}

/** The chip that marks a value for one game only (design A2). */
export function GameScopeChip({ gameId }: { gameId: GameId }) {
    return (
        <span className="inline-flex h-6 shrink-0 items-center rounded-md border border-sky-500/30 bg-sky-500/10 px-2 text-xs font-medium text-sky-800 dark:text-sky-200">
            {GAME_LABELS[gameId]}
        </span>
    )
}

/** What the lock and the game chip on this page mean (design A2). */
export function ChannelScopeLegend({
    dictionary,
    exampleGame,
}: {
    dictionary: Dictionary
    exampleGame: GameId
}) {
    const text = dictionary.settingsHub.scopeLegend
    return (
        <p className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px]">
            <span className="inline-flex items-center gap-1.5">
                <Lock className="size-3.5" aria-hidden="true" />
                {text.clanWide}
            </span>
            <span className="inline-flex items-center gap-1.5">
                <GameScopeChip gameId={exampleGame} />
                {text.exception}
            </span>
        </p>
    )
}

function ClanWideNote({ label }: { label: string }) {
    return (
        <p className="text-muted-foreground mt-1.5 flex items-center gap-1.5 px-1 text-xs">
            <Lock className="size-3" aria-hidden="true" />
            {label}
        </p>
    )
}

function Card({
    id,
    title,
    children,
}: {
    id: string
    title: string
    children: ReactNode
}) {
    return (
        <section
            aria-labelledby={id}
            className="bg-card rounded-2xl border px-5 pt-5 pb-2 sm:px-6"
        >
            <h2 id={id} className="border-b pb-3 text-base font-semibold">
                {title}
            </h2>
            <div className="divide-y">{children}</div>
        </section>
    )
}

function Row({ children }: { children: ReactNode }) {
    return <div className="py-4">{children}</div>
}

/**
 * Channels and language (design A2): time zone and bot language, the text and
 * voice channels the bot uses, each clan-wide with optional per-game
 * exceptions, and one save bar for the whole page.
 */
export function DiscordChannelSettingsForm({
    serverId,
    dictionary,
    config,
    enabledGames,
}: {
    serverId: string
    dictionary: Dictionary
    /** The clan-wide settings with the stored game overrides. */
    config: DiscordConfig | null
    enabledGames: readonly GameId[]
}) {
    const text = dictionary.settingsHub.channelsPage
    const hub = dictionary.settingsHub
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [saving, setSaving] = useState(false)
    const metadataState = useDiscordMetadataState(serverId)
    const channels = metadataState.metadata?.channels ?? []
    const multiGame = enabledGames.length > 1

    const initialValues = useMemo<Values>(
        () => ({
            timezone: config?.timezone ?? "UTC",
            defaultLanguage: config?.defaultLanguage ?? "en",
            announcementsChannelId: config?.announcementsChannelId,
            eventInfoChannelId: config?.eventInfoChannelId,
            eventResultsChannelId: config?.eventResultsChannelId,
            forumCategoryId: config?.forumCategoryId,
            meetingChannelId: config?.meetingChannelId,
            squadVoiceCategoryId: config?.squadVoiceCategoryId,
        }),
        [config]
    )
    const initialExceptions = useMemo<Exceptions>(() => {
        const read = (field: GameExceptionChannelField) =>
            gameExceptions<GameDiscordOverrides, GameExceptionChannelField>(
                config?.gameOverrides,
                field,
                enabledGames
            )
        return Object.fromEntries(
            GAME_EXCEPTION_CHANNEL_FIELDS.map((field) => [field, read(field)])
        ) as Exceptions
    }, [config, enabledGames])
    const [values, setValues] = useState<Values>(initialValues)
    const [exceptions, setExceptions] = useState<Exceptions>(initialExceptions)

    const changes =
        (Object.keys(values) as Array<keyof Values>).filter(
            (key) =>
                (values[key] || undefined) !== (initialValues[key] || undefined)
        ).length +
        GAME_EXCEPTION_CHANNEL_FIELDS.reduce(
            (count, field) =>
                count +
                enabledGames.filter(
                    (game) =>
                        exceptions[field][game] !==
                        initialExceptions[field][game]
                ).length,
            0
        )

    function setValue<K extends keyof Values>(key: K, value: Values[K]) {
        setValues((current) => ({ ...current, [key]: value }))
    }

    function picker(
        field: GameExceptionChannelField,
        kind: ChannelKind,
        value: string | undefined,
        onChange: (value?: string) => void,
        options?: { attention?: boolean; id?: string }
    ) {
        return (
            <DiscordChannelSelect
                id={options?.id}
                value={value}
                onChange={onChange}
                options={channelOptions(channels, kind)}
                kind={kind}
                placeholder={
                    kind === "text" || kind === "voice"
                        ? text.selectChannel
                        : text.selectCategory
                }
                noneLabel={
                    field === "announcementsChannelId"
                        ? text.selectChannel
                        : text.none
                }
                loading={metadataState.status === "loading"}
                unavailable={metadataState.status === "failed"}
                attention={options?.attention}
            />
        )
    }

    function exceptionRows(field: GameExceptionChannelField) {
        if (!multiGame) return null
        const rows = enabledGames.filter((game) => game in exceptions[field])
        const addable = enabledGames.filter(
            (game) => !(game in exceptions[field])
        )
        const set = (next: Partial<Record<GameId, string>>) =>
            setExceptions((current) => ({ ...current, [field]: next }))
        const add = (game: GameId) => set({ ...exceptions[field], [game]: "" })
        const addLabel =
            KINDS[field] === "category"
                ? text.addCategoryException
                : text.addChannelException
        return (
            <div className="mt-2 space-y-2">
                {rows.map((game) => (
                    <div
                        key={game}
                        className="flex items-center gap-2 border-l-2 pl-3"
                    >
                        <GameScopeChip gameId={game} />
                        <div className="min-w-0 flex-1">
                            {picker(
                                field,
                                KINDS[field],
                                exceptions[field][game] || undefined,
                                (next) =>
                                    set({
                                        ...exceptions[field],
                                        [game]: next ?? "",
                                    })
                            )}
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 shrink-0 rounded-lg"
                            aria-label={hub.gameExceptionRemove.replace(
                                "{game}",
                                GAME_LABELS[game]
                            )}
                            onClick={() => {
                                const next = { ...exceptions[field] }
                                delete next[game]
                                set(next)
                            }}
                        >
                            <X className="size-4" />
                        </Button>
                    </div>
                ))}
                {addable.length === 1 ? (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground h-8 rounded-lg px-2 font-normal"
                        onClick={() => add(addable[0]!)}
                    >
                        <Plus className="size-3.5" aria-hidden="true" />
                        {addLabel}
                    </Button>
                ) : addable.length > 1 ? (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-muted-foreground h-8 rounded-lg px-2 font-normal"
                            >
                                <Plus className="size-3.5" aria-hidden="true" />
                                {addLabel}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                            {addable.map((game) => (
                                <DropdownMenuItem
                                    key={game}
                                    onSelect={() => add(game)}
                                >
                                    {GAME_LABELS[game]}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                ) : null}
            </div>
        )
    }

    function routingRow(
        field: GameExceptionChannelField,
        label: ReactNode,
        help: string
    ) {
        return (
            <Row>
                <SettingsField label={label} help={help}>
                    {picker(
                        field,
                        KINDS[field],
                        values[field],
                        (value) => setValue(field, value),
                        {
                            id: `channels-${field}`,
                            attention:
                                field === "announcementsChannelId" &&
                                !values.announcementsChannelId,
                        }
                    )}
                    {exceptionRows(field)}
                </SettingsField>
            </Row>
        )
    }

    function discard() {
        setValues(initialValues)
        setExceptions(initialExceptions)
    }

    async function save() {
        const gameOverrides = GAME_EXCEPTION_CHANNEL_FIELDS.reduce(
            (overrides, field) =>
                withGameExceptions<
                    GameDiscordOverrides,
                    GameExceptionChannelField
                >(overrides, field, exceptions[field], enabledGames),
            config?.gameOverrides ?? {}
        )
        setSaving(true)
        const result = await saveDiscordSettings(serverId, {
            timezone: values.timezone,
            defaultLanguage: values.defaultLanguage,
            announcementsChannelId: clearableId(values.announcementsChannelId),
            eventInfoChannelId: clearableId(values.eventInfoChannelId),
            eventResultsChannelId: clearableId(values.eventResultsChannelId),
            forumCategoryId: clearableId(values.forumCategoryId),
            meetingChannelId: clearableId(values.meetingChannelId),
            squadVoiceCategoryId: clearableId(values.squadVoiceCategoryId),
            gameOverrides,
            ...(values.defaultLanguage !== (config?.defaultLanguage ?? "en")
                ? remapLocalizedDefaults(config, values.defaultLanguage)
                : {}),
        }).finally(() => setSaving(false))
        if (!result.ok) {
            toast.error(
                result.error ??
                    dictionary.serverSettings.discordSettingsSaveError
            )
            return
        }
        toast.success(dictionary.serverSettings.discordSettingsSaved)
        startTransition(() => router.refresh())
    }

    const languageName = (language: ClanLanguage) =>
        language === "en"
            ? dictionary.serverSettings.languageEnglish
            : language === "cs"
              ? dictionary.serverSettings.languageCzech
              : dictionary.serverSettings.languageGerman

    return (
        <div className="space-y-6">
            {!values.announcementsChannelId ? (
                <div
                    role="alert"
                    className="flex items-start gap-2.5 rounded-xl border border-amber-400/60 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100"
                >
                    <TriangleAlert
                        className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
                        aria-hidden="true"
                    />
                    <p>
                        <strong className="font-semibold">
                            {text.missingAnnouncements}
                        </strong>{" "}
                        {text.missingAnnouncementsHelp}
                    </p>
                </div>
            ) : null}

            <Card id="channels-language" title={text.languageTitle}>
                <Row>
                    <SettingsField
                        label={text.timezone}
                        help={text.timezoneHelp}
                    >
                        <Select
                            value={values.timezone}
                            onValueChange={(value) =>
                                setValue("timezone", value)
                            }
                        >
                            <SelectTrigger
                                className="w-full rounded-lg"
                                aria-label={text.timezone}
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {supportedTimezones.map((item) => (
                                    <SelectItem key={item} value={item}>
                                        {item}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {multiGame ? (
                            <ClanWideNote
                                label={hub.scopeLegend.clanWideShort}
                            />
                        ) : null}
                    </SettingsField>
                </Row>
                <Row>
                    <SettingsField
                        label={text.language}
                        help={text.languageHelp}
                    >
                        <Select
                            value={values.defaultLanguage}
                            onValueChange={(value) => {
                                const language = supportedClanLanguages.find(
                                    (item) => item === value
                                )
                                if (language)
                                    setValue("defaultLanguage", language)
                            }}
                        >
                            <SelectTrigger
                                className="w-full rounded-lg"
                                aria-label={text.language}
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {supportedClanLanguages.map((item) => (
                                    <SelectItem key={item} value={item}>
                                        {languageName(item)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {multiGame ? (
                            <ClanWideNote
                                label={hub.scopeLegend.clanWideShort}
                            />
                        ) : null}
                    </SettingsField>
                </Row>
            </Card>

            <Card id="channels-text" title={text.textTitle}>
                {routingRow(
                    "announcementsChannelId",
                    <>
                        {text.announcements}{" "}
                        <span
                            className={cn(
                                "font-normal",
                                values.announcementsChannelId
                                    ? "text-muted-foreground"
                                    : "text-amber-700 dark:text-amber-400"
                            )}
                        >
                            · {text.required}
                        </span>
                    </>,
                    text.announcementsHelp
                )}
                {routingRow(
                    "eventInfoChannelId",
                    text.eventInfo,
                    text.eventInfoHelp
                )}
                <Row>
                    <SettingsField
                        label={text.eventResults}
                        help={text.eventResultsHelp}
                    >
                        <DiscordChannelSelect
                            id="channels-eventResultsChannelId"
                            value={values.eventResultsChannelId}
                            onChange={(value) =>
                                setValue("eventResultsChannelId", value)
                            }
                            options={channelOptions(channels, "text")}
                            kind="text"
                            placeholder={text.selectChannel}
                            noneLabel={text.none}
                            loading={metadataState.status === "loading"}
                            unavailable={metadataState.status === "failed"}
                        />
                        <ClanWideNote label={hub.scopeLegend.clanWideShort} />
                    </SettingsField>
                </Row>
                {routingRow("forumCategoryId", text.forum, text.forumHelp)}
            </Card>

            <Card id="channels-voice" title={text.voiceTitle}>
                {routingRow(
                    "squadVoiceCategoryId",
                    text.squadVoice,
                    text.squadVoiceHelp
                )}
                {routingRow("meetingChannelId", text.meeting, text.meetingHelp)}
            </Card>

            <UnsavedChangesBar
                changes={changes}
                saving={saving || isPending}
                onDiscard={discard}
                onSave={() => void save()}
                dictionary={dictionary}
            />
        </div>
    )
}
