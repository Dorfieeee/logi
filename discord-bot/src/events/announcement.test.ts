import { MessageFlags } from "discord.js"
import assert from "node:assert/strict"
import test from "node:test"

import {
    announcementCountsOf,
    announcementMessage,
    announcementSignupRosterOf,
    announcementThumbnail,
    buildAnnouncementCard,
    rosterFactsOf,
} from "./announcement"
import {
    BOARD_NOW,
    boardConfig,
    boardEvent,
    boardGroups,
    boardPayload,
    boardRoster,
    withLimits,
} from "./board-example.fixture"
import { ANNOUNCEMENT_LAYOUT_VERSION } from "../../../src/domain/events/announcement-migration"
import { publicationFiles } from "../sync/publication-files"
import { decideAnnouncement } from "./announcement-sync"

function json(message: ReturnType<typeof announcementMessage>) {
    return JSON.parse(
        JSON.stringify(
            (message.components ?? []).map((component) =>
                "toJSON" in component ? component.toJSON() : component
            )
        )
    ) as Array<{ type: number; content?: string; accent_color?: number }>
}

test("the first post pings above the card; the card keeps the clan colour (L1-10, L1-02)", () => {
    const event = withLimits(boardEvent())
    const { view, state } = buildAnnouncementCard(boardPayload(event), event, {
        now: BOARD_NOW,
    })
    assert.equal(state, "open")
    const message = announcementMessage(view, {
        config: boardConfig,
        pingRoleIds: ["222222222222222222"],
    })
    const [ping, card] = json(message)
    assert.equal(ping?.type, 10)
    assert.equal(ping?.content, "<@&222222222222222222>")
    assert.equal(card?.type, 17)
    assert.equal(card?.accent_color, 0xe8a33d)
    assert.equal(message.flags, MessageFlags.IsComponentsV2)
    assert.deepEqual(message.allowedMentions, {
        parse: [],
        roles: ["222222222222222222"],
    })
})

test("later edits carry no ping line and allow no mentions (L1-25, L1-B02)", () => {
    const event = withLimits(boardEvent())
    const { view } = buildAnnouncementCard(boardPayload(event), event, {
        now: BOARD_NOW,
    })
    const message = announcementMessage(view, { config: boardConfig })
    const components = json(message)
    assert.equal(components.length, 1)
    assert.equal(components[0]?.type, 17)
    assert.deepEqual(message.allowedMentions, { parse: [], roles: [] })
})

test("the card never carries the password, the raw map or the raw side (L1-03, L1-139)", () => {
    const event = withLimits(boardEvent({ status: "starting" }))
    const { view } = buildAnnouncementCard(
        boardPayload(event, [boardRoster]),
        event,
        { now: new Date("2026-10-11T17:35:00.000Z") }
    )
    const text = JSON.stringify(
        json(announcementMessage(view, { config: boardConfig }))
    )
    assert.doesNotMatch(text, /k7-sraz|foy_warfare_day|Allies|VLK Scrim/)
    assert.match(text, /Potvrzeno 15 z 17/)
})

test("a closed event-info card keeps match facts and roster media without the sign-up list", () => {
    const event = withLimits(boardEvent({ status: "closed" }))
    const { view } = buildAnnouncementCard(
        boardPayload(event, [boardRoster]),
        event,
        {
            hideSignupRoster: true,
            rosterImage: {
                url: "attachment://roster.png",
                description: "Liga",
            },
        }
    )
    const text = JSON.stringify(view)

    assert.match(text, /attachment:\/\/roster\.png/)
    assert.doesNotMatch(text, /Zubr|Krtek|Rex/)
})

test("counts follow the board: groups, reserves and who is not coming", () => {
    const event = withLimits(
        boardEvent({
            participants: [
                {
                    userId: "a",
                    status: "attending",
                    group: "Tanky",
                    updatedAt: "x",
                },
                {
                    userId: "b",
                    status: "attending",
                    group: null,
                    requestedGroup: "Tanky",
                    updatedAt: "x",
                },
                {
                    userId: "c",
                    status: "not_attending",
                    group: null,
                    updatedAt: "x",
                },
            ],
        })
    )
    assert.deepEqual(announcementCountsOf(event, boardGroups), {
        groups: [
            { id: "inf", name: "Pěchota", count: 0 },
            { id: "tank", name: "Tanky", count: 1, max: 6 },
            { id: "recon", name: "Recon", count: 0, max: 2 },
        ],
        withoutGroup: 1,
        total: 2,
        declined: 1,
        generalSignup: false,
    })
})

test("the public card roster has every offered group and sorts names alphabetically", () => {
    const event = boardEvent({
        participants: [
            {
                userId: "z",
                status: "attending",
                group: "Pěchota",
                updatedAt: "x",
            },
            { userId: "a", status: "attending", group: "inf", updatedAt: "x" },
            {
                userId: "d",
                status: "not_attending",
                group: null,
                updatedAt: "x",
            },
        ],
    })
    assert.deepEqual(
        announcementSignupRosterOf(event, boardGroups, {
            z: "Zdeněk",
            a: "Adam",
            d: "Berta",
        }),
        {
            groups: [
                { name: "Pěchota", icon: "🟢", names: ["Adam", "Zdeněk"] },
                { name: "Tanky", icon: "🔵", names: [] },
                { name: "Recon", icon: "🟠", names: [] },
            ],
            declined: ["Berta"],
        }
    )
})

