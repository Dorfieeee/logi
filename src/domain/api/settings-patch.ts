import {
    isClanSettingsSliceKey,
    parseClanSettingsSlicePatches,
    type AnyClanSettingsSlice,
} from "./settings-slices"
import { CLAN_SETTINGS_SLICES } from "./clan-settings-slices"

/** Time zones a clan can choose through the API. */
export const SUPPORTED_SETTINGS_TIMEZONES = [
    "UTC",
    "Europe/Bratislava",
    "Europe/London",
    "Europe/Berlin",
    "Europe/Prague",
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "Australia/Sydney",
] as const
const supportedTimezones: ReadonlySet<string> = new Set(
    SUPPORTED_SETTINGS_TIMEZONES
)

/** Discord channel and role IDs the API can set or clear (`null`). */
export const SETTINGS_DISCORD_FIELDS = [
    "announcementsChannelId",
    "eventInfoChannelId",
    "eventResultsChannelId",
    "errorsChannelId",
    "calendarChannelId",
    "forumCategoryId",
    "meetingChannelId",
    "clanRoleId",
    "dashboardAdminRoleId",
] as const
const discordFields = SETTINGS_DISCORD_FIELDS

type DiscordField = (typeof discordFields)[number]

export type ClanSettingsPatch = {
    name?: string
    avatar?: string
    description?: string | null
    timezone?: string
    defaultLanguage?: "en" | "cs" | "de"
    /** Validated patches of feature slices, by slice key. */
    slices?: Record<string, unknown>
} & Partial<Record<DiscordField, string | null>>

/**
 * Validates a `PATCH /clan/settings` body: the plain settings fields plus one
 * object per settings slice (`{ "<slice key>": { … } }`).
 */
export function parseClanSettingsPatch(
    value: unknown,
    slices: readonly AnyClanSettingsSlice[] = CLAN_SETTINGS_SLICES
): { ok: true; value: ClanSettingsPatch } | { ok: false; error: string } {
    if (!value || typeof value !== "object" || Array.isArray(value))
        return { ok: false, error: "Settings patch must be an object." }
    const body = value as Record<string, unknown>
    const input: Record<string, unknown> = {}
    const sliceInput: Record<string, unknown> = {}
    for (const [key, raw] of Object.entries(body))
        if (isClanSettingsSliceKey(key, slices)) sliceInput[key] = raw
        else input[key] = raw
    const allowed = new Set([
        "name",
        "avatar",
        "description",
        "timezone",
        "defaultLanguage",
        ...discordFields,
    ])
    if (
        !Object.keys(body).length ||
        Object.keys(input).some((key) => !allowed.has(key))
    )
        return {
            ok: false,
            error: "Settings patch contains an unsupported field.",
        }

    const patch: ClanSettingsPatch = {}
    for (const [field, raw] of Object.entries(input)) {
        if (
            field === "description" ||
            discordFields.includes(field as DiscordField)
        ) {
            if (raw === null) {
                patch[field as "description" | DiscordField] = null
                continue
            }
        }
        if (typeof raw !== "string")
            return {
                ok: false,
                error: "Settings patch contains an unsupported value.",
            }
        const trimmed = raw.trim()
        if (!trimmed)
            return {
                ok: false,
                error: "Settings patch values cannot be empty.",
            }
        if (field === "timezone" && !supportedTimezones.has(trimmed))
            return { ok: false, error: "timezone is not supported." }
        if (
            field === "defaultLanguage" &&
            !["en", "cs", "de"].includes(trimmed)
        )
            return { ok: false, error: "defaultLanguage is not supported." }
        if (
            discordFields.includes(field as DiscordField) &&
            !/^\d+$/.test(trimmed)
        )
            return { ok: false, error: "Discord IDs must contain only digits." }
        if (field === "defaultLanguage")
            patch.defaultLanguage = trimmed as "en" | "cs" | "de"
        else if (field === "timezone") patch.timezone = trimmed
        else if (field === "name") patch.name = trimmed
        else if (field === "avatar") patch.avatar = trimmed
        else if (field === "description") patch.description = trimmed
        else patch[field as DiscordField] = trimmed
    }
    if (Object.keys(sliceInput).length) {
        const parsed = parseClanSettingsSlicePatches(sliceInput, slices)
        if (!parsed.ok) return parsed
        patch.slices = parsed.value
    }
    return { ok: true, value: patch }
}
