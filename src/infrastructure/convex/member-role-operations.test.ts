import { syncDashboardAdminOverrides } from "../../../convex/discordMemberAccessStore"
import type { MutationCtx } from "../../../convex/_generated/server"
import * as operations from "../../../convex/memberRoleOperations"
import * as observations from "../../../convex/memberObservations"
import { invoke, spyReads, testContext } from "./testing/database"
import * as assignments from "../../../convex/userAssignments"
import * as configuration from "../../../convex/discordConfig"
import * as publicApi from "../../../convex/publicApi"
import * as guilds from "../../../convex/guilds"
import * as groups from "../../../convex/groups"
import assert from "node:assert/strict"
import test from "node:test"

const secret = (process.env.INTERNAL_AUTH_SECRET = "dev-internal-auth-secret")
function fixture() {
    const ctx = testContext()
    ctx.db.seed("guilds", {
        _id: "guilds:a",
        discordId: "111111111111111111",
        adminIds: ["333333333333333333"],
        adminAccessOverrides: {},
    })
    ctx.db.seed("users", {
        _id: "users:target",
        discordId: "222222222222222222",
    })
    ctx.db.seed("discordConfigs", {
        _id: "discordConfigs:a",
        guildId: "111111111111111111",
        clanRoleId: "clan",
        dashboardAdminRoleId: "dashboard",
        membershipSettings: {
            enabled: true,
            autoAssignRecruitOnApply: true,
            categories: [
                {
                    id: "members",
                    supportRoleIds: ["support"],
                    recruitRoleIds: ["recruit"],
                    finalRoleIds: ["member"],
                },
            ],
        },
    })
    return ctx
}
const save = {
    secret,
    serverDiscordId: "111111111111111111",
    userId: "222222222222222222",
    gameId: "hell_let_loose",
    type: "member",
    status: "recruit",
    membershipCategoryId: "members",
    secondaryGroupIds: [],
    paused: false,
}
const actor = { userId: "333333333333333333", kind: "dashboard" }
const evidence = () => ({
    actorPresent: true,
    actorAdministrator: false,
    actorRoleIds: ["dashboard"],
    targetRoleIds: [],
    observedAt: Date.now(),
})
async function queued(ctx: ReturnType<typeof fixture>) {
    await invoke(assignments.upsertByServerDiscordId, ctx, {
        ...save,
        roleActor: actor,
    })
    return invoke(operations.claimNext, ctx, {
        secret,
        guildId: "111111111111111111",
    })
}
test("actual staff assignment queues atomically while legacy service and import paths do not", async () => {
    const ctx = fixture()
    await invoke(assignments.upsertByServerDiscordId, ctx, save)
    assert.equal(ctx.db.tables.memberRoleOperations?.length ?? 0, 0)
    await invoke(assignments.upsertByServerDiscordId, ctx, {
        ...save,
        assignmentId: ctx.db.tables.userAssignments[0]._id,
        status: "active",
        roleActor: actor,
    })
    const [operation] = ctx.db.tables.memberRoleOperations
    assert.equal(operation.actorId, "333333333333333333")
    assert.deepEqual(operation.desiredRoleIds, ["clan", "member"])
    assert.equal(operation.status, "pending")
    // A Discord role may also serve another policy (here the dashboard
    // administrator role); the membership operation still queues.
    const shared = fixture()
    shared.db.tables.discordConfigs[0].dashboardAdminRoleId = "member"
    await invoke(assignments.upsertByServerDiscordId, shared, {
        ...save,
        status: "active",
        roleActor: actor,
    })
    assert.equal(shared.db.tables.userAssignments.length, 1)
    assert.equal(shared.db.tables.memberRoleOperations.length, 1)
})
test("execution rechecks current actor authority, assignment version, policy and lease", async () => {
    const ctx = fixture(),
        claim = await queued(ctx)
    const args = {
        secret,
        operationId: claim.operationId,
        fence: claim.fence,
        evidence: evidence(),
    }
    assert.equal((await invoke(operations.prepare, ctx, args)).verdict, "ready")
    args.evidence.actorRoleIds = []
    assert.equal(
        (await invoke(operations.prepare, ctx, args)).verdict,
        "denied"
    )
    args.evidence.actorRoleIds = ["dashboard"]
    await invoke(assignments.upsertByServerDiscordId, ctx, {
        ...save,
        assignmentId: ctx.db.tables.userAssignments[0]._id,
        status: "active",
    })
    assert.equal(
        (await invoke(operations.prepare, ctx, args)).verdict,
        "superseded"
    )
    assert.equal(
        await invoke(operations.finish, ctx, {
            ...args,
            evidence: undefined,
            outcome: "applied",
            reason: "verified",
        }),
        false
    )
})
test("expired leases are reclaimed and stale completion cannot claim success", async () => {
    const ctx = fixture(),
        first = await queued(ctx)
    assert.equal(
        await invoke(operations.claimNext, ctx, {
            secret,
            guildId: "111111111111111111",
        }),
        null
    )
    ctx.db.tables.memberRoleOperations[0].nextAttemptAt = 0
    ctx.db.tables.memberRoleOperations[0].leaseUntil = 0
    ctx.db.tables.memberRoleLocks[0].leaseUntil = 0
    const second = await invoke(operations.claimNext, ctx, {
        secret,
        guildId: "111111111111111111",
    })
    assert.ok(second.fence > first.fence)
    const interrupted = structuredClone(ctx.db.tables.memberRoleAudits[0])
    assert.equal(interrupted.outcome, "retry_scheduled")
    assert.equal(interrupted.reason, "lease_expired")
    assert.equal(ctx.db.tables.memberRoleAudits[1].outcome, "running")
    assert.equal(
        await invoke(operations.finish, ctx, {
            secret,
            ...first,
            outcome: "applied",
            reason: "verified",
        }),
        false
    )
    assert.deepEqual(ctx.db.tables.memberRoleAudits[0], interrupted)
    assert.equal(
        await invoke(operations.finish, ctx, {
            secret,
            ...second,
            outcome: "retry_scheduled",
            reason: "rate_limited",
            retryAfterMs: 120_000,
        }),
        true
    )
    assert.ok(
        ctx.db.tables.memberRoleOperations[0].nextAttemptAt >=
            Date.now() + 119_000
    )
})

