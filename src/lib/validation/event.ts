import {
    eventTimeOfDaySchema,
    tacticalPlanMatchesMap,
    tacticalPlanSchema,
} from "@/domain/events/tactical-plan"
import { ATTENDANCE_REMINDER_OFFSETS } from "@/domain/events/scheduled-job-policy"
import { MAX_SIGNUP_GROUP_LIMIT } from "@/domain/events/upsert-policy"
import { matchTeamInputsSchema } from "@/domain/teams/match-teams"
import { z } from "zod"

const settingId = z.string().trim().min(1).max(64)

/** Group caps of a match: a full group offers a reserve place instead. */
export const signupGroupLimitsSchema = z
    .array(
        z.strictObject({
            groupId: settingId,
            max: z.number().int().min(1).max(MAX_SIGNUP_GROUP_LIMIT),
        })
    )
    .max(50)

/** Attendance DM offsets in hours before the meeting; [] sends none. */
export const attendanceReminderHoursSchema = z
    .array(
        z
            .number()
            .int()
            .refine((hours) =>
                (ATTENDANCE_REMINDER_OFFSETS as readonly number[]).includes(
                    hours
                )
            )
    )
    .max(ATTENDANCE_REMINDER_OFFSETS.length)

export const eventSchema = z
    .object({
        gameId: z.string().trim().min(1).optional(),
        kind: z.enum(["match", "training"]),
        matchType: z
            .string()
            .trim()
            .max(80, "Event category must be 80 characters or fewer.")
            .optional(),
        name: z.string().trim().min(1, "Event name is required."),
        description: z.string().trim().optional(),
        thumbnailUrl: z
            .string()
            .trim()
            .url("Thumbnail must be a valid URL.")
            .optional()
            .or(z.literal("")),
        imageUrl: z
            .string()
            .trim()
            .url("Image must be a valid URL.")
            .optional()
            .or(z.literal("")),
        announcementChannelId: z.string().trim().optional(),
        eventInfoChannelId: z.string().trim().optional(),
        meetingChannelId: z.string().trim().optional(),
        createSquadVoiceChannels: z.boolean().default(false),
        squadVoiceCategoryId: z.string().trim().optional(),
        durationMinutes: z.coerce.number().int().min(1).max(1440).default(90),
        requiredRoleIds: z.array(z.string().trim()).default([]),
        rewardRoleIds: z.array(z.string().trim()).default([]),
        server: z.string().trim().optional(),
        serverPassword: z.string().trim().optional(),
        side: z.string().trim().optional(),
        map: z.string().trim().optional(),
        timeOfDay: eventTimeOfDaySchema.optional(),
        tacticalPlan: tacticalPlanSchema.nullable().optional(),
        cap: z.string().trim().optional(),
        notes: z.string().trim().optional(),
        registrationStart: z.string().trim().optional(),
        registrationEnd: z.string().min(1, "Registration end is required."),
        meetingStart: z.string().min(1, "Meeting start is required."),
        gameStart: z.string().optional(),
        gameEnd: z.string().optional(),
        pingClan: z.boolean(),
        pingMode: z.enum(["none", "clan", "roles"]).default("none"),
        pingRoleIds: z.array(z.string().trim()).default([]),
        createForumChannel: z.boolean().default(false),
        topicPresetId: z.string().trim().optional(),
        stratmapIds: z.array(z.string().trim()).default([]),
        signupGroupIds: z.array(z.string().trim()).default([]),
        allowedSignupStatuses: z
            .array(z.enum(["recruit", "member", "reserve_member", "mercenary"]))
            .default([]),
        useGeneralSignup: z.boolean().default(false),
        signupReminderStatuses: z
            .array(z.enum(["recruit", "member", "reserve_member"]))
            .default(["member"]),
        recurrence: z
            .object({
                frequency: z.enum([
                    "weekly",
                    "monthly_date",
                    "monthly_nth_weekday",
                ]),
                interval: z.coerce.number().int().min(1).max(52).default(1),
                weekdays: z
                    .array(z.coerce.number().int().min(0).max(6))
                    .default([]),
                monthDay: z.coerce.number().int().min(1).max(31).optional(),
                nth: z.coerce.number().int().min(1).max(5).optional(),
                weekday: z.coerce.number().int().min(0).max(6).optional(),
            })
            .optional(),
        matchTeams: matchTeamInputsSchema.optional(),
        // Settings a match template gives. On an update an omitted field keeps
        // the saved value; [] clears the caps or the reminders, "" the preset.
        signupGroupLimits: signupGroupLimitsSchema.optional(),
        attendanceReminderHours: attendanceReminderHoursSchema.optional(),
        createParticipantRoles: z.boolean().optional(),
        squadPresetId: z.string().trim().max(64).optional(),
    })
    .superRefine((value, ctx) => {
        if (
            value.tacticalPlan &&
            (value.kind !== "match" ||
                value.gameId !== "wardogs" ||
                !tacticalPlanMatchesMap(value.tacticalPlan, value.map))
        ) {
            ctx.addIssue({
                code: "custom",
                path: ["tacticalPlan"],
                message:
                    "Tactical plan must belong to the selected Wardogs map.",
            })
        }
        const registrationEnd = new Date(value.registrationEnd)
        const registrationStart = value.registrationStart
            ? new Date(value.registrationStart)
            : null
        const meetingStart = new Date(value.meetingStart)
        const gameStart = value.gameStart ? new Date(value.gameStart) : null
        const gameEnd = value.gameEnd ? new Date(value.gameEnd) : null

        if (Number.isNaN(registrationEnd.getTime())) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["registrationEnd"],
                message: "Registration end must be a valid date and time.",
            })
        }
        if (registrationStart && Number.isNaN(registrationStart.getTime())) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["registrationStart"],
                message: "Registration start must be a valid date and time.",
            })
        }
        if (
            registrationStart &&
            !Number.isNaN(registrationStart.getTime()) &&
            !Number.isNaN(registrationEnd.getTime()) &&
            registrationStart > registrationEnd
        ) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["registrationStart"],
                message:
                    "Registration start should be before registration end.",
            })
        }
        if (Number.isNaN(meetingStart.getTime())) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["meetingStart"],
                message: "Meeting start must be a valid date and time.",
            })
        }
        if (
            value.kind === "match" &&
            (!gameStart || Number.isNaN(gameStart.getTime()))
        ) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["gameStart"],
                message: "Game start must be a valid date and time.",
            })
        }
        if (
            value.kind === "match" &&
            (!gameEnd || Number.isNaN(gameEnd.getTime()))
        ) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["gameEnd"],
                message: "Game end must be a valid date and time.",
            })
        }

        if (
            !Number.isNaN(registrationEnd.getTime()) &&
            !Number.isNaN(meetingStart.getTime()) &&
            registrationEnd > meetingStart
        ) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["registrationEnd"],
                message: "Registration end should be before meeting start.",
            })
        }
        if (
            value.kind === "match" &&
            gameStart &&
            !Number.isNaN(meetingStart.getTime()) &&
            !Number.isNaN(gameStart.getTime()) &&
            meetingStart > gameStart
        ) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["meetingStart"],
                message: "Meeting start should be before game start.",
            })
        }
        if (
            value.kind === "match" &&
            gameStart &&
            gameEnd &&
            !Number.isNaN(gameStart.getTime()) &&
            !Number.isNaN(gameEnd.getTime()) &&
            gameStart > gameEnd
        ) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["gameEnd"],
                message: "Game end should be after game start.",
            })
        }
        if (
            value.recurrence?.frequency === "weekly" &&
            value.recurrence.weekdays.length === 0
        ) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["recurrence", "weekdays"],
                message: "Choose at least one weekday.",
            })
        }
        if (
            value.recurrence?.frequency === "monthly_date" &&
            !value.recurrence.monthDay
        ) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["recurrence", "monthDay"],
                message: "Choose a day of the month.",
            })
        }
        if (
            value.recurrence?.frequency === "monthly_nth_weekday" &&
            (!value.recurrence.nth || value.recurrence.weekday === undefined)
        ) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["recurrence"],
                message: "Choose the week and weekday.",
            })
        }
    })

export type EventInput = z.input<typeof eventSchema>
export type EventParsedInput = z.infer<typeof eventSchema>

/**
 * The dashboard's event update (PATCH): the event fields strictly, so an
 * unknown or misspelt key is refused instead of silently dropped, with the
 * same timeline rules as `eventSchema`.
 */
export const eventUpdateSchema = z
    .strictObject(eventSchema.shape)
    .superRefine((value, ctx) => {
        const checked = eventSchema.safeParse(value)
        if (checked.success) return
        for (const issue of checked.error.issues)
            ctx.addIssue({
                code: "custom",
                path: issue.path,
                message: issue.message,
            })
    })
