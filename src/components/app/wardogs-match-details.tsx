"use client"

import {
    Bar,
    BarChart,
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { WardogsMatchReport } from "@/domain/match-reports/wardogs"
import { formatDateTime, formatKd } from "@/lib/format"
import type { Dictionary } from "@/i18n/dictionaries"
import { Input } from "@/components/ui/input"
import { useMemo, useState } from "react"
import Link from "next/link"

const colors = ["#ec4899", "#f59e0b", "#3b82f6", "#10b981"]
export function WardogsMatchDetails({
    report,
    dictionary,
    locale,
    timezone = "UTC",
}: {
    report: WardogsMatchReport
    dictionary: Dictionary
    locale: string
    timezone?: string
}) {
    const t = dictionary.wardogsMatchDetails
    const [search, setSearch] = useState("")
    const [faction, setFaction] = useState("")
    const number = useMemo(
        () => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }),
        [locale]
    )
    const value = (v: number | null) =>
        v === null ? dictionary.common.notAvailable : number.format(v)
    const sum = (
        players: WardogsMatchReport["players"],
        key: "kills" | "deaths" | "money"
    ) =>
        players.length && players.every((p) => p[key] !== null)
            ? players.reduce((total, p) => total + (p[key] ?? 0), 0)
            : null
    const factions = [
        ...new Map(
            [
                ...report.sides.map((side) => side.faction),
                ...report.players.flatMap((player) =>
                    player.faction ? [player.faction] : []
                ),
            ].map((name) => [name.toLowerCase(), name])
        ).values(),
    ]
    const byFaction = factions.map((name) => {
        const players = report.players.filter(
            (p) => p.faction?.toLowerCase() === name.toLowerCase()
        )
        return {
            name,
            kills: sum(players, "kills"),
            deaths: sum(players, "deaths"),
            money: sum(players, "money"),
        }
    })
    const players = report.players.filter(
        (player) =>
            (!faction ||
                player.faction?.toLowerCase() === faction.toLowerCase()) &&
            player.name.toLowerCase().includes(search.trim().toLowerCase())
    )
    const tooltip = (v: unknown, key: unknown) => [
        typeof v === "number"
            ? number.format(v)
            : dictionary.common.notAvailable,
        String(key),
    ]
    const killFeed = report.killFeed ?? []
    const minute = (seconds: number) =>
        `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`
    const killActivity = [
        ...new Map(
            killFeed.map((kill) => [Math.floor(kill.eventTime / 60), 0])
        ).keys(),
    ]
        .sort((a, b) => a - b)
        .map((minute) => ({
            minute,
            kills: killFeed.filter(
                (kill) => Math.floor(kill.eventTime / 60) === minute
            ).length,
        }))
    const killCauses = [
        ...killFeed.reduce((causes, kill) => {
            const cause = kill.cause ?? dictionary.common.notAvailable
            causes.set(cause, (causes.get(cause) ?? 0) + 1)
            return causes
        }, new Map<string, number>()),
    ]
        .map(([name, kills]) => ({ name, kills }))
        .sort((a, b) => b.kills - a.kills)
    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>{report.name}</CardTitle>
                    <p className="text-muted-foreground text-sm">
                        {report.rounds
                            .map(
                                (round) => round.map ?? dictionary.shared.notSet
                            )
                            .join(" / ")}
                        {report.endedAt
                            ? ` · ${formatDateTime(report.endedAt, timezone, locale)}`
                            : ""}
                    </p>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-4">
                    {[...report.sides]
                        .sort((a, b) => Number(b.ours) - Number(a.ours))
                        .map((side) => (
                            <div
                                key={side.id}
                                className="bg-muted/50 flex min-w-40 items-center gap-3 rounded-xl p-4"
                            >
                                {side.logoUrl ? (
                                    <img
                                        src={side.logoUrl}
                                        alt=""
                                        className="size-10 object-contain"
                                    />
                                ) : null}
                                <div>
                                    <p className="font-semibold">{side.name}</p>
                                    <p className="text-muted-foreground text-xs">
                                        {side.faction}
                                        {side.ours ? ` · ${t.ourTeam}` : ""}
                                    </p>
                                </div>
                                <span className="ml-auto text-3xl font-bold tabular-nums">
                                    {value(side.score)}
                                </span>
                            </div>
                        ))}
                </CardContent>
            </Card>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {[
                    [t.players, number.format(report.players.length)],
                    [
                        dictionary.gameHistory.kills,
                        value(sum(report.players, "kills")),
                    ],
                    [
                        dictionary.gameHistory.deaths,
                        value(sum(report.players, "deaths")),
                    ],
                    [
                        dictionary.gameHistory.cash,
                        value(sum(report.players, "money")),
                    ],
                ].map(([label, number]) => (
                    <Card key={label}>
                        <CardContent className="pt-6">
                            <p className="text-muted-foreground text-sm">
                                {label}
                            </p>
                            <p className="text-2xl font-semibold tabular-nums">
                                {number}
                            </p>
                        </CardContent>
                    </Card>
                ))}
            </div>
            {report.rounds.map((round, index) => (
                <Card key={index}>
                    <CardHeader>
                        <CardTitle>
                            {t.scoreTimeline}
                            {report.rounds.length > 1
                                ? ` · ${round.map ?? index + 1}`
                                : ""}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {round.timeline.length ? (
                            <div className="h-72" aria-label={t.scoreTimeline}>
                                <ResponsiveContainer>
                                    <LineChart
                                        data={round.timeline.map((point) => ({
                                            minute: point[0]! / 60,
                                            ...Object.fromEntries(
                                                round.factions.map((_, i) => [
                                                    `f${i}`,
                                                    point[i + 1],
                                                ])
                                            ),
                                        }))}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis
                                            dataKey="minute"
                                            name={t.minutes}
                                            tickFormatter={(n) =>
                                                minute(Number(n) * 60)
                                            }
                                        />
                                        <YAxis />
                                        <Tooltip
                                            formatter={tooltip}
                                            labelFormatter={(n) =>
                                                minute(Number(n) * 60)
                                            }
                                        />
                                        <Legend />
                                        {round.factions.map((name, i) => (
                                            <Line
                                                key={name}
                                                dataKey={`f${i}`}
                                                name={name}
                                                stroke={
                                                    colors[i % colors.length]
                                                }
                                                dot={false}
                                                type="stepAfter"
                                                strokeWidth={2}
                                            />
                                        ))}
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <p className="text-muted-foreground text-sm">
                                {t.noTimeline}
                            </p>
                        )}
                    </CardContent>
                </Card>
            ))}
            <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>{t.factionCombat}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-72">
                            <ResponsiveContainer>
                                <BarChart data={byFaction}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <Tooltip formatter={tooltip} />
                                    <Legend />
                                    <Bar
                                        dataKey="kills"
                                        name={dictionary.gameHistory.kills}
                                        fill="#10b981"
                                    />
                                    <Bar
                                        dataKey="deaths"
                                        name={dictionary.gameHistory.deaths}
                                        fill="#f43f5e"
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>{t.factionMoney}</CardTitle>
                        <p className="text-muted-foreground text-sm">
                            {dictionary.gameHistory.cashHelp}
                        </p>
                    </CardHeader>
                    <CardContent>
                        <div className="h-72">
                            <ResponsiveContainer>
                                <BarChart data={byFaction}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis
                                        tickFormatter={(n) =>
                                            number.format(Number(n))
                                        }
                                    />
                                    <Tooltip formatter={tooltip} />
                                    <Bar
                                        dataKey="money"
                                        name={dictionary.gameHistory.cash}
                                        fill="#f59e0b"
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>
            {killFeed.length ? (
                <div className="grid gap-6 lg:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>{t.killActivity}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="h-64">
                                <ResponsiveContainer>
                                    <BarChart data={killActivity}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis
                                            dataKey="minute"
                                            tickFormatter={(value) =>
                                                `${value}m`
                                            }
                                        />
                                        <YAxis allowDecimals={false} />
                                        <Tooltip
                                            formatter={tooltip}
                                            labelFormatter={(value) =>
                                                `${value}m`
                                            }
                                        />
                                        <Bar
                                            dataKey="kills"
                                            name={dictionary.gameHistory.kills}
                                            fill="#ec4899"
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>{t.killCauses}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="h-64">
                                <ResponsiveContainer>
                                    <BarChart
                                        data={killCauses.slice(0, 12)}
                                        layout="vertical"
                                    >
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis
                                            type="number"
                                            allowDecimals={false}
                                        />
                                        <YAxis
                                            type="category"
                                            dataKey="name"
                                            width={100}
                                        />
                                        <Tooltip formatter={tooltip} />
                                        <Bar
                                            dataKey="kills"
                                            name={dictionary.gameHistory.kills}
                                            fill="#3b82f6"
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            ) : report.killFeed ? (
                <p className="text-muted-foreground text-sm">{t.noFeed}</p>
            ) : null}
            {killFeed.length ? (
                <Card>
                    <CardHeader>
                        <CardTitle>{t.killFeed}</CardTitle>
                    </CardHeader>
                    <CardContent className="max-h-[32rem] overflow-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr>
                                    {[
                                        t.time,
                                        t.killer,
                                        t.victim,
                                        t.cause,
                                        t.distance,
                                        t.headshot,
                                    ].map((label) => (
                                        <th
                                            key={label}
                                            className="border-b px-3 py-2"
                                        >
                                            {label}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {killFeed.map((kill) => (
                                    <tr key={kill.eventId}>
                                        <td className="border-b px-3 py-2 tabular-nums">
                                            {minute(kill.eventTime)}
                                        </td>
                                        <td className="border-b px-3 py-2">
                                            {kill.killer?.name ??
                                                dictionary.common.notAvailable}
                                        </td>
                                        <td className="border-b px-3 py-2">
                                            {kill.victim.name}
                                        </td>
                                        <td className="border-b px-3 py-2">
                                            {kill.cause ??
                                                dictionary.common.notAvailable}
                                        </td>
                                        <td className="border-b px-3 py-2 tabular-nums">
                                            {kill.distanceM === null
                                                ? dictionary.common.notAvailable
                                                : number.format(kill.distanceM)}
                                        </td>
                                        <td className="border-b px-3 py-2">
                                            {kill.headshot ? "✓" : ""}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </CardContent>
                </Card>
            ) : null}
            <Card>
                <CardHeader>
                    <CardTitle>{t.players}</CardTitle>
                    <div className="flex flex-wrap gap-3">
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={t.search}
                            aria-label={t.search}
                            className="max-w-sm"
                        />
                        <select
                            value={faction}
                            onChange={(e) => setFaction(e.target.value)}
                            aria-label={dictionary.gameHistory.faction}
                            className="bg-background rounded-md border px-3 py-2 text-sm"
                        >
                            <option value="">{t.allFactions}</option>
                            {factions.map((name) => (
                                <option key={name} value={name}>
                                    {name}
                                </option>
                            ))}
                        </select>
                    </div>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <caption className="sr-only">{t.players}</caption>
                        <thead>
                            <tr>
                                {[
                                    dictionary.gameHistory.player,
                                    dictionary.gameHistory.faction,
                                    dictionary.gameHistory.kills,
                                    dictionary.gameHistory.deaths,
                                    dictionary.clan.kd,
                                    dictionary.gameHistory.cash,
                                    t.minutes,
                                ].map((label) => (
                                    <th
                                        key={label}
                                        scope="col"
                                        className="border-b px-3 py-2"
                                    >
                                        {label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {players.map((player) => (
                                <tr
                                    key={player.id}
                                    className="hover:bg-muted/50"
                                >
                                    <td className="border-b px-3 py-3">
                                        {player.profileId ? (
                                            <Link
                                                className="text-primary hover:underline"
                                                href={`/${locale}/players/${encodeURIComponent(player.profileId)}/matches/${encodeURIComponent(report.eventId)}`}
                                            >
                                                {player.name}
                                            </Link>
                                        ) : (
                                            player.name
                                        )}
                                    </td>
                                    <td className="border-b px-3 py-3">
                                        {player.faction ??
                                            dictionary.common.notAvailable}
                                    </td>
                                    {[
                                        value(player.kills),
                                        value(player.deaths),
                                        player.kd === null
                                            ? dictionary.common.notAvailable
                                            : formatKd(player.kd, locale),
                                        value(player.money),
                                        value(
                                            player.seconds === null
                                                ? null
                                                : player.seconds / 60
                                        ),
                                    ].map((v, i) => (
                                        <td
                                            key={i}
                                            className="border-b px-3 py-3 tabular-nums"
                                        >
                                            {v}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {!players.length ? (
                        <p className="text-muted-foreground py-4 text-sm">
                            {t.noPlayers}
                        </p>
                    ) : null}
                </CardContent>
            </Card>
        </div>
    )
}
