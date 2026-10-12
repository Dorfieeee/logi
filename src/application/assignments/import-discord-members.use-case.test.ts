import assert from "node:assert/strict"
import test from "node:test"

import {
    InMemoryAssignmentCommandRepository,
    RecordingAssignmentRosterSyncPort,
} from "@/infrastructure/testing/in-memory-assignment-command"
import { FakeClock } from "@/infrastructure/testing/fake-clock"

import { ImportDiscordMembersUseCase } from "./import-discord-members.use-case"

test("ImportDiscordMembersUseCase upserts users and assignments then rebuilds membership", async () => {
    const repository = new InMemoryAssignmentCommandRepository(
        new Map(),
        new Set(["guild-1"]),
        new Set(),
        new Map([["guild-1", new Map([["group-1", "Infantry"]])]]),
        new Map([["guild-1", ["event-1"]]])
    )
    const sync = new RecordingAssignmentRosterSyncPort()
    const useCase = new ImportDiscordMembersUseCase(
        repository,
        sync,
        new FakeClock(new Date("2026-07-22T12:00:00.000Z"))
    )

    const result = await useCase.execute({
        serverDiscordId: "guild-1",
        gameId: "hell_let_loose",
        assignmentType: "member",
        status: "active",
        members: [
            {
                userId: "user-1",
                name: "Player One",
                avatar: "",
                secondaryGroupIds: ["group-1"],
            },
        ],
    })

    assert.deepEqual(result, {
        importedCount: 1,
        createdUsers: 1,
        updatedUsers: 0,
        createdAssignments: 1,
        updatedAssignments: 0,
    })
    assert.equal(repository.assignments.size, 1)
    assert.equal(repository.serverMembershipPatches.length, 1)
    assert.equal(repository.userMembershipPatches.length, 1)
    assert.deepEqual(sync.eventIds, ["event-1"])
})

test("ImportDiscordMembersUseCase keeps a Wardogs role import out of Hell Let Loose", async () => {
    const repository = new InMemoryAssignmentCommandRepository(
        new Map(),
        new Set(["guild-1"]),
        new Set(),
        new Map([["guild-1", new Map()]]),
        new Map()
    )
    const useCase = new ImportDiscordMembersUseCase(
        repository,
        new RecordingAssignmentRosterSyncPort(),
        new FakeClock(new Date("2026-10-12T12:00:00.000Z"))
    )

    await useCase.execute({
        serverDiscordId: "guild-1",
        gameId: "wardogs",
        assignmentType: "member",
        status: "active",
        members: [
            {
                userId: "user-wardogs",
                name: "Wardogs Player",
                avatar: "",
                secondaryGroupIds: [],
            },
        ],
    })

    assert.deepEqual(
        [...repository.assignments.values()].map(
            (assignment) => assignment.gameId
        ),
        ["wardogs"]
    )
    assert.equal(
        await repository.getByServerUser(
            "guild-1",
            "user-wardogs",
            "hell_let_loose"
        ),
        null
    )
})

test("ImportDiscordMembersUseCase rejects unknown servers", async () => {
    const repository = new InMemoryAssignmentCommandRepository(
        new Map(),
        new Set(),
        new Set(),
        new Map(),
        new Map()
    )
    const useCase = new ImportDiscordMembersUseCase(
        repository,
        new RecordingAssignmentRosterSyncPort(),
        new FakeClock(new Date("2026-07-22T12:00:00.000Z"))
    )

    await assert.rejects(
        () =>
            useCase.execute({
                serverDiscordId: "guild-404",
                gameId: "hell_let_loose",
                assignmentType: "member",
                status: "active",
                members: [],
            }),
        /Server not found/
    )
})

test("ImportDiscordMembersUseCase updates existing assignments and preserves primary group", async () => {
    const repository = new InMemoryAssignmentCommandRepository(
        new Map([
            [
                "assignment-1",
                {
                    id: "assignment-1",
                    userId: "user-1",
                    serverId: "guild-1",
                    type: "member",
                    status: "active",
                    membershipCategoryId: "cat-1",
                    primaryGroupId: "group-1",
                    secondaryGroupIds: ["group-2"],
                    paused: true,
                    pausedNote: "manual pause",
                    createdAt: "2026-07-20T12:00:00.000Z",
                    updatedAt: "2026-07-20T12:00:00.000Z",
                },
            ],
        ]),
        new Set(["guild-1"]),
        new Set(["user-1"]),
        new Map([
            [
                "guild-1",
                new Map([
                    ["group-1", "Infantry"],
                    ["group-2", "Armor"],
                    ["group-3", "Recon"],
                ]),
            ],
        ]),
        new Map()
    )
    const useCase = new ImportDiscordMembersUseCase(
        repository,
        new RecordingAssignmentRosterSyncPort(),
        new FakeClock(new Date("2026-07-22T12:00:00.000Z"))
    )

    const result = await useCase.execute({
        serverDiscordId: "guild-1",
        gameId: "hell_let_loose",
        assignmentType: "mercenary",
        status: "active",
        members: [
            {
                userId: "user-1",
                name: "Player One",
                avatar: "",
                secondaryGroupIds: ["group-1", "group-3"],
            },
        ],
    })

    assert.deepEqual(result, {
        importedCount: 1,
        createdUsers: 1,
        updatedUsers: 0,
        createdAssignments: 0,
        updatedAssignments: 1,
    })
    const assignment = repository.assignments.get("assignment-1")
    assert.equal(assignment?.primaryGroupId, "group-1")
    assert.equal(assignment?.type, "mercenary")
    assert.deepEqual(assignment?.secondaryGroupIds, ["group-2", "group-3"])
    assert.equal(assignment?.paused, true)
})
