import {
    dryRunPanelStore,
    prepareDiscordPanelsPatch,
} from "../src/application/discord-publications/panel-settings-api"
import {
    externalClanSettingsSlicePatches,
    type AnyClanSettingsSlice,
} from "../src/domain/api/settings-slices"
import { panelGraphicsPatchSchema } from "../src/domain/discord-publications/panel-graphics-settings"
import { PANEL_GRAPHICS_API_ERRORS } from "../src/domain/api/panel-graphics-settings-slice"
import { discordPanelsPatchSchema } from "../src/domain/api/discord-panels-settings-slice"
import { prepareMatchTemplates } from "../src/infrastructure/convex/match-template-store"
import { matchTemplatesSaveSchema } from "../src/lib/validation/match-templates"
import { CLAN_SETTINGS_READS, type ClanSettingsRead } from "./clanSettingsReads"
import { seedSettingsPatchSchema } from "../src/domain/api/seed-settings-slice"
import { preparePanelGraphicsChange } from "./discordPanelGraphicsWrites"
import { prepareSeedSettingsChange } from "./discordSeedApiStore"
import type { MutationCtx } from "./_generated/server"
import { panelSaveStore } from "./discordPanelStore"
import { attachableAsset } from "./imageAssetStore"
import { getGuildByDiscordId } from "./identity"

/**
 * Stores of the `/api/v1` settings slices that live in their own table
 * (`external` slices in `src/domain/api/settings-slices.ts`). `read` gives
 * the slice its value (`clanSettingsReads.ts`, which `getClanSettings`
 * uses on its own); `prepare` validates a patch against the database
 * without writing and `commit` stores it, so a refused request never
 * writes half of a settings change.
 */
export type ClanSettingsStoreError = {
    status: number
    code: string
    message: string
}
export type ClanSettingsStore = {
    read: ClanSettingsRead
    prepare(
        ctx: MutationCtx,
        guildId: string,
        patch: unknown
    ): Promise<
        | { ok: true; commit(updatedBy: string): Promise<void> }
        | { ok: false; error: ClanSettingsStoreError }
    >
}

export const CLAN_SETTINGS_STORES: Readonly<Record<string, ClanSettingsStore>> =
    {
        matchTemplates: {
            read: CLAN_SETTINGS_READS.matchTemplates,
            prepare: async (ctx, guildId, patch) => {
                const guild = await getGuildByDiscordId(ctx, guildId)
                if (!guild)
                    return {
                        ok: false,
                        error: {
                            status: 404,
                            code: "not_found",
                            message: "Clan not found.",
                        },
                    }
                const prepared = await prepareMatchTemplates(
                    ctx,
                    guild._id,
                    matchTemplatesSaveSchema.parse(patch).templates
                )
                if (!prepared.ok)
                    return {
                        ok: false,
                        error: {
                            status: 400,
                            code: "invalid_templates",
                            message: prepared.error,
                        },
                    }
                return {
                    ok: true,
                    commit: async () => {
                        await ctx.db.patch(guild._id, {
                            matchTemplates: prepared.templates,
                            updatedAt: new Date().toISOString(),
                        })
                    },
                }
            },
        },
        discordPanels: {
            read: CLAN_SETTINGS_READS.discordPanels,
            prepare: async (ctx, guildId, patch) => {
                const real = panelSaveStore(ctx)
                return await prepareDiscordPanelsPatch(
                    {
                        real,
                        dryRun: dryRunPanelStore(real, async (owner, assetId) =>
                            Boolean(
                                await attachableAsset(ctx, {
                                    assetId,
                                    guildId: owner,
                                    kind: "panel-banner",
                                })
                            )
                        ),
                    },
                    {
                        guildId,
                        patch: discordPanelsPatchSchema.parse(patch),
                        now: Date.now(),
                    }
                )
            },
        },
        panelGraphics: {
            read: CLAN_SETTINGS_READS.panelGraphics,
            prepare: async (ctx, guildId, patch) => {
                const change = await preparePanelGraphicsChange(
                    ctx,
                    guildId,
                    panelGraphicsPatchSchema.parse(patch)
                )
                if (!("ok" in change))
                    return {
                        ok: false,
                        error: PANEL_GRAPHICS_API_ERRORS[change.error],
                    }
                return {
                    ok: true,
                    commit: async (updatedBy) => {
                        await change.commit(updatedBy)
                    },
                }
            },
        },
        seed: {
            read: CLAN_SETTINGS_READS.seed,
            prepare: (ctx, guildId, patch) =>
                prepareSeedSettingsChange(
                    ctx,
                    guildId,
                    seedSettingsPatchSchema.parse(patch)
                ),
        },
    }

function storeOf(slice: AnyClanSettingsSlice) {
    const store = CLAN_SETTINGS_STORES[slice.key]
    if (!store) throw new Error(`Settings slice "${slice.key}" has no store.`)
    return store
}

/**
 * Validates the external parts of a PATCH. The returned `commit` writes all
 * of them; call it only when the whole request is accepted.
 */
export async function prepareExternalClanSettings(
    ctx: MutationCtx,
    guildId: string,
    rawSlices: Readonly<Record<string, unknown>>,
    slices: readonly AnyClanSettingsSlice[]
): Promise<
    | { ok: true; commit(updatedBy: string): Promise<void> }
    | { ok: false; error: ClanSettingsStoreError }
> {
    const commits: Array<(updatedBy: string) => Promise<void>> = []
    for (const [key, patch] of Object.entries(
        externalClanSettingsSlicePatches(rawSlices, slices)
    )) {
        const slice = slices.find((candidate) => candidate.key === key)!
        const prepared = await storeOf(slice).prepare(ctx, guildId, patch)
        if (!prepared.ok) return prepared
        commits.push(prepared.commit)
    }
    return {
        ok: true,
        commit: async (updatedBy) => {
            for (const commit of commits) await commit(updatedBy)
        },
    }
}
