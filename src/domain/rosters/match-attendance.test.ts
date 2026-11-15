import assert from "node:assert/strict"
import test from "node:test"

import {
    applyAttendanceExcuses,
    buildMatchAttendance,
    buildMatchResponseRows,
    matchAttendanceMemberIds,
    planAttendanceChanges,
    setRosterPresence,
} from "./match-attendance"
import type { RosterLike } from "./types"

test("unanswered attendance counts only active members of the match game", () => {
    const assignments = [
        { userId: "legacy" },
        { userId: "hll", gameId: "hell_let_loose" },
        { userId: "hll", gameId: "hell_let_loose" },
        { userId: "other", gameId: "wardogs" },
        { userId: "paused", gameId: "hell_let_loose", paused: true },
    ]
    const attendance = buildMatchAttendance({
        roster: null,
        participants: [{ userId: "hll", status: "attending" }],
        notices: [],
        memberIds: matchAttendanceMemberIds(assignments),
    })
    assert.deepEqual(attendance.noResponseUserIds, ["legacy"])
    assert.equal(attendance.counts.noResponse, 1)
    assert.deepEqual(matchAttendanceMemberIds(assignments, "wardogs"), [
        "other",
    ])
    assert.deepEqual(matchAttendanceMemberIds(assignments, "empty"), [])
})

const roster: RosterLike = {
    squads: [
        {
            name: "Able",
            group: "Infantry",
            order: 1,
            color: "#000",
            players: [
                { id: "sl", ack: true, confirmed: true, roleName: "SL" },
                { id: "at", ack: false, confirmed: false, roleName: "AT" },
                { ack: false, customName: "Guest" },
            ],
        },
        {
            name: "Command",
            group: "Command",
            order: 0,
            color: "#000",
            players: [{ id: "cmd", ack: true, confirmed: false }],
        },
    ],
    reservePlayerIds: ["res1", "res2"],
    reserveAttendances: [{ userId: "res1", ack: true, confirmed: true }],
    notAttendingPlayerIds: [],
    published: true,
}

test("lists roster players in squad order, then reserves, with their marks", () => {
    const attendance = buildMatchAttendance({
        roster,
        participants: [
            { userId: "sl", status: "attending" },
            { userId: "cmd", status: "attending" },
            { userId: "at", status: "attending" },
            { userId: "res1", status: "attending" },
            { userId: "res2", status: "attending" },
            { userId: "no", status: "not_attending" },
        ],
        notices: [{ userId: "cmd", reason: "Late, 20:20" }],
        memberIds: ["sl", "cmd", "at", "res1", "res2", "no", "quiet"],
    })

    assert.deepEqual(
        attendance.entries.map((entry) => [entry.userId, entry.mark]),
        [
            ["cmd", "excused"],
            ["sl", "present"],
            ["at", "absent"],
            ["res1", "present"],
            ["res2", "absent"],
        ]
    )
    assert.deepEqual(attendance.entries[0]?.before, {
        kind: "notice",
        reason: "Late, 20:20",
    })
    assert.deepEqual(attendance.entries[1]?.placement, {
        kind: "slot",
        squadName: "Able",
        roleName: "SL",
    })
    assert.deepEqual(attendance.entries[2]?.before, { kind: "pending" })
    assert.deepEqual(attendance.entries[4]?.before, { kind: "reserve" })
    assert.deepEqual(attendance.declinedUserIds, ["no"])
    assert.deepEqual(attendance.noResponseUserIds, ["quiet"])
    assert.deepEqual(attendance.counts, {
        roster: { present: 1, excused: 1, absent: 1, total: 3 },
        reserves: { present: 1, excused: 0, absent: 1, total: 2 },
        declined: 1,
        noResponse: 1,
    })
})

test("works without a roster", () => {
    const attendance = buildMatchAttendance({
        roster: null,
        participants: [{ userId: "a", status: "attending" }],
        notices: [],
        memberIds: ["a", "b", "b"],
    })
    assert.deepEqual(attendance.entries, [])
    assert.deepEqual(attendance.noResponseUserIds, ["b"])
})

test("an admin excuse makes a player excused without a late notice to show", () => {
    const attendance = buildMatchAttendance({
        roster,
        participants: [{ userId: "at", status: "attending" }],
        notices: [
            { userId: "at", reason: "", excusedBy: "admin-1" },
            { userId: "cmd", reason: "Late, 20:20" },
        ],
        memberIds: [],
    })
    const at = attendance.entries.find((entry) => entry.userId === "at")
    assert.equal(at?.mark, "excused")
    assert.equal(at?.adminExcused, true)
    assert.equal(at?.hasNotice, false)
    assert.deepEqual(at?.before, { kind: "pending" })
    const cmd = attendance.entries.find((entry) => entry.userId === "cmd")
    assert.equal(cmd?.hasNotice, true)
    assert.equal(cmd?.adminExcused, false)
})

