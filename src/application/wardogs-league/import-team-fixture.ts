import {
    fixtureFields,
    ownTeamFirst,
    mergeFixtureFields,
    type AutoImportSettings,
    type ImportedFields,
    type ImportedField,
    type TeamFixture,
} from "../../domain/wardogs-league/team-api"
import type { MatchTemplate } from "../../domain/events/match-templates"

/** Decisions are shared by the transactional importer and its regression tests. */
export function planFixtureImport(input: {
    fixture: TeamFixture
    template: MatchTemplate
    settings: AutoImportSettings
    now: number
    existing?: {
        current: Partial<ImportedFields>
        baseline: ImportedFields
        overrides: ImportedField[]
        concluded: boolean
    }
}) {
    const { existing } = input
    const fixture = ownTeamFirst(input.fixture, input.settings.teamCode)
    if (!fixture)
        return { kind: "review" as const, issue: "team_not_in_fixture" }
    if (
        ["CANCELLED", "CANCELED", "POSTPONED"].includes(
            fixture.status.toUpperCase()
        )
    )
        return { kind: "review" as const, issue: "cancelled_or_postponed" }
    if (
        existing?.concluded &&
        !fixture.sourceUrl?.startsWith("https://gwl.gg/")
    )
        return { kind: "skip" as const }
    if (!fixture.scheduledAt)
        return { kind: "review" as const, issue: "missing_kickoff" }
    if (
        !existing &&
        (fixture.status.toUpperCase() !== "SCHEDULED" ||
            Date.parse(fixture.scheduledAt) <= input.now)
    )
        return { kind: "skip" as const }
    if (
        existing &&
        fixture.status.toUpperCase() !== "SCHEDULED" &&
        !fixture.sourceUrl?.startsWith("https://gwl.gg/")
    )
        return { kind: "skip" as const }
    const fields = fixtureFields(fixture, input.template, input.settings)
    return existing
        ? {
              kind: "update" as const,
              fields,
              ...(fixture.sourceUrl?.startsWith("https://gwl.gg/")
                  ? { patch: fields, overrides: [] }
                  : mergeFixtureFields(
                        existing.current,
                        existing.baseline,
                        fields,
                        existing.overrides
                    )),
          }
        : { kind: "create" as const, fields }
}

import type { EventDiscussionSettings } from "../../domain/events/discussion"
import type { MatchTeamAssignment } from "../../domain/teams/match-teams"
import { fixtureCommand } from "../../domain/wardogs-league/team-api"
import type { EventUpsertCommand } from "../events/command-ports"

type ImportState = {
    eventId?: string
    baseline?: ImportedFields
    teamsBaseline?: MatchTeamAssignment[]
    overrides: string[]
}
type CurrentMatch = Partial<ImportedFields> & {
    guildId: string
    gameId?: string
    kind?: string
    status?: string
    matchTeams?: MatchTeamAssignment[]
}
export interface TeamFixtureImportPorts {
    findScheduledMatch(
        gameStart: string
    ): Promise<
        | { kind: "none" }
        | { kind: "match"; eventId: string }
        | { kind: "review"; issue: string }
    >
    create(command: EventUpsertCommand): Promise<string>
    update(
        eventId: string,
        patch: Partial<ImportedFields> & {
            matchTeams?: MatchTeamAssignment[]
            tacticalPlan?: undefined
            updatedAt: string
        }
    ): Promise<void>
    link(eventId: string): Promise<void>
    refreshSchedule(eventId: string): Promise<void>
    save(state: {
        issue?: string
        eventId?: string
        baseline?: ImportedFields
        teamsBaseline?: MatchTeamAssignment[]
        overrides?: string[]
        template?: MatchTemplate
        settings?: AutoImportSettings
        changed?: boolean
    }): Promise<void>
}

