import type { ServerUserAssignment } from "@/lib/server-user-management"
import { optimalAssignment } from "@/domain/rosters/optimal-assignment"
import type { AppUser, Group, Roster } from "@/types/domain"
import { getUserScoreForGuild } from "@/lib/user-scores"

type ParticipantStatus = "attending" | "not_attending"

type RosterPreferenceKey =
    "command" | "infantry" | "armor" | "recon" | "artillery" | "other"

type SlotContext = {
    squadGroup?: string
    roleName?: string
    roleIcon?: string
}

type RosterSlot = SlotContext & {
    squadIndex: number
    playerIndex: number
}

type CandidateRankingContext = {
    usersById: Map<string, AppUser>
    assignmentsByUserId: Map<string, ServerUserAssignment>
    groupsById: Map<string, Group>
    signupPreferencesByUserId?: Map<string, string[]>
    signupGroupByUserId: Map<string, string | null>
    participantStatusByUserId: Map<string, ParticipantStatus>
    serverDiscordId: string
}

const SIGNUP_NOT_ATTENDING = "not_attending"

const LOCALIZED_ROSTER_GROUPS: Readonly<Record<string, RosterPreferenceKey>> = {
    pěchota: "infantry",
    piechota: "infantry",
    infanterie: "infantry",
    tanky: "armor",
    panzer: "armor",
    "wojska pancerne": "armor",
    průzkum: "recon",
    aufklärung: "recon",
    zwiad: "recon",
    dělostřelectvo: "artillery",
    artillerie: "artillery",
    artyleria: "artillery",
    velení: "command",
    führung: "command",
    dowodzenie: "command",
}

function normalizeText(value?: string | null) {
    return value?.trim().toLowerCase() ?? ""
}

export function getRosterPreferenceKey(
    value?: string | null
): RosterPreferenceKey {
    const normalized = normalizeText(value)
    const localized = LOCALIZED_ROSTER_GROUPS[normalized]
    if (localized) return localized

    if (!normalized) {
        return "other"
    }

    if (normalized.includes("artillery")) {
        return "artillery"
    }

    if (
        normalized.includes("recon") ||
        normalized.includes("sniper") ||
        normalized.includes("spotter")
    ) {
        return "recon"
    }

    if (
        normalized.includes("armor") ||
        normalized.includes("tank") ||
        normalized.includes("gunner") ||
        normalized.includes("driver") ||
        normalized.includes("crew")
    ) {
        return "armor"
    }

    if (
        normalized.includes("command") ||
        normalized.includes("commander") ||
        normalized.includes("officer")
    ) {
        return "command"
    }

    if (
        normalized.includes("infantry") ||
        normalized.includes("rifle") ||
        normalized.includes("assault") ||
        normalized.includes("support") ||
        normalized.includes("medic") ||
        normalized.includes("engineer") ||
        normalized.includes("anti-tank") ||
        normalized.includes("machine gun") ||
        normalized.includes("autorifle")
    ) {
        return "infantry"
    }

    return "other"
}

export function formatRosterPreferenceLabel(value?: string | null) {
    const normalized = normalizeText(value)
    if (!normalized || normalized === SIGNUP_NOT_ATTENDING) {
        return null
    }

    return normalized
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase())
}

export function getSignupGroupByUserId(event?: {
    participants?: Array<{
        userId: string
        status: ParticipantStatus
        group?: string | null
    }>
    signUps?: Array<{ userId: string; group?: string | null }>
}) {
    const result = new Map<string, string | null>()

    for (const participant of event?.participants ?? []) {
        if (participant.status === "not_attending") {
            result.set(participant.userId, SIGNUP_NOT_ATTENDING)
            continue
        }

        result.set(participant.userId, participant.group ?? null)
    }

    for (const signUp of event?.signUps ?? []) {
        if (result.has(signUp.userId)) {
            continue
        }

        result.set(signUp.userId, signUp.group ?? null)
    }

    return result
}

