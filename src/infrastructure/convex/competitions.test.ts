import { actorFixture, seedDashboardActor } from "./testing/dashboard-actor"
import * as competitions from "../../../convex/competitions"
import { invoke, testContext } from "./testing/database"
import * as events from "../../../convex/events"
import assert from "node:assert/strict"
import test from "node:test"

process.env.INTERNAL_AUTH_SECRET = "dev-internal-auth-secret"
const secret = process.env.INTERNAL_AUTH_SECRET
/** The fixture session attested as a global administrator by the gateway. */
const platform = { secret, actor: { ...actorFixture, superadmin: true } }
/** The same session without the attestation (a workspace administrator). */
const workspaceAdmin = { secret, actor: actorFixture }
const NOW = "2026-10-01T00:00:00.000Z"

function team(
    id: string,
    name: string,
    extra: Record<string, unknown> = {}
): { _id: string; [key: string]: unknown } {
    return {
        _id: id,
        gameId: "hell_let_loose",
        name,
        shortCode: null,
        logoAssetId: null,
        normalizedName: name.toLowerCase(),
        searchText: name,
        archivedAt: null,
        mergedIntoTeamId: null,
        linkedGuildId: null,
        revision: 1,
        createdAt: NOW,
        updatedAt: NOW,
        createdBy: "admin",
        updatedBy: "admin",
        ...extra,
    }
}

function setup() {
    const ctx = testContext()
    seedDashboardActor(ctx.db, "guild-a")
    ctx.db.seed("imageAssets", {
        _id: "imageAssets:omen",
        guildId: "platform",
        kind: "team-logo",
        publicUrl: "https://logi.test/api/image-assets/omen.png",
        state: "ready",
    })
    ctx.db.seed(
        "teamDirectory",
        team("teamDirectory:omen", "Omen", {
            shortCode: "OMN",
            logoAssetId: "imageAssets:omen",
            linkedGuildId: "123456789012345678",
        })
    )
    ctx.db.seed("teamDirectory", team("teamDirectory:circle", "The Circle"))
    ctx.db.seed("teamDirectory", team("teamDirectory:wolves", "Wolves of War"))
    ctx.db.seed("teamDirectory", team("teamDirectory:yoko", "Yoko"))
    ctx.db.seed(
        "teamDirectory",
        team("teamDirectory:old", "Old", { archivedAt: NOW })
    )
    ctx.db.seed(
        "teamDirectory",
        team("teamDirectory:lonestar", "Lonestar", { gameId: "wardogs" })
    )
    return ctx
}
type Ctx = ReturnType<typeof setup>

async function competitionWithDivisions(ctx: Ctx) {
    const created = await invoke(competitions.create, ctx, {
        ...platform,
        input: {
            gameId: "hell_let_loose",
            slug: "spring-cup",
            name: "Spring Cup",
            season: "2026",
        },
    })
    assert.equal(created.ok, true)
    const one = await invoke(competitions.createDivision, ctx, {
        ...platform,
        competitionId: created.competitionId,
        input: { name: "Division 1" },
    })
    const two = await invoke(competitions.createDivision, ctx, {
        ...platform,
        competitionId: created.competitionId,
        input: { name: "Division 2" },
    })
    return {
        competitionId: created.competitionId as string,
        d1: one.divisionId as string,
        d2: two.divisionId as string,
    }
}
async function register(
    ctx: Ctx,
    competitionId: string,
    teamId: string,
    divisionId: string
) {
    return await invoke(competitions.registerTeam, ctx, {
        ...platform,
        competitionId,
        input: { teamId, divisionId },
    })
}

test("every competition read and write for administration requires the global administrator attestation", async () => {
    const ctx = setup()
    await assert.rejects(
        invoke(competitions.adminList, ctx, workspaceAdmin),
        /Forbidden/
    )
    await assert.rejects(
        invoke(competitions.create, ctx, {
            ...workspaceAdmin,
            input: {
                gameId: "hell_let_loose",
                slug: "x1",
                name: "X",
                season: "1",
            },
        }),
        /Forbidden/
    )
    await assert.rejects(
        invoke(competitions.seedEcl2026, ctx, {
            ...platform,
            secret: "wrong",
        })
    )
    // A revoked session loses the attestation's effect.
    ctx.db.tables.dashboardSessions = []
    await assert.rejects(
        invoke(competitions.adminList, ctx, platform),
        /Forbidden/
    )
    assert.equal(ctx.db.tables.competitions, undefined)
})