test("superseding a running request closes its attempt without releasing the Discord lock", async () => {
    const ctx = fixture(),
        first = await queued(ctx)
    const lock = structuredClone(ctx.db.tables.memberRoleLocks[0])
    await invoke(assignments.upsertByServerDiscordId, ctx, {
        ...save,
        assignmentId: ctx.db.tables.userAssignments[0]._id,
        status: "active",
        roleActor: actor,
    })
    const audit = structuredClone(ctx.db.tables.memberRoleAudits[0])
    assert.equal(audit.outcome, "superseded")
    assert.equal(audit.reason, "new_desired_version")
    assert.deepEqual(ctx.db.tables.memberRoleLocks[0], lock)
    assert.equal(
        await invoke(operations.claimNext, ctx, {
            secret,
            guildId: save.serverDiscordId,
        }),
        null
    )
    assert.equal(
        await invoke(operations.finish, ctx, {
            secret,
            ...first,
            outcome: "applied",
            reason: "verified",
            evidence: { ...evidence(), targetRoleIds: ["clan", "recruit"] },
        }),
        false
    )
    assert.deepEqual(ctx.db.tables.memberRoleAudits[0], audit)
    const rows = await invoke(operations.listForGuild, ctx, {
        secret,
        guildId: save.serverDiscordId,
    })
    assert.equal(
        rows.find((row: { id: string }) => row.id === first.operationId)
            .audit[0].outcome,
        "superseded"
    )
})

test("superseding a completed request preserves its verified attempt history", async () => {
    const ctx = fixture(),
        first = await queued(ctx)
    assert.equal(
        await invoke(operations.finish, ctx, {
            secret,
            ...first,
            outcome: "applied",
            reason: "verified",
            evidence: { ...evidence(), targetRoleIds: ["clan", "recruit"] },
        }),
        true
    )
    const audit = structuredClone(ctx.db.tables.memberRoleAudits[0])
    await invoke(assignments.upsertByServerDiscordId, ctx, {
        ...save,
        assignmentId: ctx.db.tables.userAssignments[0]._id,
        status: "active",
        roleActor: actor,
    })
    assert.equal(ctx.db.tables.memberRoleOperations[0].status, "superseded")
    assert.deepEqual(ctx.db.tables.memberRoleAudits[0], audit)
    assert.equal(audit.outcome, "applied")
})

test("exhausted crash recovery closes the final attempt instead of leaving it running", async () => {
    const ctx = fixture()
    await queued(ctx)
    for (let attempt = 1; attempt <= 6; attempt++) {
        ctx.db.tables.memberRoleOperations[0].nextAttemptAt = 0
        ctx.db.tables.memberRoleOperations[0].leaseUntil = 0
        ctx.db.tables.memberRoleLocks[0].leaseUntil = 0
        const next = await invoke(operations.claimNext, ctx, {
            secret,
            guildId: save.serverDiscordId,
        })
        assert.equal(next === null, attempt === 6)
    }
    assert.equal(ctx.db.tables.memberRoleOperations[0].status, "failed")
    assert.equal(ctx.db.tables.memberRoleAudits.length, 6)
    assert.deepEqual(
        ctx.db.tables.memberRoleAudits.map((row) => [row.outcome, row.reason]),
        [
            ...Array.from({ length: 5 }, () => [
                "retry_scheduled",
                "lease_expired",
            ]),
            ["failed", "attempt_limit"],
        ]
    )
})

