import type { GameId } from "@/domain/games/game"

import { normalizeAttendanceReminderHours } from "./scheduled-job-policy"
import { MAX_SIGNUP_GROUP_LIMIT } from "./upsert-policy"
import type { EventKind } from "./types"

export const SIGNUP_STATUSES = [
    "member",
    "recruit",
    "reserve_member",
    "mercenary",
] as const
export type TemplateSignupStatus = (typeof SIGNUP_STATUSES)[number]
export const REMINDER_STATUSES = [
    "member",
    "recruit",
    "reserve_member",
] as const
export type TemplateReminderStatus = (typeof REMINDER_STATUSES)[number]

export const MAX_MATCH_TEMPLATES = 20
const MAX_NAME_LENGTH = 60
const MAX_HOURS = 24 * 30
const MAX_MINUTES = 24 * 60

/**
 * What a new match or training starts with (design D1). A template only fills
 * the create form; saved events keep their own values, so editing a template
 * never changes an existing event.
 */
export type MatchTemplate = {
    id: string
    /** Base or per-game defaults; optional named templates remain available. */
    isDefault?: boolean
    inheritFields?: string[]
    name: string
    kind: EventKind
    /** Missing means every game the clan plays. */
    gameId?: GameId
    /** Event category the new event gets. */
    categoryId?: string
    /** Hours before the start when the announcement is posted; missing posts it at once. */
    announcementHoursBeforeStart?: number
    registrationHoursBeforeMeeting: number
    meetingMinutesBeforeStart: number
    durationMinutes: number
    /** Empty lets every member status sign up. */
    allowedSignupStatuses: TemplateSignupStatus[]
    /** Missing offers every signup group of the event's game. */
    signupGroupIds?: string[]
    useGeneralSignup: boolean
    allowRankedSignup?: boolean
    signupReminderStatuses: TemplateReminderStatus[]
    pingMode: "none" | "clan" | "roles"
    pingRoleIds: string[]
    createForumChannel: boolean
    createSquadVoiceChannels: boolean
    topicPresetId?: string
    /** Caps of offered groups; a full group gives the player a reserve place. */
    signupGroupLimits?: Array<{ groupId: string; max: number }>
    /** Attendance DM offsets in hours before the meeting; missing means all four. */
    attendanceReminderHours?: number[]
    /** Missing means the bot creates attendee and reserve roles. */
    createParticipantRoles?: boolean
    /** The squad preset a match's roster starts from. */
    squadPresetId?: string
}

export type MatchTemplateError =
    | "too_many"
    | "duplicate_id"
    | "missing_name"
    | "invalid_times"
    | "missing_ping_roles"

function wholeNumber(value: number, max: number) {
    return Number.isInteger(value) && value >= 0 && value <= max
}

function unique<T>(values: readonly T[]) {
    return [...new Set(values)]
}

