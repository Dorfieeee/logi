import {
    appliesAsRecruit,
    canExecuteManagedRoles,
    managedMembershipRoleIntent,
    matchesManagedMembershipRoleIntent,
    resolveRoleCategory,
    managedRolePolicy,
    planManagedRoleChanges,
    roleAssignmentFingerprint,
    type RoleActor,
} from "../src/domain/membership/managed-roles"
import {
    internalMutation,
    mutation,
    query,
    type MutationCtx,
    type QueryCtx,
} from "./_generated/server"
import {
    GAME_IDS,
    resolveGameScope,
    type GameId,
} from "../src/domain/games/game"
import { assertMembershipSecret, memberObservation } from "./membershipAccess"
import { getGuildByDiscordId, getUserByIdentifier } from "./identity"
import { makeFunctionReference } from "convex/server"
import type { Doc } from "./_generated/dataModel"
import { v } from "convex/values"

export const roleActorValidator = v.object({
    userId: v.string(),
    kind: v.union(
        v.literal("dashboard"),
        v.literal("recruitment"),
        v.literal("application"),
        v.literal("rollback")
    ),
})
const NEVER = Number.MAX_SAFE_INTEGER
type Context = MutationCtx | QueryCtx
type Operation = Doc<"memberRoleOperations">
const key = {
    secret: v.string(),
    operationId: v.id("memberRoleOperations"),
    fence: v.number(),
}
const evidenceValidator = v.object({
    actorPresent: v.boolean(),
    actorAdministrator: v.boolean(),
    actorRoleIds: v.array(v.string()),
    targetRoleIds: v.array(v.string()),
    observedAt: v.number(),
})
type Evidence = {
    actorPresent: boolean
    actorAdministrator: boolean
    actorRoleIds: string[]
    targetRoleIds: string[]
    observedAt: number
}

/** An applied operation is checked against Discord again after a day. */
export const REVERIFY_INTERVAL_MS = 24 * 60 * 60_000
/** Denied, superseded and failed operations are kept this long. */
export const FINISHED_RETENTION_MS = 30 * 24 * 60 * 60_000
const PRUNE_BATCH = 50
type AttemptOutcome =
    | "running"
    | "applied"
    | "retry_scheduled"
    | "denied"
    | "superseded"
    | "failed"

/** One attempt row; an operation keeps its latest 20. */
async function recordAttempt(
    ctx: MutationCtx,
    operation: Operation,
    attempt: { fence: number; attempt: number },
    outcome: AttemptOutcome,
    reason: string
) {
    await ctx.db.insert("memberRoleAudits", {
        operationId: operation._id,
        guildId: operation.guildId,
        userId: operation.userId,
        actorId: operation.actorId,
        ...attempt,
        outcome,
        reason,
        at: new Date().toISOString(),
    })
    const history = await ctx.db
        .query("memberRoleAudits")
        .withIndex("operationId_fence", (q) =>
            q.eq("operationId", operation._id)
        )
        .order("desc")
        .take(21)
    for (const old of history.slice(20)) await ctx.db.delete(old._id)
}

async function closeRunningAttempt(
    ctx: MutationCtx,
    operation: Operation,
    outcome: Exclude<AttemptOutcome, "running">,
    reason: string
) {
    const audit = await ctx.db
        .query("memberRoleAudits")
        .withIndex("operationId_fence", (q) =>
            q.eq("operationId", operation._id).eq("fence", operation.fence)
        )
        .unique()
    // A later desired version must not rewrite an already verified attempt.
    if (audit?.outcome === "running")
        await ctx.db.patch(audit._id, { outcome, reason })
    // The daily check of an applied operation is claimed without a row: one
    // that confirms the roles again records nothing, one that ends any other
    // way records its outcome.
    else if (!audit && operation.status === "running" && outcome !== "applied")
        await recordAttempt(
            ctx,
            operation,
            { fence: operation.fence, attempt: operation.attempts },
            outcome,
            reason
        )
}