export function getUserSignupLabel(
    userId: string,
    signupGroupByUserId: Map<string, string | null>
) {
    return formatRosterPreferenceLabel(signupGroupByUserId.get(userId))
}

export function getSlotPreferenceKey(slot: SlotContext): RosterPreferenceKey {
    const rolePreference = getRosterPreferenceKey(
        slot.roleName ?? slot.roleIcon
    )
    if (rolePreference !== "other") {
        if (
            rolePreference === "command" &&
            getRosterPreferenceKey(slot.squadGroup) === "infantry"
        ) {
            return "infantry"
        }

        return rolePreference
    }

    return getRosterPreferenceKey(slot.squadGroup)
}

function getSignupMatchRank(
    userId: string,
    slot: SlotContext | undefined,
    signupGroupByUserId: Map<string, string | null>
) {
    if (!slot) {
        return 1
    }

    const signupPreference = getRosterPreferenceKey(
        signupGroupByUserId.get(userId)
    )
    const slotPreference = getSlotPreferenceKey(slot)

    if (signupPreference === "other") {
        return 1
    }

    return signupPreference === slotPreference ? 0 : 2
}

function getGroupMatchRank(
    userId: string,
    squadGroup: string | undefined,
    assignmentsByUserId: Map<string, ServerUserAssignment>,
    groupsById: Map<string, Group>
) {
    if (!squadGroup) {
        return 2
    }

    const assignment = assignmentsByUserId.get(userId)
    if (!assignment) {
        return 2
    }

    const primaryGroup = assignment.primaryGroupId
        ? groupsById.get(assignment.primaryGroupId)?.name
        : undefined
    if (primaryGroup === squadGroup) {
        return 0
    }

    const hasSecondaryMatch = assignment.secondaryGroupIds.some(
        (groupId) => groupsById.get(groupId)?.name === squadGroup
    )
    if (hasSecondaryMatch) {
        return 1
    }

    return 2
}

function getAttendanceRank(
    userId: string,
    participantStatusByUserId: Map<string, ParticipantStatus>,
    signupGroupByUserId: Map<string, string | null>
) {
    const participantStatus = participantStatusByUserId.get(userId)
    const signupGroup = signupGroupByUserId.get(userId)

    if (
        participantStatus === "not_attending" ||
        normalizeText(signupGroup) === SIGNUP_NOT_ATTENDING
    ) {
        return 1
    }

    return 0
}

function getKd(user: AppUser) {
    return user.performance?.averages.killDeathRatio ?? -1
}

function getScore(user: AppUser, serverDiscordId: string) {
    return getUserScoreForGuild(user, serverDiscordId)
}

