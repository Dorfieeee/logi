import { templateSchedule, type MatchTemplate } from "../events/match-templates"
import type { EventUpsertInput } from "../events/upsert-policy"
import { z } from "zod"

const text = z.string().trim().min(1).max(300)
export const teamFixtureSchema = z.object({
    id: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
    number: z.number().int().nonnegative(),
    sourceUrl: z.string().url().optional(),
    status: text,
    scheduledAt: z.iso.datetime({ offset: true }).nullable(),
    map: z.string().max(300).nullable(),
    gameMode: z.string().max(300).nullable(),
    competition: z
        .object({
            competition: z.string().max(300).nullable(),
            season: z.string().max(300).nullable(),
            division: z.string().max(300).nullable(),
            round: z.number().int().nullable(),
        })
        .nullable(),
    participants: z
        .array(
            z.object({
                team: z.object({
                    code: text,
                    name: text,
                    slug: text.optional(),
                }),
                faction: z.string().max(64).nullable(),
                finishingPosition: z.number().int().nullable(),
                points: z.number().nullable(),
                noShow: z.boolean(),
            })
        )
        .min(1)
        .max(3),
})
export const teamFixturesSchema = z.object({
    upcoming: z.array(teamFixtureSchema).max(100),
    recent: z.array(teamFixtureSchema).max(100),
})
export type TeamFixture = z.infer<typeof teamFixtureSchema>
const channel = z.string().regex(/^\d{1,32}$/)
export const autoImportSettingsSchema = z
    .strictObject({
        enabled: z.boolean(),
        autoCreate: z.boolean().default(true),
        teamCode: z.string().trim().min(1).max(128),
        templateId: z.string().trim().min(1).max(64),
        registrationHoursBeforeStart: z
            .number()
            .int()
            .min(1)
            .max(24 * 30)
            .default(168),
        announcementChannelId: channel.or(z.literal("")),
        eventInfoChannelId: channel.or(z.literal("")),
        eventResultsChannelId: channel.optional(),
        server: z.string().trim().max(200).optional(),
    })
    .refine(
        (value) =>
            !value.enabled ||
            !value.autoCreate ||
            Boolean(value.announcementChannelId && value.eventInfoChannelId),
        "Choose announcement and information channels for automatic creation."
    )
export type AutoImportSettings = z.infer<typeof autoImportSettingsSchema>

/** Provider-owned fields only. Never includes signups, roster, results or attendance. */
export const importedFieldsSchema = z.object({
    name: z.string(),
    description: z.string(),
    map: z.string(),
    side: z.string(),
    registrationStart: z.string(),
    registrationEnd: z.string(),
    meetingStart: z.string(),
    gameStart: z.string(),
    gameEnd: z.string(),
})
export type ImportedFields = z.infer<typeof importedFieldsSchema>
export type ImportedField = keyof ImportedFields

export function fixtureFields(
    fixture: TeamFixture,
    template: MatchTemplate,
    settings: AutoImportSettings
): ImportedFields {
    if (
        template.kind !== "match" ||
        (template.gameId && template.gameId !== "wardogs")
    )
        throw new Error("Select a Wardogs match template.")
    if (!fixture.scheduledAt) throw new Error("Fixture has no kickoff time.")
    const schedule = templateSchedule(
        {
            ...template,
            announcementHoursBeforeStart: settings.registrationHoursBeforeStart,
        },
        fixture.scheduledAt
    )
    if (
        !schedule?.registrationStart ||
        Date.parse(schedule.registrationStart) >=
            Date.parse(schedule.registrationEnd)
    )
        throw new Error("Registration must open before it closes.")
    const competition = fixture.competition
    return {
        ...schedule,
        registrationStart: schedule.registrationStart,
        name: `${fixture.participants.map((p) => p.team.code).join(" vs ")} · ${competition?.competition || template.name}`,
        description: [
            fixture.sourceUrl ??
                `https://wardogsleague.net/matches/${fixture.id}`,
            ...fixture.participants.map(
                (p) =>
                    `${p.team.name} (${p.team.code})${p.faction ? ` · ${p.faction}` : ""}`
            ),
            competition?.competition,
            competition?.season,
            competition?.division,
            competition?.round != null ? `Round ${competition.round}` : null,
            fixture.gameMode,
        ]
            .filter(Boolean)
            .join("\n"),
        map: fixture.map ?? "",
        side:
            ["Valkyra", "Manticore", "Lonestar"].find(
                (side) =>
                    side.toLowerCase() ===
                    fixture.participants
                        .find(
                            (p) =>
                                (p.team.slug ?? p.team.code).toLowerCase() ===
                                settings.teamCode.toLowerCase()
                        )
                        ?.faction?.toLowerCase()
            ) ?? "",
    }
}

