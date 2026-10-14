import type { WardogsMatchReport } from "@/domain/match-reports/wardogs"
import type { Dictionary } from "@/i18n/dictionaries"

/** Satori-compatible graphic shared by match previews and personal recap DMs. */
export function WardogsMatchImage({
    report,
    dictionary,
    locale,
    playerId,
    previous = [],
}: {
    report: WardogsMatchReport
    dictionary: Dictionary
    locale: string
    playerId?: string
    previous?: readonly {
        kills: number
        deaths: number
        cashDelta?: number | null
    }[]
}) {
    const player = playerId
        ? report.players.find((row) => row.profileId === playerId)
        : undefined
    const rows = player
        ? [player]
        : report.sides.map((side) => {
              const players = report.players.filter(
                  (row) =>
                      row.faction?.toLowerCase() === side.faction.toLowerCase()
              )
              const total = (field: "kills" | "deaths" | "money") =>
                  players.length && players.every((row) => row[field] !== null)
                      ? players.reduce((sum, row) => sum + row[field]!, 0)
                      : null
              return {
                  name: side.name,
                  kills: total("kills"),
                  deaths: total("deaths"),
                  money: total("money"),
              }
          })
    const metrics = [
        {
            field: "kills",
            label: dictionary.gameHistory.kills,
            color: "#25a35a",
        },
        {
            field: "deaths",
            label: dictionary.gameHistory.deaths,
            color: "#cf4d45",
        },
        {
            field: "money",
            label: dictionary.gameHistory.cash,
            color: "#d5a44b",
        },
    ] as const
    const number = (value: number | null) =>
        value === null ? "—" : value.toLocaleString(locale)
    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                width: "100%",
                height: "100%",
                padding: 48,
                background: "#17140f",
                color: "#f7f3ed",
                fontFamily: "sans-serif",
            }}
        >
            <div style={{ display: "flex", color: "#d5a44b", fontSize: 22 }}>
                LOGI · WARDOGS
            </div>
            <div
                style={{
                    display: "flex",
                    fontSize: 42,
                    fontWeight: 700,
                    marginTop: 16,
                }}
            >
                {(player?.name ?? report.name).slice(0, 48)}
            </div>
            <div
                style={{
                    display: "flex",
                    color: "#aaa397",
                    fontSize: 22,
                    marginTop: 10,
                }}
            >
                {player
                    ? report.name.slice(0, 58)
                    : report.rounds
                          .map((round) => round.map)
                          .filter(Boolean)
                          .join(" · ")}
            </div>
            <div
                style={{
                    display: "flex",
                    gap: 28,
                    marginTop: 22,
                    fontSize: 24,
                }}
            >
                {report.sides.map((side) => (
                    <div key={side.id} style={{ display: "flex", gap: 12 }}>
                        <span>{side.name.slice(0, 22)}</span>
                        <span style={{ color: "#d5a44b" }}>
                            {number(side.score)}
                        </span>
                    </div>
                ))}
            </div>
            <div style={{ display: "flex", gap: 26, marginTop: 32, flex: 1 }}>
                {metrics.map((metric) => {
                    const history = player
                        ? [...previous.slice(0, 10)]
                              .reverse()
                              .map((row) =>
                                  metric.field === "money"
                                      ? (row.cashDelta ?? null)
                                      : row[metric.field]
                              )
                              .concat(player[metric.field])
                        : []
                    const maximum = Math.max(
                        1,
                        ...rows.map((row) => Math.abs(row[metric.field] ?? 0)),
                        ...history.map((value) => Math.abs(value ?? 0))
                    )
                    return (
                        <div
                            key={metric.field}
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                flex: 1,
                                gap: 7,
                                padding: 16,
                                background: "#211d17",
                                borderRadius: 14,
                            }}
                        >
                            <div
                                style={{
                                    display: "flex",
                                    fontSize: 24,
                                    color: metric.color,
                                }}
                            >
                                {metric.label}
                            </div>
                            {rows.map((row, index) => (
                                <div
                                    key={index}
                                    style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 4,
                                        marginTop: 4,
                                    }}
                                >
                                    {!player && (
                                        <div
                                            style={{
                                                display: "flex",
                                                fontSize: 17,
                                                color: "#aaa397",
                                            }}
                                        >
                                            {row.name.slice(0, 24)}
                                        </div>
                                    )}
                                    <div
                                        style={{
                                            display: "flex",
                                            fontSize: player ? 48 : 22,
                                        }}
                                    >
                                        {number(row[metric.field])}
                                    </div>
                                    {!player && (
                                        <div
                                            style={{
                                                display: "flex",
                                                width: "100%",
                                                height: 8,
                                                background: "#393329",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    display: "flex",
                                                    width: `${(Math.abs(row[metric.field] ?? 0) / maximum) * 100}%`,
                                                    height: 8,
                                                    background: metric.color,
                                                }}
                                            />
                                        </div>
                                    )}
                                </div>
                            ))}
                            {player && (
                                <div
                                    style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 8,
                                        marginTop: "auto",
                                    }}
                                >
                                    <div
                                        style={{
                                            display: "flex",
                                            fontSize: 16,
                                            color: "#aaa397",
                                        }}
                                    >
                                        {dictionary.publicProfiles.matchHistory}
                                    </div>
                                    <div
                                        style={{
                                            display: "flex",
                                            height: 90,
                                            gap: 7,
                                            alignItems: "flex-end",
                                        }}
                                    >
                                        {history.map((value, index) => (
                                            <div
                                                key={index}
                                                style={{
                                                    display: "flex",
                                                    flex: 1,
                                                    height:
                                                        value === null
                                                            ? 2
                                                            : Math.max(
                                                                  2,
                                                                  (Math.abs(
                                                                      value
                                                                  ) /
                                                                      maximum) *
                                                                      90
                                                              ),
                                                    background:
                                                        value === null
                                                            ? "#655f55"
                                                            : value < 0
                                                              ? "#cf4d45"
                                                              : metric.color,
                                                    opacity:
                                                        index ===
                                                        history.length - 1
                                                            ? 1
                                                            : 0.55,
                                                }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                            {player && metric.field === "kills" && (
                                <div
                                    style={{
                                        display: "flex",
                                        fontSize: 24,
                                        marginTop: 12,
                                    }}
                                >
                                    K/D ·{" "}
                                    {player.kd === null
                                        ? "—"
                                        : player.kd.toFixed(2)}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
