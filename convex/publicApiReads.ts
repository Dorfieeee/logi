import {
    apiDocument,
    assertInternalSecret,
    safeDiscordConfigOf,
} from "./publicApiShared"
import {
    projectEventSummary,
    projectMatchSummary,
} from "../src/domain/api/event-summaries"
import {
    isGameId,
    matchesGameScope,
    resolveGameScope,
} from "../src/domain/games/game"
import { isClanApiResourceDocument } from "../src/domain/api/resource-document"
import { projectHealth, projectSnapshot } from "../src/domain/game-data/policy"
import { CLAN_SETTINGS_SLICES } from "../src/domain/api/clan-settings-slices"
import { playerStatProfile } from "../src/domain/player-stats/game-metrics"
import { readClanSettingsSlices } from "../src/domain/api/settings-slices"
import { authorizeDashboardAdmin, dashboardActor } from "./dashboardActor"
import { projectResultSummary } from "../src/domain/api/result-summaries"
import { projectClanMetaCounts } from "../src/domain/api/clan-meta"
import { allowsApiKeyRead } from "../src/domain/api/key-access"
import { readExternalClanSettings } from "./clanSettingsReads"
import { isDraftEvent } from "../src/domain/events/drafts"
import type { Id } from "./_generated/dataModel"
import { getGuildByDiscordId } from "./identity"
import { query } from "./_generated/server"
import { v } from "convex/values"

/**
 * The per-request reads of `/api/v1` (the website's clan resources, meta,
 * settings and the dashboard's key list). They live apart from the
 * mutations in `publicApi.ts` so a read never evaluates the command
 * use-cases, repositories and the stratmap catalogue behind the writes
 * (ARCHITECTURE.md, "Convex hot paths"). API key authentication lives in
 * `apiKeyAuth.ts`: it runs on every request and must not pay for this
 * module's graph either.
 */

export const listKeys = query({
    args: { secret: v.string(), guildId: v.string(), actor: dashboardActor },
    handler: async (ctx, args) => {
        await authorizeDashboardAdmin(ctx, args)
        return (
            await ctx.db
                .query("apiKeys")
                .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
                .collect()
        ).map((key) => ({
            id: String(key._id),
            name: key.name,
            keyPrefix: key.keyPrefix,
            createdAt: key.createdAt,
            lastUsedAt: key.lastUsedAt,
            revokedAt: key.revokedAt,
            ...(key.readAccess !== undefined
                ? { readAccess: key.readAccess }
                : {}),
        }))
    },
})

/**
 * A deliberately small, authenticated sync marker and count projection. The
 * marker is the clan document's own `updatedAt`, read here; the counts come
 * from the clan's stored summary (`clanMetaSummaries`), which
 * `clanMeta:refreshClanMeta` recomputes at most once a minute off the
 * request path, so this read never scans the clan's tables
 * (ARCHITECTURE.md, "Convex hot paths"). `counts` and `computedAt` are null
 * only until the first refresh; the web gateway then refreshes
 * synchronously, so the website never sees them.
 */
export const getClanMeta = query({
    args: { secret: v.string(), keyHash: v.string() },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const key = await ctx.db
            .query("apiKeys")
            .withIndex("keyHash", (q) => q.eq("keyHash", args.keyHash))
            .unique()
        if (!key || key.revokedAt) return null
        if (!allowsApiKeyRead(key.readAccess, "meta")) return null
        const guild = await getGuildByDiscordId(ctx, key.guildId)
        if (!guild) return null
        const guildId = key.guildId
        const [enabledGames, summary] = await Promise.all([
            ctx.db
                .query("guildGames")
                .withIndex("guildId_gameId", (q) => q.eq("guildId", guildId))
                .collect(),
            ctx.db
                .query("clanMetaSummaries")
                .withIndex("guildId", (q) => q.eq("guildId", guildId))
                .unique(),
        ])
        return {
            guild: { id: String(guild._id), guildId, name: guild.name },
            enabledGames: enabledGames
                .filter((entry) => entry.enabled)
                .map((entry) => entry.gameId),
            counts: summary ? projectClanMetaCounts(summary.tallies) : null,
            computedAt: summary?.computedAt ?? null,
            updatedAt: guild.updatedAt,
        }
    },
})

