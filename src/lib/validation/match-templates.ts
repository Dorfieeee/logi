import { z } from "zod"

import {
    MAX_MATCH_TEMPLATES,
    REMINDER_STATUSES,
    SIGNUP_STATUSES,
} from "@/domain/events/match-templates"
import { ATTENDANCE_REMINDER_OFFSETS } from "@/domain/events/scheduled-job-policy"
import { MAX_SIGNUP_GROUP_LIMIT } from "@/domain/events/upsert-policy"

const id = z.string().trim().min(1).max(64)
const hours = z
    .number()
    .int()
    .min(0)
    .max(24 * 30)
const minutes = z
    .number()
    .int()
    .min(0)
    .max(24 * 60)

export const matchTemplateSchema = z.strictObject({
    id,
    isDefault: z.boolean().optional(),
    inheritFields: z
        .array(
            z.enum([
                "registrationHoursBeforeMeeting",
                "meetingMinutesBeforeStart",
                "durationMinutes",
                "announcementHoursBeforeStart",
                "allowedSignupStatuses",
                "signupReminderStatuses",
                "attendanceReminderHours",
                "pingMode",
                "createForumChannel",
                "createSquadVoiceChannels",
                "createParticipantRoles",
                "useGeneralSignup",
                "allowRankedSignup",
            ])
        )
        .optional(),
    name: z.string().trim().min(1).max(60),
    kind: z.enum(["match", "training"]),
    gameId: z.string().trim().min(1).optional(),
    categoryId: z.string().trim().max(64).optional(),
    announcementHoursBeforeStart: hours.optional(),
    registrationHoursBeforeMeeting: hours,
    meetingMinutesBeforeStart: minutes,
    durationMinutes: minutes.min(1),
    allowedSignupStatuses: z.array(z.enum(SIGNUP_STATUSES)).max(4),
    signupGroupIds: z.array(id).max(50).optional(),
    useGeneralSignup: z.boolean(),
    allowRankedSignup: z.boolean().optional(),
    signupReminderStatuses: z.array(z.enum(REMINDER_STATUSES)).max(3),
    pingMode: z.enum(["none", "clan", "roles"]),
    pingRoleIds: z.array(z.string().regex(/^\d{1,32}$/)).max(25),
    createForumChannel: z.boolean(),
    createSquadVoiceChannels: z.boolean(),
    topicPresetId: id.optional(),
    signupGroupLimits: z
        .array(
            z.strictObject({
                groupId: id,
                max: z.number().int().min(1).max(MAX_SIGNUP_GROUP_LIMIT),
            })
        )
        .max(50)
        .optional(),
    attendanceReminderHours: z
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
        .optional(),
    createParticipantRoles: z.boolean().optional(),
    squadPresetId: id.optional(),
})

/** One save of the match templates page: the clan's full list. */
export const matchTemplatesSaveSchema = z.strictObject({
    templates: z.array(matchTemplateSchema).max(MAX_MATCH_TEMPLATES),
})

export type MatchTemplatesSave = z.infer<typeof matchTemplatesSaveSchema>
