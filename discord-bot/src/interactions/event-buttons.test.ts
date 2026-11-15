import test, { afterEach } from "node:test"
import assert from "node:assert/strict"

import type { ButtonInteraction, StringSelectMenuInteraction } from "discord.js"
import { ConvexReactClient } from "convex/react"
import { getFunctionName } from "convex/server"

import {
    handleCheckSignupInteraction,
    handleEventButtonInteraction,
    handleEventSignupPickerInteraction,
    handleRankedSignupInteraction,
    replyGuildId,
} from "./event-buttons"
import {
    boardConfig,
    boardEvent,
    boardGroups,
} from "../events/board-example.fixture"
import type { EventInteractionContext } from "../types"
import { closeConvexClient } from "../convex"

afterEach(closeConvexClient)

const GUILD_ID = "900000000000000123"

test("ranked Discord draft adds, reorders, removes and saves only on request", async (t) => {
    const userId = "100000000000000001"
    const guildId = boardConfig.guildId
    const context: EventInteractionContext = {
        config: { ...boardConfig, defaultLanguage: "en" },
        groups: boardGroups,
        event: boardEvent({
            allowRankedSignup: true,
            allowNonMembersSignup: true,
            participants: [],
            registrationEnd: "2030-01-01T20:00:00.000Z",
            meetingStart: "2030-01-01T21:00:00.000Z",
            gameEnd: "2030-01-01T23:00:00.000Z",
        }),
        roster: null,
    }
    t.mock.method(ConvexReactClient.prototype, "query", async () => context)
    let activeClick: ButtonInteraction | StringSelectMenuInteraction
    const mutations: Array<{ group: string; signupPreferences?: string[] }> = []
    t.mock.method(
        ConvexReactClient.prototype,
        "mutation",
        async (
            _reference: unknown,
            args: { group: string; signupPreferences?: string[] }
        ) => {
            assert.equal(
                activeClick.deferred,
                true,
                "acknowledge before saving"
            )
            mutations.push(args)
            return { appliedSignupLabel: args.group, removed: false }
        }
    )
    t.mock.method(
        globalThis,
        "fetch",
        async () => new Response("{}", { status: 200 })
    )
    const replies: unknown[] = []
    let privateCard = true
    let openedModal = false
    function click(
        customId: string,
        value?: string
    ): ButtonInteraction | StringSelectMenuInteraction {
        activeClick = {
            customId,
            guildId,
            guild: { id: guildId },
            member: { roles: { cache: new Map([["555555555555555555", {}]]) } },
            user: {
                id: userId,
                username: "Player",
                displayAvatarURL: () => "https://example.com/avatar.png",
            },
            deferred: false,
            replied: false,
            values: value ? [value] : [],
            isButton: () => !value,
            isStringSelectMenu: () => Boolean(value),
            message: { flags: { has: () => privateCard } },
            async deferUpdate(this: { deferred: boolean }) {
                assert.equal(privateCard, true)
                assert.equal(this.deferred, false)
                this.deferred = true
            },
            async deferReply(
                this: { deferred: boolean },
                options: { ephemeral: boolean }
            ) {
                assert.equal(privateCard, false)
                assert.equal(options.ephemeral, true)
                assert.equal(this.deferred, false)
                this.deferred = true
            },
            async showModal(this: { deferred: boolean }) {
                assert.equal(
                    this.deferred,
                    false,
                    "a modal must be the initial response"
                )
                openedModal = true
            },
            awaitModalSubmit: async () => undefined,
            editReply: async (payload: unknown) => {
                replies.push(payload)
            },
            update: async (payload: unknown) => {
                replies.push(payload)
            },
            reply: async (payload: unknown) => {
                replies.push(payload)
            },
        } as unknown as ButtonInteraction | StringSelectMenuInteraction
        return activeClick
    }
    const options = { enqueueEventSync: () => {}, triggerPollSoon: () => {} }
    // First signup is durable immediately, including primary/secondary fallback.
    context.assignments = [
        { userId, primaryGroupId: "inf", secondaryGroupIds: ["tank"] },
    ]
    await handleEventSignupPickerInteraction(
        click(`signup-picker:event-1:${guildId}`) as ButtonInteraction,
        options
    )
    assert.equal(mutations.at(-1)?.group, boardGroups[0].name)
    assert.deepEqual(mutations.at(-1)?.signupPreferences, [boardGroups[0].name])
    context.assignments[0].primaryGroupId = "unoffered"
    await handleEventSignupPickerInteraction(
        click(`signup-picker:event-1:${guildId}`) as ButtonInteraction,
        options
    )
    assert.equal(mutations.at(-1)?.group, boardGroups[1].name)
    context.assignments = []
    const beforePicker = mutations.length
    await handleEventSignupPickerInteraction(
        click(`signup-picker:event-1:${guildId}`) as ButtonInteraction,
        options
    )
    assert.equal(mutations.length, beforePicker)
    assert.match(payloadText(replies.at(-1)), /Not signed up/)
    await handleEventButtonInteraction(
        click(`signup:event-1:select:${guildId}`, "inf"),
        options
    )
    assert.equal(mutations.length, beforePicker + 1)
    assert.match(payloadText(replies.at(-1)), /No further action required/)
    context.event.participants = [
        {
            userId,
            status: "attending",
            group: boardGroups[0].name,
            updatedAt: "2030-01-01T00:00:00.000Z",
        },
    ]
    const beforeRepeat = mutations.length
    await handleEventSignupPickerInteraction(
        click(`signup-picker:event-1:${guildId}`) as ButtonInteraction,
        options
    )
    assert.equal(
        mutations.length,
        beforeRepeat,
        "repeat signup preserves saved choices"
    )
    mutations.length = 0
    await handleEventSignupPickerInteraction(
        click(`signup-picker:event-1:${guildId}:edit`) as ButtonInteraction
    )
    function actionId(action: string) {
        const match = payloadText(replies.at(-1)).match(
            new RegExp(`ranked-signup:[a-f0-9-]+:\\d+:${action}`)
        )
        assert.ok(match, `missing action ${action}`)
        return match[0]
    }
    await handleRankedSignupInteraction(click(actionId("add"), "inf"), options)
    assert.equal(mutations.length, 0)
    await handleRankedSignupInteraction(click(actionId("add"), "tank"), options)
    await handleRankedSignupInteraction(click(actionId("edit")), options)
    await handleRankedSignupInteraction(click(actionId("up-1")), options)
    await handleRankedSignupInteraction(click(actionId("remove-1")), options)
    await handleRankedSignupInteraction(click(actionId("done")), options)
    const saveId = actionId("save")
    await handleRankedSignupInteraction(click(saveId), options)
    assert.equal(mutations.length, 1)
    assert.deepEqual(mutations[0].signupPreferences, [boardGroups[1].name])
    assert.equal(mutations[0].group, boardGroups[1].name)
    await handleRankedSignupInteraction(click(saveId), options)
    assert.equal(
        mutations.length,
        1,
        "an expired or replayed editor never saves twice"
    )
    context.event.participants = []
    // Legacy matches without the ranked setting may repeatedly choose any group.
    delete context.event.allowRankedSignup
    for (const groupId of ["tank", "tank", "inf", "inf", "tank"]) {
        privateCard = !privateCard
        const before: number = mutations.length
        await handleEventButtonInteraction(
            click(`signup:event-1:${groupId}:${guildId}`),
            options
        )
        assert.equal(mutations.length, before + 1)
        assert.equal(
            mutations.at(-1)?.group,
            boardGroups.find((group) => group.id === groupId)?.name
        )
        assert.equal(mutations.at(-1)?.signupPreferences, undefined)
    }
    context.event.registrationEnd = new Date(Date.now() - 60_000).toISOString()
    context.event.meetingStart = new Date(Date.now() + 60_000).toISOString()
    const beforeModal = mutations.length
    await handleEventButtonInteraction(
        click(`signup:event-1:inf:${guildId}`),
        options
    )
    assert.equal(openedModal, true)
    assert.equal(
        mutations.length,
        beforeModal,
        "no save before the reason is submitted"
    )
})

