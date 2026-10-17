"use client"

import { Loader2, Lock, Send, X } from "lucide-react"
import { useMemo, useState } from "react"
import Link from "next/link"

import {
    changedRecipients,
    countRosterPlayerChanges,
    diffRosterPlaces,
    rosterPlaces,
    snapshotToPlaces,
    type RosterPlayerChange,
} from "@/domain/rosters/roster-update-summary"
import {
    rosterChangesView,
    rosterMessageView,
    type RosterCardContext,
    type RosterCardEvent,
    type RosterMessageVariant,
} from "@/domain/discord-messages/roster-message"
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { DiscordMessagePreview } from "@/components/app/discord-preview/discord-message-preview"
import type { MessageStyle } from "@/domain/discord-messages/message-style"
import { calendarDayOffset } from "@/domain/discord-messages/calendar-day"
import type { AppUser, EventRecord, Group, Roster } from "@/types/domain"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { getIntlLocaleForClanLanguage } from "@/lib/clan-language/core"
import { matchTitle } from "@/domain/discord-messages/match-text"
import { getRosterMessages } from "@/lib/clan-language/rosters"
import { formatDiscordMapLabel } from "@/lib/discord-map-label"
import { getSystemMessages } from "@/lib/clan-language/system"
import type { Dictionary } from "@/i18n/dictionaries"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { pluralize } from "@/i18n/plural"
import { cn } from "@/lib/utils"

/** What the clan's settings tell the publish dialog (board D5, N1-11/12/24). */
export type RosterPublishContext = {
    /** The clan language: the preview shows the bot's words. */
    language: string
    messageStyle?: MessageStyle | null
    timeZone: string
    /** The roster channel's name ("info-akce"), read-only here (D5-07). */
    rosterChannelName?: string
    meetingChannelId?: string
    meetingChannelName?: string
    categoryLabel?: string
    defaultVariant: RosterMessageVariant
    changesPostDefault: boolean
    changesDmDefault: boolean
    /** "Zprávy a panely → Soupiska". */
    messagesSettingsHref: string
    /** "Kanály a jazyk". */
    channelsSettingsHref: string
    /** The public roster page "Otevřít soupisku" opens; empty uses this site. */
    rosterUrl: string
}

/** The admin's choices for one publish; not part of /api/v1 (live action). */
export type RosterPublishChoice = {
    variant: RosterMessageVariant
    mentionPlayers: boolean
    notifyPlayers: boolean
    postChanges: boolean
}

type Mode = "publish" | "republish"

const filled = (player: Roster["squads"][number]["players"][number]) =>
    Boolean(player.id || player.customName?.trim())

/** "18 v soupisce", "7 záloh", "3 neúčastní" (D5-10, D5-B06). */
export function rosterCounters(roster: Roster) {
    return {
        rostered: roster.squads.reduce(
            (sum, squad) => sum + squad.players.filter(filled).length,
            0
        ),
        reserves: roster.reservePlayerIds.length,
        notAttending: roster.notAttendingPlayerIds.length,
    }
}

/**
 * The diff the dialog lists, against the last published version (D5-B04):
 * the places the server stored at that publish, the same baseline the
 * digest and the DMs use; a roster published before the snapshots existed
 * compares with its saved squads.
 */
export function publishChanges(saved: Roster | undefined, draft: Roster) {
    if (!saved?.published) return []
    return diffRosterPlaces(
        saved.publishedPlaces
            ? snapshotToPlaces(saved.publishedPlaces)
            : rosterPlaces(saved),
        rosterPlaces(draft),
        draft.reservePlayerIds
    )
}

function formatShortDateTime(
    value: string | undefined,
    locale: string,
    timeZone: string
) {
    if (!value) return undefined
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return undefined
    const zone = { timeZone: timeZone || "UTC" } as const
    const day = new Intl.DateTimeFormat(locale, {
        ...zone,
        weekday: "short",
        day: "numeric",
        month: "numeric",
    }).format(date)
    const time = new Intl.DateTimeFormat(locale, {
        ...zone,
        hour: "2-digit",
        minute: "2-digit",
    }).format(date)
    return `${day} · ${time}`
}