test("rejecting an incomplete legacy request closes its outstanding attempt", async () => {
    const ctx = fixture()
    await queued(ctx)
    delete ctx.db.tables.memberRoleOperations[0].userRecordId
    ctx.db.tables.memberRoleOperations[0].nextAttemptAt = 0
    assert.equal(
        await invoke(operations.claimNext, ctx, {
            secret,
            guildId: save.serverDiscordId,
        }),
        null
    )
    assert.equal(ctx.db.tables.memberRoleOperations[0].status, "denied")
    assert.equal(ctx.db.tables.memberRoleAudits[0].outcome, "denied")
    assert.equal(ctx.db.tables.memberRoleAudits[0].reason, "target_not_linked")
})
test("departure and rejoin cannot revive a previously queued grant", async () => {
    const ctx = fixture(),
        claim = await queued(ctx)
    const epoch = await invoke(observations.ensureGuild, ctx, {
        secret,
        guildId: "111111111111111111",
    })
    for (const state of ["left", "present"])
        await invoke(observations.applyGateway, ctx, {
            secret,
            guildId: "111111111111111111",
            discordUserId: "222222222222222222",
            epoch,
            state,
            roleIds: [],
            observedAt: new Date().toISOString(),
        })
    assert.equal(
        (
            await invoke(operations.prepare, ctx, {
                secret,
                ...claim,
                evidence: evidence(),
            })
        ).verdict,
        "denied"
    )
})
test("removal has a durable empty desired state and remains tenant bound", async () => {
    const ctx = fixture()
    await queued(ctx)
    await invoke(assignments.remove, ctx, {
        secret,
        assignmentId: ctx.db.tables.userAssignments[0]._id,
        roleActor: actor,
        roleGuildId: "111111111111111111",
    })
    const last = ctx.db.tables.memberRoleOperations.at(-1)!
    assert.deepEqual(last.desiredRoleIds, [])
    assert.equal(ctx.db.tables.memberRoleOperations[0].status, "superseded")
    assert.deepEqual(
        await invoke(operations.listForGuild, ctx, {
            secret,
            guildId: "other",
        }),
        []
    )
})

test("success requires fresh evidence of convergence within the managed role set", async () => {
    const ctx = fixture(),
        claim = await queued(ctx)
    const args = { secret, ...claim, outcome: "applied", reason: "verified" }
    assert.equal(
        await invoke(operations.finish, ctx, { ...args, evidence: evidence() }),
        false
    )
    assert.equal(ctx.db.tables.memberRoleOperations[0].status, "running")
    assert.equal(
        await invoke(operations.finish, ctx, {
            ...args,
            evidence: {
                ...evidence(),
                targetRoleIds: ["clan", "recruit", "unmanaged"],
            },
        }),
        true
    )
    assert.equal(ctx.db.tables.memberRoleOperations[0].status, "applied")
})

test("one game preserves an existing shared clan role but cannot grant on another actor's authority", async () => {
    const ctx = fixture()
    ctx.db.tables.users[0].id = "imported-player"
    ctx.db.tables.discordConfigs[0].gameOverrides = {
        wardogs: {
            membershipSettings: {
                enabled: true,
                autoAssignRecruitOnApply: false,
                categories: [
                    {
                        id: "members",
                        supportRoleIds: [],
                        recruitRoleIds: [],
                        finalRoleIds: ["wardogs-member"],
                    },
                ],
            },
        },
    }
    await invoke(assignments.upsertByServerDiscordId, ctx, {
        ...save,
        gameId: "wardogs",
        status: "active",
        roleActor: actor,
    })
    const wardogs = await invoke(operations.claimNext, ctx, {
        secret,
        guildId: "111111111111111111",
    })
    assert.equal(
        await invoke(operations.finish, ctx, {
            secret,
            ...wardogs,
            outcome: "applied",
            reason: "verified",
            evidence: {
                ...evidence(),
                targetRoleIds: ["clan", "wardogs-member"],
            },
        }),
        true
    )
    await invoke(assignments.upsertByServerDiscordId, ctx, {
        ...save,
        status: "pending",
        userId: "imported-player",
        roleActor: actor,
    })
    const hll = await invoke(operations.claimNext, ctx, {
        secret,
        guildId: "111111111111111111",
    })
    const prepare = (roles: string[]) =>
        invoke(operations.prepare, ctx, {
            secret,
            ...hll,
            evidence: { ...evidence(), targetRoleIds: roles },
        })
    assert.deepEqual(
        (await prepare(["clan", "wardogs-member"])).desiredRoleIds,
        ["clan"]
    )
    assert.deepEqual((await prepare(["wardogs-member"])).desiredRoleIds, [])
    assert.deepEqual(
        (await prepare(["clan", "wardogs-member"])).allowedRoleIds,
        ["clan", "member", "recruit"]
    )
    assert.equal(
        await invoke(operations.finish, ctx, {
            secret,
            ...hll,
            outcome: "applied",
            reason: "verified",
            evidence: {
                ...evidence(),
                targetRoleIds: ["clan", "wardogs-member"],
            },
        }),
        true
    )
})

