import {
    matchTeamInputsSchema,
    matchTeamsEditability,
    matchTeamSummarySchema,
    sortAssignments,
} from "../teams/match-teams"
import {
    eventTimeOfDaySchema,
    tacticalPlanMatchesMap,
    tacticalPlanSchema,
} from "./tactical-plan"
import { isApiKeyReadAccess } from "../api/key-access"
import { teamIdSchema } from "../teams/team"
import { deriveEventStatus } from "./status"
import type { EventStatus } from "./types"
import { z } from "zod"

export const websiteEventGameSchema = z.enum(["hell_let_loose", "wardogs"])
export const websiteEventRevisionSchema = z
    .string()
    .regex(/^(0|[1-9][0-9]{0,127})$/)
export const websiteEventIdSchema = z
    .string()
    .regex(/^[A-Za-z0-9][A-Za-z0-9_:-]{0,199}$/)
export const websiteEventKeySchema = z.string().regex(/^[A-Za-z0-9_-]{16,128}$/)
const websitePolicyGame = z.strictObject({
    gameId: websiteEventGameSchema,
    roleIds: z
        .array(z.string().regex(/^\d{17,20}$/))
        .max(64)
        .refine((roles) => new Set(roles).size === roles.length),
})
export const websiteEventPolicySchema = z.strictObject({
    enabled: z.boolean(),
    games: z
        .array(websitePolicyGame)
        .max(2)
        .refine(
            (games) =>
                new Set(games.map((game) => game.gameId)).size === games.length
        ),
})
export const websiteEventPolicyInputSchema = z.strictObject({
    applicationRecordId: websiteEventIdSchema,
    apiKeyId: websiteEventIdSchema,
    policy: websiteEventPolicySchema,
})
export const websiteEventPolicyResultSchema = websiteEventPolicySchema.extend({
    version: websiteEventRevisionSchema,
})
export const websiteEventPolicyListSchema = z
    .array(
        websiteEventPolicyResultSchema.extend({
            apiKeyId: websiteEventIdSchema,
        })
    )
    .max(100)
export type WebsiteEventPolicyInput = z.infer<
    typeof websiteEventPolicyInputSchema
>
/** Registered SSO applications as the dashboard lists them for the policy form. */
export const websiteEventPolicyApplicationsSchema = z
    .array(
        z.object({
            id: websiteEventIdSchema,
            clientId: z.string().min(1),
            name: z.string(),
        })
    )
    .max(100)
export type WebsiteEventPolicyApplication = z.infer<
    typeof websiteEventPolicyApplicationsSchema
>[number]
const websiteEventPolicyKeyRecord = z.object({
    id: websiteEventIdSchema,
    name: z.string(),
    revokedAt: z.string().optional(),
    readAccess: z.unknown().optional(),
})
export const websiteEventPolicyKeysSchema = z.object({
    keys: z.array(websiteEventPolicyKeyRecord).max(500),
})
export type WebsiteEventPolicyKey = {
    id: string
    name: string
    gameIds: WebsiteEventGame[]
}
/** Only a live restricted key may carry a command policy, and only for games the
 * command contract supports; legacy unrestricted keys never qualify. */
export function eligibleWebsiteEventKeys(
    keys: z.infer<typeof websiteEventPolicyKeyRecord>[]
): WebsiteEventPolicyKey[] {
    return keys.flatMap((key) => {
        if (key.revokedAt || !isApiKeyReadAccess(key.readAccess)) return []
        const gameIds = key.readAccess.gameIds.filter(
            (gameId): gameId is WebsiteEventGame =>
                websiteEventGameSchema.safeParse(gameId).success
        )
        return gameIds.length ? [{ id: key.id, name: key.name, gameIds }] : []
    })
}
const instant = z.iso.datetime()
export const websiteEventFieldsSchema = z
    .strictObject({
        kind: z.enum(["match", "training"]),
        name: z.string().trim().min(1).max(160),
        matchType: z.string().trim().max(80).optional(),
        description: z.string().trim().max(2000).optional(),
        map: z.string().trim().max(200).optional(),
        timeOfDay: eventTimeOfDaySchema.optional(),
        tacticalPlan: tacticalPlanSchema.nullable().optional(),
        /** Opt-in public Discord thread under the announcement; omitted preserves it on update. */
        createSignupThread: z.boolean().optional(),
        side: z.string().trim().max(200).optional(),
        registrationStart: instant.optional(),
        registrationEnd: instant,
        meetingStart: instant,
        gameStart: instant,
        gameEnd: instant,
        /** Directory team IDs, slots and sides. Omitted preserves the saved selection; [] clears it. */
        matchTeams: matchTeamInputsSchema.optional(),
    })
    .refine(
        (event) =>
            !event.tacticalPlan ||
            (event.kind === "match" &&
                tacticalPlanMatchesMap(event.tacticalPlan, event.map)),
        {
            path: ["tacticalPlan"],
            message: "Tactical plan must belong to the selected map.",
        }
    )
    .refine(
        (event) =>
            (!event.registrationStart ||
                Date.parse(event.registrationStart) <=
                    Date.parse(event.registrationEnd)) &&
            Date.parse(event.registrationEnd) <=
                Date.parse(event.meetingStart) &&
            Date.parse(event.meetingStart) <= Date.parse(event.gameStart) &&
            Date.parse(event.gameStart) < Date.parse(event.gameEnd),
        { message: "Invalid event schedule." }
    )
