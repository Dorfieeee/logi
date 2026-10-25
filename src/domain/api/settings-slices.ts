/**
 * Settings slices of `/api/v1` `GET/PATCH /clan/settings`.
 *
 * A slice is one feature's settings (panels, seed, commands, …) in one
 * module: a Zod schema for what `GET` returns, a Zod schema for what `PATCH`
 * accepts, a read mapper from the stored Discord configuration and a patch
 * mapper back to it. List the slice in `CLAN_SETTINGS_SLICES`
 * (`clan-settings-slices.ts`) and it is parsed by the route, applied by the
 * Convex mutation, returned under `data.slices.<key>` and documented in
 * OpenAPI with no further change. See
 * `docs/integrations/website/configuration-coverage.md`.
 */

import { z } from "zod"

/** What a slice reads: the clan's Discord configuration without secrets. */
export type ClanSettingsSource = {
    discordConfig: Readonly<Record<string, unknown>> | null
    /**
     * Values of slices kept in their own table (`external` slices), loaded
     * by Convex (`convex/clanSettingsStores.ts`) and keyed by slice key.
     */
    external?: Readonly<Record<string, unknown>>
}

/** Fields a slice writes on the clan's Discord configuration. */
export type DiscordConfigPatch = Record<string, unknown>

export type ClanSettingsSlice<Value = unknown, Patch = unknown> = {
    /** The key under `data.slices` and in the PATCH body, e.g. `seed`. */
    key: string
    /** One sentence for OpenAPI. */
    description: string
    /** What GET returns for this slice. */
    schema: z.ZodType<Value>
    /** What PATCH accepts; only supplied fields change. Use strict objects. */
    patchSchema: z.ZodType<Patch>
    /** Stored configuration → API value. */
    read(source: ClanSettingsSource): Value
    /** Validated PATCH value → Discord configuration fields to write. */
    toPatch(patch: Patch, source: ClanSettingsSource): DiscordConfigPatch
    /**
     * Checks that need the stored configuration (e.g. limits that depend on
     * the clan's categories), run by Convex before `toPatch`. Returns an
     * error message, or null when the patch can be applied.
     */
    verify?(patch: Patch, source: ClanSettingsSource): string | null
    /**
     * The slice lives in its own table, not in the Discord configuration:
     * `read` takes `source.external[key]`, `toPatch` returns no fields and
     * Convex verifies and writes the patch through the slice's store in
     * `convex/clanSettingsStores.ts` (for checks that need the database,
     * such as uploaded image assets).
     */
    external?: boolean
}

/** Any slice, for registries (method parameters keep each slice's own types). */
export type AnyClanSettingsSlice = ClanSettingsSlice<unknown, unknown>

/** Types a slice module; the value and patch types follow its schemas. */
export function defineClanSettingsSlice<Value, Patch>(
    slice: ClanSettingsSlice<Value, Patch>
): ClanSettingsSlice<Value, Patch> {
    return slice
}

/**
 * Keys a slice may not use: the plain settings fields of the endpoint and
 * the response's own keys.
 */
export const RESERVED_SETTINGS_KEYS: ReadonlySet<string> = new Set([
    "name",
    "avatar",
    "description",
    "timezone",
    "defaultLanguage",
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
    "guild",
    "discordConfig",
    "slices",
])

/**
 * Discord configuration fields no slice may write: identity, bookkeeping,
 * secrets and the fields the plain settings own.
 */
export const PROTECTED_DISCORD_CONFIG_FIELDS: ReadonlySet<string> = new Set([
    "_id",
    "_creationTime",
    "id",
    "guildId",
    "createdAt",
    "updatedAt",
    "playerStatsServers",
    "gameOverrides",
    ...RESERVED_SETTINGS_KEYS,
])

const SLICE_KEY = /^[a-z][a-zA-Z0-9]{1,39}$/

/** Rejects a registry with bad, duplicate or reserved keys. */
export function assertClanSettingsSlices(
    slices: readonly AnyClanSettingsSlice[]
) {
    const seen = new Set<string>()
    for (const slice of slices) {
        if (!SLICE_KEY.test(slice.key))
            throw new Error(`Settings slice key "${slice.key}" is invalid.`)
        if (RESERVED_SETTINGS_KEYS.has(slice.key))
            throw new Error(`Settings slice key "${slice.key}" is reserved.`)
        if (seen.has(slice.key))
            throw new Error(`Settings slice key "${slice.key}" is duplicated.`)
        seen.add(slice.key)
    }
}

const sliceByKey = (slices: readonly AnyClanSettingsSlice[], key: string) =>
    slices.find((slice) => slice.key === key)

/** Whether a PATCH body key belongs to a slice. */
export function isClanSettingsSliceKey(
    key: string,
    slices: readonly AnyClanSettingsSlice[]
) {
    return Boolean(sliceByKey(slices, key))
}

