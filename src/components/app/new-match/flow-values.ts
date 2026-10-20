import {
    getHllModeOptions,
    getHllTimeOptions,
    inferHllSelection,
    inferHllBaseMapId,
    resolveHllPresetCode,
} from "@/lib/hll-map-presets"
import {
    templatesFor,
    type MatchTemplate,
    type TemplateReminderStatus,
    type TemplateSignupStatus,
} from "@/domain/events/match-templates"
import {
    matchTeamSides,
    sortAssignments,
    type MatchTeamInput,
} from "@/domain/teams/match-teams"
import {
    fromDateTimeLocalInTimeZone,
    toDateTimeLocalInTimeZone,
} from "@/lib/timezone-datetime"
import { ATTENDANCE_REMINDER_OFFSETS } from "@/domain/events/scheduled-job-policy"
import { splitLocalDateTime } from "@/domain/events/new-match-flow"
import type { TacticalPlan } from "@/domain/events/tactical-plan"
import { matchTeamGame } from "@/lib/teams/match-team-selection"
import type { EventRecord, Group } from "@/types/domain"
import type { GameId } from "@/domain/games/game"

const HOUR_MS = 60 * 60 * 1000
const MINUTE_MS = 60 * 1000

export const FLOW_SIGNUP_STATUSES: TemplateSignupStatus[] = [
    "member",
    "recruit",
    "reserve_member",
    "mercenary",
]

export type FlowOpponent = {
    teamId: string
    name: string
    shortCode: string | null
    logoUrl: string | null
}

/**
 * Everything the new-match flow (design D2) edits. Offsets are hours or
 * minutes before the start; an announcement offset of null means "on
 * publishing". In edit mode the values start from the stored event.
 */
export type FlowValues = {
    kind: "match" | "training"
    gameId: GameId
    templateId: string | null
    opponent: FlowOpponent | null
    ownSide: string | null
    opponentSide: string | null
    /** A third team of a Wardogs match (slot c). */
    extraTeam: FlowOpponent | null
    extraSide: string | null
    mapId: string
    /** Explicit TBD also clears an imported map the local catalogue cannot identify. */
    mapCleared?: boolean
    timeOfDay: string
    tacticalPlan?: TacticalPlan | null
    /** Game mode of the map preset ("warfare", "offensive", ...). */
    mapMode: string
    cap: string
    /** WoW:F replaces tactical map/capture-point choices with these fields. */
    activity: string
    activityTarget: string
    name: string
    nameTouched: boolean
    date: string
    time: string
    announcementHours: number | null
    registrationHours: number
    meetingMinutes: number
    durationMinutes: number
    repeatWeekly: boolean
    allowedSignupStatuses: TemplateSignupStatus[]
    allowNonMembersSignup: boolean
    signupGroupIds: string[]
    signupGroupLimits: Array<{ groupId: string; max: number }>
    useGeneralSignup: boolean
    signupReminderStatuses: TemplateReminderStatus[]
    announcementChannelId: string
    eventInfoChannelId: string
    pingMode: "none" | "clan" | "roles"
    pingRoleIds: string[]
    createForumChannel: boolean
    createSquadVoiceChannels: boolean
    server: string
    serverPassword: string
    matchType?: string
    topicPresetId?: string
    attendanceReminderHours?: number[]
    createParticipantRoles?: boolean
    squadPresetId?: string
    description?: string
    notes?: string
    thumbnailUrl?: string
    imageUrl?: string
    meetingChannelId?: string
    squadVoiceCategoryId?: string
    requiredRoleIds: string[]
    rewardRoleIds: string[]
    stratmapIds: string[]
}

export type ChannelDefaults = Partial<
    Record<
        GameId,
        { announcementChannelId?: string; eventInfoChannelId?: string }
    >
>

/** The schedule the flow writes: ISO instants, no registration start when announced on publishing. */
export type FlowSchedule = {
    registrationStart?: string
    registrationEnd: string
    meetingStart: string
    gameStart: string
    gameEnd: string
}

export function gameGroups(groups: readonly Group[], gameId: GameId) {
    return groups
        .filter((group) => (group.gameId ?? "hell_let_loose") === gameId)
        .sort((left, right) => left.order - right.order)
}

/** Whole minutes; a stored offset that is not a whole hour stays exact. */
function minutes(hours: number) {
    return Math.round(hours * 60)
}

