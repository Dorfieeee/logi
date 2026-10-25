import { clanCompetitionHandlers } from "./clan-competition-route"
import assert from "node:assert/strict"
import test from "node:test"
function fixture(allowed = true) {
    const calls: unknown[] = []
    const handlers = clanCompetitionHandlers({
        origin: "https://logi.test",
        access: async () => (allowed ? { guildId: "ours" } : null),
        list: async () => ({ competitions: [] }),
        execute: async (access, input) => {
            calls.push({ access, input })
            return { ok: true, slug: "cup" }
        },
        mode: async (access, mode) => {
            calls.push({ access, mode })
            return { ok: true }
        },
        revalidate: () => {
            calls.push("revalidated")
        },
    })
    return { calls, handlers }
}
const command = { action: "enroll", competitionId: "cup", teamId: "ours" }
function request(body: unknown, origin = "https://logi.test") {
    return new Request("https://logi.test/api/servers/ours/competitions", {
        method: "POST",
        headers: { origin, "Content-Type": "application/json" },
        body: JSON.stringify(body),
    })
}
test("workspace commands reject foreign origins and unauthenticated admins before executing", async () => {
    const { calls, handlers } = fixture()
    assert.equal(
        (await handlers.POST(request(command, "https://foreign.test"), "ours"))
            .status,
        403
    )
    assert.equal(calls.length, 0)
    assert.equal(
        (await fixture(false).handlers.POST(request(command), "ours")).status,
        403
    )
})
test("strict clan commands and mode validate and invalidate after success", async () => {
    const { calls, handlers } = fixture()
    assert.equal(
        (await handlers.POST(request({ ...command, actor: "forged" }), "ours"))
            .status,
        400
    )
    assert.equal((await handlers.POST(request(command), "ours")).status, 200)
    assert.equal(calls.length, 2)
    assert.equal(
        (await handlers.mode(request({ mode: "competitions" }), "ours")).status,
        200
    )
    assert.equal(
        (await handlers.mode(request({ mode: "bad" }), "ours")).status,
        400
    )
    assert.equal(
        (
            await handlers.GET(new Request("https://logi.test"), "ours")
        ).headers.get("cache-control"),
        "no-store"
    )
})
