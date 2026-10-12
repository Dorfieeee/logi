import { rosterMutationSchema } from "@/domain/api/roster-mutation"
import { moveRosterSquad } from "@/domain/rosters/layout"
import assert from "node:assert/strict"
import test from "node:test"

import {
    DeclineRosterAttendanceUseCase,
    UpdateRosterAttendanceUseCase,
    UpsertRosterUseCase,
    type RosterCommandRepository,
} from "./roster-commands.use-case"

class InMemoryRosterCommandRepository implements RosterCommandRepository {
    constructor(
        public rosters: Map<string, any>,
        public event: any,
        public assignments: any[]
    ) {}

    async getRosterById(rosterId: string) {
        return this.rosters.get(rosterId) ?? null
    }
    async getRosterByEventId(eventId: string) {
        return (
            [...this.rosters.values()].find(
                (roster) => roster.eventId === eventId
            ) ?? null
        )
    }
    async getEvent() {
        return this.event
    }
    async listAssignments() {
        return this.assignments
    }
    async createRoster(roster: any) {
        const id = `roster-${this.rosters.size + 1}`
        this.rosters.set(id, { id, ...roster })
        return id
    }
    async updateRoster(rosterId: string, roster: any) {
        this.rosters.set(rosterId, { id: rosterId, ...roster })
    }
}

test("API-equivalent roster save preserves cross-section squad moves and reserve placement", async () => {
    const squads = [
        {
            name: "FL1",
            group: "Infantry",
            order: 0,
            color: "#ffffff",
            players: [{ id: "player-1", ack: true, roleName: "Leader" }],
        },
        {
            name: "FL4",
            group: "Other",
            order: 1,
            color: "#ffffff",
            players: [{ id: "reserve-1", ack: false, roleName: "Medic" }],
        },
    ]
    const repo = new InMemoryRosterCommandRepository(
        new Map(),
        {
            guildId: "guild-1",
            registrationEnd: "2026-10-12T10:00:00Z",
            participants: ["player-1", "reserve-1"].map((userId) => ({
                userId,
                status: "attending",
                updatedAt: "2026-10-11T10:00:00Z",
            })),
            updatedAt: "2026-10-11T10:00:00Z",
            createdAt: "2026-10-11T10:00:00Z",
        },
        []
    )
    const input = rosterMutationSchema.parse({
        eventId: "event-1",
        squads: moveRosterSquad(squads, 1, "Infantry", 0),
        reservePlayerIds: [],
        notAttendingPlayerIds: [],
        published: false,
    })
    const id = await new UpsertRosterUseCase(repo).execute(input)
    const saved = repo.rosters.get(id)
    assert.deepEqual(saved.squads, input.squads)
    assert.equal(saved.squads[0].name, "FL4")
    assert.equal(saved.squads[0].group, "Infantry")
    assert.deepEqual(saved.reservePlayerIds, [])
    assert.equal(saved.squads[0].players[0].id, "reserve-1")
})

test("UpsertRosterUseCase adds tracked attendees to reserve when creating a roster", async () => {
    const repo = new InMemoryRosterCommandRepository(
        new Map(),
        {
            guildId: "guild-1",
            registrationEnd: "2026-07-21T10:00:00.000Z",
            participants: [
                {
                    userId: "user-1",
                    status: "attending",
                    updatedAt: "2026-07-20T10:00:00.000Z",
                },
            ],
            updatedAt: "2026-07-20T10:00:00.000Z",
            createdAt: "2026-07-20T10:00:00.000Z",
        },
        [
            {
                userId: "user-1",
                serverId: "guild-1",
                createdAt: "2026-07-19T10:00:00.000Z",
            },
        ]
    )

    const rosterId = await new UpsertRosterUseCase(repo).execute({
        eventId: "event-1",
        squads: [],
        reservePlayerIds: [],
        reserveAttendances: [],
        notAttendingPlayerIds: [],
        published: false,
    })

    assert.equal(rosterId, "roster-1")
    assert.deepEqual(repo.rosters.get("roster-1")?.reservePlayerIds, ["user-1"])
})