async function policyFor(ctx: Context, guildId: string, gameId: GameId) {
    const config = await ctx.db
        .query("discordConfigs")
        .withIndex("guildId", (q) => q.eq("guildId", guildId))
        .unique()
    return managedRolePolicy(config ?? {}, gameId)
}
async function assignmentFor(
    ctx: Context,
    guildId: string,
    gameId: GameId,
    userId: string
) {
    return (
        (
            await ctx.db
                .query("userAssignments")
                .withIndex("serverId_userId", (q) =>
                    q.eq("serverId", guildId).eq("userId", userId)
                )
                .collect()
        ).find((row) => resolveGameScope(row.gameId) === gameId) ?? null
    )
}
async function latest(
    ctx: Context,
    guildId: string,
    gameId: GameId,
    userId: string
) {
    return ctx.db
        .query("memberRoleOperations")
        .withIndex("guildId_gameId_userId_version", (q) =>
            q.eq("guildId", guildId).eq("gameId", gameId).eq("userId", userId)
        )
        .order("desc")
        .first()
}
async function latestForSubject(
    ctx: Context,
    guildId: string,
    gameId: GameId,
    discordUserId: string
) {
    return ctx.db
        .query("memberRoleOperations")
        .withIndex("guildId_gameId_discordUserId_version", (q) =>
            q
                .eq("guildId", guildId)
                .eq("gameId", gameId)
                .eq("discordUserId", discordUserId)
        )
        .order("desc")
        .first()
}
async function lockFor(ctx: Context, guildId: string, discordUserId: string) {
    return ctx.db
        .query("memberRoleLocks")
        .withIndex("guildId_discordUserId", (q) =>
            q.eq("guildId", guildId).eq("discordUserId", discordUserId)
        )
        .unique()
}

/** Called in the authoritative assignment transaction, never by a legacy bearer writer. */
export async function enqueueManagedRoles(
    ctx: MutationCtx,
    input: {
        guildId: string
        gameId: GameId
        userId: string
        actor: RoleActor
        before: Doc<"userAssignments"> | null
    }
) {
    const { guildId, gameId, userId, actor } = input
    if (!/^\d{17,20}$/.test(actor.userId))
        throw new Error("Invalid role actor.")
    const user = await getUserByIdentifier(ctx, userId)
    // Stable/imported IDs are not proof of a Discord link, even if numeric.
    const discordUserId =
        user?.discordId && /^\d{17,20}$/.test(user.discordId)
            ? user.discordId
            : undefined
    const policy = await policyFor(ctx, guildId, gameId)
    const assignment = await assignmentFor(ctx, guildId, gameId, userId)
    const categoryId =
        (assignment && resolveRoleCategory(policy, assignment)?.id) ??
        input.before?.membershipCategoryId
    if (
        (actor.kind === "application" || actor.kind === "rollback") &&
        (actor.userId !== discordUserId ||
            (actor.kind === "rollback"
                ? assignment !== null
                : !assignment ||
                  assignment.status === "active" ||
                  (assignment.status === "recruit" &&
                      !appliesAsRecruit(
                          policy,
                          assignment.membershipCategoryId,
                          assignment.type
                      ))))
    )
        throw new Error("Invalid self-application role intent.")
    const previousAssignment = await latest(ctx, guildId, gameId, userId)
    const previousSubject = discordUserId
        ? await latestForSubject(ctx, guildId, gameId, discordUserId)
        : null
    const previous = [previousAssignment, previousSubject].filter(
        (row, index, all): row is Operation =>
            Boolean(
                row && all.findIndex((item) => item?._id === row._id) === index
            )
    )
    const version = Math.max(0, ...previous.map((row) => row.version)) + 1
    if (!Number.isSafeInteger(version))
        throw new Error("Role version exhausted.")
    const now = new Date().toISOString()
    for (const row of previous) {
        await closeRunningAttempt(ctx, row, "superseded", "new_desired_version")
        await ctx.db.patch(row._id, {
            status: "superseded",
            nextAttemptAt: NEVER,
            updatedAt: now,
            reason: "new_desired_version",
        })
    }
    const observation = discordUserId
        ? await memberObservation(ctx, guildId, discordUserId)
        : null
    return ctx.db.insert("memberRoleOperations", {
        guildId,
        gameId,
        userId,
        userRecordId: user?._id,
        discordUserId,
        version,
        actorId: actor.userId,
        actorKind: actor.kind,
        categoryId,
        assignmentFingerprint: roleAssignmentFingerprint(assignment),
        policyFingerprint: JSON.stringify(policy),
        ...managedMembershipRoleIntent(policy, assignment, {
            applicant: actor.kind === "application",
        }),
        departureRevision: observation?.departureRevision ?? "0",
        status: discordUserId ? "pending" : "denied",
        attempts: 0,
        failureCount: 0,
        nextAttemptAt: discordUserId ? Date.now() : NEVER,
        leaseUntil: 0,
        fence: 0,
        reason: discordUserId ? "assignment_changed" : "target_not_linked",
        createdAt: now,
        updatedAt: now,
    })
}

