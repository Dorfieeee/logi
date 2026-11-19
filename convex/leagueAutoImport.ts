import {
    autoImportSettingsSchema,
    teamFixtureSchema,
    importedFieldsSchema,
    matchFixtureTeams,
    ownTeamFirst,
    fixtureFields,
} from "../src/domain/wardogs-league/team-api"
import {
    ConvexEventCommandRepository,
    DelegatingEventScorePort,
} from "../src/infrastructure/convex/event-command-repositories"
import {
    defaultMatchTemplate,
    resolveMatchDefaults,
} from "../src/domain/events/match-templates"
import { ImportTeamFixtureUseCase } from "../src/application/wardogs-league/import-team-fixture"
import { syncEventAssetReferences } from "../src/infrastructure/convex/event-asset-references"
import { bindWardogsFixture } from "../src/infrastructure/convex/league-fixture-binding"
import { credentialEnvelopeSchema } from "../src/domain/game-data/credentials.schema"
import { UpsertEventUseCase } from "../src/application/events/upsert-event.use-case"
import { refreshEventSchedule } from "../src/infrastructure/convex/event-scheduling"
import { sameKickoffCandidates } from "../src/domain/wardogs-league/fixture-link"
import { matchTemplateSchema } from "../src/lib/validation/match-templates"
import { matchTeamAssignmentSchema } from "../src/domain/teams/match-teams"
import { authorizeDashboardAdmin, dashboardActor } from "./dashboardActor"
import { loadEventDiscussionDefaults } from "./eventDiscussionSettings"
import { templatesFor } from "../src/domain/events/match-templates"
import { currentEventStatus } from "../src/domain/events/status"
import { withGameOverrides } from "../src/domain/games/game"
import { query, internalQuery } from "./_generated/server"
import { systemClock } from "../src/domain/shared/clock"
import { internalMutation } from "./integrationMutation"
import { gwlDelay } from "../src/domain/gwl/contracts"
import { trackedMatch } from "./leagueTrackingStore"
import type { QueryCtx } from "./_generated/server"
import { assetPublicUrl } from "./imageAssetStore"
import { getGuildByDiscordId } from "./identity"
import { mutation } from "./_generated/server"
import { v } from "convex/values"
import { z } from "zod"

const access = {
    secret: v.string(),
    guildId: v.string(),
    actor: dashboardActor,
}
const configFor = (ctx: Pick<QueryCtx, "db">, guildId: string) =>
    ctx.db
        .query("leagueAutoImportSettings")
        .withIndex("guildId", (q) => q.eq("guildId", guildId))
        .unique()
