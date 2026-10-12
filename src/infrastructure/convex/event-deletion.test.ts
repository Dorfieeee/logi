import {
    updateEventSyncState,
    updateRosterUpdateMessage,
} from "../../../convex/discordSync"
import { actorFixture, seedDashboardActor } from "./testing/dashboard-actor"
import { setDiscordEventRoles } from "../../../convex/events"
import * as deletion from "../../../convex/eventDeletion"
import { invoke, testContext } from "./testing/database"
import assert from "node:assert/strict"
import test from "node:test"

const secret = "synthetic-event-deletion"
function fixture() {
    process.env.INTERNAL_AUTH_SECRET = secret
    const ctx = testContext()
    seedDashboardActor(ctx.db, "guild-a")
    ctx.db.seed("events", {
        _id: "events:one",
        guildId: "guild-a",
        name: "Match",
        gameId: "wardogs",
        gameStart: "2030-01-01T18:00:00Z",
        gameEnd: "2030-01-01T20:00:00Z",
        meetingStart: "2030-01-01T17:30:00Z",
        registrationEnd: "2030-01-01T17:00:00Z",
        attendeeRoleId: "attendee",
    })
    return ctx
}
const args = {
    secret,
    serverId: "guilds:admin",
    eventId: "events:one",
    actor: actorFixture,
}

test("late Discord writes after deletion are queued for cleanup, never resurrected", async () => {
    const ctx = fixture()
    await invoke(deletion.remove, ctx, args)
    ctx.db.tables.eventDeletionRequests = [] // The first cleanup may already have completed.
    await invoke(updateEventSyncState, ctx, {
        secret,
        eventId: "events:one",
        guildId: "guild-a",
        announcementChannelId: "shared",
        announcementMessageId: "late-message",
        forumThreadId: "late-thread",
        topicMessageIds: [],
        lastSyncedAt: new Date().toISOString(),
    })
    await invoke(updateRosterUpdateMessage, ctx, {
        secret,
        eventId: "events:one",
        guildId: "guild-a",
        channelId: "shared",
        messageId: "late-roster",
    })
    await invoke(setDiscordEventRoles, ctx, {
        secret,
        eventId: "events:one",
        guildId: "guild-a",
        attendeeRoleId: "late-role",
    })
    assert.equal(ctx.db.tables.discordEventSyncs?.length ?? 0, 0)
    assert.deepEqual(
        ctx.db.tables.eventDeletionRequests.flatMap((row) =>
            row.messages.map(
                (message: { messageId: string }) => message.messageId
            )
        ),
        ["late-message", "late-roster"]
    )
    assert.deepEqual(
        ctx.db.tables.eventDeletionRequests.flatMap((row) => row.roleIds),
        ["late-role"]
    )
    assert.deepEqual(
        ctx.db.tables.eventDeletionRequests.flatMap((row) => row.channelIds),
        ["late-thread"]
    )
})

test("deletion requires the current session and workspace admin and rejects another workspace event", async () => {
    for (const denied of ["secret", "session", "admin", "tenant"] as const) {
        const ctx = fixture()
        if (denied === "session") ctx.db.tables.dashboardSessions = []
        if (denied === "admin") ctx.db.tables.discordMemberAccess = []
        if (denied === "tenant")
            await ctx.db.patch("events:one", { guildId: "guild-other" })
        await assert.rejects(
            invoke(deletion.remove, ctx, {
                ...args,
                ...(denied === "secret" ? { secret: "bad" } : {}),
            })
        )
        assert.ok(await ctx.db.get("events:one"))
        assert.equal(ctx.db.tables.eventDeletionRequests?.length ?? 0, 0)
    }
})

test("deletion removes operational children, detaches shared records and emits a tombstone", async () => {
    const ctx = fixture()
    ctx.db.seed("webhookSubscriptions", {
        _id: "webhookSubscriptions:one",
        guildId: "guild-a",
        enabled: true,
        eventTypes: ["integration.changed"],
    })
    for (const table of [
        "rosters",
        "eventScheduleJobs",
        "eventReminderRequests",
        "automaticReminderOutcomes",
        "rosterChangeRequests",
        "signupActivities",
        "discordAnnouncements",
        "matchRecaps",
        "peopleResultLinks",
        "eventResultRevisions",
        "matchStats",
        "stratmaps",
        "competitionFixtures",
    ])
        ctx.db.seed(table, {
            _id: `${table}:one`,
            eventId: "events:one",
            guildId: "guild-a",
        })
    ctx.db.seed("events", {
        _id: "events:next",
        guildId: "guild-a",
        recurrenceSeriesId: "events:one",
        name: "Next",
        gameStart: "2030-01-08T18:00:00Z",
        gameEnd: "2030-01-08T20:00:00Z",
    })
    ctx.db.seed("meetingAttendanceRequests", {
        _id: "meetingAttendanceRequests:one",
        guildId: "guild-a",
        rosterId: "rosters:one",
    })
    ctx.db.seed("gameSessions", {
        _id: "gameSessions:historical",
        guildId: "guild-a",
    })
    ctx.db.seed("playerStats", {
        _id: "playerStats:historical",
        guildId: "guild-a",
    })
    const result = await invoke(deletion.remove, ctx, args)
    assert.equal(result.discordCleanupQueued, true)
    assert.equal(await ctx.db.get("events:one"), null)
    assert.equal(await ctx.db.get("rosters:one"), null)
    assert.equal(await ctx.db.get("eventScheduleJobs:one"), null)
    assert.equal(await ctx.db.get("meetingAttendanceRequests:one"), null)
    assert.equal((await ctx.db.get("stratmaps:one"))?.eventId, undefined)
    assert.equal(
        (await ctx.db.get("competitionFixtures:one"))?.eventId,
        undefined
    )
    assert.equal(
        (await ctx.db.get("events:next"))?.recurrenceSeriesId,
        undefined
    )
    assert.ok(await ctx.db.get("gameSessions:historical"))
    assert.ok(await ctx.db.get("playerStats:historical"))
    assert.deepEqual(ctx.db.tables.eventDeletionRequests[0].roleIds, [
        "attendee",
    ])
    assert.ok(
        ctx.db.tables.webhookDeliveries.some((row) => {
            const payload = JSON.parse(row.payload)
            return (
                payload.resource.operation === "remove" &&
                payload.resource.resource === "event-summaries"
            )
        })
    )
})

test("Discord cleanup claims are fenced and recover after expiry, failures retry", async () => {
    const ctx = fixture()
    await invoke(deletion.remove, ctx, args)
    const requestId = ctx.db.tables.eventDeletionRequests[0]._id
    const claim = await invoke(deletion.claim, ctx, { secret, requestId })
    assert.ok(claim)
    assert.equal(await invoke(deletion.claim, ctx, { secret, requestId }), null)
    await invoke(deletion.finish, ctx, {
        secret,
        requestId,
        leaseUntil: "stale",
    })
    assert.ok(await ctx.db.get(requestId))
    await invoke(deletion.finish, ctx, {
        secret,
        requestId,
        leaseUntil: claim.leaseUntil,
        error: "Discord HTTP 503",
    })
    assert.equal((await ctx.db.get(requestId))?.status, "pending")
    await ctx.db.patch(requestId, { nextAttemptAt: "2000-01-01T00:00:00Z" })
    const retry = await invoke(deletion.claim, ctx, { secret, requestId })
    await invoke(deletion.finish, ctx, {
        secret,
        requestId,
        leaseUntil: retry.leaseUntil,
    })
    assert.equal(await ctx.db.get(requestId), null)
})
