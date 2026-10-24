import type {
    LeagueMatch,
    LeagueResults,
} from "../../domain/wardogs-league/contracts"
// Type-only; the runtime parsers load through `cheerio/slim` (htmlparser2).
import type { CheerioAPI } from "cheerio/slim"

/**
 * Identifies what this file can read. The League-wide collector stores it
 * with every read and re-reads completed fixtures without placements once
 * when it changes, so a new parser backfills results it could not read
 * before. Change it together with `parseLeagueResults`.
 */
export const RESULTS_PARSER_ID = "final-placements/1"
const clean = (value: string) => value.replace(/\s+/g, " ").trim()

/** Public team profile identity, including the captured percent-encoded pipe code. */
export function leagueTeamCode(href: string): string | null {
    const path = /^\/teams\/([^/?#]{1,720})$/.exec(href)?.[1]
    if (!path) return null
    try {
        const code = decodeURIComponent(path)
        return /^[\p{L}\p{N}|_-]{1,80}$/u.test(code) &&
            encodeURIComponent(code) === path
            ? code
            : null
    } catch {
        return null
    }
}

type Placement = {
    place: number
    team: NonNullable<LeagueMatch["teams"]>[number]
}

/** Captured result layout only; never use list order, vote order or point totals as rank. */
function finalPlacements($: CheerioAPI): Placement[] | null {
    const section = $('main section[aria-labelledby="placements-title"]')
    if (
        section.length !== 1 ||
        section.find("h2#placements-title").length !== 1 ||
        clean(section.find("h2#placements-title").text()) !== "Final placements"
    )
        return null
    const list = section.children("ol")
    const entries = list.children("li")
    if (list.length !== 1 || entries.length < 1 || entries.length > 20)
        return null
    const teamCounts = $("main > header span")
        .toArray()
        .map(
            (element) =>
                /^Match #\d+\s*·\s*.+\s*·\s*(\d{1,2}) teams?$/.exec(
                    clean($(element).text())
                )?.[1]
        )
        .filter((count): count is string => count !== undefined)
    if (teamCounts.length !== 1 || Number(teamCounts[0]) !== entries.length)
        return null
    const rows: Placement[] = []
    const seen = new Set<string>()
    for (const element of entries.toArray()) {
        const link = $(element).children("a[href]")
        const href = link.attr("href") ?? ""
        const code = leagueTeamCode(href)
        const fields = link.children("span")
        const rawPlace = clean(fields.eq(0).text())
        const identity = fields.eq(1)
        const visibleCode = clean(identity.children("span").eq(0).text())
        const name = clean(identity.children("span").eq(1).text())
        const faction = clean(fields.eq(2).text())
        const identityFaction = clean(identity.children("span").eq(2).text())
        if (
            link.length !== 1 ||
            !code ||
            code !== visibleCode ||
            seen.has(code) ||
            !/^(?:[1-9]|1\d|20)$/.test(rawPlace) ||
            !name ||
            !["Valkyra", "Manticore", "Lonestar"].includes(faction) ||
            faction !== identityFaction
        )
            return null
        seen.add(code)
        rows.push({
            place: Number(rawPlace),
            team: {
                code,
                name,
                profileUrl: `https://wardogsleague.net${href}`,
                faction,
                nations: null,
                displayedMemberCount: null,
                readyCheck: null,
            },
        })
    }
    return rows
}

/** Completed pages replace the pre-match line-up with explicit final-placement cards. */
export function parseFinalPlacementTeams($: CheerioAPI): LeagueMatch["teams"] {
    return finalPlacements($)?.map((row) => row.team) ?? null
}

/** Preserve the explicitly published ordinal rule; `pts` is a unit, not another value. */
export function finalPlacementScoringRule($: CheerioAPI): string | null {
    const section = $('main section[aria-labelledby="placements-title"]')
    if (section.length !== 1) return null
    const rule = clean(section.children("div").first().children("span").text())
    return rule ? rule.replace(/\s+pts?\b/g, "") : null
}

/**
 * Finishing places of a completed League match page.
 *
 * Captured final-placement cards supply explicit ranks and team identities.
 * Only observed Confirmed/Set by admin states with matching done progress
 * steps are final. Other states and malformed/ambiguous cards stay unknown.
 * See fixtures/README.md for anonymous source provenance.
 */
export function parseLeagueResults(
    $: CheerioAPI,
    context: Pick<LeagueMatch, "teams" | "progress" | "status">
): { results: LeagueResults | null; warnings: string[] } {
    const unavailable = (warning: string) => ({
        results: null,
        warnings: [warning],
    })
    if (!$('main section[aria-labelledby="placements-title"]').length)
        return unavailable("results_not_supported")
    const rows = finalPlacements($)
    if (!rows) return unavailable("results_invalid_placements")
    const teams = context.teams
    if (
        !teams ||
        teams.length !== rows.length ||
        rows.some((row) => !teams.some((team) => team.code === row.team.code))
    )
        return unavailable("results_team_mismatch")
    const expectedStep =
        context.status === "Confirmed"
            ? "Confirmed"
            : context.status === "Set by admin"
              ? "Set by admin"
              : null
    const placements = context.progress?.filter(
        (step) => step.label === "Placements"
    )
    const confirmation = context.progress?.filter(
        (step) => step.label === expectedStep
    )
    // Admin-set final pages legitimately show 0/3 submissions. Their explicit
    // final step is the authority; submission count never becomes a result.
    if (
        !expectedStep ||
        placements?.length !== 1 ||
        placements[0].state !== "done" ||
        confirmation?.length !== 1 ||
        confirmation[0].state !== "done"
    )
        return unavailable("results_unverified_state")
    return {
        results: {
            placements: rows.map(({ place, team }) => ({
                place,
                teamCode: team.code,
            })),
            confirmed: true,
        },
        warnings: [],
    }
}
