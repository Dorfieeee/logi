import { actorFixture, seedDashboardActor } from "./testing/dashboard-actor"
import * as matchTeams from "../../../convex/matchTeams"
import { invoke, testContext } from "./testing/database"
import * as events from "../../../convex/events"
import * as teams from "../../../convex/teams"
import assert from "node:assert/strict"
import test from "node:test"

const secret = process.env.INTERNAL_AUTH_SECRET ?? "dev-internal-auth-secret"
const guildId = "guild-a"
/** Catalogue writes belong to global administrators. */
const platform = { secret, actor: { ...actorFixture, superadmin: true } }
const logoUrl = "https://logi.test/api/image-assets/" + "a".repeat(32) + ".png"
const schedule = {
    registrationEnd: "2030-01-01T17:00:00.000Z",
    meetingStart: "2030-01-01T18:00:00.000Z",
    gameStart: "2030-01-01T18:30:00.000Z",
    gameEnd: "2030-01-01T20:00:00.000Z",
}
const base = {
    secret,
    serverId: "guilds:admin",
    kind: "match",
    name: "Fixture match",
    pingClan: false,
    ...schedule,
}

function setup() {
    const ctx = testContext()
    seedDashboardActor(ctx.db, guildId)
    ctx.db.tables.guilds[0].enabledGames = ["hell_let_loose", "wardogs"]
    ctx.db.seed("imageAssets", {
        _id: "imageAssets:logo",
        guildId: "platform",
        kind: "team-logo",
        publicId: "a".repeat(32),
        storageId: "storage:logo",
        contentType: "image/png",
        width: 512,
        height: 512,
        bytes: 1000,
        sha256: "b".repeat(64),
        publicUrl: logoUrl,
        state: "ready",
        createdAt: "2026-10-01T00:00:00.000Z",
        createdBy: actorFixture.subject,
    })
    return ctx
}
async function createTeam(
    ctx: ReturnType<typeof setup>,
    gameId: "hell_let_loose" | "wardogs",
    name: string,
    extra: Record<string, unknown> = {}
): Promise<string> {
    const result = await invoke(teams.create, ctx, {
        ...platform,
        input: {
            gameId,
            name,
            idempotencyKey: `create-${gameId}-${name}`,
            ...extra,
        },
    })
    assert.equal(result.ok, true, `team ${name} is created`)
    return result.teamId
}
const upsert = (
    ctx: ReturnType<typeof setup>,
    args: Record<string, unknown>
): Promise<string> => invoke(events.upsert, ctx, { ...base, ...args })
const eventRow = (ctx: ReturnType<typeof setup>) => ctx.db.tables.events[0]
const eventReferences = (ctx: ReturnType<typeof setup>, eventId: string) =>
    (ctx.db.tables.imageAssetReferences ?? []).filter(
        (row) => row.owner === "event" && row.ownerId === eventId
    )

test("HLL saves capture two slot snapshots, keep them when omitted and clear them with []", async () => {
    const ctx = setup()
    const alpha = await createTeam(ctx, "hell_let_loose", "Alpha", {
        shortCode: "ALP",
        logoAssetId: "imageAssets:logo",
    })
    const bravo = await createTeam(ctx, "hell_let_loose", "Bravo")
    const eventId = await upsert(ctx, {
        gameId: "hell_let_loose",
        matchTeams: [
            { teamId: bravo, slot: "b", side: null },
            { teamId: alpha, slot: "a", side: "Allies" },
        ],
    })
    const saved = eventRow(ctx)
    assert.equal(String(saved._id), eventId)
    assert.deepEqual(
        saved.matchTeams.map((entry: { slot: string; teamId: string }) => [
            entry.slot,
            entry.teamId,
        ]),
        [
            ["a", alpha],
            ["b", bravo],
        ]
    )
    assert.equal(saved.matchTeams[0].side, "Allies")
    assert.equal(saved.matchTeams[0].snapshot.name, "Alpha")
    assert.equal(saved.matchTeams[0].snapshot.shortCode, "ALP")
    assert.equal(saved.matchTeams[0].snapshot.logoAssetId, "imageAssets:logo")
    assert.equal(saved.matchTeams[0].snapshot.logoUrl, logoUrl)
    assert.equal(saved.matchTeams[0].snapshot.teamRevision, 1)
    assert.equal(saved.matchTeams[1].snapshot.logoUrl, null)
    assert.deepEqual(
        eventReferences(ctx, eventId).map((row) => row.assetId),
        ["imageAssets:logo"]
    )
    const before = structuredClone(saved.matchTeams)

    // Renaming and archiving the team never rewrites the saved snapshot; an
    // edit of unrelated fields that omits matchTeams preserves the selection.
    await invoke(teams.update, ctx, {
        ...platform,
        teamId: alpha,
        input: { expectedRevision: 1, name: "Alpha Renamed" },
    })
    await invoke(teams.archive, ctx, {
        ...platform,
        teamId: alpha,
        input: { expectedRevision: 2 },
    })
    await upsert(ctx, { eventId, name: "Renamed match" })
    assert.equal(eventRow(ctx).name, "Renamed match")
    assert.deepEqual(eventRow(ctx).matchTeams, before)
    assert.equal(eventReferences(ctx, eventId).length, 1)

    await upsert(ctx, { eventId, matchTeams: [] })
    assert.deepEqual(eventRow(ctx).matchTeams, [])
    assert.equal(eventReferences(ctx, eventId).length, 0)
})