/** Writes per table, from the fake's `table:n` ids, until `restore`. */
function countWrites(ctx: ReturnType<typeof fixture>) {
    const writes: Record<string, number> = {}
    const count = (id: string) => {
        const table = id.split(":")[0]
        writes[table] = (writes[table] ?? 0) + 1
    }
    const insert = ctx.db.insert.bind(ctx.db),
        patch = ctx.db.patch.bind(ctx.db),
        remove = ctx.db.delete.bind(ctx.db)
    ctx.db.insert = async (table: string, value: Record<string, unknown>) => {
        count(`${table}:`)
        return insert(table, value)
    }
    ctx.db.patch = async (id: string, value: Record<string, unknown>) => {
        count(id)
        return patch(id, value)
    }
    ctx.db.delete = async (id: string) => {
        count(id)
        return remove(id)
    }
    const restore = () => {
        ctx.db.insert = insert
        ctx.db.patch = patch
        ctx.db.delete = remove
    }
    return { writes, restore }
}
const converged = () => ({
    ...evidence(),
    targetRoleIds: ["clan", "recruit"],
})

test("an applied operation is checked again after a day, and a check that changes nothing writes no attempt row", async () => {
    const ctx = fixture()
    let claim = await queued(ctx)
    await invoke(operations.finish, ctx, {
        secret,
        ...claim,
        outcome: "applied",
        reason: "verified",
        evidence: converged(),
    })
    const operation = () => ctx.db.tables.memberRoleOperations[0]
    const dueIn = operation().nextAttemptAt - Date.now()
    assert.ok(
        dueIn > operations.REVERIFY_INTERVAL_MS - 5_000 &&
            dueIn <= operations.REVERIFY_INTERVAL_MS,
        "next check in 24 hours"
    )
    assert.equal(
        await invoke(operations.claimNext, ctx, {
            secret,
            guildId: "111111111111111111",
        }),
        null,
        "not due before then"
    )
    for (let i = 0; i < 24; i++) {
        operation().nextAttemptAt = 0
        const { writes, restore } = countWrites(ctx)
        claim = await invoke(operations.claimNext, ctx, {
            secret,
            guildId: "111111111111111111",
        })
        assert.equal(
            await invoke(operations.finish, ctx, {
                secret,
                ...claim,
                outcome: "applied",
                reason: "verified",
                evidence: converged(),
            }),
            true
        )
        // Claim and finish: the lease on the lock and the operation, twice.
        assert.deepEqual(writes, {
            memberRoleLocks: 2,
            memberRoleOperations: 2,
        })
        restore()
    }
    assert.equal(operation().status, "applied")
    assert.equal(ctx.db.tables.memberRoleAudits.length, 1)
    // A check that does not end applied records its outcome.
    operation().nextAttemptAt = 0
    claim = await invoke(operations.claimNext, ctx, {
        secret,
        guildId: "111111111111111111",
    })
    await invoke(operations.finish, ctx, {
        secret,
        ...claim,
        outcome: "retry_scheduled",
        reason: "provider_unavailable",
    })
    const [row] = await invoke(operations.listForGuild, ctx, {
        secret,
        guildId: "111111111111111111",
    })
    assert.equal(row.attempts, 26)
    assert.deepEqual(
        row.audit.map((entry: { attempt: number; outcome: string }) => [
            entry.attempt,
            entry.outcome,
        ]),
        [
            [26, "retry_scheduled"],
            [1, "applied"],
        ]
    )
    assert.equal("policyFingerprint" in row, false)
    assert.equal("allowedRoleIds" in row, false)
})
test("failing checks keep a bounded attempt history", async () => {
    const ctx = fixture()
    let claim = await queued(ctx)
    const finish = (outcome: string) =>
        invoke(operations.finish, ctx, {
            secret,
            ...claim,
            outcome,
            reason: outcome === "applied" ? "verified" : "provider_unavailable",
            ...(outcome === "applied" ? { evidence: converged() } : {}),
        })
    const next = async () => {
        ctx.db.tables.memberRoleOperations[0].nextAttemptAt = 0
        claim = await invoke(operations.claimNext, ctx, {
            secret,
            guildId: "111111111111111111",
        })
    }
    await finish("applied")
    for (let i = 0; i < 15; i++) {
        // The daily check fails, the retry confirms the roles again.
        await next()
        await finish("retry_scheduled")
        await next()
        await finish("applied")
    }
    assert.equal(ctx.db.tables.memberRoleAudits.length, 20)
    assert.equal(ctx.db.tables.memberRoleOperations[0].status, "applied")
})