test("competitions are created unpublished, edited with a unique slug and hidden from public reads until published", async () => {
    const ctx = setup()
    const input = {
        gameId: "hell_let_loose",
        slug: "spring-cup",
        name: "Spring Cup",
        season: "2026",
        description: "Friendly cup",
    }
    const created = await invoke(competitions.create, ctx, {
        ...platform,
        input,
    })
    assert.equal(created.ok, true)
    assert.equal(created.slug, "spring-cup")
    assert.deepEqual(
        await invoke(competitions.create, ctx, { ...platform, input }),
        { error: "duplicate_slug" }
    )
    assert.deepEqual(
        await invoke(competitions.create, ctx, {
            ...platform,
            input: { ...input, slug: "Bad Slug" },
        }),
        { error: "invalid_competition" }
    )
    // Legacy competition without the flag stays public.
    ctx.db.seed("competitions", {
        _id: "competitions:legacy",
        slug: "legacy-cup",
        name: "Legacy",
        season: "2025",
        format: { kind: "league_with_playoffs", standings: "ecl_cap_score" },
        createdAt: NOW,
        updatedAt: NOW,
    })
    assert.equal(
        await invoke(competitions.getPublic, ctx, {
            secret,
            slug: "spring-cup",
        }),
        null
    )
    assert.deepEqual(
        await invoke(competitions.listPublicSlugs, ctx, { secret }),
        ["legacy-cup"]
    )
    const listed = await invoke(competitions.adminList, ctx, platform)
    assert.deepEqual(
        listed
            .map((row: { slug: string; published: boolean }) => [
                row.slug,
                row.published,
            ])
            .sort(),
        [
            ["legacy-cup", true],
            ["spring-cup", false],
        ]
    )
    assert.deepEqual(
        await invoke(competitions.update, ctx, {
            ...platform,
            competitionId: created.competitionId,
            input: { slug: "legacy-cup" },
        }),
        { error: "duplicate_slug" }
    )
    assert.deepEqual(
        await invoke(competitions.update, ctx, {
            ...platform,
            competitionId: created.competitionId,
            input: { gameId: "wardogs" },
        }),
        { error: "invalid_competition" }
    )
    assert.deepEqual(
        await invoke(competitions.update, ctx, {
            ...platform,
            competitionId: "competitions:missing",
            input: { published: true },
        }),
        { error: "not_found" }
    )
    assert.deepEqual(
        await invoke(competitions.update, ctx, {
            ...platform,
            competitionId: created.competitionId,
            input: {
                slug: "spring-cup-2026",
                published: true,
                description: null,
            },
        }),
        { ok: true, slug: "spring-cup-2026", previousSlug: "spring-cup" }
    )
    const stored = ctx.db.tables.competitions.find(
        (row) => row._id === created.competitionId
    )!
    assert.equal(stored.description, undefined)
    assert.equal(stored.gameId, "hell_let_loose")
    const shown = await invoke(competitions.getPublic, ctx, {
        secret,
        slug: "spring-cup-2026",
    })
    assert.equal(shown.name, "Spring Cup")
    assert.equal(shown.description, null)
    assert.deepEqual(
        (await invoke(competitions.listPublicSlugs, ctx, { secret })).sort(),
        ["legacy-cup", "spring-cup-2026"]
    )
})

test("divisions are unique, reordered as a whole and deleted only when empty", async () => {
    const ctx = setup()
    const { competitionId, d1, d2 } = await competitionWithDivisions(ctx)
    assert.deepEqual(
        await invoke(competitions.createDivision, ctx, {
            ...platform,
            competitionId,
            input: { name: " division  1 " },
        }),
        { error: "duplicate_division" }
    )
    assert.deepEqual(
        await invoke(competitions.renameDivision, ctx, {
            ...platform,
            divisionId: d2,
            input: { name: "Division 1" },
        }),
        { error: "duplicate_division" }
    )
    assert.equal(
        (
            await invoke(competitions.renameDivision, ctx, {
                ...platform,
                divisionId: d2,
                input: { name: "Premier" },
            })
        ).ok,
        true
    )
    assert.deepEqual(
        await invoke(competitions.reorderDivisions, ctx, {
            ...platform,
            competitionId,
            input: { divisionIds: [d2] },
        }),
        { error: "invalid_order" }
    )
    assert.equal(
        (
            await invoke(competitions.reorderDivisions, ctx, {
                ...platform,
                competitionId,
                input: { divisionIds: [d2, d1] },
            })
        ).ok,
        true
    )
    const view = await invoke(competitions.adminGet, ctx, {
        ...platform,
        competitionId,
    })
    assert.deepEqual(
        view.divisions.map((row: { name: string }) => row.name),
        ["Premier", "Division 1"]
    )
    await register(ctx, competitionId, "teamDirectory:omen", d1)
    assert.deepEqual(
        await invoke(competitions.deleteDivision, ctx, {
            ...platform,
            divisionId: d1,
        }),
        { error: "division_not_empty" }
    )
    assert.equal(
        (
            await invoke(competitions.deleteDivision, ctx, {
                ...platform,
                divisionId: d2,
            })
        ).ok,
        true
    )
    assert.deepEqual(
        await invoke(competitions.deleteDivision, ctx, {
            ...platform,
            divisionId: d2,
        }),
        { error: "division_not_found" }
    )
})