/** The clan's zone when the browser knows it, else UTC. */
function knownZone(timeZone: string) {
    try {
        new Intl.DateTimeFormat("en", { timeZone: timeZone || "UTC" })
        return timeZone || "UTC"
    } catch {
        return "UTC"
    }
}

/**
 * When the shown version was published, by the clan's calendar day:
 * "dnes v 18:40", "včera v 18:40", else "út 6. 10. v 18:40" (D5-13, D5-14).
 */
export function publishedDayTime(
    value: string | undefined,
    now: number,
    locale: string,
    timeZone: string,
    text: Pick<
        Dictionary["rosterPublish"],
        "publishedToday" | "publishedYesterday" | "publishedOn"
    >
) {
    if (!value) return undefined
    const at = Date.parse(value)
    if (!Number.isFinite(at)) return undefined
    const zone = knownZone(timeZone)
    const time = new Intl.DateTimeFormat(locale, {
        timeZone: zone,
        hour: "2-digit",
        minute: "2-digit",
    }).format(at)
    const offset = calendarDayOffset(at, now, zone)
    if (offset === 0) return text.publishedToday.replace("{time}", time)
    if (offset === -1) return text.publishedYesterday.replace("{time}", time)
    const date = new Intl.DateTimeFormat(locale, {
        timeZone: zone,
        weekday: "short",
        day: "numeric",
        month: "numeric",
    }).format(at)
    return text.publishedOn.replace("{date}", date).replace("{time}", time)
}

function ChangeLine({
    change,
    name,
    toReserves,
}: {
    change: RosterPlayerChange
    name: string
    toReserves: string
}) {
    const place = (value?: { squad: string; role?: string }) =>
        [value?.squad, value?.role].filter(Boolean).join(" ")
    const sign = change.added ? "+" : change.removed ? "−" : "↔"
    const detail = change.added
        ? [change.after?.squad, change.after?.role].filter(Boolean).join(" · ")
        : change.removed
          ? change.toReserves
              ? toReserves
              : place(change.before)
          : change.roleChanged
            ? `${place(change.before)} → ${place(change.after)}`
            : `${change.before?.squad} → ${change.after?.squad}`
    return (
        <li className="flex min-w-0 gap-2 text-[13px] leading-5">
            <span
                aria-hidden
                className={cn(
                    "w-3 shrink-0 font-semibold",
                    change.added && "text-emerald-600",
                    change.removed && "text-red-600",
                    !change.added && !change.removed && "text-muted-foreground"
                )}
            >
                {sign}
            </span>
            <span className="min-w-0">
                <strong className="font-semibold">{name}</strong>
                {detail ? ` · ${detail}` : null}
            </span>
        </li>
    )
}

/**
 * The publish dialog (board D5): what goes to Discord (photo with the text
 * roster, the default, or the photo only), the read-only channel, the
 * mention, change DM and change post switches, the counters, the changes
 * since the last published version and a preview of exactly what the bot
 * posts.
 */
type DialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    mode: Mode
    dictionary: Dictionary
    locale: string
    event: EventRecord
    /** The last published version. */
    saved?: Roster
    /** The roster about to be published. */
    draft: Roster
    users: AppUser[]
    memberIds: ReadonlySet<string>
    groups: Group[]
    context: RosterPublishContext
    pending: boolean
    onPublish: (choice: RosterPublishChoice) => void
}

export function RosterPublishDialog(props: DialogProps) {
    return (
        <Dialog open={props.open} onOpenChange={props.onOpenChange}>
            <DialogContent
                showCloseButton={false}
                className="max-h-[92vh] gap-0 overflow-y-auto p-0 sm:max-w-5xl"
            >
                {/* The body mounts only while open: fresh defaults every time. */}
                <RosterPublishBody {...props} />
            </DialogContent>
        </Dialog>
    )
}