export function compareRosterCandidates(
    leftUserId: string,
    rightUserId: string,
    context: CandidateRankingContext,
    slot?: SlotContext,
    options?: {
        sort?: "role" | "score" | "kd"
        gameId?: string
        assignedElsewhereUserIds?: Set<string>
    }
) {
    const leftUser = context.usersById.get(leftUserId)
    const rightUser = context.usersById.get(rightUserId)

    if (!leftUser || !rightUser) {
        return leftUser ? -1 : rightUser ? 1 : 0
    }

    const assignedElsewhereUserIds = options?.assignedElsewhereUserIds
    if (assignedElsewhereUserIds) {
        const leftAssignedElsewhere = assignedElsewhereUserIds.has(leftUserId)
            ? 1
            : 0
        const rightAssignedElsewhere = assignedElsewhereUserIds.has(rightUserId)
            ? 1
            : 0
        if (leftAssignedElsewhere !== rightAssignedElsewhere) {
            return leftAssignedElsewhere - rightAssignedElsewhere
        }
    }

    const leftAttendanceRank = getAttendanceRank(
        leftUserId,
        context.participantStatusByUserId,
        context.signupGroupByUserId
    )
    const rightAttendanceRank = getAttendanceRank(
        rightUserId,
        context.participantStatusByUserId,
        context.signupGroupByUserId
    )
    if (leftAttendanceRank !== rightAttendanceRank) {
        return leftAttendanceRank - rightAttendanceRank
    }

    if (options?.sort === "score" || options?.sort === "kd") {
        const metric = (user: AppUser) =>
            options.sort === "kd"
                ? getKd(user)
                : getUserScoreForGuild(
                      user,
                      context.serverDiscordId,
                      options.gameId
                  )
        return (
            metric(rightUser) - metric(leftUser) ||
            leftUser.name.localeCompare(rightUser.name)
        )
    }

    const leftSignupRank = getSignupMatchRank(
        leftUserId,
        slot,
        context.signupGroupByUserId
    )
    const rightSignupRank = getSignupMatchRank(
        rightUserId,
        slot,
        context.signupGroupByUserId
    )
    if (leftSignupRank !== rightSignupRank) {
        return leftSignupRank - rightSignupRank
    }

    const leftGroupRank = getGroupMatchRank(
        leftUserId,
        slot?.squadGroup,
        context.assignmentsByUserId,
        context.groupsById
    )
    const rightGroupRank = getGroupMatchRank(
        rightUserId,
        slot?.squadGroup,
        context.assignmentsByUserId,
        context.groupsById
    )
    if (leftGroupRank !== rightGroupRank) {
        return leftGroupRank - rightGroupRank
    }

    const leftScore = getUserScoreForGuild(
        leftUser,
        context.serverDiscordId,
        options?.gameId
    )
    const rightScore = getUserScoreForGuild(
        rightUser,
        context.serverDiscordId,
        options?.gameId
    )
    if (leftScore !== rightScore) {
        return rightScore - leftScore
    }

    const leftKd = getKd(leftUser)
    const rightKd = getKd(rightUser)
    if (leftKd !== rightKd) {
        return rightKd - leftKd
    }

    return leftUser.name.localeCompare(rightUser.name)
}

function singleSignupPreference(group?: string | null): string[] {
    return group &&
        !["attending", "attend", "general", "not_attending"].includes(
            normalizeText(group)
        )
        ? [group]
        : []
}

/** Ordered signup choices also retain a capped group's requested preference. */
export function getSignupPreferencesByUserId(event?: {
    participants?: Array<{
        userId: string
        status: ParticipantStatus
        group?: string | null
        requestedGroup?: string | null
        signupPreferences?: string[]
    }>
    signUps?: Array<{
        userId: string
        group?: string | null
        signupPreferences?: string[]
    }>
}) {
    const result = new Map<string, string[]>()
    for (const person of event?.participants ?? []) {
        result.set(
            person.userId,
            person.status === "not_attending"
                ? []
                : person.signupPreferences?.length
                  ? person.signupPreferences
                  : singleSignupPreference(
                        person.requestedGroup ?? person.group
                    )
        )
    }
    for (const person of event?.signUps ?? [])
        if (!result.has(person.userId))
            result.set(
                person.userId,
                person.signupPreferences ?? singleSignupPreference(person.group)
            )
    return result
}