/**
 * The timeline from the local start and the offsets: the start is the game
 * start of a match and the meeting of a training. Null without a valid start.
 */
export function flowSchedule(
    values: Pick<
        FlowValues,
        | "kind"
        | "date"
        | "time"
        | "announcementHours"
        | "registrationHours"
        | "meetingMinutes"
        | "durationMinutes"
    >,
    timezone: string
): FlowSchedule | null {
    if (!values.date || !values.time) return null
    const start = Date.parse(
        fromDateTimeLocalInTimeZone(`${values.date}T${values.time}`, timezone)
    )
    if (!Number.isFinite(start)) return null
    const isMatch = values.kind === "match"
    const meeting = isMatch ? start - values.meetingMinutes * MINUTE_MS : start
    const gameStart = isMatch ? start : meeting
    const iso = (value: number) => new Date(value).toISOString()
    return {
        registrationStart:
            values.announcementHours === null
                ? undefined
                : iso(
                      gameStart - minutes(values.announcementHours) * MINUTE_MS
                  ),
        registrationEnd: iso(
            meeting - minutes(values.registrationHours) * MINUTE_MS
        ),
        meetingStart: iso(meeting),
        gameStart: iso(gameStart),
        gameEnd: iso(gameStart + values.durationMinutes * MINUTE_MS),
    }
}

/** A tomorrow evening start in the clan's zone for a fresh match. */
export function defaultStart(timezone: string, now: Date) {
    const tomorrow = new Date(now.getTime() + 24 * HOUR_MS)
    const { date } = splitLocalDateTime(
        toDateTimeLocalInTimeZone(tomorrow.toISOString(), timezone)
    )
    return { date, time: "20:00" }
}

export function applyTemplateValues(
    values: FlowValues,
    template: MatchTemplate,
    groups: readonly Group[],
    channelDefaults: ChannelDefaults
): FlowValues {
    const offered = gameGroups(groups, values.gameId).map((group) => group.id)
    const isMatch = template.kind === "match"
    return {
        ...values,
        kind: template.kind,
        templateId: template.id,
        announcementHours: template.announcementHoursBeforeStart ?? null,
        registrationHours: template.registrationHoursBeforeMeeting,
        meetingMinutes: isMatch ? template.meetingMinutesBeforeStart : 0,
        durationMinutes: template.durationMinutes,
        allowedSignupStatuses: template.allowedSignupStatuses,
        allowNonMembersSignup: false,
        signupGroupIds: isMatch
            ? (template.signupGroupIds ?? offered).filter((id) =>
                  offered.includes(id)
              )
            : [],
        signupGroupLimits: template.signupGroupLimits ?? [],
        useGeneralSignup: template.useGeneralSignup,
        signupReminderStatuses: template.signupReminderStatuses,
        pingMode: template.pingMode,
        pingRoleIds: template.pingRoleIds,
        createForumChannel: isMatch && template.createForumChannel,
        createSquadVoiceChannels: template.createSquadVoiceChannels,
        matchType: template.categoryId ?? values.matchType,
        topicPresetId: template.topicPresetId,
        attendanceReminderHours: template.attendanceReminderHours,
        createParticipantRoles: template.createParticipantRoles,
        squadPresetId: template.squadPresetId,
        eventInfoChannelId: isMatch
            ? values.eventInfoChannelId ||
              channelDefaults[values.gameId]?.eventInfoChannelId ||
              ""
            : "",
        // Trainings have no opponent or map.
        ...(isMatch
            ? {}
            : {
                  opponent: null,
                  opponentSide: null,
                  extraTeam: null,
                  extraSide: null,
                  mapId: "",
                  timeOfDay: "",
                  tacticalPlan: null,
                  mapMode: "",
                  cap: "",
                  activity: "",
                  activityTarget: "",
              }),
    }
}

