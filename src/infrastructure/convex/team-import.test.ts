import { actorFixture, seedDashboardActor } from "./testing/dashboard-actor"
import { invoke, testContext } from "./testing/database"
import * as teams from "../../../convex/teams"
import assert from "node:assert/strict"
import test from "node:test"

process.env.INTERNAL_AUTH_SECRET = "synthetic-import-secret"
const access = {
    secret: process.env.INTERNAL_AUTH_SECRET,
    actor: { ...actorFixture, superadmin: true },
}
const imported = (name: string, shortCode: string, key: string) => ({
    name,
    shortCode,
    idempotencyKey: key,
    logoAssetId: null,
})

test("transactional import preserves existing/archived teams and skips names OR codes per game and within batch", async () => {
    const ctx = testContext()
    seedDashboardActor(ctx.db, "guild-a")
    const created = await invoke(teams.create, ctx, {
        ...access,
        input: {
            gameId: "wardogs",
            name: "Alpha Team",
            shortCode: "AT",
            idempotencyKey: "existing-alpha",
        },
    })
    assert.equal(created.ok, true)
    await invoke(teams.archive, ctx, {
        ...access,
        teamId: created.teamId,
        input: { expectedRevision: 1 },
    })
    const input = {
        ...access,
        gameId: "wardogs",
        teams: [
            imported("ALPHA  TEAM", "NEW", "import-name-1"),
            imported("Other", "at", "import-code-1"),
            imported("Bravo", "B", "import-bravo"),
            imported("Other Bravo", "Ｂ", "import-duplicate"),
        ],
    }
    assert.deepEqual(await invoke(teams.importCatalogue, ctx, input), {
        created: 1,
        skipped: 3,
    })
    assert.deepEqual(await invoke(teams.importCatalogue, ctx, input), {
        created: 0,
        skipped: 4,
    })
    assert.deepEqual(
        await invoke(teams.importCatalogue, ctx, {
            ...access,
            gameId: "hell_let_loose",
            teams: [imported("Alpha Team", "AT", "import-hll-alpha")],
        }),
        { created: 1, skipped: 0 }
    )
    const original = await invoke(teams.adminGet, ctx, {
        ...access,
        teamId: created.teamId,
    })
    assert.equal(original.name, "Alpha Team")
    assert.equal(original.revision, 2)
    assert.ok(original.archivedAt)
})
test("import mutation refuses workspace admins and invalid inputs", async () => {
    const ctx = testContext()
    seedDashboardActor(ctx.db, "guild-a")
    await assert.rejects(
        invoke(teams.importCatalogue, ctx, {
            ...access,
            actor: actorFixture,
            gameId: "wardogs",
            teams: [],
        })
    )
    await assert.rejects(
        invoke(teams.importCatalogue, ctx, {
            ...access,
            gameId: "unsupported",
            teams: [],
        })
    )
    await assert.rejects(
        invoke(teams.importCatalogue, ctx, {
            ...access,
            gameId: "wardogs",
            teams: [{ name: "", shortCode: "x" }],
        })
    )
})