export const websiteEventCommandSchema = z.discriminatedUnion("operation", [
    z.strictObject({
        operation: z.literal("create"),
        event: websiteEventFieldsSchema,
    }),
    z.strictObject({
        operation: z.literal("update"),
        eventId: websiteEventIdSchema,
        expectedRevision: websiteEventRevisionSchema,
        event: websiteEventFieldsSchema,
    }),
    z.strictObject({
        operation: z.literal("cancel"),
        eventId: websiteEventIdSchema,
        expectedRevision: websiteEventRevisionSchema,
    }),
    z.strictObject({
        operation: z.literal("delete"),
        eventId: websiteEventIdSchema,
        expectedRevision: websiteEventRevisionSchema,
    }),
    /** Explicit re-capture of one assigned team's presentation from the active directory entry. */
    z.strictObject({
        operation: z.literal("refresh_match_team"),
        eventId: websiteEventIdSchema,
        expectedRevision: websiteEventRevisionSchema,
        teamId: teamIdSchema,
    }),
])
const websiteEventOperationSchema = z.enum([
    "create",
    "update",
    "cancel",
    "delete",
    "refresh_match_team",
])
export type WebsiteEventCommand = z.infer<typeof websiteEventCommandSchema>
export type WebsiteEventFields = z.infer<typeof websiteEventFieldsSchema>
export type WebsiteEventGame = z.infer<typeof websiteEventGameSchema>
export type WebsiteEventError =
    | "unauthorized"
    | "insufficient_scope"
    | "policy_denied"
    | "membership_denied"
    | "membership_stale"
    | "not_found"
    | "revision_conflict"
    | "idempotency_conflict"
    | "invalid_state"
    | "invalid_request"
    | "invalid_match_teams"
export type WebsiteEventReceipt = {
    eventId: string
    guildId: string
    gameId: WebsiteEventGame
    revision: string
    operation: WebsiteEventCommand["operation"]
    receiptId: string
    replayed: boolean
}
export const websiteEventReceiptSchema = z.strictObject({
    eventId: websiteEventIdSchema,
    guildId: z.string().regex(/^\d{17,20}$/),
    gameId: websiteEventGameSchema,
    revision: websiteEventRevisionSchema,
    operation: websiteEventOperationSchema,
    receiptId: websiteEventIdSchema,
    replayed: z.boolean(),
})
export const websiteEventEditorSchema = z.strictObject({
    eventId: websiteEventIdSchema,
    guildId: z.string().regex(/^\d{17,20}$/),
    gameId: websiteEventGameSchema,
    revision: websiteEventRevisionSchema,
    event: websiteEventFieldsSchema,
    /** Current assignments with captured labels/logos; null for trainings and legacy events. */
    matchTeams: z.array(matchTeamSummarySchema).nullable(),
    canEdit: z.boolean(),
    canCancel: z.boolean(),
})
/**
 * A schema failure confined to `event.matchTeams` (bad slot, side length,
 * entry count, team ID or a client-sent snapshot) is a team-assignment error,
 * as on the dashboard; any other failure is a malformed request.
 */