test("registrations admit active teams of the competition's game once and keep fixtures consistent", async () => {
    const ctx = setup()
    const { competitionId, d1, d2 } = await competitionWithDivisions(ctx)
    const omen = await register(ctx, competitionId, "teamDirectory:omen", d1)
    assert.equal(omen.ok, true)
    assert.deepEqual(
        await register(ctx, competitionId, "teamDirectory:omen", d2),
        { error: "already_registered" }
    )
    assert.deepEqual(
        await register(ctx, competitionId, "teamDirectory:old", d1),
        { error: "team_archived" }
    )
    assert.deepEqual(
        await register(ctx, competitionId, "teamDirectory:lonestar", d1),
        { error: "team_game_mismatch" }
    )
    assert.deepEqual(
        await register(ctx, competitionId, "teamDirectory:missing", d1),
        { error: "team_not_found" }
    )
    // A division of another competition is not this competition's division.
    const other = await invoke(competitions.create, ctx, {
        ...platform,
        input: {
            gameId: "hell_let_loose",
            slug: "other-cup",
            name: "Other",
            season: "1",
        },
    })
    const foreign = await invoke(competitions.createDivision, ctx, {
        ...platform,
        competitionId: other.competitionId,
        input: { name: "Elsewhere" },
    })
    assert.deepEqual(
        await register(
            ctx,
            competitionId,
            "teamDirectory:circle",
            foreign.divisionId
        ),
        { error: "division_not_found" }
    )
    await register(ctx, competitionId, "teamDirectory:circle", d1)
    const wolves = await register(
        ctx,
        competitionId,
        "teamDirectory:wolves",
        d2
    )
    // Withdraw, reinstate and move while no fixture uses the team.
    for (const input of [
        { withdrawn: true },
        { withdrawn: false },
        { divisionId: d1 },
    ])
        assert.equal(
            (
                await invoke(competitions.updateRegistration, ctx, {
                    ...platform,
                    registrationId: wolves.registrationId,
                    input,
                })
            ).ok,
            true
        )
    const fixture = await invoke(competitions.createFixture, ctx, {
        ...platform,
        competitionId,
        input: {
            divisionId: d1,
            phase: "league",
            sideATeamId: "teamDirectory:omen",
            sideBTeamId: "teamDirectory:circle",
            status: "final",
            scoreA: 4,
            scoreB: 1,
        },
    })
    assert.equal(fixture.ok, true)
    assert.deepEqual(
        await invoke(competitions.updateRegistration, ctx, {
            ...platform,
            registrationId: omen.registrationId,
            input: { divisionId: d2 },
        }),
        { error: "registration_has_fixtures" }
    )
    assert.equal(
        (
            await invoke(competitions.updateRegistration, ctx, {
                ...platform,
                registrationId: omen.registrationId,
                input: { withdrawn: true },
            })
        ).ok,
        true
    )
    assert.deepEqual(
        await invoke(competitions.removeRegistration, ctx, {
            ...platform,
            registrationId: omen.registrationId,
        }),
        { error: "registration_has_fixtures" }
    )
    assert.equal(
        (
            await invoke(competitions.removeRegistration, ctx, {
                ...platform,
                registrationId: wolves.registrationId,
            })
        ).ok,
        true
    )
    assert.deepEqual(
        ctx.db.tables.competitionTeams
            .filter((row) => row.competitionId === competitionId)
            .map((row) => [row.teamId, row.divisionId, row.withdrawn]),
        [
            ["teamDirectory:omen", d1, true],
            ["teamDirectory:circle", d1, false],
        ]
    )
})

