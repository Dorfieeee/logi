"use client"

import {
    emptyTacticalPlan,
    moveTacticalMarker,
    type TacticalMarker,
    type TacticalPlan,
} from "@/domain/events/tactical-plan"
import { getStratmapMapById } from "@/lib/game-stratmaps"
import { tacticalPlanCopy } from "./tactical-plan-copy"
import { Button } from "@/components/ui/button"
import { useId, useRef, useState } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

export type TacticalTeam = {
    slot: "a" | "b" | "c"
    name: string
    side: string | null
}
const factionColors: Record<string, string> = {
    valkyra: "#ef7777",
    manticore: "#88d6a0",
    lonestar: "#82c7ff",
}

export function TacticalPlanMap({
    plan,
    teams,
    locale,
    onPlace,
    timeLabel,
}: {
    plan: TacticalPlan
    teams: TacticalTeam[]
    locale: string
    onPlace?: (x: number, y: number) => void
    timeLabel?: string
}) {
    const map = getStratmapMapById(plan.mapId, "wardogs")
    const gridId = useId().replace(/:/g, "")
    const svgRef = useRef<SVGSVGElement>(null)
    const [exporting, setExporting] = useState(false)
    const [exportError, setExportError] = useState(false)
    const t = tacticalPlanCopy(locale)
    async function download() {
        if (!svgRef.current || !map) return
        setExporting(true)
        setExportError(false)
        try {
            const response = await fetch(map.imagePath)
            if (!response.ok) throw new Error("Map image unavailable")
            const blob = await response.blob()
            const embedded = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader()
                reader.onload = () =>
                    typeof reader.result === "string"
                        ? resolve(reader.result)
                        : reject(new Error("Invalid image"))
                reader.onerror = () =>
                    reject(new Error("Image could not be read"))
                reader.readAsDataURL(blob)
            })
            const svg = svgRef.current.cloneNode(true) as SVGSVGElement
            svg.setAttribute("xmlns", "http://www.w3.org/2000/svg")
            svg.setAttribute("width", "2000")
            svg.setAttribute("height", "2000")
            svg.querySelector("image")?.setAttribute("href", embedded)
            const url = URL.createObjectURL(
                new Blob([new XMLSerializer().serializeToString(svg)], {
                    type: "image/svg+xml;charset=utf-8",
                })
            )
            const link = document.createElement("a")
            link.href = url
            link.download = `wardogs-${plan.mapId}-plan.svg`
            link.click()
            setTimeout(() => URL.revokeObjectURL(url), 1000)
        } catch {
            setExportError(true)
        } finally {
            setExporting(false)
        }
    }
    if (!map) return null
    const caption = [map.name, plan.layout, timeLabel]
        .filter(Boolean)
        .join(" · ")
    return (
        <figure className="m-0 flex flex-col gap-2">
            <svg
                ref={svgRef}
                viewBox="0 0 1000 1000"
                role="img"
                fontFamily="Arial, sans-serif"
                aria-label={`${t.title}: ${map.name}${plan.layout ? `, ${plan.layout}` : ""}`}
                className={`border-border w-full rounded-md border bg-slate-950 ${onPlace ? "cursor-crosshair touch-manipulation" : ""}`}
                onClick={
                    onPlace
                        ? (event) => {
                              const rect =
                                  event.currentTarget.getBoundingClientRect()
                              onPlace(
                                  ((event.clientX - rect.left) / rect.width) *
                                      100,
                                  ((event.clientY - rect.top) / rect.height) *
                                      100
                              )
                          }
                        : undefined
                }
            >
                <title>{`${caption} · ${t.title}`}</title>
                <desc>{t.planned}</desc>
                <image href={map.imagePath} width="1000" height="1000" />
                <defs>
                    <pattern
                        id={gridId}
                        width="100"
                        height="100"
                        patternUnits="userSpaceOnUse"
                    >
                        <path
                            d="M 100 0 L 0 0 0 100"
                            fill="none"
                            stroke="white"
                            strokeOpacity="0.35"
                            strokeWidth="1"
                        />
                    </pattern>
                </defs>
                <rect width="1000" height="1000" fill={`url(#${gridId})`} />
                {map.staticPolygons?.map((polygon) => (
                    <polygon
                        key={polygon.id}
                        points={polygon.points
                            .map(
                                (point) =>
                                    `${(point.x / map.mapSize) * 1000},${(point.y / map.mapSize) * 1000}`
                            )
                            .join(" ")}
                        fill={polygon.color}
                        fillOpacity="0.2"
                        stroke={polygon.color}
                        strokeWidth="3"
                    />
                ))}
                {(["controlZone", "hotZone"] as const).map((key) => {
                    const zone = plan[key]
                    return zone ? (
                        <g key={key}>
                            {key === "controlZone" ? (
                                <rect
                                    x={(zone.x - zone.radius) * 10}
                                    y={(zone.y - zone.radius) * 10}
                                    width={zone.radius * 20}
                                    height={zone.radius * 20}
                                    fill="#facc15"
                                    fillOpacity="0.2"
                                    stroke="#fde047"
                                    strokeWidth="4"
                                    strokeDasharray="12 6"
                                />
                            ) : (
                                <circle
                                    cx={zone.x * 10}
                                    cy={zone.y * 10}
                                    r={zone.radius * 10}
                                    fill="#f97316"
                                    fillOpacity="0.2"
                                    stroke="#fdba74"
                                    strokeWidth="4"
                                />
                            )}
                            <text
                                x={Math.max(120, Math.min(880, zone.x * 10))}
                                y={
                                    key === "controlZone"
                                        ? Math.max(
                                              78,
                                              (zone.y - zone.radius) * 10 + 30
                                          )
                                        : Math.min(
                                              978,
                                              (zone.y + zone.radius) * 10 + 30
                                          )
                                }
                                textAnchor="middle"
                                fill="white"
                                stroke="#111827"
                                strokeWidth="4"
                                paintOrder="stroke"
                                fontSize="22"
                                fontWeight="700"
                            >
                                {t[key]}
                            </text>
                        </g>
                    ) : null
                })}
                {map.staticMarkers
                    ?.filter((marker) => marker.kind === "hq")
                    .map((marker) => (
                        <g
                            key={marker.id}
                            transform={`translate(${(marker.x / map.mapSize) * 1000},${(marker.y / map.mapSize) * 1000})`}
                        >
                            <circle
                                r="12"
                                fill={
                                    factionColors[
                                        marker.label.toLowerCase().split(" ")[0]
                                    ] ?? "white"
                                }
                                stroke="#111827"
                                strokeWidth="3"
                            />
                            <text
                                y="-22"
                                textAnchor="middle"
                                fill="white"
                                stroke="#111827"
                                strokeWidth="4"
                                paintOrder="stroke"
                                fontSize="20"
                                fontWeight="700"
                            >
                                {marker.label}
                            </text>
                        </g>
                    ))}
                {plan.teams.map((position) => {
                    const team = teams.find(
                        (team) => team.slot === position.slot
                    )
                    return (
                        <g
                            key={position.slot}
                            transform={`translate(${position.x * 10},${position.y * 10})`}
                        >
                            <circle
                                r="17"
                                fill={
                                    factionColors[
                                        team?.side?.toLowerCase() ?? ""
                                    ] ?? "#ffffff"
                                }
                                stroke="#111827"
                                strokeWidth="3"
                            />
                            <text
                                y="7"
                                textAnchor="middle"
                                fill="#111827"
                                fontSize="20"
                                fontWeight="700"
                            >
                                {position.slot.toUpperCase()}
                            </text>
                            <text
                                y="-26"
                                textAnchor="middle"
                                fill="white"
                                stroke="#111827"
                                strokeWidth="4"
                                paintOrder="stroke"
                                fontSize="22"
                                fontWeight="700"
                            >
                                {team?.name ??
                                    `${t.team} ${position.slot.toUpperCase()}`}
                                {team?.side ? ` · ${team.side}` : ""}
                            </text>
                        </g>
                    )
                })}
                <rect
                    width="1000"
                    height="48"
                    fill="#111827"
                    fillOpacity="0.9"
                />
                <text x="18" y="32" fill="white" fontSize="22" fontWeight="700">
                    {caption.length > 76 ? `${caption.slice(0, 73)}…` : caption}
                </text>
            </svg>
            <figcaption className="text-muted-foreground text-xs leading-5">
                {t.planned}
            </figcaption>
            <div>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={exporting}
                    onClick={() => void download()}
                >
                    {exporting ? t.downloading : t.download}
                </Button>
            </div>
            {exportError ? (
                <p role="alert" className="text-destructive text-sm">
                    {t.downloadError}
                </p>
            ) : null}
        </figure>
    )
}

