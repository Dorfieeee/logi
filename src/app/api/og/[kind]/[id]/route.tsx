import sharp, { type OverlayOptions } from "sharp"
import { ImageResponse } from "next/og"
import fs from "node:fs/promises"
import path from "node:path"

import {
    getPublicClan,
    getPublicMatch,
    getPublicPlayerProfile,
} from "@/lib/read-models/public-profiles"
import { getHllStratmapCatalog, parseStratmapState } from "@/lib/stratmaps"
import { getPublicImageDimensions } from "@/lib/public-image-version"
import { getPerformanceTrendDeltas } from "@/lib/performance-trends"
import { getDictionary, type Dictionary } from "@/i18n/dictionaries"
import { getPublicStratmapDetail } from "@/lib/server-stratmaps"
import { publicImageCache } from "@/lib/public-image-cache"
import { getStratmapMapById } from "@/lib/game-stratmaps"
import { isLocale } from "@/i18n/config"
import { formatKd } from "@/lib/format"

type Props = { params: Promise<{ kind: string; id: string }> }
const palette = {
    bg: "#17140f",
    panel: "#211d17",
    line: "#655f55",
    muted: "#aaa397",
    text: "#f7f3ed",
    gold: "#d5a44b",
    win: "#25a35a",
    loss: "#cf4d45",
    neutral: "#4d91d8",
}

function truncate(value: string, limit: number) {
    return value.length > limit ? `${value.slice(0, limit - 1)}…` : value
}

async function toDataUrl(url?: string) {
    if (!url?.startsWith("https://")) return null
    try {
        const source = await fetch(url, { next: { revalidate: 86400 } })
        const type = source.headers.get("content-type")
        if (!source.ok || !type?.startsWith("image/")) return null
        const bytes = new Uint8Array(await source.arrayBuffer())
        if (bytes.byteLength > 1_000_000) return null
        return `data:${type};base64,${Buffer.from(bytes).toString("base64")}`
    } catch {
        return null
    }
}

function png(image: Uint8Array) {
    const copy = new Uint8Array(image.byteLength)
    copy.set(image)
    return new Response(copy.buffer, {
        headers: {
            "content-type": "image/png",
            "cache-control": "public, max-age=31536000, immutable",
        },
    })
}

function Identity({
    name,
    image,
    square = false,
}: {
    name: string
    image: string | null
    square?: boolean
}) {
    const style = {
        display: "flex" as const,
        width: 102,
        height: 102,
        flexShrink: 0,
        borderRadius: square ? 18 : 51,
        objectFit: "cover" as const,
    }
    return image ? (
        <img src={image} width="102" height="102" style={style} />
    ) : (
        <div
            style={{
                ...style,
                alignItems: "center",
                justifyContent: "center",
                background: "#33291a",
                border: `3px solid ${palette.gold}`,
                color: "#f0cc86",
                fontSize: 32,
                fontWeight: 900,
            }}
        >
            {name.slice(0, 2).toUpperCase()}
        </div>
    )
}

function Shell({
    label,
    children,
}: {
    label: string
    children: React.ReactNode
}) {
    return (
        <div
            style={{
                display: "flex",
                width: "100%",
                height: "100%",
                padding: "38px 46px 58px",
                background: palette.bg,
                color: palette.text,
                fontFamily: "sans-serif",
                flexDirection: "column",
            }}
        >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                    style={{
                        display: "flex",
                        width: 13,
                        height: 13,
                        borderRadius: 13,
                        background: palette.gold,
                    }}
                />
                <div
                    style={{
                        display: "flex",
                        fontSize: 22,
                        fontWeight: 900,
                        letterSpacing: 4,
                    }}
                >
                    LOGI
                </div>
                <div
                    style={{
                        display: "flex",
                        color: palette.muted,
                        fontSize: 17,
                        letterSpacing: 2,
                    }}
                >
                    {label}
                </div>
            </div>
            {children}
        </div>
    )
}

