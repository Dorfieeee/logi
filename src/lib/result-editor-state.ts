import type { resultReviewSchema } from "@/domain/match-results/result-revision"
import { suggestResultSession } from "@/domain/match-results/session-pick"
import type { MatchTeamAssignment } from "@/domain/teams/match-teams"
import type { GameId } from "@/domain/games/game"
import type { z } from "zod"
type ReviewData = z.infer<typeof resultReviewSchema>
type ScoreInput = { id: string; label: string; score: string }

export function toInputs(
    participants: ReadonlyArray<{
        id: string
        label: string
        score: number | null
    }>
): ScoreInput[] {
    return participants.map((p) => ({
        ...p,
        score: p.score === null ? "" : String(p.score),
    }))
}

/** Editor fields for a review: the current result, else the server game
 * that matches the match time, else game-specific empty participants. */
export function editorState(
    data: ReviewData,
    matchStart: string | undefined,
    participantLabel: string,
    matchTeams: MatchTeamAssignment[] | undefined,
    matchEnd?: string,
    gameId?: GameId
) {
    const suggestion =
        !data.current && matchStart
            ? suggestResultSession(data.sessions, matchStart, matchEnd)
            : null
    return {
        scores: data.current
            ? toInputs(data.current.participants)
            : suggestion?.participants.length
              ? toInputs(suggestion.participants)
              : matchTeams?.length
                ? [...matchTeams]
                      .sort((left, right) =>
                          left.slot.localeCompare(right.slot)
                      )
                      .map((team, index) => ({
                          id: team.side?.trim() || `participant-${index + 1}`,
                          label: team.snapshot.name,
                          score: "",
                      }))
                : Array.from(
                      { length: gameId === "wardogs" ? 3 : 2 },
                      (_, i) => i + 1
                  ).map((n) => ({
                      id: `participant-${n}`,
                      label: `${participantLabel} ${n}`,
                      score: "",
                  })),
        source: data.current?.sessionLinks.length
            ? "keep"
            : (suggestion?.id ?? ""),
        suggested: Boolean(suggestion),
    }
}