test("Wardogs saves accept three slots with factions, sorted by slot", async () => {
    const ctx = setup()
    const wolf = await createTeam(ctx, "wardogs", "Wolf")
    const lynx = await createTeam(ctx, "wardogs", "Lynx")
    const bear = await createTeam(ctx, "wardogs", "Bear")
    await upsert(ctx, {
        gameId: "wardogs",
        matchTeams: [
            { teamId: bear, slot: "c", side: "Lonestar" },
            { teamId: wolf, slot: "a", side: "Valkyra" },
            { teamId: lynx, slot: "b", side: null },
        ],
    })
    assert.deepEqual(
        eventRow(ctx).matchTeams.map(
            (entry: { slot: string; side: string | null }) => [
                entry.slot,
                entry.side,
            ]
        ),
        [
            ["a", "Valkyra"],
            ["b", null],
            ["c", "Lonestar"],
        ]
    )
    assert.equal(
        "matchTeams" in
            (await (async () => {
                await upsert(ctx, { gameId: "wardogs", name: "Legacy shape" })
                return ctx.db.tables.events[1]
            })()),
        false,
        "a save without the field stays a legacy-shaped record"
    )
})

test("concluded matches allow corrected assignments; trainings, cross-game, unknown and archived teams are rejected", async () => {
    const ctx = setup()
    const alpha = await createTeam(ctx, "hell_let_loose", "Alpha")
    const bravo = await createTeam(ctx, "hell_let_loose", "Bravo")
    const wolf = await createTeam(ctx, "wardogs", "Wolf")
    const eventId = await upsert(ctx, {
        gameId: "hell_let_loose",
        matchTeams: [{ teamId: alpha, slot: "a", side: null }],
    })
    eventRow(ctx).status = "concluded"
    await upsert(ctx, {
        eventId,
        matchTeams: [{ teamId: bravo, slot: "a", side: null }],
    })
    assert.equal(eventRow(ctx).matchTeams[0].teamId, bravo)
    assert.equal(eventRow(ctx).status, "concluded")
    await upsert(ctx, {
        eventId,
        name: "Concluded rename",
        matchTeams: [{ teamId: alpha, slot: "a", side: null }],
    })
    assert.equal(eventRow(ctx).name, "Concluded rename")

    await assert.rejects(
        upsert(ctx, {
            kind: "training",
            matchTeams: [{ teamId: alpha, slot: "a", side: null }],
        }),
        /match_teams:training_event/
    )
    await assert.rejects(
        upsert(ctx, {
            gameId: "hell_let_loose",
            matchTeams: [{ teamId: wolf, slot: "a", side: null }],
        }),
        /match_teams:team_game_mismatch/
    )
    await assert.rejects(
        upsert(ctx, {
            gameId: "hell_let_loose",
            matchTeams: [
                { teamId: "teamDirectory:missing", slot: "a", side: null },
            ],
        }),
        /match_teams:team_not_found/
    )
    await invoke(teams.archive, ctx, {
        ...platform,
        teamId: bravo,
        input: { expectedRevision: 1 },
    })
    await assert.rejects(
        upsert(ctx, {
            gameId: "hell_let_loose",
            matchTeams: [{ teamId: bravo, slot: "a", side: null }],
        }),
        /match_teams:team_archived/
    )
    await assert.rejects(
        upsert(ctx, {
            gameId: "hell_let_loose",
            matchTeams: [
                { teamId: alpha, slot: "a", side: "Allies" },
                { teamId: alpha, slot: "b", side: "Allies" },
            ],
        }),
        /match_teams:invalid_match_teams/
    )
    assert.equal(ctx.db.tables.events.length, 1)
})

