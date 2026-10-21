import assert from "node:assert/strict"
import test from "node:test"

import type {
    ButtonInteraction,
    ContainerBuilder,
    ModalSubmitInteraction,
} from "discord.js"
import { ConvexReactClient } from "convex/react"
import { getFunctionName } from "convex/server"
import { afterEach } from "node:test"

import {
    attendanceReplyInteractions,
    buildLateNoticeModal,
} from "./attendance-replies"
import type { DiscordConfig, EventRecord } from "../types"
import { createInteractionRegistry } from "./registry"
import { interactionFeatures } from "./features"
import { closeConvexClient } from "../convex"

afterEach(closeConvexClient)

const config = {
    guildId: "guild-1",
    timezone: "Europe/Prague",
    defaultLanguage: "cs",
} as DiscordConfig
const event = {
    id: "event-1",
    guildId: "guild-1",
    name: "Liga",
    // A published roster can be answered before the 24-hour reminder window.
    status: "closed",
    meetingStart: "2026-10-11T17:30:00.000Z",
    gameStart: "2099-10-11T18:00:00.000Z",
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
} as unknown as EventRecord

const context = {
    config: { ...config, meetingChannelId: "200000000000000001" },
    event,
    groups: [],
    roster: {
        id: "roster-1",
        published: true,
        reservePlayerIds: [],
        squads: [
            { name: "F1", players: [{ id: "100000000000000001", ack: false }] },
        ],
    },
}

const feature = { enqueueEventSync: () => {}, triggerPollSoon: () => {} }

test("the attendance answers are routed by the registry, next to the other features", () => {
    const routes = createInteractionRegistry(
        [attendanceReplyInteractions],
        feature
    ).routes()
    assert.deepEqual(routes, [
        "button:attendance-confirm:",
        "button:attendance-late:",
        "modal:attendance-late-modal:",
    ])
    // All W6b features register without clashing.
    assert.doesNotThrow(() =>
        createInteractionRegistry(interactionFeatures, feature)
    )
})

test("the late form names the match in the clan language", () => {
    const modal = buildLateNoticeModal({ config, event }).toJSON()
    assert.equal(modal.custom_id, "attendance-late-modal:event-1:guild-1")
    assert.equal(modal.title, "Přijdu později · VLK vs ROG")
    const row = modal.components[0]
    const input = row && "components" in row ? row.components[0] : undefined
    assert.ok(input && "custom_id" in input)
    assert.equal("label" in input ? input.label : "", "Kdy dorazíš a proč")
    assert.equal(
        "placeholder" in input ? input.placeholder : "",
        "Např. ve 20:15, končím v práci"
    )
    assert.equal(input.required, true)
})

test("Potvrdím acknowledges before the reminder window and answers in the same DM with the footer", async (t) => {
    const mutations: string[] = []
    t.mock.method(
        ConvexReactClient.prototype,
        "query",
        async (reference: Parameters<typeof getFunctionName>[0]) =>
            getFunctionName(reference).endsWith("getEventInteractionContext")
                ? context
                : null
    )
    t.mock.method(
        ConvexReactClient.prototype,
        "mutation",
        async (reference: Parameters<typeof getFunctionName>[0]) => {
            mutations.push(getFunctionName(reference))
        }
    )
    t.mock.method(globalThis, "fetch", async () => new Response("{}"))
    let reply: { flags?: number; components: ContainerBuilder[] } | undefined
    const registry = createInteractionRegistry(
        [attendanceReplyInteractions],
        feature
    )
    await registry.routeButton({
        customId: "attendance-confirm:event-1",
        guildId: null,
        user: { id: "100000000000000001" },
        client: {
            guilds: { fetch: async () => ({ name: "Vlci" }) },
        },
        deferred: false,
        replied: false,
        reply: async (value: typeof reply) => {
            reply = value
        },
    } as unknown as ButtonInteraction)
    assert.deepEqual(mutations, ["rosters:acknowledgeAttendance"])
    assert.ok(reply)
    const json = JSON.stringify(reply.components.map((item) => item.toJSON()))
    assert.match(json, /### Účast potvrzena/)
    assert.match(
        json,
        /Uvidíme se v ne <t:\d+:d> v <t:\d+:t> v kanálu <#200000000000000001>\./
    )
    assert.match(json, /Klan Vlci · \[Nastavit zprávy\]/)
    // A DM reply is a normal message, not ephemeral.
    assert.equal((reply.flags ?? 0) & 64, 0)
})

test("after the start every answer is refused with Zápas už začal", async (t) => {
    t.mock.method(ConvexReactClient.prototype, "query", async () => ({
        ...context,
        event: { ...event, gameStart: "2000-01-01T00:00:00.000Z" },
    }))
    t.mock.method(ConvexReactClient.prototype, "mutation", async () =>
        assert.fail("No answer after the start")
    )
    let reply: { components: ContainerBuilder[] } | undefined
    await createInteractionRegistry(
        [attendanceReplyInteractions],
        feature
    ).routeModal({
        customId: "attendance-late-modal:event-1",
        guildId: "guild-1",
        user: { id: "100000000000000001" },
        deferred: false,
        replied: false,
        ephemeral: true,
        deferReply: async function (this: { deferred: boolean }) {
            this.deferred = true
        },
        editReply: async (value: typeof reply) => {
            reply = value
        },
        fields: { getTextInputValue: () => "ve 20:15" },
    } as unknown as ModalSubmitInteraction)
    assert.ok(reply)
    assert.match(
        JSON.stringify(reply.components.map((item) => item.toJSON())),
        /Zápas už začal/
    )
})