test("finished operations are removed 30 days after they finished, with their attempts and an unused lock", async () => {
    const ctx = fixture()
    const old = new Date(
        Date.now() - operations.FINISHED_RETENTION_MS - 1000
    ).toISOString()
    const recent = new Date().toISOString()
    const seedOperation = (
        id: string,
        discordUserId: string,
        status: string,
        updatedAt: string,
        nextAttemptAt = Number.MAX_SAFE_INTEGER
    ) => {
        ctx.db.seed("memberRoleOperations", {
            _id: `memberRoleOperations:${id}`,
            guildId: "111111111111111111",
            gameId: "hell_let_loose",
            userId: discordUserId,
            discordUserId,
            version: 1,
            actorId: "333333333333333333",
            actorKind: "dashboard",
            assignmentFingerprint: "",
            policyFingerprint: "",
            allowedRoleIds: [],
            desiredRoleIds: [],
            departureRevision: "0",
            status,
            attempts: 1,
            failureCount: 0,
            nextAttemptAt,
            leaseUntil: 0,
            fence: 1,
            reason: "fixture",
            createdAt: updatedAt,
            updatedAt,
        })
        ctx.db.seed("memberRoleAudits", {
            _id: `memberRoleAudits:${id}`,
            operationId: `memberRoleOperations:${id}`,
            guildId: "111111111111111111",
            userId: discordUserId,
            actorId: "333333333333333333",
            fence: 1,
            attempt: 1,
            outcome: status,
            reason: "fixture",
            at: updatedAt,
        })
    }
    const seedLock = (discordUserId: string) =>
        ctx.db.seed("memberRoleLocks", {
            _id: `memberRoleLocks:${discordUserId}`,
            guildId: "111111111111111111",
            discordUserId,
            fence: 1,
            leaseUntil: 0,
        })
    seedOperation("old-denied", "400000000000000001", "denied", old)
    seedLock("400000000000000001")
    // The member's newer request keeps the shared Discord lock.
    seedOperation("old-superseded", "400000000000000002", "superseded", old)
    seedOperation("current", "400000000000000002", "pending", old, 0)
    seedLock("400000000000000002")
    seedOperation("recent-failed", "400000000000000003", "failed", recent)
    // Applied is never finished: the bot keeps checking it.
    seedOperation("old-applied", "400000000000000004", "applied", old, 1)
    const reads = spyReads(ctx)
    const result = await invoke(operations.pruneFinished, ctx)
    assert.deepEqual(result, {
        operations: 2,
        audits: 2,
        locks: 1,
        more: false,
    })
    assert.ok(
        reads.some(
            (read) =>
                read.table === "memberRoleOperations" &&
                read.index === "nextAttemptAt_updatedAt"
        )
    )
    assert.deepEqual(
        ctx.db.tables.memberRoleOperations.map((row) => row._id).sort(),
        [
            "memberRoleOperations:current",
            "memberRoleOperations:old-applied",
            "memberRoleOperations:recent-failed",
        ]
    )
    assert.deepEqual(
        ctx.db.tables.memberRoleAudits.map((row) => row._id).sort(),
        [
            "memberRoleAudits:current",
            "memberRoleAudits:old-applied",
            "memberRoleAudits:recent-failed",
        ]
    )
    assert.deepEqual(
        ctx.db.tables.memberRoleLocks.map((row) => row._id),
        ["memberRoleLocks:400000000000000002"]
    )
    assert.equal(ctx.scheduler.calls.length, 0)
    // A full batch reschedules itself until the backlog is gone.
    for (let i = 0; i < 51; i++)
        seedOperation(`backlog-${i}`, "400000000000000005", "denied", old)
    assert.equal((await invoke(operations.pruneFinished, ctx)).more, true)
    assert.equal(ctx.scheduler.calls.length, 1)
    assert.equal((await invoke(operations.pruneFinished, ctx)).operations, 1)
})

test("dashboard and legacy group writers accept a group role a membership policy also uses", async () => {
    const ctx = fixture()
    const group = {
        name: "Shared role group",
        color: "#ffffff",
        order: 0,
        discordRoleId: "member",
    }
    await invoke(groups.upsert, ctx, { secret, guildId: "guilds:a", ...group })
    assert.equal(ctx.db.tables.groups.length, 1)
    ctx.db.seed("apiKeys", {
        _id: "apiKeys:legacy",
        guildId: "111111111111111111",
        keyHash: "hash",
    })
    const args = {
        secret,
        keyHash: "hash",
        idempotencyKey: "request-one",
        bodyHash: "body",
        methodPath: "POST /groups",
        operation: "create",
        ...group,
        name: "Shared role group via API",
    }
    const result = await invoke(publicApi.mutateClanGroup, ctx, args)
    assert.ok(result.status < 300, result.body)
    assert.deepEqual(await invoke(publicApi.mutateClanGroup, ctx, args), result)
    assert.equal(ctx.db.tables.groups.length, 2)
})

