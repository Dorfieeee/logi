import assert from "node:assert/strict"
import test from "node:test"

import type { ContainerBuilder } from "discord.js"

import {
    deliverRosterChanges,
    rosterChangesKey,
    type ClaimedRosterChanges,
    type RosterChangePorts,
} from "./roster-change-service"
import type { EventRecord, Roster, SyncPayload } from "../types"

const id = (n: number) => `10000000000000000${n}`

const event = {
    id: "event-1",
    guildId: "guild-1",
    kind: "match",
    name: "Liga",
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
    eventInfoChannelId: "300000000000000001",
    registrationEnd: "2026-10-10T17:30:00.000Z",
    meetingStart: "2026-10-11T17:30:00.000Z",
    gameStart: "2026-10-11T18:00:00.000Z",
} as unknown as EventRecord

const roster = {
    id: "roster-1",
    eventId: "event-1",
    published: true,
    reservePlayerIds: [id(4)],
    updatedAt: "2026-10-11T16:52:00.000Z",
    squads: [
        {
            name: "F1",
            group: "Pěchota",
            color: "#000",
            order: 0,
            players: [
                { id: id(1), ack: true, roleName: "Squad Leader" },
                { id: id(2), ack: false, roleName: "Rifleman" },
            ],
        },
        {
            name: "F2",
            group: "Pěchota",
            color: "#000",
            order: 1,
            players: [{ id: id(3), ack: false, roleName: "Anti-Tank" }],
        },
    ],
} as unknown as Roster

const payload = {
    config: {
        id: "config-1",
        guildId: "guild-1",
        timezone: "Europe/Prague",
        defaultLanguage: "cs",
        calendarCategories: [],
        updatedAt: "2026-10-01T10:00:00.000Z",
    },
    guild: { name: "Vlci", eventCategories: [] },
    groups: [],
    events: [event],
    rosters: [roster],
    userDisplayNames: {
        [id(1)]: "Rex_CZ",
        [id(2)]: "ŠtěkotDog",
        [id(3)]: "Krtek",
        [id(4)]: "Zubr",
    },
    syncStates: [
        {
            eventId: "event-1",
            eventInfoMessageId: "400000000000000001",
            rosterUpdateChannelId: "300000000000000001",
            rosterUpdateMessageId: "500000000000000001",
        },
    ],
} as unknown as SyncPayload

const request: ClaimedRosterChanges = {
    id: "request-1",
    eventId: "event-1",
    guildId: "guild-1",
    requestedAt: "2026-10-11T16:52:00.000Z",
    // Before: Zubr was in F1 as Anti-Tank, Krtek in F1.
    before: [
        { userId: id(1), squad: "F1", role: "Squad Leader" },
        { userId: id(4), squad: "F1", role: "Anti-Tank" },
        { userId: id(3), squad: "F1", role: "Anti-Tank" },
    ],
    digestBaseline: [
        { userId: id(1), squad: "F1", role: "Squad Leader" },
        { userId: id(4), squad: "F1", role: "Anti-Tank" },
        { userId: id(3), squad: "F1", role: "Anti-Tank" },
    ],
    notifyPlayers: true,
    postDigest: true,
    mentionPlayers: true,
    memberIds: [id(1), id(2), id(3), id(4)],
}

function fakePorts(closed: string[] = []) {
    const dms: Array<{ userId: string; json: string }> = []
    const digests: Array<Parameters<RosterChangePorts["publishDigest"]>[0]> = []
    const mentions: Array<Parameters<RosterChangePorts["mention"]>[0]> = []
    const ports: RosterChangePorts = {
        guild: null,
        async sendDm(userId, message) {
            dms.push({
                userId,
                json: JSON.stringify(
                    (
                        message as { components: ContainerBuilder[] }
                    ).components.map((item) => item.toJSON())
                ),
            })
            return !closed.includes(userId)
        },
        async publishDigest(input) {
            digests.push(input)
        },
        async mention(input) {
            mentions.push(input)
        },
    }
    return { ports, dms, digests, mentions }
}