async function evaluate(
    ctx: Context,
    operation: Operation,
    evidence?: Evidence
) {
    const user = await getUserByIdentifier(ctx, operation.userId)
    if (
        !operation.discordUserId ||
        !operation.userRecordId ||
        user?._id !== operation.userRecordId ||
        user.discordId !== operation.discordUserId
    )
        return "superseded" as const
    const current = await assignmentFor(
        ctx,
        operation.guildId,
        operation.gameId,
        operation.userId
    )
    if (roleAssignmentFingerprint(current) !== operation.assignmentFingerprint)
        return "superseded" as const
    let policy: Awaited<ReturnType<typeof policyFor>>
    try {
        policy = await policyFor(ctx, operation.guildId, operation.gameId)
    } catch {
        return "denied" as const
    }
    if (JSON.stringify(policy) !== operation.policyFingerprint)
        return "superseded" as const
    // An unchanged assignment/config can still carry intent derived by buggy
    // older code. Never replay those grants/removals or silently replace them.
    if (
        !matchesManagedMembershipRoleIntent(
            operation,
            managedMembershipRoleIntent(policy, current, {
                applicant: operation.actorKind === "application",
            })
        )
    )
        return "superseded" as const
    const observation = await memberObservation(
        ctx,
        operation.guildId,
        operation.discordUserId
    )
    if (
        observation?.state === "left" ||
        (observation?.departureRevision ?? "0") !== operation.departureRevision
    )
        return "denied" as const
    if (evidence) {
        if (
            Date.now() - evidence.observedAt < 0 ||
            Date.now() - evidence.observedAt > 10_000
        )
            return "denied" as const
        const guild = await getGuildByDiscordId(ctx, operation.guildId)
        const category = policy.settings?.categories.find(
            (row) => row.id === operation.categoryId
        )
        if (
            !canExecuteManagedRoles({
                kind: operation.actorKind,
                actorId: operation.actorId,
                targetId: operation.discordUserId,
                ...evidence,
                adminOverride: guild?.adminAccessOverrides?.[operation.actorId],
                dashboardRoleId: policy.dashboardRoleId,
                supportRoleIds: category?.supportRoleIds ?? [],
                selfAllowed:
                    operation.actorKind === "rollback"
                        ? current === null
                        : Boolean(
                              current &&
                              (current.status === "pending" ||
                                  (current.status === "recruit" &&
                                      appliesAsRecruit(
                                          policy,
                                          current.membershipCategoryId,
                                          current.type
                                      )))
                          ),
            })
        )
            return "denied" as const
    }
    return "ready" as const
}
async function liveLease(
    ctx: Context,
    operation: Operation | null,
    fence: number
) {
    if (
        !operation ||
        !operation.discordUserId ||
        operation.status !== "running" ||
        operation.fence !== fence ||
        operation.leaseUntil <= Date.now()
    )
        return false
    const lock = await lockFor(ctx, operation.guildId, operation.discordUserId)
    return Boolean(lock && lock.fence === fence && lock.leaseUntil > Date.now())
}