test("configuration accepts category roles shared across games", async () => {
    const ctx = fixture(),
        policy = structuredClone(
            ctx.db.tables.discordConfigs[0].membershipSettings
        )
    await invoke(configuration.upsertConfig, ctx, {
        secret,
        guildId: "guilds:a",
        timezone: "UTC",
        defaultLanguage: "en",
        membershipSettings: policy,
        gameOverrides: { wardogs: { membershipSettings: policy } },
    })
    assert.deepEqual(
        ctx.db.tables.discordConfigs[0].gameOverrides?.wardogs
            ?.membershipSettings,
        policy
    )
})

test("unlinked player assignments remain editable but cannot queue Discord grants", async () => {
    const ctx = fixture()
    ctx.db.seed("users", {
        _id: "users:imported",
        id: "imported-unlinked-player",
    })
    await invoke(assignments.upsertByServerDiscordId, ctx, {
        ...save,
        userId: "imported-unlinked-player",
        roleActor: actor,
    })
    assert.equal(
        ctx.db.tables.userAssignments[0].userId,
        "imported-unlinked-player"
    )
    assert.equal(ctx.db.tables.memberRoleOperations[0].status, "denied")
    assert.equal(
        ctx.db.tables.memberRoleOperations[0].reason,
        "target_not_linked"
    )
    assert.equal(
        await invoke(operations.claimNext, ctx, {
            secret,
            guildId: save.serverDiscordId,
        }),
        null
    )
})

test("real legacy bearer assignment mutation remains a data-only write", async () => {
    const ctx = fixture()
    ctx.db.seed("apiKeys", {
        _id: "apiKeys:legacy",
        guildId: save.serverDiscordId,
        keyHash: "hash",
    })
    const result = await invoke(publicApi.mutateClanAssignment, ctx, {
        secret,
        keyHash: "hash",
        idempotencyKey: "assignment-one",
        bodyHash: "body",
        methodPath: "POST /assignments",
        operation: "create",
        userId: save.userId,
        type: "member",
        status: "active",
        paused: false,
        gameId: "hell_let_loose",
        secondaryGroupIds: [],
    })
    assert.equal(result.status, 201)
    assert.equal(ctx.db.tables.memberRoleOperations?.length ?? 0, 0)
})

for (const cache of ["OAuth admin", "role-derived override"])
    test(`freshly revoked Discord authority overrides the ${cache} cache`, async () => {
        const ctx = fixture(),
            claim = await queued(ctx)
        const args = {
            secret,
            ...claim,
            evidence: { ...evidence(), actorRoleIds: [] },
        }
        if (cache === "role-derived override") {
            ctx.db.tables.guilds[0].adminIds = []
            await syncDashboardAdminOverrides(
                ctx as unknown as MutationCtx,
                save.serverDiscordId,
                [{ userId: actor.userId, roleIds: ["dashboard"] }]
            )
            assert.equal(
                ctx.db.tables.guilds[0].adminAccessOverrides[actor.userId],
                true
            )
        }
        assert.equal(
            (await invoke(operations.prepare, ctx, args)).verdict,
            "denied",
            "cached grant must not authorize"
        )
    })

test("explicit dashboard role grants require fresh Discord confirmation and explicit denials still veto the role", async () => {
    const ctx = fixture(),
        claim = await queued(ctx)
    ctx.db.seed("users", { _id: "users:actor", discordId: actor.userId })
    const args = { secret, ...claim, evidence: evidence() }
    await invoke(guilds.setPlayerAdminAccessInternal, ctx, {
        secret,
        serverId: "guilds:a",
        playerId: actor.userId,
        isAdmin: true,
    })
    assert.equal(
        (await invoke(operations.prepare, ctx, args)).verdict,
        "ready",
        "confirmed explicit dashboard role grant works"
    )
    assert.equal(
        (
            await invoke(operations.prepare, ctx, {
                ...args,
                evidence: { ...evidence(), actorRoleIds: [] },
            })
        ).verdict,
        "denied",
        "desired role is not authority until Discord confirms it"
    )
    await invoke(guilds.setPlayerAdminAccessInternal, ctx, {
        secret,
        serverId: "guilds:a",
        playerId: actor.userId,
        isAdmin: false,
    })
    assert.equal(
        (await invoke(operations.prepare, ctx, args)).verdict,
        "denied"
    )
    assert.equal(
        (
            await invoke(operations.prepare, ctx, {
                ...args,
                evidence: { ...evidence(), actorAdministrator: true },
            })
        ).verdict,
        "ready",
        "fresh Discord Administrator retains bootstrap authority"
    )
})

