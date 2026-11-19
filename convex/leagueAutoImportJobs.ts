"use node"
import {
    gwlTeamSchema,
    gwlFixturesSchema,
    gwlSlotsSchema,
    gwlEventsSchema,
    gwlMatchSchema,
    gwlFileSchema,
} from "../src/domain/gwl/contracts"
import {
    parseKeyring,
    encryptCredential,
    decryptCredential,
} from "../src/infrastructure/game-data/credential-cipher"
import {
    credentialEnvelopeSchema,
    providerKeySchema,
} from "../src/domain/game-data/credentials.schema"
import { autoImportSettingsSchema } from "../src/domain/wardogs-league/team-api"
import { gwlSaveFailure } from "../src/infrastructure/gwl/save-errors"
import { ownTeamFirst } from "../src/domain/wardogs-league/team-api"
import { gwlGet, GwlError } from "../src/infrastructure/gwl/client"
import { gwlSession, gwlFixture } from "../src/domain/gwl/mapping"
import { matchUrl } from "../src/domain/wardogs-league/match-url"
import { internalAction, action } from "./_generated/server"
import { syncGwl } from "../src/application/gwl/sync"
import { makeFunctionReference } from "convex/server"
import type { ActionCtx } from "./_generated/server"
import type { Doc } from "./_generated/dataModel"
import { dashboardActor } from "./dashboardActor"
import { ConvexError, v } from "convex/values"
import { createHash } from "node:crypto"
import { z } from "zod"