function Metrics({ items }: { items: Array<[string, string, string?]> }) {
    return (
        <div
            style={{
                display: "flex",
                marginTop: 23,
                paddingTop: 20,
                borderTop: `1px solid ${palette.line}`,
                gap: 30,
            }}
        >
            {items.map(([label, value, detail]) => (
                <div
                    key={label}
                    style={{
                        display: "flex",
                        flex: 1,
                        flexDirection: "column",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            color: palette.muted,
                            fontSize: 17,
                            fontWeight: 700,
                        }}
                    >
                        {label}
                    </div>
                    <div
                        style={{
                            display: "flex",
                            marginTop: 7,
                            fontSize: 31,
                            fontWeight: 800,
                        }}
                    >
                        {value}
                    </div>
                    {detail ? (
                        <div
                            style={{
                                display: "flex",
                                marginTop: 3,
                                color: palette.muted,
                                fontSize: 16,
                            }}
                        >
                            {detail}
                        </div>
                    ) : null}
                </div>
            ))}
        </div>
    )
}
function PlayerHistory({
    matches,
    dictionary,
}: {
    dictionary: Dictionary
    matches: Array<{
        eventId: string
        kills: number
        deaths: number
        gameId?: string
        cashDelta?: number | null
        offense?: number
        defense?: number
        support?: number
    }>
}) {
    const recent = matches.slice(0, 10).reverse()
    const series = [
        [
            dictionary.gameHistory.kills,
            palette.win,
            recent.map((match) => match.kills),
        ],
        [
            dictionary.gameHistory.deaths,
            palette.loss,
            recent.map((match) => match.deaths),
        ],
        ...(matches[0]?.gameId === "wardogs"
            ? [
                  [
                      dictionary.gameHistory.cash,
                      palette.gold,
                      recent.map((match) => match.cashDelta ?? 0),
                  ] as const,
              ]
            : [
                  [
                      dictionary.clan.combatEffectiveness,
                      palette.gold,
                      recent.map(
                          (match) => (match.offense ?? 0) + (match.defense ?? 0)
                      ),
                  ] as const,
                  [
                      dictionary.clan.supportEffectiveness,
                      palette.neutral,
                      recent.map((match) => match.support ?? 0),
                  ] as const,
              ]),
    ] as const
    const maximum = Math.max(1, ...series.flatMap(([, , values]) => values))
    return (
        <div
            style={{
                display: "flex",
                marginTop: 20,
                padding: "14px 18px 22px",
                borderRadius: 14,
                background: palette.panel,
                gap: 16,
            }}
        >
            {series.map(([label, color, values]) => (
                <div
                    key={label}
                    style={{
                        display: "flex",
                        flex: 1,
                        flexDirection: "column",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            color,
                            fontSize: 15,
                            fontWeight: 700,
                        }}
                    >
                        {label}
                    </div>
                    <div
                        style={{
                            display: "flex",
                            alignItems: "flex-end",
                            gap: 3,
                            height: 44,
                            marginTop: 6,
                        }}
                    >
                        {values.map((value, index) => (
                            <div
                                key={index}
                                style={{
                                    display: "flex",
                                    flex: 1,
                                    height: `${Math.max(4, Math.round((value / maximum) * 42))}px`,
                                    borderRadius: 2,
                                    background: color,
                                }}
                            />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    )
}
function TeamChart({
    match,
}: {
    match: NonNullable<Awaited<ReturnType<typeof getPublicMatch>>>
}) {
    const teams = new Map<
        string,
        { kills: number; combat: number; support: number }
    >()
    match.raw.player_stats.forEach((player) => {
        const name = player.team.side || "Recorded"
        const value = teams.get(name) ?? { kills: 0, combat: 0, support: 0 }
        value.kills += player.kills
        value.combat += player.combat
        value.support += player.support
        teams.set(name, value)
    })
    const rows = ["allies", "axis"].map(
        (name) =>
            [
                name,
                teams.get(name) ?? { kills: 0, combat: 0, support: 0 },
            ] as const
    )
    return (
        <div
            style={{
                display: "flex",
                marginTop: 20,
                flexDirection: "column",
                gap: 12,
            }}
        >
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 18,
                }}
            >
                <span>MATCH CONTRIBUTION</span>
                <span style={{ color: palette.muted }}>
                    Kills · combat / 200 · support / 200
                </span>
            </div>
            {rows.map(([name, value]) => {
                const total = Math.max(
                    1,
                    value.kills + value.combat / 200 + value.support / 200
                )
                const score =
                    name === "allies"
                        ? match.raw.result.allied
                        : match.raw.result.axis
                return (
                    <div
                        key={name}
                        style={{ display: "flex", flexDirection: "column" }}
                    >
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                fontSize: 15,
                            }}
                        >
                            <span>{name.toUpperCase()}</span>
                            <span>
                                {score} points · {value.kills} kills ·{" "}
                                {value.combat} combat · {value.support} support
                            </span>
                        </div>
                        <div
                            style={{
                                display: "flex",
                                height: 22,
                                marginTop: 5,
                                borderRadius: 4,
                                overflow: "hidden",
                                background: palette.panel,
                            }}
                        >
                            <div
                                style={{
                                    display: "flex",
                                    width: `${(value.kills / total) * 100}%`,
                                    background: palette.win,
                                }}
                            />
                            <div
                                style={{
                                    display: "flex",
                                    width: `${(value.combat / 200 / total) * 100}%`,
                                    background: palette.gold,
                                }}
                            />
                            <div
                                style={{
                                    display: "flex",
                                    width: `${(value.support / 200 / total) * 100}%`,
                                    background: palette.neutral,
                                }}
                            />
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
function PlayerCard({
    player,
    avatar,
    dictionary,
    locale,
}: {
    dictionary: Dictionary
    locale: string
    player: NonNullable<Awaited<ReturnType<typeof getPublicPlayerProfile>>>
    avatar: string | null
}) {
    const number = new Intl.NumberFormat(locale)
    const recent = player.recentMatches.slice(0, 9).reverse()
    const maximum = Math.max(1, ...recent.map((match) => match.killDeathRatio))
    const trends = getPerformanceTrendDeltas(
        player.recentMatches.map((match) => ({
            kd: match.killDeathRatio,
            offense: (match.offense ?? 0) + (match.defense ?? 0),
            support: match.support ?? 0,
        }))
    )
    return (
        <Shell label={dictionary.clan.playerPerformanceTrend}>
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginTop: 28,
                    width: "100%",
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
                    <Identity name={player.name} image={avatar} />
                    <div style={{ display: "flex", flexDirection: "column" }}>
                        <div
                            style={{
                                display: "flex",
                                fontSize: 54,
                                fontWeight: 900,
                            }}
                        >
                            {truncate(player.name, 30)}
                        </div>
                        <div
                            style={{
                                display: "flex",
                                marginTop: 5,
                                color: palette.muted,
                                fontSize: 20,
                            }}
                        >
                            {player.clans
                                .map((clan) => clan.name)
                                .slice(0, 2)
                                .join(" · ") ||
                                dictionary.publicProfiles.independentPlayer}
                        </div>
                    </div>
                </div>
                {trends && player.gameId !== "wardogs" ? (
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 16,
                            background: palette.panel,
                            padding: "10px 18px",
                            borderRadius: 12,
                            border: `1px solid ${palette.line}`,
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                fontSize: 18,
                                fontWeight: 700,
                                color:
                                    trends.kd >= 0 ? palette.win : palette.loss,
                            }}
                        >
                            <span>K/D</span>
                            <span>
                                {trends.kd >= 0 ? "↑ +" : "↓ "}
                                {formatKd(trends.kd, locale)}
                            </span>
                        </div>
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                fontSize: 18,
                                fontWeight: 700,
                                color:
                                    trends.offense >= 0
                                        ? palette.win
                                        : palette.loss,
                            }}
                        >
                            <span>{dictionary.clan.combatEffectiveness}</span>
                            <span>
                                {trends.offense >= 0 ? "↑ +" : "↓ "}
                                {number.format(trends.offense)}
                            </span>
                        </div>
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                fontSize: 18,
                                fontWeight: 700,
                                color:
                                    trends.support >= 0
                                        ? palette.win
                                        : palette.loss,
                            }}
                        >
                            <span>{dictionary.clan.supportEffectiveness}</span>
                            <span>
                                {trends.support >= 0 ? "↑ +" : "↓ "}
                                {number.format(trends.support)}
                            </span>
                        </div>
                    </div>
                ) : null}
            </div>
            <Metrics
                items={[
                    [
                        dictionary.publicProfiles.matches,
                        number.format(player.stats.matches),
                    ],
                    [
                        dictionary.publicProfiles.kd,
                        `${formatKd(player.stats.kd, locale)} K/D`,
                        `${number.format(player.stats.kills)} ${dictionary.publicProfiles.kills} · ${number.format(player.stats.deaths)} ${dictionary.publicProfiles.deaths}`,
                    ],
                    [
                        dictionary.publicProfiles.recentMatches,
                        recent.length
                            ? `${formatKd(recent.at(-1)!.killDeathRatio, locale)} K/D`
                            : "—",
                    ],
                ]}
            />
            <div
                style={{
                    display: "flex",
                    marginTop: 20,
                    padding: "16px 18px",
                    borderRadius: 14,
                    background: palette.panel,
                    flexDirection: "column",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        color: palette.muted,
                        fontSize: 17,
                    }}
                >
                    <span>{dictionary.clan.playerPerformanceTrend}</span>
                    <span>{dictionary.publicProfiles.kdChartHint}</span>
                </div>
                <div
                    style={{
                        display: "flex",
                        alignItems: "flex-end",
                        gap: 8,
                        height: 58,
                        marginTop: 10,
                    }}
                >
                    {recent.map((match) => (
                        <div
                            key={match.eventId}
                            style={{
                                display: "flex",
                                flex: 1,
                                height: `${Math.max(14, Math.round((match.killDeathRatio / maximum) * 50))}px`,
                                borderRadius: 4,
                                background:
                                    match.killDeathRatio >= 1
                                        ? palette.win
                                        : palette.loss,
                            }}
                        />
                    ))}
                </div>
            </div>
            <PlayerHistory
                matches={player.recentMatches}
                dictionary={dictionary}
            />
        </Shell>
    )
}

function ClanCard({
    clan,
    avatar,
}: {
    clan: NonNullable<Awaited<ReturnType<typeof getPublicClan>>>
    avatar: string | null
}) {
    const results = clan.recentMatches.slice(0, 10).reverse()
    return (
        <Shell label="CLAN RECORD">
            <div
                style={{
                    display: "flex",
                    marginTop: 28,
                    alignItems: "center",
                    gap: 22,
                }}
            >
                <Identity name={clan.name} image={avatar} square />
                <div style={{ display: "flex", flexDirection: "column" }}>
                    <div
                        style={{
                            display: "flex",
                            fontSize: 54,
                            fontWeight: 900,
                        }}
                    >
                        {truncate(clan.name, 28)}
                    </div>
                    <div
                        style={{
                            display: "flex",
                            marginTop: 5,
                            color: palette.muted,
                            fontSize: 20,
                        }}
                    >
                        {truncate(
                            clan.description || "Public clan profile",
                            70
                        )}
                    </div>
                </div>
            </div>
            <Metrics
                items={[
                    ["ACTIVE MEMBERS", String(clan.memberCount)],
                    ["RECORDED MATCHES", String(clan.stats.matches)],
                    [
                        "WIN RATE",
                        `${Math.round(clan.stats.winRate * 100)}%`,
                        `${clan.stats.wins} victories`,
                    ],
                ]}
            />
            <div
                style={{
                    display: "flex",
                    marginTop: 20,
                    padding: "16px 18px",
                    borderRadius: 14,
                    background: palette.panel,
                    flexDirection: "column",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        color: palette.muted,
                        fontSize: 17,
                    }}
                >
                    RECENT RESULTS
                </div>
                <ClanResultScores matches={clan.recentMatches} />
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                    {results.map((match) => (
                        <div
                            key={match.eventId}
                            style={{
                                display: "flex",
                                flex: 1,
                                height: 24,
                                borderRadius: 4,
                                background:
                                    match.outcome === "victory"
                                        ? palette.win
                                        : match.outcome === "defeat"
                                          ? palette.loss
                                          : palette.neutral,
                            }}
                        />
                    ))}
                </div>
            </div>
            <ClanRecordDetails clan={clan} />
        </Shell>
    )
}
function ClanRecordDetails({
    clan,
}: {
    clan: NonNullable<Awaited<ReturnType<typeof getPublicClan>>>
}) {
    const latest = clan.recentMatches[0]
    const defeats = clan.recentMatches.filter(
        (match) => match.outcome === "defeat"
    ).length
    return (
        <div
            style={{
                display: "flex",
                marginTop: 18,
                padding: "15px 18px",
                borderRadius: 14,
                background: palette.panel,
                gap: 24,
            }}
        >
            <div style={{ display: "flex", flex: 1, flexDirection: "column" }}>
                <div
                    style={{
                        display: "flex",
                        color: palette.muted,
                        fontSize: 15,
                    }}
                >
                    LATEST RECORDED MATCH
                </div>
                <div
                    style={{
                        display: "flex",
                        marginTop: 5,
                        fontSize: 21,
                        fontWeight: 800,
                    }}
                >
                    {latest ? truncate(latest.name, 34) : "No recorded match"}
                </div>
                <div
                    style={{
                        display: "flex",
                        marginTop: 3,
                        color: palette.muted,
                        fontSize: 16,
                    }}
                >
                    {latest
                        ? `${latest.mapName} · ${latest.score.allied} — ${latest.score.axis}`
                        : ""}
                </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
                <div
                    style={{
                        display: "flex",
                        color: palette.muted,
                        fontSize: 15,
                    }}
                >
                    RECENT RECORD
                </div>
                <div
                    style={{
                        display: "flex",
                        marginTop: 5,
                        fontSize: 21,
                        fontWeight: 800,
                    }}
                >
                    {clan.stats.wins} wins · {defeats} losses
                </div>
            </div>
        </div>
    )
}
function ClanResultScores({
    matches,
}: {
    matches: NonNullable<
        Awaited<ReturnType<typeof getPublicClan>>
    >["recentMatches"]
}) {
    return (
        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            {matches
                .slice(0, 10)
                .reverse()
                .map((match) => (
                    <div
                        key={match.eventId}
                        style={{
                            display: "flex",
                            flex: 1,
                            justifyContent: "center",
                            color: palette.muted,
                            fontSize: 12,
                        }}
                    >
                        {match.score.allied}—{match.score.axis}
                    </div>
                ))}
        </div>
    )
}

function MatchCard({
    match,
    thumbnail,
}: {
    match: NonNullable<Awaited<ReturnType<typeof getPublicMatch>>>
    thumbnail: string | null
}) {
    const clanScore = match.clanResult?.clanScore ?? match.raw.result.allied
    const opponentScore =
        match.clanResult?.opponentScore ?? match.raw.result.axis
    const leaders = [...match.raw.player_stats]
        .sort((a, b) => b.kills - a.kills)
        .slice(0, 5)
    const minutes = match.raw.match_time
        ? Math.round(match.raw.match_time / 60)
        : null
    return (
        <Shell label="MATCH RESULT">
            <div
                style={{
                    display: "flex",
                    marginTop: 28,
                    alignItems: "center",
                    gap: 22,
                }}
            >
                {thumbnail ? (
                    <img
                        src={thumbnail}
                        width="102"
                        height="102"
                        style={{
                            display: "flex",
                            width: 102,
                            height: 102,
                            objectFit: "cover",
                            borderRadius: 18,
                        }}
                    />
                ) : (
                    <Identity name={match.eventName} image={null} square />
                )}
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        flex: 1,
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            fontSize: 46,
                            fontWeight: 900,
                        }}
                    >
                        {truncate(match.eventName, 38)}
                    </div>
                    <div
                        style={{
                            display: "flex",
                            marginTop: 5,
                            color: palette.muted,
                            fontSize: 20,
                        }}
                    >
                        {match.raw.map.pretty_name}
                    </div>
                </div>
                <div style={{ display: "flex", fontSize: 56, fontWeight: 900 }}>
                    {match.raw.result.allied} — {match.raw.result.axis}
                </div>
            </div>
            <Metrics
                items={[
                    ["PLAYERS RECORDED", String(match.raw.player_stats.length)],
                    ["MATCH DURATION", minutes ? `${minutes} min` : "Recorded"],
                    [
                        "TOP KILLER",
                        leaders[0] ? `${leaders[0].kills} kills` : "—",
                        leaders[0]?.player,
                    ],
                ]}
            />
            <div
                style={{
                    display: "flex",
                    marginTop: 20,
                    padding: "16px 18px",
                    borderRadius: 14,
                    background: palette.panel,
                    flexDirection: "column",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        color: palette.muted,
                        fontSize: 17,
                    }}
                >
                    TOP PLAYERS BY KILLS
                </div>
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginTop: 10,
                        fontSize: 20,
                    }}
                >
                    {leaders.map((player, index) => (
                        <div
                            key={player.player_id}
                            style={{ display: "flex", gap: 8 }}
                        >
                            <span style={{ color: palette.muted }}>
                                {index + 1}.
                            </span>
                            <span>{truncate(player.player, 18)}</span>
                            <span style={{ color: palette.gold }}>
                                {player.kills} K
                            </span>
                        </div>
                    ))}
                </div>
            </div>
            <TeamChart match={match} />
        </Shell>
    )
}