test("one DM per changed member with all their changes; closed DMs are reported", async () => {
    const { ports, dms } = fakePorts([id(4)])
    const outcome = await deliverRosterChanges({ payload, request, ports })
    assert.deepEqual(outcome.dmSentUserIds, [id(2), id(3)])
    assert.deepEqual(outcome.dmFailedUserIds, [id(4)])
    const added = dms.find((dm) => dm.userId === id(2))!.json
    assert.match(added, /SOUPISKA · VLK VS ROG/)
    assert.match(added, /### Jsi na soupisce/)
    assert.match(added, /\*\*F1 · Rifleman\*\* · velitel čety Rex\\\\_CZ/)
    assert.match(added, /Klan Vlci/)
    const moved = dms.find((dm) => dm.userId === id(3))!.json
    assert.match(moved, /### Jiná četa: F2/)
    assert.match(moved, /\*\*F1 → F2\*\* · role zůstává Anti-Tank/)
    const removed = dms.find((dm) => dm.userId === id(4))!.json
    assert.match(removed, /### Už nejsi na soupisce/)
    assert.match(removed, /Velení tě odebralo z F1 \(Anti-Tank\)/)
    // Moved into the reserves: the reserve line and "Zobrazit zařazení".
    assert.match(removed, /\*\*Záloha\*\* · když se uvolní místo/)
    // The DM's "Zobrazit zařazení" names the server (L1-B19, L2-B01).
    assert.match(removed, /"custom_id":"roster-assignment:event-1:guild-1"/)
    assert.doesNotMatch(dms.map((dm) => dm.json).join(""), /Unassigned/)
})

test("the digest is one managed message per match in the roster channel, taking over the web's", async () => {
    const { ports, digests } = fakePorts()
    const outcome = await deliverRosterChanges({ payload, request, ports })
    assert.equal(outcome.digestPosted, true)
    assert.equal(digests.length, 1)
    const digest = digests[0]!
    assert.equal(digest.channelId, "300000000000000001")
    assert.equal(digest.legacyMessageId, "500000000000000001")
    assert.equal(digest.revision, Date.parse(request.requestedAt))
    const json = JSON.stringify(
        digest.message.components.map((item) => item.toJSON())
    )
    assert.match(json, /ZMĚNY SOUPISKY · VLK VS ROG/)
    assert.match(json, /Nově na soupisce\*\*\\nŠtěkotDog → F1 · Rifleman/)
    assert.match(json, /Mimo soupisku\*\*\\nZubr, dřív F1 · Anti-Tank/)
    assert.match(json, /Přesuny\*\*\\nKrtek: F1 → F2 · Anti-Tank/)
    assert.equal(rosterChangesKey("event-1"), "event:event-1:roster-changes")
})

test("a re-publish never sends another roster ping", async () => {
    const { ports, mentions } = fakePorts()
    await deliverRosterChanges({ payload, request, ports })
    assert.deepEqual(mentions, [])
})

test("nothing is sent when the admin turned everything off or the roster is gone", async () => {
    const { ports, dms, digests, mentions } = fakePorts()
    await deliverRosterChanges({
        payload,
        request: {
            ...request,
            notifyPlayers: false,
            postDigest: false,
            mentionPlayers: false,
        },
        ports,
    })
    await deliverRosterChanges({
        payload: { ...payload, rosters: [] },
        request,
        ports,
    })
    assert.deepEqual([dms, digests, mentions], [[], [], []])
})

test("a first publish without a roster channel mentions the attendee role in a reply to the announcement (D5-08)", async () => {
    // No roster channel: the announcement doubles as the roster card.
    const single = {
        ...payload,
        config: {
            ...payload.config,
            announcementsChannelId: "300000000000000009",
        },
        events: [
            {
                ...event,
                attendeeRoleId: "event-attendees",
                eventInfoChannelId: undefined,
            },
        ],
        syncStates: [
            {
                eventId: "event-1",
                announcementMessageId: "400000000000000009",
            },
        ],
    } as unknown as SyncPayload
    const firstPublish: ClaimedRosterChanges = {
        ...request,
        before: [],
        digestBaseline: [],
        notifyPlayers: false,
        postDigest: false,
        mentionPlayers: true,
        firstPublish: true,
    }
    const { ports, dms, digests, mentions } = fakePorts()
    await deliverRosterChanges({
        payload: single,
        request: firstPublish,
        ports,
    })
    assert.deepEqual(mentions, [
        {
            channelId: "300000000000000009",
            messageId: "400000000000000009",
            roleId: "event-attendees",
        },
    ])
    // Only the mention: no change DMs and no digest on a first publish.
    assert.deepEqual([dms, digests], [[], []])

    // With a roster channel the roster message's first post pings itself.
    const split = fakePorts()
    await deliverRosterChanges({
        payload,
        request: firstPublish,
        ports: split.ports,
    })
    assert.deepEqual(split.mentions, [])
})