async function desiredFor(
    ctx: Context,
    operation: Operation,
    evidence?: Evidence
) {
    const desiredRoleIds = [...operation.desiredRoleIds]
    const policy = await policyFor(ctx, operation.guildId, operation.gameId)
    // Preserve an existing shared clan role held by another game's valid intent;
    // never add it on the authority of that other operation's actor.
    if (
        operation.discordUserId &&
        policy.clanRoleId &&
        operation.allowedRoleIds.includes(policy.clanRoleId) &&
        !desiredRoleIds.includes(policy.clanRoleId) &&
        evidence?.targetRoleIds.includes(policy.clanRoleId)
    ) {
        for (const gameId of GAME_IDS.filter((id) => id !== operation.gameId)) {
            const other = await latestForSubject(
                ctx,
                operation.guildId,
                gameId,
                operation.discordUserId
            )
            if (
                other &&
                !["denied", "failed", "superseded"].includes(other.status) &&
                other.desiredRoleIds.includes(policy.clanRoleId) &&
                (await evaluate(ctx, other)) === "ready"
            ) {
                desiredRoleIds.push(policy.clanRoleId)
                break
            }
        }
    }
    return desiredRoleIds
}

export const claimNext = mutation({
    args: { secret: v.string(), guildId: v.string() },
    handler: async (ctx, args) => {
        assertMembershipSecret(args.secret)
        const cooldown = await ctx.db
            .query("membershipRefreshLimits")
            .withIndex("name", (q) => q.eq("name", "discord"))
            .unique()
        if ((cooldown?.until ?? 0) > Date.now()) return null
        const rows = await ctx.db
            .query("memberRoleOperations")
            .withIndex("guildId_nextAttemptAt", (q) =>
                q.eq("guildId", args.guildId).lte("nextAttemptAt", Date.now())
            )
            .take(20)
        for (const operation of rows) {
            if (
                !["pending", "retry_scheduled", "running", "applied"].includes(
                    operation.status
                )
            )
                continue
            // Incomplete pre-release records cannot acquire a provider lease.
            if (!operation.discordUserId || !operation.userRecordId) {
                await closeRunningAttempt(
                    ctx,
                    operation,
                    "denied",
                    "target_not_linked"
                )
                await ctx.db.patch(operation._id, {
                    status: "denied",
                    reason: "target_not_linked",
                    nextAttemptAt: NEVER,
                    updatedAt: new Date().toISOString(),
                })
                continue
            }
            const lock = await lockFor(
                ctx,
                operation.guildId,
                operation.discordUserId
            )
            if (lock && lock.leaseUntil > Date.now()) continue
            const failureCount =
                operation.failureCount +
                (operation.status === "running" ? 1 : 0)
            if (failureCount >= 6) {
                await closeRunningAttempt(
                    ctx,
                    operation,
                    "failed",
                    "attempt_limit"
                )
                await ctx.db.patch(operation._id, {
                    status: "failed",
                    reason: "attempt_limit",
                    nextAttemptAt: NEVER,
                    updatedAt: new Date().toISOString(),
                })
                continue
            }
            if (operation.status === "running")
                await closeRunningAttempt(
                    ctx,
                    operation,
                    "retry_scheduled",
                    "lease_expired"
                )
            const fence = (lock?.fence ?? 0) + 1,
                leaseUntil = Date.now() + 45_000
            if (lock) await ctx.db.patch(lock._id, { fence, leaseUntil })
            else
                await ctx.db.insert("memberRoleLocks", {
                    guildId: operation.guildId,
                    discordUserId: operation.discordUserId,
                    fence,
                    leaseUntil,
                })
            const attempts = operation.attempts + 1,
                reverify = operation.status === "applied"
            await ctx.db.patch(operation._id, {
                status: "running",
                attempts,
                failureCount,
                fence,
                leaseUntil,
                nextAttemptAt: leaseUntil,
                updatedAt: new Date().toISOString(),
            })
            // The daily check of an applied operation writes an attempt row
            // only when it ends otherwise than applied (`closeRunningAttempt`).
            if (!reverify)
                await recordAttempt(
                    ctx,
                    operation,
                    { fence, attempt: attempts },
                    "running",
                    "claimed"
                )
            return { operationId: operation._id, fence }
        }
        return null
    },
})