test("a match past its end permits team corrections before the bot records conclusion", async () => {
    const ctx = setup()
    const alpha = await createTeam(ctx, "hell_let_loose", "Alpha")
    const bravo = await createTeam(ctx, "hell_let_loose", "Bravo")
    const eventId = await upsert(ctx, {
        gameId: "hell_let_loose",
        matchTeams: [{ teamId: alpha, slot: "a", side: null }],
    })
    // The bot has not recorded the conclusion: the stored status lags behind.
    Object.assign(eventRow(ctx), {
        status: "starting",
        registrationEnd: "2026-01-01T17:00:00.000Z",
        meetingStart: "2026-01-01T18:00:00.000Z",
        gameStart: "2026-01-01T18:30:00.000Z",
        gameEnd: "2026-01-01T20:00:00.000Z",
    })
    await upsert(ctx, {
        eventId,
        registrationEnd: eventRow(ctx).registrationEnd,
        meetingStart: eventRow(ctx).meetingStart,
        gameStart: eventRow(ctx).gameStart,
        gameEnd: eventRow(ctx).gameEnd,
        matchTeams: [{ teamId: bravo, slot: "a", side: null }],
    })
    assert.equal(eventRow(ctx).matchTeams[0].teamId, bravo)
    const refreshed = await invoke(matchTeams.refreshSnapshot, ctx, {
        secret,
        serverId: "guilds:admin",
        eventId,
        teamId: bravo,
        actor: actorFixture,
    })
    assert.equal("error" in refreshed, false)
    assert.equal(eventRow(ctx).status, "concluded")
})

test("an explicit [] on a new match stores an empty selection; omission keeps the legacy shape", async () => {
    const ctx = setup()
    await upsert(ctx, { gameId: "hell_let_loose", matchTeams: [] })
    assert.deepEqual(ctx.db.tables.events[0].matchTeams, [])
    await upsert(ctx, {
        gameId: "hell_let_loose",
        kind: "training",
        name: "Fixture training",
        matchTeams: [],
    })
    assert.equal("matchTeams" in ctx.db.tables.events[1], false)
})

test("a match that becomes a training drops its selection and logo references", async () => {
    for (const matchTeams of [[], undefined]) {
        const ctx = setup()
        const alpha = await createTeam(ctx, "hell_let_loose", "Alpha", {
            logoAssetId: "imageAssets:logo",
        })
        const eventId = await upsert(ctx, {
            gameId: "hell_let_loose",
            matchTeams: [{ teamId: alpha, slot: "a", side: "Allies" }],
        })
        assert.equal(eventReferences(ctx, eventId).length, 1)
        await upsert(ctx, {
            eventId,
            kind: "training",
            ...(matchTeams ? { matchTeams } : {}),
        })
        assert.equal(eventRow(ctx).kind, "training")
        assert.deepEqual(eventRow(ctx).matchTeams, [])
        assert.equal(eventReferences(ctx, eventId).length, 0)
    }
})

test("moving an event to another game rejects a resent team of the former game", async () => {
    const ctx = setup()
    const alpha = await createTeam(ctx, "hell_let_loose", "Alpha")
    const eventId = await upsert(ctx, {
        gameId: "hell_let_loose",
        matchTeams: [{ teamId: alpha, slot: "a", side: null }],
    })
    const saved = structuredClone(eventRow(ctx))
    for (const args of [
        { matchTeams: [{ teamId: alpha, slot: "a", side: null }] },
        {},
    ])
        await assert.rejects(
            upsert(ctx, { eventId, gameId: "wardogs", ...args }),
            /match_teams:team_game_mismatch/
        )
    assert.equal(eventRow(ctx).gameId, "hell_let_loose")
    assert.deepEqual(eventRow(ctx).matchTeams, saved.matchTeams)
})
