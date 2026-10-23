import { register } from "../../../convex/externalRegistration"
import { invoke, testContext } from "./testing/database"
import assert from "node:assert/strict"
import test from "node:test"

const discordId = "111111111111111111"
const guildId = "222222222222222222"
const steamId = "76561198199051397"
const eos = "f17568f25c8fb49a2c10c23e444ad07b"
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
    createMembership: true,
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

test("EOS creates an account without Steam or memberships; retries replay and canonicalize", async () => {
    const ctx = fixture()
    const { steamId: _steam, ...details } = input
    const eosArgs = {
        ...args,
        input: {
            ...details,
            createMembership: false,
            platformId: eos.toUpperCase(),
            steamName: "EOS player",
        },
    }
    const result = await invoke(register, ctx, eosArgs)
    assert.equal(result.status, 201)
    assert.deepEqual(ctx.db.tables.users[0].platformIds, [eos])
    assert.equal(ctx.db.tables.users[0].steamName, "EOS player")
    assert.equal(JSON.parse(result.body).data.assignmentId, null)
    assert.equal(ctx.db.tables.userAssignments?.length ?? 0, 0)
    assert.equal(ctx.db.tables.platformIdentityLinks?.length ?? 0, 0)
    assert.equal(ctx.db.tables.memberRoleOperations?.length ?? 0, 0)
    const before = structuredClone(ctx.db.tables)
    assert.deepEqual(await invoke(register, ctx, eosArgs), result)
    assert.deepEqual(ctx.db.tables, before)
    assert.equal(
        (await invoke(register, ctx, { ...eosArgs, bodyHash: "different" }))
            .status,
        409
    )
    assert.equal(
        (
            await invoke(register, ctx, {
                ...eosArgs,
                idempotencyKey: "lowercase",
                input: { ...eosArgs.input, platformId: eos },
            })
        ).status,
        200
    )
    assert.deepEqual(ctx.db.tables.users[0].platformIds, [eos])
})

test("EOS links to an existing Steam user without changing existing identity or other division membership", async () => {
    const ctx = fixture()
    await invoke(register, ctx, args)
    const original = structuredClone(ctx.db.tables.users[0])
    const memberships = structuredClone(ctx.db.tables.userAssignments)
    const { steamId: _steam, ...details } = input
    const result = await invoke(register, ctx, {
        ...args,
        idempotencyKey: "eos-link",
        input: {
            ...details,
            platformId: eos,
            createMembership: false,
            gameId: "wardogs",
            name: "Changed",
            avatar: "https://new.test/avatar.jpg",
        },
    })
    assert.equal(result.status, 200)
    assert.equal(JSON.parse(result.body).data.userId, original.id)
    assert.equal(ctx.db.tables.users[0].name, original.name)
    assert.equal(ctx.db.tables.users[0].avatar, original.avatar)
    assert.equal(ctx.db.tables.users[0].guildId, original.guildId)
    assert.deepEqual(ctx.db.tables.users[0].platformIds, [steamId, eos])
    assert.deepEqual(ctx.db.tables.userAssignments, memberships)
})

test("an existing EOS ID can be omitted and can opt in to membership without Steam", async () => {
    for (const value of [
        eos,
        eos.toUpperCase(),
        `epic:${eos}`,
        `EPIC:${eos.toUpperCase()}`,
    ]) {
        const ctx = fixture()
        ctx.db.seed("users", {
            _id: "users:existing",
            id: discordId,
            discordId,
            name: "Existing",
            avatar: "",
            platformIds: [value],
        })
        const { steamId: _steam, ...details } = input
        const result = await invoke(register, ctx, { ...args, input: details })
        assert.equal(result.status, 201)
        assert.equal(JSON.parse(result.body).data.userCreated, false)
        assert.deepEqual(ctx.db.tables.users[0].platformIds, [value])
        assert.equal(ctx.db.tables.userAssignments[0].status, "active")
    }
})