/** Checks and tidies a clan's templates before they are stored. */
export function normalizeMatchTemplates(
    templates: readonly MatchTemplate[]
):
    | { ok: true; templates: MatchTemplate[] }
    | { ok: false; error: MatchTemplateError; index?: number } {
    if (templates.length > MAX_MATCH_TEMPLATES)
        return { ok: false, error: "too_many" }
    const defaults = new Set<string>()
    const ids = new Set<string>()
    const normalized: MatchTemplate[] = []
    for (const [index, template] of templates.entries()) {
        const id = template.id.trim()
        if (!id || ids.has(id))
            return { ok: false, error: "duplicate_id", index }
        ids.add(id)
        if (template.isDefault) {
            const scope = `${template.kind}:${template.gameId ?? "all"}`
            if (defaults.has(scope))
                return { ok: false, error: "duplicate_id", index }
            defaults.add(scope)
        }
        const name = template.name.trim().slice(0, MAX_NAME_LENGTH)
        if (!name) return { ok: false, error: "missing_name", index }
        if (
            !wholeNumber(template.registrationHoursBeforeMeeting, MAX_HOURS) ||
            !wholeNumber(template.meetingMinutesBeforeStart, MAX_MINUTES) ||
            !wholeNumber(template.durationMinutes, MAX_MINUTES) ||
            template.durationMinutes < 1 ||
            (template.announcementHoursBeforeStart !== undefined &&
                !wholeNumber(template.announcementHoursBeforeStart, MAX_HOURS))
        )
            return { ok: false, error: "invalid_times", index }
        const pingRoleIds = unique(
            template.pingRoleIds.map((roleId) => roleId.trim()).filter(Boolean)
        )
        if (template.pingMode === "roles" && !pingRoleIds.length)
            return { ok: false, error: "missing_ping_roles", index }
        const isMatch = template.kind === "match"
        const limits = new Map<string, number>()
        for (const limit of template.signupGroupLimits ?? []) {
            const groupId = limit.groupId.trim()
            if (
                isMatch &&
                groupId &&
                (!template.signupGroupIds ||
                    template.signupGroupIds.includes(groupId)) &&
                Number.isInteger(limit.max) &&
                limit.max >= 1 &&
                limit.max <= MAX_SIGNUP_GROUP_LIMIT
            )
                limits.set(groupId, limit.max)
        }
        normalized.push({
            id,
            isDefault: template.isDefault,
            inheritFields: template.inheritFields,
            name,
            kind: template.kind,
            gameId: template.gameId,
            categoryId: template.categoryId?.trim() || undefined,
            announcementHoursBeforeStart: template.announcementHoursBeforeStart,
            registrationHoursBeforeMeeting:
                template.registrationHoursBeforeMeeting,
            meetingMinutesBeforeStart: template.meetingMinutesBeforeStart,
            durationMinutes: template.durationMinutes,
            allowedSignupStatuses: isMatch
                ? unique(template.allowedSignupStatuses)
                : [],
            // Signup groups belong to one game, so a template for every game offers them all.
            signupGroupIds:
                isMatch && template.gameId && template.signupGroupIds
                    ? unique(template.signupGroupIds)
                    : undefined,
            useGeneralSignup: isMatch && template.useGeneralSignup,
            allowRankedSignup: isMatch && template.allowRankedSignup,
            signupReminderStatuses: isMatch
                ? unique(template.signupReminderStatuses)
                : [],
            pingMode: template.pingMode,
            pingRoleIds: template.pingMode === "roles" ? pingRoleIds : [],
            createForumChannel: isMatch && template.createForumChannel,
            createSquadVoiceChannels: template.createSquadVoiceChannels,
            topicPresetId: isMatch
                ? template.topicPresetId?.trim() || undefined
                : undefined,
            signupGroupLimits: limits.size
                ? [...limits].map(([groupId, max]) => ({ groupId, max }))
                : undefined,
            attendanceReminderHours: normalizeAttendanceReminderHours(
                template.attendanceReminderHours
            ),
            createParticipantRoles: template.createParticipantRoles,
            squadPresetId: isMatch
                ? template.squadPresetId?.trim() || undefined
                : undefined,
        })
    }
    return { ok: true, templates: normalized }
}

/** Templates offered when creating an event of this kind for this game. */
export function templatesFor(
    templates: readonly MatchTemplate[] | undefined,
    kind: EventKind,
    gameId: GameId | undefined
) {
    return (templates ?? []).filter(
        (template) =>
            template.kind === kind &&
            (!template.gameId || !gameId || template.gameId === gameId)
    )
}

export type TemplateSchedule = {
    registrationStart?: string
    registrationEnd: string
    meetingStart: string
    gameStart: string
    gameEnd: string
}

const MINUTE_MS = 60 * 1000

/**
 * The timeline a template gives an event starting at `startIso`: the match
 * start for a match, the meeting for a training.
 */