test("linked imported identity keeps its stable assignment key and targets only its explicit Discord account", async () => {
    const ctx = fixture()
    ctx.db.tables.users[0].id = "imported-player"
    await invoke(assignments.upsertByServerDiscordId, ctx, {
        ...save,
        userId: "imported-player",
        roleActor: actor,
    })
    const [operation] = ctx.db.tables.memberRoleOperations
    assert.equal(operation.status, "pending")
    assert.equal(operation.userId, "imported-player")
    assert.equal(operation.discordUserId, save.userId)
    assert.equal(operation.userRecordId, "users:target")
    const claim = await invoke(operations.claimNext, ctx, {
        secret,
        guildId: save.serverDiscordId,
    })
    const work = await invoke(operations.prepare, ctx, {
        secret,
        ...claim,
        evidence: evidence(),
    })
    assert.equal(work.verdict, "ready")
    assert.equal(work.discordUserId, save.userId)
    assert.equal(
        "userId" in work,
        false,
        "provider work must not expose an ambiguous subject"
    )
    const [dto] = await invoke(operations.listForGuild, ctx, {
        secret,
        guildId: save.serverDiscordId,
    })
    assert.equal(dto.userId, "imported-player")
    assert.equal(dto.discordUserId, save.userId)
})

test("a numeric imported identifier without an explicit Discord link cannot queue a grant", async () => {
    const ctx = fixture()
    ctx.db.tables.users[0].id = save.userId
    delete ctx.db.tables.users[0].discordId
    await invoke(assignments.upsertByServerDiscordId, ctx, {
        ...save,
        roleActor: actor,
    })
    assert.equal(ctx.db.tables.userAssignments[0].userId, save.userId)
    assert.equal(ctx.db.tables.memberRoleOperations[0].status, "denied")
    assert.equal(
        ctx.db.tables.memberRoleOperations[0].reason,
        "target_not_linked"
    )
    assert.equal(
        await invoke(operations.claimNext, ctx, {
            secret,
            guildId: save.serverDiscordId,
        }),
        null
    )
})

test("relink, unlink or replacement of the stored player invalidates queued Discord work", async () => {
    for (const change of ["relink", "unlink", "replace"] as const) {
        const ctx = fixture()
        ctx.db.tables.users[0].id = "imported-player"
        await invoke(assignments.upsertByServerDiscordId, ctx, {
            ...save,
            userId: "imported-player",
            roleActor: actor,
        })
        const claim = await invoke(operations.claimNext, ctx, {
            secret,
            guildId: save.serverDiscordId,
        })
        assert.ok(claim)
        if (change === "relink")
            ctx.db.tables.users[0].discordId = "444444444444444444"
        else if (change === "unlink") delete ctx.db.tables.users[0].discordId
        else ctx.db.tables.users[0]._id = "users:replacement"
        assert.equal(
            (
                await invoke(operations.prepare, ctx, {
                    secret,
                    ...claim,
                    evidence: evidence(),
                })
            ).verdict,
            "superseded",
            change
        )
        assert.equal(
            await invoke(operations.finish, ctx, {
                secret,
                ...claim,
                evidence: { ...evidence(), targetRoleIds: ["clan", "recruit"] },
                outcome: "applied",
                reason: "verified",
            }),
            false,
            change
        )
    }
})

test("aliases of one linked account share the desired version and Discord lock", async () => {
    const ctx = fixture()
    ctx.db.tables.users[0].id = "imported-player"
    const first = await queued(ctx)
    await invoke(assignments.upsertByServerDiscordId, ctx, {
        ...save,
        userId: "imported-player",
        status: "active",
        roleActor: actor,
    })
    const [older, newer] = ctx.db.tables.memberRoleOperations
    assert.equal(older.status, "superseded")
    assert.equal(newer.version, older.version + 1)
    assert.equal(newer.discordUserId, older.discordUserId)
    assert.equal(
        await invoke(operations.claimNext, ctx, {
            secret,
            guildId: save.serverDiscordId,
        }),
        null,
        "older worker still holds the same target lock"
    )
    ctx.db.tables.memberRoleLocks[0].leaseUntil = 0
    const second = await invoke(operations.claimNext, ctx, {
        secret,
        guildId: save.serverDiscordId,
    })
    assert.equal(second.operationId, newer._id)
    assert.ok(second.fence > first.fence)
    assert.equal(ctx.db.tables.memberRoleLocks.length, 1)
})

test("a submitted application queues the recruit role without the clan role (N4-40)", async () => {
    const ctx = fixture()
    await invoke(assignments.upsertByServerDiscordId, ctx, {
        ...save,
        roleActor: { userId: save.userId, kind: "application" },
    })
    const [applied] = ctx.db.tables.memberRoleOperations
    assert.deepEqual(applied.desiredRoleIds, ["recruit"])
    // Accepting as a recruit gives the clan role too.
    await invoke(assignments.upsertByServerDiscordId, ctx, {
        ...save,
        assignmentId: ctx.db.tables.userAssignments[0]._id,
        roleActor: { userId: "333333333333333333", kind: "recruitment" },
    })
    const latest = ctx.db.tables.memberRoleOperations.at(-1)
    assert.deepEqual(latest?.desiredRoleIds, ["clan", "recruit"])
})

