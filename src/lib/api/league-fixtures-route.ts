import { DEFAULT_LEAGUE_PANEL_OPTIONS } from "@/domain/wardogs-league/panels"
import { PANEL_WINDOW } from "@/domain/wardogs-league/all-fixtures"

/**
 * `GET /api/v1/clan/league-fixtures/overview?game=wardogs[&limit=1–10]`:
 * the WD League panels' data. `limit` is the number of nearest fixtures,
 * defaulting to the panel's six.
 */
export function parseLeagueOverviewQuery(request: Request) {
    const params = new URL(request.url).searchParams
    if (
        params.getAll("game").length !== 1 ||
        params.get("game") !== "wardogs" ||
        [...params.keys()].some((k) => !["game", "limit"].includes(k)) ||
        params.getAll("limit").length > 1
    )
        return null
    const raw =
        params.get("limit") ?? String(DEFAULT_LEAGUE_PANEL_OPTIONS.fixtureCount)
    if (!/^\d{1,2}$/.test(raw) || Number(raw) < 1 || Number(raw) > PANEL_WINDOW)
        return null
    return { limit: Number(raw) }
}

export function parseLeagueFixtureQuery(request: Request) {
    const params = new URL(request.url).searchParams
    if (
        params.getAll("game").length !== 1 ||
        params.get("game") !== "wardogs" ||
        [...params.keys()].some(
            (k) => !["game", "cursor", "limit", "provider"].includes(k)
        ) ||
        params.getAll("provider").length > 1 ||
        (params.has("provider") && params.get("provider") !== "gwl") ||
        params.getAll("cursor").length > 1 ||
        params.getAll("limit").length > 1
    )
        return null
    const raw = params.get("limit") ?? "50",
        cursor = params.get("cursor")
    if (
        !/^\d{1,3}$/.test(raw) ||
        Number(raw) < 1 ||
        Number(raw) > 100 ||
        (cursor !== null && (!cursor || cursor.length > 4096))
    )
        return null
    return {
        cursor,
        limit: Number(raw),
        ...(params.get("provider") === "gwl"
            ? { provider: "gwl" as const }
            : {}),
    }
}
