import {
    adoptedTeamName,
    checkDivisionDelete,
    checkDivisionName,
    checkDivisionOrder,
    checkEventLink,
    checkFixture,
    checkRegistration,
    checkRegistrationRemoval,
    checkRegistrationUpdate,
    COMPETITION_REGISTRATION_LIMIT,
    competitionCreateSchema,
    competitionUpdateSchema,
    divisionInputSchema,
    divisionOrderSchema,
    fixtureInputSchema,
    isCompetitionPublished,
    legacyTeamKey,
    registrationCreateSchema,
    registrationBatchSchema,
    planTeamRegistrations,
    registrationUpdateSchema,
    type RegisteredTeam,
    fixtureScoreFromEvent,
} from "./competition"
import assert from "node:assert/strict"
import test from "node:test"

const competition = {
    gameId: "hell_let_loose",
    slug: "ecl-2026",
    name: "  European   Community League ",
    season: "2026",
}

test("competition create normalizes labels and starts unpublished", () => {
    assert.deepEqual(competitionCreateSchema.parse(competition), {
        gameId: "hell_let_loose",
        slug: "ecl-2026",
        name: "European Community League",
        season: "2026",
        description: null,
        published: false,
    })
    assert.equal(
        competitionCreateSchema.parse({
            ...competition,
            description: " Line one\nline two ",
            published: true,
        }).description,
        "Line one\nline two"
    )
})

test("competition create rejects bad slugs, unsupported games, empty labels and unknown fields", () => {
    for (const slug of [
        "E",
        "ECL-2026",
        "-ecl",
        "ecl_2026",
        "a",
        "a".repeat(65),
    ])
        assert.equal(
            competitionCreateSchema.safeParse({ ...competition, slug }).success,
            false,
            slug
        )
    assert.equal(
        competitionCreateSchema.safeParse({ ...competition, slug: "e1" })
            .success,
        true
    )
    assert.equal(
        competitionCreateSchema.safeParse({
            ...competition,
            gameId: "hell_let_loose_vietnam",
        }).success,
        false
    )
    assert.equal(
        competitionCreateSchema.safeParse({ ...competition, name: "   " })
            .success,
        false
    )
    assert.equal(
        competitionCreateSchema.safeParse({ ...competition, name: "A\u0007" })
            .success,
        false
    )
    assert.equal(
        competitionCreateSchema.safeParse({ ...competition, format: "cup" })
            .success,
        false
    )
})

test("competition update needs a change and cannot move the game", () => {
    assert.equal(competitionUpdateSchema.safeParse({}).success, false)
    assert.deepEqual(competitionUpdateSchema.parse({ published: false }), {
        published: false,
    })
    assert.deepEqual(competitionUpdateSchema.parse({ description: null }), {
        description: null,
    })
    assert.equal(
        competitionUpdateSchema.safeParse({ gameId: "wardogs" }).success,
        false
    )
})

test("legacy competitions without the flag stay published", () => {
    assert.equal(isCompetitionPublished({}), true)
    assert.equal(isCompetitionPublished({ published: true }), true)
    assert.equal(isCompetitionPublished({ published: false }), false)
})

test("division names are unique per competition ignoring case and spacing", () => {
    const divisions = [
        { id: "d1", name: "Division 1" },
        { id: "d2", name: "Division 2" },
    ]
    assert.equal(
        divisionInputSchema.parse({ name: " Division  3 " }).name,
        "Division 3"
    )
    assert.equal(
        checkDivisionName({ name: "division   1", divisions }),
        "duplicate_division"
    )
    // Renaming a division to its own name (another case) is not a conflict.
    assert.equal(
        checkDivisionName({ name: "DIVISION 1", divisionId: "d1", divisions }),
        null
    )
    assert.equal(checkDivisionName({ name: "Division 3", divisions }), null)
})

test("divisions are deleted only when empty and reordered as a full permutation", () => {
    assert.equal(checkDivisionDelete({ registrations: 0, fixtures: 0 }), null)
    assert.equal(
        checkDivisionDelete({ registrations: 1, fixtures: 0 }),
        "division_not_empty"
    )
    assert.equal(
        checkDivisionDelete({ registrations: 0, fixtures: 2 }),
        "division_not_empty"
    )
    const current = ["d1", "d2", "d3"]
    assert.equal(
        checkDivisionOrder({ current, requested: ["d3", "d1", "d2"] }),
        null
    )
    assert.equal(
        checkDivisionOrder({ current, requested: ["d3", "d1"] }),
        "invalid_order"
    )
    assert.equal(
        checkDivisionOrder({ current, requested: ["d3", "d1", "d4"] }),
        "invalid_order"
    )
    assert.equal(
        divisionOrderSchema.safeParse({ divisionIds: ["d1", "d1"] }).success,
        false
    )
})

