import {
    allowsWebsiteEventWrite,
    canonicalWebsiteCommand,
    canEditWebsiteEvent,
    canCancelWebsiteEvent,
    websiteEventCommandSchema,
    websiteEventFieldsSchema,
    websiteEventGameSchema,
    websiteEventMembershipError,
    websiteEventPolicySchema,
    type WebsiteEventActor,
    type WebsiteEventFields,
    type WebsiteEventGame,
    type WebsiteEventError,
} from "../src/domain/events/website-command"
import {
    ConvexEventCommandRepository,
    ConvexEventScoreRepository,
    DelegatingEventScorePort,
} from "../src/infrastructure/convex/event-command-repositories"
import { ConvexMatchTeamSnapshotPorts } from "../src/infrastructure/convex/team-directory-repositories"
import {
    mutation,
    query,
    type MutationCtx,
    type QueryCtx,
} from "./_generated/server"
import { refreshAssignedMatchTeam } from "../src/application/teams/refresh-match-team.use-case"
import {
    assertSessionGateway,
    activeDashboardSession,
} from "./dashboardSessionStore"
import { syncEventAssetReferences } from "../src/infrastructure/convex/event-asset-references"
import { ApplyEventScoreUseCase } from "../src/application/events/apply-event-score.use-case"
import { executeWebsiteEventCommand } from "../src/application/events/website-event-command"
import { canAdminServerContext } from "../src/infrastructure/convex/server-read-model"
import { UpsertEventUseCase } from "../src/application/events/upsert-event.use-case"
import { CancelEventUseCase } from "../src/application/events/cancel-event.use-case"
import { refreshEventSchedule } from "../src/infrastructure/convex/event-scheduling"
import type { EventUpsertInput } from "../src/domain/events/upsert-policy"
import { projectEventMatchTeams } from "../src/domain/api/event-summaries"
import { memberObservation, membershipGuild } from "./membershipAccess"
import { isApiKeyReadAccess } from "../src/domain/api/key-access"
import { nextRevision } from "../src/domain/integrations/change"
import { currentEventStatus } from "../src/domain/events/status"
import { deleteEventInTransaction } from "./eventDeletionStore"
import { withIntegrationChanges } from "./integrationMutation"
import { integrationRevision } from "./integrationChangeLog"
import { resolveGameScope } from "../src/domain/games/game"
import { DEFAULT_ROSTER_SCORE_SETTINGS } from "./guilds"
import type { Doc, Id } from "./_generated/dataModel"
import { resolveEventMatchTeams } from "./matchTeams"
import { resolveSsoActor } from "./ssoTokenStore"
import { v } from "convex/values"

const credentials = {
    secret: v.string(),
    keyHash: v.string(),
    actorTokenHash: v.string(),
    gameId: v.string(),
}
const error = (code: WebsiteEventError) => ({ error: { code } })
async function digest(value: string): Promise<string> {
    const bytes = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(value)
    )
    return Array.from(new Uint8Array(bytes), (byte) =>
        byte.toString(16).padStart(2, "0")
    ).join("")
}

async function authorize(
    ctx: Pick<QueryCtx, "db">,
    input: { keyHash: string; actorTokenHash: string; gameId: WebsiteEventGame }
): Promise<{ actor: WebsiteEventActor } | { error: WebsiteEventError }> {
    const key = /^[a-f0-9]{64}$/.test(input.keyHash)
        ? await ctx.db
              .query("apiKeys")
              .withIndex("keyHash", (q) => q.eq("keyHash", input.keyHash))
              .unique()
        : null
    const actor = await resolveSsoActor(ctx, input.actorTokenHash)
    if (!key || key.revokedAt || !actor || actor.guildId !== key.guildId)
        return { error: "unauthorized" }
    if (
        !isApiKeyReadAccess(key.readAccess) ||
        !allowsWebsiteEventWrite(key.writeAccess, input.gameId)
    )
        return { error: "insufficient_scope" }
    const policy = await ctx.db
        .query("websiteEventPolicies")
        .withIndex("apiKeyId", (q) => q.eq("apiKeyId", key._id))
        .unique()
    const roles =
        policy?.games.find((entry) => entry.gameId === input.gameId)?.roleIds ??
        []
    if (
        !policy?.enabled ||
        policy.guildId !== actor.guildId ||
        policy.applicationRecordId !== actor.applicationRecordId ||
        roles.length === 0
    )
        return { error: "policy_denied" }
    const workspace = await ctx.db
        .query("guilds")
        .withIndex("discordId", (q) => q.eq("discordId", actor.guildId))
        .unique()
    if (
        !workspace ||
        !(workspace.enabledGames ?? ["hell_let_loose"]).includes(input.gameId)
    )
        return { error: "policy_denied" }
    const guild = await membershipGuild(ctx, actor.guildId)
    const observed = await memberObservation(ctx, actor.guildId, actor.subject)
    const denied = websiteEventMembershipError({
        now: Date.now(),
        epoch: guild?.epoch ?? "0",
        allowedRoles: roles,
        observation: observed,
    })
    return denied
        ? { error: denied }
        : {
              actor: {
                  subject: actor.subject,
                  clientId: actor.clientId,
                  applicationRecordId: String(actor.applicationRecordId),
                  apiKeyId: String(key._id),
                  guildId: actor.guildId,
              },
          }
}

