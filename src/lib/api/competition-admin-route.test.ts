import {
    competitionAdminHandlers,
    competitionCacheSlugs,
    competitionErrorStatus,
    type CompetitionAdminPorts,
} from "./competition-admin-route"
import assert from "node:assert/strict"
import test from "node:test"

type Access = { secret: string; actor: { subject: string } }
const access: Access = { secret: "s", actor: { subject: "100" } }
const origin = "https://logi.test"

function harness(overrides: Partial<CompetitionAdminPorts<Access>> = {}) {
    const calls: Array<{ mutation: string; args: Record<string, unknown> }> = []
    const revalidated: string[][] = []
    const ports: CompetitionAdminPorts<Access> = {
        origin,
        access: async () => access,
        list: async () => [{ id: "c1" }],
        get: async (_access, competitionId) =>
            competitionId === "c1" ? { competition: { id: "c1" } } : null,
        searchTeams: async (_access, competitionId, search) =>
            competitionId === "c1" ? { items: [{ search }] } : null,
        linkCandidates: async () => [{ id: "events:1" }],
        command: async (_access, mutation, args) => {
            calls.push({ mutation, args })
            return { ok: true, slug: "spring-cup" }
        },
        revalidate: (slugs) => revalidated.push(slugs),
        ...overrides,
    }
    return { handlers: competitionAdminHandlers(ports), calls, revalidated }
}
const post = (body: unknown, headers: Record<string, string> = { origin }) =>
    new Request(`${origin}/api/competitions`, {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify(body),
    })

test("writes need the same origin and a global administrator", async () => {
    const { handlers, calls } = harness()
    const command = {
        action: "deleteFixture",
        fixtureId: "competitionFixtures:1",
    }
    assert.equal((await handlers.command(post(command, {}))).status, 403)
    assert.equal(
        (await handlers.command(post(command, { origin: "https://evil.test" })))
            .status,
        403
    )
    const denied = harness({ access: async () => null })
    assert.equal((await denied.handlers.command(post(command))).status, 403)
    assert.equal((await denied.handlers.list()).status, 403)
    assert.equal(calls.length, 0)
})

test("commands are validated with the domain schemas before Convex is called", async () => {
    const { handlers, calls, revalidated } = harness()
    for (const body of [
        { action: "explode" },
        {
            action: "create",
            input: {
                gameId: "hell_let_loose",
                slug: "Bad",
                name: "X",
                season: "1",
            },
        },
        {
            action: "createFixture",
            competitionId: "c1",
            input: {
                divisionId: "d1",
                phase: "league",
                sideATeamId: "t1",
                sideBTeamId: "t1",
                status: "scheduled",
            },
        },
        { action: "deleteDivision", divisionId: "d1", extra: true },
    ]) {
        const response = await handlers.command(post(body))
        assert.equal(response.status, 400, JSON.stringify(body))
        assert.deepEqual(await response.json(), {
            error: "invalid_competition",
        })
    }
    assert.equal(calls.length, 0)
    const response = await handlers.command(
        post({
            action: "createFixture",
            competitionId: "c1",
            input: {
                divisionId: "d1",
                phase: "league",
                sideATeamId: "t1",
                sideBTeamId: "t2",
                status: "scheduled",
                scoreA: 3,
                scoreB: 1,
            },
        })
    )
    assert.equal(response.status, 200)
    assert.equal(response.headers.get("cache-control"), "no-store")
    // Normalized input reaches Convex: a scheduled fixture carries no score.
    assert.deepEqual(calls, [
        {
            mutation: "competitions:createFixture",
            args: {
                competitionId: "c1",
                input: {
                    divisionId: "d1",
                    phase: "league",
                    sideATeamId: "t1",
                    sideBTeamId: "t2",
                    scheduledAt: null,
                    status: "scheduled",
                    scoreA: null,
                    scoreB: null,
                },
            },
        },
    ])
    assert.deepEqual(revalidated, [["spring-cup"]])
})