test("registration admits one active team of the competition's game per competition", () => {
    const team = {
        gameId: "hell_let_loose" as const,
        archivedAt: null,
        mergedIntoTeamId: null,
    }
    const base = {
        gameId: "hell_let_loose",
        team,
        divisionExists: true,
        alreadyRegistered: false,
        registrations: 0,
    }
    assert.deepEqual(
        registrationCreateSchema.parse({ teamId: "t1", divisionId: "d1" }),
        { teamId: "t1", divisionId: "d1" }
    )
    assert.equal(checkRegistration(base), null)
    assert.equal(checkRegistration({ ...base, team: null }), "team_not_found")
    assert.equal(
        checkRegistration({
            ...base,
            team: { ...team, archivedAt: "2026-10-01T00:00:00.000Z" },
        }),
        "team_archived"
    )
    assert.equal(
        checkRegistration({
            ...base,
            team: { ...team, mergedIntoTeamId: "t2" },
        }),
        "team_archived"
    )
    assert.equal(
        checkRegistration({ ...base, team: { ...team, gameId: "wardogs" } }),
        "team_game_mismatch"
    )
    assert.equal(
        checkRegistration({ ...base, divisionExists: false }),
        "division_not_found"
    )
    assert.equal(
        checkRegistration({ ...base, alreadyRegistered: true }),
        "already_registered"
    )
    assert.equal(
        checkRegistration({
            ...base,
            registrations: COMPETITION_REGISTRATION_LIMIT,
        }),
        "limit_reached"
    )
})

test("registration moves keep league fixtures in their division; removal needs no fixtures", () => {
    assert.equal(registrationUpdateSchema.safeParse({}).success, false)
    const registration = { divisionId: "d1" }
    assert.equal(
        checkRegistrationUpdate({
            registration,
            input: { withdrawn: true },
            divisionExists: false,
            leagueFixturesInCurrentDivision: 4,
        }),
        null
    )
    assert.equal(
        checkRegistrationUpdate({
            registration,
            input: { divisionId: "d2" },
            divisionExists: true,
            leagueFixturesInCurrentDivision: 0,
        }),
        null
    )
    assert.equal(
        checkRegistrationUpdate({
            registration,
            input: { divisionId: "d2" },
            divisionExists: false,
            leagueFixturesInCurrentDivision: 0,
        }),
        "division_not_found"
    )
    assert.equal(
        checkRegistrationUpdate({
            registration,
            input: { divisionId: "d2" },
            divisionExists: true,
            leagueFixturesInCurrentDivision: 1,
        }),
        "registration_has_fixtures"
    )
    assert.equal(checkRegistrationRemoval({ fixtures: 0 }), null)
    assert.equal(
        checkRegistrationRemoval({ fixtures: 1 }),
        "registration_has_fixtures"
    )
})

const fixture = {
    divisionId: "d1",
    phase: "league",
    sideATeamId: "t1",
    sideBTeamId: "t2",
    status: "final",
    scoreA: 5,
    scoreB: 0,
}

test("fixtures need two different teams and both scores for final and forfeit results", () => {
    assert.deepEqual(fixtureInputSchema.parse(fixture), {
        ...fixture,
        scheduledAt: null,
    })
    assert.equal(
        fixtureInputSchema.safeParse({ ...fixture, sideBTeamId: "t1" }).success,
        false
    )
    for (const status of ["final", "forfeit"])
        assert.equal(
            fixtureInputSchema.safeParse({ ...fixture, status, scoreB: null })
                .success,
            false,
            status
        )
    assert.equal(
        fixtureInputSchema.safeParse({ ...fixture, scoreA: 1.5 }).success,
        false
    )
    assert.equal(
        fixtureInputSchema.safeParse({ ...fixture, scoreA: -1 }).success,
        false
    )
    assert.equal(
        fixtureInputSchema.safeParse({ ...fixture, scheduledAt: "tomorrow" })
            .success,
        false
    )
    assert.equal(
        fixtureInputSchema.safeParse({ ...fixture, phase: "group" }).success,
        false
    )
})

test("a fixture round is optional, a whole number from 1 to 99, and null clears it", () => {
    assert.equal(fixtureInputSchema.parse(fixture).round, undefined)
    assert.equal(fixtureInputSchema.parse({ ...fixture, round: 3 }).round, 3)
    assert.equal(
        fixtureInputSchema.parse({ ...fixture, round: null }).round,
        null
    )
    for (const round of [0, 100, 2.5, "3", -1])
        assert.equal(
            fixtureInputSchema.safeParse({ ...fixture, round }).success,
            false,
            String(round)
        )
})

