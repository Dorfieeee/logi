import { linkedPlayerCount } from "../../../convex/competitionEnrollmentStore"
import { actorFixture, seedDashboardActor } from "./testing/dashboard-actor"
import * as enrollment from "../../../convex/competitionEnrollment"
import type { QueryCtx } from "../../../convex/_generated/server"
import type { Doc } from "../../../convex/_generated/dataModel"
import * as sessions from "../../../convex/dashboardSessions"
import * as competitions from "../../../convex/competitions"
import { invoke, testContext } from "./testing/database"
import assert from "node:assert/strict"
import test from "node:test"
process.env.INTERNAL_AUTH_SECRET = "dev-internal-auth-secret"
const access = {
    secret: process.env.INTERNAL_AUTH_SECRET,
    actor: actorFixture,
    guildId: "guild-a",
}
const platform = { ...access, actor: { ...actorFixture, superadmin: true } }
function setup(mode = "automatic", minimum: number | null = null) {
    const ctx = testContext()
    seedDashboardActor(ctx.db, "guild-a")
    const guild = ctx.db.tables.guilds[0]
    Object.assign(guild, {
        members: [{ id: actorFixture.subject, status: "member" }],
        memberIds: [actorFixture.subject],
    })
    ctx.db.seed("teamDirectory", {
        _id: "teamDirectory:ours",
        gameId: "hell_let_loose",
        name: "Ours",
        linkedGuildId: "guild-a",
        archivedAt: null,
    })
    ctx.db.seed("teamDirectory", {
        _id: "teamDirectory:foreign",
        gameId: "hell_let_loose",
        name: "Foreign",
        linkedGuildId: "other",
        archivedAt: null,
    })
    ctx.db.seed("competitions", {
        _id: "competitions:cup",
        gameId: "hell_let_loose",
        slug: "cup",
        name: "Cup",
        season: "2026",
        published: true,
        registrationMode: mode,
        minimumLinkedPlayers: minimum,
    })
    return ctx
}
const input = {
    action: "enroll",
    competitionId: "competitions:cup",
    teamId: "teamDirectory:ours",
}
test("clan admins enroll only linked teams; duplicate enrollment stays one row", async () => {
    const ctx = setup()
    assert.equal(
        (await invoke(enrollment.execute, ctx, { ...access, input })).ok,
        true
    )
    assert.equal(
        (await invoke(enrollment.execute, ctx, { ...access, input })).ok,
        true
    )
    assert.equal(ctx.db.tables.competitionTeams.length, 1)
    assert.equal(ctx.db.tables.competitionTeams[0].status, "approved")
    assert.equal(
        (
            await invoke(enrollment.execute, ctx, {
                ...access,
                input: { ...input, teamId: "teamDirectory:foreign" },
            })
        ).error,
        "team_not_owned"
    )
    ctx.db.tables.discordMemberAccess = []
    await assert.rejects(
        invoke(enrollment.execute, ctx, { ...access, input }),
        /Forbidden/
    )
})
test("withdrawals remain possible when closed and retain registration, fixtures and results", async () => {
    const ctx = setup()
    await invoke(enrollment.execute, ctx, { ...access, input })
    const row = { ...ctx.db.tables.competitionTeams[0] }
    ctx.db.tables.competitions[0].registrationMode = "closed"
    ctx.db.seed("competitionFixtures", {
        _id: "competitionFixtures:final",
        competitionId: input.competitionId,
        status: "final",
        scoreA: 5,
        scoreB: 0,
    })
    const withdraw = { ...access, input: { ...input, action: "withdraw" } }
    await invoke(enrollment.execute, ctx, withdraw)
    await invoke(enrollment.execute, ctx, withdraw)
    assert.equal(ctx.db.tables.competitionTeams.length, 1)
    assert.equal(ctx.db.tables.competitionTeams[0]._id, row._id)
    assert.equal(ctx.db.tables.competitionTeams[0].withdrawn, true)
    assert.equal(ctx.db.tables.competitionFixtures[0].scoreA, 5)
    assert.equal(
        (await invoke(enrollment.execute, ctx, { ...access, input })).error,
        "registration_closed"
    )
})
test("approval requests stay private until a superadmin approves; retries cannot undo approval", async () => {
    const ctx = setup("approval")
    await invoke(enrollment.execute, ctx, { ...access, input })
    const row = ctx.db.tables.competitionTeams[0]
    assert.equal(row.status, "pending")
    assert.equal(row.divisionId, undefined)
    await assert.rejects(
        invoke(competitions.updateRegistration, ctx, {
            ...access,
            registrationId: row._id,
            input: { status: "approved" },
        }),
        /Forbidden/
    )
    await invoke(competitions.updateRegistration, ctx, {
        ...platform,
        registrationId: row._id,
        input: { status: "approved" },
    })
    assert.equal(ctx.db.tables.competitionTeams[0].status, "approved")
    await invoke(enrollment.execute, ctx, { ...access, input })
    assert.equal(ctx.db.tables.competitionTeams[0].status, "approved")
    assert.equal(
        (
            await invoke(competitions.updateRegistration, ctx, {
                ...platform,
                registrationId: row._id,
                input: { status: "rejected" },
            })
        ).error,
        "invalid_competition"
    )
})
test("minimum counts signed-in distinct members, never imported-only profiles", async () => {
    const ctx = setup("automatic", 2)
    ctx.db.seed("users", { _id: "users:import", discordId: "imported" })
    ctx.db.tables.guilds[0].memberIds = [
        actorFixture.subject,
        actorFixture.subject,
        "imported",
    ]
    assert.equal((await invoke(enrollment.list, ctx, access)).linkedPlayers, 1)
    assert.equal(
        (await invoke(enrollment.execute, ctx, { ...access, input })).error,
        "minimum_players"
    )
    ctx.db.tables.users[1].firstSignedInAt = Date.now()
    assert.equal(
        await linkedPlayerCount(
            ctx as unknown as QueryCtx,
            ctx.db.tables.guilds[0] as unknown as Doc<"guilds">
        ),
        2
    )
    assert.equal(
        (await invoke(enrollment.execute, ctx, { ...access, input })).ok,
        true
    )
})
test("workspace mode is durable, reversible and admin-only", async () => {
    const ctx = setup()
    await invoke(enrollment.setWorkspaceMode, ctx, {
        ...access,
        mode: "competitions",
    })
    assert.equal(ctx.db.tables.guilds[0].workspaceMode, "competitions")
    await invoke(enrollment.setWorkspaceMode, ctx, { ...access, mode: "full" })
    assert.equal(ctx.db.tables.guilds[0].workspaceMode, "full")
    await assert.rejects(
        invoke(enrollment.setWorkspaceMode, ctx, { ...access, mode: "unknown" })
    )
    ctx.db.tables.discordMemberAccess = []
    await assert.rejects(
        invoke(enrollment.setWorkspaceMode, ctx, {
            ...access,
            mode: "competitions",
        }),
        /Forbidden/
    )
})
test("first login leaves durable evidence even after sessions expire", async () => {
    const ctx = setup()
    await invoke(sessions.create, ctx, {
        secret: access.secret,
        subject: actorFixture.subject,
        sid: "b".repeat(43),
    })
    assert.equal(typeof ctx.db.tables.users[0].firstSignedInAt, "number")
    ctx.db.tables.dashboardSessions = []
    assert.equal(
        await invoke(enrollment.list, ctx, access).catch(() => null),
        null
    )
    assert.equal(
        await linkedPlayerCount(
            ctx as unknown as QueryCtx,
            ctx.db.tables.guilds[0] as unknown as Doc<"guilds">
        ),
        1
    )
})

test("re-applying for approval retains previously accepted public team history", async () => {
    const ctx = setup()
    await invoke(enrollment.execute, ctx, { ...access, input })
    ctx.db.seed("competitionDivisions", {
        _id: "competitionDivisions:one",
        competitionId: input.competitionId,
        name: "Division 1",
        order: 0,
    })
    await ctx.db.patch(ctx.db.tables.competitionTeams[0]._id, {
        divisionId: "competitionDivisions:one",
    })
    await invoke(enrollment.execute, ctx, {
        ...access,
        input: { ...input, action: "withdraw" },
    })
    ctx.db.tables.competitions[0].registrationMode = "approval"
    await invoke(enrollment.execute, ctx, { ...access, input })
    assert.equal(ctx.db.tables.competitionTeams[0].status, "pending")
    const view = await invoke(competitions.getPublic, ctx, {
        secret: access.secret,
        slug: "cup",
    })
    assert.equal(view.divisions[0].teams[0].id, input.teamId)
    assert.equal(view.divisions[0].teams[0].withdrawn, true)
})
