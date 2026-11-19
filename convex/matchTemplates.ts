import { prepareMatchTemplates } from "../src/infrastructure/convex/match-template-store"
import { storedMatchTemplateValidator } from "./matchTemplateValidators"
import { assertInternalSecret } from "./discord_shared"
import { mutation } from "./_generated/server"
import { v } from "convex/values"

/**
 * Replaces a clan's match templates (settings › Match templates, design D1),
 * including group caps, attendance reminder offsets, the participant roles
 * switch and the roster's squad preset. Signup groups, caps, topic presets
 * and squad presets that do not belong to this clan are dropped, so a
 * template can never point at another clan's data.
 */
export const save = mutation({
    args: {
        secret: v.string(),
        guildId: v.id("guilds"),
        templates: v.array(storedMatchTemplateValidator),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const prepared = await prepareMatchTemplates(
            ctx,
            args.guildId,
            args.templates
        )
        if (!prepared.ok) return prepared
        const templates = prepared.templates
        await ctx.db.patch(args.guildId, {
            matchTemplates: templates,
            updatedAt: new Date().toISOString(),
        })
        return { ok: true as const, templates }
    },
})
