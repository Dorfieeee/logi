import { rememberRegistration, channelEntries } from "./registration-summary"
import { boardEvent, boardPayload } from "./board-example.fixture"
import assert from "node:assert/strict"
import test from "node:test"

test("open events follow their published registration channel across games and moves", () => {
    const a = boardEvent({
        id: "a",
        registrationStart: undefined,
        registrationEnd: "2099-01-01T00:00:00Z",
        meetingStart: "2099-01-02T00:00:00Z",
        status: "registration",
    })
    const b = {
        ...a,
        id: "b",
        gameId: "wardogs" as const,
        meetingStart: "2099-01-01T12:00:00Z",
    }
    const p = boardPayload(a)
    rememberRegistration(p, a, "hll", "1")
    rememberRegistration(p, b, "wardogs", "2")
    const ids = (channel: string) =>
        channelEntries(a.guildId, channel).map((e) => e.id)
    assert.deepEqual(ids("hll"), ["a"])
    assert.deepEqual(ids("wardogs"), ["b"])
    rememberRegistration(p, b, "hll", "3")
    assert.deepEqual(ids("hll"), ["b", "a"])
    assert.deepEqual(ids("wardogs"), [])
    rememberRegistration(p, { ...b, status: "closed" }, "hll", "3")
    rememberRegistration(
        p,
        { ...a, registrationStart: "2098-12-01T00:00:00Z" },
        "hll",
        "1"
    )
    assert.deepEqual(ids("hll"), [])
})
