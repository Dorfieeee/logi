import { v } from "convex/values"

import {
    clanResultSummary,
    resultProviderName,
} from "../src/domain/discord-messages/clan-result"
import { isDraftEvent } from "../src/domain/events/drafts"
import { assertInternalSecret } from "./discord_shared"
import { getGuildByDiscordId } from "./identity"
import { query } from "./_generated/server"

/**
 * What the match forum shows besides the event (board L1 1.13): the titles
 * of the attached tactical maps, and the confirmed result for the Debrief
 * with whether a public match page exists. Internal secret only (the bot);
 * provisional results and drafts give nothing.
 */
export const forumContext = query({
    args: { secret: v.string(), eventId: v.string() },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const eventId = ctx.db.normalizeId("events", args.eventId)
        const event = eventId ? await ctx.db.get(eventId) : null
        if (!event || isDraftEvent(event)) return null
        const stratmaps = []
        for (const raw of (event.stratmapIds ?? []).slice(0, 10)) {
            const id = ctx.db.normalizeId("stratmaps", String(raw))
            const map = id ? await ctx.db.get(id) : null
            if (map && map.guildId === event.guildId)
                stratmaps.push({ id: String(map._id), title: map.title })
        }
        const stats = event.matchStatsId
            ? await ctx.db.get(event.matchStatsId)
            : null
        const summary = clanResultSummary({
            result: event.reviewedResult ?? null,
            clanSide: event.side,
            imported: event.eventResult
                ? {
                      outcome: event.eventResult.outcome,
                      score: event.eventResult.score,
                      sideA: event.eventResult.sideA,
                      sideB: event.eventResult.sideB,
                  }
                : null,
        })
        const guild = await getGuildByDiscordId(ctx, event.guildId)
        const matchType = event.matchType?.trim().toLowerCase()
        const category =
            (event.kind ?? "match") === "match" && matchType
                ? guild?.eventCategories?.find(
                      (item) => item.id.trim().toLowerCase() === matchType
                  )
                : undefined
        return {
            stratmaps,
            result: summary,
            provider: resultProviderName(event.reviewedResult ?? null) ?? null,
            // The public match page exists only for matches with linked stats.
            publicMatch: Boolean(stats && stats.eventId === event._id),
            // The clan's dashboard ID, for links to the match page.
            serverId: guild ? String(guild._id) : null,
            clanName: guild?.name ?? null,
            category: category
                ? { label: category.label, color: category.color }
                : matchType && (event.kind ?? "match") === "match"
                  ? { label: event.matchType!.trim(), color: null }
                  : null,
        }
    },
})
