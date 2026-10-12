import {
    COMPETITION_SLUG_PATTERN,
    fixtureInputSchema,
    type FixtureInput,
    type FixturePhase,
    type FixtureStatus,
} from "@/domain/competitions/competition"
import type { CompetitionFixtureView } from "@/domain/competitions/admin-view"

/** A URL slug suggestion from a competition name and season ("ECL 2026" → "ecl-2026"). */
export function suggestCompetitionSlug(name: string, season: string): string {
    const slug = `${name} ${season}`
        .normalize("NFKD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 64)
        .replace(/-+$/g, "")
    return COMPETITION_SLUG_PATTERN.test(slug) ? slug : ""
}

const pad = (value: number) => String(value).padStart(2, "0")

/** An ISO instant as a `datetime-local` value in the viewer's time zone. */
export function toLocalDateTimeInput(iso: string | null): string {
    if (!iso) return ""
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return ""
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** A `datetime-local` value (viewer's time zone) as an ISO instant; blank or invalid is null. */
export function fromLocalDateTimeInput(value: string): string | null {
    if (!value) return null
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export type FixtureFormValues = {
    divisionId: string
    phase: FixturePhase
    /** Round number as typed; blank means no round. */
    round: string
    sideATeamId: string
    sideBTeamId: string
    sideCTeamId?: string
    scheduledAt: string
    status: FixtureStatus
    scoreA: string
    scoreB: string
    scoreC?: string
}

export function fixtureFormValues(
    fixture: CompetitionFixtureView | null,
    divisionId: string,
    defaults: { phase?: FixturePhase; round?: number | null } = {}
): FixtureFormValues {
    if (!fixture)
        return {
            divisionId,
            phase: defaults.phase ?? "league",
            round: defaults.round ? String(defaults.round) : "",
            sideATeamId: "",
            sideBTeamId: "",
            sideCTeamId: "",
            scheduledAt: "",
            status: "scheduled",
            scoreA: "",
            scoreB: "",
            scoreC: "",
        }
    return {
        divisionId: fixture.divisionId ?? divisionId,
        phase: fixture.phase,
        round: fixture.round ? String(fixture.round) : "",
        sideATeamId: fixture.sideA.legacy ? "" : fixture.sideA.id,
        sideBTeamId: fixture.sideB.legacy ? "" : fixture.sideB.id,
        sideCTeamId: fixture.participants?.[2]?.legacy
            ? ""
            : (fixture.participants?.[2]?.id ?? ""),
        scheduledAt: toLocalDateTimeInput(fixture.scheduledAt),
        status: fixture.status,
        scoreA: fixture.scoreA === null ? "" : String(fixture.scoreA),
        scoreB: fixture.scoreB === null ? "" : String(fixture.scoreB),
        scoreC:
            fixture.participantScores?.[2] === null ||
            fixture.participantScores?.[2] === undefined
                ? ""
                : String(fixture.participantScores[2]),
    }
}

function score(value: string): number | null {
    const trimmed = value.trim()
    return trimmed === "" ? null : Number(trimmed)
}

/** The fixture write for the form, or `null` when the domain rules reject it. */
export function fixtureFormInput(
    values: FixtureFormValues
): FixtureInput | null {
    const participantTeamIds = values.sideCTeamId
        ? [values.sideATeamId, values.sideBTeamId, values.sideCTeamId]
        : undefined
    const participantScores = values.sideCTeamId
        ? [
              score(values.scoreA),
              score(values.scoreB),
              score(values.scoreC ?? ""),
          ]
        : undefined
    const parsed = fixtureInputSchema.safeParse({
        divisionId: values.divisionId,
        phase: values.phase,
        sideATeamId: values.sideATeamId,
        sideBTeamId: values.sideBTeamId,
        ...(participantTeamIds ? { participantTeamIds } : {}),
        scheduledAt: fromLocalDateTimeInput(values.scheduledAt),
        status: values.status,
        scoreA: values.status === "scheduled" ? null : score(values.scoreA),
        scoreB: values.status === "scheduled" ? null : score(values.scoreB),
        ...(participantScores ? { participantScores } : {}),
        round: score(values.round),
    })
    return parsed.success ? parsed.data : null
}
