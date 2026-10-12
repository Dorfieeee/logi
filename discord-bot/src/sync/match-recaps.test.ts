import type { Client, ContainerBuilder } from "discord.js"
import { ConvexReactClient } from "convex/react"
import { getFunctionName } from "convex/server"
import { closeConvexClient } from "../convex"
import test, { afterEach } from "node:test"
import assert from "node:assert/strict"

import { buildMatchRecapView, processMatchRecaps } from "./match-recaps"
import type { EventInteractionContext } from "../types"

afterEach(closeConvexClient)

const context = {
    config: {
        id: "config-1",
        guildId: "guild-1",
        timezone: "Europe/Prague",
        defaultLanguage: "cs",
        calendarCategories: [],
        updatedAt: "2026-10-01T10:00:00.000Z",
    },
    event: {
        id: "events:one",
        guildId: "guild-1",
        gameId: "hell_let_loose",
        kind: "match",
        name: "Liga",
        side: "Allies",
        server: "Vlci #1",
        map: "foy_warfare_day",
        matchTeams: [
            {
                slot: "a",
                side: "Allies",
                snapshot: { name: "Vlci", shortCode: "VLK" },
            },
            {
                slot: "b",
                side: "Axis",
                snapshot: { name: "Rogue", shortCode: "ROG" },
            },
        ],
        gameStart: "2026-10-11T18:00:00.000Z",
    },
    groups: [],
    roster: {
        squads: [
            {
                name: "F1",
                players: [
                    { id: "222222222222222222", roleName: "Medic", ack: true },
                ],
            },
        ],
        reservePlayerIds: [],
    },
} as unknown as EventInteractionContext

const forum = {
    stratmaps: [],
    result: { outcome: "win" as const, score: "4 : 1" },
    provider: "CRCON",
    publicMatch: true,
    serverId: "guilds:1",
    clanName: "Vlci",
    category: { label: "Přátelák", color: "#22c55e" },
}

const delivery = {
    recapId: "matchRecaps:one",
    userId: "imported/player",
    discordUserId: "222222222222222222",
    eventName: "Synthetic match",
    kills: 36,
    deaths: 15,
    kd: 2.4,
    previousTen: { matches: 10, kills: 29.4, deaths: 16.7, kd: 1.76 },
}

const text = (view: { components: ContainerBuilder[] }) =>
    JSON.stringify(view.components.map((item) => item.toJSON()))

function mockQueries(
    t: { mock: { method: (...args: never[]) => unknown } },
    prepared: unknown = delivery,
    calls: unknown[] = []
) {
    ;(t.mock.method as (...args: unknown[]) => unknown)(
        ConvexReactClient.prototype,
        "query",
        async (
            reference: Parameters<typeof getFunctionName>[0],
            args: unknown
        ) => {
            const name = getFunctionName(reference)
            calls.push([name, args])
            if (name.endsWith("listPendingForEvent")) return [delivery]
            if (name.endsWith("getEventInteractionContext")) return context
            if (name.endsWith("forumContext")) return forum
            return prepared
        }
    )
}

test("the recap card shows the game, result, numbers with a decimal comma and the source", () => {
    const content = JSON.stringify(
        buildMatchRecapView({
            inputs: { context, forum },
            recap: delivery,
            discordUserId: delivery.discordUserId,
            enabled: true,
        })
    )
    assert.match(content, /"label":"Shrnutí zápasu · Hell Let Loose"/)
    assert.match(content, /F1 · Medic/)
    assert.match(content, /Výhra 4 : 1/)
    assert.match(content, /VLK za Spojence/)
    assert.match(content, /K\/D \*\*2,40\*\*/)
    assert.match(content, /29,4 zabití · 16,7 úmrtí · K\/D 1,76/)
    assert.match(
        content,
        /Data ze serveru Vlci #1 \(CRCON\), jen tento zápas\./
    )
    assert.match(content, /match-recap:unsubscribe:events:one/)
    assert.match(
        content,
        /\/api\/og\/player-match\/imported%2Fplayer\/events%3Aone/
    )
})

test("actual recap runner uses Discord subject, rechecks eligibility and keeps the data ID in links", async (t) => {
    const calls: unknown[] = [],
        targets: string[] = []
    mockQueries(t as never, delivery, calls)
    t.mock.method(
        ConvexReactClient.prototype,
        "mutation",
        async (_reference: unknown, args: unknown) => {
            calls.push(["mark", args])
        }
    )
    let sent: { components: ContainerBuilder[] } | undefined
    const client = {
        users: {
            fetch: async (id: string) => {
                targets.push(id)
                return {
                    send: async (payload: {
                        components: ContainerBuilder[]
                    }) => {
                        sent = payload
                    },
                }
            },
        },
    } as unknown as Client
    await processMatchRecaps(client, "events:one")
    assert.deepEqual(targets, [delivery.discordUserId])
    assert.ok(
        calls.some(
            (call) =>
                JSON.stringify(call) ===
                JSON.stringify([
                    "matchRecaps:prepareDelivery",
                    {
                        secret: "dev-internal-auth-secret",
                        recapId: delivery.recapId,
                        eventId: "events:one",
                        discordUserId: delivery.discordUserId,
                    },
                ])
        )
    )
    assert.ok(sent)
    assert.match(
        text(sent),
        /\/players\/imported%2Fplayer\/matches\/events%3Aone/
    )
    assert.match(text(sent), /Klan Vlci/)
    assert.deepEqual(calls.at(-1), [
        "mark",
        {
            secret: "dev-internal-auth-secret",
            recapId: delivery.recapId,
            discordUserId: delivery.discordUserId,
        },
    ])
})

test("unsubscribe or relink during Discord lookup stops a previously listed recap", async (t) => {
    let sent = false
    mockQueries(t as never, null)
    t.mock.method(ConvexReactClient.prototype, "mutation", async () =>
        assert.fail("No sent marker")
    )
    const client = {
        users: {
            fetch: async () => ({
                send: async () => {
                    sent = true
                },
            }),
        },
    } as unknown as Client
    await processMatchRecaps(client, "events:one")
    assert.equal(sent, false)
})

test("failed Discord sends never create a sent marker", async (t) => {
    mockQueries(t as never)
    t.mock.method(ConvexReactClient.prototype, "mutation", async () =>
        assert.fail("No sent marker after failure")
    )
    let attempts = 0
    const client = {
        users: {
            fetch: async () => ({
                send: async () => {
                    attempts++
                    throw new Error("Synthetic provider unavailable")
                },
            }),
        },
    } as unknown as Client
    await processMatchRecaps(client, "events:one")
    assert.equal(attempts, 1)
})

test("legacy delivery records cannot trigger a Discord lookup", async (t) => {
    t.mock.method(
        ConvexReactClient.prototype,
        "query",
        async (reference: Parameters<typeof getFunctionName>[0]) =>
            getFunctionName(reference).endsWith("listPendingForEvent")
                ? [{ userId: "222222222222222222" }]
                : getFunctionName(reference).endsWith(
                        "getEventInteractionContext"
                    )
                  ? context
                  : forum
    )
    const client = {
        users: { fetch: async () => assert.fail("Unbound recipient") },
    } as unknown as Client
    await processMatchRecaps(client, "events:one")
})