async function renderStratmapCardImage(
    stratmap: NonNullable<Awaited<ReturnType<typeof getPublicStratmapDetail>>>
): Promise<string | null> {
    const mapDef = getStratmapMapById(stratmap.baseMapId, stratmap.gameId)
    const state = parseStratmapState(stratmap.state, stratmap.baseMapId)
    const firstSlide = state.slides[0]

    try {
        if (
            firstSlide?.background?.kind === "image" &&
            firstSlide.background.imageUrl
        ) {
            const customUrl = firstSlide.background.imageUrl
            const data = await toDataUrl(customUrl)
            if (data) return data
        }

        if (!mapDef) return null
        const cleanImagePath = mapDef.imagePath.startsWith("/")
            ? mapDef.imagePath.slice(1)
            : mapDef.imagePath
        const filePath = path.join(process.cwd(), "public", cleanImagePath)
        const targetSize = 520
        const scale = targetSize / (mapDef.mapSize || 1920)

        const composites: OverlayOptions[] = []
        if (firstSlide) {
            const visiblePointIds = new Set(
                firstSlide.overlays?.visibleStrongpointIds ?? []
            )
            for (const point of mapDef.strongpoints) {
                if (visiblePointIds.has(point.id)) {
                    const spriteRelative = point.spritePath.startsWith("/")
                        ? point.spritePath.slice(1)
                        : point.spritePath
                    const spriteFile = path.join(
                        process.cwd(),
                        "public",
                        spriteRelative
                    )
                    try {
                        const w = Math.max(
                            1,
                            Math.round(point.bounds.width * scale)
                        )
                        const h = Math.max(
                            1,
                            Math.round(point.bounds.height * scale)
                        )
                        const spriteBuf = await sharp(spriteFile)
                            .resize(w, h)
                            .toBuffer()
                        composites.push({
                            input: spriteBuf,
                            left: Math.max(
                                0,
                                Math.round(point.bounds.x * scale)
                            ),
                            top: Math.max(
                                0,
                                Math.round(point.bounds.y * scale)
                            ),
                        })
                    } catch {
                        // Strongpoint sprite missing or invalid, skip gracefully
                    }
                }
            }
        }

        let pipeline = sharp(filePath).resize(targetSize, targetSize, {
            fit: "cover",
        })
        if (composites.length > 0) {
            pipeline = pipeline.composite(composites)
        }
        const buf = await pipeline.jpeg({ quality: 80 }).toBuffer()
        return `data:image/jpeg;base64,${buf.toString("base64")}`
    } catch {
        return null
    }
}