test("fixtures need registered teams, keep league games in one division and clear scores when scheduled", async () => {
    const ctx = setup()
    const { competitionId, d1, d2 } = await competitionWithDivisions(ctx)
    await register(ctx, competitionId, "teamDirectory:omen", d1)
    await register(ctx, competitionId, "teamDirectory:circle", d1)
    await register(ctx, competitionId, "teamDirectory:wolves", d2)
    const input = {
        divisionId: d1,
        phase: "league",
        sideATeamId: "teamDirectory:omen",
        sideBTeamId: "teamDirectory:circle",
        scheduledAt: "2026-10-10T19:00:00.000Z",
        status: "final",
        scoreA: 5,
        scoreB: 0,
    }
    const create = (patch: Record<string, unknown>) =>
        invoke(competitions.createFixture, ctx, {
            ...platform,
            competitionId,
            input: { ...input, ...patch },
        })
    assert.deepEqual(await create({ sideBTeamId: "teamDirectory:wolves" }), {
        error: "division_mismatch",
    })
    assert.deepEqual(await create({ sideBTeamId: "teamDirectory:yoko" }), {
        error: "team_not_registered",
    })
    assert.deepEqual(await create({ scoreB: null }), {
        error: "invalid_competition",
    })
    assert.deepEqual(await create({ sideBTeamId: "teamDirectory:omen" }), {
        error: "invalid_competition",
    })
    assert.equal(
        (
            await create({
                phase: "playoff",
                sideBTeamId: "teamDirectory:wolves",
            })
        ).ok,
        true
    )
    const created = await create({})
    assert.equal(created.ok, true)
    assert.deepEqual(
        await invoke(competitions.updateFixture, ctx, {
            ...platform,
            fixtureId: created.fixtureId,
            input: { ...input, status: "scheduled" },
        }),
        { ok: true, slug: "spring-cup" }
    )
    const stored = ctx.db.tables.competitionFixtures.find(
        (row) => row._id === created.fixtureId
    )!
    assert.equal(stored.status, "scheduled")
    assert.equal(stored.scoreA, undefined)
    assert.equal(stored.scoreB, undefined)
    assert.equal(stored.scheduledAt, "2026-10-10T19:00:00.000Z")
    assert.deepEqual(
        await invoke(competitions.updateFixture, ctx, {
            ...platform,
            fixtureId: "competitionFixtures:missing",
            input,
        }),
        { error: "not_found" }
    )
})

test("fixture rounds are stored, kept when a write leaves them out, cleared with null and read by administration", async () => {
    const ctx = setup()
    const { competitionId, d1 } = await competitionWithDivisions(ctx)
    await register(ctx, competitionId, "teamDirectory:omen", d1)
    await register(ctx, competitionId, "teamDirectory:circle", d1)
    const input = {
        divisionId: d1,
        phase: "league",
        sideATeamId: "teamDirectory:omen",
        sideBTeamId: "teamDirectory:circle",
        status: "scheduled",
    }
    const created = await invoke(competitions.createFixture, ctx, {
        ...platform,
        competitionId,
        input: { ...input, round: 3 },
    })
    assert.equal(created.ok, true)
    const stored = () =>
        ctx.db.tables.competitionFixtures.find(
            (row) => row._id === created.fixtureId
        )!
    assert.equal(stored().round, 3)
    const update = (patch: Record<string, unknown>) =>
        invoke(competitions.updateFixture, ctx, {
            ...platform,
            fixtureId: created.fixtureId,
            input: { ...input, ...patch },
        })
    assert.equal((await update({})).ok, true)
    assert.equal(stored().round, 3)
    assert.equal((await update({ round: 4 })).ok, true)
    assert.equal(stored().round, 4)
    assert.deepEqual(await update({ round: 0 }), {
        error: "invalid_competition",
    })
    const view = await invoke(competitions.adminGet, ctx, {
        ...platform,
        competitionId,
    })
    assert.equal(view.fixtures[0].round, 4)
    assert.equal(view.fixtures[0].event, null)
    assert.equal((await update({ round: null })).ok, true)
    assert.equal(stored().round, undefined)
    const unnumbered = await invoke(competitions.createFixture, ctx, {
        ...platform,
        competitionId,
        input,
    })
    assert.equal(
        ctx.db.tables.competitionFixtures.find(
            (row) => row._id === unnumbered.fixtureId
        )!.round,
        undefined
    )
})