export const prepare = query({
    args: { ...key, evidence: v.optional(evidenceValidator) },
    handler: async (ctx, args) => {
        assertMembershipSecret(args.secret)
        const operation = await ctx.db.get(args.operationId)
        const empty = {
            verdict: "superseded" as const,
            allowedRoleIds: [] as string[],
            desiredRoleIds: [] as string[],
        }
        if (!(await liveLease(ctx, operation, args.fence)) || !operation)
            return empty
        const verdict = await evaluate(ctx, operation, args.evidence)
        const desiredRoleIds =
            verdict === "ready"
                ? await desiredFor(ctx, operation, args.evidence)
                : []
        return {
            verdict,
            allowedRoleIds: operation.allowedRoleIds,
            desiredRoleIds,
            guildId: operation.guildId,
            discordUserId: operation.discordUserId,
            actorId: operation.actorId,
        }
    },
})

export const finish = mutation({
    args: {
        ...key,
        outcome: v.union(
            v.literal("applied"),
            v.literal("retry_scheduled"),
            v.literal("denied"),
            v.literal("superseded")
        ),
        reason: v.string(),
        retryAfterMs: v.optional(v.number()),
        evidence: v.optional(evidenceValidator),
    },
    handler: async (ctx, args) => {
        assertMembershipSecret(args.secret)
        const operation = await ctx.db.get(args.operationId)
        if (!operation || !(await liveLease(ctx, operation, args.fence)))
            return false
        const verdict = await evaluate(ctx, operation, args.evidence)
        if (
            args.outcome === "applied" &&
            (!args.evidence || verdict !== "ready")
        )
            return false
        if (args.outcome === "applied" && args.evidence) {
            const changes = planManagedRoleChanges({
                observedRoleIds: args.evidence.targetRoleIds,
                desiredManagedRoleIds: await desiredFor(
                    ctx,
                    operation,
                    args.evidence
                ),
                allowedManagedRoleIds: operation.allowedRoleIds,
            })
            if (changes.add.length || changes.remove.length) return false
        }
        const outcome = verdict === "ready" ? args.outcome : verdict
        const failureCount =
            outcome === "retry_scheduled" ? operation.failureCount + 1 : 0
        const status = failureCount >= 6 ? "failed" : outcome
        const delay = Math.max(
            Math.min(
                Number.isFinite(args.retryAfterMs) ? args.retryAfterMs! : 0,
                86_400_000
            ),
            Math.min(300_000, 5_000 * 2 ** failureCount)
        )
        const reason = /^[a-z_]{1,64}$/.test(args.reason)
            ? args.reason
            : "provider_unavailable"
        if (reason === "rate_limited") {
            const cooldown = await ctx.db
                .query("membershipRefreshLimits")
                .withIndex("name", (q) => q.eq("name", "discord"))
                .unique()
            const until = Math.max(cooldown?.until ?? 0, Date.now() + delay)
            if (cooldown) await ctx.db.patch(cooldown._id, { until })
            else
                await ctx.db.insert("membershipRefreshLimits", {
                    name: "discord",
                    until,
                })
        }
        // Before the patch: the attempt is judged by the claimed state.
        await closeRunningAttempt(ctx, operation, status, reason)
        await ctx.db.patch(operation._id, {
            status,
            failureCount,
            leaseUntil: 0,
            nextAttemptAt:
                status === "applied"
                    ? Date.now() + REVERIFY_INTERVAL_MS
                    : status === "retry_scheduled"
                      ? Date.now() + delay
                      : NEVER,
            reason,
            updatedAt: new Date().toISOString(),
        })
        const lock = operation.discordUserId
            ? await lockFor(ctx, operation.guildId, operation.discordUserId)
            : null
        if (lock?.fence === args.fence)
            await ctx.db.patch(lock._id, { leaseUntil: 0 })
        return true
    },
})