/** One transaction: eligibility, merge, native write, fixture binding and publication schedule. */
export class ImportTeamFixtureUseCase {
    constructor(private readonly ports: TeamFixtureImportPorts) {}
    async execute(input: {
        guildId: string
        fixture: TeamFixture
        template: MatchTemplate
        settings: AutoImportSettings
        now: number
        previous?: ImportState
        current: CurrentMatch | null
        manuallyManaged: boolean
        assignments: MatchTeamAssignment[]
        unmatched: boolean
        offeredGroupIds: string[]
        discussion: EventDiscussionSettings
    }) {
        const { previous, current, template, settings } = input
        const fixture =
            ownTeamFirst(input.fixture, settings.teamCode) ?? input.fixture
        if (
            current &&
            (current.guildId !== input.guildId ||
                current.gameId !== "wardogs" ||
                (current.kind ?? "match") !== "match")
        )
            throw new Error("Imported match scope mismatch.")
        if (previous?.eventId && !current) {
            await this.ports.save({ issue: "match_deleted" })
            return
        }
        if (
            previous?.eventId &&
            current &&
            !previous.baseline &&
            !fixture.sourceUrl?.startsWith("https://gwl.gg/")
        )
            return
        if (input.manuallyManaged) {
            await this.ports.save({ issue: "manually_managed" })
            return
        }
        const overrides =
            previous?.overrides.filter((key): key is ImportedField =>
                [
                    "name",
                    "description",
                    "map",
                    "side",
                    "registrationStart",
                    "registrationEnd",
                    "meetingStart",
                    "gameStart",
                    "gameEnd",
                ].includes(key)
            ) ?? []
        const plan = planFixtureImport({
            fixture,
            template,
            settings,
            now: input.now,
            ...(current && previous?.baseline
                ? {
                      existing: {
                          current,
                          baseline: previous.baseline,
                          overrides,
                          concluded: current.status === "concluded",
                      },
                  }
                : {}),
        })
        if (plan.kind === "skip") return
        if (plan.kind === "review") {
            await this.ports.save({ issue: plan.issue })
            return
        }
        const teamOverride =
            !fixture.sourceUrl?.startsWith("https://gwl.gg/") &&
            Boolean(
                previous?.overrides.includes("matchTeams") ||
                (current &&
                    previous?.teamsBaseline &&
                    JSON.stringify(current.matchTeams ?? []) !==
                        JSON.stringify(previous.teamsBaseline))
            )
        let eventId = previous?.eventId
        let changed = false
        if (plan.kind === "create") {
            const existing = await this.ports.findScheduledMatch(
                plan.fields.gameStart
            )
            if (existing.kind === "review") {
                await this.ports.save({ issue: existing.issue })
                return
            }
            if (existing.kind === "match") {
                await this.ports.link(existing.eventId)
                await this.ports.save({
                    eventId: existing.eventId,
                    changed: true,
                })
                return
            }
            const command = fixtureCommand(
                input.guildId,
                fixture,
                template,
                settings
            )
            const offered = new Set(input.offeredGroupIds)
            command.signupGroupIds = (
                template.signupGroupIds ?? [...offered]
            ).filter((id) => offered.has(id))
            command.allowLateSignups = true
            eventId = await this.ports.create({
                ...input.discussion,
                ...command,
                matchTeams: input.assignments,
            })
            await this.ports.link(eventId)
            changed = true
        } else if (eventId) {
            const teamsChanged =
                !teamOverride &&
                JSON.stringify(input.assignments) !==
                    JSON.stringify(previous?.teamsBaseline)
            if (Object.keys(plan.patch).length || teamsChanged) {
                await this.ports.update(eventId, {
                    ...plan.patch,
                    ...(plan.patch.map !== undefined
                        ? { tacticalPlan: undefined }
                        : {}),
                    ...(teamsChanged ? { matchTeams: input.assignments } : {}),
                    updatedAt: new Date(input.now).toISOString(),
                })
                changed = true
            }
        }
        if (eventId && changed) await this.ports.refreshSchedule(eventId)
        await this.ports.save({
            eventId,
            baseline: plan.fields,
            teamsBaseline: input.assignments,
            template,
            settings,
            changed,
            overrides: [
                ...(plan.kind === "update" ? plan.overrides : []),
                ...(teamOverride ? ["matchTeams"] : []),
            ],
            issue: input.unmatched ? "team_matching_required" : undefined,
        })
    }
}
