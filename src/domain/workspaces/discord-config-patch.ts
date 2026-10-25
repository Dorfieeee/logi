/** Discord ID settings that can be cleared individually with `null`. */
export const DISCORD_CONFIG_ID_FIELDS = [
    "announcementsChannelId",
    "eventInfoChannelId",
    "eventResultsChannelId",
    "errorsChannelId",
    "calendarChannelId",
    "forumCategoryId",
    "meetingChannelId",
    "squadVoiceCategoryId",
    "clanRoleId",
    "dashboardAdminRoleId",
] as const

/** Whole-value settings; a supplied value replaces the stored one. */
export const DISCORD_CONFIG_VALUE_FIELDS = [
    "timezone",
    "defaultLanguage",
    "calendarCategories",
    "playerStatsServers",
    "ticketSettings",
    "membershipSettings",
    "statsSettings",
    "gameOverrides",
] as const

export type DiscordConfigIdField = (typeof DISCORD_CONFIG_ID_FIELDS)[number]
type ValueField = (typeof DISCORD_CONFIG_VALUE_FIELDS)[number]

export type DiscordConfigPatchInput = Partial<
    Record<DiscordConfigIdField, string | null>
> &
    Partial<Record<ValueField, unknown>> & {
        calendarCategories?: string[]
        playerStatsServers?: Array<{ token: string; url: string }>
    }

/** Field updates where `undefined` removes the stored value. */
export type DiscordConfigUpdates<T extends DiscordConfigPatchInput> = {
    [K in keyof T]?: K extends DiscordConfigIdField
        ? string | undefined
        : Exclude<T[K], null>
}

/**
 * Turns a settings form submission into field updates for the stored Discord
 * configuration. Omitted fields are left out so other settings pages keep their
 * values; `null` or a blank ID becomes `undefined`, which removes the field.
 */
export function discordConfigPatch<T extends DiscordConfigPatchInput>(
    input: T
): DiscordConfigUpdates<T> {
    const updates: Record<string, unknown> = {}
    for (const field of DISCORD_CONFIG_ID_FIELDS) {
        if (!(field in input) || input[field] === undefined) continue
        updates[field] = input[field]?.trim() || undefined
    }
    for (const field of DISCORD_CONFIG_VALUE_FIELDS) {
        if (!(field in input) || input[field] === undefined) continue
        updates[field] = input[field]
    }
    if (input.calendarCategories)
        updates.calendarCategories = input.calendarCategories
            .map((value) => value.trim())
            .filter(Boolean)
    if (input.playerStatsServers)
        updates.playerStatsServers = input.playerStatsServers
            .map((item) => ({ token: item.token.trim(), url: item.url.trim() }))
            .filter((item) => item.token && item.url)
    return updates as DiscordConfigUpdates<T>
}
