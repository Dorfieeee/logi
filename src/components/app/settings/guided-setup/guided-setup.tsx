"use client"

import {
    useEffect,
    useRef,
    useState,
    useTransition,
    type ReactNode,
} from "react"
import { ArrowLeft, ArrowRight, Check, ChevronDown, X } from "lucide-react"
import { useRouter } from "next/navigation"
import Link from "next/link"

import {
    BotStep,
    ChannelsStep,
    GamesStep,
    GameServersStep,
    ProfileStep,
    RolesStep,
    type GuidedSetupChannels,
    type GuidedSetupProfile,
    type GuidedSetupRoles,
} from "@/components/app/settings/guided-setup/guided-setup-steps"
import {
    saveFrontendSettings,
    type FrontendSettingsSubmission,
} from "@/components/app/settings/save-frontend-settings"
import {
    guidedSetupView,
    type GuidedSetupItem,
    type GuidedSetupPosition,
} from "@/domain/workspaces/guided-setup"
import {
    clearableId,
    saveDiscordSettings,
} from "@/components/app/settings/save-discord-settings"
import {
    guidedSetupHref,
    settingsHref,
} from "@/components/app/settings/settings-section-meta"
import { saveEnabledGames } from "@/components/app/settings/save-enabled-games"
import type { SettingsSetupStep } from "@/domain/workspaces/settings-overview"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useDiscordMetadataState } from "@/hooks/use-discord-metadata"
import type { Dictionary } from "@/i18n/dictionaries"
import type { GameId } from "@/domain/games/game"
import { Button } from "@/components/ui/button"
import { initialsOf } from "@/lib/initials"
import { cn } from "@/lib/utils"

export type GuidedSetupStored = {
    enabledGames: GameId[]
    profile: GuidedSetupProfile
    channels: GuidedSetupChannels
    roles: GuidedSetupRoles
}

type Drafts = GuidedSetupStored
type Outcome = { ok: true; saved: boolean } | { ok: false; error: string }

const sameId = (a?: string, b?: string) => (a || undefined) === (b || undefined)
const CHANNEL_KEYS = [
    "announcementsChannelId",
    "eventInfoChannelId",
    "eventResultsChannelId",
    "errorsChannelId",
] as const
const ROLE_KEYS = ["clanRoleId", "dashboardAdminRoleId"] as const

/** The circle in front of a step: a check when done, the number otherwise. */
function StepMarker({
    item,
    doneLabel,
}: {
    item: Pick<GuidedSetupItem, "marker" | "number">
    doneLabel: string
}) {
    if (item.marker === "done")
        return (
            <span className="bg-primary text-primary-foreground flex size-7 shrink-0 items-center justify-center rounded-full">
                <Check
                    className="size-3.5"
                    strokeWidth={3}
                    role="img"
                    aria-label={doneLabel}
                />
            </span>
        )
    return (
        <span
            className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full text-[13px]",
                item.marker === "current"
                    ? "border-foreground border-2 font-semibold"
                    : "border-muted-foreground/40 text-muted-foreground border font-medium"
            )}
        >
            {item.number}
        </span>
    )
}

/**
 * The setup guide (design B): six steps from inviting the bot to connecting a
 * game server, one card at a time. "Continue" saves the step through the same
 * routes the settings pages use and moves on, "Skip" moves on without saving.
 * Which steps are finished comes from the stored settings, by the same rule as
 * the settings overview.
 */
