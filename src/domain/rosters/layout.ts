import type { RosterSquad } from "./types"

function lastMatchingIndex<T>(
    items: readonly T[],
    predicate: (item: T) => boolean
) {
    for (let index = items.length - 1; index >= 0; index--)
        if (predicate(items[index])) return index
    return -1
}

/** Move one complete squad, preserving its players, roles and attendance. */
export function moveRosterSquad<T extends RosterSquad>(
    squads: readonly T[],
    sourceIndex: number,
    group: string,
    beforeIndex?: number
): T[] {
    const source = squads[sourceIndex]
    const target = beforeIndex === undefined ? undefined : squads[beforeIndex]
    if (!source || !group.trim() || (beforeIndex !== undefined && !target))
        return [...squads]
    if (source === target) return [...squads]
    const ordered = squads
        .filter((squad) => squad !== source)
        .sort((a, b) => a.order - b.order)
    let insertion = target ? ordered.indexOf(target) : -1
    if (insertion < 0) {
        const lastInGroup = lastMatchingIndex(
            ordered,
            (squad) => squad.group === group
        )
        insertion = lastInGroup < 0 ? ordered.length : lastInGroup + 1
    }
    ordered.splice(insertion, 0, { ...source, group })
    return ordered.map((squad, order) => ({ ...squad, order }))
}

/** A section includes its direct child groups; moving it keeps that block intact. */
export function moveRosterSection<T extends RosterSquad>(
    squads: readonly T[],
    sourceGroups: readonly string[],
    targetGroups: readonly string[],
    placement: "before" | "after" = "before"
): T[] {
    if (sourceGroups.some((group) => targetGroups.includes(group)))
        return [...squads]
    const ordered = [...squads].sort((a, b) => a.order - b.order)
    const moving = ordered.filter((squad) => sourceGroups.includes(squad.group))
    const remaining = ordered.filter(
        (squad) => !sourceGroups.includes(squad.group)
    )
    const targetIndex =
        placement === "after"
            ? lastMatchingIndex(remaining, (squad) =>
                  targetGroups.includes(squad.group)
              )
            : remaining.findIndex((squad) => targetGroups.includes(squad.group))
    if (!moving.length || targetIndex < 0) return [...squads]
    remaining.splice(
        targetIndex + (placement === "after" ? 1 : 0),
        0,
        ...moving
    )
    return remaining.map((squad, order) => ({ ...squad, order }))
}

export function rosterSectionOrder(
    squads: readonly RosterSquad[],
    groups: readonly string[]
) {
    return Math.min(
        ...squads
            .filter((squad) => groups.includes(squad.group))
            .map((squad) => squad.order)
    )
}

/** Dropping on a squad fills the first empty role and never replaces a player. */
export function firstAvailableRosterSlot(squad: RosterSquad) {
    return squad.players.findIndex(
        (player) => !player.id && !player.customName?.trim()
    )
}