async function stamp(ctx: Pick<QueryCtx, "db">, event: Doc<"events">) {
    return integrationRevision(ctx, event.guildId)
}
function editableFields(event: Doc<"events">): WebsiteEventFields | null {
    const value = websiteEventFieldsSchema.safeParse({
        kind: event.kind ?? "match",
        name: event.name,
        ...(event.matchType !== undefined
            ? { matchType: event.matchType }
            : {}),
        ...(event.description !== undefined
            ? { description: event.description }
            : {}),
        ...(event.map !== undefined ? { map: event.map } : {}),
        ...(event.timeOfDay !== undefined
            ? { timeOfDay: event.timeOfDay }
            : {}),
        ...(event.tacticalPlan !== undefined
            ? { tacticalPlan: event.tacticalPlan }
            : {}),
        ...(event.side !== undefined ? { side: event.side } : {}),
        ...(event.registrationStart !== undefined
            ? { registrationStart: event.registrationStart }
            : {}),
        registrationEnd: event.registrationEnd,
        meetingStart: event.meetingStart,
        gameStart: event.gameStart,
        gameEnd: event.gameEnd,
        // Current selection as command input, so a consumer can round-trip it.
        ...((event.kind ?? "match") === "match" && event.matchTeams
            ? {
                  matchTeams: event.matchTeams.map(
                      ({ teamId, slot, side }) => ({ teamId, slot, side })
                  ),
              }
            : {}),
    })
    return value.success ? value.data : null
}

/**
 * Explicit, audited re-capture of one assigned team's presentation from its
 * active directory entry. Runs inside the tracked command transaction so the
 * event change feed emits; any rejection writes nothing and is reported as
 * invalid_match_teams.
 */
async function refreshMatchTeam(
    tracked: MutationCtx,
    actor: WebsiteEventActor,
    command: { eventId: string; teamId: string }
): Promise<{ eventId: string } | { error: "invalid_match_teams" }> {
    const id = tracked.db.normalizeId("events", command.eventId)
    const event = id ? await tracked.db.get(id) : null
    if (!event || event.guildId !== actor.guildId || event.isDraft === true)
        return { error: "invalid_match_teams" }
    const refreshed = await refreshAssignedMatchTeam(
        new ConvexMatchTeamSnapshotPorts(tracked),
        {
            event: { ...event, id: String(event._id) },
            teamId: command.teamId,
            actor: actor.subject,
            now: new Date(),
        }
    )
    return refreshed.ok
        ? { eventId: String(event._id) }
        : { error: "invalid_match_teams" }
}

export const readEditor = query({
    args: { ...credentials, eventId: v.string() },
    handler: async (ctx, args) => {
        assertSessionGateway(args.secret)
        const game = websiteEventGameSchema.safeParse(args.gameId)
        if (!game.success) return error("invalid_request")
        const grant = await authorize(ctx, { ...args, gameId: game.data })
        if ("error" in grant) return error(grant.error)
        const id = ctx.db.normalizeId("events", args.eventId)
        const current = id ? await ctx.db.get(id) : null
        if (
            !current ||
            current.guildId !== grant.actor.guildId ||
            // Website commands never see unpublished drafts.
            current.isDraft === true ||
            resolveGameScope(current.gameId) !== game.data
        )
            return error("not_found")
        const event = editableFields(current)
        if (!event) return error("invalid_state")
        const editable = canEditWebsiteEvent(current, Date.now())
        return {
            data: {
                eventId: String(current._id),
                guildId: current.guildId,
                gameId: game.data,
                revision: await stamp(ctx, current),
                event,
                matchTeams: projectEventMatchTeams(current),
                canEdit: editable,
                canCancel: canCancelWebsiteEvent(current, Date.now()),
            },
        }
    },
})