test("a scheduled fixture clears its scores", () => {
    assert.deepEqual(
        fixtureInputSchema.parse({
            ...fixture,
            status: "scheduled",
            scheduledAt: "2026-10-10T19:00:00.000Z",
        }),
        {
            ...fixture,
            status: "scheduled",
            scheduledAt: "2026-10-10T19:00:00.000Z",
            scoreA: null,
            scoreB: null,
        }
    )
})

test("Wardogs fixtures may carry three ordered teams and scores, while HLL remains two-team", () => {
    const wardogs = fixtureInputSchema.parse({
        ...fixture,
        participantTeamIds: ["t1", "t2", "t3"],
        status: "final",
        scoreA: 3,
        scoreB: 2,
        participantScores: [3, 2, 1],
    })
    assert.deepEqual(wardogs.participantTeamIds, ["t1", "t2", "t3"])
    assert.deepEqual(
        "participantScores" in wardogs ? wardogs.participantScores : undefined,
        [3, 2, 1]
    )
    const registrations = new Map<string, RegisteredTeam>([
        ["t1", { divisionId: "d1", gameId: "wardogs" }],
        ["t2", { divisionId: "d1", gameId: "wardogs" }],
        ["t3", { divisionId: "d1", gameId: "wardogs" }],
    ])
    assert.equal(
        checkFixture({
            gameId: "wardogs",
            fixture: wardogs,
            divisionIds: new Set(["d1"]),
            registrations,
        }),
        null
    )
    assert.equal(
        checkFixture({
            gameId: "hell_let_loose",
            fixture: wardogs,
            divisionIds: new Set(["d1"]),
            registrations,
        }),
        "invalid_competition"
    )
})

test("fixture teams must be registered in the competition's game; league fixtures stay in one division", () => {
    const registrations = new Map<string, RegisteredTeam>([
        ["t1", { divisionId: "d1", gameId: "hell_let_loose" }],
        ["t2", { divisionId: "d1", gameId: "hell_let_loose" }],
        ["t3", { divisionId: "d2", gameId: "hell_let_loose" }],
        ["w1", { divisionId: "d1", gameId: "wardogs" }],
    ])
    const check = (input: Record<string, unknown>) =>
        checkFixture({
            gameId: "hell_let_loose",
            fixture: fixtureInputSchema.parse({ ...fixture, ...input }),
            divisionIds: new Set(["d1", "d2"]),
            registrations,
        })
    assert.equal(check({}), null)
    assert.equal(check({ divisionId: "d9" }), "division_not_found")
    assert.equal(check({ sideBTeamId: "t9" }), "team_not_registered")
    assert.equal(check({ sideBTeamId: "w1" }), "team_game_mismatch")
    assert.equal(check({ sideBTeamId: "t3" }), "division_mismatch")
    assert.equal(check({ sideBTeamId: "t3", phase: "playoff" }), null)
    assert.equal(check({ sideBTeamId: "t3", phase: "relegation" }), null)
})

test("event links need a free match of the same game with the fixture's teams", () => {
    const event = {
        kind: "match" as const,
        gameId: "hell_let_loose",
        competitionFixtureId: null,
        teamIds: ["t1", "t2"],
    }
    const base = {
        gameId: "hell_let_loose",
        fixtureId: "f1",
        fixtureTeamIds: ["t2", "t1"] as [string, string],
        event,
        otherFixtureId: null,
    }
    assert.equal(checkEventLink(base), null)
    assert.equal(checkEventLink({ ...base, event: null }), "event_not_found")
    assert.equal(
        checkEventLink({ ...base, event: { ...event, kind: "training" } }),
        "event_not_match"
    )
    assert.equal(
        checkEventLink({ ...base, event: { ...event, gameId: "wardogs" } }),
        "event_game_mismatch"
    )
    assert.equal(
        checkEventLink({
            ...base,
            event: { ...event, competitionFixtureId: "f2" },
        }),
        "event_already_linked"
    )
    assert.equal(
        checkEventLink({ ...base, otherFixtureId: "f2" }),
        "event_already_linked"
    )
    // Relinking the same pair is idempotent.
    assert.equal(
        checkEventLink({
            ...base,
            event: { ...event, competitionFixtureId: "f1" },
            otherFixtureId: "f1",
        }),
        null
    )
    assert.equal(
        checkEventLink({ ...base, event: { ...event, teamIds: ["t1", "t3"] } }),
        "event_team_mismatch"
    )
    // A clan's local event may name just its own team; its logistics remain
    // local while the fixture is the shared league anchor.
    assert.equal(
        checkEventLink({ ...base, event: { ...event, teamIds: ["t1"] } }),
        null
    )
    // A legacy match without assigned teams can still be linked.
    assert.equal(
        checkEventLink({ ...base, event: { ...event, teamIds: [] } }),
        null
    )
})