test("a reply takes the clan from the server, else from the button's custom ID (L1-B19)", () => {
    assert.equal(
        replyGuildId("900000000000000001", GUILD_ID),
        "900000000000000001"
    )
    assert.equal(replyGuildId(null, GUILD_ID), GUILD_ID)
    assert.equal(replyGuildId(undefined, ` ${GUILD_ID} `), GUILD_ID)
    // Only a Discord ID names a clan; anything else falls back to no clan.
    assert.equal(replyGuildId(null, "select"), undefined)
    assert.equal(replyGuildId(null, undefined), undefined)
})

/** A DM click on a sign-up reminder button: no guild on the interaction. */
function dmClick(customId: string) {
    const replies: unknown[] = []
    const interaction = {
        customId,
        guildId: null,
        guild: null,
        deferred: false,
        replied: false,
        user: { id: "100000000000000001" },
        isButton: () => true,
        isStringSelectMenu: () => false,
        reply: async (payload: unknown) => {
            replies.push(payload)
        },
        followUp: async (payload: unknown) => {
            replies.push(payload)
        },
        editReply: async (payload: unknown) => {
            replies.push(payload)
        },
    }
    return { interaction: interaction as unknown as ButtonInteraction, replies }
}

function payloadText(payload: unknown) {
    const components =
        (payload as { components?: Array<{ toJSON?: () => unknown }> })
            .components ?? []
    return JSON.stringify(
        components.map((component) =>
            typeof component.toJSON === "function"
                ? component.toJSON()
                : component
        )
    )
}