export function websiteEventSchemaError(
    issues: readonly { path: readonly PropertyKey[] }[]
): "invalid_match_teams" | "invalid_request" {
    return issues.length > 0 &&
        issues.every(
            (issue) =>
                issue.path[0] === "event" && issue.path[1] === "matchTeams"
        )
        ? "invalid_match_teams"
        : "invalid_request"
}
export type WebsiteEventResult =
    { data: WebsiteEventReceipt } | { error: { code: WebsiteEventError } }
export type WebsiteEventActor = {
    subject: string
    clientId: string
    applicationRecordId: string
    apiKeyId: string
    guildId: string
}

/**
 * Digest input for idempotency. Team selections are compared by slot, so the
 * same assignments listed in another order replay the original receipt.
 */
export function canonicalWebsiteCommand(
    gameId: WebsiteEventGame,
    command: WebsiteEventCommand
): string {
    const sort = (value: unknown): unknown => {
        if (Array.isArray(value)) return value.map(sort)
        if (value && typeof value === "object")
            return Object.fromEntries(
                Object.entries(value)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .filter(([, child]) => child !== undefined)
                    .map(([key, child]) => [key, sort(child)])
            )
        return value
    }
    const semantic =
        "event" in command && command.event.matchTeams
            ? {
                  ...command,
                  event: {
                      ...command.event,
                      matchTeams: sortAssignments(command.event.matchTeams),
                  },
              }
            : command
    return JSON.stringify(sort({ gameId, command: semantic }))
}

/** No legacy full-access grant, global permission, login claim or assignment fallback. */
export function allowsWebsiteEventWrite(
    access: unknown,
    gameId: WebsiteEventGame
): boolean {
    const result = z
        .strictObject({
            resources: z.array(z.literal("event-commands")).length(1),
            gameIds: z.array(websiteEventGameSchema).min(1).max(2),
        })
        .safeParse(access)
    return (
        result.success &&
        new Set(result.data.gameIds).size === result.data.gameIds.length &&
        result.data.gameIds.includes(gameId)
    )
}

export function websiteEventMembershipError(input: {
    now: number
    epoch: string
    allowedRoles: readonly string[]
    observation: {
        state: string
        roleIds: readonly string[]
        observedAt: string | null
        epoch: string
        unavailable?: boolean
    } | null
}): "membership_stale" | "membership_denied" | null {
    const observation = input.observation
    const observedAt = observation?.observedAt
        ? Date.parse(observation.observedAt)
        : NaN
    if (
        !observation ||
        observation.epoch !== input.epoch ||
        observation.unavailable ||
        !Number.isFinite(observedAt) ||
        observedAt > input.now ||
        input.now - observedAt > 60_000
    )
        return "membership_stale"
    return observation.state === "present" &&
        input.allowedRoles.some((role) => observation.roleIds.includes(role))
        ? null
        : "membership_denied"
}

export function canEditWebsiteEvent(
    event: {
        registrationEnd: string
        meetingStart: string
        gameEnd: string
        status?: EventStatus
    },
    now: number
): boolean {
    return (
        Number.isFinite(Date.parse(event.meetingStart)) &&
        now < Date.parse(event.meetingStart) &&
        deriveEventStatus(event, new Date(now)) !== "concluded"
    )
}

/**
 * Existing Logi pre-meeting conclusion semantics; no new cancelled status or
 * result. A team snapshot refresh stays available until the match concludes,
 * like the dashboard refresh, so it may follow meeting start; a concluded
 * match or a training is a team-assignment rule violation.
 */
export function websiteEventStateError(
    command: WebsiteEventCommand,
    existing: {
        kind?: string
        registrationEnd: string
        meetingStart: string
        gameEnd: string
        status?: EventStatus
    } | null,
    now: number
): "invalid_state" | "invalid_match_teams" | null {
    if (command.operation === "create")
        return Date.parse(command.event.meetingStart) > now
            ? null
            : "invalid_state"
    if (!existing) return "invalid_state"
    if (command.operation === "delete") return null
    if (command.operation === "refresh_match_team")
        return matchTeamsEditability({
            kind: existing.kind === "training" ? "training" : "match",
            status: deriveEventStatus(existing, new Date(now)),
        })
            ? "invalid_match_teams"
            : null
    if (!canEditWebsiteEvent(existing, now)) return "invalid_state"
    if (
        command.operation === "update" &&
        ((existing.kind ?? "match") !== command.event.kind ||
            Date.parse(command.event.meetingStart) <= now)
    )
        return "invalid_state"
    return null
}