test("the public card roster falls back to mentions without a name projection", () => {
    const event = boardEvent({
        participants: [
            {
                userId: "member",
                status: "attending",
                group: "inf",
                updatedAt: "x",
            },
        ],
    })

    assert.deepEqual(announcementSignupRosterOf(event, boardGroups), {
        groups: [
            { name: "Pěchota", icon: "🟢", names: ["<@member>"] },
            { name: "Tanky", icon: "🔵", names: [] },
            { name: "Recon", icon: "🟠", names: [] },
        ],
        declined: [],
    })
})

test("roster facts count places, reserves and confirmations", () => {
    const facts = rosterFactsOf(
        boardEvent({
            absenceNotices: [
                { userId: "p16", reason: "20:15", createdAt: "x" },
                {
                    userId: "p17",
                    reason: "nemoc",
                    createdAt: "x",
                    kind: "cannot_come",
                },
                { userId: "outsider", reason: "x", createdAt: "x" },
            ],
        }),
        boardRoster
    )
    assert.deepEqual(facts, {
        players: 18,
        reserves: 7,
        confirmation: { confirmed: 15, total: 17, late: 1, cannotCome: 1 },
    })
})

test("a card is created when sign-ups open and pings once (L1-B01, L1-B02)", () => {
    const decide = (patch: Partial<Parameters<typeof decideAnnouncement>[0]>) =>
        decideAnnouncement({
            state: "open",
            hasMessage: false,
            context: { pingedAt: null, layoutVersion: null },
            pingRoleIds: ["role"],
            takeMigrationSlot: () => true,
            ...patch,
        })
    assert.deepEqual(decide({}), {
        kind: "publish",
        ping: true,
        migrating: false,
    })
    // Re-created after a deletion: no second ping.
    assert.deepEqual(
        decide({
            context: {
                pingedAt: "x",
                layoutVersion: ANNOUNCEMENT_LAYOUT_VERSION,
            },
        }),
        { kind: "publish", ping: false, migrating: false }
    )
    assert.deepEqual(decide({ pingRoleIds: [] }), {
        kind: "publish",
        ping: false,
        migrating: false,
    })
})

test("a finished match never gets a new card; an old card retired by the old bot stays gone", () => {
    const decide = (
        state: Parameters<typeof decideAnnouncement>[0]["state"],
        layoutVersion: string | null
    ) =>
        decideAnnouncement({
            state,
            hasMessage: false,
            context: { pingedAt: null, layoutVersion },
            pingRoleIds: ["role"],
            takeMigrationSlot: () => true,
        })
    assert.equal(decide("played", ANNOUNCEMENT_LAYOUT_VERSION).kind, "skip")
    assert.equal(decide("cancelled", ANNOUNCEMENT_LAYOUT_VERSION).kind, "skip")
    assert.equal(decide("closed", null).kind, "skip")
    // A card of the current layout deleted by someone comes back, without a ping.
    assert.deepEqual(decide("closed", ANNOUNCEMENT_LAYOUT_VERSION), {
        kind: "publish",
        ping: false,
        migrating: false,
    })
})

test("an old card is redrawn in place only while the minute's budget lasts (L1-B20)", () => {
    const decide = (slot: boolean) =>
        decideAnnouncement({
            state: "played",
            hasMessage: true,
            context: { pingedAt: null, layoutVersion: null },
            pingRoleIds: ["role"],
            takeMigrationSlot: () => slot,
        })
    assert.deepEqual(decide(true), {
        kind: "publish",
        ping: false,
        migrating: true,
    })
    assert.deepEqual(decide(false), {
        kind: "skip",
        reason: "migration-deferred",
    })
    // A current card is always edited, with no slot.
    assert.deepEqual(
        decideAnnouncement({
            state: "closed",
            hasMessage: true,
            context: {
                pingedAt: "x",
                layoutVersion: ANNOUNCEMENT_LAYOUT_VERSION,
            },
            pingRoleIds: ["role"],
            takeMigrationSlot: () => false,
        }),
        { kind: "publish", ping: false, migrating: false }
    )
})

test("the map picture is Logi's own art, reused on edits instead of uploaded again (L1-15)", async () => {
    const thumbnail = await announcementThumbnail(boardEvent(), "cs")
    assert.ok(thumbnail?.file)
    assert.match(
        thumbnail.media.url,
        /^attachment:\/\/logi-panel-mapa-foy-thumb-/
    )
    const name = thumbnail.media.url.slice("attachment://".length)
    const reused = publicationFiles([thumbnail.file], [{ id: "1", name }])
    assert.deepEqual(reused, {
        files: [],
        attachments: [{ id: "1", filename: name }],
    })
    // A training has no map picture (L1-62).
    assert.equal(
        await announcementThumbnail(boardEvent({ kind: "training" }), "cs"),
        null
    )
})