export const save = action({
    args: {
        secret: v.string(),
        guildId: v.string(),
        actor: dashboardActor,
        settingsJson: v.string(),
        apiKey: v.optional(v.string()),
    },
    handler: async (ctx, args): Promise<{ ok: true }> => {
        const { apiKey, ...input } = args
        // Authorize before contacting the provider; the mutation checks authority again.
        const existing = await ctx.runQuery(
            makeFunctionReference<"query">("leagueAutoImport:read"),
            { secret: args.secret, guildId: args.guildId, actor: args.actor }
        )
        try {
            const settings = autoImportSettingsSchema.parse(
                JSON.parse(args.settingsJson)
            )
            if (!apiKey && existing.testMode && settings.enabled)
                throw new GwlError("test_key_cannot_sync_live_data")
            let testMode: boolean | undefined
            let credentialJson: string | undefined
            if (apiKey) {
                const key = providerKeySchema.parse(apiKey)
                const keyring = parseKeyring(
                    process.env.LOGI_CREDENTIAL_KEYRING
                )
                if (!keyring)
                    throw new Error("Credential encryption is not configured.")
                const team = await gwlGet(key, "/team", gwlTeamSchema)
                if (!team.data) throw new GwlError("empty_response")
                testMode = team.test
                if (testMode && settings.enabled)
                    throw new GwlError("test_key_cannot_sync_live_data")
                if (
                    existing.records.length &&
                    existing.settings?.teamCode &&
                    existing.settings.teamCode !== team.data.slug &&
                    existing.provider === "gwl"
                )
                    throw new GwlError("team_change_requires_unlinking")
                settings.teamCode = team.data.slug
                const fixtures = await gwlGet(
                    key,
                    "/team/fixtures?limit=1",
                    gwlFixturesSchema
                )
                await gwlGet(key, "/team/events?limit=1", gwlEventsSchema)
                if (settings.autoCreate)
                    await gwlGet(key, "/team/slots", gwlSlotsSchema)
                try {
                    await gwlGet(
                        key,
                        `/team/matches/${fixtures.data?.recent[0]?.number ?? fixtures.data?.upcoming[0]?.number ?? "1"}/file`,
                        gwlFileSchema
                    )
                } catch (error) {
                    if (!(
                        error instanceof GwlError && error.code === "not_found"
                    ))
                        throw error
                }
                credentialJson = JSON.stringify(
                    encryptCredential(
                        keyring,
                        key,
                        `wardogs-team-fixtures:${args.guildId}`
                    )
                )
            }
            if (!apiKey && existing.settings && existing.provider === "gwl")
                settings.teamCode = existing.settings.teamCode
            await ctx.runMutation(
                makeFunctionReference<"mutation">("leagueAutoImport:save"),
                {
                    ...input,
                    settingsJson: JSON.stringify(settings),
                    credentialJson,
                    ...(apiKey ? { provider: "gwl", testMode } : {}),
                }
            )
            return { ok: true }
        } catch (error) {
            throw new ConvexError(gwlSaveFailure(error))
        }
    },
})
export const collectDue = internalAction({
    args: {},
    handler: async (ctx) => {
        for (let n = 0; n < 5; n++) {
            const config: Doc<"leagueAutoImportSettings"> | null =
                await ctx.runMutation(
                    makeFunctionReference<"mutation">("leagueAutoImport:claim"),
                    {}
                )
            if (!config) break
            const claim = {
                id: config._id,
                fence: config.fence,
                revision: config.revision,
            }
            let error: string | undefined
            try {
                const key = decryptCredential(
                    parseKeyring(process.env.LOGI_CREDENTIAL_KEYRING),
                    credentialEnvelopeSchema.parse(
                        JSON.parse(config.credentialJson)
                    ),
                    `wardogs-team-fixtures:${config.guildId}`
                )
                const read = createReader(ctx, config, key)
                const settings = autoImportSettingsSchema.parse(
                    JSON.parse(config.settingsJson)
                )
                const own = await read("/team", gwlTeamSchema)
                if (own.slug !== settings.teamCode)
                    throw new GwlError("team_scope_mismatch")
                const progress = await syncGwl(
                    {
                        cursor: config.cursor ?? 0,
                        reconcileOffset: config.reconcileOffset ?? 0,
                        reconcile: (config.reconcileAt ?? 0) <= Date.now(),
                        now: Date.now(),
                        autoCreate: settings.autoCreate,
                        own,
                    },
                    {
                        read,
                        importFixture: async (fixture) => {
                            await ctx.runMutation(
                                makeFunctionReference<"mutation">(
                                    "leagueAutoImport:importFixture"
                                ),
                                {
                                    ...claim,
                                    fixtureJson: JSON.stringify(fixture),
                                }
                            )
                        },
                        promote: (match) =>
                            ctx.runMutation(
                                makeFunctionReference<"mutation">(
                                    "gwlSyncStore:promote"
                                ),
                                {
                                    configId: config._id,
                                    matchJson: JSON.stringify(match),
                                }
                            ),
                        remember: async (fixtureId, value) => {
                            await ctx.runMutation(
                                makeFunctionReference<"mutation">(
                                    "gwlSyncStore:remember"
                                ),
                                { guildId: config.guildId, fixtureId, ...value }
                            )
                        },
                        flag: async (fixtureId, issue) => {
                            await ctx.runMutation(
                                makeFunctionReference<"mutation">(
                                    "gwlSyncStore:flag"
                                ),
                                { guildId: config.guildId, fixtureId, issue }
                            )
                        },
                        records: () =>
                            ctx.runQuery(
                                makeFunctionReference<"query">(
                                    "gwlSyncStore:records"
                                ),
                                { guildId: config.guildId }
                            ),
                        result: async (match, file) => {
                            let payload: {
                                sessionJson?: string
                                fileStorageId?: Doc<"leagueAutoImportFixtures">["fileStorageId"]
                            } = {}
                            if (file) {
                                const parsed = gwlFileSchema.parse(file)
                                const raw = JSON.stringify(parsed)
                                const digest = createHash("sha256")
                                    .update(raw)
                                    .digest("hex")
                                const records: Doc<"leagueAutoImportFixtures">[] =
                                    await ctx.runQuery(
                                        makeFunctionReference<"query">(
                                            "gwlSyncStore:records"
                                        ),
                                        { guildId: config.guildId }
                                    )
                                const existing = records.find(
                                    (row) => row.fixtureId === match.number
                                )
                                const storageId =
                                    existing?.fileDigest === digest
                                        ? existing.fileStorageId
                                        : await ctx.storage.store(
                                              new Blob([raw], {
                                                  type: "application/json",
                                              })
                                          )
                                payload = {
                                    sessionJson: JSON.stringify(
                                        gwlSession(parsed, digest)
                                    ),
                                    fileStorageId: storageId,
                                }
                            }
                            await ctx.runMutation(
                                makeFunctionReference<"mutation">(
                                    "gwlResults:apply"
                                ),
                                {
                                    ...claim,
                                    matchJson: JSON.stringify(match),
                                    ...payload,
                                }
                            )
                        },
                    }
                )
                await ctx.runMutation(
                    makeFunctionReference<"mutation">(
                        "leagueAutoImport:finish"
                    ),
                    { ...claim, ...progress }
                )
            } catch (failure) {
                error =
                    failure instanceof GwlError ? failure.code : "import_failed"
                if (failure instanceof GwlError && failure.retryAfterMs)
                    await ctx.runMutation(
                        makeFunctionReference<"mutation">(
                            "leagueAutoImport:finish"
                        ),
                        {
                            ...claim,
                            error,
                            retryAt: Date.now() + failure.retryAfterMs,
                        }
                    )
            }
            await ctx.runMutation(
                makeFunctionReference<"mutation">("leagueAutoImport:finish"),
                { ...claim, error }
            )
        }
        const pending: Doc<"leagueAutoImportFixtures">[] = await ctx.runQuery(
            makeFunctionReference<"query">("leagueAutoImport:pendingCache"),
            {}
        )
        for (const row of pending) {
            if (
                !row.eventId ||
                !process.env.SITE_URL ||
                !process.env.INTERNAL_AUTH_SECRET
            )
                continue
            try {
                const response = await fetch(
                    new URL("/api/cache/revalidate", process.env.SITE_URL),
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            secret: process.env.INTERNAL_AUTH_SECRET,
                            payload: {
                                type: "event-changed",
                                serverId: row.guildId,
                                eventId: String(row.eventId),
                            },
                        }),
                        signal: AbortSignal.timeout(5000),
                        redirect: "error",
                    }
                )
                if (response.ok)
                    await ctx.runMutation(
                        makeFunctionReference<"mutation">(
                            "leagueAutoImport:acknowledgeCache"
                        ),
                        { id: row._id, updatedAt: row.updatedAt }
                    )
            } catch {
                /* Retained for the next cron, including while import is disabled. */
            }
        }
    },
})

