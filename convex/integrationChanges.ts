import {
    authorizeMembership,
    membershipGuild,
    readMembershipRecord,
} from "./membership_shared"
import {
    PEOPLE_RESOURCES,
    type PeopleResource,
} from "../src/domain/api/people-summaries"
import {
    SYNC_RESOURCES,
    type SyncResource,
} from "../src/domain/integrations/change"
import {
    allowsApiKeyRead,
    isApiKeyReadAccess,
} from "../src/domain/api/key-access"
import { projectIntegrationRow } from "./integrationProjection"
import { integrationRevision } from "./integrationChangeLog"
import { query, type QueryCtx } from "./_generated/server"
import { readPeopleProjection } from "./peopleProjection"
import { readLeagueFixture } from "./leagueFixtureReads"
import { readHistoryRecord } from "./gameHistoryStore"
import { isGameId } from "../src/domain/games/game"
import { peopleGeneration } from "./peopleChanges"
import { readTeamDto } from "./teamReads"
import { v } from "convex/values"

async function authorize(
    ctx: QueryCtx,
    args: { secret: string; keyHash: string; gameId: string },
    resources: string[]
) {
    if (
        !process.env.INTERNAL_AUTH_SECRET ||
        args.secret !== process.env.INTERNAL_AUTH_SECRET
    )
        throw new Error("Unauthorized.")
    const key = await ctx.db
        .query("apiKeys")
        .withIndex("keyHash", (q) => q.eq("keyHash", args.keyHash))
        .unique()
    if (
        !key ||
        key.revokedAt ||
        !isGameId(args.gameId) ||
        !isApiKeyReadAccess(key.readAccess) ||
        resources.length === 0 ||
        resources.length > SYNC_RESOURCES.length ||
        !resources.every(
            (resource) =>
                (SYNC_RESOURCES as readonly string[]).includes(resource) &&
                allowsApiKeyRead(key.readAccess, resource, args.gameId as never)
        )
    )
        return null
    return key
}
const subject = { secret: v.string(), keyHash: v.string(), gameId: v.string() }
export const readChanges = query({
    args: {
        ...subject,
        resources: v.array(v.string()),
        limit: v.number(),
        startNow: v.optional(v.boolean()),
        afterRevision: v.optional(v.string()),
        issuedAt: v.optional(v.number()),
        discordUserId: v.optional(v.string()),
        membershipScopeVersion: v.optional(v.string()),
        peopleScopeVersion: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const key = await authorize(ctx, args, args.resources)
        if (!key) return null
        let peopleScopeVersion: string | undefined
        if (
            args.resources.some((resource) =>
                (PEOPLE_RESOURCES as readonly string[]).includes(resource)
            )
        ) {
            peopleScopeVersion = await peopleGeneration(ctx)
            if (
                !args.startNow &&
                args.peopleScopeVersion !== peopleScopeVersion
            )
                return { resetRequired: true }
        }
        let membershipScopeVersion: string | undefined
        if (args.resources.includes("membership-summaries")) {
            if (!args.discordUserId) return null
            const grant = await authorizeMembership(ctx, {
                ...args,
                guildId: key.guildId,
            })
            if (!grant) return null
            const guild = await membershipGuild(ctx, key.guildId)
            membershipScopeVersion = `${grant.policy.version}:${guild?.epoch ?? "0"}`
            if (
                !args.startNow &&
                args.membershipScopeVersion !== membershipScopeVersion
            )
                return { resetRequired: true }
        }
        if (!Number.isInteger(args.limit) || args.limit < 1 || args.limit > 100)
            throw new Error("Invalid limit.")
        const head = await ctx.db
            .query("integrationHeads")
            .withIndex("guildId", (q) => q.eq("guildId", key.guildId))
            .unique()
        const revision = head?.revision ?? "0"
        if (args.startNow)
            return {
                items: [],
                revision,
                hasMore: false,
                resetRequired: false,
                ...(membershipScopeVersion ? { membershipScopeVersion } : {}),
                ...(peopleScopeVersion !== undefined
                    ? { peopleScopeVersion }
                    : {}),
            }
        // Change retention was intentionally removed. Consumers bootstrap their
        // own collection after every cursor instead of Logi retaining a copy of
        // each mutation solely to replay it later.
        return { resetRequired: true }
    },
})
export const readSyncRecord = query({
    args: { ...subject, resource: v.string(), id: v.string() },
    handler: async (ctx, args) => {
        const key = await authorize(ctx, args, [args.resource])
        if (!key) return null
        const resource = args.resource as SyncResource
        if (resource === "membership-summaries") {
            const grant = await authorizeMembership(ctx, {
                ...args,
                guildId: key.guildId,
            })
            if (!grant) return null
            const data = await readMembershipRecord(
                ctx,
                {
                    guildId: key.guildId,
                    gameId: args.gameId,
                    discordUserId: args.id,
                },
                grant,
                60_000
            )
            return {
                guildId: key.guildId,
                gameId: args.gameId,
                resource,
                id: args.id,
                revision: data.revision,
                operation: "upsert" as const,
                data,
            }
        }
        const identity = {
            guildId: key.guildId,
            gameId: args.gameId,
            resource,
            id: args.id,
        }
        const revision = await integrationRevision(ctx, key.guildId)
        if (resource === "teams") {
            const data = await readTeamDto(ctx, args.gameId, args.id)
            return data
                ? {
                      ...identity,
                      revision,
                      operation: "upsert" as const,
                      data,
                  }
                : null
        }
        if ((PEOPLE_RESOURCES as readonly string[]).includes(resource)) {
            const data = await readPeopleProjection(
                ctx,
                identity,
                resource as PeopleResource,
                args.id,
                Date.now()
            )
            return data
                ? {
                      ...identity,
                      revision,
                      operation: "upsert" as const,
                      data,
                  }
                : null
        }
        if (resource === "server-game-history") {
            if (args.gameId !== "wardogs" && args.gameId !== "hell_let_loose")
                return null
            const data = await readHistoryRecord(
                ctx,
                key.guildId,
                args.id,
                args.gameId
            )
            return data
                ? {
                      ...identity,
                      revision,
                      operation: "upsert" as const,
                      data,
                  }
                : null
        }
        if (resource === "league-fixtures") {
            if (args.gameId !== "wardogs") return null
            const data = await readLeagueFixture(ctx, key.guildId, args.id)
            return data
                ? {
                      ...identity,
                      revision,
                      operation: "upsert" as const,
                      data,
                  }
                : null
        }
        // `server-snapshots` and `integration-health` are live state that no
        // writer notifies (`RETIRED_SYNC_RESOURCES`); their record is served.
        const table =
            resource === "server-snapshots" || resource === "integration-health"
                ? "gameDataConnections"
                : "events"
        const id = ctx.db.normalizeId(table, args.id)
        const row = id ? await ctx.db.get(id) : null
        if (!row || row.guildId !== key.guildId) return null
        const projection = projectIntegrationRow(table, row, Date.now()).find(
            (item) =>
                item.resource === resource && item.data.gameId === args.gameId
        )
        return projection
            ? {
                  ...identity,
                  revision,
                  operation: "upsert" as const,
                  data: projection.data,
              }
            : null
    },
})
