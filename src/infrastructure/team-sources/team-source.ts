import {
    teamNameSchema,
    teamShortCodeSchema,
    type TeamGame,
} from "@/domain/teams/team"
import { load } from "cheerio"
import { z } from "zod"

export const TEAM_SOURCES = {
    wardogs: "https://wardogsleague.net/teams?all=1",
    hell_let_loose: "https://helo-system.de/v3/series/2024/teams",
} as const
export const sourceTeamSchema = z.object({
    name: teamNameSchema,
    shortCode: teamShortCodeSchema,
    logoUrl: z.string().url().nullable(),
})
export type SourceTeam = z.infer<typeof sourceTeamSchema>
const sourceTeamsSchema = z.array(sourceTeamSchema).min(1).max(500)

/** Parse only rendered team cards, excluding navigation and React hydration data. */
export function parseWardogsTeams(html: string): SourceTeam[] {
    const $ = load(html)
    const teams: SourceTeam[] = []
    $('a[href^="/teams/"]').each((_, element) => {
        const card = $(element)
        const name = card.find("span.line-clamp-2").text()
        if (!name) return
        const code = decodeURIComponent(
            card.attr("href")!.slice("/teams/".length)
        )
        const src = card.find("img").attr("src")
        teams.push({
            name,
            shortCode: code,
            logoUrl: src ? new URL(src, TEAM_SOURCES.wardogs).href : null,
        })
    })
    return sourceTeamsSchema.parse(teams)
}

export function parseHeloTeams(data: unknown): SourceTeam[] {
    const rows = z
        .array(
            z.object({
                name: z.string(),
                tag: z.string(),
                icon: z.string().nullable().optional(),
            })
        )
        .min(1)
        .max(500)
        .parse(data)
    return sourceTeamsSchema.parse(
        rows.map((row) => ({
            name: row.name,
            shortCode: row.tag,
            logoUrl: row.icon || null,
        }))
    )
}

/** Fixed public providers and logo hosts only; redirects are refused as well. */
export function allowedTeamSourceUrl(url: string): boolean {
    try {
        const parsed = new URL(url)
        return (
            parsed.protocol === "https:" &&
            !parsed.username &&
            !parsed.password &&
            !parsed.port &&
            ((parsed.hostname === "wardogsleague.net" &&
                (parsed.pathname === "/teams" ||
                    parsed.pathname.startsWith("/api/logos/"))) ||
                (parsed.hostname === "helo-system.de" &&
                    parsed.pathname === "/v3/series/2024/teams") ||
                (parsed.hostname === "floriansw.github.io" &&
                    parsed.pathname.startsWith("/helo-team-images/teams/")) ||
                (["cdn.discordapp.com", "media.discordapp.net"].includes(
                    parsed.hostname
                ) &&
                    parsed.pathname.startsWith("/attachments/")))
        )
    } catch {
        return false
    }
}

export function parseTeamSource(game: TeamGame, text: string): SourceTeam[] {
    return game === "wardogs"
        ? parseWardogsTeams(text)
        : parseHeloTeams(JSON.parse(text))
}
