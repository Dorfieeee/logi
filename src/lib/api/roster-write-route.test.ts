import { rosterWriteHandler } from "./roster-write-route"
import assert from "node:assert/strict"
import test from "node:test"

const origin = "https://logi.example.test"
const actor = {
    sid: "s".repeat(43),
    subject: "910000000000000002",
    userRecordId: "users:one",
    superadmin: false,
}
const body = {
    eventId: "events:one",
    squads: [],
    reservePlayerIds: [],
    notAttendingPlayerIds: [],
    published: false,
}
const request = (
    value: unknown = body,
    suppliedOrigin: string | null = origin
) =>
    new Request(`${origin}/api/servers/guilds:one/rosters`, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            ...(suppliedOrigin ? { origin: suppliedOrigin } : {}),
        },
        body: JSON.stringify(value),
    })

test("roster HTTP writes require the same configured origin and a server-resolved actor", async () => {
    let writes = 0
    const handle = rosterWriteHandler({
        origin,
        actor: async () => actor,
        write: async () => {
            writes++
            return "rosters:one"
        },
    })
    for (const supplied of [null, "https://foreign.example.test"]) {
        const response = await handle(request(body, supplied), "guilds:one")
        assert.equal(response.status, 403)
        assert.equal(response.headers.get("cache-control"), "no-store")
    }
    assert.equal(
        (
            await rosterWriteHandler({
                origin,
                actor: async () => null,
                write: async () => {
                    writes++
                    return "rosters:one"
                },
            })(request(), "guilds:one")
        ).status,
        401
    )
    assert.equal(writes, 0)
})

test("roster HTTP input cannot supply actor or tenant authority and invalid bodies never write", async () => {
    let writes = 0
    const handle = rosterWriteHandler({
        origin,
        actor: async () => actor,
        write: async () => {
            writes++
            return "rosters:one"
        },
    })
    for (const value of [
        { ...body, actor: { ...actor, superadmin: true } },
        { ...body, secret: "client-value" },
        { ...body, serverId: "other" },
        { ...body, eventId: "" },
        { ...body, published: "true" },
    ]) {
        assert.equal((await handle(request(value), "guilds:one")).status, 400)
    }
    assert.equal(
        (
            await handle(
                request({ ...body, padding: "a".repeat(270_000) }),
                "guilds:one"
            )
        ).status,
        400
    )
    assert.equal(writes, 0)
})

test("roster HTTP writes pass only the closed input and server actor and never reflect secrets", async () => {
    const seen: unknown[] = []
    const handle = rosterWriteHandler({
        origin,
        actor: async () => actor,
        write: async (...args) => {
            seen.push(args)
            return "rosters:one"
        },
    })
    const response = await handle(request(), "guilds:one")
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { id: "rosters:one" })
    assert.deepEqual(seen, [["guilds:one", actor, body]])
    const denied = await rosterWriteHandler({
        origin,
        actor: async () => actor,
        write: async () => {
            throw new Error("Forbidden. synthetic-private-token")
        },
    })(request(), "guilds:one")
    assert.equal(denied.status, 403)
    assert.ok(!(await denied.text()).includes("synthetic-private-token"))
})

test("roster HTTP preserves moved squads, section order and reserve assignments", async () => {
    const moved = {
        ...body,
        squads: [
            {
                name: "FL4",
                group: "Infantry",
                order: 0,
                color: "#ffffff",
                players: [
                    { id: "reserve-player", ack: false, roleName: "Medic" },
                ],
            },
            {
                name: "FL1",
                group: "Infantry",
                order: 1,
                color: "#ffffff",
                players: [
                    {
                        id: "leader",
                        ack: true,
                        confirmed: true,
                        roleName: "Leader",
                    },
                ],
            },
        ],
    }
    let saved: unknown
    const response = await rosterWriteHandler({
        origin,
        actor: async () => actor,
        write: async (_server, _actor, input) => {
            saved = input
            return "rosters:one"
        },
    })(request(moved), "guilds:one")
    assert.equal(response.status, 200)
    assert.deepEqual(saved, moved)
})