/** The values of a fresh flow: the first template of the kind and game, else defaults. */
export function newFlowValues(input: {
    kind: "match" | "training"
    gameId: GameId
    timezone: string
    groups: readonly Group[]
    templates: readonly MatchTemplate[]
    channelDefaults: ChannelDefaults
    now: Date
}): FlowValues {
    const { kind, gameId, channelDefaults } = input
    const base: FlowValues = {
        kind,
        gameId,
        templateId: null,
        opponent: null,
        ownSide: null,
        opponentSide: null,
        extraTeam: null,
        extraSide: null,
        mapId: "",
        timeOfDay: "",
        mapMode: "",
        cap: "",
        activity: "",
        activityTarget: "",
        name: "",
        nameTouched: false,
        ...defaultStart(input.timezone, input.now),
        announcementHours: null,
        registrationHours: 24,
        meetingMinutes: kind === "match" ? 30 : 0,
        durationMinutes: 90,
        repeatWeekly: false,
        allowedSignupStatuses: [],
        allowNonMembersSignup: false,
        signupGroupIds: gameGroups(input.groups, gameId).map(
            (group) => group.id
        ),
        signupGroupLimits: [],
        useGeneralSignup: false,
        signupReminderStatuses: ["member"],
        announcementChannelId:
            channelDefaults[gameId]?.announcementChannelId ?? "",
        eventInfoChannelId:
            kind === "match"
                ? (channelDefaults[gameId]?.eventInfoChannelId ?? "")
                : "",
        pingMode: "clan",
        pingRoleIds: [],
        createForumChannel: kind === "match",
        createSquadVoiceChannels: false,
        server: "",
        serverPassword: "",
        requiredRoleIds: [],
        rewardRoleIds: [],
        stratmapIds: [],
    }
    const template = templatesFor(input.templates, kind, gameId)[0]
    return template
        ? applyTemplateValues(base, template, input.groups, channelDefaults)
        : base
}

/** A stored side as the flow's select knows it ("allies" reads as "Allies"). */
function knownSide(side: string | null | undefined, sides: readonly string[]) {
    const trimmed = side?.trim()
    if (!trimmed) return null
    return (
        sides.find((entry) => entry.toLowerCase() === trimmed.toLowerCase()) ??
        trimmed
    )
}

function hoursBetween(later: number, earlier: number) {
    // Exact to the minute, so an untouched offset reproduces the stored time.
    return Math.max(0, Math.round((later - earlier) / MINUTE_MS)) / 60
}

/**
 * The flow's values for a stored event: a draft to resume or a published
 * event to edit. Offsets are read back exactly, the map preset (with its
 * mode) is recognised from the stored code, the opponent is team slot b and
 * a legacy event without teams keeps its side. Unknown values (a map code
 * Logi does not know, a free-text middle point) are kept by the caller.
 */
