import {
    ProviderError,
    type ClaimedConnection,
    type SnapshotRead,
} from "../../domain/game-data/contracts"
import { collectSnapshot } from "./collect-snapshot"
import assert from "node:assert/strict"
import test from "node:test"

const now = Date.parse("2030-01-01T00:00:00Z")
const connection: ClaimedConnection = {
    id: "connection",
    ref: "wdg",
    guildId: "guild",
    gameId: "wardogs",
    provider: "wardogs_rcon",
    providerServerId: "primary",
    origin: "https://rcon.example.test",
    secretRef: "LOGI_GAME_DATA_WDG_TOKEN",
    allowedAddresses: [],
    generation: 1,
    fence: 3,
    attempt: 1,
    observation: null,
    etag: null,
}
const observed: SnapshotRead = {
    observation: {
        observedAt: new Date(now).toISOString(),
        providerUpdatedAt: null,
        displayName: "Fixture",
        state: "online",
        map: null,
        players: 0,
        capacity: 100,
        providerInstanceId: null,
        scores: [],
        capabilities: ["server_snapshot"],
    },
}

test("snapshot polling and rate-limit delay remain independent of scheduler wake frequency", async () => {
    const attempts: Array<number | null> = []
    const ports = {
        now: () => now,
        http: {
            get: async () => {
                throw new Error("Unexpected request")
            },
        },
        repository: {
            finish: async (value: { nextAttemptAt: number | null }) => {
                attempts.push(value.nextAttemptAt)
                return true
            },
        },
    }
    for (const pollAfterMs of [30_000, 60_000, 3_600_000])
        await collectSnapshot(connection, {
            ...ports,
            provider: {
                readSnapshot: async () => ({ ...observed, pollAfterMs }),
            },
        })
    await collectSnapshot(connection, {
        ...ports,
        provider: {
            readSnapshot: async () => {
                throw new ProviderError("rate_limited", 300_000)
            },
        },
    })
    assert.deepEqual(attempts, [
        now + 60_000,
        now + 60_000,
        now + 3_600_000,
        now + 300_000,
    ])
})

test("collector persists normalized zero values and reports a rejected late fence", async () => {
    let applied: unknown
    const ports = {
        now: () => now,
        provider: { readSnapshot: async () => observed },
        http: {
            get: async () => {
                throw new Error("Unexpected request")
            },
        },
        repository: {
            finish: async (value: unknown) => {
                applied = value
                return true
            },
        },
    }
    assert.equal(await collectSnapshot(connection, ports), "completed")
    assert.deepEqual(applied, {
        observation: observed.observation,
        etag: null,
        errorCategory: null,
        nextAttemptAt: now + 60_000,
    })
    assert.equal(
        await collectSnapshot(connection, {
            ...ports,
            repository: { finish: async () => false },
        }),
        "stale_fence"
    )
})

test("timeout persists retry without replacing prior observation; invalid payload never commits", async () => {
    const writes: unknown[] = []
    const ports = {
        now: () => now,
        provider: {
            readSnapshot: async () => {
                throw new ProviderError("timeout")
            },
        },
        http: {
            get: async () => {
                throw new Error("Unexpected request")
            },
        },
        repository: {
            finish: async (value: unknown) => {
                writes.push(value)
                return true
            },
        },
    }
    assert.equal(await collectSnapshot(connection, ports), "retry_scheduled")
    assert.deepEqual(writes[0], {
        errorCategory: "timeout",
        nextAttemptAt: now + 5_000,
    })
    await collectSnapshot(connection, {
        ...ports,
        provider: {
            readSnapshot: async () => ({
                observation: { ...observed.observation, players: -1 },
            }),
        },
    })
    assert.deepEqual(writes[1], {
        errorCategory: "invalid_response",
        nextAttemptAt: now + 5_000,
    })
})

test("provider authentication failure pauses until configuration is reviewed", async () => {
    let saved: unknown
    const outcome = await collectSnapshot(connection, {
        now: () => now,
        provider: {
            readSnapshot: async () => {
                throw new ProviderError("unauthorized")
            },
        },
        http: {
            get: async () => {
                throw new Error()
            },
        },
        repository: {
            finish: async (value) => {
                saved = value
                return true
            },
        },
    })
    assert.equal(outcome, "unavailable")
    assert.deepEqual(saved, {
        errorCategory: "unauthorized",
        nextAttemptAt: null,
    })
})