test("UpsertRosterUseCase preserves manually assigned users added after registration closed", async () => {
    const repo = new InMemoryRosterCommandRepository(
        new Map([
            [
                "roster-1",
                {
                    id: "roster-1",
                    eventId: "event-1",
                    squads: [],
                    reservePlayerIds: [],
                    reserveAttendances: [],
                    notAttendingPlayerIds: [],
                    published: true,
                },
            ],
        ]),
        {
            guildId: "guild-1",
            registrationEnd: "2026-07-21T10:00:00.000Z",
            participants: [],
            updatedAt: "2026-07-21T12:00:00.000Z",
            createdAt: "2026-07-20T10:00:00.000Z",
        },
        [
            {
                userId: "late-user",
                serverId: "guild-1",
                createdAt: "2026-07-21T11:00:00.000Z",
            },
        ]
    )

    const rosterId = await new UpsertRosterUseCase(repo).execute({
        rosterId: "roster-1",
        eventId: "event-1",
        squads: [
            {
                name: "Able",
                group: "INF",
                order: 1,
                color: "#fff",
                players: [{ id: "late-user", ack: false, confirmed: false }],
            },
        ],
        reservePlayerIds: [],
        reserveAttendances: [],
        notAttendingPlayerIds: [],
        published: true,
    })

    assert.equal(rosterId, "roster-1")
    assert.equal(
        repo.rosters.get("roster-1")?.squads[0]?.players[0]?.id,
        "late-user"
    )
})

test("UpdateRosterAttendanceUseCase updates reserve attendance confirmation state", async () => {
    const repo = new InMemoryRosterCommandRepository(
        new Map([
            [
                "roster-1",
                {
                    id: "roster-1",
                    eventId: "event-1",
                    squads: [],
                    reservePlayerIds: ["user-1"],
                    reserveAttendances: [
                        { userId: "user-1", ack: false, confirmed: false },
                    ],
                    notAttendingPlayerIds: [],
                    published: false,
                },
            ],
        ]),
        null,
        []
    )

    await new UpdateRosterAttendanceUseCase(repo).setStatus(
        "event-1",
        "user-1",
        "confirmed"
    )

    assert.deepEqual(repo.rosters.get("roster-1")?.reserveAttendances, [
        { userId: "user-1", ack: true, confirmed: true },
    ])
})

test("UpdateRosterAttendanceUseCase updates squad player attendance", async () => {
    const repo = new InMemoryRosterCommandRepository(
        new Map([
            [
                "roster-1",
                {
                    id: "roster-1",
                    eventId: "event-1",
                    squads: [
                        {
                            name: "Able",
                            group: "INF",
                            order: 1,
                            color: "#fff",
                            players: [
                                { id: "user-1", ack: false, confirmed: false },
                            ],
                        },
                    ],
                    reservePlayerIds: [],
                    reserveAttendances: [],
                    notAttendingPlayerIds: [],
                    published: false,
                },
            ],
        ]),
        null,
        []
    )

    await new UpdateRosterAttendanceUseCase(repo).acknowledge(
        "event-1",
        "user-1"
    )

    assert.deepEqual(repo.rosters.get("roster-1")?.squads[0]?.players[0], {
        id: "user-1",
        ack: true,
        confirmed: false,
    })
})

test("UpdateRosterAttendanceUseCase rejects missing rosters", async () => {
    const repo = new InMemoryRosterCommandRepository(new Map(), null, [])

    await assert.rejects(
        () =>
            new UpdateRosterAttendanceUseCase(repo).setStatus(
                "event-1",
                "user-1",
                "confirmed"
            ),
        /Roster not found/
    )
})