export const read = query({
    args: access,
    handler: async (ctx, args) => {
        const { server } = await authorizeDashboardAdmin(ctx, args)
        const config = await configFor(ctx, args.guildId)
        const discord = await ctx.db
            .query("discordConfigs")
            .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
            .unique()
        const scoped = discord
            ? withGameOverrides(discord, discord.gameOverrides, "wardogs")
            : null
        const linked = await ctx.db
            .query("teamDirectory")
            .withIndex("linkedGuildId", (q) =>
                q.eq("linkedGuildId", args.guildId)
            )
            .take(20)
        const ownTeams = linked.filter(
            (t) => t.gameId === "wardogs" && !t.archivedAt
        )
        const records = await ctx.db
            .query("leagueAutoImportFixtures")
            .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
            .order("desc")
            .take(100)
        return {
            settings: config
                ? {
                      ...autoImportSettingsSchema.parse(
                          JSON.parse(config.settingsJson)
                      ),
                      enabled: config.enabled,
                  }
                : null,
            defaults: {
                teamCode:
                    ownTeams.length === 1 ? (ownTeams[0].shortCode ?? "") : "",
                announcementChannelId: scoped?.announcementsChannelId ?? "",
                eventInfoChannelId: scoped?.eventInfoChannelId ?? "",
                eventResultsChannelId: discord?.eventResultsChannelId ?? "",
            },
            hasKey: Boolean(config),
            provider: config?.provider ?? "legacy",
            testMode: config?.testMode ?? false,
            lastSuccessAt: config?.lastSuccessAt ?? null,
            error: config?.error ?? null,
            templates: templatesFor(server.matchTemplates, "match", "wardogs"),
            available: server.enabledGames?.includes("wardogs") ?? false,
            records: records.map((r) => ({
                fixtureId: r.fixtureId,
                eventId: r.eventId ?? null,
                issue: r.issue ?? null,
                resultState: r.resultState ?? null,
                statsState: r.statsState ?? null,
            })),
        }
    },
})
export const save = mutation({
    args: {
        ...access,
        settingsJson: v.string(),
        credentialJson: v.optional(v.string()),
        provider: v.optional(v.literal("gwl")),
        testMode: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const { server } = await authorizeDashboardAdmin(ctx, args)
        if (!server.enabledGames?.includes("wardogs"))
            throw new Error("Wardogs is not enabled.")
        const settings = autoImportSettingsSchema.parse(
            JSON.parse(args.settingsJson)
        )
        const template =
            settings.templateId === "__defaults"
                ? (resolveMatchDefaults(
                      server.matchTemplates ?? [],
                      "wardogs"
                  ) ?? defaultMatchTemplate("__defaults", "GWL"))
                : templatesFor(server.matchTemplates, "match", "wardogs").find(
                      (t) => t.id === settings.templateId
                  )
        if (settings.enabled && settings.autoCreate && !template)
            throw new Error("Select a Wardogs match template.")
        if (
            template &&
            settings.registrationHoursBeforeStart * 60 <=
                template.meetingMinutesBeforeStart +
                    template.registrationHoursBeforeMeeting * 60
        )
            throw new Error("Registration must open before it closes.")
        const old = await configFor(ctx, args.guildId)
        const credentialJson = args.credentialJson ?? old?.credentialJson
        if (!credentialJson) throw new Error("Provide a Wardogs API key.")
        credentialEnvelopeSchema.parse(JSON.parse(credentialJson))
        const value = {
            guildId: args.guildId,
            settingsJson: JSON.stringify(settings),
            credentialJson,
            enabled: settings.enabled,
            revision: (old?.revision ?? 0) + 1,
            provider: args.provider ?? old?.provider,
            testMode: args.testMode ?? old?.testMode,
            cursor: args.credentialJson ? 0 : old?.cursor,
            reconcileAt: args.credentialJson ? 0 : old?.reconcileAt,
            nextPollAt: Date.now() + gwlDelay(args.guildId),
            leaseUntil: 0,
            fence: (old?.fence ?? 0) + 1,
            error: undefined,
        }
        if (old) await ctx.db.patch(old._id, value)
        else await ctx.db.insert("leagueAutoImportSettings", value)
        return { ok: true }
    },
})
export const claim = internalMutation({
    args: {},
    handler: async (ctx) => {
        const now = Date.now()
        const rows = await ctx.db
            .query("leagueAutoImportSettings")
            .withIndex("due", (q) =>
                q.eq("enabled", true).lte("nextPollAt", now)
            )
            .take(20)
        const row = rows.find(
            (r) => r.provider === "gwl" && !r.testMode && r.leaseUntil <= now
        )
        if (!row) return null
        const guild = await getGuildByDiscordId(ctx, row.guildId)
        if (!guild?.enabledGames?.includes("wardogs")) {
            await ctx.db.patch(row._id, { enabled: false })
            return null
        }
        const fence = row.fence + 1
        await ctx.db.patch(row._id, {
            fence,
            leaseUntil: now + 5 * 60_000,
            nextPollAt: now + 15 * 60_000 + gwlDelay(row.guildId, 60_000),
        })
        return { ...row, fence }
    },
})
export const finish = internalMutation({
    args: {
        id: v.id("leagueAutoImportSettings"),
        fence: v.number(),
        revision: v.number(),
        error: v.optional(v.string()),
        retryAt: v.optional(v.number()),
        cursor: v.optional(v.number()),
        reconcileAt: v.optional(v.number()),
        reconcileOffset: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const row = await ctx.db.get(args.id)
        if (!row || row.fence !== args.fence || row.revision !== args.revision)
            return
        await ctx.db.patch(row._id, {
            leaseUntil: 0,
            ...([
                "invalid_key",
                "key_revoked",
                "key_expired",
                "missing_scope",
                "scope_lost",
                "team_suspended",
                "key_maker_left",
                "key_maker_no_access",
                "wrong_key_type",
            ].includes(args.error ?? "")
                ? { enabled: false }
                : {}),
            error: args.error,
            ...(args.retryAt ? { nextPollAt: args.retryAt } : {}),
            ...(args.cursor !== undefined ? { cursor: args.cursor } : {}),
            ...(args.reconcileOffset !== undefined
                ? { reconcileOffset: args.reconcileOffset }
                : {}),
            ...(args.reconcileAt !== undefined
                ? { reconcileAt: args.reconcileAt }
                : {}),
            ...(!args.error ? { lastSuccessAt: Date.now() } : {}),
        })
    },
})
export const importFixture = internalMutation({
    args: {
        id: v.id("leagueAutoImportSettings"),
        fence: v.number(),
        revision: v.number(),
        fixtureJson: v.string(),
    },
    handler: async (ctx, args) => {
        const config = await ctx.db.get(args.id)
        if (
            !config?.enabled ||
            config.fence !== args.fence ||
            config.revision !== args.revision ||
            config.leaseUntil < Date.now()
        )
            return
        const defaults = autoImportSettingsSchema.parse(
            JSON.parse(config.settingsJson)
        )
        const guild = await getGuildByDiscordId(ctx, config.guildId)
        if (!guild?.enabledGames?.includes("wardogs")) return
        let fixture = teamFixtureSchema.parse(JSON.parse(args.fixtureJson))
        const old = await ctx.db
            .query("leagueAutoImportFixtures")
            .withIndex("identity", (q) =>
                q.eq("guildId", config.guildId).eq("fixtureId", fixture.id)
            )
            .unique()
        const settings = old?.settingsJson
            ? autoImportSettingsSchema.parse(JSON.parse(old.settingsJson))
            : defaults
        fixture = ownTeamFirst(fixture, settings.teamCode) ?? fixture
        const guildAliases = [
            ...new Set([
                config.guildId,
                String(guild._id),
                ...(guild.id ? [guild.id] : []),
            ]),
        ]
        const tracked = await trackedMatch(ctx, config.guildId, fixture.id)
        const current = old?.eventId ? await ctx.db.get(old.eventId) : null
        if (current?.hostEventId) return
        if (
            current &&
            (!guildAliases.includes(current.guildId) ||
                current.gameId !== "wardogs" ||
                (current.kind ?? "match") !== "match")
        )
            throw new Error("Imported match scope mismatch.")
        if (!old && !defaults.autoCreate) return
        const selectedTemplate = old?.templateJson
            ? matchTemplateSchema.parse(JSON.parse(old.templateJson))
            : settings.templateId === "__defaults"
              ? (resolveMatchDefaults(guild.matchTemplates ?? [], "wardogs") ??
                defaultMatchTemplate("__defaults", "GWL"))
              : templatesFor(guild.matchTemplates, "match", "wardogs").find(
                    (t) => t.id === settings.templateId
                )
        const template =
            selectedTemplate?.isDefault && !old?.templateJson
                ? (resolveMatchDefaults(
                      guild.matchTemplates ?? [],
                      "wardogs"
                  ) ?? selectedTemplate)
                : selectedTemplate
        if (!template) throw new Error("Default match template is missing.")
        const catalogue = await ctx.db
            .query("teamDirectory")
            .withIndex("gameId_archivedAt_normalizedName", (q) =>
                q.eq("gameId", "wardogs").eq("archivedAt", null)
            )
            .take(2000)
        const teams = matchFixtureTeams(
            fixture,
            await Promise.all(
                catalogue
                    .filter((t) =>
                        fixture.participants.some(
                            (p) =>
                                p.team.code.toLowerCase() ===
                                    t.shortCode?.toLowerCase() ||
                                p.team.name.toLowerCase() ===
                                    t.name.toLowerCase()
                        )
                    )
                    .map(async (t) => ({
                        id: String(t._id),
                        ...t,
                        logoAssetId: t.logoAssetId
                            ? String(t.logoAssetId)
                            : null,
                        logoUrl: await assetPublicUrl(ctx, t.logoAssetId),
                    }))
            ),
            current?.matchTeams,
            new Date().toISOString()
        )
        const groups = await ctx.db
            .query("groups")
            .withIndex("guildId_gameId", (q) =>
                q.eq("guildId", config.guildId).eq("gameId", "wardogs")
            )
            .collect()
        const repository = new ConvexEventCommandRepository(ctx)
        await new ImportTeamFixtureUseCase({
            findScheduledMatch: async (gameStart) => {
                const rows = (
                    await Promise.all(
                        guildAliases.map((guildId) =>
                            ctx.db
                                .query("events")
                                .withIndex("guildId_gameId", (q) =>
                                    q
                                        .eq("guildId", guildId)
                                        .eq("gameId", "wardogs")
                                )
                                .take(2001)
                        )
                    )
                ).flat()
                if (rows.length > 2000)
                    return { kind: "review", issue: "matching_scan_limit" }
                const matches = sameKickoffCandidates(
                    rows.map((row) => ({
                        ...row,
                        status: currentEventStatus(row),
                    })),
                    gameStart
                )
                if (matches.length > 1)
                    return { kind: "review", issue: "ambiguous_game_start" }
                if (!matches.length) return { kind: "none" }
                const candidate = matches[0]
                const bound = await ctx.db
                    .query("leagueAutoImportFixtures")
                    .withIndex("eventId", (q) => q.eq("eventId", candidate._id))
                    .unique()
                const trackedBinding = await ctx.db
                    .query("leagueTrackedMatches")
                    .withIndex("event", (q) =>
                        q
                            .eq("guildId", config.guildId)
                            .eq("eventId", String(candidate._id))
                    )
                    .unique()
                if (
                    (candidate.wardogsFixtureUrl &&
                        candidate.wardogsFixtureUrl !==
                            (fixture.sourceUrl ??
                                `https://wardogsleague.net/matches/${fixture.id}`)) ||
                    (bound && bound.fixtureId !== fixture.id) ||
                    (trackedBinding && trackedBinding.matchId !== fixture.id)
                )
                    return { kind: "review", issue: "kickoff_already_linked" }
                return { kind: "match", eventId: String(candidate._id) }
            },
            create: async (command) => {
                for (const [table, id] of [
                    ["squadPresets", template.squadPresetId],
                    ["topicPresets", template.topicPresetId],
                ] as const) {
                    if (!id) continue
                    const presetId = ctx.db.normalizeId(table, id)
                    const preset = presetId ? await ctx.db.get(presetId) : null
                    if (
                        !preset ||
                        preset.guildId !== config.guildId ||
                        ("gameId" in preset &&
                            preset.gameId &&
                            preset.gameId !== "wardogs")
                    )
                        throw new Error("Invalid template preset.")
                }
                return new UpsertEventUseCase(
                    repository,
                    new DelegatingEventScorePort(async () => {
                        throw new Error("Creation cannot score signups.")
                    }),
                    systemClock
                ).execute(command)
            },
            update: (id, patch) => repository.update(id, patch),
            link: async (id) => {
                const eventId = ctx.db.normalizeId("events", id)
                if (!eventId) throw new Error("Invalid match ID.")
                await bindWardogsFixture(
                    ctx,
                    eventId,
                    fixture.sourceUrl ??
                        `https://wardogsleague.net/matches/${fixture.id}`
                )
            },
            refreshSchedule: async (id) => {
                const normalized = ctx.db.normalizeId("events", id)
                if (!normalized) throw new Error("Invalid imported event ID.")
                const saved = await ctx.db.get(normalized)
                if (saved) await syncEventAssetReferences(ctx, saved)
                await refreshEventSchedule(ctx, normalized)
            },
            save: async (value) => {
                const eventId = value.eventId
                    ? ctx.db.normalizeId("events", value.eventId)
                    : null
                if (value.eventId && !eventId)
                    throw new Error("Invalid imported event ID.")
                const patch = {
                    issue: value.issue,
                    ...(eventId ? { eventId } : {}),
                    ...(value.baseline
                        ? { baselineJson: JSON.stringify(value.baseline) }
                        : {}),
                    ...(value.teamsBaseline
                        ? {
                              teamBaselineJson: JSON.stringify(
                                  value.teamsBaseline
                              ),
                          }
                        : {}),
                    ...(value.template
                        ? {
                              templateJson:
                                  old?.templateJson ??
                                  JSON.stringify(value.template),
                          }
                        : {}),
                    ...(value.settings
                        ? {
                              settingsJson:
                                  old?.settingsJson ??
                                  JSON.stringify(value.settings),
                          }
                        : {}),
                    ...(value.overrides ? { overrides: value.overrides } : {}),
                    ...(value.changed ? { cachePending: true } : {}),
                    updatedAt: Date.now(),
                }
                const stored = await ctx.db
                    .query("leagueAutoImportFixtures")
                    .withIndex("identity", (q) =>
                        q
                            .eq("guildId", config.guildId)
                            .eq("fixtureId", fixture.id)
                    )
                    .unique()
                if (stored) await ctx.db.patch(stored._id, patch)
                else
                    await ctx.db.insert("leagueAutoImportFixtures", {
                        guildId: config.guildId,
                        fixtureId: fixture.id,
                        overrides: [],
                        ...patch,
                    })
            },
        }).execute({
            guildId: config.guildId,
            fixture,
            template,
            settings,
            now: Date.now(),
            current: current
                ? {
                      ...current,
                      guildId: config.guildId,
                      status: currentEventStatus(current),
                  }
                : null,
            previous: old
                ? {
                      eventId: old.eventId ? String(old.eventId) : undefined,
                      baseline: old.baselineJson
                          ? importedFieldsSchema.parse(
                                JSON.parse(old.baselineJson)
                            )
                          : fixture.sourceUrl?.startsWith("https://gwl.gg/")
                            ? fixtureFields(fixture, template, settings)
                            : undefined,
                      teamsBaseline: old.teamBaselineJson
                          ? z
                                .array(matchTeamAssignmentSchema)
                                .parse(JSON.parse(old.teamBaselineJson))
                          : undefined,
                      overrides: old.overrides,
                  }
                : undefined,
            manuallyManaged: Boolean(
                (old?.eventId &&
                    !old.baselineJson &&
                    !fixture.sourceUrl?.startsWith("https://gwl.gg/")) ||
                tracked?.ignored ||
                tracked?.paused ||
                (tracked?.eventId && tracked.eventId !== old?.eventId)
            ),
            assignments: teams.assignments,
            unmatched: teams.unmatched.length > 0,
            offeredGroupIds: groups.map((g) => String(g._id)),
            discussion: await loadEventDiscussionDefaults(
                ctx,
                config.guildId,
                "wardogs"
            ),
        })
    },
})

