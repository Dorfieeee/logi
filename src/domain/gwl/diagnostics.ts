export type GwlDiagnostic = {
    endpoint: "team" | "fixtures" | "events" | "slots" | "match" | "file"
    status?: number
    format?: "json" | "html" | "text" | "other"
    reason?:
        | "invalid_json"
        | "invalid_shape"
        | "http_error"
        | "empty_body"
        | "too_large"
        | "network"
    fields?: string[]
}
export function gwlEndpoint(path: string): GwlDiagnostic["endpoint"] {
    if (path.includes("/file")) return "file"
    if (path.startsWith("/team/fixtures")) return "fixtures"
    if (path.startsWith("/team/events")) return "events"
    if (path.startsWith("/team/slots")) return "slots"
    if (path.startsWith("/team/matches/")) return "match"
    return "team"
}
// Only schema-owned property names and array indices may appear in diagnostics.
const fields = new Set([
    "slug",
    "name",
    "tag",
    "upcoming",
    "recent",
    "number",
    "status",
    "rated",
    "region",
    "map",
    "layer",
    "weather",
    "season",
    "startsAt",
    "concludedAt",
    "durationSeconds",
    "host",
    "sides",
    "team",
    "faction",
    "score",
    "placement",
    "points",
    "eloDelta",
    "slots",
    "id",
    "seatsFilled",
    "joinedTeam",
    "events",
    "next",
    "hasMore",
    "type",
    "data",
    "startedAt",
    "endedAt",
    "coverage",
    "eventCount",
    "scores",
    "notice",
    "sequence",
    "at",
    "victimSteamId",
    "victimName",
    "victimFaction",
    "killerSteamId",
    "killerName",
    "killerFaction",
    "cause",
    "weaponId",
    "mapName",
    "matchId",
    "distance",
    "eventTime",
    "contextTags",
])
export function gwlDiagnosticPath(path: readonly PropertyKey[]) {
    return (
        path
            .map((part) =>
                typeof part === "number"
                    ? "[]"
                    : fields.has(String(part))
                      ? String(part)
                      : "?"
            )
            .join(".") || "$"
    )
}