export const execute = mutation({
    args: { ...credentials, idempotencyKey: v.string(), command: v.any() },
    handler: async (ctx, args) => {
        assertSessionGateway(args.secret)
        const game = websiteEventGameSchema.safeParse(args.gameId)
        const command = websiteEventCommandSchema.safeParse(args.command)
        if (!game.success || !command.success) return error("invalid_request")
        // Never accept a caller-computed hash or clock at the transaction boundary.
        const bodyHash = await digest(
            canonicalWebsiteCommand(game.data, command.data)
        )
        return executeWebsiteEventCommand(
            {
                now: Date.now,
                authorize: (gameId) => authorize(ctx, { ...args, gameId }),
                receipt: async (actor, gameId, key) => {
                    const row = await ctx.db
                        .query("websiteEventCommandReceipts")
                        .withIndex("application_subject_game_key", (q) =>
                            q
                                .eq(
                                    "applicationRecordId",
                                    actor.applicationRecordId as Id<"ssoApplications">
                                )
                                .eq("subject", actor.subject)
                                .eq("gameId", gameId)
                                .eq("idempotencyKey", key)
                        )
                        .unique()
                    return row
                        ? {
                              bodyHash: row.bodyHash,
                              receipt: {
                                  eventId: String(row.eventId),
                                  guildId: row.guildId,
                                  gameId: row.gameId,
                                  revision: row.revision,
                                  operation: row.operation,
                                  receiptId: String(row._id),
                                  replayed: true,
                              },
                          }
                        : null
                },
                event: async (eventId) => {
                    const id = ctx.db.normalizeId("events", eventId)
                    const event = id ? await ctx.db.get(id) : null
                    return event && event.isDraft !== true
                        ? {
                              ...event,
                              id: String(event._id),
                              gameId: resolveGameScope(event.gameId),
                              revision: await stamp(ctx, event),
                          }
                        : null
                },
                apply: async (actor, gameId, input) => {
                    const outcome = await withIntegrationChanges(
                        ctx,
                        async (
                            tracked
                        ): Promise<
                            { eventId: string } | { error: WebsiteEventError }
                        > => {
                            if (input.operation === "delete") {
                                await deleteEventInTransaction(
                                    tracked,
                                    input.eventId as Id<"events">,
                                    actor.guildId
                                )
                                return { eventId: input.eventId }
                            }
                            if (input.operation === "refresh_match_team")
                                return await refreshMatchTeam(
                                    tracked,
                                    actor,
                                    input
                                )
                            const clock = { now: () => new Date() }
                            const repository = new ConvexEventCommandRepository(
                                tracked
                            )
                            const score = new DelegatingEventScorePort((id) =>
                                new ApplyEventScoreUseCase(
                                    new ConvexEventScoreRepository(
                                        tracked,
                                        DEFAULT_ROSTER_SCORE_SETTINGS
                                    )
                                )
                                    .execute(id)
                                    .then(() => undefined)
                            )
                            if (input.operation === "cancel") {
                                await new CancelEventUseCase(
                                    repository,
                                    clock
                                ).execute(input.eventId)
                                const pending = await tracked.db
                                    .query("eventScheduleJobs")
                                    .withIndex("eventId", (q) =>
                                        q.eq(
                                            "eventId",
                                            input.eventId as Id<"events">
                                        )
                                    )
                                    .collect()
                                for (const job of pending)
                                    await tracked.db.delete(job._id)
                                return { eventId: input.eventId }
                            }
                            const current =
                                input.operation === "update"
                                    ? await tracked.db.get(
                                          input.eventId as Id<"events">
                                      )
                                    : null
                            const { matchTeams: requested, ...fields } =
                                input.event
                            // Resolve before any write, so a rejected selection leaves
                            // nothing behind. Omission preserves; [] clears.
                            const matchTeams = await resolveEventMatchTeams(
                                tracked,
                                {
                                    gameId,
                                    kind: fields.kind,
                                    status: current
                                        ? currentEventStatus(current)
                                        : undefined,
                                    inputs: requested,
                                    previous: current?.matchTeams,
                                    now: new Date().toISOString(),
                                }
                            )
                            if (!matchTeams.ok)
                                return { error: "invalid_match_teams" }
                            // Preserve every native private/Discord field on updates. Website input
                            // owns only the bounded fields above and cannot inject roles or locations.
                            const native: EventUpsertInput = {
                                guildId: actor.guildId,
                                gameId,
                                ...fields,
                                matchTeams: matchTeams.matchTeams,
                                pingClan: current?.pingClan ?? false,
                                pingMode: current?.pingMode ?? "none",
                                pingRoleIds: current?.pingRoleIds,
                                createForumChannel:
                                    current?.createForumChannel ?? false,
                                createSignupThread:
                                    fields.createSignupThread ??
                                    current?.createSignupThread ??
                                    false,
                                topicPresetId: current?.topicPresetId
                                    ? String(current.topicPresetId)
                                    : undefined,
                                thumbnailUrl: current?.thumbnailUrl,
                                imageUrl: current?.imageUrl,
                                announcementChannelId:
                                    current?.announcementChannelId,
                                eventInfoChannelId: current?.eventInfoChannelId,
                                meetingChannelId: current?.meetingChannelId,
                                requiredRoleIds: current?.requiredRoleIds,
                                rewardRoleIds: current?.rewardRoleIds,
                                signupGroupIds: current?.signupGroupIds,
                                allowedSignupStatuses:
                                    current?.allowedSignupStatuses,
                                allowNonMembersSignup:
                                    current?.allowNonMembersSignup,
                                useGeneralSignup:
                                    current?.useGeneralSignup ?? true,
                                signupReminderStatuses:
                                    current?.signupReminderStatuses ?? [],
                                recurrence: current?.recurrence,
                                server: current?.server,
                                serverPassword: current?.serverPassword,
                                cap: current?.cap,
                                notes: current?.notes,
                                stratmapIds: current?.stratmapIds?.map(String),
                            }
                            const id = await new UpsertEventUseCase(
                                repository,
                                score,
                                clock
                            ).execute({
                                ...native,
                                ...(input.operation === "update"
                                    ? { eventId: input.eventId }
                                    : {}),
                            })
                            const written = await tracked.db.get(
                                id as Id<"events">
                            )
                            if (written)
                                await syncEventAssetReferences(tracked, written)
                            await refreshEventSchedule(
                                tracked,
                                id as Id<"events">
                            )
                            return { eventId: id }
                        }
                    )
                    if ("error" in outcome) return outcome
                    if (input.operation === "delete")
                        return {
                            eventId: outcome.eventId,
                            revision: await integrationRevision(
                                ctx,
                                actor.guildId
                            ),
                        }
                    const saved = await ctx.db.get(
                        outcome.eventId as Id<"events">
                    )
                    if (!saved) throw new Error("Event write failed.")
                    return {
                        eventId: outcome.eventId,
                        revision: await stamp(ctx, saved),
                    }
                },
                record: async (
                    actor,
                    gameId,
                    idempotencyKey,
                    hash,
                    operation,
                    result
                ) =>
                    String(
                        await ctx.db.insert("websiteEventCommandReceipts", {
                            applicationRecordId:
                                actor.applicationRecordId as Id<"ssoApplications">,
                            apiKeyId: actor.apiKeyId as Id<"apiKeys">,
                            clientId: actor.clientId,
                            guildId: actor.guildId,
                            subject: actor.subject,
                            gameId,
                            idempotencyKey,
                            bodyHash: hash,
                            operation,
                            eventId: result.eventId as Id<"events">,
                            revision: result.revision,
                            createdAt: new Date().toISOString(),
                        })
                    ),
            },
            {
                gameId: game.data,
                command: command.data,
                idempotencyKey: args.idempotencyKey,
                bodyHash,
            }
        )
    },
})