export const getClanSettings = query({
    args: { secret: v.string(), keyHash: v.string() },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const key = await ctx.db
            .query("apiKeys")
            .withIndex("keyHash", (q) => q.eq("keyHash", args.keyHash))
            .unique()
        if (!key || key.revokedAt) return null
        if (!allowsApiKeyRead(key.readAccess, "settings")) return null
        const [guild, discordConfig] = await Promise.all([
            getGuildByDiscordId(ctx, key.guildId),
            ctx.db
                .query("discordConfigs")
                .withIndex("guildId", (q) => q.eq("guildId", key.guildId))
                .unique(),
        ])
        if (!guild) return null
        const safeDiscordConfig = safeDiscordConfigOf(discordConfig)
        return {
            guild: { ...guild, id: String(guild._id) },
            discordConfig: safeDiscordConfig,
            // Feature settings slices (src/domain/api/clan-settings-slices.ts).
            slices: readClanSettingsSlices(
                {
                    discordConfig: safeDiscordConfig,
                    // Slices kept in their own table (convex/clanSettingsStores.ts).
                    external: await readExternalClanSettings(
                        ctx,
                        key.guildId,
                        CLAN_SETTINGS_SLICES
                    ),
                },
                CLAN_SETTINGS_SLICES
            ),
        }
    },
})

const apiResource = v.union(
    v.literal("server-snapshots"),
    v.literal("integration-health"),
    v.literal("event-summaries"),
    v.literal("match-summaries"),
    v.literal("result-summaries"),
    v.literal("events"),
    v.literal("groups"),
    v.literal("rosters"),
    v.literal("assignments"),
    v.literal("calendar-items"),
    v.literal("stratmaps"),
    v.literal("topic-presets"),
    v.literal("squad-presets"),
    v.literal("matches"),
    v.literal("articles"),
    v.literal("users")
)
const apiGameScope = v.string()
const apiGameSelection = v.union(apiGameScope, v.array(v.string()))

export const getClanPerformanceHistory = query({
    args: {
        secret: v.string(),
        keyHash: v.string(),
        game: apiGameSelection,
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const key = await ctx.db
            .query("apiKeys")
            .withIndex("keyHash", (q) => q.eq("keyHash", args.keyHash))
            .unique()
        if (!key || key.revokedAt) return null
        if (!allowsApiKeyRead(key.readAccess, "performance-history", args.game))
            return null
        const history = await ctx.db
            .query("guildPerformanceHistory")
            .withIndex("guildId", (q) => q.eq("guildId", key.guildId))
            .unique()
        if (!history) return { matches: [], updatedAt: null }
        return {
            matches: history.matches
                .filter(
                    (match) =>
                        matchesGameScope(match.gameId, args.game) &&
                        playerStatProfile(match.gameId)
                )
                .map((match) =>
                    match.gameId === "wardogs"
                        ? {
                              eventId: match.eventId,
                              gameId: "wardogs",
                              playedAt: match.playedAt,
                              label: match.label,
                              kills: match.kills,
                              deaths: match.deaths,
                              kd:
                                  match.kd ??
                                  (match.deaths
                                      ? match.kills / match.deaths
                                      : match.kills),
                              cashDelta: match.cashDelta ?? null,
                          }
                        : { ...match, gameId: resolveGameScope(match.gameId) }
                ),
            updatedAt: history.updatedAt,
        }
    },
})