test("legacy workspace references keep a stable key and a usable catalogue name", () => {
    assert.equal(legacyTeamKey("guilds:1"), "guild:guilds:1")
    assert.equal(adoptedTeamName("  Valkyria  ", "x"), "Valkyria")
    assert.equal(adoptedTeamName("Bad\u0007Name", "x"), "Bad Name")
    assert.equal(adoptedTeamName("A".repeat(130), "x").length, 120)
    assert.equal(adoptedTeamName("\u0007", "Team guilds:9"), "Team guilds:9")
})

test("an imported Axis/Allies score reaches the fixture by each team's assigned side", () => {
    const fixture = { sideATeamId: "omen", sideBTeamId: "circle" }
    const score = { sideA: 5, sideB: 0 } // Axis 5, Allies 0
    // Omen played Allies and lost 0:5.
    assert.deepEqual(
        fixtureScoreFromEvent({
            fixture,
            eventTeams: [
                { teamIds: ["omen"], side: "Allies" },
                { teamIds: ["circle"], side: "Axis" },
            ],
            score,
        }),
        { scoreA: 0, scoreB: 5 }
    )
    // A merged assignment is found under its current ID.
    assert.deepEqual(
        fixtureScoreFromEvent({
            fixture,
            eventTeams: [
                { teamIds: ["old-omen", "omen"], side: "Axis" },
                { teamIds: ["circle"], side: "Allies" },
            ],
            score,
        }),
        { scoreA: 5, scoreB: 0 }
    )
    // Unknown, missing or equal sides fill nothing in.
    for (const eventTeams of [
        [],
        [{ teamIds: ["omen"], side: "Axis" }],
        [
            { teamIds: ["omen"], side: null },
            { teamIds: ["circle"], side: "Allies" },
        ],
        [
            { teamIds: ["omen"], side: "Axis" },
            { teamIds: ["circle"], side: "Axis" },
        ],
        [
            { teamIds: ["omen"], side: "Valkyra" },
            { teamIds: ["circle"], side: "Manticore" },
        ],
    ])
        assert.equal(
            fixtureScoreFromEvent({ fixture, eventTeams, score }),
            null,
            JSON.stringify(eventTeams)
        )
})

test("bulk registration validates the full selection, respects limits and skips already registered teams", () => {
    const active = {
        gameId: "wardogs" as const,
        archivedAt: null,
        mergedIntoTeamId: null,
    }
    const input = {
        gameId: "wardogs",
        divisionExists: true,
        registrations: 1,
        existingTeamIds: new Set(["existing"]),
        teams: [
            { id: "existing", facts: active },
            { id: "new", facts: active },
        ],
    }
    assert.deepEqual(planTeamRegistrations(input), {
        teamIds: ["new"],
        skipped: 1,
    })
    assert.deepEqual(
        planTeamRegistrations({
            ...input,
            registrations: COMPETITION_REGISTRATION_LIMIT,
        }),
        { error: "limit_reached" }
    )
    assert.deepEqual(
        planTeamRegistrations({ ...input, divisionExists: false }),
        { error: "division_not_found" }
    )
    for (const [facts, error] of [
        [null, "team_not_found"],
        [{ ...active, gameId: "hell_let_loose" }, "team_game_mismatch"],
        [{ ...active, archivedAt: "2026-01-01" }, "team_archived"],
        [{ ...active, mergedIntoTeamId: "other" }, "team_archived"],
    ] as const) {
        assert.deepEqual(
            planTeamRegistrations({
                ...input,
                teams: [
                    { id: "valid", facts: active },
                    { id: "invalid", facts },
                ],
            }),
            { error }
        )
    }
})

test("bulk registration schema rejects empty, duplicated, oversized and malformed selections", () => {
    for (const teamIds of [
        [],
        ["a", "a"],
        [""],
        Array.from({ length: 501 }, (_, i) => `team-${i}`),
    ])
        assert.equal(
            registrationBatchSchema.safeParse({
                divisionId: "division-1",
                teamIds,
            }).success,
            false
        )
    assert.equal(
        registrationBatchSchema.safeParse({
            divisionId: "division-1",
            teamIds: ["a", "b"],
        }).success,
        true
    )
})