test("EOS ownership conflicts include legacy fields, prefixes and case and roll back all writes", async () => {
    for (const field of ["platformIds", "platformId"]) {
        for (const value of [
            eos,
            eos.toUpperCase(),
            `epic:${eos}`,
            `EPIC:${eos.toUpperCase()}`,
        ]) {
            const ctx = fixture()
            ctx.db.seed("users", {
                _id: "users:applicant",
                id: discordId,
                discordId,
                name: "Applicant",
                avatar: "",
                platformIds: [steamId],
            })
            ctx.db.seed("users", {
                _id: "users:owner",
                id: "333333333333333333",
                discordId: "333333333333333333",
                name: "Owner",
                avatar: "",
                platformIds: [],
                [field]: field === "platformIds" ? [value] : value,
            })
            const before = structuredClone(ctx.db.tables)
            const { steamId: _steam, ...details } = input
            await assert.rejects(
                invoke(register, ctx, {
                    ...args,
                    input: { ...details, platformId: eos },
                }),
                /already linked/
            )
            assert.deepEqual(ctx.db.tables, before)
        }
    }
})

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

for (const source of ["legacy", "platform", "verified", "primary-clan"]) {
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
        if (source === "primary-clan") {
            ctx.db.seed("userAssignments", {
                _id: "userAssignments:other",
                userId: discordId,
                serverId: "333333333333333333",
                gameId: input.gameId,
                type: "member",
                status: "active",
                createdAt: "2026-01-01T00:00:00Z",
            })
            before.userAssignments = structuredClone(
                ctx.db.tables.userAssignments
            )
        }
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

test("existing Discord user links unclaimed Steam and applies without replacing its identity", async () => {
    const ctx = fixture()
    ctx.db.seed("users", {
        _id: "users:existing",
        id: "legacy-stable-id",
        discordId,
        name: "Original name",
        avatar: "https://original.test/avatar.png",
        platformIds: [],
        nicknames: { [guildId]: "Original nickname" },
        guildId: "333333333333333333",
    })
    ctx.db.seed("userAssignments", {
        _id: "userAssignments:hll",
        userId: "legacy-stable-id",
        serverId: "333333333333333333",
        gameId: "hell_let_loose",
        type: "member",
        status: "active",
        createdAt: "2026-01-01T00:00:00Z",
    })
    const oldMembership = structuredClone(ctx.db.tables.userAssignments[0])
    const result = await invoke(register, ctx, {
        ...args,
        input: { ...input, gameId: "wardogs", status: "pending" },
    })
    const data = JSON.parse(result.body).data
    assert.equal(result.status, 201)
    assert.equal(data.userCreated, false)
    assert.equal(data.userId, "legacy-stable-id")
    assert.equal(ctx.db.tables.users.length, 1)
    assert.equal(ctx.db.tables.users[0].name, "Original name")
    assert.equal(
        ctx.db.tables.users[0].avatar,
        "https://original.test/avatar.png"
    )
    assert.equal(ctx.db.tables.users[0].guildId, "333333333333333333")
    assert.deepEqual(ctx.db.tables.users[0].platformIds, [steamId])
    assert.deepEqual(ctx.db.tables.userAssignments[0], oldMembership)
    assert.equal(ctx.db.tables.userAssignments[1].gameId, "wardogs")
    assert.equal(ctx.db.tables.userAssignments[1].status, "pending")
})

test("existing linked Steam can be omitted, and existing game membership is preserved", async () => {
    const ctx = fixture()
    await invoke(register, ctx, args)
    const { steamId: _steam, steamName: _name, ...withoutSteam } = input
    const result = await invoke(register, ctx, {
        ...args,
        idempotencyKey: "without-steam",
        input: { ...withoutSteam, gameId: "wardogs", status: "pending" },
    })
    assert.equal(result.status, 201)
    assert.equal(JSON.parse(result.body).data.userCreated, false)
    assert.deepEqual(ctx.db.tables.users[0].platformIds, [steamId])
    assert.equal(ctx.db.tables.userAssignments[0].status, "active")
    const again = await invoke(register, ctx, {
        ...args,
        idempotencyKey: "repeat",
        input: { ...withoutSteam, status: "pending" },
    })
    assert.equal(again.status, 200)
    assert.equal(ctx.db.tables.userAssignments[0].status, "active")
})

test("missing player ID without an existing supported linked ID rejects the whole transaction", async () => {
    for (const existing of [false, true]) {
        const ctx = fixture()
        if (existing)
            ctx.db.seed("users", {
                _id: "users:empty",
                id: discordId,
                discordId,
                name: "Existing",
                avatar: "",
                platformIds: [],
            })
        const before = structuredClone(ctx.db.tables)
        const { steamId: _steam, steamName: _name, ...withoutSteam } = input
        await assert.rejects(
            invoke(register, ctx, { ...args, input: withoutSteam }),
            /Steam or EOS player ID is required/
        )
        assert.deepEqual(ctx.db.tables, before)
    }
})

test("an existing user's attempted Steam collision does not change either profile or membership", async () => {
    for (const value of [
        steamId,
        `steam:${steamId}`,
        `https://steamcommunity.com/profiles/${steamId}/`,
    ]) {
        const ctx = fixture()
        ctx.db.seed("users", {
            _id: "users:applicant",
            id: discordId,
            discordId,
            name: "Applicant",
            avatar: "",
            platformIds: ["76561198000000001"],
        })
        ctx.db.seed("users", {
            _id: "users:owner",
            id: "other",
            discordId: "333333333333333333",
            name: "Owner",
            avatar: "",
            platformIds: [value],
        })
        const before = structuredClone(ctx.db.tables)
        await assert.rejects(invoke(register, ctx, args), /already linked/)
        assert.deepEqual(ctx.db.tables, before)
    }
})

test("adding Steam appends, repeated linking is canonical and never creates verified ownership", async () => {
    const ctx = fixture()
    ctx.db.seed("users", {
        _id: "users:existing",
        id: discordId,
        discordId,
        name: "Original",
        avatar: "",
        platformIds: ["steam:76561198000000001"],
    })
    await invoke(register, ctx, args)
    await invoke(register, ctx, { ...args, idempotencyKey: "repeat" })
    assert.deepEqual(ctx.db.tables.users[0].platformIds, [
        "steam:76561198000000001",
        steamId,
    ])
    assert.equal(ctx.db.tables.platformIdentityLinks?.length ?? 0, 0)
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

test("default registration upserts only the account and never reads or changes memberships", async () => {
    const ctx = fixture()
    const { createMembership: _membership, ...accountOnly } = input
    const first = await invoke(register, ctx, { ...args, input: accountOnly })
    assert.equal(first.status, 201)
    const data = JSON.parse(first.body).data
    assert.equal(data.assignmentId, null)
    assert.equal(data.membershipCreated, false)
    assert.equal(ctx.db.tables.userAssignments?.length ?? 0, 0)
    assert.deepEqual(ctx.db.tables.guilds[0].memberIds, [])
    ctx.db.seed("userAssignments", {
        _id: "userAssignments:hll",
        userId: discordId,
        serverId: "333333333333333333",
        gameId: "hell_let_loose",
        type: "member",
        status: "active",
        createdAt: "2026-01-01T00:00:00Z",
    })
    ctx.db.tables.users[0].guildId = "333333333333333333"
    const memberships = structuredClone(ctx.db.tables.userAssignments)
    const {
        steamId: _steam,
        steamName: _steamName,
        ...withoutSteam
    } = accountOnly
    const again = await invoke(register, ctx, {
        ...args,
        idempotencyKey: "account-only-again",
        input: { ...withoutSteam, gameId: "wardogs" },
    })
    assert.equal(again.status, 200)
    assert.equal(JSON.parse(again.body).data.assignmentId, null)
    assert.deepEqual(ctx.db.tables.userAssignments, memberships)
    assert.equal(ctx.db.tables.users[0].guildId, "333333333333333333")
})

test("legacy Steam fields are reused and cannot be claimed even beside an empty modern array", async () => {
    for (const field of ["steamId", "platformId"]) {
        const ctx = fixture()
        ctx.db.seed("users", {
            _id: "users:legacy",
            id: discordId,
            discordId,
            name: "Original",
            avatar: "",
            platformIds: [],
            [field]: steamId,
        })
        const {
            steamId: _steam,
            createMembership: _membership,
            ...accountOnly
        } = input
        const result = await invoke(register, ctx, {
            ...args,
            input: accountOnly,
        })
        assert.equal(result.status, 200)
        assert.deepEqual(ctx.db.tables.users[0].platformIds, [steamId])
        const other = fixture()
        other.db.seed("users", {
            _id: "users:owner",
            id: "333333333333333333",
            discordId: "333333333333333333",
            name: "Owner",
            avatar: "",
            platformIds: [],
            [field]: steamId,
        })
        const before = structuredClone(other.db.tables)
        await assert.rejects(
            invoke(register, other, {
                ...args,
                input: { ...input, createMembership: false },
            }),
            /already linked/
        )
        assert.deepEqual(other.db.tables, before)
    }
})
