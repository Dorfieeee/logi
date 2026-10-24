import { cronJobs } from "convex/server"

import { SNAPSHOT_TICK_SECONDS } from "../src/domain/game-data/snapshot-rules"
import { makeFunctionReference } from "convex/server"
import { internal } from "./_generated/api"

const crons = cronJobs()
crons.interval(
    "discover and refresh League fixtures",
    { minutes: 15 },
    makeFunctionReference<"action">("leagueDiscoveryJobs:collectDue"),
    {}
)
// Walks the events updated since its last complete run, and every event once
// a day; the inline rebuild on a reviewed-result change does the real work.
crons.interval(
    "reconcile people result relationships",
    { minutes: 15 },
    makeFunctionReference<"mutation">("peopleSummaries:reconcileResultLinks"),
    {}
)
crons.interval(
    "prune expired identity sessions",
    { hours: 1 },
    makeFunctionReference<"mutation">("dashboardSessions:prune"),
    {}
)
crons.interval(
    "prune membership reconciliation metadata",
    { minutes: 10 },
    makeFunctionReference<"mutation">(
        "memberObservations:pruneReconciliations"
    ),
    {}
)
// Denied, superseded and failed role operations 30 days after they finished,
// with their attempt history and an unused Discord lock.
crons.daily(
    "prune finished membership role operations",
    { hourUTC: 3, minuteUTC: 50 },
    makeFunctionReference<"mutation">("memberRoleOperations:pruneFinished"),
    {}
)
crons.interval(
    "collect game server data",
    { seconds: SNAPSHOT_TICK_SECONDS },
    internal.gameDataCollector.collectDue,
    {}
)
crons.interval(
    "collect HLL history",
    { minutes: 10 },
    internal.gameDataCollector.collectHistoryDue,
    {}
)

crons.daily(
    "remove expired public previews",
    { hourUTC: 3, minuteUTC: 15 },
    internal.publicPreviews.removeExpired,
    {}
)

crons.daily(
    "prune retained game history past each workspace's retention window",
    { hourUTC: 3, minuteUTC: 40 },
    internal.gameHistoryRetention.pruneDue,
    {}
)

crons.interval(
    "remove unattached image uploads after their retention window",
    { hours: 1 },
    internal.imageAssets.cleanupUnattached,
    {}
)

crons.interval(
    "deliver pending webhooks",
    { minutes: 1 },
    internal.webhookDispatcher.deliverDue,
    {}
)

// Seed plans: schedule and automatic triggers, live threshold, timeout.
// One transaction per plan; a duplicate delivery finds nothing left to do.
crons.interval(
    "evaluate seed plans",
    { minutes: 1 },
    internal.discordSeedTick.evaluate,
    {}
)

crons.interval(
    "collect all League fixtures and results for the WD League panels",
    { minutes: 1 },
    makeFunctionReference<"action">("leagueDiscoveryFixtureJobs:collectDue"),
    {}
)

// Expired idempotency records (24 h) and rate-limit windows are removed in
// bounded batches; nothing else does, and the rows carry stored responses.
crons.interval(
    "prune expired API idempotency keys and rate-limit buckets",
    { hours: 1 },
    makeFunctionReference<"mutation">("apiHousekeeping:pruneExpired"),
    {}
)

// Retention of the tables that grow by a row per request, run or change: 30
// days of history, a day for expired requests (convex/housekeeping.ts).
crons.daily(
    "prune history past its retention",
    { hourUTC: 4, minuteUTC: 5 },
    makeFunctionReference<"mutation">("housekeeping:pruneHistory"),
    {}
)

// Unfinished clan applications are kept 24 h, then deleted (L6-08, N4-37).
crons.interval(
    "delete expired clan application drafts",
    { hours: 1 },
    makeFunctionReference<"mutation">(
        "membershipApplications:deleteExpiredDrafts"
    ),
    {}
)

export default crons