export function flowValuesFromEvent(
    event: EventRecord,
    timezone: string
): FlowValues {
    const gameId = event.gameId ?? "hell_let_loose"
    const isMatch = event.kind !== "training"
    const start = isMatch ? event.gameStart : event.meetingStart
    const { date, time } = splitLocalDateTime(
        toDateTimeLocalInTimeZone(start, timezone)
    )
    const startMs = Date.parse(start)
    const meeting = Date.parse(event.meetingStart)
    const teamGame = matchTeamGame(gameId)
    const sides = teamGame ? matchTeamSides(teamGame) : ["Allies", "Axis"]
    const opponent = event.matchTeams?.find((team) => team.slot === "b")
    const own = event.matchTeams?.find((team) => team.slot === "a")
    const extra = event.matchTeams?.find((team) => team.slot === "c")
    const selection = isMatch ? inferHllSelection(event.map, gameId) : null
    const gameEnd = Date.parse(event.gameEnd)
    const duration = Math.round((gameEnd - startMs) / MINUTE_MS)
    return {
        kind: event.kind,
        gameId,
        templateId: null,
        opponent: opponent
            ? {
                  teamId: opponent.teamId,
                  name: opponent.snapshot.name,
                  shortCode: opponent.snapshot.shortCode,
                  logoUrl: opponent.snapshot.logoUrl,
              }
            : null,
        ownSide: knownSide(own ? own.side : event.side, sides),
        opponentSide: knownSide(opponent?.side, sides),
        extraTeam: extra
            ? {
                  teamId: extra.teamId,
                  name: extra.snapshot.name,
                  shortCode: extra.snapshot.shortCode,
                  logoUrl: extra.snapshot.logoUrl,
              }
            : null,
        extraSide: knownSide(extra?.side, sides),
        mapId:
            selection?.mapId ??
            (isMatch ? inferHllBaseMapId(event.map, gameId) : null) ??
            "",
        timeOfDay: event.timeOfDay ?? selection?.time ?? "",
        tacticalPlan: event.tacticalPlan ?? null,
        mapMode: selection?.mode ?? "",
        cap: isMatch ? (event.cap ?? "") : "",
        activity:
            usesActivitySelection(gameId) && isMatch ? (event.cap ?? "") : "",
        activityTarget:
            usesActivitySelection(gameId) && isMatch ? (event.map ?? "") : "",
        name: event.name,
        nameTouched: Boolean(event.name),
        date,
        time,
        announcementHours: event.registrationStart
            ? hoursBetween(startMs, Date.parse(event.registrationStart))
            : null,
        registrationHours: hoursBetween(
            meeting,
            Date.parse(event.registrationEnd)
        ),
        meetingMinutes: isMatch
            ? Math.max(
                  0,
                  Math.round(
                      (Date.parse(event.gameStart) - meeting) / MINUTE_MS
                  )
              )
            : 0,
        durationMinutes:
            Number.isFinite(duration) && duration > 0
                ? duration
                : event.durationMinutes || 90,
        repeatWeekly:
            !event.recurrenceSeriesId &&
            event.recurrence?.frequency === "weekly",
        allowedSignupStatuses: event.allowedSignupStatuses ?? [],
        allowNonMembersSignup: event.allowNonMembersSignup ?? false,
        signupGroupIds: event.signupGroupIds ?? [],
        signupGroupLimits: event.signupGroupLimits ?? [],
        useGeneralSignup: event.useGeneralSignup ?? false,
        signupReminderStatuses: event.signupReminderStatuses ?? ["member"],
        announcementChannelId: event.announcementChannelId ?? "",
        eventInfoChannelId: event.eventInfoChannelId ?? "",
        pingMode: event.pingMode ?? (event.pingClan ? "clan" : "none"),
        pingRoleIds: event.pingRoleIds ?? [],
        createForumChannel: event.createForumChannel,
        createSquadVoiceChannels: event.createSquadVoiceChannels ?? false,
        server: event.server ?? "",
        serverPassword: event.serverPassword ?? "",
        matchType: event.matchType,
        topicPresetId: event.topicPresetId,
        attendanceReminderHours: event.attendanceReminderHours,
        createParticipantRoles: event.createParticipantRoles,
        squadPresetId: event.squadPresetId,
        description: event.description,
        notes: event.notes,
        thumbnailUrl: event.thumbnailUrl,
        imageUrl: event.imageUrl,
        meetingChannelId: event.meetingChannelId,
        squadVoiceCategoryId: event.squadVoiceCategoryId,
        requiredRoleIds: event.requiredRoleIds ?? [],
        rewardRoleIds: event.rewardRoleIds ?? [],
        stratmapIds: event.stratmapIds ?? [],
    }
}

/** The map preset code: the chosen mode when the map has it, else warfare, else the first. */
export function flowMapCode(
    values: Pick<
        FlowValues,
        "gameId" | "mapId" | "timeOfDay" | "mapMode" | "ownSide"
    >
) {
    if (!values.mapId) return ""
    if (values.gameId === "wardogs") return values.mapId
    if (!values.timeOfDay) return values.mapId
    const modes = getHllModeOptions(
        values.mapId,
        values.timeOfDay,
        values.gameId
    )
    const mode =
        modes.find((option) => option.value === values.mapMode)?.value ??
        modes.find((option) => option.value === "warfare")?.value ??
        modes[0]?.value
    return mode
        ? (resolveHllPresetCode({
              mapId: values.mapId,
              time: values.timeOfDay,
              mode,
              side: values.ownSide,
              gameId: values.gameId,
          }) ?? values.mapId)
        : values.mapId
}

/** The default time of day when a map is picked: day, else the first. */
export function defaultTimeOfDay(mapId: string, gameId: GameId) {
    if (gameId === "wardogs") return ""
    const options = getHllTimeOptions(mapId, gameId)
    return (
        options.find((option) => option.value === "day")?.value ??
        options[0]?.value ??
        ""
    )
}

/**
 * The team selection the flow writes: your team in slot a with its side, the
 * opponent in slot b and a third Wardogs team in slot c. A stored team of
 * slot a that is not the linked team is kept. Undefined for a training or a
 * game without the team catalogue.
 */