export function TacticalPlanEditor({
    mapId,
    value,
    onChange,
    teams,
    locale,
    timeLabel,
}: {
    mapId: string
    value: TacticalPlan | null
    onChange: (plan: TacticalPlan | null) => void
    teams: TacticalTeam[]
    locale: string
    timeLabel?: string
}) {
    const [marker, setMarker] = useState<TacticalMarker>("controlZone")
    const id = useId()
    const t = tacticalPlanCopy(locale)
    const plan = value?.mapId === mapId ? value : null
    const supported =
        mapId === "bakurani" || mapId === "ozeti" || mapId === "zestafona"
    const point = plan
        ? marker === "controlZone" || marker === "hotZone"
            ? plan[marker]
            : plan.teams.find((team) => team.slot === marker)
        : null
    const place = (x: number, y: number) => {
        if (plan) onChange(moveTacticalMarker(plan, marker, x, y))
    }
    return (
        <section
            className="border-border flex flex-col gap-3 rounded-md border p-3"
            aria-label={t.title}
        >
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-medium">{t.title}</h3>
                {plan ? (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onChange(null)}
                    >
                        {t.clear}
                    </Button>
                ) : null}
            </div>
            {!supported ? (
                <p className="text-muted-foreground text-sm">{t.empty}</p>
            ) : !plan ? (
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => onChange(emptyTacticalPlan(mapId))}
                >
                    {t.generate}
                </Button>
            ) : (
                <>
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor={`${id}-layout`}>{t.layout}</Label>
                        <Input
                            id={`${id}-layout`}
                            value={plan.layout}
                            maxLength={120}
                            placeholder={t.layoutPlaceholder}
                            onChange={(event) =>
                                onChange({
                                    ...plan,
                                    layout: event.target.value,
                                })
                            }
                        />
                    </div>
                    <div className="flex flex-wrap items-end gap-2">
                        <div className="flex min-w-40 flex-1 flex-col gap-1.5">
                            <Label htmlFor={`${id}-marker`}>{t.marker}</Label>
                            <select
                                id={`${id}-marker`}
                                className="border-input bg-background h-9 rounded-md border px-2 text-sm"
                                value={marker}
                                onChange={(event) =>
                                    setMarker(
                                        event.target.value as TacticalMarker
                                    )
                                }
                            >
                                <option value="controlZone">
                                    {t.controlZone}
                                </option>
                                <option value="hotZone">{t.hotZone}</option>
                                {teams.map((team) => (
                                    <option key={team.slot} value={team.slot}>
                                        {team.name}
                                        {team.side ? ` · ${team.side}` : ""}
                                    </option>
                                ))}
                            </select>
                        </div>
                        {(["x", "y"] as const).map((axis) => (
                            <div
                                key={axis}
                                className="flex w-20 flex-col gap-1.5"
                            >
                                <Label htmlFor={`${id}-${axis}`}>
                                    {axis.toUpperCase()} (%)
                                </Label>
                                <Input
                                    id={`${id}-${axis}`}
                                    type="number"
                                    min={0}
                                    max={100}
                                    step={0.1}
                                    value={point?.[axis] ?? ""}
                                    onChange={(event) => {
                                        if (event.target.value === "") return
                                        const number = Number(
                                            event.target.value
                                        )
                                        if (Number.isFinite(number))
                                            place(
                                                axis === "x"
                                                    ? number
                                                    : (point?.x ?? 50),
                                                axis === "y"
                                                    ? number
                                                    : (point?.y ?? 50)
                                            )
                                    }}
                                />
                            </div>
                        ))}
                        {(marker === "controlZone" || marker === "hotZone") &&
                        point &&
                        "radius" in point ? (
                            <div className="flex w-28 flex-col gap-1.5">
                                <Label htmlFor={`${id}-radius`}>
                                    {marker === "controlZone"
                                        ? t.halfWidth
                                        : t.radius}
                                </Label>
                                <Input
                                    id={`${id}-radius`}
                                    type="number"
                                    min={1}
                                    max={50}
                                    step={0.1}
                                    value={point.radius}
                                    onChange={(event) => {
                                        const radius = Number(
                                            event.target.value
                                        )
                                        if (radius >= 1 && radius <= 50)
                                            onChange({
                                                ...plan,
                                                [marker]: { ...point, radius },
                                            })
                                    }}
                                />
                            </div>
                        ) : null}
                        {point ? (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    onChange(
                                        marker === "controlZone" ||
                                            marker === "hotZone"
                                            ? { ...plan, [marker]: null }
                                            : {
                                                  ...plan,
                                                  teams: plan.teams.filter(
                                                      (team) =>
                                                          team.slot !== marker
                                                  ),
                                              }
                                    )
                                }
                            >
                                {t.removeMarker}
                            </Button>
                        ) : null}
                    </div>
                    <p className="text-muted-foreground text-xs">{t.hint}</p>
                    <TacticalPlanMap
                        plan={plan}
                        teams={teams}
                        locale={locale}
                        timeLabel={timeLabel}
                        onPlace={place}
                    />
                </>
            )}
        </section>
    )
}