export type SlicePatchResult =
    { ok: true; value: Record<string, unknown> } | { ok: false; error: string }

/** Validates the slice parts of a PATCH body; unknown keys are refused. */
export function parseClanSettingsSlicePatches(
    input: Readonly<Record<string, unknown>>,
    slices: readonly AnyClanSettingsSlice[]
): SlicePatchResult {
    const value: Record<string, unknown> = {}
    for (const [key, raw] of Object.entries(input)) {
        const slice = sliceByKey(slices, key)
        if (!slice)
            return {
                ok: false,
                error: "Settings patch contains an unsupported field.",
            }
        const parsed = slice.patchSchema.safeParse(raw)
        if (!parsed.success) {
            const issue = parsed.error.issues[0]
            const path = [key, ...(issue?.path ?? [])].join(".")
            return {
                ok: false,
                error: `${path}: ${issue?.message ?? "invalid value"}`,
            }
        }
        value[key] = parsed.data
    }
    return { ok: true, value }
}

/** The validated patches of `external` slices, which Convex writes itself. */
export function externalClanSettingsSlicePatches(
    patches: Readonly<Record<string, unknown>>,
    slices: readonly AnyClanSettingsSlice[]
): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(patches).filter(
            ([key]) => sliceByKey(slices, key)?.external === true
        )
    )
}

/** Every slice's current value, for `data.slices`. */
export function readClanSettingsSlices(
    source: ClanSettingsSource,
    slices: readonly AnyClanSettingsSlice[]
) {
    return Object.fromEntries(
        slices.map((slice) => [slice.key, slice.read(source)])
    )
}

/**
 * The Discord configuration fields for validated slice patches. A slice
 * that writes a protected field, or two slices writing one field, is a
 * programming error and throws.
 */
export function clanSettingsSlicesPatch(
    patches: Readonly<Record<string, unknown>>,
    source: ClanSettingsSource,
    slices: readonly AnyClanSettingsSlice[]
): DiscordConfigPatch {
    const patch: DiscordConfigPatch = {}
    const owner = new Map<string, string>()
    for (const [key, value] of Object.entries(patches)) {
        const slice = sliceByKey(slices, key)
        if (!slice) throw new Error(`Unknown settings slice "${key}".`)
        for (const [field, fieldValue] of Object.entries(
            slice.toPatch(value, source)
        )) {
            if (PROTECTED_DISCORD_CONFIG_FIELDS.has(field))
                throw new Error(
                    `Settings slice "${key}" may not write "${field}".`
                )
            const previous = owner.get(field)
            if (previous && previous !== key)
                throw new Error(
                    `Settings slices "${previous}" and "${key}" both write "${field}".`
                )
            owner.set(field, key)
            patch[field] = fieldValue
        }
    }
    return patch
}

/**
 * The Convex side of a PATCH: validates the slice patches again (the
 * mutation never trusts its caller's shape) and maps them to fields.
 */
export function applyClanSettingsSlicePatches(
    raw: Readonly<Record<string, unknown>> | undefined,
    source: ClanSettingsSource,
    slices: readonly AnyClanSettingsSlice[]
):
    | { ok: true; patch: DiscordConfigPatch; changed: boolean }
    | { ok: false; error: string } {
    if (!raw || !Object.keys(raw).length)
        return { ok: true, patch: {}, changed: false }
    const parsed = parseClanSettingsSlicePatches(raw, slices)
    if (!parsed.ok) return parsed
    for (const [key, value] of Object.entries(parsed.value)) {
        const error = sliceByKey(slices, key)?.verify?.(value, source)
        if (error) return { ok: false, error: `${key}: ${error}` }
    }
    return {
        ok: true,
        patch: clanSettingsSlicesPatch(parsed.value, source, slices),
        changed: true,
    }
}

/** OpenAPI component name of a slice, e.g. `ClanSettingsSeedSlice`. */
export function clanSettingsSliceSchemaName(
    key: string,
    kind: "read" | "patch"
) {
    const pascal = key.charAt(0).toUpperCase() + key.slice(1)
    return `ClanSettings${pascal}${kind === "patch" ? "Patch" : "Slice"}`
}

/** JSON Schemas of every slice for OpenAPI components. */
export function clanSettingsSliceJsonSchemas(
    slices: readonly AnyClanSettingsSlice[]
) {
    return Object.fromEntries(
        slices.flatMap((slice) => [
            [
                clanSettingsSliceSchemaName(slice.key, "read"),
                {
                    ...z.toJSONSchema(slice.schema, { io: "output" }),
                    description: slice.description,
                },
            ],
            [
                clanSettingsSliceSchemaName(slice.key, "patch"),
                {
                    ...z.toJSONSchema(slice.patchSchema, { io: "input" }),
                    description: `${slice.description} Only supplied fields change.`,
                },
            ],
        ])
    )
}