/** Fetches only the configured team's bounded API window; never an arbitrary credential-bearing URL. */
export const readFixture = action({
    args: {
        secret: v.string(),
        guildId: v.string(),
        actor: dashboardActor,
        sourceUrl: v.string(),
    },
    handler: async (
        ctx,
        args
    ): Promise<{
        fixture: import("../src/domain/wardogs-league/team-api").TeamFixture
        matchTeams: import("../src/domain/teams/match-teams").MatchTeamAssignment[]
    }> => {
        const access = {
            secret: args.secret,
            guildId: args.guildId,
            actor: args.actor,
        }
        const config: {
            available: boolean
            settings: { teamCode: string } | null
            defaults: { teamCode: string }
        } = await ctx.runQuery(
            makeFunctionReference<"query">("leagueAutoImport:read"),
            access
        )
        if (!config.available) throw new Error("Wardogs is not enabled.")
        const source = matchUrl(args.sourceUrl.trim())
        const credentialJson: string | null = await ctx.runQuery(
            makeFunctionReference<"query">("leagueAutoImport:credential"),
            { guildId: args.guildId }
        )
        if (!credentialJson)
            throw new Error("Configure the Wardogs team API key first.")
        const key = decryptCredential(
            parseKeyring(process.env.LOGI_CREDENTIAL_KEYRING),
            credentialEnvelopeSchema.parse(JSON.parse(credentialJson)),
            `wardogs-team-fixtures:${args.guildId}`
        )
        const rawMatch = await gwlGet(
            key,
            `/team/matches/${source.id}`,
            gwlMatchSchema
        )
        if (rawMatch.test || !rawMatch.data)
            throw new GwlError("test_key_cannot_sync_live_data")
        const raw = gwlFixture(rawMatch.data)
        const fixture = ownTeamFirst(
            raw,
            config.settings?.teamCode ?? config.defaults.teamCode
        )
        if (!fixture) throw new Error("Check your Wardogs team code.")
        const matchTeams = await ctx.runQuery(
            makeFunctionReference<"query">("leagueAutoImport:previewTeams"),
            { fixtureJson: JSON.stringify(fixture) }
        )
        await ctx.runQuery(
            makeFunctionReference<"query">("leagueAutoImport:read"),
            access
        )
        return { fixture, matchTeams }
    },
})