export const getClanMatchByEvent = query({
    args: { secret: v.string(), keyHash: v.string(), eventId: v.id("events") },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const key = await ctx.db
            .query("apiKeys")
            .withIndex("keyHash", (q) => q.eq("keyHash", args.keyHash))
            .unique()
        if (!key || key.revokedAt) return null
        if (!allowsApiKeyRead(key.readAccess, "matches")) return null
        const event = await ctx.db.get(args.eventId)
        if (!event || event.guildId !== key.guildId || isDraftEvent(event))
            return null
        if (
            !allowsApiKeyRead(
                key.readAccess,
                "matches",
                resolveGameScope(event.gameId)
            )
        )
            return null
        const match = await ctx.db
            .query("matchStats")
            .withIndex("eventId", (q) => q.eq("eventId", event._id))
            .unique()
        if (
            match &&
            (match.guildId !== key.guildId ||
                !allowsApiKeyRead(
                    key.readAccess,
                    "matches",
                    resolveGameScope(match.gameId)
                ))
        )
            return null
        return match
            ? {
                  ...apiDocument(match),
                  eventId: String(event._id),
                  gameId: resolveGameScope(match.gameId),
              }
            : null
    },
})

export const getClanUser = query({
    args: { secret: v.string(), keyHash: v.string(), userId: v.string() },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const key = await ctx.db
            .query("apiKeys")
            .withIndex("keyHash", (q) => q.eq("keyHash", args.keyHash))
            .unique()
        if (!key || key.revokedAt) return null
        if (!allowsApiKeyRead(key.readAccess, "users")) return null
        const assignment = await ctx.db
            .query("userAssignments")
            .withIndex("serverId_userId", (q) =>
                q.eq("serverId", key.guildId).eq("userId", args.userId)
            )
            .first()
        if (!assignment) return null
        const user = await ctx.db
            .query("users")
            .withIndex("discordId", (q) => q.eq("discordId", args.userId))
            .unique()
        return user ? apiDocument(user) : null
    },
})

function apiGameDocument<T extends { _id: unknown; gameId?: unknown }>(
    document: T
) {
    return {
        ...apiDocument(document),
        gameId: resolveGameScope(document.gameId as never),
    }
}

function belongsToGame(
    document: { gameId?: never },
    game: string | readonly string[]
) {
    return matchesGameScope(document.gameId as never, game as never)
}

/**
 * A bounded, authenticated page for exactly one clan concern. This intentionally
 * replaces getClanData: no endpoint may load a clan's entire database.
 */