export function flowMatchTeams(
    values: Pick<
        FlowValues,
        | "kind"
        | "gameId"
        | "ownSide"
        | "opponent"
        | "opponentSide"
        | "extraTeam"
        | "extraSide"
    >,
    input: {
        ownTeamId: string | null
        stored?: EventRecord["matchTeams"]
    }
): MatchTeamInput[] | undefined {
    if (values.kind !== "match" || !matchTeamGame(values.gameId))
        return undefined
    const storedOwn = input.stored?.find((team) => team.slot === "a")
    const ownTeamId = storedOwn?.teamId ?? input.ownTeamId
    const teams: MatchTeamInput[] = []
    if (ownTeamId)
        teams.push({ teamId: ownTeamId, slot: "a", side: values.ownSide })
    if (values.opponent)
        teams.push({
            teamId: values.opponent.teamId,
            slot: "b",
            side: values.opponentSide,
        })
    if (values.extraTeam && values.gameId === "wardogs")
        teams.push({
            teamId: values.extraTeam.teamId,
            slot: "c",
            side: values.extraSide,
        })
    return sortAssignments(teams)
}

/** The local weekday (0 = Sunday) of a `YYYY-MM-DD` date. */
export function weekdayOf(date: string) {
    return new Date(`${date}T00:00:00Z`).getUTCDay()
}

type PayloadContext = {
    timezone: string
    name: string
    ownTeamId: string | null
}

/** Games without map support use the generic activity/target event fields. */
export function usesActivitySelection(gameId: GameId) {
    return !["hell_let_loose", "hell_let_loose_vietnam", "wardogs"].includes(
        gameId
    )
}

/** The event body of a draft or a new match (`/event-drafts`). */
export function flowEventPayload(values: FlowValues, context: PayloadContext) {
    const isMatch = values.kind === "match"
    const schedule = flowSchedule(values, context.timezone)
    const mapCode = flowMapCode(values)
    const isActivityGame = usesActivitySelection(values.gameId)
    return {
        gameId: values.gameId,
        kind: values.kind,
        matchType: values.matchType || undefined,
        name: context.name.trim(),
        description: values.description || undefined,
        notes: values.notes || undefined,
        thumbnailUrl: values.thumbnailUrl || undefined,
        imageUrl: isMatch ? values.imageUrl || undefined : undefined,
        registrationStart: schedule?.registrationStart ?? "",
        registrationEnd: schedule?.registrationEnd ?? "",
        meetingStart: schedule?.meetingStart ?? "",
        gameStart: schedule?.gameStart ?? "",
        gameEnd: schedule?.gameEnd ?? "",
        durationMinutes: values.durationMinutes,
        pingClan: values.pingMode === "clan",
        pingMode: values.pingMode,
        pingRoleIds: values.pingMode === "roles" ? values.pingRoleIds : [],
        createForumChannel: isMatch && values.createForumChannel,
        createSquadVoiceChannels: values.createSquadVoiceChannels,
        squadVoiceCategoryId: values.createSquadVoiceChannels
            ? values.squadVoiceCategoryId || undefined
            : undefined,
        meetingChannelId: isMatch
            ? values.meetingChannelId || undefined
            : undefined,
        announcementChannelId: values.announcementChannelId || undefined,
        eventInfoChannelId: isMatch
            ? values.eventInfoChannelId || undefined
            : undefined,
        server: values.server || undefined,
        serverPassword: values.serverPassword || undefined,
        side: isMatch ? (values.ownSide ?? undefined) : undefined,
        timeOfDay: isMatch ? values.timeOfDay : "",
        tacticalPlan:
            isMatch && values.gameId === "wardogs"
                ? (values.tacticalPlan ?? null)
                : null,
        map: isMatch
            ? isActivityGame
                ? values.activityTarget || undefined
                : mapCode || undefined
            : undefined,
        cap: isMatch
            ? isActivityGame
                ? values.activity || undefined
                : values.cap || undefined
            : undefined,
        topicPresetId: isMatch ? values.topicPresetId || undefined : undefined,
        stratmapIds: isMatch ? values.stratmapIds : [],
        requiredRoleIds: values.requiredRoleIds,
        rewardRoleIds: values.rewardRoleIds,
        signupGroupIds: isMatch ? values.signupGroupIds : [],
        allowedSignupStatuses: isMatch ? values.allowedSignupStatuses : [],
        allowNonMembersSignup: isMatch && values.allowNonMembersSignup,
        useGeneralSignup: isMatch && values.useGeneralSignup,
        signupReminderStatuses: isMatch ? values.signupReminderStatuses : [],
        signupGroupLimits: isMatch
            ? values.signupGroupLimits.filter((limit) =>
                  values.signupGroupIds.includes(limit.groupId)
              )
            : undefined,
        attendanceReminderHours: values.attendanceReminderHours,
        createParticipantRoles: values.createParticipantRoles,
        squadPresetId: isMatch ? values.squadPresetId || undefined : undefined,
        recurrence:
            isMatch && values.repeatWeekly && schedule
                ? {
                      frequency: "weekly" as const,
                      interval: 1,
                      weekdays: [weekdayOf(values.date)],
                  }
                : undefined,
        matchTeams: flowMatchTeams(values, { ownTeamId: context.ownTeamId }),
    }
}