export function autoFillRosterAssignments(
    board: Roster,
    context: CandidateRankingContext,
    random: () => number = Math.random
) {
    const next = structuredClone(board)
    const alreadyAssigned = new Set(
        next.squads.flatMap((squad) =>
            squad.players.flatMap((player) => (player.id ? [player.id] : []))
        )
    )
    const availableUserIds = Array.from(
        new Set(next.reservePlayerIds ?? [])
    ).filter(
        (id) =>
            !alreadyAssigned.has(id) &&
            context.usersById.has(id) &&
            getAttendanceRank(
                id,
                context.participantStatusByUserId,
                context.signupGroupByUserId
            ) === 0
    )
    const emptySlots: RosterSlot[] = []
    next.squads.forEach((squad, squadIndex) =>
        squad.players.forEach((player, playerIndex) => {
            if (!player.id && !getCustomNameFromSlot(player.customName))
                emptySlots.push({
                    squadIndex,
                    playerIndex,
                    squadGroup: squad.group,
                    roleName: player.roleName,
                    roleIcon: player.roleIcon,
                })
        })
    )
    const choices: Array<{ player: number; slot: number; rank: number }> = []
    const catalogueGroupNames = new Set(
        [...context.groupsById.values()].map((group) =>
            normalizeText(group.name)
        )
    )
    const fallbackChoices: Array<{
        player: number
        slot: number
        rank: number
    }> = []
    availableUserIds.forEach((id, playerIndex) => {
        const user = context.usersById.get(id)
        const preference = context.signupGroupByUserId.get(id)
        const preferences =
            context.signupPreferencesByUserId?.get(id) ??
            singleSignupPreference(preference)
        emptySlots.forEach((slot, slotIndex) => {
            const allocation =
                next.squads[slot.squadIndex].players[slot.playerIndex]
                    .allocatedGuildId
            if (
                allocation &&
                user?.sharedGuildId !== allocation &&
                !user?.sharedEligibleGuildIds?.includes(allocation)
            )
                return
            const rank = preferences.findIndex(
                (name) =>
                    normalizeText(name) === normalizeText(slot.squadGroup) ||
                    (!catalogueGroupNames.has(normalizeText(slot.squadGroup)) &&
                        getRosterPreferenceKey(name) !== "other" &&
                        getRosterPreferenceKey(name) ===
                            getSlotPreferenceKey(slot))
            )
            if (!preferences.length || rank >= 0)
                choices.push({
                    player: playerIndex,
                    slot: slotIndex,
                    rank: Math.max(0, rank),
                })
            else
                fallbackChoices.push({
                    player: playerIndex,
                    slot: slotIndex,
                    rank: 26,
                })
        })
    })
    const players = availableUserIds.map((id) => {
        const user = context.usersById.get(id)
        return {
            score: user ? getScore(user, context.serverDiscordId) : 0,
            kd: user ? getKd(user) : -1,
        }
    })
    const matched = optimalAssignment({
        players,
        slotCount: emptySlots.length,
        choices,
    })
    // Only a player shortage permits unlisted groups. Shuffle remaining candidates and
    // slots for those fallback placements; eligibility and existing assignments still apply.
    if (availableUserIds.length <= emptySlots.length) {
        const remaining = [...fallbackChoices]
        for (let index = remaining.length - 1; index > 0; index--) {
            const target = Math.floor(random() * (index + 1))
            ;[remaining[index], remaining[target]] = [
                remaining[target],
                remaining[index],
            ]
        }
        // Include preferred edges to allow reassignment if a shared-clan allocation
        // requires moving a preferred player to make room for a fallback player.
        const all = [...choices, ...remaining]
        matched.splice(
            0,
            matched.length,
            ...optimalAssignment({
                players,
                slotCount: emptySlots.length,
                choices: all,
            })
        )
    }
    const assigned = new Set<string>()
    for (const match of matched) {
        const slot = emptySlots[match.slot]
        const player = next.squads[slot.squadIndex].players[slot.playerIndex]
        player.id = availableUserIds[match.player]
        player.customName = undefined
        player.ack = false
        player.confirmed = false
        assigned.add(player.id)
    }
    next.reservePlayerIds = [...new Set(next.reservePlayerIds ?? [])].filter(
        (id) => !assigned.has(id) && !alreadyAssigned.has(id)
    )
    return next
}

function getCustomNameFromSlot(customName?: string) {
    return customName?.trim() || undefined
}

export function getAssignedElsewhereUserIds(
    board: Roster,
    currentSlot: { squadIndex: number; playerIndex: number }
) {
    const result = new Set<string>()

    board.squads.forEach((squad, squadIndex) => {
        squad.players.forEach((player, playerIndex) => {
            if (!player.id) {
                return
            }

            if (
                squadIndex === currentSlot.squadIndex &&
                playerIndex === currentSlot.playerIndex
            ) {
                return
            }

            result.add(player.id)
        })
    })

    return result
}
