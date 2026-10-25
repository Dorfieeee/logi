import {
    reminderAudience,
    suggestedEventName,
    teamChipCode,
    type NewMatchStep,
} from "@/domain/events/new-match-flow"
import {
    panelMapDefinition,
    panelMapKey,
} from "@/domain/discord-publications/panel-graphics"
import type { MessageStyle } from "@/domain/discord-messages/message-style"
import { resolveClanLanguage } from "@/lib/clan-language/core"
import { buildMatchImage } from "@/domain/events/match-image"
import type { EventCategory, Group } from "@/types/domain"
import { getStratmapMapById } from "@/lib/game-stratmaps"
import type { Dictionary } from "@/i18n/dictionaries"

import {
    effectiveReminderHours,
    flowSchedule,
    FLOW_SIGNUP_STATUSES,
    gameGroups,
    type FlowSchedule,
    type FlowValues,
} from "./flow-values"
import type { NewMatchPreviewModel } from "./new-match-preview"

export type FlowText = Dictionary["newMatch"]

/**
 * What the summaries need besides the values: copy, the clan's zone and
 * names of the things the values only reference by ID.
 */
export type FlowSummaryContext = {
    t: FlowText
    /** Intl locale ("cs-CZ"). */
    intl: string
    timezone: string
    clanName: string
    clanAvatar?: string
    /** Your linked catalogue team, when the game has one. */
    ownTeam: {
        name: string
        shortCode: string | null
        logoUrl?: string | null
    } | null
    templateName: string | null
    groups: readonly Group[]
    categories: readonly EventCategory[]
    squadPresets: ReadonlyArray<{ id: string; name: string }>
    topicPresets: ReadonlyArray<{ id: string; name: string }>
    stratmaps: ReadonlyArray<{ id: string; title: string }>
    channelName(id: string): string | null
    roleName(id: string): string | null
}

export function fill(
    template: string,
    values: Record<string, string | number>
) {
    return Object.entries(values).reduce(
        (text, [key, value]) => text.split(`{${key}}`).join(String(value)),
        template
    )
}

