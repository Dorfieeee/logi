import { register } from "../../../convex/externalRegistration"
import { invoke, testContext } from "./testing/database"
import assert from "node:assert/strict"
import test from "node:test"

const discordId = "111111111111111111"
const guildId = "222222222222222222"
const steamId = "76561198199051397"
const input = {
    discordId,
    guildId,
    steamId,
    steamName: "Steam name",
    name: "Discord name",
    avatar: "",
    gameId: "hell_let_loose",
    type: "member",
    status: "active",
}
const args = {
    secret: "dev-internal-auth-secret",
    keyHash: "key",
    idempotencyKey: "registration-1",
    bodyHash: "body-1",
    input,
}
function fixture() {
    const ctx = testContext()
    ctx.db.seed("apiKeys", { _id: "apiKeys:test", keyHash: "key", guildId })
    ctx.db.seed("guilds", {
        _id: "guilds:test",
        discordId: guildId,
        name: "Clan",
        enabledGames: ["hell_let_loose", "wardogs"],
        memberIds: [],
        members: [],
        mercenaryIds: [],
    })
    return ctx
}

test("registration creates profile, assignment and membership projections; retries replay", async () => {
    const ctx = fixture()
    const first = await invoke(register, ctx, args)
    assert.equal(first.status, 201)
    const data = JSON.parse(first.body).data
    assert.equal(data.userCreated, true)
    assert.equal(data.membershipCreated, true)
    assert.equal(ctx.db.tables.users[0].steamName, input.steamName)
    assert.deepEqual(ctx.db.tables.users[0].platformIds, [steamId])
    assert.equal(ctx.db.tables.users[0].guildId, guildId)
    assert.deepEqual(ctx.db.tables.guilds[0].memberIds, [discordId])
    assert.equal(ctx.db.tables.userAssignments[0].status, "active")
    assert.equal(ctx.db.tables.clanApiUserProjections.length, 1)
    assert.equal(ctx.db.tables.platformIdentityLinks?.length ?? 0, 0)
    assert.equal(ctx.db.tables.memberRoleOperations?.length ?? 0, 0)
    const before = structuredClone(ctx.db.tables)
    assert.deepEqual(await invoke(register, ctx, args), first)
    assert.deepEqual(ctx.db.tables, before)
    assert.equal(
        (await invoke(register, ctx, { ...args, bodyHash: "different" }))
            .status,
        409
    )
    const repeat = await invoke(register, ctx, {
        ...args,
        idempotencyKey: "new-key",
        input: { ...input, name: "Changed", status: "recruit" },
    })
    assert.equal(repeat.status, 200)
    assert.equal(ctx.db.tables.users[0].name, input.name)
    assert.equal(ctx.db.tables.userAssignments.length, 1)
    assert.equal(ctx.db.tables.userAssignments[0].status, "active")
})

test("registration creates an independent game assignment without replacing the existing game", async () => {
    const ctx = fixture()
    await invoke(register, ctx, args)
    await invoke(register, ctx, {
        ...args,
        idempotencyKey: "wardogs",
        input: { ...input, gameId: "wardogs", status: "recruit" },
    })
    assert.equal(ctx.db.tables.users.length, 1)
    assert.equal(ctx.db.tables.userAssignments.length, 2)
    assert.deepEqual(
        ctx.db.tables.userAssignments.map((a) => a.gameId),
        ["hell_let_loose", "wardogs"]
    )
})

test("registration rejects cross-clan, read-only, revoked, missing and invalid credentials", async () => {
    const ctx = fixture()
    assert.equal(
        (
            await invoke(register, ctx, {
                ...args,
                input: { ...input, guildId: "333333333333333333" },
            })
        ).status,
        403
    )
    ctx.db.tables.apiKeys[0].readAccess = { resources: [], gameIds: [] }
    assert.equal((await invoke(register, ctx, args)).status, 403)
    delete ctx.db.tables.apiKeys[0].readAccess
    ctx.db.tables.apiKeys[0].revokedAt = "now"
    assert.equal(await invoke(register, ctx, args), null)
    assert.equal(
        await invoke(register, ctx, { ...args, keyHash: "missing" }),
        null
    )
    await assert.rejects(invoke(register, ctx, { ...args, secret: "wrong" }))
    assert.equal(ctx.db.tables.users?.length ?? 0, 0)
})

for (const source of [
    "legacy",
    "platform",
    "verified",
    "existing-mismatch",
    "primary-clan",
]) {
    test(`registration rejects ${source} conflict without partial writes`, async () => {
        const ctx = fixture()
        if (source === "verified")
            ctx.db.seed("platformIdentityLinks", {
                _id: "platformIdentityLinks:other",
                platform: "steam",
                platformId: steamId,
                discordUserId: "333333333333333333",
                active: true,
            })
        else
            ctx.db.seed("users", {
                _id: "users:existing",
                id: source === "platform" ? "other" : discordId,
                discordId: ["existing-mismatch", "primary-clan"].includes(
                    source
                )
                    ? discordId
                    : undefined,
                name: "Existing",
                platformIds:
                    source === "existing-mismatch" ? [] : [`steam:${steamId}`],
                guildId:
                    source === "primary-clan"
                        ? "333333333333333333"
                        : undefined,
            })
        const before = structuredClone(ctx.db.tables)
        await assert.rejects(
            invoke(register, ctx, args),
            /conflict|already|different|primary/i
        )
        assert.deepEqual(ctx.db.tables, before)
    })
}

test("membership failure rolls back the newly created user and idempotency receipt", async () => {
    const ctx = fixture()
    const insert = ctx.db.insert.bind(ctx.db)
    ctx.db.insert = async (table, value) => {
        if (table === "userAssignments")
            throw new Error("Synthetic membership failure")
        return insert(table, value)
    }
    const before = structuredClone(ctx.db.tables)
    await assert.rejects(
        invoke(register, ctx, args),
        /Synthetic membership failure/
    )
    assert.deepEqual(ctx.db.tables, before)
})

test("disabled game and invalid details do not create a user", async () => {
    for (const patch of [
        { gameId: "disabled" },
        { steamId: "bad" },
        { name: " " },
        { avatar: "javascript:alert(1)" },
    ]) {
        const ctx = fixture()
        assert.equal(
            (
                await invoke(register, ctx, {
                    ...args,
                    input: { ...input, ...patch },
                })
            ).status,
            400
        )
        assert.equal(ctx.db.tables.users?.length ?? 0, 0)
    }
})