test("public competitions carry global team IDs, short codes and logos, with legacy rows still readable", async () => {
    const ctx = setup()
    const { competitionId, d1 } = await competitionWithDivisions(ctx)
    await invoke(competitions.update, ctx, {
        ...platform,
        competitionId,
        input: { published: true },
    })
    await register(ctx, competitionId, "teamDirectory:omen", d1)
    await register(ctx, competitionId, "teamDirectory:circle", d1)
    const fixture = await invoke(competitions.createFixture, ctx, {
        ...platform,
        competitionId,
        input: {
            divisionId: d1,
            phase: "league",
            sideATeamId: "teamDirectory:omen",
            sideBTeamId: "teamDirectory:circle",
            status: "forfeit",
            scoreA: 5,
            scoreB: 0,
        },
    })
    // Not-yet-migrated rows that still reference a workspace.
    ctx.db.seed("guilds", { _id: "guilds:ghost", name: "Yoko" })
    ctx.db.seed("competitionTeams", {
        _id: "competitionTeams:legacy",
        competitionId,
        guildId: "guilds:ghost",
        divisionId: d1,
        withdrawn: false,
    })
    ctx.db.seed("competitionFixtures", {
        _id: "competitionFixtures:legacy",
        competitionId,
        divisionId: d1,
        phase: "league",
        teamAId: "guilds:ghost",
        teamBId: "guilds:missing",
        status: "scheduled",
        createdAt: NOW,
        updatedAt: NOW,
    })
    const shown = await invoke(competitions.getPublic, ctx, {
        secret,
        slug: "spring-cup",
    })
    assert.deepEqual(shown.divisions[0].teams, [
        {
            id: "teamDirectory:omen",
            name: "Omen",
            shortCode: "OMN",
            logoUrl: "https://logi.test/api/image-assets/omen.png",
            withdrawn: false,
        },
        {
            id: "teamDirectory:circle",
            name: "The Circle",
            shortCode: null,
            logoUrl: null,
            withdrawn: false,
        },
        {
            id: "guild:guilds:ghost",
            name: "Yoko",
            shortCode: null,
            logoUrl: null,
            withdrawn: false,
        },
    ])
    assert.deepEqual(shown.divisions[0].fixtures, [
        {
            id: fixture.fixtureId,
            phase: "league",
            teamAId: "teamDirectory:omen",
            teamBId: "teamDirectory:circle",
            participantTeamIds: ["teamDirectory:omen", "teamDirectory:circle"],
            scoreA: 5,
            scoreB: 0,
            status: "forfeit",
            scheduledAt: undefined,
            eventId: undefined,
            round: undefined,
        },
        {
            id: "competitionFixtures:legacy",
            phase: "league",
            teamAId: "guild:guilds:ghost",
            teamBId: "guild:guilds:missing",
            scoreA: undefined,
            scoreB: undefined,
            status: "scheduled",
            scheduledAt: undefined,
            eventId: undefined,
            round: undefined,
        },
    ])
    assert.equal(shown.divisions[1].teams.length, 0)
    const view = await invoke(competitions.adminGet, ctx, {
        ...platform,
        competitionId,
    })
    assert.equal(view.legacyRows, 2)
    const legacy = view.fixtures.find(
        (row: { id: string }) => row.id === "competitionFixtures:legacy"
    )
    assert.deepEqual(
        [legacy.sideA.name, legacy.sideB.name, legacy.sideB.legacy],
        ["Yoko", "Unknown team", true]
    )
    // Legacy rows block linking until migrated.
    assert.deepEqual(
        await invoke(competitions.linkEvent, ctx, {
            ...platform,
            fixtureId: "competitionFixtures:legacy",
            input: { eventId: "events:any" },
        }),
        { error: "migration_pending" }
    )
})