export const listForGuild = query({
    args: { secret: v.string(), guildId: v.string() },
    handler: async (ctx, args) => {
        assertMembershipSecret(args.secret)
        const rows = await ctx.db
            .query("memberRoleOperations")
            .withIndex("guildId_createdAt", (q) =>
                q.eq("guildId", args.guildId)
            )
            .order("desc")
            .take(100)
        return Promise.all(
            rows.map(async (row) => {
                const audit = await ctx.db
                    .query("memberRoleAudits")
                    .withIndex("operationId_fence", (q) =>
                        q.eq("operationId", row._id)
                    )
                    .order("desc")
                    .take(5)
                return {
                    id: String(row._id),
                    gameId: row.gameId,
                    userId: row.userId,
                    discordUserId: row.discordUserId ?? null,
                    actorId: row.actorId,
                    provenance: row.actorKind,
                    version: row.version,
                    status: row.status,
                    attempts: row.attempts,
                    reason: row.reason,
                    updatedAt: row.updatedAt,
                    audit: audit.map((entry) => ({
                        attempt: entry.attempt,
                        outcome: entry.outcome,
                        reason: entry.reason,
                        at: entry.at,
                    })),
                }
            })
        )
    },
})

/**
 * Daily removal of finished operations: denied, superseded and failed ones
 * (`nextAttemptAt` is NEVER, nothing runs them again) 30 days after they
 * finished, with their attempt rows and, once no operation of that member is
 * left, the member's Discord lock. Bounded batches through an index,
 * rescheduled while a batch is full (ARCHITECTURE.md, "Convex hot paths").
 * An applied operation is never removed: the bot keeps checking it.
 */
export const pruneFinished = internalMutation({
    args: {},
    handler: async (ctx) => {
        const cutoff = new Date(
            Date.now() - FINISHED_RETENTION_MS
        ).toISOString()
        const rows = await ctx.db
            .query("memberRoleOperations")
            .withIndex("nextAttemptAt_updatedAt", (q) =>
                q.eq("nextAttemptAt", NEVER).lt("updatedAt", cutoff)
            )
            .take(PRUNE_BATCH)
        let audits = 0,
            locks = 0
        const subjects = new Map<string, { guildId: string; id: string }>()
        for (const operation of rows) {
            for (;;) {
                const page = await ctx.db
                    .query("memberRoleAudits")
                    .withIndex("operationId_fence", (q) =>
                        q.eq("operationId", operation._id)
                    )
                    .take(100)
                for (const audit of page) await ctx.db.delete(audit._id)
                audits += page.length
                if (page.length < 100) break
            }
            await ctx.db.delete(operation._id)
            if (operation.discordUserId)
                subjects.set(
                    `${operation.guildId}:${operation.discordUserId}`,
                    { guildId: operation.guildId, id: operation.discordUserId }
                )
        }
        for (const subject of subjects.values()) {
            const lock = await lockFor(ctx, subject.guildId, subject.id)
            if (!lock || lock.leaseUntil > Date.now()) continue
            let used = false
            for (const gameId of GAME_IDS)
                if (
                    await latestForSubject(
                        ctx,
                        subject.guildId,
                        gameId,
                        subject.id
                    )
                ) {
                    used = true
                    break
                }
            if (used) continue
            await ctx.db.delete(lock._id)
            locks++
        }
        const more = rows.length === PRUNE_BATCH
        if (more)
            await ctx.scheduler.runAfter(
                0,
                makeFunctionReference<"mutation">(
                    "memberRoleOperations:pruneFinished"
                ),
                {}
            )
        return { operations: rows.length, audits, locks, more }
    },
})
