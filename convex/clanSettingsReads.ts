import {
    guildPanels,
    panelOwnsKey,
    panelPublications,
    storedPanel,
} from "./discordPanelStore"
import { discordPanelsApiView } from "../src/application/discord-publications/panel-settings-api"
import { panelGraphicsApiView } from "../src/domain/api/panel-graphics-settings-slice"
import type { AnyClanSettingsSlice } from "../src/domain/api/settings-slices"
import { readStoredPanelGraphics } from "./discordPanelGraphicsStore"
import { readSeedSettingsApi } from "./discordSeedApiStore"
import type { QueryCtx } from "./_generated/server"
import { getGuildByDiscordId } from "./identity"

/**
 * Reads of the `/api/v1` settings slices that live in their own table
 * (`external` slices in `src/domain/api/settings-slices.ts`). The writes are
 * in `clanSettingsStores.ts`; a settings read must not evaluate them.
 */
export type ClanSettingsRead = (
    ctx: Pick<QueryCtx, "db">,
    guildId: string
) => Promise<unknown>

/** "Panely v Discordu" for `/api/v1`: every panel with whether it was ever sent. */
async function readDiscordPanels(ctx: Pick<QueryCtx, "db">, guildId: string) {
    const [rows, publications, statuses] = await Promise.all([
        guildPanels(ctx, guildId),
        panelPublications(ctx, guildId),
        ctx.db
            .query("discordPanelStatus")
            .withIndex("guildId", (q) => q.eq("guildId", guildId))
            .collect(),
    ])
    return discordPanelsApiView(
        rows.map((row) => ({
            ...storedPanel(row),
            sent:
                Boolean(
                    statuses.find((entry) => entry.panelId === String(row._id))
                        ?.sentAt
                ) ||
                publications.some(
                    (publication) =>
                        panelOwnsKey(row, publication.key) &&
                        publication.messageId !== null
                ) ||
                row.draft === undefined,
        }))
    )
}

export const CLAN_SETTINGS_READS: Readonly<Record<string, ClanSettingsRead>> = {
    matchTemplates: async (ctx, guildId) => ({
        templates:
            (await getGuildByDiscordId(ctx, guildId))?.matchTemplates ?? [],
    }),
    discordPanels: readDiscordPanels,
    panelGraphics: async (ctx, guildId) =>
        panelGraphicsApiView(await readStoredPanelGraphics(ctx, guildId)),
    seed: readSeedSettingsApi,
}

export function clanSettingsReadOf(slice: AnyClanSettingsSlice) {
    const read = CLAN_SETTINGS_READS[slice.key]
    if (!read) throw new Error(`Settings slice "${slice.key}" has no store.`)
    return read
}

/** `source.external` for every external slice. */
export async function readExternalClanSettings(
    ctx: Pick<QueryCtx, "db">,
    guildId: string,
    slices: readonly AnyClanSettingsSlice[]
): Promise<Record<string, unknown>> {
    const external: Record<string, unknown> = {}
    for (const slice of slices)
        if (slice.external)
            external[slice.key] = await clanSettingsReadOf(slice)(ctx, guildId)
    return external
}