test("a fixture links to one free match event of the same game with both teams, and unlinks cleanly", async () => {
    const ctx = setup()
    const { competitionId, d1 } = await competitionWithDivisions(ctx)
    await register(ctx, competitionId, "teamDirectory:omen", d1)
    await register(ctx, competitionId, "teamDirectory:circle", d1)
    await register(ctx, competitionId, "teamDirectory:wolves", d1)
    const fixture = (sideBTeamId: string) =>
        invoke(competitions.createFixture, ctx, {
            ...platform,
            competitionId,
            input: {
                divisionId: d1,
                phase: "league",
                sideATeamId: "teamDirectory:omen",
                sideBTeamId,
                status: "scheduled",
            },
        })
    const first = await fixture("teamDirectory:circle")
    const second = await fixture("teamDirectory:wolves")
    const assignment = (
        teamId: string,
        slot: string,
        side: string | null = null
    ) => ({
        teamId,
        slot,
        side,
        snapshot: {},
    })
    ctx.db.seed("guilds", {
        _id: "guilds:omen",
        name: "Omen workspace",
        discordId: "123456789012345678",
    })
    const event = (id: string, extra: Record<string, unknown>) =>
        ctx.db.seed("events", {
            _id: id,
            guildId: "123456789012345678",
            kind: "match",
            gameId: "hell_let_loose",
            name: id,
            gameStart: "2026-10-10T19:00:00.000Z",
            ...extra,
        })
    // The imported score is Axis 3 : Allies 2; Omen (fixture side A) played Allies.
    event("events:match", {
        matchTeams: [
            assignment("teamDirectory:circle", "a", "Axis"),
            assignment("teamDirectory:omen", "b", "Allies"),
        ],
        eventResult: { score: { sideA: 3, sideB: 2 } },
    })
    event("events:training", { kind: "training" })
    event("events:wardogs", { gameId: "wardogs" })
    event("events:others", {
        matchTeams: [
            assignment("teamDirectory:omen", "a"),
            assignment("teamDirectory:yoko", "b"),
        ],
    })
    event("events:legacy", { gameStart: "2026-10-09T19:00:00.000Z" })
    const link = (fixtureId: string, eventId: string | null) =>
        invoke(competitions.linkEvent, ctx, {
            ...platform,
            fixtureId,
            input: { eventId },
        })
    assert.deepEqual(await link(first.fixtureId, "events:missing"), {
        error: "event_not_found",
    })
    assert.deepEqual(await link(first.fixtureId, "events:training"), {
        error: "event_not_match",
    })
    assert.deepEqual(await link(first.fixtureId, "events:wardogs"), {
        error: "event_game_mismatch",
    })
    assert.deepEqual(await link(first.fixtureId, "events:others"), {
        error: "event_team_mismatch",
    })
    const candidates = await invoke(competitions.linkCandidates, ctx, {
        ...platform,
        fixtureId: first.fixtureId,
    })
    assert.deepEqual(
        candidates.map((row: { id: string; teamsMatch: boolean }) => [
            row.id,
            row.teamsMatch,
        ]),
        [
            ["events:match", true],
            ["events:others", false],
            ["events:legacy", false],
        ]
    )
    assert.equal(candidates[0].workspace, "Omen workspace")
    assert.equal(candidates[0].hasResult, true)
    assert.equal((await link(first.fixtureId, "events:match")).ok, true)
    const stored = () =>
        ctx.db.tables.competitionFixtures.find(
            (row) => row._id === first.fixtureId
        )!
    assert.equal(stored().eventId, "events:match")
    // Linking only relates the local event; a reviewed result finalizes it.
    assert.deepEqual(
        [stored().status, stored().scoreA, stored().scoreB],
        ["scheduled", undefined, undefined]
    )
    const linkedEvent = () =>
        ctx.db.tables.events.find((row) => row._id === "events:match")!
    assert.equal(linkedEvent().competitionFixtureId, first.fixtureId)
    assert.deepEqual(await link(second.fixtureId, "events:match"), {
        error: "event_already_linked",
    })
    // Relinking the same pair is idempotent; a legacy match without teams can be linked.
    assert.equal((await link(first.fixtureId, "events:match")).ok, true)
    assert.equal((await link(first.fixtureId, "events:legacy")).ok, true)
    assert.equal(linkedEvent().competitionFixtureId, first.fixtureId)
    assert.equal(stored().eventId, "events:match")
    assert.equal((await link(first.fixtureId, null)).ok, true)
    assert.equal(stored().eventId, undefined)
    assert.equal(
        ctx.db.tables.events.find((row) => row._id === "events:legacy")!
            .competitionFixtureId,
        undefined
    )
    // Deleting a linked fixture releases its event.
    assert.deepEqual(await link(second.fixtureId, "events:match"), {
        error: "event_team_mismatch",
    })
    assert.equal((await link(second.fixtureId, "events:legacy")).ok, true)
    const legacyEvent = () =>
        ctx.db.tables.events.find((row) => row._id === "events:legacy")!
    assert.equal(legacyEvent().competitionFixtureId, second.fixtureId)
    assert.equal(
        (
            await invoke(competitions.deleteFixture, ctx, {
                ...platform,
                fixtureId: second.fixtureId,
            })
        ).ok,
        true
    )
    assert.equal(legacyEvent().competitionFixtureId, undefined)
})

