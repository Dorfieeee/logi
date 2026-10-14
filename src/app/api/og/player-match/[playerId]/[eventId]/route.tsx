import { getWardogsMatchReport } from "@/lib/read-models/wardogs-match-reports"
import { WardogsMatchImage } from "@/components/app/wardogs-match-image"
import { getDictionary } from "@/i18n/dictionaries"
import { isLocale } from "@/i18n/config"
import { ImageResponse } from "next/og"

import {
    getPublicMatch,
    getPublicPlayerMatch,
} from "@/lib/read-models/public-profiles"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

type TimelineMinute = { minute: number; kills: number; deaths: number }

function buildTimeline(
    encounters: Array<{ action: string; ts: number }>,
    startedAt?: string
) {
    const timestamps = encounters.map((encounter) =>
        encounter.ts > 10_000_000_000 ? encounter.ts : encounter.ts * 1_000
    )
    const start = startedAt ? new Date(startedAt).getTime() : NaN
    const first = timestamps.length ? Math.min(...timestamps) : NaN
    const baseline = Number.isFinite(start) && start <= first ? start : first
    const minutes = new Map<number, TimelineMinute>()

    for (const encounter of encounters) {
        const action = encounter.action.toLowerCase()
        const isDeath = /death|died|killed.by/.test(action)
        const isKill = !isDeath && /kill|frag|eliminat/.test(action)
        if (!isKill && !isDeath) continue
        const timestamp =
            encounter.ts > 10_000_000_000 ? encounter.ts : encounter.ts * 1_000
        const minute = Math.max(0, Math.floor((timestamp - baseline) / 60_000))
        const current = minutes.get(minute) ?? { minute, kills: 0, deaths: 0 }
        if (isKill) current.kills += 1
        if (isDeath) current.deaths += 1
        minutes.set(minute, current)
    }

    return [...minutes.values()].sort(
        (left, right) => left.minute - right.minute
    )
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ playerId: string; eventId: string }> }
) {
    const { playerId, eventId } = await params
    const [playerMatch, publicMatch] = await Promise.all([
        getPublicPlayerMatch(playerId, eventId),
        getPublicMatch(eventId),
    ])
    const player = playerMatch?.player
    const match = playerMatch?.match
    if (!player || !match) return new Response("Not found", { status: 404 })
    if (match.gameId === "wardogs") {
        const report = await getWardogsMatchReport(eventId)
        if (
            !report ||
            !report.players.some((row) => row.profileId === player.id)
        )
            return new Response("Not found", { status: 404 })
        const requestedLocale = new URL(request.url).searchParams.get("locale")
        const locale =
            requestedLocale && isLocale(requestedLocale)
                ? requestedLocale
                : "en"
        return new ImageResponse(
            <WardogsMatchImage
                report={report}
                playerId={player.id}
                dictionary={getDictionary(locale)}
                locale={locale}
            />,
            {
                width: 1200,
                height: 630,
                headers: { "Cache-Control": "no-store, max-age=0" },
            }
        )
    }
    const rawPlayer = publicMatch?.raw.player_stats.find(
        (entry) => publicMatch.linkedPlayerIds[entry.player_id] === player.id
    )
    const timeline = buildTimeline(
        rawPlayer?.encounters ?? [],
        publicMatch?.raw.start
    )
    const timelineMax = Math.max(
        1,
        ...timeline.map((minute) => Math.max(minute.kills, minute.deaths))
    )
    return new ImageResponse(
        <div
            style={{
                background: "#17140f",
                color: "#f7f3ed",
                display: "flex",
                flexDirection: "column",
                width: "100%",
                height: "100%",
                padding: 64,
                fontFamily: "sans-serif",
            }}
        >
            <div style={{ display: "flex", color: "#d5a44b", fontSize: 28 }}>
                MATCH PERFORMANCE
            </div>
            <div
                style={{
                    display: "flex",
                    fontSize: 58,
                    fontWeight: 700,
                    marginTop: 24,
                }}
            >
                {player.name}
            </div>
            <div
                style={{
                    display: "flex",
                    color: "#aaa397",
                    fontSize: 30,
                    marginTop: 12,
                }}
            >
                {match.name} · {match.mapName ?? "Match"}
            </div>
            {timeline.length ? (
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        marginTop: 28,
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            color: "#aaa397",
                            fontSize: 20,
                            marginBottom: 12,
                        }}
                    >
                        ACTIVE MINUTES · KILLS / DEATHS
                    </div>
                    <div
                        style={{
                            display: "flex",
                            alignItems: "flex-end",
                            gap: 5,
                            height: 150,
                        }}
                    >
                        {timeline.map((minute) => (
                            <div
                                key={minute.minute}
                                style={{
                                    display: "flex",
                                    alignItems: "flex-end",
                                    gap: 2,
                                    flex: 1,
                                    height: "100%",
                                }}
                            >
                                <div
                                    style={{
                                        display: "flex",
                                        width: "50%",
                                        minHeight: 3,
                                        height: `${(minute.kills / timelineMax) * 100}%`,
                                        background: "#d5a44b",
                                    }}
                                />
                                <div
                                    style={{
                                        display: "flex",
                                        width: "50%",
                                        minHeight: 3,
                                        height: `${(minute.deaths / timelineMax) * 100}%`,
                                        background: "#a75b4b",
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}
            <div style={{ display: "flex", gap: 48, marginTop: "auto" }}>
                <div style={{ display: "flex", flexDirection: "column" }}>
                    <div
                        style={{
                            display: "flex",
                            color: "#aaa397",
                            fontSize: 22,
                        }}
                    >
                        KILLS
                    </div>
                    <div style={{ display: "flex", fontSize: 64 }}>
                        {match.kills}
                    </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                    <div
                        style={{
                            display: "flex",
                            color: "#aaa397",
                            fontSize: 22,
                        }}
                    >
                        DEATHS
                    </div>
                    <div style={{ display: "flex", fontSize: 64 }}>
                        {match.deaths}
                    </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                    <div
                        style={{
                            display: "flex",
                            color: "#aaa397",
                            fontSize: 22,
                        }}
                    >
                        K/D
                    </div>
                    <div style={{ display: "flex", fontSize: 64 }}>
                        {match.killDeathRatio.toFixed(2)}
                    </div>
                </div>
            </div>
        </div>,
        {
            width: 1200,
            height: 630,
            headers: {
                "Cache-Control": "no-store, max-age=0",
            },
        }
    )
}
