import {
    trackedMatch,
    ensureTracked,
} from "../../../convex/leagueTrackingStore"
import {
    getGuildByDiscordId,
    getGuildDiscordId,
} from "../../../convex/identity"
import type { MutationCtx } from "../../../convex/_generated/server"
import { matchUrl } from "../../domain/wardogs-league/match-url"
import type { Id } from "../../../convex/_generated/dataModel"

/** All match writers bind in their own transaction. A competing publish/import rolls back on conflict. */
export async function bindWardogsFixture(
    ctx: MutationCtx,
    eventId: Id<"events">,
    sourceUrl: string
) {
    const event = await ctx.db.get(eventId)
    if (!event || event.isDraft) return
    if (event.gameId !== "wardogs" || (event.kind ?? "match") !== "match")
        throw new Error("Fixture links require a Wardogs match.")
    const guildRecordId = ctx.db.normalizeId("guilds", event.guildId)
    const guild = guildRecordId
        ? await ctx.db.get(guildRecordId)
        : await getGuildByDiscordId(ctx, event.guildId)
    const guildId = guild ? getGuildDiscordId(guild) : ""
    if (!guildId) throw new Error("Match clan was not found.")
    const fixture = matchUrl(sourceUrl)
    if (event.wardogsFixtureUrl && event.wardogsFixtureUrl !== fixture.url)
        throw new Error("This match is already linked to another fixture.")
    const old = await ctx.db
        .query("leagueAutoImportFixtures")
        .withIndex("identity", (q) =>
            q.eq("guildId", guildId).eq("fixtureId", fixture.id)
        )
        .unique()
    if (old?.eventId && old.eventId !== eventId)
        throw new Error(
            "This Wardogs fixture is already linked to another match."
        )
    const other = await ctx.db
        .query("leagueAutoImportFixtures")
        .withIndex("eventId", (q) => q.eq("eventId", eventId))
        .unique()
    if (other && other.fixtureId !== fixture.id)
        throw new Error("This match is already linked to another fixture.")
    if (!fixture.url.startsWith("https://gwl.gg/")) {
        const tracked = await trackedMatch(ctx, guildId, fixture.id)
        if (tracked?.eventId && tracked.eventId !== eventId)
            throw new Error(
                "This Wardogs fixture is already linked to another match."
            )
        const prior = await ctx.db
            .query("leagueTrackedMatches")
            .withIndex("event", (q) =>
                q.eq("guildId", guildId).eq("eventId", String(eventId))
            )
            .unique()
        if (prior && prior.matchId !== fixture.id)
            throw new Error("This match is already linked to another fixture.")
        const link = tracked ?? (await ensureTracked(ctx, guildId, fixture.id))
        await ctx.db.patch(link._id, { eventId: String(eventId) })
    }
    if (old) await ctx.db.patch(old._id, { eventId, updatedAt: Date.now() })
    else
        await ctx.db.insert("leagueAutoImportFixtures", {
            guildId: guildId,
            fixtureId: fixture.id,
            eventId,
            overrides: [],
            updatedAt: Date.now(),
        })
    if (event.wardogsFixtureUrl !== fixture.url)
        await ctx.db.patch(eventId, {
            wardogsFixtureUrl: fixture.url,
            updatedAt: new Date().toISOString(),
        })
}