async function policyAdmin(
    ctx: Pick<QueryCtx, "db">,
    sid: string,
    workspaceId: string,
    applicationRecordId: Id<"ssoApplications">
) {
    const session = await activeDashboardSession(ctx, sid)
    const app = await ctx.db.get(applicationRecordId)
    const guildId = app ? ctx.db.normalizeId("guilds", app.guildId) : null
    const guild = guildId ? await ctx.db.get(guildId) : null
    if (
        !session ||
        !app ||
        app.guildId !== workspaceId ||
        !guild?.discordId ||
        !/^\d{17,20}$/.test(guild.discordId)
    )
        return null
    const discordAccess = await ctx.db
        .query("discordMemberAccess")
        .withIndex("guildId_userId", (q) =>
            q
                .eq("guildId", guild.discordId!)
                .eq("userId", session.session.subject)
        )
        .unique()
    if (
        !canAdminServerContext({
            serverAdminIds: guild.adminIds,
            dashboardAdminIds: guild.dashboardAdminIds,
            adminAccessOverrides: guild.adminAccessOverrides,
            userId: session.session.subject,
            discordAccess,
        })
    )
        return null
    return { session, app, guild }
}

/** Dashboard-session configuration only; bearer keys cannot grant themselves roles. */
export const configurePolicy = mutation({
    args: {
        secret: v.string(),
        sid: v.string(),
        workspaceId: v.string(),
        applicationRecordId: v.id("ssoApplications"),
        apiKeyId: v.id("apiKeys"),
        policy: v.any(),
    },
    handler: async (ctx, args) => {
        assertSessionGateway(args.secret)
        const admin = await policyAdmin(
            ctx,
            args.sid,
            args.workspaceId,
            args.applicationRecordId
        )
        const policy = websiteEventPolicySchema.safeParse(args.policy)
        const key = await ctx.db.get(args.apiKeyId)
        if (
            !admin ||
            !key ||
            key.guildId !== admin.guild.discordId ||
            key.revokedAt ||
            !isApiKeyReadAccess(key.readAccess)
        )
            return error("policy_denied")
        if (
            !policy.success ||
            policy.data.games.some(
                (game) =>
                    !(admin.guild.enabledGames ?? ["hell_let_loose"]).includes(
                        game.gameId
                    )
            )
        )
            return error("invalid_request")
        const current = await ctx.db
            .query("websiteEventPolicies")
            .withIndex("apiKeyId", (q) => q.eq("apiKeyId", args.apiKeyId))
            .unique()
        if (current && current.applicationRecordId !== args.applicationRecordId)
            return error("policy_denied")
        const value = {
            applicationRecordId: args.applicationRecordId,
            apiKeyId: key._id,
            guildId: key.guildId,
            ...policy.data,
            version: nextRevision(current?.version ?? "0"),
            updatedAt: new Date().toISOString(),
            updatedBy: admin.session.session.subject,
        }
        if (current) await ctx.db.patch(current._id, value)
        else await ctx.db.insert("websiteEventPolicies", value)
        const grantedGames = policy.data.enabled
            ? policy.data.games
                  .filter((game) => game.roleIds.length > 0)
                  .map((game) => game.gameId)
            : []
        await ctx.db.patch(key._id, {
            writeAccess: grantedGames.length
                ? { resources: ["event-commands"], gameIds: grantedGames }
                : undefined,
        })
        return {
            data: {
                enabled: value.enabled,
                games: value.games,
                version: value.version,
            },
        }
    },
})

export const listPolicies = query({
    args: {
        secret: v.string(),
        sid: v.string(),
        workspaceId: v.string(),
        applicationRecordId: v.id("ssoApplications"),
    },
    handler: async (ctx, args) => {
        assertSessionGateway(args.secret)
        const admin = await policyAdmin(
            ctx,
            args.sid,
            args.workspaceId,
            args.applicationRecordId
        )
        if (!admin) return error("policy_denied")
        const policies = await ctx.db
            .query("websiteEventPolicies")
            .withIndex("applicationRecordId", (q) =>
                q.eq("applicationRecordId", args.applicationRecordId)
            )
            .take(100)
        return {
            data: policies.map((policy) => ({
                apiKeyId: String(policy.apiKeyId),
                enabled: policy.enabled,
                games: policy.games,
                version: policy.version,
            })),
        }
    },
})
