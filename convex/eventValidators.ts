import { tacticalPlanValidator } from "./tacticalPlanValidator"
import { v } from "convex/values"

import { matchTeamInput } from "./teamValidators"

const signupStatus = v.union(
    v.literal("recruit"),
    v.literal("member"),
    v.literal("reserve_member"),
    v.literal("mercenary")
)
const reminderStatus = v.union(
    v.literal("recruit"),
    v.literal("member"),
    v.literal("reserve_member")
)

/**
 * The event fields of the new-match flow's writes (drafts and publishing).
 * They match `events:upsert`, including the settings a match template
 * gives: group caps, attendance reminder offsets, participant roles and the
 * roster's squad preset (which `events:upsert` can also clear with null).
 */
export const eventWriteFields = {
    gameId: v.optional(v.string()),
    kind: v.optional(v.union(v.literal("match"), v.literal("training"))),
    matchType: v.optional(v.string()),
    name: v.string(),
    description: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    announcementChannelId: v.optional(v.string()),
    eventInfoChannelId: v.optional(v.string()),
    meetingChannelId: v.optional(v.string()),
    createSquadVoiceChannels: v.optional(v.boolean()),
    squadVoiceCategoryId: v.optional(v.string()),
    durationMinutes: v.optional(v.number()),
    requiredRoleIds: v.optional(v.array(v.string())),
    rewardRoleIds: v.optional(v.array(v.string())),
    signupGroupIds: v.optional(v.array(v.string())),
    allowedSignupStatuses: v.optional(v.array(signupStatus)),
    useGeneralSignup: v.optional(v.boolean()),
    signupReminderStatuses: v.optional(v.array(reminderStatus)),
    recurrence: v.optional(
        v.object({
            frequency: v.union(
                v.literal("weekly"),
                v.literal("monthly_date"),
                v.literal("monthly_nth_weekday")
            ),
            interval: v.number(),
            weekdays: v.array(v.number()),
            monthDay: v.optional(v.number()),
            nth: v.optional(v.number()),
            weekday: v.optional(v.number()),
        })
    ),
    server: v.optional(v.string()),
    serverPassword: v.optional(v.string()),
    side: v.optional(v.string()),
    map: v.optional(v.string()),
    timeOfDay: v.optional(v.string()),
    tacticalPlan: v.optional(v.union(tacticalPlanValidator, v.null())),
    cap: v.optional(v.string()),
    notes: v.optional(v.string()),
    registrationStart: v.optional(v.string()),
    registrationEnd: v.string(),
    meetingStart: v.string(),
    gameStart: v.string(),
    gameEnd: v.string(),
    pingClan: v.boolean(),
    pingMode: v.optional(
        v.union(v.literal("none"), v.literal("clan"), v.literal("roles"))
    ),
    pingRoleIds: v.optional(v.array(v.string())),
    createForumChannel: v.optional(v.boolean()),
    topicPresetId: v.optional(v.id("topicPresets")),
    stratmapIds: v.optional(v.array(v.id("stratmaps"))),
    matchTeams: v.optional(v.array(matchTeamInput)),
    signupGroupLimits: v.optional(
        v.array(v.object({ groupId: v.string(), max: v.number() }))
    ),
    attendanceReminderHours: v.optional(v.array(v.number())),
    createParticipantRoles: v.optional(v.boolean()),
    squadPresetId: v.optional(v.id("squadPresets")),
}
