import { matchesGameScope, resolveGameScope, type GameId } from "../games/game"
import { isSignupMembershipAllowed } from "../events/signup-policy"
import { setRosterAttendanceStatus } from "./attendance-policy"
import type { SignupMembershipStatus } from "../events/types"
import { signupListMembership } from "../events/signup-list"
import type { RosterLike } from "./types"

/** Active clan members belonging to the match's game, counted once per player. */
export function matchAttendanceMemberIds(
    assignments: readonly {
        userId: string
        gameId?: GameId
        paused?: boolean
        type?: "member" | "reserve_member" | "mercenary"
        status?: "pending" | "recruit" | "active"
    }[],
    gameId?: GameId,
    allowedSignupStatuses?: SignupMembershipStatus[],
    localPlayerIds?: readonly string[]
) {
    return [
        ...new Set(
            assignments
                .filter(
                    (assignment) =>
                        !assignment.paused &&
                        (!localPlayerIds ||
                            localPlayerIds.includes(assignment.userId)) &&
                        (!assignment.type ||
                            !assignment.status ||
                            isSignupMembershipAllowed({
                                event: { allowedSignupStatuses },
                                membershipStatus:
                                    signupListMembership(assignment),
                            })) &&
                        matchesGameScope(
                            assignment.gameId,
                            resolveGameScope(gameId)
                        )
                )
                .map((assignment) => assignment.userId)
        ),
    ]
}

/** Attendance of one player as an admin records it after the match. */
export type AttendanceMark = "present" | "excused" | "absent"

/** What the player told the clan before the match. */
export type AttendanceBefore =
    | { kind: "notice"; reason: string }
    | { kind: "reserve" }
    | { kind: "acknowledged" }
    | { kind: "pending" }

export type MatchAttendanceEntry = {
    userId: string
    placement:
        | { kind: "slot"; squadName: string; roleName?: string }
        | { kind: "reserve" }
    before: AttendanceBefore
    mark: AttendanceMark
    /** The player said in Discord they would be late; they stay excused. */
    hasNotice: boolean
    /** A clan admin excused the player after the match. */
    adminExcused: boolean
}

export type MatchAttendance = {
    entries: MatchAttendanceEntry[]
    unplacedUserIds: string[]
    declinedUserIds: string[]
    noResponseUserIds: string[]
    counts: {
        roster: Record<AttendanceMark, number> & { total: number }
        reserves: Record<AttendanceMark, number> & { total: number }
        declined: number
        noResponse: number
    }
}

function emptyCounts() {
    return { present: 0, excused: 0, absent: 0, total: 0 }
}

/**
 * The attendance list of a match: roster players in squad order, then the
 * reserves, each with the mark that decides their points (present when
 * confirmed, excused with an absence notice, absent otherwise), plus the
 * members who declined and the scored members who never answered.
 */
export function buildMatchAttendance(input: {
    roster: Pick<
        RosterLike,
        | "squads"
        | "reservePlayerIds"
        | "reserveAttendances"
        | "notAttendingPlayerIds"
    > | null
    participants: Array<{
        userId: string
        status: "attending" | "not_attending"
    }>
    notices: Array<{ userId: string; reason: string; excusedBy?: string }>
    /** Active clan members belonging to this match's game. */
    memberIds: readonly string[]
}): MatchAttendance {
    // A player's own late notice; an admin's excuse has no reason to show.
    const noticeByUserId = new Map(
        input.notices
            .filter((notice) => !notice.excusedBy)
            .map((notice) => [notice.userId, notice.reason])
    )
    const excusedByAdmin = new Set(
        input.notices
            .filter((notice) => notice.excusedBy)
            .map((notice) => notice.userId)
    )
    const entries: MatchAttendanceEntry[] = []
    const seen = new Set<string>()
    const counts = {
        roster: emptyCounts(),
        reserves: emptyCounts(),
        declined: 0,
        noResponse: 0,
    }

    function markFor(userId: string, confirmed: boolean | undefined) {
        return confirmed
            ? "present"
            : noticeByUserId.has(userId) || excusedByAdmin.has(userId)
              ? "excused"
              : "absent"
    }

    const squads = [...(input.roster?.squads ?? [])].sort(
        (left, right) => left.order - right.order
    )
    for (const squad of squads) {
        for (const player of squad.players) {
            if (!player.id || seen.has(player.id)) continue
            seen.add(player.id)
            const reason = noticeByUserId.get(player.id)
            const mark = markFor(player.id, player.confirmed)
            counts.roster[mark] += 1
            counts.roster.total += 1
            entries.push({
                userId: player.id,
                placement: {
                    kind: "slot",
                    squadName: squad.name,
                    roleName: player.roleName,
                },
                before:
                    reason !== undefined
                        ? { kind: "notice", reason }
                        : player.ack
                          ? { kind: "acknowledged" }
                          : { kind: "pending" },
                mark,
                hasNotice: reason !== undefined,
                adminExcused: excusedByAdmin.has(player.id),
            })
        }
    }

    const reserveAttendance = new Map(
        (input.roster?.reserveAttendances ?? []).map((attendance) => [
            attendance.userId,
            attendance,
        ])
    )
    for (const userId of input.roster?.reservePlayerIds ?? []) {
        if (seen.has(userId)) continue
        seen.add(userId)
        const reason = noticeByUserId.get(userId)
        const mark = markFor(userId, reserveAttendance.get(userId)?.confirmed)
        counts.reserves[mark] += 1
        counts.reserves.total += 1
        entries.push({
            userId,
            placement: { kind: "reserve" },
            before:
                reason !== undefined
                    ? { kind: "notice", reason }
                    : { kind: "reserve" },
            mark,
            hasNotice: reason !== undefined,
            adminExcused: excusedByAdmin.has(userId),
        })
    }

    const unplacedUserIds = [
        ...new Set(
            input.participants
                .filter(
                    (participant) =>
                        participant.status === "attending" &&
                        !seen.has(participant.userId)
                )
                .map((participant) => participant.userId)
        ),
    ]
    const declinedUserIds = [
        ...new Set(
            input.participants
                .filter((participant) => participant.status === "not_attending")
                .map((participant) => participant.userId)
        ),
    ].filter((userId) => !seen.has(userId) && !unplacedUserIds.includes(userId))
    const answered = new Set([
        ...seen,
        ...declinedUserIds,
        ...input.participants.map((participant) => participant.userId),
    ])
    const noResponseUserIds = [...new Set(input.memberIds)].filter(
        (userId) => !answered.has(userId)
    )
    counts.declined = declinedUserIds.length
    counts.noResponse = noResponseUserIds.length

    return {
        entries,
        unplacedUserIds,
        declinedUserIds,
        noResponseUserIds,
        counts,
    }
}

