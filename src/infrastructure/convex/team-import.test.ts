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
        updated: 0,
        skipped: 3,
    })
    assert.deepEqual(await invoke(teams.importCatalogue, ctx, input), {
        created: 0,
        updated: 0,
        skipped: 4,
    })
    assert.deepEqual(
        await invoke(teams.importCatalogue, ctx, {
            ...access,
            gameId: "hell_let_loose",
            teams: [imported("Alpha Team", "AT", "import-hll-alpha")],
        }),
        { created: 1, updated: 0, skipped: 0 }
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

test("reimport updates only an existing active team's logo and repeats are unchanged", async () => {
    const ctx = testContext()
    seedDashboardActor(ctx.db, "guild-a")
    const created = await invoke(teams.create, ctx, {
        ...access,
        input: {
            gameId: "wardogs",
            name: "Alpha Team",
            shortCode: "AT",
            description: "Keep my description",
            links: ["https://clan.example"],
            idempotencyKey: "existing-alpha-logo",
        },
    })
    ctx.db.seed("imageAssets", {
        _id: "imageAssets:new-logo",
        guildId: "platform",
        kind: "team-logo",
        publicId: "a".repeat(32),
        storageId: "storage:logo",
        contentType: "image/png",
        width: 128,
        height: 128,
        bytes: 1000,
        publicUrl: `https://logi.test/api/image-assets/${"a".repeat(32)}.png`,
        state: "ready",
        createdAt: "2026-10-25T00:00:00Z",
        createdBy: actorFixture.subject,
    })
    const args = {
        ...access,
        gameId: "wardogs",
        teams: [
            {
                ...imported(
                    "Changed provider name",
                    "AT",
                    "refresh-alpha-logo"
                ),
                logoAssetId: "imageAssets:new-logo",
            },
        ],
    }
    assert.deepEqual(await invoke(teams.importCatalogue, ctx, args), {
        created: 0,
        updated: 1,
        skipped: 0,
    })
    let current = await invoke(teams.adminGet, ctx, {
        ...access,
        teamId: created.teamId,
    })
    assert.equal(current.name, "Alpha Team")
    assert.equal(current.description, "Keep my description")
    assert.equal(current.logoAssetId, "imageAssets:new-logo")
    assert.deepEqual(current.links, ["https://clan.example"])
    assert.equal(current.revision, 2)
    assert.deepEqual(await invoke(teams.importCatalogue, ctx, args), {
        created: 0,
        updated: 0,
        skipped: 1,
    })
    current = await invoke(teams.adminGet, ctx, {
        ...access,
        teamId: created.teamId,
    })
    assert.equal(current.revision, 2)
    assert.equal(ctx.db.tables.teamDirectory.length, 1)
    assert.equal(
        ctx.db.tables.imageAssetReferences.filter(
            (row) => row.ownerId === created.teamId
        ).length,
        1
    )
})

test("an ambiguous name/code pair cannot replace either existing logo", async () => {
    const ctx = testContext()
    seedDashboardActor(ctx.db, "guild-a")
    for (const [name, code] of [
        ["Alpha", "A"],
        ["Bravo", "B"],
    ])
        await invoke(teams.create, ctx, {
            ...access,
            input: {
                gameId: "wardogs",
                name,
                shortCode: code,
                idempotencyKey: `existing-${name}`,
            },
        })
    const result = await invoke(teams.importCatalogue, ctx, {
        ...access,
        gameId: "wardogs",
        teams: [
            {
                ...imported("Alpha", "B", "ambiguous-team"),
                logoAssetId: "imageAssets:untrusted",
            },
        ],
    })
    assert.deepEqual(result, { created: 0, updated: 0, skipped: 1 })
    assert.ok(
        ctx.db.tables.teamDirectory.every(
            (row) => row.revision === 1 && !row.logoAssetId
        )
    )
})
