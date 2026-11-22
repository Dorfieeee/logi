import { moveRosterSquad, moveRosterSection } from "@/domain/rosters/layout"
import type { Roster } from "@/types/domain"

export function nextDraftSquadOrder(squads: Roster["squads"]) {
    return squads.reduce((last, squad) => Math.max(last, squad.order), -1) + 1
}

/** Keep surviving cards and their slot state mounted when removing a squad. */
export function removeDraftSquad(board: Roster, index: number): Roster {
    const removed = board.squads[index]
    if (!removed || board.squads.length <= 1) return board
    return {
        ...board,
        squads: board.squads.filter((_, squadIndex) => squadIndex !== index),
        reservePlayerIds: Array.from(
            new Set([
                ...board.reservePlayerIds,
                ...removed.players.flatMap((player) =>
                    player.id ? [player.id] : []
                ),
            ])
        ),
    }
}

// UI identities are deliberately separate from supplied preset order values.
const squadKeys = new WeakMap<Roster["squads"][number], number>()
let nextSquadKey = 0

export function draftSquadKey(squad: Roster["squads"][number]) {
    let key = squadKeys.get(squad)
    if (key === undefined) {
        key = nextSquadKey++
        squadKeys.set(squad, key)
    }
    return key
}

export function preserveDraftSquadKeys(current: Roster, next: Roster) {
    next.squads.forEach((squad, index) => {
        const previous = current.squads[index]
        if (previous) squadKeys.set(squad, draftSquadKey(previous))
    })
    return next
}

export function cloneDraftRoster(current: Roster) {
    return preserveDraftSquadKeys(current, structuredClone(current))
}

function preserveLayoutKeys(
    current: readonly Roster["squads"][number][],
    next: Roster["squads"]
) {
    const keysByPlayers = new Map(
        current.map((squad) => [squad.players, draftSquadKey(squad)])
    )
    for (const squad of next) {
        const key = keysByPlayers.get(squad.players)
        if (key !== undefined) squadKeys.set(squad, key)
    }
    return next
}

export function moveDraftSquad(...args: Parameters<typeof moveRosterSquad>) {
    return preserveLayoutKeys(args[0], moveRosterSquad(...args))
}

export function moveDraftSection(
    ...args: Parameters<typeof moveRosterSection>
) {
    return preserveLayoutKeys(args[0], moveRosterSection(...args))
}

/** Make only selected squads writable. Reserve lists are small and copied
 * independently; metadata and untouched squads remain shared with the draft. */
export function cloneDraftSquads(
    current: Roster,
    indices: readonly number[]
): Roster {
    const selected = new Set(indices)
    return {
        ...current,
        squads: selected.size
            ? current.squads.map((squad, index) => {
                  if (!selected.has(index)) return squad
                  const next = {
                      ...squad,
                      players: squad.players.map((player) => ({ ...player })),
                  }
                  squadKeys.set(next, draftSquadKey(squad))
                  return next
              })
            : current.squads,
        reservePlayerIds: [...current.reservePlayerIds],
        notAttendingPlayerIds: [...current.notAttendingPlayerIds],
    }
}

export function cloneDraftSquad(current: Roster, index: number): Roster {
    return current.squads[index] ? cloneDraftSquads(current, [index]) : current
}

/** Assignment can move a user out of another squad; copy all affected squads. */
export function cloneDraftUserPlacement(
    current: Roster,
    userId: string,
    targetSquadIndex?: number
): Roster {
    return cloneDraftSquads(
        current,
        current.squads.flatMap((squad, index) =>
            index === targetSquadIndex ||
            squad.players.some((player) => player.id === userId)
                ? [index]
                : []
        )
    )
}
