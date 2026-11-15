import rawPresetCodes from "@/data/hll-map-presets.json"
import type { GameId } from "@/domain/games/game"

type MapMode = "warfare" | "offensive" | "skirmish" | "koth"
type MapTime =
    "day" | "morning" | "dusk" | "evening" | "night" | "rain" | "overcast"
type OffensiveSide = "ger" | "us" | "rus" | "cw" | "can" | "british"

type MapDefinition = {
    id: string
    name: string
    aliases: string[]
}

type MapPresetEntry = {
    code: string
    mapId: string
    mapName: string
    time: MapTime
    mode: MapMode
    offensiveSide?: OffensiveSide
}

type MapSelection = {
    mapId: string
    time: MapTime
    mode: MapMode
}

type SelectOption = {
    value: string
    label: string
}

function titleCaseFragment(value: string) {
    return value
        .split(/[\s_-]+/)
        .filter(Boolean)
        .map(
            (part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
        )
        .join(" ")
}

const MAP_DEFINITIONS: MapDefinition[] = [
    { id: "carentan", name: "Carentan", aliases: ["carentan", "car_s_1944"] },
    { id: "driel", name: "Driel", aliases: ["driel", "drl_s_1944"] },
    {
        id: "el_alamein",
        name: "El Alamein",
        aliases: ["elalamein", "ela_s_1942"],
    },
    {
        id: "elsenborn_ridge",
        name: "Elsenborn Ridge",
        aliases: ["elsenbornridge"],
    },
    { id: "foy", name: "Foy", aliases: ["foy", "foy_s_1944"] },
    { id: "hill_400", name: "Hill 400", aliases: ["hill400", "hil_s_1944"] },
    {
        id: "hurtgen_forest",
        name: "Hurtgen Forest",
        aliases: ["hurtgenforest"],
    },
    { id: "juno_beach", name: "Juno Beach", aliases: ["junobeach"] },
    { id: "kharkov", name: "Kharkov", aliases: ["kharkov", "kha_s_1944"] },
    { id: "kursk", name: "Kursk", aliases: ["kursk"] },
    { id: "mortain", name: "Mortain", aliases: ["mortain"] },
    { id: "omaha_beach", name: "Omaha Beach", aliases: ["omahabeach"] },
    {
        id: "purple_heart_lane",
        name: "Purple Heart Lane",
        aliases: ["purpleheartlane", "phl_l_1944", "phl_s_1944"],
    },
    {
        id: "remagen",
        name: "Remagen",
        aliases: ["remagen", "rem_l_1945", "rem_s_1945"],
    },
    {
        id: "st_marie_du_mont",
        name: "St. Marie Du Mont",
        aliases: ["stmariedumont", "smdm_s_1944"],
    },
    {
        id: "st_mere_eglise",
        name: "St. Mere Eglise",
        aliases: ["stmereeglise", "sme_s_1944"],
    },
    { id: "smolensk", name: "Smolensk", aliases: ["smolensk"] },
    {
        id: "stalingrad",
        name: "Stalingrad",
        aliases: ["stalingrad", "sta_l_1942", "sta_s_1942"],
    },
    { id: "tobruk", name: "Tobruk", aliases: ["tobruk"] },
    { id: "utah_beach", name: "Utah Beach", aliases: ["utahbeach"] },
]

const WARDOGS_MAP_DEFINITIONS: MapDefinition[] = [
    { id: "bakurani", name: "Bakurani", aliases: ["bakurani"] },
    { id: "ozeti", name: "Ozeti", aliases: ["ozeti"] },
    { id: "sabatulo", name: "Sabatulo", aliases: ["sabatulo"] },
    { id: "zestafona", name: "Zestafona", aliases: ["zestafona"] },
]

const TIME_LABELS: Record<MapTime, string> = {
    day: "Day",
    morning: "Morning",
    dusk: "Dusk",
    evening: "Evening",
    night: "Night",
    rain: "Rain",
    overcast: "Overcast",
}

const MODE_LABELS: Record<MapMode, string> = {
    warfare: "Warfare",
    offensive: "Offensive",
    skirmish: "Skirmish",
    koth: "KOTH",
}

const SIDE_ALIASES: Record<OffensiveSide, string[]> = {
    ger: ["ger", "german", "germany", "axis"],
    us: ["us", "usa", "american", "allies"],
    rus: ["rus", "russia", "russian", "soviet", "ussr"],
    cw: ["cw", "commonwealth", "british", "uk", "allies"],
    can: ["can", "canada", "canadian", "allies"],
    british: ["british", "uk", "allies"],
}

function getMapDefinition(code: string, definitions = MAP_DEFINITIONS) {
    const normalizedCode = code.toLowerCase()
    return definitions
        .filter((definition) =>
            definition.aliases.some((alias) => normalizedCode.startsWith(alias))
        )
        .sort((left, right) => {
            const leftLength = Math.max(
                ...left.aliases.map((alias) => alias.length)
            )
            const rightLength = Math.max(
                ...right.aliases.map((alias) => alias.length)
            )
            return rightLength - leftLength
        })[0]
}

function parseTime(code: string): MapTime {
    const normalizedCode = code.toLowerCase()
    if (normalizedCode.includes("overcast")) return "overcast"
    if (normalizedCode.includes("morning")) return "morning"
    if (normalizedCode.includes("evening")) return "evening"
    if (normalizedCode.includes("dusk")) return "dusk"
    if (normalizedCode.includes("rain")) return "rain"
    if (normalizedCode.includes("night")) return "night"
    return "day"
}

function parseMode(code: string): MapMode | null {
    const normalizedCode = code.toLowerCase()
    if (normalizedCode.includes("warfare")) return "warfare"
    if (
        normalizedCode.includes("offensive") ||
        normalizedCode.includes("_off_") ||
        normalizedCode.includes("offensiveger") ||
        normalizedCode.includes("offensiveus")
    )
        return "offensive"
    if (normalizedCode.includes("skirmish")) return "skirmish"
    if (normalizedCode.includes("koth")) return "koth"
    return null
}

function parseOffensiveSide(code: string): OffensiveSide | undefined {
    const normalizedCode = code.toLowerCase()
    if (!normalizedCode.includes("off")) return undefined
    if (normalizedCode.includes("offensive_cw")) return "cw"
    if (normalizedCode.includes("offensivecan")) return "can"
    if (normalizedCode.includes("offensivebritish")) return "british"
    if (
        normalizedCode.includes("offensiverus") ||
        normalizedCode.includes("offensive_rus")
    )
        return "rus"
    if (
        normalizedCode.includes("offensiveus") ||
        normalizedCode.includes("offensive_us") ||
        normalizedCode.includes("off_us")
    )
        return "us"
    if (
        normalizedCode.includes("offensiveger") ||
        normalizedCode.includes("offensive_ger") ||
        normalizedCode.includes("off_ger")
    )
        return "ger"
    return undefined
}

function parsePresetCode(
    code: string,
    definitions = MAP_DEFINITIONS
): MapPresetEntry | null {
    if (code === "bla_" || code === "unknown") {
        return null
    }

    const definition = getMapDefinition(code, definitions)
    const mode = parseMode(code)
    if (!definition || !mode) {
        return null
    }

    return {
        code,
        mapId: definition.id,
        mapName: definition.name,
        time: parseTime(code),
        mode,
        offensiveSide:
            mode === "offensive" ? parseOffensiveSide(code) : undefined,
    }
}

const mapPresetEntries = rawPresetCodes
    .map((code) => parsePresetCode(code))
    .filter((entry): entry is MapPresetEntry => Boolean(entry))
    .sort(
        (left, right) =>
            left.mapName.localeCompare(right.mapName) ||
            left.time.localeCompare(right.time) ||
            left.mode.localeCompare(right.mode) ||
            left.code.localeCompare(right.code)
    )

const wardogsMapPresetEntries: MapPresetEntry[] =
    WARDOGS_MAP_DEFINITIONS.flatMap((definition) =>
        (Object.keys(TIME_LABELS) as MapTime[]).map((time) => ({
            code: `${definition.id}_koth_${time}`,
            mapId: definition.id,
            mapName: definition.name,
            time,
            mode: "koth" as const,
        }))
    )

function getMapPresetEntries(gameId?: GameId) {
    return gameId === "wardogs" ? wardogsMapPresetEntries : mapPresetEntries
}

function dedupeOptions(
    values: string[],
    labelForValue: (value: string) => string
) {
    return [...new Set(values)].map((value) => ({
        value,
        label: labelForValue(value),
    }))
}

export function getHllMapOptions(): SelectOption[] {
    return dedupeOptions(
        mapPresetEntries.map((entry) => entry.mapId),
        (mapId) =>
            mapPresetEntries.find((entry) => entry.mapId === mapId)?.mapName ??
            mapId
    )
}

export function getHllTimeOptions(
    mapId: string,
    gameId?: GameId
): SelectOption[] {
    const entries = getMapPresetEntries(gameId)
    return dedupeOptions(
        entries
            .filter((entry) => entry.mapId === mapId)
            .map((entry) => entry.time),
        (time) => TIME_LABELS[time as MapTime] ?? time
    )
}

export function getHllModeOptions(
    mapId: string,
    time: string,
    gameId?: GameId
): SelectOption[] {
    const entries = getMapPresetEntries(gameId)
    return dedupeOptions(
        entries
            .filter((entry) => entry.mapId === mapId && entry.time === time)
            .map((entry) => entry.mode),
        (mode) => MODE_LABELS[mode as MapMode] ?? mode
    )
}

export function getDefaultHllSelection(mapId: string): MapSelection | null {
    const timeEntries = mapPresetEntries.filter(
        (entry) => entry.mapId === mapId
    )
    if (!timeEntries.length) {
        return null
    }

    const time = timeEntries.some((entry) => entry.time === "day")
        ? "day"
        : timeEntries[0].time
    const modeEntries = timeEntries.filter((entry) => entry.time === time)
    const mode = modeEntries.some((entry) => entry.mode === "warfare")
        ? "warfare"
        : modeEntries[0].mode

    return { mapId, time, mode }
}

export function inferHllBaseMapId(value?: string | null, gameId?: GameId) {
    if (!value) {
        return null
    }

    const definitions =
        gameId === "wardogs" ? WARDOGS_MAP_DEFINITIONS : MAP_DEFINITIONS
    const parsed = parsePresetCode(value, definitions)
    if (parsed) {
        return parsed.mapId
    }

    const direct = definitions.find((definition) => definition.id === value)
    return direct?.id ?? null
}

export function inferHllSelection(
    code?: string | null,
    gameId?: GameId
): MapSelection | null {
    if (!code) {
        return null
    }

    const parsed = parsePresetCode(
        code,
        gameId === "wardogs" ? WARDOGS_MAP_DEFINITIONS : MAP_DEFINITIONS
    )
    if (!parsed) {
        return null
    }

    return {
        mapId: parsed.mapId,
        time: parsed.time,
        mode: parsed.mode,
    }
}

function normalizeOffensiveSide(side?: string | null) {
    const normalizedSide = side?.trim().toLowerCase() ?? ""
    if (!normalizedSide) {
        return undefined
    }

    return (Object.keys(SIDE_ALIASES) as OffensiveSide[]).find((token) =>
        SIDE_ALIASES[token].includes(normalizedSide)
    )
}

export function resolveHllPresetCode(input: {
    mapId: string
    time: string
    mode: string
    side?: string | null
    gameId?: GameId
}) {
    const matchingEntries = getMapPresetEntries(input.gameId).filter(
        (entry) =>
            entry.mapId === input.mapId &&
            entry.time === input.time &&
            entry.mode === input.mode
    )

    if (!matchingEntries.length) {
        return undefined
    }

    if (input.mode === "offensive") {
        const normalizedSide = normalizeOffensiveSide(input.side)
        const matchingSideEntry = normalizedSide
            ? matchingEntries.find(
                  (entry) => entry.offensiveSide === normalizedSide
              )
            : undefined

        return (matchingSideEntry ?? matchingEntries[0]).code
    }

    return matchingEntries[0].code
}

export function isKnownHllPresetCode(code?: string | null, gameId?: GameId) {
    return Boolean(inferHllSelection(code, gameId))
}

export function formatHllPresetLabel(code?: string | null, gameId?: GameId) {
    if (!code) {
        return null
    }

    const definitions =
        gameId === "wardogs" ? WARDOGS_MAP_DEFINITIONS : MAP_DEFINITIONS
    const direct =
        definitions.find((definition) => definition.id === code) ??
        (!gameId
            ? WARDOGS_MAP_DEFINITIONS.find(
                  (definition) => definition.id === code
              )
            : undefined)
    if (direct) {
        return direct.name
    }

    const parsed =
        parsePresetCode(code, definitions) ??
        (!gameId ? parsePresetCode(code, WARDOGS_MAP_DEFINITIONS) : null)
    if (parsed) {
        return [
            parsed.mapName,
            TIME_LABELS[parsed.time],
            MODE_LABELS[parsed.mode],
        ].join(" • ")
    }

    return code
        .split("_")
        .filter((part) => part && !/^\d+$/.test(part) && part !== "p")
        .map(titleCaseFragment)
        .join(" • ")
}