test("planAttendanceChanges splits marks into presence and admin excuses", () => {
    const { entries } = buildMatchAttendance({
        roster,
        participants: [],
        notices: [
            { userId: "cmd", reason: "Late" },
            { userId: "res2", reason: "", excusedBy: "admin-1" },
        ],
        memberIds: [],
    })
    const plan = planAttendanceChanges({
        entries,
        marks: new Map([
            ["at", "excused"],
            ["sl", "absent"],
            ["cmd", "absent"],
            ["res2", "present"],
            ["res1", "present"],
        ] as const),
    })
    assert.deepEqual(
        [...plan.presence],
        [
            ["sl", false],
            ["res2", true],
        ]
    )
    assert.deepEqual(
        [...plan.excuses],
        [
            ["at", true],
            ["res2", false],
        ]
    )
})

test("applyAttendanceExcuses adds and lifts only admin excuses", () => {
    const notices = applyAttendanceExcuses({
        notices: [
            { userId: "cmd", reason: "Late", createdAt: "t0" },
            { userId: "res2", reason: "", createdAt: "t0", excusedBy: "a" },
        ],
        excuses: new Map([
            ["at", true],
            ["res2", false],
            ["cmd", false],
            ["sl", false],
        ]),
        actorId: "admin-2",
        now: "t1",
    })
    assert.deepEqual(notices, [
        { userId: "cmd", reason: "Late", createdAt: "t0" },
        { userId: "at", reason: "", createdAt: "t1", excusedBy: "admin-2" },
    ])
})

test("setRosterPresence confirms and clears presence, keeping acknowledgements", () => {
    const absent = setRosterPresence(roster, "sl", false)
    assert.deepEqual(absent.squads[0]?.players[0], {
        id: "sl",
        ack: true,
        confirmed: false,
        roleName: "SL",
    })
    const present = setRosterPresence(roster, "at", true)
    assert.equal(present.squads[0]?.players[1]?.confirmed, true)
    const reserve = setRosterPresence(roster, "res2", true)
    assert.deepEqual(reserve.reserveAttendances?.at(-1), {
        userId: "res2",
        ack: true,
        confirmed: true,
    })
    assert.throws(() => setRosterPresence(roster, "stranger", true))
})

test("attendance includes unplaced signups and excludes ineligible memberships", () => {
    const assignments = [
        {
            userId: "member",
            type: "member" as const,
            status: "active" as const,
        },
        {
            userId: "recruit",
            type: "member" as const,
            status: "recruit" as const,
        },
        {
            userId: "reserve",
            type: "reserve_member" as const,
            status: "active" as const,
        },
        {
            userId: "merc",
            type: "mercenary" as const,
            status: "active" as const,
        },
        {
            userId: "pending",
            type: "member" as const,
            status: "pending" as const,
        },
        {
            userId: "other",
            gameId: "wardogs",
            type: "member" as const,
            status: "active" as const,
        },
    ]
    const eligible = matchAttendanceMemberIds(assignments, "hell_let_loose", [
        "member",
        "recruit",
        "reserve_member",
    ])
    const result = buildMatchAttendance({
        roster: null,
        participants: [
            { userId: "member", status: "attending" },
            { userId: "guest", status: "attending" },
        ],
        notices: [],
        memberIds: eligible,
    })
    assert.deepEqual(result.unplacedUserIds, ["member", "guest"])
    assert.deepEqual(result.noResponseUserIds, ["recruit", "reserve"])
    assert.deepEqual(
        matchAttendanceMemberIds(assignments, "hell_let_loose", undefined, [
            "merc",
        ]),
        ["merc"]
    )
})

test("inferred not-attending buckets do not count as explicit declines", () => {
    const attendance = buildMatchAttendance({
        roster: { ...roster, notAttendingPlayerIds: ["quiet", "no", "paused"] },
        participants: [{ userId: "no", status: "not_attending" }],
        notices: [],
        memberIds: ["quiet", "no"],
    })
    assert.deepEqual(attendance.declinedUserIds, ["no"])
    assert.deepEqual(attendance.noResponseUserIds, ["quiet"])
    assert.equal(attendance.counts.declined, 1)
})

test("unified responses include unplaced signups and keep response separate from placement", () => {
    const participants = [
        { userId: "unplaced", status: "attending" as const },
        { userId: "no", status: "not_attending" as const },
        { userId: "sl", status: "not_attending" as const },
    ]
    const attendance = buildMatchAttendance({
        roster,
        participants,
        notices: [],
        memberIds: ["quiet", "quiet", "no"],
    })
    const rows = buildMatchResponseRows({
        attendance,
        participants,
        memberIds: ["quiet", "quiet", "no"],
    })
    assert.equal(rows.length, 8)
    assert.equal(
        rows.find((row) => row.userId === "quiet")?.response,
        "noResponse"
    )
    assert.equal(
        rows.find((row) => row.userId === "unplaced")?.response,
        "attending"
    )
    assert.equal(
        rows.find((row) => row.userId === "unplaced")?.entry,
        undefined
    )
    assert.equal(rows.find((row) => row.userId === "sl")?.response, "declined")
    assert.equal(
        rows.find((row) => row.userId === "sl")?.entry?.mark,
        "present"
    )
    assert.equal(
        rows.find((row) => row.userId === "cmd")?.response,
        "noResponse"
    )
})
