"use client"

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import type { Dictionary } from "@/i18n/dictionaries"
import { ArrowDown, ArrowUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { gameLabel } from "@/domain/games/game"
import { Input } from "@/components/ui/input"
import { useMemo, useState } from "react"
import { formatKd } from "@/lib/format"
import Link from "next/link"

export type PlayerScoreRow = {
    id: string
    name: string
    group: string
    game: string
    score: number
    matches: number
    kills: number | null
    deaths: number | null
    kd: number | null
    combat: number | null
    support: number | null
    cash: number | null
    href: string
}
type SortKey =
    | "name"
    | "score"
    | "matches"
    | "kills"
    | "deaths"
    | "kd"
    | "combat"
    | "support"
    | "cash"

export function PlayerScoresTable({
    rows,
    dictionary,
    locale,
}: {
    rows: PlayerScoreRow[]
    dictionary: Dictionary
    locale: string
}) {
    const [search, setSearch] = useState("")
    const [group, setGroup] = useState("all")
    const [sort, setSort] = useState<SortKey>("score")
    const [ascending, setAscending] = useState(false)
    const [limit, setLimit] = useState(50)
    const labels = dictionary.roster
    const columns: { key: SortKey; label: string }[] = [
        { key: "name", label: labels.sortName },
        { key: "score", label: labels.sortScore },
        { key: "matches", label: labels.matchesLabel },
        { key: "kd", label: labels.sortKd },
        { key: "kills", label: labels.killsLabel },
        { key: "deaths", label: labels.deathsLabel },
        { key: "combat", label: labels.combatLabel },
        { key: "support", label: labels.supportLabel },
        { key: "cash", label: dictionary.gameHistory.cash },
    ]
    const filtered = useMemo(
        () =>
            rows
                .filter(
                    (row) =>
                        (group === "all" || row.group === group) &&
                        `${row.name} ${row.group} ${row.game}`
                            .toLocaleLowerCase(locale)
                            .includes(search.trim().toLocaleLowerCase(locale))
                )
                .sort((a, b) => {
                    const left = a[sort],
                        right = b[sort]
                    if (left === null || right === null)
                        return left === right
                            ? a.name.localeCompare(b.name, locale)
                            : left === null
                              ? 1
                              : -1
                    const order =
                        typeof left === "string" && typeof right === "string"
                            ? left.localeCompare(right, locale)
                            : Number(left) - Number(right)
                    return (
                        (ascending ? order : -order) ||
                        a.name.localeCompare(b.name, locale)
                    )
                }),
        [rows, group, search, sort, ascending, locale]
    )
    return (
        <div className="space-y-3">
            <p className="text-muted-foreground text-xs">{labels.scoresHelp}</p>
            <div className="flex flex-wrap items-center gap-2">
                <Input
                    className="max-w-sm"
                    aria-label={dictionary.userManagement.searchPlaceholder}
                    placeholder={dictionary.userManagement.searchPlaceholder}
                    value={search}
                    onChange={(event) => {
                        setSearch(event.target.value)
                        setLimit(50)
                    }}
                />
                <Select
                    value={group}
                    onValueChange={(value) => {
                        setGroup(value)
                        setLimit(50)
                    }}
                >
                    <SelectTrigger
                        className="w-48"
                        aria-label={dictionary.userManagement.tableGroup}
                    >
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">{labels.allGroups}</SelectItem>
                        {[...new Set(rows.map((row) => row.group))]
                            .sort()
                            .map((value) => (
                                <SelectItem key={value} value={value}>
                                    {value}
                                </SelectItem>
                            ))}
                    </SelectContent>
                </Select>
                <span className="text-muted-foreground text-xs tabular-nums">
                    {filtered.length} / {rows.length}
                </span>
            </div>
            <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                        <tr>
                            {columns.map((column) => (
                                <th
                                    key={column.key}
                                    aria-sort={
                                        sort === column.key
                                            ? ascending
                                                ? "ascending"
                                                : "descending"
                                            : "none"
                                    }
                                    className="px-3 py-2 text-left font-medium"
                                >
                                    <button
                                        className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap"
                                        onClick={() => {
                                            setSort(column.key)
                                            setAscending(
                                                sort === column.key
                                                    ? !ascending
                                                    : column.key === "name"
                                            )
                                        }}
                                    >
                                        {column.label}
                                        {sort === column.key ? (
                                            ascending ? (
                                                <ArrowUp className="size-3" />
                                            ) : (
                                                <ArrowDown className="size-3" />
                                            )
                                        ) : null}
                                    </button>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.slice(0, limit).map((row) => (
                            <tr
                                key={row.id}
                                className="hover:bg-muted/40 border-t"
                            >
                                {columns.map((column) => (
                                    <td
                                        key={column.key}
                                        className="px-3 py-2 whitespace-nowrap tabular-nums"
                                    >
                                        {column.key === "name" ? (
                                            <Link
                                                className="hover:underline"
                                                href={row.href}
                                            >
                                                <span className="font-medium">
                                                    {row.name}
                                                </span>
                                                <span className="text-muted-foreground ml-2 text-xs">
                                                    {row.group} ·{" "}
                                                    {gameLabel(row.game)}
                                                </span>
                                            </Link>
                                        ) : row[column.key] === null ? (
                                            "—"
                                        ) : column.key === "kd" ? (
                                            formatKd(row.kd!, locale)
                                        ) : (
                                            new Intl.NumberFormat(locale, {
                                                maximumFractionDigits: 1,
                                            }).format(row[column.key]!)
                                        )}
                                    </td>
                                ))}
                            </tr>
                        ))}
                        {!filtered.length && (
                            <tr>
                                <td
                                    colSpan={columns.length}
                                    className="text-muted-foreground p-8 text-center"
                                >
                                    {labels.noPlayers}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            {filtered.length > limit && (
                <Button variant="outline" onClick={() => setLimit(limit + 50)}>
                    {dictionary.publicProfiles.loadMore}
                </Button>
            )}
        </div>
    )
}