test("a result without known sides is not guessed, and new fixture teams release the linked event", async () => {
    const ctx = setup()
    const { competitionId, d1 } = await competitionWithDivisions(ctx)
    for (const team of ["omen", "circle", "wolves"])
        await register(ctx, competitionId, `teamDirectory:${team}`, d1)
    const created = await invoke(competitions.createFixture, ctx, {
        ...platform,
        competitionId,
        input: {
            divisionId: d1,
            phase: "league",
            sideATeamId: "teamDirectory:omen",
            sideBTeamId: "teamDirectory:circle",
            status: "scheduled",
        },
    })
    ctx.db.seed("events", {
        _id: "events:sideless",
        guildId: "123456789012345678",
        kind: "match",
        gameId: "hell_let_loose",
        name: "sideless",
        gameStart: "2026-10-10T19:00:00.000Z",
        matchTeams: [
            {
                teamId: "teamDirectory:omen",
                slot: "a",
                side: null,
                snapshot: {},
            },
            {
                teamId: "teamDirectory:circle",
                slot: "b",
                side: null,
                snapshot: {},
            },
        ],
        eventResult: { score: { sideA: 5, sideB: 0 } },
    })
    assert.equal(
        (
            await invoke(competitions.linkEvent, ctx, {
                ...platform,
                fixtureId: created.fixtureId,
                input: { eventId: "events:sideless" },
            })
        ).ok,
        true
    )
    const stored = () =>
        ctx.db.tables.competitionFixtures.find(
            (row) => row._id === created.fixtureId
        )!
    assert.deepEqual(
        [stored().status, stored().scoreA, stored().scoreB],
        ["scheduled", undefined, undefined]
    )
    assert.equal(
        (
            await invoke(competitions.updateFixture, ctx, {
                ...platform,
                fixtureId: created.fixtureId,
                input: {
                    divisionId: d1,
                    phase: "league",
                    sideATeamId: "teamDirectory:omen",
                    sideBTeamId: "teamDirectory:wolves",
                    status: "scheduled",
                },
            })
        ).ok,
        true
    )
    assert.equal(stored().eventId, undefined)
    assert.equal(
        ctx.db.tables.events.find((row) => row._id === "events:sideless")!
            .competitionFixtureId,
        undefined
    )
})

test("an imported result updates a linked fixture by each team's side, never blindly", async () => {
    const ctx = setup()
    const { competitionId, d1 } = await competitionWithDivisions(ctx)
    for (const team of ["omen", "circle"])
        await register(ctx, competitionId, `teamDirectory:${team}`, d1)
    const created = await invoke(competitions.createFixture, ctx, {
        ...platform,
        competitionId,
        input: {
            divisionId: d1,
            phase: "league",
            sideATeamId: "teamDirectory:omen",
            sideBTeamId: "teamDirectory:circle",
            status: "scheduled",
        },
    })
    ctx.db.seed("events", {
        _id: "events:imported",
        guildId: "123456789012345678",
        kind: "match",
        gameId: "hell_let_loose",
        name: "imported",
        gameStart: "2026-10-10T19:00:00.000Z",
        matchTeams: [
            {
                teamId: "teamDirectory:omen",
                slot: "a",
                side: "Allies",
                snapshot: {},
            },
            {
                teamId: "teamDirectory:circle",
                slot: "b",
                side: "Axis",
                snapshot: {},
            },
        ],
    })
    await invoke(competitions.linkEvent, ctx, {
        ...platform,
        fixtureId: created.fixtureId,
        input: { eventId: "events:imported" },
    })
    // Axis (Circle) won 5:0; Omen is fixture side A.
    await invoke(events.setResult, ctx, {
        secret,
        eventId: "events:imported",
        eventResult: {
            sourceUrl: "https://crcon.example.test/games/1",
            mapId: "1",
            importedAt: "2026-10-10T21:00:00.000Z",
            sideA: "Axis",
            sideB: "Allies",
            outcome: "defeat",
            score: { sideA: 5, sideB: 0 },
        },
    })
    const fixture = ctx.db.tables.competitionFixtures.find(
        (row) => row._id === created.fixtureId
    )!
    assert.deepEqual(
        [fixture.status, fixture.scoreA, fixture.scoreB],
        ["final", 0, 5]
    )
})