export function templateSchedule(
    template: Pick<
        MatchTemplate,
        | "kind"
        | "announcementHoursBeforeStart"
        | "registrationHoursBeforeMeeting"
        | "meetingMinutesBeforeStart"
        | "durationMinutes"
    >,
    startIso: string
): TemplateSchedule | null {
    const start = Date.parse(startIso)
    if (!Number.isFinite(start)) return null
    const meeting =
        template.kind === "training"
            ? start
            : start - template.meetingMinutesBeforeStart * MINUTE_MS
    const gameStart = template.kind === "training" ? meeting : start
    const iso = (value: number) => new Date(value).toISOString()
    return {
        registrationStart:
            template.announcementHoursBeforeStart === undefined
                ? undefined
                : iso(
                      gameStart -
                          template.announcementHoursBeforeStart * 60 * MINUTE_MS
                  ),
        registrationEnd: iso(
            meeting - template.registrationHoursBeforeMeeting * 60 * MINUTE_MS
        ),
        meetingStart: iso(meeting),
        gameStart: iso(gameStart),
        gameEnd: iso(gameStart + template.durationMinutes * MINUTE_MS),
    }
}

/** A starting point for a clan's first template. */
export function defaultMatchTemplate(id: string, name: string): MatchTemplate {
    return {
        id,
        name,
        kind: "match",
        registrationHoursBeforeMeeting: 24,
        meetingMinutesBeforeStart: 30,
        durationMinutes: 90,
        allowedSignupStatuses: [],
        useGeneralSignup: false,
        allowRankedSignup: false,
        signupReminderStatuses: ["member"],
        pingMode: "clan",
        pingRoleIds: [],
        createForumChannel: true,
        createSquadVoiceChannels: false,
    }
}

/** Resolve explicit game overrides over the clan baseline without applying game-specific IDs globally. */
export function resolveMatchDefaults(
    templates: readonly MatchTemplate[],
    gameId: GameId,
    kind: EventKind = "match"
): MatchTemplate | undefined {
    const base = templates.find(
        (t) => t.isDefault && !t.gameId && t.kind === kind
    )
    const game = templates.find(
        (t) => t.isDefault && t.gameId === gameId && t.kind === kind
    )
    if (!base && !game) return undefined
    const resolved = { ...(game ?? base!) }
    if (base && game) {
        for (const key of game.inheritFields ?? []) {
            if (key === "registrationHoursBeforeMeeting")
                resolved.registrationHoursBeforeMeeting =
                    base.registrationHoursBeforeMeeting
            if (key === "meetingMinutesBeforeStart")
                resolved.meetingMinutesBeforeStart =
                    base.meetingMinutesBeforeStart
            if (key === "durationMinutes")
                resolved.durationMinutes = base.durationMinutes
            if (key === "announcementHoursBeforeStart")
                resolved.announcementHoursBeforeStart =
                    base.announcementHoursBeforeStart
            if (key === "allowedSignupStatuses")
                resolved.allowedSignupStatuses = base.allowedSignupStatuses
            if (key === "signupReminderStatuses")
                resolved.signupReminderStatuses = base.signupReminderStatuses
            if (key === "attendanceReminderHours")
                resolved.attendanceReminderHours = base.attendanceReminderHours
            if (key === "pingMode") {
                resolved.pingMode = base.pingMode
                resolved.pingRoleIds = base.pingRoleIds
            }
            if (key === "createForumChannel")
                resolved.createForumChannel = base.createForumChannel
            if (key === "createSquadVoiceChannels")
                resolved.createSquadVoiceChannels =
                    base.createSquadVoiceChannels
            if (key === "createParticipantRoles")
                resolved.createParticipantRoles = base.createParticipantRoles
            if (key === "useGeneralSignup")
                resolved.useGeneralSignup = base.useGeneralSignup
            if (key === "allowRankedSignup")
                resolved.allowRankedSignup = base.allowRankedSignup
        }
    }
    if (!game) {
        resolved.signupGroupIds = undefined
        resolved.signupGroupLimits = undefined
        resolved.squadPresetId = undefined
        resolved.topicPresetId = undefined
        resolved.categoryId = undefined
    }
    return { ...resolved, gameId }
}