function StratmapCard({
    stratmap,
    mapImage,
}: {
    stratmap: NonNullable<Awaited<ReturnType<typeof getPublicStratmapDetail>>>
    mapImage: string | null
}) {
    const mapDef = getStratmapMapById(stratmap.baseMapId, stratmap.gameId)
    const state = parseStratmapState(stratmap.state, stratmap.baseMapId)
    const slideCount = state.slides.length
    const mapName = mapDef?.name ?? stratmap.baseMapId
    const strongpoint =
        stratmap.gameId === "wardogs"
            ? undefined
            : stratmap.strongpointId
              ? (mapDef?.strongpoints.find(
                    (sp) => sp.id === stratmap.strongpointId
                )?.label ?? stratmap.strongpointId)
              : undefined

    const metrics: Array<[string, string, string?]> = [
        ["BASE MAP", mapName],
        ["SLIDES", String(slideCount)],
    ]
    if (strongpoint) {
        metrics.push(["OBJECTIVE", strongpoint])
    } else if (stratmap.side) {
        metrics.push(["SIDE", stratmap.side.toUpperCase()])
    }

    return (
        <Shell label="TACTICAL STRATMAP">
            <div
                style={{
                    display: "flex",
                    flex: 1,
                    marginTop: 24,
                    gap: 36,
                    alignItems: "center",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        flex: 1,
                        flexDirection: "column",
                        height: "100%",
                        justifyContent: "space-between",
                    }}
                >
                    <div style={{ display: "flex", flexDirection: "column" }}>
                        <div
                            style={{
                                display: "flex",
                                fontSize: 46,
                                fontWeight: 900,
                                lineHeight: 1.15,
                            }}
                        >
                            {truncate(stratmap.title, 34)}
                        </div>
                        {stratmap.description ? (
                            <div
                                style={{
                                    display: "flex",
                                    marginTop: 10,
                                    color: palette.muted,
                                    fontSize: 19,
                                    lineHeight: 1.3,
                                }}
                            >
                                {truncate(stratmap.description, 90)}
                            </div>
                        ) : null}
                        <div
                            style={{
                                display: "flex",
                                marginTop: 8,
                                color: palette.gold,
                                fontSize: 20,
                                fontWeight: 700,
                            }}
                        >
                            {[
                                mapName,
                                stratmap.side?.toUpperCase(),
                                strongpoint,
                            ]
                                .filter(Boolean)
                                .join(" · ")}
                        </div>
                    </div>
                    <Metrics items={metrics} />
                </div>
                {mapImage ? (
                    <img
                        src={mapImage}
                        width="460"
                        height="460"
                        style={{
                            display: "flex",
                            width: 460,
                            height: 460,
                            objectFit: "cover",
                            borderRadius: 20,
                            border: `2px solid ${palette.line}`,
                        }}
                    />
                ) : null}
            </div>
        </Shell>
    )
}