export function fixtureCommand(
    guildId: string,
    fixture: TeamFixture,
    template: MatchTemplate,
    settings: AutoImportSettings
): EventUpsertInput {
    return {
        ...fixtureFields(fixture, template, settings),
        guildId,
        wardogsFixtureUrl:
            fixture.sourceUrl ??
            `https://wardogsleague.net/matches/${fixture.id}`,
        gameId: "wardogs",
        kind: "match",
        matchType: template.categoryId,
        durationMinutes: template.durationMinutes,
        announcementChannelId: settings.announcementChannelId,
        eventInfoChannelId: settings.eventInfoChannelId,
        eventResultsChannelId: settings.eventResultsChannelId,
        server: settings.server,
        allowedSignupStatuses: template.allowedSignupStatuses,
        signupGroupIds: template.signupGroupIds,
        signupGroupLimits: template.signupGroupLimits,
        useGeneralSignup: template.useGeneralSignup,
        allowRankedSignup: template.allowRankedSignup,
        signupReminderStatuses: template.signupReminderStatuses,
        attendanceReminderHours: template.attendanceReminderHours,
        pingClan: template.pingMode === "clan",
        pingMode: template.pingMode,
        pingRoleIds: template.pingRoleIds,
        createForumChannel: template.createForumChannel,
        createSquadVoiceChannels: template.createSquadVoiceChannels,
        topicPresetId: template.topicPresetId,
        squadPresetId: template.squadPresetId,
        createParticipantRoles: template.createParticipantRoles,
    }
}

/** A detected local override stays local even if a later API value happens to match it. */
export function mergeFixtureFields(
    current: Partial<ImportedFields>,
    previous: ImportedFields,
    incoming: ImportedFields,
    overrides: readonly ImportedField[] = []
) {
    const local = new Set(overrides)
    const patch: Partial<ImportedFields> = {}
    for (const field of Object.keys(incoming) as ImportedField[]) {
        if ((current[field] ?? "") !== previous[field]) local.add(field)
        if (!local.has(field) && incoming[field] !== previous[field])
            patch[field] = incoming[field]
    }
    return { patch, overrides: [...local] }
}

/** A code must resolve uniquely; ambiguous names never silently select another team. */
export function matchFixtureTeams(
    fixture: TeamFixture,
    catalogue: readonly import("../teams/match-teams").DirectoryTeamLookup[],
    previous: readonly import("../teams/match-teams").MatchTeamAssignment[] = [],
    now: string
) {
    const assignments: import("../teams/match-teams").MatchTeamAssignment[] = []
    const unmatched: string[] = []
    for (const [index, participant] of fixture.participants.entries()) {
        const active = catalogue.filter(
            (t) => t.gameId === "wardogs" && !t.archivedAt
        )
        const codes = active.filter(
            (t) =>
                t.shortCode?.toLowerCase() ===
                participant.team.code.toLowerCase()
        )
        const candidates = codes.length
            ? codes
            : active.filter(
                  (t) =>
                      t.name.toLowerCase() ===
                      participant.team.name.toLowerCase()
              )
        const team = candidates.length === 1 ? candidates[0] : undefined
        if (!team || assignments.some((a) => a.teamId === team.id)) {
            unmatched.push(participant.team.name)
            continue
        }
        const side =
            ["Valkyra", "Manticore", "Lonestar"].find(
                (s) => s.toLowerCase() === participant.faction?.toLowerCase()
            ) ?? null
        if (participant.faction && !side) unmatched.push(participant.team.name)
        if (side && assignments.some((a) => a.side === side)) {
            unmatched.push(participant.team.name)
            continue
        }
        assignments.push({
            teamId: team.id,
            slot: (["a", "b", "c"] as const)[index],
            side,
            snapshot: previous.find((a) => a.teamId === team.id)?.snapshot ?? {
                name: team.name,
                shortCode: team.shortCode,
                logoAssetId: team.logoAssetId,
                logoUrl: team.logoAssetId ? team.logoUrl : null,
                teamRevision: team.revision,
                capturedAt: now,
            },
        })
    }
    return { assignments, unmatched }
}

/** The team-key endpoint does not identify the key owner; configuration supplies that identity. */
export function ownTeamFirst(
    fixture: TeamFixture,
    code: string
): TeamFixture | null {
    const own = fixture.participants.filter(
        (p) => (p.team.slug ?? p.team.code).toLowerCase() === code.toLowerCase()
    )
    if (own.length !== 1) return null
    return {
        ...fixture,
        participants: [
            own[0],
            ...fixture.participants.filter((p) => p !== own[0]),
        ],
    }
}