export const pendingCache = internalQuery({
    args: {},
    handler: (ctx) =>
        ctx.db
            .query("leagueAutoImportFixtures")
            .withIndex("cachePending", (q) => q.eq("cachePending", true))
            .take(30),
})
export const acknowledgeCache = internalMutation({
    args: { id: v.id("leagueAutoImportFixtures"), updatedAt: v.number() },
    handler: async (ctx, args) => {
        const row = await ctx.db.get(args.id)
        if (row?.updatedAt === args.updatedAt)
            await ctx.db.patch(row._id, { cachePending: false })
    },
})

export const credential = internalQuery({
    args: { guildId: v.string() },
    handler: async (ctx, args) => {
        const config = await configFor(ctx, args.guildId)
        return config?.credentialJson ?? null
    },
})
export const previewTeams = internalQuery({
    args: { fixtureJson: v.string() },
    handler: async (ctx, args) => {
        const fixture = teamFixtureSchema.parse(JSON.parse(args.fixtureJson))
        const rows = await ctx.db
            .query("teamDirectory")
            .withIndex("gameId_archivedAt_normalizedName", (q) =>
                q.eq("gameId", "wardogs").eq("archivedAt", null)
            )
            .take(2000)
        const candidates = rows.filter((t) =>
            fixture.participants.some(
                (p) =>
                    p.team.code.toLowerCase() === t.shortCode?.toLowerCase() ||
                    p.team.name.toLowerCase() === t.name.toLowerCase()
            )
        )
        return matchFixtureTeams(
            fixture,
            await Promise.all(
                candidates.map(async (t) => ({
                    ...t,
                    id: String(t._id),
                    logoAssetId: t.logoAssetId ? String(t.logoAssetId) : null,
                    logoUrl: await assetPublicUrl(ctx, t.logoAssetId),
                }))
            ),
            [],
            new Date().toISOString()
        ).assignments
    },
})