export function GuidedSetup({
    locale,
    serverId,
    clanName,
    clanAvatar,
    stored,
    collections,
    botInside,
    inviteUrl,
    steps,
    initialStep,
    dictionary,
}: {
    locale: string
    serverId: string
    clanName: string
    clanAvatar: string
    stored: GuidedSetupStored
    /** Saved unchanged with the profile, which the route stores as a whole. */
    collections: Pick<
        FrontendSettingsSubmission,
        "eventCategories" | "calendarItems"
    >
    botInside: boolean
    inviteUrl: string
    steps: SettingsSetupStep[]
    initialStep: GuidedSetupPosition
    dictionary: Dictionary
}) {
    const copy = dictionary.settingsHub.guidedSetup
    const titles = dictionary.settingsHub.overview.setup.steps
    const router = useRouter()
    const [, startTransition] = useTransition()
    const [position, setPosition] = useState(initialStep)
    const [drafts, setDrafts] = useState<Drafts>(stored)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [stepsOpen, setStepsOpen] = useState(false)
    const [metadataVersion, setMetadataVersion] = useState(0)
    const metadata = useDiscordMetadataState(serverId, metadataVersion)
    const heading = useRef<HTMLHeadingElement>(null)
    const shown = useRef(initialStep)
    const view = guidedSetupView(steps, position)
    const current = view.current

    useEffect(() => {
        window.history.replaceState(
            null,
            "",
            guidedSetupHref(locale, serverId, position)
        )
        // Move focus to a newly opened step's heading, not on the first render.
        if (shown.current !== position) heading.current?.focus()
        shown.current = position
    }, [locale, serverId, position])

    function goTo(next: GuidedSetupPosition) {
        setError(null)
        setStepsOpen(false)
        setPosition(next)
    }

    /** Channels and roles: only the IDs this step shows, an emptied one cleared. */
    async function saveIds<K extends string>(
        keys: readonly K[],
        draft: Partial<Record<K, string>>,
        saved: Partial<Record<K, string>>
    ): Promise<Outcome> {
        if (keys.every((key) => sameId(draft[key], saved[key])))
            return { ok: true, saved: false }
        const result = await saveDiscordSettings(
            serverId,
            Object.fromEntries(
                keys.map((key) => [key, clearableId(draft[key])])
            )
        )
        return result.ok
            ? { ok: true, saved: true }
            : { ok: false, error: result.error ?? copy.saveError }
    }

    async function save(): Promise<Outcome> {
        switch (current?.id) {
            case "games": {
                if (!drafts.enabledGames.length)
                    return { ok: false, error: copy.steps.games.required }
                const same =
                    drafts.enabledGames.length === stored.enabledGames.length &&
                    drafts.enabledGames.every((game) =>
                        stored.enabledGames.includes(game)
                    )
                if (same) return { ok: true, saved: false }
                const result = await saveEnabledGames(
                    serverId,
                    drafts.enabledGames
                )
                return result.ok
                    ? { ok: true, saved: true }
                    : { ok: false, error: copy.saveError }
            }
            case "profile": {
                const profile = drafts.profile
                if (
                    profile.name === stored.profile.name &&
                    profile.avatar === stored.profile.avatar &&
                    profile.description === stored.profile.description
                )
                    return { ok: true, saved: false }
                if (!profile.name.trim())
                    return { ok: false, error: copy.steps.profile.nameRequired }
                if (!profile.avatar.trim())
                    return { ok: false, error: copy.steps.profile.logoRequired }
                const result = await saveFrontendSettings(serverId, {
                    name: profile.name.trim(),
                    avatar: profile.avatar,
                    description: profile.description,
                    ...collections,
                })
                return result.ok
                    ? { ok: true, saved: true }
                    : { ok: false, error: result.error ?? copy.saveError }
            }
            case "channels":
                return saveIds(CHANNEL_KEYS, drafts.channels, stored.channels)
            case "roles":
                return saveIds(ROLE_KEYS, drafts.roles, stored.roles)
            default:
                // The bot and the game servers save nothing here: the bot is
                // invited on Discord, a server is saved by its own form.
                return { ok: true, saved: false }
        }
    }

    async function next() {
        const target = view.next
        if (!target || saving) return
        setSaving(true)
        setError(null)
        let outcome: Outcome
        try {
            outcome = await save()
        } catch {
            // A request that never reached the server.
            outcome = { ok: false, error: copy.saveError }
        } finally {
            setSaving(false)
        }
        if (!outcome.ok) {
            setError(outcome.error)
            return
        }
        goTo(target)
        if (outcome.saved) startTransition(() => router.refresh())
    }

    const refresh = () => startTransition(() => router.refresh())
    const stepTitle = (id: GuidedSetupItem["id"]) => titles[id].title
    const overviewHref = settingsHref(locale, serverId)

    let body: ReactNode = null
    switch (current?.id) {
        case "bot":
            body = (
                <BotStep
                    botInside={botInside}
                    metadata={metadata.status}
                    inviteUrl={inviteUrl}
                    onChecked={() => setMetadataVersion((value) => value + 1)}
                    copy={copy.steps.bot}
                    dictionary={dictionary}
                />
            )
            break
        case "games":
            body = (
                <GamesStep
                    value={drafts.enabledGames}
                    onChange={(enabledGames) =>
                        setDrafts((value) => ({ ...value, enabledGames }))
                    }
                    copy={copy.steps.games}
                />
            )
            break
        case "profile":
            body = (
                <ProfileStep
                    value={drafts.profile}
                    onChange={(profile) =>
                        setDrafts((value) => ({ ...value, profile }))
                    }
                    copy={copy.steps.profile}
                    optional={copy.optionalSuffix}
                />
            )
            break
        case "channels":
            body = (
                <ChannelsStep
                    value={drafts.channels}
                    onChange={(channels) =>
                        setDrafts((value) => ({ ...value, channels }))
                    }
                    metadata={metadata}
                    copy={copy.steps.channels}
                    optional={copy.optionalSuffix}
                    unavailable={copy.discordUnavailable}
                />
            )
            break
        case "roles":
            body = (
                <RolesStep
                    value={drafts.roles}
                    onChange={(roles) =>
                        setDrafts((value) => ({ ...value, roles }))
                    }
                    metadata={metadata}
                    copy={copy.steps.roles}
                    unavailable={copy.discordUnavailable}
                />
            )
            break
        case "gameServers":
            body = (
                <GameServersStep
                    serverId={serverId}
                    dictionary={dictionary}
                    onChanged={refresh}
                />
            )
            break
    }

    const stepLabel = current
        ? copy.stepOf
              .replace("{number}", String(current.number))
              .replace("{total}", String(view.total))
        : ""

    return (
        <div className="bg-background text-foreground min-h-dvh">
            <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b px-4 py-3 sm:px-6">
                <div className="flex min-w-0 items-center gap-2.5 text-sm">
                    <Avatar className="size-7 shrink-0 rounded-lg">
                        {clanAvatar ? (
                            <AvatarImage src={clanAvatar} alt="" />
                        ) : null}
                        <AvatarFallback className="bg-primary text-primary-foreground rounded-lg text-xs font-semibold">
                            {initialsOf(clanName)}
                        </AvatarFallback>
                    </Avatar>
                    <span className="shrink-0 font-semibold">
                        {copy.workspace}
                    </span>
                    <span className="text-muted-foreground truncate">
                        · {clanName}
                    </span>
                </div>
                <Button
                    asChild
                    variant="ghost"
                    className="text-foreground/80 -mx-1 h-9 rounded-lg px-3 sm:mx-0"
                >
                    <Link href={overviewHref}>
                        {copy.exit}
                        <X className="size-4" aria-hidden="true" />
                    </Link>
                </Button>
            </header>
            <div
                role="progressbar"
                aria-label={copy.progressLabel}
                aria-valuemin={0}
                aria-valuemax={view.total}
                aria-valuenow={view.done}
                className="bg-muted h-1"
            >
                <div
                    className="bg-primary h-full transition-[width]"
                    style={{ width: `${(view.done / view.total) * 100}%` }}
                />
            </div>

            <div className="mx-auto flex max-w-[1040px] flex-col gap-6 px-4 pt-6 pb-32 sm:px-6 sm:pb-14 md:flex-row md:items-start md:gap-8 md:pt-10">
                <nav
                    aria-label={copy.stepsLabel}
                    className="flex flex-col gap-3 md:w-60 md:shrink-0"
                >
                    <button
                        type="button"
                        aria-expanded={stepsOpen}
                        aria-controls="guided-setup-steps"
                        onClick={() => setStepsOpen((open) => !open)}
                        className="bg-muted/60 flex min-h-[52px] items-center gap-3 rounded-[10px] px-3 py-2 text-left md:hidden"
                    >
                        {current ? (
                            <StepMarker
                                item={{
                                    marker: "current",
                                    number: current.number,
                                }}
                                doneLabel={copy.doneMark}
                            />
                        ) : (
                            <StepMarker
                                item={{ marker: "done", number: 0 }}
                                doneLabel={copy.doneMark}
                            />
                        )}
                        <span className="flex min-w-0 flex-1 flex-col leading-[18px]">
                            <span className="truncate text-sm font-semibold">
                                {current
                                    ? stepTitle(current.id)
                                    : copy.finished.title}
                            </span>
                            <span className="text-muted-foreground text-xs">
                                {dictionary.settingsHub.overview.setup.progress
                                    .replace("{done}", String(view.done))
                                    .replace("{total}", String(view.total))}
                            </span>
                        </span>
                        <ChevronDown
                            className={cn(
                                "text-muted-foreground size-4 shrink-0 transition-transform",
                                stepsOpen && "rotate-180"
                            )}
                            aria-hidden="true"
                        />
                    </button>
                    <div
                        id="guided-setup-steps"
                        className={cn(
                            "flex-col gap-3 md:flex",
                            stepsOpen ? "flex" : "hidden"
                        )}
                    >
                        <p className="text-muted-foreground px-2 text-[13px] leading-[18px]">
                            {copy.reopenHint}
                        </p>
                        <ol className="flex flex-col gap-0.5">
                            {view.items.map((item) => (
                                <li key={item.id}>
                                    <button
                                        type="button"
                                        aria-current={
                                            item.marker === "current"
                                                ? "step"
                                                : undefined
                                        }
                                        onClick={() => goTo(item.id)}
                                        className={cn(
                                            "focus-visible:ring-ring/50 flex min-h-[52px] w-full items-center gap-3 rounded-[10px] p-2 text-left outline-none focus-visible:ring-[3px]",
                                            item.marker === "current"
                                                ? "bg-muted"
                                                : "hover:bg-muted/50"
                                        )}
                                    >
                                        <StepMarker
                                            item={item}
                                            doneLabel={copy.doneMark}
                                        />
                                        <span className="flex flex-col leading-[18px]">
                                            <span
                                                className={cn(
                                                    "text-sm",
                                                    item.marker === "current"
                                                        ? "font-semibold"
                                                        : "font-medium"
                                                )}
                                            >
                                                {stepTitle(item.id)}
                                            </span>
                                            <span className="text-muted-foreground text-xs">
                                                {item.optional
                                                    ? copy.optional
                                                    : copy.required}
                                            </span>
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ol>
                    </div>
                </nav>

                <section
                    aria-live="polite"
                    className="bg-card flex min-w-0 flex-1 flex-col gap-6 rounded-[14px] border p-5 shadow-xs sm:p-8"
                >
                    {current ? (
                        <>
                            <div className="flex flex-col gap-5">
                                <div className="flex flex-col gap-1.5">
                                    <span className="text-muted-foreground text-[13px] font-medium">
                                        {stepLabel}
                                        {current.optional
                                            ? ` · ${copy.optionalSuffix}`
                                            : ""}
                                    </span>
                                    <h1
                                        ref={heading}
                                        tabIndex={-1}
                                        className="text-[22px] leading-[30px] font-semibold outline-none"
                                    >
                                        {copy.steps[current.id].heading}
                                    </h1>
                                    <p className="text-muted-foreground text-sm leading-[22px]">
                                        {copy.steps[current.id].description}
                                    </p>
                                </div>
                                {body}
                            </div>
                            {error ? (
                                <p
                                    role="alert"
                                    className="text-destructive -mt-2 text-sm"
                                >
                                    {error}
                                </p>
                            ) : null}
                            <div className="bg-background flex items-center justify-between gap-3 max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:z-30 max-sm:border-t max-sm:px-3.5 max-sm:pt-3 max-sm:pb-[max(1.125rem,env(safe-area-inset-bottom))] sm:flex-wrap sm:border-t sm:bg-transparent sm:pt-5">
                                <div className="flex">
                                    {view.previous ? (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="rounded-lg max-sm:size-12 max-sm:rounded-xl max-sm:px-0"
                                            aria-label={copy.back}
                                            onClick={() =>
                                                view.previous &&
                                                goTo(view.previous)
                                            }
                                        >
                                            <ArrowLeft
                                                className="size-4"
                                                aria-hidden="true"
                                            />
                                            <span className="max-sm:sr-only">
                                                {copy.back}
                                            </span>
                                        </Button>
                                    ) : null}
                                </div>
                                <div className="flex flex-1 items-center justify-end gap-2 sm:flex-none">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        className="text-foreground/80 rounded-lg max-sm:h-12 max-sm:rounded-xl max-sm:text-[15px]"
                                        disabled={saving}
                                        onClick={() =>
                                            view.next && goTo(view.next)
                                        }
                                    >
                                        {copy.skip}
                                    </Button>
                                    <Button
                                        type="button"
                                        className="rounded-lg max-sm:h-12 max-sm:flex-1 max-sm:rounded-xl max-sm:text-[15px]"
                                        disabled={saving}
                                        onClick={() => void next()}
                                    >
                                        {saving
                                            ? copy.saving
                                            : current.last
                                              ? copy.finish
                                              : copy.continue}
                                        <ArrowRight
                                            className="size-4"
                                            aria-hidden="true"
                                        />
                                    </Button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-start gap-4 py-4">
                            <span className="flex size-12 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                                <Check
                                    className="size-6"
                                    strokeWidth={2.5}
                                    aria-hidden="true"
                                />
                            </span>
                            <h1
                                ref={heading}
                                tabIndex={-1}
                                className="text-[22px] leading-[30px] font-semibold outline-none"
                            >
                                {copy.finished.title}
                            </h1>
                            <p className="text-muted-foreground text-sm leading-[22px]">
                                {copy.finished.description}
                            </p>
                            <div className="flex flex-wrap gap-2">
                                <Button asChild className="rounded-lg">
                                    <Link href={overviewHref}>
                                        {copy.finished.openSettings}
                                    </Link>
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="rounded-lg"
                                    onClick={() => goTo("bot")}
                                >
                                    {copy.finished.again}
                                </Button>
                            </div>
                        </div>
                    )}
                </section>
            </div>
        </div>
    )
}