test("rule failures map to HTTP statuses and leave the cache alone", async () => {
    for (const [error, status] of [
        ["duplicate_slug", 409],
        ["registration_has_fixtures", 409],
        ["migration_pending", 409],
        ["not_found", 404],
        ["event_not_found", 404],
        ["division_mismatch", 400],
    ] as const) {
        assert.equal(competitionErrorStatus(error), status)
        const { handlers, revalidated } = harness({
            command: async () => ({ error }),
        })
        const response = await handlers.command(
            post({ action: "deleteFixture", fixtureId: "f1" })
        )
        assert.equal(response.status, status)
        assert.deepEqual(await response.json(), { error })
        assert.equal(revalidated.length, 0)
    }
    const failing = harness({
        command: async () => {
            throw new Error("Forbidden.")
        },
    })
    assert.equal(
        (
            await failing.handlers.command(
                post({ action: "deleteFixture", fixtureId: "f1" })
            )
        ).status,
        503
    )
})

test("a slug change revalidates both public pages; the seed route runs a fixed command", async () => {
    assert.deepEqual(
        competitionCacheSlugs({ ok: true, slug: "new", previousSlug: "old" }),
        ["new", "old"]
    )
    assert.deepEqual(
        competitionCacheSlugs({ ok: true, slug: "same", previousSlug: "same" }),
        ["same"]
    )
    assert.deepEqual(competitionCacheSlugs(null), [])
    const { handlers, calls } = harness()
    const response = await handlers.command(
        new Request(`${origin}/api/competitions/ecl/seed`, {
            method: "POST",
            headers: { origin },
        }),
        { action: "seedEcl" }
    )
    assert.equal(response.status, 200)
    assert.deepEqual(calls, [
        { mutation: "competitions:seedEcl2026", args: {} },
    ])
})

test("reads return the listing, one competition, team search and link candidates", async () => {
    const { handlers } = harness()
    assert.deepEqual(await (await handlers.list()).json(), [{ id: "c1" }])
    assert.deepEqual(await (await handlers.get("c1")).json(), {
        competition: { competition: { id: "c1" } },
    })
    assert.equal((await handlers.get("missing")).status, 404)
    assert.deepEqual(
        await (
            await handlers.searchTeams(
                new Request(
                    `${origin}/api/competitions/c1/teams?search=%20omen%20`
                ),
                "c1"
            )
        ).json(),
        { items: [{ search: "omen" }] }
    )
    assert.equal(
        (
            await handlers.searchTeams(
                new Request(
                    `${origin}/api/competitions/c1/teams?search=${"x".repeat(65)}`
                ),
                "c1"
            )
        ).status,
        400
    )
    assert.equal(
        (
            await handlers.searchTeams(
                new Request(`${origin}/api/competitions/c9/teams`),
                "c9"
            )
        ).status,
        404
    )
    assert.deepEqual(await (await handlers.linkCandidates("f1")).json(), {
        events: [{ id: "events:1" }],
    })
    const broken = harness({
        list: async () => {
            throw new Error("down")
        },
    })
    assert.equal((await broken.handlers.list()).status, 503)
})

test("behind a proxy only the public site origin may write", async () => {
    const { handlers } = harness()
    const internal = (requestOrigin: string) =>
        new Request("http://127.0.0.1:3000/api/competitions", {
            method: "POST",
            headers: {
                "content-type": "application/json",
                origin: requestOrigin,
            },
            body: JSON.stringify({ action: "create", input: {} }),
        })
    assert.notEqual((await handlers.command(internal(origin))).status, 403)
    assert.equal(
        (await handlers.command(internal("http://127.0.0.1:3000"))).status,
        403
    )
})

test("bulk team registration routes one validated batch and invalidates the competition", async () => {
    const { handlers, calls, revalidated } = harness()
    const input = { divisionId: "division-1", teamIds: ["team-1", "team-2"] }
    const response = await handlers.command(
        post({ action: "registerTeams", competitionId: "c1", input })
    )
    assert.equal(response.status, 200)
    assert.deepEqual(calls, [
        {
            mutation: "competitions:registerTeams",
            args: { competitionId: "c1", input },
        },
    ])
    assert.deepEqual(revalidated, [["spring-cup"]])
    for (const teamIds of [[], ["same", "same"]])
        assert.equal(
            (
                await handlers.command(
                    post({
                        action: "registerTeams",
                        competitionId: "c1",
                        input: { divisionId: "division-1", teamIds },
                    })
                )
            ).status,
            400
        )
    assert.equal(calls.length, 1)
})
