import { v } from "convex/values"

/**
 * A clan's match or training template (design D1). It only pre-fills the
 * dashboard create form; stored events never read it.
 */
const matchTemplateFields = {
    id: v.string(),
    isDefault: v.optional(v.boolean()),
    inheritFields: v.optional(v.array(v.string())),
    name: v.string(),
    kind: v.union(v.literal("match"), v.literal("training")),
    gameId: v.optional(v.string()),
    categoryId: v.optional(v.string()),
    announcementHoursBeforeStart: v.optional(v.number()),
    registrationHoursBeforeMeeting: v.number(),
    meetingMinutesBeforeStart: v.number(),
    durationMinutes: v.number(),
    allowedSignupStatuses: v.array(
        v.union(
            v.literal("member"),
            v.literal("recruit"),
            v.literal("reserve_member"),
            v.literal("mercenary")
        )
    ),
    signupGroupIds: v.optional(v.array(v.string())),
    useGeneralSignup: v.boolean(),
    allowRankedSignup: v.optional(v.boolean()),
    signupReminderStatuses: v.array(
        v.union(
            v.literal("member"),
            v.literal("recruit"),
            v.literal("reserve_member")
        )
    ),
    pingMode: v.union(v.literal("none"), v.literal("clan"), v.literal("roles")),
    pingRoleIds: v.array(v.string()),
    createForumChannel: v.boolean(),
    createSquadVoiceChannels: v.boolean(),
    topicPresetId: v.optional(v.string()),
}

/** The arguments of `guilds:saveMatchTemplates` (unchanged). */
export const matchTemplateValidator = v.object(matchTemplateFields)

/**
 * A stored template: the original fields plus the group caps, attendance
 * reminder offsets, participant roles switch and roster squad preset that
 * `matchTemplates:save` accepts.
 */
export const storedMatchTemplateValidator = v.object({
    ...matchTemplateFields,
    signupGroupLimits: v.optional(
        v.array(v.object({ groupId: v.string(), max: v.number() }))
    ),
    attendanceReminderHours: v.optional(v.array(v.number())),
    createParticipantRoles: v.optional(v.boolean()),
    squadPresetId: v.optional(v.string()),
})