export const getClanResourcePage = query({
    args: {
        secret: v.string(),
        keyHash: v.string(),
        resource: apiResource,
        game: apiGameSelection,
        cursor: v.union(v.string(), v.null()),
        limit: v.number(),
        updatedSince: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const key = await ctx.db
            .query("apiKeys")
            .withIndex("keyHash", (q) => q.eq("keyHash", args.keyHash))
            .unique()
        if (!key || key.revokedAt) return null
        if (!allowsApiKeyRead(key.readAccess, args.resource, args.game))
            return null
        const guildId = key.guildId
        const options = { cursor: args.cursor, numItems: args.limit }
        if (
            args.resource === "server-snapshots" ||
            args.resource === "integration-health"
        ) {
            const page = await ctx.db
                .query("gameDataConnections")
                .withIndex("guildId", (q) => q.eq("guildId", guildId))
                .paginate(options)
            return {
                items: page.page
                    .filter(
                        (row) =>
                            matchesGameScope(row.gameId, args.game) &&
                            (!args.updatedSince ||
                                Date.parse(row.updatedAt) >=
                                    Date.parse(args.updatedSince))
                    )
                    .map((row) =>
                        (args.resource === "server-snapshots"
                            ? projectSnapshot
                            : projectHealth)(
                            { ...row, id: String(row._id) },
                            Date.now()
                        )
                    ),
                nextCursor: page.isDone ? null : page.continueCursor,
                limit: args.limit,
            }
        }
        const pageFor = async (query: {
            paginate: (value: typeof options) => Promise<{
                page: Array<Record<string, unknown>>
                continueCursor: string
                isDone: boolean
            }>
        }) => {
            const result = await query.paginate(options)
            return {
                items: result.page
                    .filter(
                        (item) =>
                            belongsToGame(item as never, args.game) &&
                            // Unpublished drafts are left out of `/api/v1`.
                            !(args.resource === "events" && isDraftEvent(item))
                    )
                    .map((item) =>
                        [
                            "events",
                            "groups",
                            "rosters",
                            "assignments",
                            "stratmaps",
                            "matches",
                            "squad-presets",
                        ].includes(args.resource)
                            ? apiGameDocument(item as never)
                            : apiDocument(item as never)
                    ),
                nextCursor: result.isDone ? null : result.continueCursor,
                limit: args.limit,
            }
        }
        switch (args.resource) {
            case "event-summaries":
            case "result-summaries":
            case "match-summaries": {
                const events = ctx.db
                    .query("events")
                    .withIndex("guildId", (q) => q.eq("guildId", guildId))
                const result = await (
                    args.updatedSince
                        ? events.filter((q) =>
                              q.gte(q.field("updatedAt"), args.updatedSince!)
                          )
                        : events
                ).paginate(options)
                return {
                    items: result.page
                        .filter(
                            (event) =>
                                !isDraftEvent(event) &&
                                matchesGameScope(event.gameId, args.game) &&
                                (args.resource === "event-summaries" ||
                                    (event.kind ?? "match") === "match")
                        )
                        .map((event) =>
                            args.resource === "result-summaries"
                                ? projectResultSummary(event)
                                : args.resource === "event-summaries"
                                  ? projectEventSummary(event)
                                  : projectMatchSummary(event)
                        ),
                    nextCursor: result.isDone ? null : result.continueCursor,
                    limit: args.limit,
                }
            }
            case "events":
                return await pageFor(
                    args.updatedSince
                        ? ctx.db
                              .query("events")
                              .withIndex("guildId", (q) =>
                                  q.eq("guildId", guildId)
                              )
                              .filter((q) =>
                                  q.gte(
                                      q.field("updatedAt"),
                                      args.updatedSince!
                                  )
                              )
                        : ctx.db
                              .query("events")
                              .withIndex("guildId", (q) =>
                                  q.eq("guildId", guildId)
                              )
                )
            case "groups":
                return await pageFor(
                    args.updatedSince
                        ? ctx.db
                              .query("groups")
                              .withIndex("guildId", (q) =>
                                  q.eq("guildId", guildId)
                              )
                              .filter((q) =>
                                  q.gte(
                                      q.field("updatedAt"),
                                      args.updatedSince!
                                  )
                              )
                        : ctx.db
                              .query("groups")
                              .withIndex("guildId", (q) =>
                                  q.eq("guildId", guildId)
                              )
                )
            case "assignments":
                return await pageFor(
                    args.updatedSince
                        ? ctx.db
                              .query("userAssignments")
                              .withIndex("serverId", (q) =>
                                  q.eq("serverId", guildId)
                              )
                              .filter((q) =>
                                  q.gte(
                                      q.field("updatedAt"),
                                      args.updatedSince!
                                  )
                              )
                        : ctx.db
                              .query("userAssignments")
                              .withIndex("serverId", (q) =>
                                  q.eq("serverId", guildId)
                              )
                )
            case "calendar-items":
                return await pageFor(
                    args.updatedSince
                        ? ctx.db
                              .query("calendarItems")
                              .withIndex("guildId", (q) =>
                                  q.eq("guildId", guildId)
                              )
                              .filter((q) =>
                                  q.gte(
                                      q.field("updatedAt"),
                                      args.updatedSince!
                                  )
                              )
                        : ctx.db
                              .query("calendarItems")
                              .withIndex("guildId", (q) =>
                                  q.eq("guildId", guildId)
                              )
                )
            case "stratmaps":
                return await pageFor(
                    args.updatedSince
                        ? ctx.db
                              .query("stratmaps")
                              .withIndex("guildId", (q) =>
                                  q.eq("guildId", guildId)
                              )
                              .filter((q) =>
                                  q.gte(
                                      q.field("updatedAt"),
                                      args.updatedSince!
                                  )
                              )
                        : ctx.db
                              .query("stratmaps")
                              .withIndex("guildId", (q) =>
                                  q.eq("guildId", guildId)
                              )
                )
            case "topic-presets":
                return await pageFor(
                    args.updatedSince
                        ? ctx.db
                              .query("topicPresets")
                              .withIndex("guildId", (q) =>
                                  q.eq("guildId", guildId)
                              )
                              .filter((q) =>
                                  q.gte(
                                      q.field("updatedAt"),
                                      args.updatedSince!
                                  )
                              )
                        : ctx.db
                              .query("topicPresets")
                              .withIndex("guildId", (q) =>
                                  q.eq("guildId", guildId)
                              )
                )
            case "squad-presets":
                return await pageFor(
                    args.updatedSince
                        ? ctx.db
                              .query("squadPresets")
                              .withIndex("guildId", (q) =>
                                  q.eq("guildId", guildId)
                              )
                              .filter((q) =>
                                  q.gte(
                                      q.field("updatedAt"),
                                      args.updatedSince!
                                  )
                              )
                        : ctx.db
                              .query("squadPresets")
                              .withIndex("guildId", (q) =>
                                  q.eq("guildId", guildId)
                              )
                )
            case "matches":
                return await pageFor(
                    args.updatedSince
                        ? ctx.db
                              .query("matchStats")
                              .withIndex("guildId", (q) =>
                                  q.eq("guildId", guildId)
                              )
                              .filter((q) =>
                                  q.gte(
                                      q.field("updatedAt"),
                                      args.updatedSince!
                                  )
                              )
                        : ctx.db
                              .query("matchStats")
                              .withIndex("guildId", (q) =>
                                  q.eq("guildId", guildId)
                              )
                )
            case "articles":
                return await pageFor(
                    args.updatedSince
                        ? ctx.db
                              .query("articles")
                              .withIndex("guildId", (q) =>
                                  q.eq("guildId", guildId)
                              )
                              .filter((q) =>
                                  q.gte(
                                      q.field("updatedAt"),
                                      args.updatedSince!
                                  )
                              )
                        : ctx.db
                              .query("articles")
                              .withIndex("guildId", (q) =>
                                  q.eq("guildId", guildId)
                              )
                )
            case "rosters": {
                const rosterPage = await (
                    args.updatedSince
                        ? ctx.db
                              .query("rosters")
                              .withIndex("guildId_updatedAt", (q) =>
                                  q
                                      .eq("guildId", guildId)
                                      .gte("updatedAt", args.updatedSince!)
                              )
                        : ctx.db
                              .query("rosters")
                              .withIndex("guildId_updatedAt", (q) =>
                                  q.eq("guildId", guildId)
                              )
                ).paginate(options)
                const events = await Promise.all(
                    rosterPage.page.map((roster) => ctx.db.get(roster.eventId))
                )
                return {
                    items: rosterPage.page.flatMap((roster, index) => {
                        const event = events[index]
                        if (
                            !event ||
                            event.guildId !== guildId ||
                            !belongsToGame(event as never, args.game)
                        )
                            return []
                        return [
                            {
                                ...apiDocument(roster),
                                gameId: resolveGameScope(event.gameId),
                            },
                        ]
                    }),
                    nextCursor: rosterPage.isDone
                        ? null
                        : rosterPage.continueCursor,
                    limit: args.limit,
                }
            }
            case "users": {
                const projectionPage = await (
                    args.updatedSince
                        ? ctx.db
                              .query("clanApiUserProjections")
                              .withIndex("guildId_updatedAt", (q) =>
                                  q
                                      .eq("guildId", guildId)
                                      .gte("updatedAt", args.updatedSince!)
                              )
                        : ctx.db
                              .query("clanApiUserProjections")
                              .withIndex("guildId_updatedAt", (q) =>
                                  q.eq("guildId", guildId)
                              )
                ).paginate(options)
                const users = await Promise.all(
                    projectionPage.page.map((projection) =>
                        ctx.db
                            .query("users")
                            .withIndex("discordId", (q) =>
                                q.eq("discordId", projection.userId)
                            )
                            .unique()
                    )
                )
                return {
                    items: users
                        .filter(Boolean)
                        .map((user) => apiDocument(user!)),
                    nextCursor: projectionPage.isDone
                        ? null
                        : projectionPage.continueCursor,
                    limit: args.limit,
                }
            }
        }
    },
})

