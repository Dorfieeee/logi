import type { MatchTeamAssignment } from "@/domain/teams/match-teams"
import { resultFaction } from "@/domain/match-results/result-sides"

/** A faction identifies a side, never a position in the provider scoreboard. */
export function resultTeamFor({
    id,
    label,
    index,
    teams,
}: {
    id: string
    label: string
    index: number
    teams: readonly MatchTeamAssignment[]
}): MatchTeamAssignment | undefined {
    const faction = resultFaction(id) ?? resultFaction(label)
    if (faction) {
        return teams.find((team) => resultFaction(team.side) === faction)
    }
    return (
        teams.find(
            (team) =>
                team.snapshot.name.trim().toLowerCase() ===
                label.trim().toLowerCase()
        ) ?? teams.filter((team) => !resultFaction(team.side))[index]
    )
}