export async function GET(request: Request, { params }: Props) {
    const { kind, id } = await params
    const version = new URL(request.url).searchParams.get("v") ?? "current"
    const requestedLocale =
        new URL(request.url).searchParams.get("locale") ?? "en"
    const locale = isLocale(requestedLocale) ? requestedLocale : "en"
    const key = `${kind}:${id}:${version}:${locale}`
    const cached = publicImageCache.get(key)
    if (cached) return png(cached)
    let element: React.ReactElement | null = null
    if (kind === "player") {
        const player = await getPublicPlayerProfile(id)
        if (player)
            element = (
                <PlayerCard
                    player={player}
                    dictionary={getDictionary(locale)}
                    locale={locale}
                    avatar={await toDataUrl(player.avatar)}
                />
            )
    } else if (kind === "clan") {
        const clan = await getPublicClan(id)
        if (clan)
            element = (
                <ClanCard clan={clan} avatar={await toDataUrl(clan.avatar)} />
            )
    } else if (kind === "match") {
        const match = await getPublicMatch(id)
        if (match)
            element = (
                <MatchCard
                    match={match}
                    thumbnail={match.thumbnailUrl ?? null}
                />
            )
    } else if (kind === "stratmap") {
        const stratmap = await getPublicStratmapDetail(id)
        if (stratmap) {
            const mapImage = await renderStratmapCardImage(stratmap)
            element = <StratmapCard stratmap={stratmap} mapImage={mapImage} />
        }
    }
    if (!element) return new Response("Not found", { status: 404 })
    const dimensions = getPublicImageDimensions(version)
    const rendered = new ImageResponse(element, dimensions)
    const image = new Uint8Array(await rendered.arrayBuffer())
    publicImageCache.set(key, image)
    return png(image)
}
