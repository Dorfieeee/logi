import fixtures from "../../infrastructure/gwl/fixtures/fixtures.json"
import { gwlMatchSchema } from "../../domain/gwl/contracts"
import { GwlError } from "../../infrastructure/gwl/client"
import { syncGwl, type GwlSyncPorts } from "./sync"
import assert from "node:assert/strict"
import test from "node:test"
const match = gwlMatchSchema.parse(
    fixtures.recent.find((m) => m.status === "confirmed")
)
function fixture(type = "match.confirmed") {
    const calls: string[] = []
    const ports: GwlSyncPorts = {
        read: async (path, schema) => {
            calls.push(path)
            if (path.includes("/events"))
                return schema.parse({
                    events: [{ id: 1, type, data: { match } }],
                    next: 1,
                    hasMore: false,
                })
            if (/^\/team\/matches\/\d+$/.test(path)) return schema.parse(match)
            if (path.endsWith("/file")) throw new GwlError("not_found")
            throw new Error(path)
        },
        importFixture: async (f) => {
            calls.push(`import:${f.id}`)
        },
        promote: async () => true,
        remember: async () => {},
        flag: async (_, issue) => {
            calls.push(`flag:${issue}`)
        },
        result: async (_, file) => {
            calls.push(file ? "stats" : "confirmed-without-file")
        },
        records: async () => [{ fixtureId: match.number, eventId: "event" }],
    }
    return { calls, ports }
}
const input = {
    cursor: 0,
    reconcile: false,
    now: Date.now(),
    autoCreate: true,
    own: { slug: "test-team", name: "Test Team", tag: "TEST" },
}
test("confirmed score can finalize before its match file exists", async () => {
    const { calls, ports } = fixture()
    const result = await syncGwl(input, ports)
    assert.equal(result.cursor, 1)
    assert.ok(calls.includes("confirmed-without-file"))
    assert.ok(calls.includes(`import:${match.number}`))
})
test("cancellation flags a fixture without creating or finalizing a new match", async () => {
    const { calls, ports } = fixture("match.cancelled")
    await syncGwl(input, ports)
    assert.ok(calls.includes("flag:match.cancelled"))
    assert.ok(!calls.some((c) => c.startsWith("import:")))
    assert.ok(!calls.includes("confirmed-without-file"))
})
test("foreign-team feed payloads fail closed before writing a fixture", async () => {
    const { ports } = fixture()
    await assert.rejects(
        syncGwl({ ...input, own: { ...input.own, slug: "foreign" } }, ports),
        /team_scope_mismatch/
    )
})
test("a failure never returns an advanced cursor", async () => {
    const { ports } = fixture()
    ports.importFixture = async () => {
        throw new Error("transaction failed")
    }
    await assert.rejects(syncGwl(input, ports), /transaction failed/)
})