/** Returns a single record only after proving its direct or parent ownership. */
export const getClanResource = query({
    args: {
        secret: v.string(),
        keyHash: v.string(),
        resource: apiResource,
        id: v.string(),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const key = await ctx.db
            .query("apiKeys")
            .withIndex("keyHash", (q) => q.eq("keyHash", args.keyHash))
            .unique()
        if (!key || key.revokedAt) return null
        if (!allowsApiKeyRead(key.readAccess, args.resource)) return null
        if (
            args.resource === "server-snapshots" ||
            args.resource === "integration-health"
        ) {
            const id = ctx.db.normalizeId("gameDataConnections", args.id)
            const row = id ? await ctx.db.get(id) : null
            if (
                !row ||
                row.guildId !== key.guildId ||
                !allowsApiKeyRead(key.readAccess, args.resource, row.gameId)
            )
                return null
            return (
                args.resource === "server-snapshots"
                    ? projectSnapshot
                    : projectHealth
            )({ ...row, id: String(row._id) }, Date.now())
        }
        if (
            args.resource === "event-summaries" ||
            args.resource === "result-summaries" ||
            args.resource === "match-summaries"
        ) {
            const eventId = ctx.db.normalizeId("events", args.id)
            if (!eventId) return null
            const event = await ctx.db.get(eventId)
            if (
                !event ||
                event.guildId !== key.guildId ||
                isDraftEvent(event) ||
                !allowsApiKeyRead(
                    key.readAccess,
                    args.resource,
                    resolveGameScope(event.gameId)
                ) ||
                ((args.resource === "match-summaries" ||
                    args.resource === "result-summaries") &&
                    (event.kind ?? "match") !== "match")
            )
                return null
            return args.resource === "result-summaries"
                ? projectResultSummary(event)
                : args.resource === "event-summaries"
                  ? projectEventSummary(event)
                  : projectMatchSummary(event)
        }
        const item = (await ctx.db.get(args.id as never)) as
            (Record<string, unknown> & { _id: unknown }) | null
        if (!item) return null
        if (!isClanApiResourceDocument(args.resource, item)) return null
        const guildId = key.guildId
        // Rosters inherit game ownership from their event, including records
        // whose own guildId was populated by the read-projection migration.
        if (args.resource === "rosters") {
            const event = await ctx.db.get(item.eventId as Id<"events">)
            if (
                !event ||
                event.guildId !== guildId ||
                (item.guildId !== undefined && item.guildId !== guildId) ||
                !allowsApiKeyRead(
                    key.readAccess,
                    args.resource,
                    resolveGameScope(event.gameId)
                )
            )
                return null
            return {
                ...apiDocument(item),
                gameId: resolveGameScope(event.gameId),
            }
        }
        const itemGame = item.gameId
        if (
            itemGame !== undefined &&
            (typeof itemGame !== "string" || !isGameId(itemGame))
        )
            return null
        if (
            !allowsApiKeyRead(
                key.readAccess,
                args.resource,
                resolveGameScope(itemGame)
            )
        )
            return null
        const directGuildId =
            typeof item.guildId === "string"
                ? item.guildId
                : typeof item.serverId === "string"
                  ? item.serverId
                  : undefined
        if (directGuildId !== guildId) {
            if (args.resource === "users") {
                const userId =
                    typeof item.discordId === "string"
                        ? item.discordId
                        : typeof item.id === "string"
                          ? item.id
                          : ""
                const assignment = await ctx.db
                    .query("userAssignments")
                    .withIndex("serverId", (q) => q.eq("serverId", guildId))
                    .filter((q) => q.eq(q.field("userId"), userId))
                    .first()
                if (!assignment) return null
            } else return null
        }
        return [
            "events",
            "groups",
            "rosters",
            "assignments",
            "stratmaps",
            "matches",
        ].includes(args.resource)
            ? apiGameDocument(item)
            : apiDocument(item)
    },
})
