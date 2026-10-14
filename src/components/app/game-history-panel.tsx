"use client"

import { buildHistoryReport } from "@/application/game-data/history-report"
import type { HistoryPlayer } from "@/domain/game-data/history-report"
import { useEffect, useMemo, useState, type FormEvent } from "react"
import { historyPageSchema } from "@/domain/game-data/history"
import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import { formatKd } from "@/lib/format"

type Loaded = Awaited<ReturnType<typeof buildHistoryReport>>
type Sort = "kills" | "kd" | "cashDelta" | "wins" | "winRate"
const numeric = (value: number | null) =>
    value === null
        ? "—"
        : value.toLocaleString(undefined, { maximumFractionDigits: 2 })
const percent = (value: number | null) =>
    value === null ? "—" : `${(value * 100).toFixed(1)}%`
const time = (value: string | null) =>
    value === null
        ? "—"
        : new Date(value).toLocaleString(undefined, {
              timeZone: "Europe/Prague",
          })

export function GameHistoryPanel({
    serverId,
    dictionary,
}: {
    serverId: string
    dictionary: Dictionary
}) {
    const t = dictionary.gameHistory
    const [filters, setFilters] = useState({
        days: "30",
        map: "",
        sourceId: "",
        minMinutes: 60,
    })
    const [refresh, setRefresh] = useState(0),
        [loading, setLoading] = useState(true),
        [failed, setFailed] = useState(false)
    const [loaded, setLoaded] = useState<Loaded | null>(null)
    const [sources, setSources] = useState<
        Array<{ id: string; label: string }>
    >([])
    const [sort, setSort] = useState<Sort>("kills"),
        [playerPage, setPlayerPage] = useState(0),
        [gamePage, setGamePage] = useState(0)
    useEffect(() => {
        const controller = new AbortController()
        async function load() {
            setLoading(true)
            setFailed(false)
            setLoaded(null)
            setPlayerPage(0)
            setGamePage(0)
            const query = new URLSearchParams({ game: "wardogs" })
            if (filters.days !== "all")
                query.set(
                    "from",
                    new Date(
                        Date.now() - Number(filters.days) * 86_400_000
                    ).toISOString()
                )
            if (filters.map) query.set("map", filters.map)
            if (filters.sourceId) query.set("sourceId", filters.sourceId)
            try {
                const data = await buildHistoryReport(
                    async (cursor) => {
                        const page = new URLSearchParams(query)
                        if (cursor) page.set("cursor", cursor)
                        const response = await fetch(
                            `/api/servers/${encodeURIComponent(serverId)}/game-history?${page}`,
                            { cache: "no-store", signal: controller.signal }
                        )
                        if (!response.ok) throw new Error("History unavailable")
                        return historyPageSchema.parse(
                            (await response.json()).data
                        )
                    },
                    {
                        signal: controller.signal,
                        minMinutes: filters.minMinutes,
                    }
                )
                if (!controller.signal.aborted) {
                    setLoaded(data)
                    setSources((previous) => [
                        ...new Map(
                            [
                                ...previous,
                                ...data.records.map((record) => ({
                                    id: record.sourceId,
                                    label:
                                        record.serverName ??
                                        record.sourceId.slice(0, 12),
                                })),
                            ].map((source) => [source.id, source])
                        ).values(),
                    ])
                }
            } catch {
                if (!controller.signal.aborted) setFailed(true)
            } finally {
                if (!controller.signal.aborted) setLoading(false)
            }
        }
        void load()
        return () => controller.abort()
    }, [serverId, filters, refresh])
    function apply(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        setFilters({
            days: String(form.get("days")),
            map: String(form.get("map") ?? "").trim(),
            sourceId: String(form.get("sourceId") ?? ""),
            minMinutes: Number(form.get("minMinutes")),
        })
        setRefresh((value) => value + 1)
    }
    const players = useMemo(() => {
        const value = (p: HistoryPlayer) =>
            sort === "kills" || sort === "cashDelta"
                ? p.metrics[sort].value
                : p[sort]
        return (loaded?.report.players ?? [])
            .filter((p) => p.eligible)
            .sort((a, b) => {
                const av = value(a),
                    bv = value(b)
                return av === null
                    ? bv === null
                        ? a.platformId.localeCompare(b.platformId)
                        : 1
                    : bv === null
                      ? -1
                      : bv - av || a.platformId.localeCompare(b.platformId)
            })
    }, [loaded, sort])
    const records = useMemo(
        () =>
            [...(loaded?.records ?? [])].sort(
                (a, b) =>
                    b.session.endedAt!.localeCompare(a.session.endedAt!) ||
                    a.id.localeCompare(b.id)
            ),
        [loaded]
    )
    const report = loaded?.report
    const field = "bg-background rounded-md border px-3 py-2 text-sm"
    return (
        <section
            aria-label={t.title}
            className="space-y-5 rounded-xl border p-5"
        >
            <div>
                <h3 className="text-lg font-semibold">{t.title}</h3>
                <p className="text-muted-foreground mt-1 text-sm">
                    {t.description}
                </p>
            </div>
            <form
                onSubmit={apply}
                className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
            >
                <label className="flex flex-col gap-1 text-sm">
                    {t.period}
                    <select name="days" defaultValue="30" className={field}>
                        <option value="7">{t.week}</option>
                        <option value="30">{t.month}</option>
                        <option value="90">{t.quarter}</option>
                        <option value="all">{t.all}</option>
                    </select>
                </label>
                <label className="flex flex-col gap-1 text-sm">
                    {t.source}
                    <select name="sourceId" className={field}>
                        <option value="">{t.allSources}</option>
                        {sources.map((source) => (
                            <option key={source.id} value={source.id}>
                                {source.label}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="flex flex-col gap-1 text-sm">
                    {t.map}
                    <input name="map" maxLength={200} className={field} />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                    {t.minimum}
                    <input
                        name="minMinutes"
                        type="number"
                        min={0}
                        max={100000}
                        step={1}
                        defaultValue={60}
                        required
                        className={field}
                    />
                </label>
                <Button
                    type="submit"
                    variant="outline"
                    disabled={loading}
                    className="sm:col-span-2 xl:col-span-4"
                >
                    {loading ? t.loading : t.load}
                </Button>
            </form>
            {failed && (
                <p role="alert" className="text-destructive text-sm">
                    {t.error}
                </p>
            )}
            <div aria-busy={loading} aria-live="polite">
                {loading && (
                    <p className="text-muted-foreground text-sm">{t.loading}</p>
                )}
            </div>
            {report && (
                <>
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                        {(
                            ["games", "decided", "draw", "no_result"] as const
                        ).map((key) => (
                            <div
                                key={key}
                                className="bg-muted/40 rounded-lg border p-4"
                            >
                                <p className="text-muted-foreground text-xs">
                                    {t[key]}
                                </p>
                                <p className="mt-1 text-3xl font-semibold tabular-nums">
                                    {key === "games"
                                        ? report.games
                                        : report.outcomes[key]}
                                </p>
                            </div>
                        ))}
                    </div>
                    <div className="text-muted-foreground space-y-1 text-xs">
                        <p>
                            {t.coverage}: {time(report.firstEndedAt)} —{" "}
                            {time(report.lastEndedAt)} · Europe/Prague
                        </p>
                        <p>
                            {t.lastCollected}: {time(loaded.lastCollectedAt)} ·{" "}
                            {t.feed}: {report.feedGames}/{report.games}
                        </p>
                        <p>{t.retentionHelp}</p>
                    </div>
                    {report.games === 0 ? (
                        <p className="rounded-lg border p-4 text-sm">
                            {t.empty}
                        </p>
                    ) : (
                        <>
                            <div className="space-y-3">
                                <h4 className="font-semibold">{t.factions}</h4>
                                <div className="grid gap-3 md:grid-cols-3">
                                    {report.factions.map((faction) => (
                                        <div
                                            key={faction.name}
                                            className="rounded-lg border p-4"
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="font-medium">
                                                    <span
                                                        aria-hidden="true"
                                                        className="mr-2 inline-block h-3 w-3 rounded-full"
                                                        style={{
                                                            backgroundColor:
                                                                faction.colorHex ??
                                                                "#888888",
                                                        }}
                                                    />
                                                    {faction.name}
                                                </span>
                                                <span className="font-mono text-xl">
                                                    {faction.wins}
                                                </span>
                                            </div>
                                            <div className="bg-muted my-3 h-2 overflow-hidden rounded-full">
                                                <div
                                                    className="h-full"
                                                    style={{
                                                        width: `${(faction.winShare ?? 0) * 100}%`,
                                                        backgroundColor:
                                                            faction.colorHex ??
                                                            "#888888",
                                                    }}
                                                />
                                            </div>
                                            <p className="text-muted-foreground text-xs">
                                                {t.share}:{" "}
                                                {percent(faction.winShare)}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <h4 className="font-semibold">
                                        {t.players} · {players.length}
                                    </h4>
                                    <label className="flex items-center gap-2 text-sm">
                                        {t.sort}
                                        <select
                                            value={sort}
                                            className={field}
                                            onChange={(event) => {
                                                setSort(
                                                    event.target.value as Sort
                                                )
                                                setPlayerPage(0)
                                            }}
                                        >
                                            {(
                                                [
                                                    "kills",
                                                    "kd",
                                                    "cashDelta",
                                                    "wins",
                                                    "winRate",
                                                ] as const
                                            ).map((key) => (
                                                <option key={key} value={key}>
                                                    {
                                                        t[
                                                            key === "cashDelta"
                                                                ? "cash"
                                                                : key
                                                        ]
                                                    }
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                </div>
                                <p className="text-muted-foreground text-xs">
                                    {t.ratioHelp}
                                </p>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <caption className="sr-only">
                                            {t.players}
                                        </caption>
                                        <thead>
                                            <tr className="border-b">
                                                {[
                                                    "#",
                                                    t.player,
                                                    t.matches,
                                                    t.kills,
                                                    t.kd,
                                                    t.cash,
                                                    t.wins,
                                                    t.winRate,
                                                ].map((label) => (
                                                    <th
                                                        key={label}
                                                        className="p-2 whitespace-nowrap"
                                                    >
                                                        {label}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {players
                                                .slice(
                                                    playerPage * 20,
                                                    playerPage * 20 + 20
                                                )
                                                .map((player, index) => (
                                                    <tr
                                                        key={`${player.platform}:${player.platformId}`}
                                                        className="border-b"
                                                    >
                                                        <td className="p-2">
                                                            {playerPage * 20 +
                                                                index +
                                                                1}
                                                        </td>
                                                        <th
                                                            scope="row"
                                                            className="max-w-56 p-2 font-medium break-words"
                                                        >
                                                            {player.name ??
                                                                t.unavailable}
                                                        </th>
                                                        <td className="p-2">
                                                            {player.matches}
                                                        </td>
                                                        <td className="p-2 tabular-nums">
                                                            {numeric(
                                                                player.metrics
                                                                    .kills.value
                                                            )}{" "}
                                                            <small className="text-muted-foreground">
                                                                (
                                                                {
                                                                    player
                                                                        .metrics
                                                                        .kills
                                                                        .knownGames
                                                                }
                                                                /
                                                                {player.matches}
                                                                )
                                                            </small>
                                                        </td>
                                                        <td className="p-2 tabular-nums">
                                                            {player.kd === null
                                                                ? "—"
                                                                : formatKd(
                                                                      player.kd
                                                                  )}
                                                        </td>
                                                        <td className="p-2 tabular-nums">
                                                            {numeric(
                                                                player.metrics
                                                                    .cashDelta
                                                                    .value
                                                            )}{" "}
                                                            <small className="text-muted-foreground">
                                                                (
                                                                {
                                                                    player
                                                                        .metrics
                                                                        .cashDelta
                                                                        .knownGames
                                                                }
                                                                /
                                                                {player.matches}
                                                                )
                                                            </small>
                                                        </td>
                                                        <td className="p-2">
                                                            {player.wins}
                                                        </td>
                                                        <td className="p-2">
                                                            {percent(
                                                                player.winRate
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="flex justify-end gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={playerPage === 0}
                                        onClick={() =>
                                            setPlayerPage((page) => page - 1)
                                        }
                                    >
                                        {t.previous}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={
                                            (playerPage + 1) * 20 >=
                                            players.length
                                        }
                                        onClick={() =>
                                            setPlayerPage((page) => page + 1)
                                        }
                                    >
                                        {t.next}
                                    </Button>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <h4 className="font-semibold">{t.history}</h4>
                                {records
                                    .slice(gamePage * 10, gamePage * 10 + 10)
                                    .map((record) => (
                                        <details
                                            key={record.id}
                                            className="rounded-lg border p-3"
                                        >
                                            <summary className="cursor-pointer text-sm">
                                                <strong>
                                                    {record.session.map ??
                                                        t.unavailable}
                                                </strong>{" "}
                                                ·{" "}
                                                {record.serverName ??
                                                    record.sourceId.slice(
                                                        0,
                                                        12
                                                    )}{" "}
                                                · {time(record.session.endedAt)}{" "}
                                                ·{" "}
                                                {record.session.warcon!
                                                    .winner ??
                                                    t[
                                                        record.session.warcon!
                                                            .outcome
                                                    ]}
                                            </summary>
                                            <p className="my-3 text-sm">
                                                {record.session.participants
                                                    .map(
                                                        (side) =>
                                                            `${side.label}: ${numeric(side.score)}`
                                                    )
                                                    .join(" · ")}
                                            </p>
                                            <div className="max-h-80 overflow-auto">
                                                <table className="w-full text-left text-sm">
                                                    <caption className="sr-only">
                                                        {t.details}
                                                    </caption>
                                                    <thead>
                                                        <tr>
                                                            {[
                                                                t.player,
                                                                t.faction,
                                                                t.kills,
                                                                t.deaths,
                                                                t.cash,
                                                            ].map((label) => (
                                                                <th
                                                                    key={label}
                                                                    className="p-2"
                                                                >
                                                                    {label}
                                                                </th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {record.session.players.map(
                                                            (player) => (
                                                                <tr
                                                                    key={`${player.platform}:${player.platformId}`}
                                                                    className="border-t"
                                                                >
                                                                    <th
                                                                        scope="row"
                                                                        className="p-2 font-medium"
                                                                    >
                                                                        {player.name ??
                                                                            t.unavailable}
                                                                    </th>
                                                                    <td className="p-2">
                                                                        {player.faction ??
                                                                            "—"}
                                                                    </td>
                                                                    <td className="p-2">
                                                                        {numeric(
                                                                            player
                                                                                .metrics
                                                                                .kills ??
                                                                                null
                                                                        )}
                                                                    </td>
                                                                    <td className="p-2">
                                                                        {numeric(
                                                                            player
                                                                                .metrics
                                                                                .deaths ??
                                                                                null
                                                                        )}
                                                                    </td>
                                                                    <td className="p-2">
                                                                        {numeric(
                                                                            player
                                                                                .metrics
                                                                                .cashDelta ??
                                                                                null
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            )
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </details>
                                    ))}
                                <div className="flex justify-end gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={gamePage === 0}
                                        onClick={() =>
                                            setGamePage((page) => page - 1)
                                        }
                                    >
                                        {t.previous}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={
                                            (gamePage + 1) * 10 >=
                                            records.length
                                        }
                                        onClick={() =>
                                            setGamePage((page) => page + 1)
                                        }
                                    >
                                        {t.next}
                                    </Button>
                                </div>
                            </div>
                        </>
                    )}
                </>
            )}
        </section>
    )
}