export function formatAt(
    iso: string,
    context: Pick<FlowSummaryContext, "intl" | "timezone">,
    withWeekday = true
) {
    return new Intl.DateTimeFormat(context.intl, {
        timeZone: context.timezone,
        weekday: withWeekday ? "short" : undefined,
        day: "numeric",
        month: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date(iso))
}

export function formatTimeOnly(
    iso: string,
    context: Pick<FlowSummaryContext, "intl" | "timezone">
) {
    return new Intl.DateTimeFormat(context.intl, {
        timeZone: context.timezone,
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date(iso))
}

/** Team codes, the name the flow suggests and the map of the values. */
export function flowFacts(values: FlowValues, context: FlowSummaryContext) {
    const isMatch = values.kind === "match"
    const ownCode = teamChipCode(
        context.ownTeam?.name ?? context.clanName,
        context.ownTeam?.shortCode
    )
    const opponentCode = values.opponent
        ? teamChipCode(values.opponent.name, values.opponent.shortCode)
        : null
    const extraCode =
        values.extraTeam && values.gameId === "wardogs"
            ? teamChipCode(values.extraTeam.name, values.extraTeam.shortCode)
            : null
    const suggestedName = suggestedEventName({
        kind: values.kind,
        ownCode,
        opponentCode,
        templateName:
            context.templateName ?? (isMatch ? null : context.t.steps.training),
    })
    const map = values.mapId
        ? (getStratmapMapById(values.mapId, values.gameId) ?? null)
        : null
    return {
        isMatch,
        ownCode,
        opponentCode,
        extraCode,
        name: values.nameTouched ? values.name : suggestedName,
        map,
    }
}

function timeOfDayLabel(t: FlowText, time: string) {
    return (t.match.timesOfDay as Record<string, string>)[time] ?? time
}

function modeLabel(t: FlowText, mode: string) {
    return (t.match.modes as Record<string, string>)[mode] ?? mode
}

export function sideLabel(t: FlowText, side: string | null) {
    return side
        ? ((t.match.sides as Record<string, string>)[side] ?? side)
        : null
}

function channelText(context: FlowSummaryContext, id: string) {
    return `#${context.channelName(id) ?? id}`
}

/** "Foy, den" (and the mode when it is not warfare). */
function mapText(values: FlowValues, context: FlowSummaryContext) {
    const { map } = flowFacts(values, context)
    if (!map) return null
    return [
        map.name,
        values.timeOfDay
            ? timeOfDayLabel(context.t, values.timeOfDay).toLocaleLowerCase(
                  context.intl
              )
            : null,
        values.mapMode && values.mapMode !== "warfare"
            ? modeLabel(context.t, values.mapMode)
            : null,
    ]
        .filter(Boolean)
        .join(", ")
}

function groupsText(values: FlowValues, context: FlowSummaryContext) {
    const limitOf = (groupId: string) =>
        values.signupGroupLimits.find((limit) => limit.groupId === groupId)?.max
    return gameGroups(context.groups, values.gameId)
        .filter((group) => values.signupGroupIds.includes(group.id))
        .map((group) =>
            limitOf(group.id)
                ? fill(context.t.review.groupMax, {
                      name: group.name,
                      count: limitOf(group.id) ?? 0,
                  })
                : group.name
        )
        .join(", ")
}

function statusesText(values: FlowValues, t: FlowText) {
    return (
        values.allowedSignupStatuses.length
            ? values.allowedSignupStatuses
            : FLOW_SIGNUP_STATUSES
    )
        .map((status) => t.signups.statuses[status])
        .join(", ")
}

function pingText(values: FlowValues, t: FlowText) {
    return values.pingMode === "clan"
        ? t.review.pingClan
        : values.pingMode === "roles"
          ? t.review.pingRoles
          : t.review.pingNone
}

/**
 * The four summary rows of the review step and of the match overview:
 * match, time, sign-ups and Discord, each a short line.
 */
export function flowReviewRows(
    values: FlowValues,
    context: FlowSummaryContext,
    schedule: FlowSchedule | null = flowSchedule(values, context.timezone)
): Array<{ step: Exclude<NewMatchStep, "review">; text: string }> {
    const { t } = context
    const { isMatch, ownCode, opponentCode, extraCode } = flowFacts(
        values,
        context
    )
    const teamsText = isMatch
        ? opponentCode
            ? [ownCode, opponentCode, extraCode].filter(Boolean).join(" vs ")
            : t.review.noOpponent
        : null
    return [
        {
            step: "match",
            text: [
                teamsText,
                isMatch ? mapText(values, context) : null,
                context.templateName
                    ? fill(t.review.template, { name: context.templateName })
                    : null,
            ]
                .filter(Boolean)
                .join(" · "),
        },
        {
            step: "time",
            text: schedule
                ? [
                      formatAt(
                          isMatch ? schedule.gameStart : schedule.meetingStart,
                          context
                      ),
                      isMatch
                          ? fill(t.review.reviewMeeting, {
                                time: formatTimeOnly(
                                    schedule.meetingStart,
                                    context
                                ),
                            })
                          : null,
                      fill(t.review.reviewSignupsUntil, {
                          date: formatAt(schedule.registrationEnd, context),
                      }),
                      values.repeatWeekly && isMatch ? t.review.repeats : null,
                  ]
                      .filter(Boolean)
                      .join(" · ")
                : t.review.missing,
        },
        {
            step: "signups",
            text: isMatch
                ? [statusesText(values, t), groupsText(values, context)]
                      .filter(Boolean)
                      .join(" · ")
                : t.signups.trainingNote,
        },
        {
            step: "discord",
            text: [
                values.announcementChannelId
                    ? channelText(context, values.announcementChannelId)
                    : t.discord.defaultChannel,
                pingText(values, t),
                [
                    isMatch && values.createForumChannel
                        ? t.review.forum
                        : null,
                    values.createSquadVoiceChannels ? t.review.voice : null,
                ]
                    .filter(Boolean)
                    .join(` ${t.review.and} `),
            ]
                .filter(Boolean)
                .join(" · "),
        },
    ]
}

/**
 * The announcement as the bot will post it with these values. `signups`
 * carries the counts of a published match; a new one shows zero.
 */
export function flowPreviewModel(
    values: FlowValues,
    context: FlowSummaryContext & {
        botLanguage: string
        clanRoleId?: string
        messageStyle?: MessageStyle
        signups?: NewMatchPreviewModel["signups"]
    },
    schedule: FlowSchedule | null = flowSchedule(values, context.timezone)
): NewMatchPreviewModel {
    const { t } = context
    const { isMatch, ownCode, opponentCode, extraCode, name, map } = flowFacts(
        values,
        context
    )
    const category = context.categories.find(
        (entry) => entry.id === values.matchType
    )
    const limitOf = (groupId: string) =>
        values.signupGroupLimits.find((limit) => limit.groupId === groupId)?.max
    // The bot lists the stored team assignments by slot; without any it shows
    // the clan's own side.
    // The event belongs to this clan even while its catalogue link is absent
    // or still loading. Do not let that transient dashboard state erase the
    // home team from the Discord preview.
    const teams = [
        ...(isMatch ? [{ code: ownCode, side: values.ownSide }] : []),
        ...(opponentCode
            ? [{ code: opponentCode, side: values.opponentSide }]
            : []),
        ...(extraCode ? [{ code: extraCode, side: values.extraSide }] : []),
    ]
    const game = values.gameId ?? "hell_let_loose"
    return {
        kind: values.kind,
        generatedImage:
            isMatch && schedule
                ? buildMatchImage({
                      event: {
                          name,
                          gameId: game,
                          map: values.mapId || undefined,
                          cap: values.cap || undefined,
                          matchType: values.matchType || undefined,
                          meetingStart: schedule.meetingStart,
                          gameStart: schedule.gameStart,
                          matchTeams: [
                              ...(context.ownTeam
                                  ? [
                                        {
                                            teamId: "own",
                                            slot: "a" as const,
                                            side: values.ownSide,
                                            snapshot: {
                                                name: context.ownTeam.name,
                                                shortCode:
                                                    context.ownTeam.shortCode,
                                                logoUrl:
                                                    context.ownTeam.logoUrl ??
                                                    null,
                                            },
                                        },
                                    ]
                                  : []),
                              ...(values.opponent
                                  ? [
                                        {
                                            teamId: values.opponent.teamId,
                                            slot: "b" as const,
                                            side: values.opponentSide,
                                            snapshot: values.opponent,
                                        },
                                    ]
                                  : []),
                              ...(values.extraTeam
                                  ? [
                                        {
                                            teamId: values.extraTeam.teamId,
                                            slot: "c" as const,
                                            side: values.extraSide,
                                            snapshot: values.extraTeam,
                                        },
                                    ]
                                  : []),
                          ],
                      },
                      clan: {
                          name: context.clanName,
                          avatar: context.clanAvatar,
                      },
                      ownTeam: context.ownTeam,
                      categories: context.categories,
                      language: resolveClanLanguage(context.botLanguage),
                      timeZone: context.timezone,
                  })
                : null,
        language: context.botLanguage,
        timeZone: context.timezone,
        title: name,
        categoryLabel: category?.label ?? null,
        teams,
        map: map ? { name: map.name, time: values.timeOfDay || null } : null,
        // The bot's own map picture (board L1-15), when Logi has one.
        mapImageUrl: values.mapId
            ? (panelMapDefinition(game, panelMapKey(game, values.mapId))
                  ?.builtIn ?? null)
            : null,
        cap: values.cap || null,
        server: isMatch ? null : values.server || null,
        meetingStart: schedule?.meetingStart ?? null,
        gameStart: schedule?.gameStart ?? null,
        gameEnd: schedule?.gameEnd ?? null,
        registrationEnd: schedule?.registrationEnd ?? null,
        signupRestriction: values.requiredRoleIds.length
            ? values.requiredRoleIds
                  .map((id) => `@${context.roleName(id) ?? id}`)
                  .join(", ")
            : null,
        attendeeRole: "@Event attendees",
        groups: gameGroups(context.groups, values.gameId)
            .filter((group) => values.signupGroupIds.includes(group.id))
            .map((group) => ({ name: group.name, max: limitOf(group.id) })),
        mentions:
            values.pingMode === "clan"
                ? [
                      (context.clanRoleId
                          ? context.roleName(context.clanRoleId)
                          : null) ?? t.discord.pingClan,
                  ]
                : values.pingMode === "roles"
                  ? values.pingRoleIds.map((id) => context.roleName(id) ?? id)
                  : [],
        forum: isMatch && values.createForumChannel,
        categoryColor: category?.color,
        messageStyle: context.messageStyle,
        description: values.description?.trim() || null,
        notes: values.notes?.trim() || null,
        thumbnailUrl: values.thumbnailUrl || null,
        imageUrl: values.imageUrl || null,
        signups: context.signups,
    }
}

export type FlowChangeKey =
    | "name"
    | "category"
    | "teams"
    | "map"
    | "cap"
    | "start"
    | "meeting"
    | "registrationEnd"
    | "announcement"
    | "end"
    | "repeat"
    | "statuses"
    | "groups"
    | "general"
    | "signupReminder"
    | "attendanceReminders"
    | "squadPreset"
    | "requiredRoles"
    | "rewardRoles"
    | "ping"
    | "forum"
    | "topicPreset"
    | "voice"
    | "meetingChannel"
    | "participantRoles"
    | "server"
    | "password"
    | "description"
    | "notes"
    | "thumbnail"
    | "image"
    | "stratmaps"

export type FlowChange = {
    key: FlowChangeKey
    step: NewMatchStep
    label: string
    before: string
    after: string
}

function excerpt(text: string | undefined, empty: string) {
    const value = text?.replace(/\s+/g, " ").trim()
    if (!value) return empty
    return value.length > 48 ? `${value.slice(0, 47)}…` : value
}

/**
 * What the review shows for each field, as text. Long texts are shortened
 * and the server password is never written out.
 */
export function describeFlowValues(
    values: FlowValues,
    context: FlowSummaryContext
): Record<FlowChangeKey, string> {
    const { t } = context
    const c = t.edit.values
    const { isMatch, ownCode, opponentCode, extraCode, name } = flowFacts(
        values,
        context
    )
    const schedule = flowSchedule(values, context.timezone)
    const at = (iso: string | undefined) =>
        iso ? formatAt(iso, context) : c.none
    const names = (
        ids: readonly string[],
        lookup: (id: string) => string | null
    ) => (ids.length ? ids.map((id) => lookup(id) ?? id).join(", ") : c.none)
    const onOff = (value: boolean) => (value ? c.on : c.off)
    const side = (value: string | null) => sideLabel(t, value) ?? c.noSide
    const reminders = effectiveReminderHours(values.attendanceReminderHours)
    return {
        name,
        category:
            context.categories.find((entry) => entry.id === values.matchType)
                ?.label ?? t.match.noCategory,
        teams: isMatch
            ? [
                  `${ownCode} (${side(values.ownSide)})`,
                  opponentCode
                      ? `${opponentCode} (${side(values.opponentSide)})`
                      : t.review.noOpponent,
                  extraCode ? `${extraCode} (${side(values.extraSide)})` : null,
              ]
                  .filter(Boolean)
                  .join(" vs ")
            : c.none,
        map: (isMatch ? mapText(values, context) : null) ?? c.none,
        cap: values.cap || c.none,
        start: at(isMatch ? schedule?.gameStart : schedule?.meetingStart),
        meeting: at(schedule?.meetingStart),
        registrationEnd: at(schedule?.registrationEnd),
        announcement: schedule?.registrationStart
            ? at(schedule.registrationStart)
            : t.time.onPublish,
        end: at(schedule?.gameEnd),
        repeat: onOff(isMatch && values.repeatWeekly),
        statuses: isMatch ? statusesText(values, t) : c.none,
        groups: (isMatch ? groupsText(values, context) : "") || c.none,
        general: onOff(isMatch && values.useGeneralSignup),
        signupReminder: (() => {
            const audience = reminderAudience(values.signupReminderStatuses)
            return audience === "off"
                ? t.signups.reminderOff
                : fill(t.signups.reminderOn, {
                      audience: t.signups.audience[audience],
                  })
        })(),
        attendanceReminders: reminders.length
            ? reminders
                  .map((hours) => fill(t.signups.attendanceHour, { hours }))
                  .join(", ")
            : c.none,
        squadPreset:
            context.squadPresets.find(
                (preset) => preset.id === values.squadPresetId
            )?.name ?? t.signups.squadPresetNone,
        requiredRoles: names(values.requiredRoleIds, context.roleName),
        rewardRoles: names(values.rewardRoleIds, context.roleName),
        ping:
            values.pingMode === "roles"
                ? `${pingText(values, t)}: ${names(values.pingRoleIds, context.roleName)}`
                : pingText(values, t),
        forum: onOff(isMatch && values.createForumChannel),
        topicPreset:
            context.topicPresets.find(
                (preset) => preset.id === values.topicPresetId
            )?.name ?? t.discord.topicPresetNone,
        voice: values.createSquadVoiceChannels
            ? values.squadVoiceCategoryId
                ? `${c.on} · ${channelText(context, values.squadVoiceCategoryId)}`
                : c.on
            : c.off,
        meetingChannel: values.meetingChannelId
            ? channelText(context, values.meetingChannelId)
            : t.discord.meetingChannelDefault,
        participantRoles: onOff(values.createParticipantRoles ?? true),
        server: values.server || c.none,
        password: values.serverPassword ? c.passwordSet : c.none,
        description: excerpt(values.description, c.none),
        notes: excerpt(values.notes, c.none),
        thumbnail: values.thumbnailUrl ? c.imageSet : c.none,
        image: values.imageUrl ? c.imageSet : c.none,
        stratmaps: names(
            values.stratmapIds,
            (id) =>
                context.stratmaps.find((stratmap) => stratmap.id === id)
                    ?.title ?? null
        ),
    }
}

const CHANGE_STEPS: Record<FlowChangeKey, NewMatchStep> = {
    name: "match",
    category: "match",
    teams: "match",
    map: "match",
    cap: "match",
    description: "match",
    notes: "match",
    thumbnail: "match",
    image: "match",
    stratmaps: "match",
    start: "time",
    meeting: "time",
    registrationEnd: "time",
    announcement: "time",
    end: "time",
    repeat: "time",
    statuses: "signups",
    groups: "signups",
    general: "signups",
    signupReminder: "signups",
    attendanceReminders: "signups",
    squadPreset: "signups",
    requiredRoles: "signups",
    rewardRoles: "signups",
    ping: "discord",
    forum: "discord",
    topicPreset: "discord",
    voice: "discord",
    meetingChannel: "discord",
    participantRoles: "discord",
    server: "discord",
    password: "discord",
}

/**
 * The "What changes" list of the review step: every field whose text
 * differs between the stored values and the edited ones, in the order of
 * the steps. A changed password reads "new password", never its value.
 */
export function flowChanges(
    initial: FlowValues,
    values: FlowValues,
    context: FlowSummaryContext
): FlowChange[] {
    const before = describeFlowValues(initial, context)
    const after = describeFlowValues(values, context)
    const labels = context.t.edit.fields
    return (Object.keys(CHANGE_STEPS) as FlowChangeKey[])
        .filter((key) =>
            key === "password"
                ? initial.serverPassword !== values.serverPassword
                : key === "description"
                  ? (initial.description ?? "") !== (values.description ?? "")
                  : key === "notes"
                    ? (initial.notes ?? "") !== (values.notes ?? "")
                    : key === "thumbnail"
                      ? (initial.thumbnailUrl ?? "") !==
                        (values.thumbnailUrl ?? "")
                      : key === "image"
                        ? (initial.imageUrl ?? "") !== (values.imageUrl ?? "")
                        : before[key] !== after[key]
        )
        .map((key) => ({
            key,
            step: CHANGE_STEPS[key],
            label: labels[key],
            before: before[key],
            after:
                key === "password" && values.serverPassword
                    ? context.t.edit.values.passwordNew
                    : before[key] !== after[key]
                      ? after[key]
                      : key === "thumbnail" || key === "image"
                        ? context.t.edit.values.imageNew
                        : context.t.edit.values.textEdited,
        }))
}
