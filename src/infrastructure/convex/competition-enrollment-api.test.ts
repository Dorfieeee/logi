import { seedDashboardActor, actorFixture } from "./testing/dashboard-actor"
import * as api from "../../../convex/competitionEnrollmentApi"
import { testContext, invoke } from "./testing/database"
import assert from "node:assert/strict"
import test from "node:test"
const secret = "dev-internal-auth-secret"
const guildId = "223456789012345678"
const access = {
    secret,
    guildId,
    keyHash: "a".repeat(64),
    actorTokenHash: "b".repeat(64),
    gameId: "hell_let_loose",
}
function setup(t: import("node:test").TestContext) {
    const previous = process.env.LOGI_SSO_ENABLED
    process.env.INTERNAL_AUTH_SECRET = secret
    process.env.LOGI_SSO_ENABLED = "true"
    t.after(() => {
        if (previous === undefined) delete process.env.LOGI_SSO_ENABLED
        else process.env.LOGI_SSO_ENABLED = previous
    })
    const ctx = testContext()
    seedDashboardActor(ctx.db, guildId)
    Object.assign(ctx.db.tables.guilds[0], {
        memberIds: [actorFixture.subject],
        members: [],
    })
    ctx.db.seed("ssoApplications", {
        _id: "ssoApplications:one",
        guildId: "guilds:admin",
        clientId: "fixture-client",
        clientSecretHash: "c".repeat(64),
    })
    ctx.db.seed("ssoAccessTokens", {
        _id: "ssoAccessTokens:one",
        tokenHash: access.actorTokenHash,
        applicationRecordId: "ssoApplications:one",
        clientId: "fixture-client",
        clientSecretHash: "c".repeat(64),
        userId: actorFixture.subject,
        userRecordId: actorFixture.userRecordId,
        sessionId: actorFixture.sid,
        scope: "openid profile",
        expiresAt: Date.now() + 3600_000,
    })
    ctx.db.seed("apiKeys", {
        _id: "apiKeys:one",
        guildId,
        keyHash: access.keyHash,
    })
    ctx.db.seed("teamDirectory", {
        _id: "teamDirectory:ours",
        name: "Ours",
        gameId: "hell_let_loose",
        linkedGuildId: guildId,
        archivedAt: null,
    })
    ctx.db.seed("competitions", {
        _id: "competitions:cup",
        slug: "cup",
        name: "Cup",
        season: "2026",
        gameId: "hell_let_loose",
        published: true,
        registrationMode: "automatic",
    })
    return ctx
}
const input = {
    action: "enroll",
    competitionId: "competitions:cup",
    teamId: "teamDirectory:ours",
}
test("API enrollment requires a live bound actor and full key, scoped reads accept teams grants", async (t) => {
    const ctx = setup(t)
    assert.equal(
        (await invoke(api.execute, ctx, { ...access, input })).ok,
        true
    )
    assert.equal(
        (await invoke(api.list, ctx, access)).data.competitions.length,
        1
    )
    ctx.db.tables.apiKeys[0].readAccess = {
        resources: ["teams"],
        gameIds: ["hell_let_loose"],
    }
    assert.equal(
        (await invoke(api.execute, ctx, { ...access, input })).error,
        "forbidden"
    )
    assert.equal((await invoke(api.list, ctx, access)).data.teams.length, 1)
    assert.equal(
        (await invoke(api.list, ctx, { ...access, gameId: "wardogs" })).error,
        "forbidden"
    )
    ctx.db.tables.apiKeys[0].revokedAt = "2026-10-01"
    assert.equal((await invoke(api.list, ctx, access)).error, "forbidden")
})
test("API denies foreign apps, expired sessions, non-admins and cross-game writes", async (t) => {
    const ctx = setup(t)
    assert.equal(
        (
            await invoke(api.execute, ctx, {
                ...access,
                gameId: "wardogs",
                input,
            })
        ).error,
        "not_found"
    )
    assert.equal(
        (await invoke(api.list, ctx, { ...access, gameId: "all" })).error,
        "forbidden"
    )
    ctx.db.tables.discordMemberAccess = []
    assert.equal(
        (await invoke(api.execute, ctx, { ...access, input })).error,
        "forbidden"
    )
    seedDashboardActor(ctx.db, guildId)
    ctx.db.tables.dashboardSessions[0].expiresAt = 0
    assert.equal(
        (await invoke(api.execute, ctx, { ...access, input })).error,
        "forbidden"
    )
    ctx.db.tables.dashboardSessions[0].expiresAt = Date.now() + 3600_000
    ctx.db.tables.apiKeys[0].guildId = "foreign"
    assert.equal(
        (await invoke(api.execute, ctx, { ...access, input })).error,
        "forbidden"
    )
})
test("API changes mode only with live admin and rejects restricted service writes", async (t) => {
    const ctx = setup(t)
    assert.equal(
        (await invoke(api.mode, ctx, { ...access, mode: "competitions" })).ok,
        true
    )
    assert.equal(
        (await invoke(api.readMode, ctx, access)).data.mode,
        "competitions"
    )
    ctx.db.tables.apiKeys[0].readAccess = {
        resources: ["teams"],
        gameIds: ["hell_let_loose"],
    }
    assert.equal(
        (await invoke(api.mode, ctx, { ...access, mode: "full" })).error,
        "forbidden"
    )
    assert.equal(ctx.db.tables.guilds[0].workspaceMode, "competitions")
})