// A separate clan per case: the bot caches each clan's language.
for (const [label, handler, guildId, customId] of [
    [
        "Přihlásit se",
        handleEventSignupPickerInteraction,
        "900000000000000201",
        "signup-picker:event-1:900000000000000201",
    ],
    [
        "Upravit přihlášku",
        handleCheckSignupInteraction,
        "900000000000000202",
        "check-signup:event-1:900000000000000202",
    ],
    [
        "Nepřijdu",
        (interaction: ButtonInteraction) =>
            handleEventButtonInteraction(interaction, {
                enqueueEventSync: () => {},
                triggerPollSoon: () => {},
            }),
        "900000000000000203",
        "signup:event-1:NOT_ATTENDING:900000000000000203",
    ],
] as const) {
    test(`a deleted match clicked from a DM (${label}) answers in the clan language (L1-B19)`, async (t) => {
        const requests: Array<{ name: string; args: unknown }> = []
        t.mock.method(
            ConvexReactClient.prototype,
            "query",
            async (
                reference: Parameters<typeof getFunctionName>[0],
                args: unknown
            ) => {
                const name = getFunctionName(reference)
                requests.push({ name, args })
                // The clan reads Czech; the match is gone.
                return name === "discordConfig:getConfigByDiscordGuildId"
                    ? { defaultLanguage: "cs" }
                    : null
            }
        )
        const { interaction, replies } = dmClick(customId)
        await handler(interaction)
        assert.equal(replies.length, 1)
        const text = payloadText(replies[0])
        assert.match(text, /Zápas už není k dispozici/)
        assert.doesNotMatch(text, /no longer available/)
        // The language came from the guild in the custom ID.
        assert.ok(
            requests.some(
                (request) =>
                    request.name ===
                        "discordConfig:getConfigByDiscordGuildId" &&
                    (request.args as { guildId?: string }).guildId === guildId
            )
        )
    })
}