test("self application and leave/rejoin checks resolve a stable player to the linked Discord subject", async () => {
    const ctx = fixture()
    ctx.db.tables.users[0].id = "imported-player"
    await invoke(assignments.upsertByServerDiscordId, ctx, {
        ...save,
        userId: "imported-player",
        roleActor: { userId: save.userId, kind: "application" },
    })
    const claim = await invoke(operations.claimNext, ctx, {
        secret,
        guildId: save.serverDiscordId,
    })
    const args = {
        secret,
        ...claim,
        evidence: { ...evidence(), actorRoleIds: [] },
    }
    assert.equal((await invoke(operations.prepare, ctx, args)).verdict, "ready")
    const epoch = await invoke(observations.ensureGuild, ctx, {
        secret,
        guildId: save.serverDiscordId,
    })
    for (const state of ["left", "present"])
        await invoke(observations.applyGateway, ctx, {
            secret,
            guildId: save.serverDiscordId,
            discordUserId: save.userId,
            epoch,
            state,
            roleIds: [],
            observedAt: new Date().toISOString(),
        })
    assert.equal(
        (await invoke(operations.prepare, ctx, args)).verdict,
        "denied"
    )
})

test("dashboard recruits resolve an unambiguous category and preserve roles when ambiguous", async () => {
    const ctx = fixture()
    await invoke(assignments.upsertByServerDiscordId, ctx, {
        ...save,
        membershipCategoryId: undefined,
        roleActor: actor,
    })
    assert.deepEqual(ctx.db.tables.memberRoleOperations[0].desiredRoleIds, [
        "clan",
        "recruit",
    ])
    const ambiguous = fixture()
    ambiguous.db.tables.discordConfigs[0].membershipSettings.categories.push({
        id: "other",
        supportRoleIds: [],
        recruitRoleIds: ["other-recruit"],
        finalRoleIds: [],
    })
    await invoke(assignments.upsertByServerDiscordId, ambiguous, {
        ...save,
        membershipCategoryId: undefined,
        roleActor: actor,
    })
    assert.deepEqual(
        ambiguous.db.tables.memberRoleOperations[0].desiredRoleIds,
        []
    )
    assert.deepEqual(
        ambiguous.db.tables.memberRoleOperations[0].allowedRoleIds,
        []
    )
})

test("daily rechecks reject legacy category-less recruit intents instead of replaying clan-only roles", async () => {
    const ctx = fixture()
    ctx.db.tables.discordConfigs[0].membershipSettings.categories[0].includeClanRoleForRecruit = false
    await invoke(assignments.upsertByServerDiscordId, ctx, {
        ...save,
        membershipCategoryId: undefined,
        roleActor: actor,
    })
    const operation = ctx.db.tables.memberRoleOperations[0]
    assert.deepEqual(operation.desiredRoleIds, ["recruit"])
    // Before category resolution was fixed, this exact assignment/policy
    // produced clan-only intent and allowed deleting the recruit role.
    operation.desiredRoleIds = ["clan"]
    operation.status = "applied"
    operation.nextAttemptAt = 0
    const claim = await invoke(operations.claimNext, ctx, {
        secret,
        guildId: save.serverDiscordId,
    })
    const args = { secret, ...claim, evidence: evidence() }
    const prepared = await invoke(operations.prepare, ctx, args)
    assert.equal(prepared.verdict, "superseded")
    assert.deepEqual(prepared.desiredRoleIds, [])
    assert.equal(
        await invoke(operations.finish, ctx, {
            ...args,
            outcome: "applied",
            reason: "verified",
        }),
        false
    )
    await invoke(operations.finish, ctx, {
        ...args,
        outcome: "superseded",
        reason: "authority_or_state_changed",
    })
    assert.equal(operation.status, "superseded")
    assert.equal(operation.nextAttemptAt, Number.MAX_SAFE_INTEGER)
    // A fresh staff save is required; it gets the correct recruit-only roles.
    await invoke(assignments.upsertByServerDiscordId, ctx, {
        ...save,
        assignmentId: ctx.db.tables.userAssignments[0]._id,
        membershipCategoryId: undefined,
        roleActor: actor,
    })
    assert.deepEqual(
        ctx.db.tables.memberRoleOperations.at(-1)?.desiredRoleIds,
        ["recruit"]
    )
})

test("legacy unresolved-category scope cannot remove category roles", async () => {
    const ctx = fixture()
    ctx.db.tables.discordConfigs[0].membershipSettings.categories.push({
        id: "other",
        supportRoleIds: [],
        recruitRoleIds: ["other-recruit"],
        finalRoleIds: [],
    })
    await invoke(assignments.upsertByServerDiscordId, ctx, {
        ...save,
        membershipCategoryId: undefined,
        roleActor: actor,
    })
    const operation = ctx.db.tables.memberRoleOperations[0]
    operation.allowedRoleIds = ["clan", "member", "recruit", "other-recruit"]
    const claim = await invoke(operations.claimNext, ctx, {
        secret,
        guildId: save.serverDiscordId,
    })
    assert.equal(
        (
            await invoke(operations.prepare, ctx, {
                secret,
                ...claim,
                evidence: evidence(),
            })
        ).verdict,
        "superseded"
    )
})
