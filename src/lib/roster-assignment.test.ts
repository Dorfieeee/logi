import type { Roster, AppUser } from "../types/domain"
import assert from "node:assert/strict"
import test from "node:test"

import {
    autoFillRosterAssignments,
    getSignupPreferencesByUserId,
} from "./roster-assignment"

const weights = () => 0.5

function allocationFixture(count: number) {
    const users: AppUser[] = Array.from({ length: count }, (_, index) => ({
        id: `player-${index}`,
        discordId: `player-${index}`,
        name: `Player ${index}`,
        scores: { guild: index },
        avatar: "",
        hasDiscordLink: true,
        isStreamer: false,
        managedGuildIds: [],
        mercenaryGuildIds: [],
        platformIds: [],
        nicknames: {},
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01",
    }))
    const context: Parameters<typeof autoFillRosterAssignments>[1] = {
        usersById: new Map(users.map((user) => [user.discordId, user])),
        assignmentsByUserId: new Map(),
        groupsById: new Map(),
        participantStatusByUserId: new Map(),
        signupGroupByUserId: new Map(
            users.map((user) => [user.discordId, "Armor"])
        ),
        signupPreferencesByUserId: new Map(
            users.map((user) => [user.discordId, ["Armor"]])
        ),
        serverDiscordId: "guild",
    }
    const board: Roster = {
        id: "roster",
        eventId: "event",
        guildId: "guild",
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01",
        squads: ["Armor", "Infantry", "Recon"].map((group, order) => ({
            name: group,
            group,
            order,
            color: "#ffffff",
            players: [{ ack: false }],
        })),
        reservePlayerIds: users.map((user) => user.discordId),
        notAttendingPlayerIds: [],
        published: false,
    }
    return { board, context }
}

test("surplus players stay in reserves rather than taking an unselected group", () => {
    const { board, context } = allocationFixture(4)
    const result = autoFillRosterAssignments(board, context, weights)
    assert.equal(result.squads[0].players[0].id, "player-3")
    assert.equal(result.squads[1].players[0].id, undefined)
    assert.equal(result.reservePlayerIds.length, 3)
})

test("a shortage permits random fallback while preserving preferred and existing placements", () => {
    const { board, context } = allocationFixture(2)
    board.squads.push({
        name: "Fixed",
        group: "Armor",
        order: 3,
        color: "#ffffff",
        players: [{ id: "fixed", ack: true }],
    })
    const result = autoFillRosterAssignments(board, context, () => 0.25)
    assert.equal(result.squads[0].players[0].id, "player-1")
    assert.equal(
        result.squads
            .flatMap((squad) => squad.players)
            .filter((player) => player.id).length,
        3
    )
    assert.deepEqual(result.squads[3], board.squads[3])
    assert.deepEqual(result.reservePlayerIds, [])
})

test("ranked backups beat score and preserve the best overall fit", () => {
    const { board, context } = allocationFixture(4)
    context.signupPreferencesByUserId?.set("player-0", ["Armor", "Infantry"])
    const result = autoFillRosterAssignments(board, context)
    assert.equal(result.squads[0].players[0].id, "player-3")
    assert.equal(result.squads[1].players[0].id, "player-0")
    assert.equal(result.squads[2].players[0].id, undefined)
})

test("a declined player is never used as a random fallback", () => {
    const { board, context } = allocationFixture(1)
    context.participantStatusByUserId.set("player-0", "not_attending")
    const result = autoFillRosterAssignments(board, context)
    assert.equal(
        result.squads
            .flatMap((squad) => squad.players)
            .some((player) => player.id),
        false
    )
})

test("distinct catalogue groups are never conflated by similar role names", () => {
    const { board, context } = allocationFixture(4)
    board.squads[0].group = "Armor B"
    context.groupsById.set("a", {
        id: "a",
        guildId: "guild",
        name: "Armor A",
        color: "#ffffff",
        order: 0,
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01",
    })
    context.groupsById.set("b", {
        ...context.groupsById.get("a")!,
        id: "b",
        name: "Armor B",
    })
    for (const id of board.reservePlayerIds)
        context.signupPreferencesByUserId?.set(id, ["Armor A"])
    const result = autoFillRosterAssignments(board, context)
    assert.equal(result.squads[0].players[0].id, undefined)
    assert.equal(result.reservePlayerIds.length, 4)
})