const TIME_FIELDS = [
    "date",
    "time",
    "announcementHours",
    "registrationHours",
    "meetingMinutes",
    "durationMinutes",
] as const satisfies ReadonlyArray<keyof FlowValues>

const MAP_FIELDS = [
    "mapId",
    "timeOfDay",
    "mapMode",
] as const satisfies ReadonlyArray<keyof FlowValues>

function same(left: unknown, right: unknown) {
    return JSON.stringify(left) === JSON.stringify(right)
}

function changed<K extends keyof FlowValues>(
    keys: readonly K[],
    initial: FlowValues,
    values: FlowValues
) {
    return keys.some((key) => !same(initial[key], values[key]))
}

function sortedLimits(limits: FlowValues["signupGroupLimits"]) {
    return [...limits].sort((left, right) =>
        left.groupId.localeCompare(right.groupId)
    )
}

/** Attendance reminder offsets as stored: missing means every offset. */
export function effectiveReminderHours(hours: number[] | undefined): number[] {
    return hours === undefined
        ? [...ATTENDANCE_REMINDER_OFFSETS]
        : ATTENDANCE_REMINDER_OFFSETS.filter((offset) => hours.includes(offset))
}

/**
 * The PATCH body that saves an edited event: every field of the event (the
 * route replaces the editable fields, so nothing the flow does not show may
 * be lost), with the flow's changes applied. Untouched times, map, middle
 * point and teams are sent exactly as stored; the template settings and the
 * team selection are sent only when they changed, so an edit that leaves
 * them alone keeps them as they are. A weekly occurrence keeps belonging to
 * its series; switching the repeat off on the series match stops the series.
 */
