import {
    normalizeMatchTemplates,
    type MatchTemplate,
} from "@/domain/events/match-templates"
import type { MutationCtx } from "../../../convex/_generated/server"
import type { Id } from "../../../convex/_generated/dataModel"
import { getGuildDiscordId } from "../../../convex/identity"
export async function prepareMatchTemplates(
    ctx: MutationCtx,
    guildId: Id<"guilds">,
    input: MatchTemplate[]
) {
    const guild = await ctx.db.get(guildId)
    if (!guild) throw new Error("Server not found.")
    const result = normalizeMatchTemplates(input)
    if (!result.ok) return result

    const guildDiscordId = getGuildDiscordId(guild)
    const [groups, topicPresets, squadPresets] = await Promise.all([
        ctx.db
            .query("groups")
            .withIndex("guildId", (q) => q.eq("guildId", guildDiscordId))
            .collect(),
        ctx.db
            .query("topicPresets")
            .withIndex("guildId", (q) => q.eq("guildId", guildDiscordId))
            .collect(),
        ctx.db
            .query("squadPresets")
            .withIndex("guildId", (q) => q.eq("guildId", guildDiscordId))
            .collect(),
    ])
    const templates = result.templates.map((template) => {
        const groupIds = new Set(
            groups
                .filter(
                    (group) =>
                        !template.gameId ||
                        (group.gameId ?? "hell_let_loose") === template.gameId
                )
                .map((group) => String(group._id))
        )
        const topicPresetIds = new Set(
            topicPresets
                .filter(
                    (preset) =>
                        !template.gameId ||
                        !("gameId" in preset) ||
                        !preset.gameId ||
                        preset.gameId === template.gameId
                )
                .map((preset) => String(preset._id))
        )
        const squadPresetIds = new Set(
            squadPresets
                .filter(
                    (preset) =>
                        !template.gameId ||
                        (preset.gameId ?? "hell_let_loose") === template.gameId
                )
                .map((preset) => String(preset._id))
        )

        const limits = template.signupGroupLimits?.filter((limit) =>
            groupIds.has(limit.groupId)
        )
        return {
            ...template,
            signupGroupIds: template.signupGroupIds?.filter((groupId) =>
                groupIds.has(groupId)
            ),
            signupGroupLimits: limits?.length ? limits : undefined,
            topicPresetId:
                template.topicPresetId &&
                topicPresetIds.has(template.topicPresetId)
                    ? template.topicPresetId
                    : undefined,
            squadPresetId:
                template.squadPresetId &&
                squadPresetIds.has(template.squadPresetId)
                    ? template.squadPresetId
                    : undefined,
        }
    })

    return { ok: true as const, templates, guildId: guild._id }
}