/**
 * Records whether a roster player or reserve came. Absence keeps an earlier
 * acknowledgement, so the player's own answer is not lost.
 */
export function setRosterPresence<T extends RosterLike>(
    roster: T,
    userId: string,
    present: boolean
): T {
    const acknowledged =
        roster.squads.some((squad) =>
            squad.players.some((player) => player.id === userId && player.ack)
        ) ||
        (roster.reserveAttendances ?? []).some(
            (attendance) => attendance.userId === userId && attendance.ack
        )
    return setRosterAttendanceStatus(
        roster,
        userId,
        present ? "confirmed" : acknowledged ? "acknowledged" : "pending"
    )
}

/**
 * What saving the attendance table changes: who is marked present on the
 * roster, and whom an admin excuses or stops excusing. Excused counts like an
 * absence notice when the match closes (`excusedAbsence`). A player's own
 * late notice cannot be turned into an absence, so that choice is ignored.
 */
export function planAttendanceChanges(input: {
    entries: readonly MatchAttendanceEntry[]
    marks: ReadonlyMap<string, AttendanceMark>
}): { presence: Map<string, boolean>; excuses: Map<string, boolean> } {
    const presence = new Map<string, boolean>()
    const excuses = new Map<string, boolean>()
    for (const entry of input.entries) {
        const mark = input.marks.get(entry.userId)
        if (!mark || mark === entry.mark) continue
        if (mark === "absent" && entry.hasNotice) continue
        const present = mark === "present"
        if (present !== (entry.mark === "present"))
            presence.set(entry.userId, present)
        const excused = mark === "excused" && !entry.hasNotice
        if (excused && !entry.adminExcused) excuses.set(entry.userId, true)
        if (!excused && entry.adminExcused) excuses.set(entry.userId, false)
    }
    return { presence, excuses }
}

export type AttendanceNotice = {
    userId: string
    reason: string
    createdAt: string
    excusedBy?: string
}

/**
 * Applies admin excuses to a match's notices: an excuse is a notice without
 * a reason that names the admin; lifting it removes only such a notice, never
 * the player's own late notice.
 */
export function applyAttendanceExcuses<T extends AttendanceNotice>(input: {
    notices: readonly T[]
    excuses: ReadonlyMap<string, boolean>
    actorId: string
    now: string
}): AttendanceNotice[] {
    const notices: AttendanceNotice[] = input.notices.filter(
        (notice) =>
            !(notice.excusedBy && input.excuses.get(notice.userId) === false)
    )
    for (const [userId, excused] of input.excuses) {
        if (!excused || notices.some((notice) => notice.userId === userId))
            continue
        notices.push({
            userId,
            reason: "",
            createdAt: input.now,
            excusedBy: input.actorId,
        })
    }
    return notices
}

/** Response comes from the event, never from an inferred roster bucket. */
export type MatchResponse = "attending" | "declined" | "noResponse"

export function buildMatchResponseRows(input: {
    attendance: MatchAttendance
    participants: readonly {
        userId: string
        status: "attending" | "not_attending"
    }[]
    memberIds: readonly string[]
}): Array<{
    userId: string
    response: MatchResponse
    entry?: MatchAttendanceEntry
}> {
    const participants = new Map(
        input.participants.map((participant) => [
            participant.userId,
            participant.status,
        ])
    )
    const entries = new Map(
        input.attendance.entries.map((entry) => [entry.userId, entry])
    )
    const userIds = new Set([
        ...input.memberIds,
        ...participants.keys(),
        ...entries.keys(),
    ])
    return [...userIds].map((userId) => ({
        userId,
        response:
            participants.get(userId) === "attending"
                ? "attending"
                : participants.get(userId) === "not_attending"
                  ? "declined"
                  : "noResponse",
        entry: entries.get(userId),
    }))
}
