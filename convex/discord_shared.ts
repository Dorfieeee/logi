import { applicationFormValidator } from "./membershipApplicationValidators"
import { v } from "convex/values"

import {
    normalizeCalendarItemDoc,
    normalizeDoc as normalizeReadModelDoc,
    normalizeEventDoc,
    normalizeUserDoc,
} from "../src/infrastructure/convex/server-read-model"

/**
 * The configured internal secret. Fails closed: without one nothing is
 * accepted, rather than the development default that is public in this
 * repository.
 */
export function internalAuthSecret() {
    const expected = process.env.INTERNAL_AUTH_SECRET
    if (!expected) throw new Error("Unauthorized.")
    return expected
}

export function assertInternalSecret(secret: string) {
    if (secret !== internalAuthSecret()) {
        throw new Error("Unauthorized.")
    }
}

export const normalizeDoc = normalizeReadModelDoc
export { normalizeCalendarItemDoc, normalizeEventDoc, normalizeUserDoc }

export function normalizeConfigDoc<
    T extends { _id: unknown; defaultLanguage?: "en" | "cs" | "de" },
>(doc: T) {
    return {
        ...normalizeReadModelDoc(doc),
        defaultLanguage: doc.defaultLanguage ?? "en",
        calendarCategories: Array.isArray(
            (doc as { calendarCategories?: string[] }).calendarCategories
        )
            ? ((doc as { calendarCategories?: string[] }).calendarCategories ??
              [])
            : [],
    }
}

export function normalizeGuildDoc<
    T extends { _id: unknown; discordId?: string; id?: string },
>(doc: T) {
    return {
        ...normalizeReadModelDoc(doc),
        discordId: doc.discordId ?? doc.id ?? String(doc._id),
    }
}

export const ticketModalQuestionValidator = v.object({
    id: v.string(),
    label: v.string(),
    placeholder: v.optional(v.string()),
    style: v.union(v.literal("short"), v.literal("paragraph")),
    required: v.boolean(),
})

export const ticketCategoryValidator = v.object({
    id: v.string(),
    emoji: v.optional(v.string()),
    label: v.optional(v.string()),
    description: v.optional(v.string()),
    supportRoleIds: v.array(v.string()),
    modalQuestions: v.array(ticketModalQuestionValidator),
    threadTitle: v.optional(v.string()),
})

export const membershipCategoryValidator = v.object({
    id: v.string(),
    gameId: v.optional(v.string()),
    emoji: v.optional(v.string()),
    label: v.optional(v.string()),
    description: v.optional(v.string()),
    supportRoleIds: v.array(v.string()),
    recruitRoleIds: v.array(v.string()),
    finalRoleIds: v.array(v.string()),
    includeClanRoleForRecruit: v.optional(v.boolean()),
    includeClanRoleForFinal: v.optional(v.boolean()),
    modalQuestions: v.array(ticketModalQuestionValidator),
    assignmentType: v.union(
        v.literal("member"),
        v.literal("reserve_member"),
        v.literal("mercenary")
    ),
    autoAssignRecruitOnApply: v.optional(v.boolean()),
    askSpecialization: v.optional(v.boolean()),
})

export const ticketSettingsValidator = v.object({
    enabled: v.boolean(),
    submitChannelId: v.optional(v.string()),
    ticketParentChannelId: v.optional(v.string()),
    panelTitle: v.string(),
    panelDescription: v.string(),
    panelImageUrl: v.optional(v.string()),
    panelAccentColor: v.optional(v.string()),
    categories: v.array(ticketCategoryValidator),
})

export const membershipSettingsValidator = v.object({
    enabled: v.boolean(),
    submitChannelId: v.optional(v.string()),
    applicationParentChannelId: v.optional(v.string()),
    panelTitle: v.string(),
    panelDescription: v.string(),
    panelImageUrl: v.optional(v.string()),
    // The panel's own colour, `#RRGGBB`; missing means the clan colour (L4-10).
    panelAccentColor: v.optional(v.string()),
    applicationWelcomeMessage: v.optional(v.string()),
    collectSpecialization: v.optional(v.boolean()),
    autoAssignRecruitOnApply: v.boolean(),
    roleSyncEnabled: v.optional(v.boolean()),
    inviteSupportMembersIndividually: v.optional(v.boolean()),
    rosterScoreSettings: v.optional(
        v.object({
            noCategory: v.number(),
            declined: v.number(),
            rosterPresent: v.number(),
            reservePresent: v.number(),
            rosterAbsent: v.number(),
            reserveAbsent: v.number(),
            excusedAbsence: v.number(),
        })
    ),
    categories: v.array(membershipCategoryValidator),
    applicationForm: v.optional(applicationFormValidator),
    webFormEnabled: v.optional(v.boolean()),
    mentionSupportRoles: v.optional(v.boolean()),
    sendConfirmationDm: v.optional(v.boolean()),
})

export const calendarCategoriesValidator = v.array(v.string())

export const statsSettingsValidator = v.object({
    enabled: v.boolean(),
    games: v.object({ hell_let_loose: v.boolean(), wardogs: v.boolean() }),
    defaultShareChannelId: v.optional(v.string()),
})

export const messageStyleValidator = v.object({
    accentColor: v.optional(v.string()),
    iconDensity: v.optional(v.union(v.literal("sparse"), v.literal("rich"))),
})

export const playerStatsServerValidator = v.object({
    token: v.string(),
    url: v.string(),
})

export const gameDiscordOverridesValidator = v.object({
    announcementsChannelId: v.optional(v.string()),
    eventInfoChannelId: v.optional(v.string()),
    forumCategoryId: v.optional(v.string()),
    meetingChannelId: v.optional(v.string()),
    squadVoiceCategoryId: v.optional(v.string()),
    playerStatsServers: v.optional(v.array(playerStatsServerValidator)),
    membershipSettings: v.optional(membershipSettingsValidator),
    membershipPanelMessageId: v.optional(v.string()),
    membershipPanelLastConfigUpdatedAt: v.optional(v.string()),
})

export const gameOverridesValidator = v.object({
    hell_let_loose: v.optional(gameDiscordOverridesValidator),
    hell_let_loose_vietnam: v.optional(gameDiscordOverridesValidator),
    wardogs: v.optional(gameDiscordOverridesValidator),
})
