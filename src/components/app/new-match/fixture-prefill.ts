import type { MatchTeamAssignment } from "@/domain/teams/match-teams"
import type { TeamFixture } from "@/domain/wardogs-league/team-api"
import { splitLocalDateTime } from "@/domain/events/new-match-flow"
import { toDateTimeLocalInTimeZone } from "@/lib/timezone-datetime"
import type { FlowValues, FlowOpponent } from "./flow-values"
import { inferHllBaseMapId } from "@/lib/hll-map-presets"

/** Explicit button action: provider facts replace the form's plan; template/default signup settings stay intact. */
export function fixturePrefill(
    fixture: TeamFixture,
    teams: readonly MatchTeamAssignment[],
    timezone: string
): Partial<FlowValues> {
    const opponent = (slot: "b" | "c"): FlowOpponent | null => {
        const team = teams.find((t) => t.slot === slot)
        return team
            ? {
                  teamId: team.teamId,
                  name: team.snapshot.name,
                  shortCode: team.snapshot.shortCode,
                  logoUrl: team.snapshot.logoUrl,
              }
            : null
    }
    const side = (index: number) =>
        ["Valkyra", "Manticore", "Lonestar"].find(
            (value) =>
                value.toLowerCase() ===
                fixture.participants[index]?.faction?.toLowerCase()
        ) ?? null
    return {
        wardogsFixtureUrl:
            fixture.sourceUrl ??
            `https://wardogsleague.net/matches/${fixture.id}`,
        ...(fixture.scheduledAt
            ? splitLocalDateTime(
                  toDateTimeLocalInTimeZone(fixture.scheduledAt, timezone)
              )
            : {}),
        name: `${fixture.participants.map((p) => p.team.code).join(" vs ")} · ${fixture.competition?.competition || "Wardogs League"}`,
        nameTouched: true,
        repeatWeekly: false,
        mapId: inferHllBaseMapId(fixture.map ?? "", "wardogs") ?? "",
        mapCleared: false,
        tacticalPlan: null,
        opponent: opponent("b"),
        extraTeam: opponent("c"),
        ownSide: side(0),
        opponentSide: side(1),
        extraSide: side(2),
        description: [
            fixture.sourceUrl ??
                `https://wardogsleague.net/matches/${fixture.id}`,
            ...fixture.participants.map(
                (p) =>
                    `${p.team.name} (${p.team.code})${p.faction ? ` · ${p.faction}` : ""}`
            ),
            fixture.map,
            fixture.gameMode,
            fixture.competition?.competition,
            fixture.competition?.season,
            fixture.competition?.division,
            fixture.competition?.round != null
                ? `Round ${fixture.competition.round}`
                : null,
        ]
            .filter(Boolean)
            .join("\n"),
    }
}
