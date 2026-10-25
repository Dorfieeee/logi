import {
    finalPlacementScoringRule,
    leagueTeamCode,
    parseFinalPlacementTeams,
    parseLeagueResults,
} from "./parse-results"
import {
    leagueMatchSchema,
    LeagueError,
    PARSER_VERSION,
    type LeagueMatch,
} from "../../domain/wardogs-league/contracts"
import { matchUrl } from "../../domain/wardogs-league/match-url"
// `cheerio/slim` parses with htmlparser2 only; the full entry would bundle
// parse5, undici and the encoding sniffer into every Convex module that
// imports this parser (ARCHITECTURE.md, "Convex hot paths").
import { load } from "cheerio/slim"
import { z } from "zod"

const clean = (value: string) => value.replace(/\s+/g, " ").trim()
export function parseMatchHtml(html: string, sourceUrl: string): LeagueMatch {
    const source = matchUrl(sourceUrl)
    if (Buffer.byteLength(html, "utf8") > 2 * 1024 * 1024)
        throw new LeagueError("too_large")
    const $ = load(html)
    $(
        "script, style, nav, footer, dialog, form, [role=dialog], [hidden], [aria-hidden=true]"
    ).remove()
    const main = $("main")
    const header = main.children("header")
    const title = clean(header.find("h1").text())
    const direct = (node: typeof main) =>
        clean(
            node
                .contents()
                .filter((_, child) => child.type === "text")
                .text()
        )
    const fixture = header
        .find("span")
        .toArray()
        .map((el) => direct($(el)))
        .map((s) => s.match(/^Fixture #(\d+)\s*·\s*(.+)$/))
        .find(Boolean)
    if (
        main.length !== 1 ||
        header.find("h1").length !== 1 ||
        !title ||
        !fixture
    )
        throw new LeagueError("invalid_html")
    const warnings: string[] = []
    const resultLayout =
        main.find('section[aria-labelledby="placements-title"]').length > 0
    const section = (label: string, warning: string) => {
        const node = main.find(`section[aria-labelledby="${label}"]`)
        if (node.length > 1) throw new LeagueError("invalid_html")
        if (!node.length && !resultLayout) warnings.push(`missing_${warning}`)
        return node
    }
    const lineup = section("lineup-title", "lineup")
    const brief = section("brief-title", "briefing")
    const vote = section("vote-title", "map_vote")
    const rules = section("rules-title", "rules")
    const where = main.find("section#where")
    if (!where.length && !resultLayout) warnings.push("missing_hosting")
    const field = (label: string) =>
        brief
            .find("dt")
            .filter((_, el) => clean($(el).text()) === label)
            .first()
            .next("dd")
    const value = (label: string) => clean(field(label).text()) || null
    const iso = (node: typeof main) => {
        const raw = node.attr("datetime")
        if (!raw || !z.iso.datetime({ offset: true }).safeParse(raw).success)
            return null
        const date = new Date(raw)
        return Number.isFinite(date.getTime()) ? date.toISOString() : null
    }
    const headerTime = iso(header.find("time[datetime]").first())
    const briefTime = iso(field("Time").find("time[datetime]").first())
    const conflict = !!headerTime && !!briefTime && headerTime !== briefTime
    const scheduledAt = conflict ? null : (headerTime ?? briefTime)
    if (conflict) warnings.push("conflicting_match_time")
    else if (!scheduledAt) warnings.push("missing_match_time")
    const status =
        header
            .find("span")
            .toArray()
            .map((el) => direct($(el)))
            .map(
                (s) =>
                    s.match(
                        /^(Scheduled|Live|Completed|Cancelled|Canceled|Disputed|Confirmed|Set by admin|Finished|No.show)(?:\s*·.*)?$/i
                    )?.[1]
            )
            .find(Boolean) ?? null
    if (!["Scheduled", "Confirmed", "Set by admin"].includes(status ?? ""))
        warnings.push("unverified_match_state")
    let teams: LeagueMatch["teams"] = null
    if (lineup.length) {
        teams = []
        const seen = new Set<string>()
        for (const el of lineup.find("ul > li > a[href]").toArray()) {
            const card = $(el)
            const href = card.attr("href") ?? ""
            const code = leagueTeamCode(href)
            if (!code || seen.has(code)) throw new LeagueError("invalid_html")
            seen.add(code)
            const leaves = card
                .find("span")
                .filter((_, node) => $(node).children().length === 0)
            const codeNode = leaves
                .filter((_, node) => clean($(node).text()) === code)
                .first()
            const memberText = leaves
                .toArray()
                .map((node) => clean($(node).text()))
                .find((t) => /^\d[\d,]* members?$/.test(t))
            const nations = card
                .children("span")
                .find("span")
                .filter((_, node) => $(node).children().length === 0)
                .toArray()
                .map((node) => clean($(node).text()))
                .filter((t) => /^[A-Z]{3}$/.test(t))
            const faction =
                card
                    .find("span")
                    .toArray()
                    .map((node) => clean($(node).text()))
                    .find((t) =>
                        ["Valkyra", "Manticore", "Lonestar"].includes(t)
                    ) ?? null
            if (!faction) warnings.push(`missing_faction:${code}`)
            teams.push({
                code,
                name: clean(codeNode.next("span").text()) || null,
                profileUrl: `https://wardogsleague.net${href}`,
                nations: nations.length ? nations : null,
                displayedMemberCount: memberText
                    ? Number(memberText.replace(/[^\d]/g, ""))
                    : null,
                faction,
                readyCheck:
                    leaves
                        .toArray()
                        .map((node) => clean($(node).text()))
                        .find((t) => /^Ready check\b/i.test(t)) ?? null,
            })
        }
        if (!teams.length) {
            teams = null
            warnings.push("missing_team_cards")
        }
    }
    if (!teams && resultLayout) teams = parseFinalPlacementTeams($)
    const choices = (node: typeof main) => {
        const entries = node
            .find("ul > li")
            .toArray()
            .map((el) => {
                const row = $(el).children("div").first()
                const badge = row.children("span[title]").first()
                const teamCode = clean(badge.children("span").first().text())
                return {
                    teamCode,
                    value: clean(badge.next("span").text()) || null,
                }
            })
        if (
            entries.some(
                (e) =>
                    !e.teamCode ||
                    (teams && !teams.some((t) => t.code === e.teamCode))
            ) ||
            new Set(entries.map((e) => e.teamCode)).size !== entries.length
        )
            throw new LeagueError("invalid_html")
        return entries.length ? entries : null
    }
    const progressNodes = main.find('ol[aria-label="Match progress"] > li')
    const progress: LeagueMatch["progress"] = progressNodes.length
        ? progressNodes.toArray().map((el) => {
              const row = $(el),
                  label = row.children("span").first()
              const all = clean(label.text())
              return {
                  label: direct(label),
                  state:
                      row.attr("aria-current") === "step"
                          ? "current"
                          : all.includes("(done)")
                            ? "done"
                            : all.includes("(not started yet)")
                              ? "not_started"
                              : null,
                  detail: clean(label.next("span").text()) || null,
              }
          })
        : null
    if (!progress) warnings.push("missing_progress")
    const host = value("Server")?.match(
        /^(Self-hosted|League-hosted)(?:\s*·\s*([A-Za-z0-9_-]+))?$/
    )
    const requestLink = header.find('a[href^="/matches/requests/"]').first()
    const requestPath = requestLink.attr("href")
    const request =
        requestPath && /^\/matches\/requests\/[A-Za-z0-9_-]+$/.test(requestPath)
            ? {
                  number:
                      Number(
                          clean(requestLink.text()).match(/REQ #(\d+)/)?.[1]
                      ) || null,
                  url: `https://wardogsleague.net${requestPath}`,
              }
            : null
    const placements = parseLeagueResults($, { teams, progress, status })
    warnings.push(...placements.warnings)
    try {
        return leagueMatchSchema.parse({
            id: source.id,
            sourceUrl: source.url,
            parserVersion: PARSER_VERSION,
            title,
            fixtureNumber: Number(fixture[1]),
            type: resultLayout
                ? fixture[2].replace(/\s*·\s*Result$/, "")
                : fixture[2],
            status,
            scheduledAt,
            request,
            teams,
            map: brief.length
                ? {
                      name: value("Map"),
                      zone: value("Zone"),
                      lighting: value("Lighting"),
                  }
                : null,
            hosting: where.length
                ? { mode: host?.[1] ?? null, teamCode: host?.[2] ?? null }
                : null,
            moderator: value("Moderator"),
            mapVote: vote.length
                ? {
                      status:
                          direct(
                              vote
                                  .children("div")
                                  .first()
                                  .children("span")
                                  .first()
                          )
                              .split("·")[0]
                              .trim() || null,
                      closesAt: iso(vote.find("time[datetime]").first()),
                      ballots: choices(vote),
                  }
                : null,
            rules: rules.length
                ? {
                      summary:
                          direct(
                              rules
                                  .children("div")
                                  .first()
                                  .children("span")
                                  .first()
                          ) || null,
                      choices: choices(rules),
                  }
                : null,
            readyCheck:
                progress?.find((step) => step.label === "Ready check")
                    ?.detail ?? null,
            progress,
            scoringRule:
                value("Points") ??
                (resultLayout ? finalPlacementScoringRule($) : null),
            results: placements.results,
            warnings,
        })
    } catch {
        throw new LeagueError("invalid_html")
    }
}