test("legacy roster role labels recognize signup groups in every supported language", () => {
    for (const name of ["Infantry", "Pěchota", "Infanterie", "Piechota"]) {
        const { board, context } = allocationFixture(4)
        for (const id of board.reservePlayerIds)
            context.signupPreferencesByUserId?.set(id, [name])
        const result = autoFillRosterAssignments(board, context)
        assert.equal(result.squads[1].players[0].id, "player-3", name)
        assert.equal(result.squads[0].players[0].id, undefined, name)
    }
})

test("preference reader keeps reserve requests and participant precedence over legacy signup data", () => {
    assert.deepEqual(
        getSignupPreferencesByUserId({
            participants: [
                {
                    userId: "one",
                    status: "attending",
                    group: null,
                    requestedGroup: "Armor",
                    signupPreferences: ["Armor", "Infantry"],
                },
                {
                    userId: "declined",
                    status: "not_attending",
                    signupPreferences: ["Armor"],
                },
            ],
            signUps: [{ userId: "one", group: "Recon" }],
        }),
        new Map([
            ["one", ["Armor", "Infantry"]],
            ["declined", []],
        ])
    )
})

test("shared autofill preserves clan allocation even when another clan's player ranks higher", () => {
    const board: Roster = {
        id: "roster",
        eventId: "event",
        guildId: "host",
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01",
        squads: [
            {
                name: "Alpha",
                group: "Infantry",
                color: "#fff",
                order: 0,
                players: [{ allocatedGuildId: "guest", ack: false }],
            },
        ],
        reservePlayerIds: ["host-player", "guest-player"],
        notAttendingPlayerIds: [],
        published: false,
    }
    const user = (id: string, guild: string): AppUser => ({
        id,
        discordId: id,
        name: id,
        avatar: "",
        hasDiscordLink: true,
        isStreamer: false,
        managedGuildIds: [],
        mercenaryGuildIds: [],
        platformIds: [],
        nicknames: {},
        scores: { host: guild === "host" ? 100 : 0 },
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01",
        sharedGuildId: guild,
        sharedEligibleGuildIds: [guild],
    })
    const context: Parameters<typeof autoFillRosterAssignments>[1] = {
        usersById: new Map([
            ["host-player", user("host-player", "host")],
            ["guest-player", user("guest-player", "guest")],
        ]),
        assignmentsByUserId: new Map(),
        groupsById: new Map(),
        signupGroupByUserId: new Map(),
        participantStatusByUserId: new Map(),
        serverDiscordId: "host",
    }
    const result = autoFillRosterAssignments(board, context, weights)
    assert.equal(result.squads[0].players[0].id, "guest-player")
    assert.equal(result.squads[0].players[0].allocatedGuildId, "guest")
    assert.deepEqual(result.reservePlayerIds, ["host-player"])
})

test("autoFillRosterAssignments processes players first and keeps specialists near their signup preference", () => {
    const board = {
        id: "roster-1",
        squads: [
            {
                name: "Able",
                group: "Infantry",
                order: 0,
                color: "#fff",
                players: [
                    {
                        roleName: "Rifleman",
                        roleIcon: "/rifle",
                        ack: false,
                        confirmed: false,
                        note: "",
                    },
                ],
            },
            {
                name: "Steel",
                group: "Armor",
                order: 1,
                color: "#000",
                players: [
                    {
                        roleName: "Tank Commander",
                        roleIcon: "/tank",
                        ack: false,
                        confirmed: false,
                        note: "",
                    },
                ],
            },
            {
                name: "Guns",
                group: "Artillery",
                order: 2,
                color: "#333",
                players: [
                    {
                        roleName: "Artillery",
                        roleIcon: "/arty",
                        ack: false,
                        confirmed: false,
                        note: "",
                    },
                ],
            },
        ],
        reservePlayerIds: ["tanker", "infantry"],
        notAttendingPlayerIds: [],
        published: false,
    }

    const context = {
        usersById: new Map([
            [
                "tanker",
                {
                    discordId: "tanker",
                    name: "Tanker",
                    scores: {},
                    performance: { averages: { killDeathRatio: 1.5 } },
                },
            ],
            [
                "infantry",
                {
                    discordId: "infantry",
                    name: "Infantry",
                    scores: {},
                    performance: { averages: { killDeathRatio: 1.1 } },
                },
            ],
        ]),
        assignmentsByUserId: new Map(),
        groupsById: new Map(),
        signupGroupByUserId: new Map([
            ["tanker", "armor"],
            ["infantry", "infantry"],
        ]),
        participantStatusByUserId: new Map(),
        serverDiscordId: "guild-1",
    }

    const next = autoFillRosterAssignments(
        board as never,
        context as never,
        weights
    )

    assert.equal(next.squads[0]?.players[0]?.id, "infantry")
    assert.equal(next.squads[1]?.players[0]?.id, "tanker")
    assert.equal(next.squads[2]?.players[0]?.id, undefined)
    assert.deepEqual(next.reservePlayerIds, [])
})