function createReader(
    ctx: ActionCtx,
    config: Doc<"leagueAutoImportSettings">,
    key: string
) {
    return async <T>(path: string, schema: z.ZodType<T>): Promise<T> => {
        const cacheable = !path.includes("/events?") && !path.endsWith("/file")
        const cached: Doc<"gwlReadCache"> | null = cacheable
            ? await ctx.runQuery(
                  makeFunctionReference<"query">("gwlSyncStore:cache"),
                  { configId: config._id, path }
              )
            : null
        const result = await gwlGet(key, path, schema, {
            etag:
                cached?.revision === config.revision ? cached.etag : undefined,
            reserve: async () => {
                const budget: { ok: boolean; retryAt: number } =
                    await ctx.runMutation(
                        makeFunctionReference<"mutation">(
                            "gwlSyncStore:reserve"
                        ),
                        {
                            keyHash: createHash("sha256")
                                .update(key)
                                .digest("hex"),
                        }
                    )
                if (!budget.ok)
                    throw new GwlError(
                        "rate_limited",
                        budget.retryAt - Date.now()
                    )
            },
        })
        if (result.test) throw new GwlError("test_key_cannot_sync_live_data")
        if (result.data === null) {
            if (!cached || cached.revision !== config.revision)
                throw new GwlError("missing_cache")
            return schema.parse(JSON.parse(cached.body))
        }
        if (result.etag && cacheable)
            await ctx.runMutation(
                makeFunctionReference<"mutation">("gwlSyncStore:cachePut"),
                {
                    configId: config._id,
                    path,
                    revision: config.revision,
                    etag: result.etag,
                    body: JSON.stringify(result.data),
                }
            )
        return result.data
    }
}

export const listFixtures = action({
    args: { secret: v.string(), guildId: v.string(), actor: dashboardActor },
    handler: async (ctx, args) => {
        const state = await ctx.runQuery(
            makeFunctionReference<"query">("leagueAutoImport:read"),
            args
        )
        if (!state.available) throw new GwlError("wardogs_not_enabled")
        const encrypted: string | null = await ctx.runQuery(
            makeFunctionReference<"query">("leagueAutoImport:credential"),
            { guildId: args.guildId }
        )
        if (!encrypted) throw new GwlError("missing_key")
        const key = decryptCredential(
            parseKeyring(process.env.LOGI_CREDENTIAL_KEYRING),
            credentialEnvelopeSchema.parse(JSON.parse(encrypted)),
            `wardogs-team-fixtures:${args.guildId}`
        )
        const result = await gwlGet(
            key,
            "/team/fixtures?limit=100",
            gwlFixturesSchema
        )
        if (result.test || !result.data)
            throw new GwlError("test_key_cannot_sync_live_data")
        await ctx.runQuery(
            makeFunctionReference<"query">("leagueAutoImport:read"),
            args
        )
        return { fixtures: result.data.upcoming.map(gwlFixture) }
    },
})

/** Operator-only health check: returns status, never keyring contents or IDs. */
export const encryptionStatus = internalAction({
    args: {},
    handler: async (): Promise<{ status: "missing" | "valid" | "invalid" }> => {
        try {
            return {
                status: parseKeyring(process.env.LOGI_CREDENTIAL_KEYRING)
                    ? "valid"
                    : "missing",
            }
        } catch {
            return { status: "invalid" }
        }
    },
})
