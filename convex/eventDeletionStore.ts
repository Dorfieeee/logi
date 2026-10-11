import { syncEventAssetReferences } from "../src/infrastructure/convex/event-asset-references"
import { eventDiscordDeletion } from "../src/domain/events/deletion"
import { queueEventDiscordDeletion } from "./eventDeletionQueue"
import type { MutationCtx } from "./_generated/server"
import type { Id } from "./_generated/dataModel"

/** Runs in the caller's authorized, tracked transaction. No external side effects. */
export async function deleteEventInTransaction(
    ctx: MutationCtx,
    eventId: Id<"events">,
    guildId: string
) {
    const event = await ctx.db.get(eventId)
    if (!event || event.guildId !== guildId) throw new Error("Event not found.")
    const syncs = await ctx.db
        .query("discordEventSyncs")
        .withIndex("eventId", (q) => q.eq("eventId", eventId))
        .collect()
    const config = await ctx.db
        .query("discordConfigs")
        .withIndex("guildId", (q) => q.eq("guildId", guildId))
        .unique()
    const cleanup = eventDiscordDeletion(event, syncs, {
        announcementChannelId: config?.announcementsChannelId,
        eventInfoChannelId: config?.eventInfoChannelId,
    })
    const now = new Date().toISOString()
    const discordCleanupQueued = await queueEventDiscordDeletion(
        ctx,
        String(eventId),
        cleanup
    )

    // Operational child rows must not continue issuing reminders after deletion.
    const children = await Promise.all([
        ctx.db
            .query("rosters")
            .withIndex("eventId", (q) => q.eq("eventId", eventId))
            .collect(),
        ctx.db
            .query("eventScheduleJobs")
            .withIndex("eventId", (q) => q.eq("eventId", eventId))
            .collect(),
        ctx.db
            .query("eventReminderRequests")
            .withIndex("eventId_requestedAt", (q) => q.eq("eventId", eventId))
            .collect(),
        ctx.db
            .query("automaticReminderOutcomes")
            .withIndex("eventId_sentAt", (q) => q.eq("eventId", eventId))
            .collect(),
        ctx.db
            .query("rosterChangeRequests")
            .withIndex("eventId_requestedAt", (q) => q.eq("eventId", eventId))
            .collect(),
        ctx.db
            .query("signupActivities")
            .withIndex("eventId_occurredAt", (q) => q.eq("eventId", eventId))
            .collect(),
        ctx.db
            .query("discordAnnouncements")
            .withIndex("eventId", (q) => q.eq("eventId", eventId))
            .collect(),
        ctx.db
            .query("matchRecaps")
            .withIndex("eventId", (q) => q.eq("eventId", eventId))
            .collect(),
        ctx.db
            .query("peopleResultLinks")
            .withIndex("eventId", (q) => q.eq("eventId", eventId))
            .collect(),
        ctx.db
            .query("eventResultRevisions")
            .withIndex("eventId_version", (q) => q.eq("eventId", eventId))
            .collect(),
        ctx.db
            .query("matchStats")
            .withIndex("eventId", (q) => q.eq("eventId", eventId))
            .collect(),
    ])
    const rosterIds = new Set(children[0].map((row) => String(row._id)))
    const attendanceRequests = await ctx.db
        .query("meetingAttendanceRequests")
        .withIndex("guildId", (q) => q.eq("guildId", guildId))
        .collect()
    for (const row of attendanceRequests)
        if (rosterIds.has(String(row.rosterId))) await ctx.db.delete(row._id)
    for (const rows of children)
        for (const row of rows) await ctx.db.delete(row._id)
    for (const sync of syncs) await ctx.db.delete(sync._id)

    // Shared documents survive; only their association with the deleted match goes.
    const [maps, fixtures, occurrences] = await Promise.all([
        ctx.db
            .query("stratmaps")
            .withIndex("eventId", (q) => q.eq("eventId", eventId))
            .collect(),
        ctx.db
            .query("competitionFixtures")
            .withIndex("eventId", (q) => q.eq("eventId", eventId))
            .collect(),
        ctx.db
            .query("events")
            .withIndex("recurrenceSeriesId_gameStart", (q) =>
                q.eq("recurrenceSeriesId", eventId)
            )
            .collect(),
    ])
    for (const map of maps)
        await ctx.db.patch(map._id, { eventId: undefined, updatedAt: now })
    for (const fixture of fixtures)
        await ctx.db.patch(fixture._id, { eventId: undefined, updatedAt: now })
    const competitionSlugs: string[] = []
    for (const fixture of fixtures) {
        const competition = await ctx.db.get(fixture.competitionId)
        if (competition?.slug) competitionSlugs.push(competition.slug)
    }
    for (const occurrence of occurrences)
        await ctx.db.patch(occurrence._id, {
            recurrenceSeriesId: undefined,
            updatedAt: now,
        })
    await syncEventAssetReferences(ctx, {
        _id: eventId,
        guildId,
        matchTeams: [],
    })
    await ctx.db.delete(eventId)
    return {
        eventId: String(eventId),
        discordCleanupQueued,
        rosterIds: [...rosterIds],
        stratmapIds: maps.map((map) => String(map._id)),
        competitionSlugs: [...new Set(competitionSlugs)],
    }
}