function RosterPublishBody({
    mode,
    dictionary,
    locale,
    event,
    saved,
    draft,
    users,
    memberIds,
    groups,
    context,
    pending,
    onPublish,
}: DialogProps) {
    const t = dictionary.rosterPublish
    const republish = mode === "republish"
    const [variant, setVariant] = useState<RosterMessageVariant>(
        context.defaultVariant
    )
    const [mentionPlayers, setMentionPlayers] = useState(!republish)
    const [notifyPlayers, setNotifyPlayers] = useState(context.changesDmDefault)
    const [postChanges, setPostChanges] = useState(context.changesPostDefault)
    // A fixed "now" keeps relative Discord times stable while the dialog is open.
    const [now] = useState(() => Date.now())

    const names = useMemo(
        () =>
            Object.fromEntries(
                users.map((user) => [user.discordId, user.name] as const)
            ),
        [users]
    )
    const counters = rosterCounters(draft)
    const changes = useMemo(
        () => (republish ? publishChanges(saved, draft) : []),
        [republish, saved, draft]
    )
    const changeCounts = countRosterPlayerChanges(changes)
    const recipients = changedRecipients(changes, memberIds).length
    const title = matchTitle(event)
    const when = formatShortDateTime(event.gameStart, locale, context.timeZone)
    const publishedAt = republish
        ? publishedDayTime(
              saved?.publishedAt ?? saved?.updatedAt,
              now,
              locale,
              context.timeZone,
              t
          )
        : undefined
    const channel = context.rosterChannelName
        ? `#${context.rosterChannelName}`
        : t.channelMissing

    const layout = {
        copy: getSystemMessages(context.language).kit,
        locale: getIntlLocaleForClanLanguage(context.language),
        style: context.messageStyle,
    }
    const cardEvent: RosterCardEvent = {
        id: event.id,
        title,
        category: context.categoryLabel,
        mapLabel: formatDiscordMapLabel(
            event.map,
            event.gameId,
            context.language
        ),
        registrationEnd: event.registrationEnd,
        meetingStart: event.meetingStart,
        gameStart: event.gameStart,
        meetingChannelId: context.meetingChannelId,
    }
    const cardContext: RosterCardContext = {
        copy: getRosterMessages(context.language),
        timeZone: context.timeZone,
        names,
        groups: groups.map((group) => ({
            id: group.id,
            name: group.name,
            order: group.order,
            parentId: group.parentId,
        })),
        rosterUrl:
            context.rosterUrl ||
            `${window.location.origin}/${context.language}/rosters/${encodeURIComponent(event.id)}`,
        now,
    }
    const rosterView = rosterMessageView(
        {
            event: cardEvent,
            roster: draft,
            variant,
            image: {
                url: "attachment://soupiska.png",
                description: t.photoPlaceholder,
            },
            publishedAt: republish
                ? (saved?.publishedAt ?? saved?.updatedAt)
                : new Date(now).toISOString(),
        },
        cardContext,
        layout
    )
    const digestView =
        republish && postChanges && changes.length
            ? rosterChangesView({
                  event: cardEvent,
                  changes,
                  editedAt: new Date(now).toISOString(),
                  context: cardContext,
              })
            : undefined
    const previewMentions = {
        channels:
            context.meetingChannelId && context.meetingChannelName
                ? { [context.meetingChannelId]: context.meetingChannelName }
                : {},
    }
    const timeOf = (value: number) =>
        new Intl.DateTimeFormat(locale, {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: context.timeZone || "UTC",
        }).format(value)

    const switchRow = (
        id: string,
        label: string,
        hint: string,
        checked: boolean,
        onChange: (value: boolean) => void
    ) => (
        <div className="flex items-start gap-3">
            <Switch
                id={id}
                checked={checked}
                onCheckedChange={onChange}
                aria-label={label}
                className="mt-0.5"
            />
            <label htmlFor={id} className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{label}</span>
                <span className="text-muted-foreground text-xs">{hint}</span>
            </label>
        </div>
    )

    return (
        <>
            <DialogHeader className="flex-row items-start justify-between gap-3 border-b px-5 py-4 text-left">
                <div className="min-w-0">
                    <DialogTitle>
                        {republish ? t.republishTitle : t.publishTitle}
                    </DialogTitle>
                    <DialogDescription>
                        {[
                            title,
                            when,
                            publishedAt
                                ? t.publishedAt.replace("{time}", publishedAt)
                                : undefined,
                        ]
                            .filter(Boolean)
                            .join(" · ")}
                    </DialogDescription>
                </div>
                <DialogClose asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 rounded-lg"
                        aria-label={t.close}
                    >
                        <X className="size-4" />
                    </Button>
                </DialogClose>
            </DialogHeader>
            <div className="grid gap-5 px-5 py-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="flex min-w-0 flex-col gap-5">
                    {republish ? (
                        <section
                            aria-label={t.changesTitle}
                            className="rounded-xl border p-3"
                        >
                            <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-sm font-semibold">
                                    {t.changesTitle}
                                </h3>
                                <Badge
                                    variant="outline"
                                    className="border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400"
                                >
                                    +{changeCounts.added}
                                </Badge>
                                <Badge
                                    variant="outline"
                                    className="border-red-300 text-red-700 dark:border-red-900 dark:text-red-400"
                                >
                                    −{changeCounts.removed}
                                </Badge>
                                <Badge variant="outline">
                                    {t.changesMoved.replace(
                                        "{count}",
                                        String(changeCounts.moved)
                                    )}
                                </Badge>
                            </div>
                            {changes.length ? (
                                <ul className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-2">
                                    {changes.map((change) => (
                                        <ChangeLine
                                            key={change.userId}
                                            change={change}
                                            name={
                                                names[change.userId] ??
                                                dictionary.common.unknown
                                            }
                                            toReserves={t.toReserves}
                                        />
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-muted-foreground mt-2 text-xs">
                                    {t.noChanges}
                                </p>
                            )}
                            {publishedAt ? (
                                <p className="text-muted-foreground mt-2 text-xs">
                                    {t.changesAgainst.replace(
                                        "{time}",
                                        publishedAt
                                    )}
                                </p>
                            ) : null}
                        </section>
                    ) : null}
                    <fieldset className="flex flex-col gap-2">
                        <legend className="mb-2 text-sm font-medium">
                            {t.contentLabel}
                        </legend>
                        <RadioGroup
                            value={variant}
                            onValueChange={(value) =>
                                setVariant(value as RosterMessageVariant)
                            }
                            className="gap-2"
                        >
                            {(
                                [
                                    [
                                        "photo_text",
                                        t.variantPhotoText,
                                        t.variantPhotoTextDescription,
                                    ],
                                    [
                                        "photo",
                                        t.variantPhoto,
                                        t.variantPhotoDescription,
                                    ],
                                ] as const
                            ).map(([value, label, description]) => (
                                <label
                                    key={value}
                                    htmlFor={`roster-variant-${value}`}
                                    className={cn(
                                        "flex cursor-pointer items-start gap-3 rounded-xl border p-3",
                                        variant === value &&
                                            "border-foreground ring-foreground/10 ring-2"
                                    )}
                                >
                                    <RadioGroupItem
                                        id={`roster-variant-${value}`}
                                        value={value}
                                        className="mt-1"
                                    />
                                    <span
                                        aria-hidden
                                        className="bg-muted flex h-12 w-14 shrink-0 flex-col gap-1 rounded-md border-l-4 border-l-[#E8A33D] p-1.5"
                                    >
                                        <span className="bg-muted-foreground/40 h-4 rounded-sm" />
                                        {value === "photo_text" ? (
                                            <>
                                                <span className="bg-muted-foreground/30 h-0.5 rounded" />
                                                <span className="bg-muted-foreground/30 h-0.5 w-2/3 rounded" />
                                            </>
                                        ) : null}
                                    </span>
                                    <span className="flex min-w-0 flex-col gap-0.5">
                                        <span className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                                            {label}
                                            {context.defaultVariant ===
                                            value ? (
                                                <Badge
                                                    variant="outline"
                                                    className="font-normal"
                                                >
                                                    {t.defaultChip}
                                                </Badge>
                                            ) : null}
                                        </span>
                                        <span className="text-muted-foreground text-xs">
                                            {description}
                                        </span>
                                    </span>
                                </label>
                            ))}
                        </RadioGroup>
                        <p className="text-muted-foreground text-xs">
                            {t.defaultNote}{" "}
                            <Link
                                href={context.messagesSettingsHref}
                                className="underline underline-offset-2"
                            >
                                {t.defaultNoteLink}
                            </Link>
                            .
                        </p>
                    </fieldset>
                    <div className="flex flex-col gap-1.5">
                        <span className="text-sm font-medium">
                            {t.channelLabel}
                        </span>
                        <div
                            aria-readonly
                            className="bg-muted rounded-lg px-3 py-2 text-sm"
                        >
                            {channel}
                        </div>
                        <span className="text-muted-foreground flex items-center gap-1 text-xs">
                            <Lock className="size-3" aria-hidden />
                            {t.channelFrom}{" "}
                            <Link
                                href={context.channelsSettingsHref}
                                className="underline underline-offset-2"
                            >
                                {t.channelFromLink}
                            </Link>
                        </span>
                    </div>
                    <div className="flex flex-col gap-3">
                        {republish ? (
                            <>
                                {switchRow(
                                    "roster-publish-dm",
                                    t.dmLabel,
                                    pluralize(locale, recipients, t.dmHint),
                                    notifyPlayers,
                                    setNotifyPlayers
                                )}
                                {switchRow(
                                    "roster-publish-post",
                                    t.postLabel,
                                    t.postHint,
                                    postChanges,
                                    setPostChanges
                                )}
                            </>
                        ) : null}
                        {!republish
                            ? switchRow(
                                  "roster-publish-mention",
                                  t.mentionLabel,
                                  pluralize(
                                      locale,
                                      counters.rostered,
                                      t.mentionFirstHint
                                  ),
                                  mentionPlayers,
                                  setMentionPlayers
                              )
                            : null}
                        {republish ? null : (
                            <p className="text-muted-foreground text-xs">
                                {t.laterNote}
                            </p>
                        )}
                    </div>
                    <dl className="grid grid-cols-3 gap-2">
                        {(
                            [
                                [counters.rostered, t.rostered],
                                [
                                    counters.reserves,
                                    pluralize(
                                        locale,
                                        counters.reserves,
                                        t.reserves
                                    ),
                                ],
                                [counters.notAttending, t.notAttending],
                            ] as const
                        ).map(([value, label]) => (
                            <div
                                key={label}
                                className="bg-muted/60 rounded-xl px-3 py-2"
                            >
                                <dt className="sr-only">{label}</dt>
                                <dd className="text-lg font-semibold">
                                    {value}
                                </dd>
                                <dd
                                    aria-hidden
                                    className="text-muted-foreground text-xs"
                                >
                                    {label}
                                </dd>
                            </div>
                        ))}
                    </dl>
                </div>
                <section
                    aria-label={t.previewTitle.replace("{channel}", channel)}
                    className="bg-muted/40 flex min-w-0 flex-col gap-2 rounded-xl border p-3"
                >
                    <h3 className="text-sm font-semibold">
                        {t.previewTitle.replace("{channel}", channel)}
                    </h3>
                    <div className="flex flex-col gap-3 rounded-xl bg-[#313338] p-3">
                        <DiscordMessagePreview
                            view={rosterView}
                            language={context.language}
                            style={context.messageStyle}
                            labels={dictionary.discordPreview}
                            now={now}
                            timeZone={context.timeZone}
                            mentions={previewMentions}
                            author={{
                                time: timeOf(now),
                                edited: republish,
                            }}
                        />
                        {digestView ? (
                            <DiscordMessagePreview
                                view={digestView}
                                language={context.language}
                                style={context.messageStyle}
                                labels={dictionary.discordPreview}
                                now={now}
                                timeZone={context.timeZone}
                                author={{ time: timeOf(now) }}
                            />
                        ) : null}
                    </div>
                    <p className="text-muted-foreground text-xs">
                        {republish
                            ? t.republishCaption.replace("{channel}", channel)
                            : t.previewCaption}
                    </p>
                </section>
            </div>
            <DialogFooter className="border-t px-5 py-3">
                <DialogClose asChild>
                    <Button variant="outline" className="rounded-xl">
                        {t.cancel}
                    </Button>
                </DialogClose>
                <Button
                    className="rounded-xl"
                    disabled={pending}
                    onClick={() =>
                        onPublish({
                            variant,
                            mentionPlayers,
                            notifyPlayers: republish && notifyPlayers,
                            postChanges: republish && postChanges,
                        })
                    }
                >
                    {pending ? (
                        <Loader2 className="size-4 animate-spin" />
                    ) : (
                        <Send className="size-4" />
                    )}
                    {republish ? t.republish : t.publish}
                </Button>
            </DialogFooter>
        </>
    )
}
