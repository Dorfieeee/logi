import { defineTable } from "convex/server"
import { v } from "convex/values"

export const leagueAutoImportSettings = defineTable({
    guildId: v.string(),
    settingsJson: v.string(),
    credentialJson: v.string(),
    provider: v.optional(v.literal("gwl")),
    testMode: v.optional(v.boolean()),
    cursor: v.optional(v.number()),
    reconcileAt: v.optional(v.number()),
    reconcileOffset: v.optional(v.number()),
    revision: v.number(),
    enabled: v.boolean(),
    nextPollAt: v.number(),
    leaseUntil: v.number(),
    fence: v.number(),
    lastSuccessAt: v.optional(v.number()),
    error: v.optional(v.string()),
})
    .index("guildId", ["guildId"])
    .index("due", ["enabled", "nextPollAt"])
export const leagueAutoImportFixtures = defineTable({
    guildId: v.string(),
    fixtureId: v.string(),
    slotJson: v.optional(v.string()),
    matchJson: v.optional(v.string()),
    sessionJson: v.optional(v.string()),
    fileStorageId: v.optional(v.id("_storage")),
    fileDigest: v.optional(v.string()),
    resultDigest: v.optional(v.string()),
    resultState: v.optional(v.string()),
    statsState: v.optional(v.string()),
    statsRetryAt: v.optional(v.number()),
    statsAttempts: v.optional(v.number()),
    eventId: v.optional(v.id("events")),
    settingsJson: v.optional(v.string()),
    cachePending: v.optional(v.boolean()),
    baselineJson: v.optional(v.string()),
    teamBaselineJson: v.optional(v.string()),
    templateJson: v.optional(v.string()),
    overrides: v.array(v.string()),
    issue: v.optional(v.string()),
    updatedAt: v.number(),
})
    .index("eventId", ["eventId"])
    .index("cachePending", ["cachePending"])
    .index("identity", ["guildId", "fixtureId"])
    .index("guildId", ["guildId"])

export const gwlBudgets = defineTable({
    key: v.string(),
    window: v.number(),
    count: v.number(),
}).index("key", ["key"])
export const gwlReadCache = defineTable({
    configId: v.id("leagueAutoImportSettings"),
    path: v.string(),
    revision: v.optional(v.number()),
    etag: v.string(),
    body: v.string(),
}).index("resource", ["configId", "path"])

export const gwlFileVersions = defineTable({
    guildId: v.string(),
    eventId: v.id("events"),
    digest: v.string(),
    storageId: v.id("_storage"),
    createdAt: v.number(),
}).index("event_digest", ["eventId", "digest"])