export function flowEditPayload(
    values: FlowValues,
    initial: FlowValues,
    event: EventRecord,
    context: PayloadContext
) {
    const isMatch = event.kind !== "training"
    const timesChanged = changed(TIME_FIELDS, initial, values)
    const schedule = timesChanged
        ? flowSchedule(values, context.timezone)
        : null
    const times = schedule
        ? {
              registrationStart: schedule.registrationStart,
              registrationEnd: schedule.registrationEnd,
              meetingStart: schedule.meetingStart,
              gameStart: schedule.gameStart,
              gameEnd: schedule.gameEnd,
              durationMinutes: values.durationMinutes,
          }
        : {
              registrationStart: event.registrationStart,
              registrationEnd: event.registrationEnd,
              meetingStart: event.meetingStart,
              gameStart: event.gameStart,
              gameEnd: event.gameEnd,
              durationMinutes: event.durationMinutes ?? values.durationMinutes,
          }
    const map = !isMatch
        ? undefined
        : values.mapCleared ||
            changed(MAP_FIELDS, initial, values) ||
            // An offensive preset follows your side.
            (values.mapMode === "offensive" &&
                values.ownSide !== initial.ownSide)
          ? flowMapCode(values) || undefined
          : event.map
    const teamsChanged =
        // Older matches can contain only opponent slots. Saving any edit must
        // repair that incomplete snapshot with the clan's linked slot a.
        (isMatch &&
            Boolean(context.ownTeamId) &&
            !event.matchTeams?.some((team) => team.slot === "a")) ||
        !same(initial.opponent?.teamId, values.opponent?.teamId) ||
        !same(initial.extraTeam?.teamId, values.extraTeam?.teamId) ||
        initial.ownSide !== values.ownSide ||
        initial.opponentSide !== values.opponentSide ||
        initial.extraSide !== values.extraSide
    const matchTeams = teamsChanged
        ? flowMatchTeams(values, {
              ownTeamId: context.ownTeamId,
              stored: event.matchTeams,
          })
        : undefined
    const recurrence = (() => {
        if (!isMatch || event.recurrenceSeriesId) return event.recurrence
        if (values.repeatWeekly === initial.repeatWeekly) {
            const stored = event.recurrence
            const from = weekdayOf(initial.date)
            const to = weekdayOf(values.date)
            // A weekly series on one day follows its match to another day.
            return stored?.frequency === "weekly" &&
                stored.weekdays.length === 1 &&
                stored.weekdays[0] === from &&
                from !== to
                ? { ...stored, weekdays: [to] }
                : stored
        }
        return values.repeatWeekly
            ? {
                  frequency: "weekly" as const,
                  interval: 1,
                  weekdays: [weekdayOf(values.date)],
              }
            : undefined
    })()
    const offered = values.signupGroupIds
    const limits = values.signupGroupLimits.filter((limit) =>
        offered.includes(limit.groupId)
    )
    const settings = {
        ...(!same(
            sortedLimits(limits),
            sortedLimits(
                initial.signupGroupLimits.filter((limit) =>
                    initial.signupGroupIds.includes(limit.groupId)
                )
            )
        )
            ? { signupGroupLimits: limits }
            : {}),
        ...(!same(
            effectiveReminderHours(values.attendanceReminderHours),
            effectiveReminderHours(initial.attendanceReminderHours)
        )
            ? {
                  attendanceReminderHours: effectiveReminderHours(
                      values.attendanceReminderHours
                  ),
              }
            : {}),
        ...((values.createParticipantRoles ?? true) !==
        (initial.createParticipantRoles ?? true)
            ? { createParticipantRoles: values.createParticipantRoles ?? true }
            : {}),
        ...((values.squadPresetId ?? "") !== (initial.squadPresetId ?? "")
            ? { squadPresetId: values.squadPresetId ?? "" }
            : {}),
    }
    return {
        gameId: event.gameId,
        kind: event.kind,
        matchType: values.matchType || undefined,
        name: context.name.trim(),
        description: values.description || undefined,
        notes: values.notes || undefined,
        thumbnailUrl: values.thumbnailUrl || undefined,
        imageUrl: values.imageUrl || undefined,
        ...times,
        pingClan: values.pingMode === "clan",
        pingMode: values.pingMode,
        pingRoleIds: values.pingMode === "roles" ? values.pingRoleIds : [],
        createForumChannel: isMatch && values.createForumChannel,
        createSquadVoiceChannels: values.createSquadVoiceChannels,
        squadVoiceCategoryId: values.squadVoiceCategoryId || undefined,
        meetingChannelId: values.meetingChannelId || undefined,
        // Creation-time choices; the server keeps the stored channels.
        announcementChannelId: event.announcementChannelId,
        eventInfoChannelId: isMatch ? event.eventInfoChannelId : undefined,
        server: values.server || undefined,
        serverPassword: values.serverPassword || undefined,
        side: isMatch ? (values.ownSide ?? undefined) : undefined,
        map,
        timeOfDay: isMatch ? values.timeOfDay : "",
        tacticalPlan:
            isMatch && values.gameId === "wardogs"
                ? (values.tacticalPlan ?? null)
                : null,
        cap: isMatch ? values.cap || undefined : undefined,
        topicPresetId: values.topicPresetId || undefined,
        stratmapIds: values.stratmapIds,
        requiredRoleIds: values.requiredRoleIds,
        rewardRoleIds: values.rewardRoleIds,
        signupGroupIds: isMatch ? values.signupGroupIds : [],
        allowedSignupStatuses: isMatch ? values.allowedSignupStatuses : [],
        allowNonMembersSignup: isMatch && values.allowNonMembersSignup,
        useGeneralSignup: isMatch && values.useGeneralSignup,
        signupReminderStatuses: isMatch ? values.signupReminderStatuses : [],
        ...(recurrence ? { recurrence } : {}),
        ...(matchTeams ? { matchTeams } : {}),
        ...settings,
    }
}

export type FlowEditPayload = ReturnType<typeof flowEditPayload>

/**
 * Whether the timeline the flow would write is coherent: registration start
 * before its end, the end before the meeting, the meeting before the start
 * and the end after it. The same order the event schema enforces.
 */
export function scheduleIsCoherent(schedule: FlowSchedule | null) {
    if (!schedule) return false
    const at = (value: string) => Date.parse(value)
    return (
        (!schedule.registrationStart ||
            at(schedule.registrationStart) <= at(schedule.registrationEnd)) &&
        at(schedule.registrationEnd) <= at(schedule.meetingStart) &&
        at(schedule.meetingStart) <= at(schedule.gameStart) &&
        at(schedule.gameStart) < at(schedule.gameEnd)
    )
}
