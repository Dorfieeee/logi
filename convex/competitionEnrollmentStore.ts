import {
    checkClanEnrollment,
    hasCompetitionHistory,
    enrollmentPolicy,
    type ClanCompetitionView,
} from "../src/domain/competitions/enrollment"
import {
    COMPETITION_REGISTRATION_LIMIT,
    isCompetitionPublished,
} from "../src/domain/competitions/competition"
import { clanEnrollmentCommandSchema } from "../src/domain/competitions/enrollment.schema"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import { resolveGameScope } from "../src/domain/games/game"
import type { Doc } from "./_generated/dataModel"
import { getUserByIdentifier } from "./identity"

/** Distinct members with evidence of dashboard login; imported/bot-only profiles do not count. */
export async function linkedPlayerCount(
    ctx: Pick<QueryCtx, "db">,
    guild: Doc<"guilds">
) {
    const ids = new Set([
        ...(guild.memberIds ?? []),
        ...(guild.members ?? [])
            .filter(
                (row) => row.status !== "mercenary" && row.status !== "pending"
            )
            .map((row) => row.id),
    ])
    const counted = new Set<string>()
    let count = 0
    for (const id of ids) {
        const user = await getUserByIdentifier(ctx, id)
        if (!user || counted.has(String(user._id))) continue
        counted.add(String(user._id))
        if (
            user.firstSignedInAt !== undefined ||
            (await ctx.db
                .query("dashboardSessions")
                .withIndex("userRecordId", (q) =>
                    q.eq("userRecordId", user._id)
                )
                .first())
        )
            count++
    }
    return count
}

export async function clanCompetitionView(
    ctx: Pick<QueryCtx, "db">,
    guild: Doc<"guilds">,
    guildId: string
): Promise<ClanCompetitionView> {
    const teams = (
        await ctx.db
            .query("teamDirectory")
            .withIndex("linkedGuildId", (q) => q.eq("linkedGuildId", guildId))
            .take(100)
    ).filter((row) => !row.archivedAt && !row.mergedIntoTeamId)
    const registrations = (
        await Promise.all(
            teams.map((team) =>
                ctx.db
                    .query("competitionTeams")
                    .withIndex("teamId", (q) => q.eq("teamId", team._id))
                    .take(500)
            )
        )
    ).flat()
    const competitions = (await ctx.db.query("competitions").take(200)).filter(
        isCompetitionPublished
    )
    return {
        linkedPlayers: await linkedPlayerCount(ctx, guild),
        teams: teams.map((team) => ({
            id: String(team._id),
            name: team.name,
            gameId: team.gameId,
        })),
        competitions: competitions.map((row) => ({
            id: String(row._id),
            name: row.name,
            slug: row.slug,
            season: row.season,
            gameId: resolveGameScope(row.gameId),
            ...enrollmentPolicy(row),
            registrations: registrations
                .filter(
                    (registration) => registration.competitionId === row._id
                )
                .map((registration) => ({
                    teamId: String(registration.teamId),
                    status: registration.status ?? "approved",
                    withdrawn: registration.withdrawn,
                })),
        })),
    }
}

/** The caller has established current clan-admin authority in this transaction. */
export async function executeClanEnrollment(
    ctx: MutationCtx,
    guild: Doc<"guilds">,
    guildId: string,
    subject: string,
    raw: unknown
) {
    const parsed = clanEnrollmentCommandSchema.safeParse(raw)
    if (!parsed.success) return { error: "invalid_competition" }
    const input = parsed.data
    const competitionId = ctx.db.normalizeId(
        "competitions",
        input.competitionId
    )
    const teamId = ctx.db.normalizeId("teamDirectory", input.teamId)
    const competition = competitionId ? await ctx.db.get(competitionId) : null
    const team = teamId ? await ctx.db.get(teamId) : null
    // Foreign teams cannot be read or modified through guessed identifiers.
    if (!team || team.linkedGuildId !== guildId)
        return { error: "team_not_owned" }
    if (!competition) return { error: "not_found" }
    const existing = await ctx.db
        .query("competitionTeams")
        .withIndex("competitionId_teamId", (q) =>
            q.eq("competitionId", competition._id).eq("teamId", team._id)
        )
        .first()
    const now = new Date().toISOString()
    if (input.action === "withdraw") {
        if (!existing) return { error: "not_found" }
        if (!existing.withdrawn)
            await ctx.db.patch(existing._id, {
                withdrawn: true,
                updatedAt: now,
            })
        return { ok: true, slug: competition.slug }
    }
    // Replays do not downgrade an approved registration or create a second request.
    if (existing && !existing.withdrawn && existing.status !== "rejected")
        return { ok: true, slug: competition.slug }
    const policy = enrollmentPolicy(competition)
    const blocked = checkClanEnrollment({
        published: isCompetitionPublished(competition),
        ...policy,
        linkedPlayers: await linkedPlayerCount(ctx, guild),
        teamLinked: true,
        teamActive: !team.archivedAt && !team.mergedIntoTeamId,
        gameMatches: team.gameId === resolveGameScope(competition.gameId),
    })
    if (blocked) return { error: blocked }
    const fields = {
        previouslyApproved: existing ? hasCompetitionHistory(existing) : false,
        withdrawn: false,
        status:
            policy.registrationMode === "approval"
                ? ("pending" as const)
                : ("approved" as const),
        requestedByGuildId: guildId,
        requestedBy: subject,
        decidedAt: undefined,
        decidedBy: undefined,
        updatedAt: now,
    }
    if (existing) await ctx.db.patch(existing._id, fields)
    else {
        const rows = await ctx.db
            .query("competitionTeams")
            .withIndex("competitionId", (q) =>
                q.eq("competitionId", competition._id)
            )
            .take(COMPETITION_REGISTRATION_LIMIT)
        if (rows.length >= COMPETITION_REGISTRATION_LIMIT)
            return { error: "limit_reached" }
        // Organisers assign divisions; signup is independent of competition structure.
        await ctx.db.insert("competitionTeams", {
            ...fields,
            competitionId: competition._id,
            teamId: team._id,
            createdAt: now,
        })
    }
    await ctx.db.patch(competition._id, { updatedAt: now })
    return { ok: true, slug: competition.slug }
}