test("the ECL seed creates or reuses global catalogue teams instead of placeholder clans", async () => {
    const ctx = setup()
    const guildsBefore = ctx.db.tables.guilds.length
    const seeded = await invoke(competitions.seedEcl2026, ctx, platform)
    assert.equal(seeded.ok, true)
    assert.equal(seeded.slug, "ecl-2026")
    // Omen, The Circle, Wolves of War and Yoko already exist in the catalogue.
    assert.equal(seeded.teamsCreated, 27 - 4)
    assert.equal(ctx.db.tables.guilds.length, guildsBefore)
    const competition = ctx.db.tables.competitions[0]
    assert.equal(competition.published, true)
    assert.equal(ctx.db.tables.competitionDivisions.length, 6)
    assert.equal(ctx.db.tables.competitionTeams.length, 27)
    assert.ok(ctx.db.tables.competitionTeams.every((row) => row.teamId))
    assert.equal(
        ctx.db.tables.competitionTeams.find(
            (row) => row.teamId === "teamDirectory:omen"
        )!.withdrawn,
        false
    )
    const bober = ctx.db.tables.teamDirectory.find(
        (row) => row.name === "Bober Kurwa"
    )!
    assert.equal(bober.linkedGuildId, null)
    assert.equal(bober.createdBy, actorFixture.subject)
    assert.equal(
        ctx.db.tables.competitionTeams.find((row) => row.teamId === bober._id)!
            .withdrawn,
        true
    )
    assert.ok(
        ctx.db.tables.teamDirectoryAudit.some(
            (row) => row.teamId === bober._id && row.operation === "create"
        )
    )
    // Re-running fills nothing new.
    const again = await invoke(competitions.seedEcl2026, ctx, platform)
    assert.equal(again.teamsCreated, 0)
    assert.equal(ctx.db.tables.competitionTeams.length, 27)
    assert.equal(ctx.db.tables.teamDirectory.length, 6 + 23)
    // Legacy rows must be migrated first.
    ctx.db.seed("competitionTeams", {
        _id: "competitionTeams:legacy",
        competitionId: competition._id,
        guildId: "guilds:admin",
        withdrawn: false,
    })
    assert.deepEqual(await invoke(competitions.seedEcl2026, ctx, platform), {
        error: "migration_pending",
    })
})

test("clan fixture labels name published competitions of the clan's linked matches only", async () => {
    const ctx = testContext()
    const competition = (id: string, published?: boolean) =>
        ctx.db.seed("competitions", {
            _id: id,
            slug: id,
            name: "ECL",
            season: "2026",
            published,
            format: {
                kind: "league_with_playoffs",
                standings: "ecl_cap_score",
            },
            createdAt: NOW,
            updatedAt: NOW,
        })
    competition("competitions:ecl")
    competition("competitions:draft", false)
    const linked = (
        eventId: string,
        fixtureId: string,
        competitionId: string,
        event: Record<string, unknown> = {},
        fixtureEventId: string = eventId
    ) => {
        ctx.db.seed("events", {
            _id: eventId,
            guildId: "guild-a",
            kind: "match",
            name: eventId,
            competitionFixtureId: fixtureId,
            ...event,
        })
        ctx.db.seed("competitionFixtures", {
            _id: fixtureId,
            competitionId,
            phase: "playoff",
            status: "scheduled",
            eventId: fixtureEventId,
            createdAt: NOW,
            updatedAt: NOW,
        })
    }
    linked("events:a", "competitionFixtures:a", "competitions:ecl")
    linked("events:hidden", "competitionFixtures:b", "competitions:draft")
    linked("events:draft", "competitionFixtures:c", "competitions:ecl", {
        isDraft: true,
    })
    linked(
        "events:stale",
        "competitionFixtures:d",
        "competitions:ecl",
        {},
        "events:other"
    )
    linked("events:other-clan", "competitionFixtures:e", "competitions:ecl", {
        guildId: "guild-b",
    })
    const list = (args: Record<string, unknown> = {}) =>
        invoke(competitions.listClanFixtureLabels, ctx, {
            secret,
            guildId: "guild-a",
            ...args,
        })
    assert.deepEqual(await list(), [
        { eventId: "events:a", name: "ECL", season: "2026", phase: "playoff" },
    ])
    assert.deepEqual(
        (await list({ guildId: "guild-b" })).map(
            (row: { eventId: string }) => row.eventId
        ),
        ["events:other-clan"]
    )
    await assert.rejects(list({ secret: "wrong" }))
})