test("autoFillRosterAssignments breaks signup ties by score before K/D", () => {
    const board = {
        id: "roster-1",
        squads: [
            {
                name: "Able",
                group: "Infantry",
                order: 0,
                color: "#fff",
                players: [
                    {
                        roleName: "Rifleman",
                        roleIcon: "/rifle",
                        ack: false,
                        confirmed: false,
                        note: "",
                    },
                ],
            },
        ],
        reservePlayerIds: ["high-score", "high-kd"],
        notAttendingPlayerIds: [],
        published: false,
    }

    const usersById = new Map([
        [
            "high-score",
            {
                discordId: "high-score",
                name: "Alpha",
                scores: { "guild-1": 200 },
                performance: { averages: { killDeathRatio: 1.0 } },
            },
        ],
        [
            "high-kd",
            {
                discordId: "high-kd",
                name: "Bravo",
                scores: { "guild-1": 50 },
                performance: { averages: { killDeathRatio: 3.0 } },
            },
        ],
    ])

    const context = {
        usersById,
        assignmentsByUserId: new Map(),
        groupsById: new Map(),
        signupGroupByUserId: new Map(),
        participantStatusByUserId: new Map(),
        serverDiscordId: "guild-1",
    }

    const scoreFirst = autoFillRosterAssignments(
        board as never,
        context as never,
        () => 0.5
    )
    assert.equal(scoreFirst.squads[0]?.players[0]?.id, "high-score")

    const kdFirst = autoFillRosterAssignments(
        board as never,
        context as never,
        () => 0.5
    )
    assert.equal(kdFirst.squads[0]?.players[0]?.id, "high-score")
})

test("candidate sorting switches metrics while preserving availability priority", async () => {
    const { compareRosterCandidates } = await import("./roster-assignment")
    const { context } = allocationFixture(2)
    const left = context.usersById.get("player-0")!
    left.performance = {
        matchesPlayed: 1,
        averages: {
            kills: 10,
            deaths: 2,
            killDeathRatio: 5,
            offense: 0,
            defense: 0,
            support: 0,
        },
    }
    context.signupGroupByUserId.set("player-0", "Infantry")
    const slot = { squadGroup: "Infantry" }
    assert.ok(
        compareRosterCandidates("player-0", "player-1", context, slot, {
            sort: "role",
        }) < 0
    )
    assert.ok(
        compareRosterCandidates("player-0", "player-1", context, slot, {
            sort: "score",
        }) > 0
    )
    assert.ok(
        compareRosterCandidates("player-0", "player-1", context, slot, {
            sort: "kd",
        }) < 0
    )
    assert.ok(
        compareRosterCandidates("player-0", "player-1", context, slot, {
            sort: "kd",
            assignedElsewhereUserIds: new Set(["player-0"]),
        }) > 0
    )
    context.participantStatusByUserId.set("player-0", "not_attending")
    assert.ok(
        compareRosterCandidates("player-0", "player-1", context, slot, {
            sort: "kd",
        }) > 0
    )
    assert.ok(
        compareRosterCandidates("missing", "player-1", context, slot, {
            sort: "score",
        }) > 0
    )
})

test("explicit score sort uses the roster game rather than a legacy HLL score", async () => {
    const { compareRosterCandidates } = await import("./roster-assignment")
    const { context } = allocationFixture(2)
    context.usersById.get("player-0")!.scores[
        JSON.stringify(["guild", "wardogs"])
    ] = 50
    assert.ok(
        compareRosterCandidates("player-0", "player-1", context, undefined, {
            sort: "score",
            gameId: "wardogs",
        }) < 0
    )
    assert.ok(
        compareRosterCandidates("player-0", "player-1", context, undefined, {
            sort: "score",
        }) > 0
    )
})