test("DeclineRosterAttendanceUseCase writes the notice, roster and history once, in scope", async () => {
    const roster = {
        id: "roster-1",
        eventId: "event-1",
        squads: [
            {
                name: "Able",
                group: "inf",
                order: 1,
                color: "#000",
                players: [{ id: "user-1", ack: true, roleName: "Medic" }],
            },
        ],
        reservePlayerIds: [],
        reserveAttendances: [],
        notAttendingPlayerIds: [],
        published: true,
    }
    const event = {
        id: "event-1",
        guildId: "guild-1",
        name: "VLK vs ROG",
        kind: "match" as const,
        registrationEnd: "2026-10-10T17:30:00.000Z",
        meetingStart: "2026-10-11T17:30:00.000Z",
        gameStart: "2026-10-11T18:00:00.000Z",
        gameEnd: "2026-10-11T20:00:00.000Z",
        absenceNotices: [] as Array<{
            userId: string
            reason: string
            createdAt: string
        }>,
    }
    const writes: string[] = []
    const activities: unknown[] = []
    const rosters = {
        async getRosterByEventId() {
            return roster
        },
        async updateRoster(_id: string, next: typeof roster) {
            writes.push("roster")
            Object.assign(roster, next)
        },
    }
    const events = {
        async getById() {
            return event
        },
        async saveAbsenceNotices(
            _id: string,
            input: { absenceNotices: typeof event.absenceNotices }
        ) {
            writes.push("notices")
            event.absenceNotices = input.absenceNotices
        },
        async appendSignupActivity(input: unknown) {
            writes.push("activity")
            activities.push(input)
        },
    }
    const useCase = new DeclineRosterAttendanceUseCase(rosters, events, {
        now: () => new Date("2026-10-10T18:00:00.000Z"),
    })
    const input = {
        guildId: "guild-1",
        eventId: "event-1",
        userId: "user-1",
        reason: "Nemoc",
    }

    assert.deepEqual(await useCase.execute(input), { ok: true, changed: true })
    assert.deepEqual(writes, ["notices", "roster", "activity"])
    assert.equal(roster.squads[0]?.players[0]?.ack, false)
    assert.deepEqual(activities, [
        {
            guildId: "guild-1",
            eventId: "event-1",
            eventName: "VLK vs ROG",
            eventKind: "match",
            userId: "user-1",
            action: "declined",
            role: "Able · Medic",
            previousRole: null,
            occurredAt: "2026-10-10T18:00:00.000Z",
        },
    ])

    assert.deepEqual(await useCase.execute(input), {
        ok: true,
        changed: false,
    })
    assert.equal(writes.length, 3)
    await assert.rejects(
        useCase.execute({ ...input, guildId: "guild-2" }),
        /Attendance unavailable/
    )
    assert.equal(writes.length, 3)
})

test("UpsertRosterUseCase stores the published places and the version a publish replaced (D5-B04)", async () => {
    const squad = (players: Array<{ id: string; roleName?: string }>) => [
        {
            name: "F1",
            group: "Pěchota",
            order: 0,
            color: "#000",
            players: players.map((player) => ({ ...player, ack: false })),
        },
    ]
    const event = {
        guildId: "guild-1",
        registrationEnd: "2026-07-21T10:00:00.000Z",
        participants: [],
        updatedAt: "2026-07-20T10:00:00.000Z",
        createdAt: "2026-07-20T10:00:00.000Z",
    }
    const repo = new InMemoryRosterCommandRepository(new Map(), event, [])
    const useCase = new UpsertRosterUseCase(repo)
    const base = {
        eventId: "event-1",
        reservePlayerIds: [],
        reserveAttendances: [],
        notAttendingPlayerIds: [],
    }
    const id = await useCase.execute({
        ...base,
        squads: squad([{ id: "user-1", roleName: "Medic" }]),
        published: true,
    })
    const first = repo.rosters.get(id)
    assert.deepEqual(first.publishedPlaces, [
        { userId: "user-1", squad: "F1", role: "Medic" },
    ])
    assert.equal(first.previousPublishedPlaces, undefined)

    await useCase.execute({
        ...base,
        rosterId: id,
        squads: squad([{ id: "user-1" }, { id: "user-2" }]),
        published: true,
    })
    const second = repo.rosters.get(id)
    assert.deepEqual(second.previousPublishedPlaces, [
        { userId: "user-1", squad: "F1", role: "Medic" },
    ])
    assert.deepEqual(second.publishedPlaces, [
        { userId: "user-1", squad: "F1" },
        { userId: "user-2", squad: "F1" },
    ])

    // A draft save writes no snapshot fields (a patch keeps the stored ones).
    await useCase.execute({
        ...base,
        rosterId: id,
        squads: squad([]),
        published: false,
    })
    const draft = repo.rosters.get(id)
    assert.ok(!("publishedPlaces" in draft))
    assert.ok(!("previousPublishedPlaces" in draft))
})
