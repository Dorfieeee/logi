import {
    getHllStratmapMapById,
    getHllStratmapMaps,
    type HllStratmapMap,
} from "@/lib/stratmaps"
import type { GameId } from "@/domain/games/game"

const emptyDefaults: HllStratmapMap["defaultElements"] = {
    offensiveGarrisons: { a: [], b: [] },
    artillery: { a: [], b: [] },
    tanks: { a: [], b: [] },
    trucks: { a: [], b: [] },
    commandSpawns: { a: [], b: [] },
    repairStations: { a: [], b: [] },
}

const WARDOGS_COORDINATE_METERS_PER_UNIT = 100
const WARDOGS_HQ_ICONS = new Set(["valkyra", "lonestar", "manticore"])

type WardogsSourceMarker = [icon: string, label: string, x: number, y: number]
type WardogsSourcePolygon = {
    label: string
    color: string
    points: Array<[x: number, y: number]>
}

function wardogsMap(
    id: string,
    name: string,
    bounds: { minX: number; maxX: number; minY: number; maxY: number },
    markers: WardogsSourceMarker[],
    polygons: WardogsSourcePolygon[]
): HllStratmapMap {
    const toCanvasPoint = (x: number, y: number) => ({
        x:
            ((x / WARDOGS_COORDINATE_METERS_PER_UNIT - bounds.minX) /
                (bounds.maxX - bounds.minX)) *
            1920,
        y:
            ((bounds.maxY - y / WARDOGS_COORDINATE_METERS_PER_UNIT) /
                (bounds.maxY - bounds.minY)) *
            1920,
    })

    return {
        ...placeholderMap(id, name, "/maps/wardogs-placeholder.svg"),
        imagePath: `/maps/wardogs/${id}.webp`,
        staticMarkers: markers.map(([icon, label, x, y], index) => ({
            id: `${id}-${icon}-${index}`,
            label,
            iconPath: `/stratmap/icons/wardogs/${icon}.webp`,
            kind:
                icon === "tower"
                    ? "tower"
                    : WARDOGS_HQ_ICONS.has(icon)
                      ? "hq"
                      : "facility",
            ...toCanvasPoint(x, y),
        })),
        staticPolygons: polygons.map((polygon, index) => ({
            id: `${id}-spawn-zone-${index}`,
            label: polygon.label,
            color: polygon.color,
            fillOpacity: 0.12,
            strokeWidth: 2,
            dashed: true,
            points: polygon.points.map(([x, y]) => toCanvasPoint(x, y)),
        })),
    }
}

function placeholderMap(
    id: string,
    name: string,
    imagePath: string
): HllStratmapMap {
    return {
        id,
        name,
        upstreamName: name,
        imagePath,
        mapSize: 1920,
        // Deliberately generic until official coordinates are available.
        strongpoints: ["Alpha", "Bravo", "Charlie", "Delta", "Echo"].map(
            (label, index) => ({
                id: label.toLowerCase(),
                label: `${label} (placeholder)`,
                grid: `${String.fromCharCode(65 + index)}5`,
                center: { x: 320 + index * 320, y: 960 },
                bounds: {
                    x: 240 + index * 320,
                    y: 850,
                    width: 160,
                    height: 220,
                },
                rects: [
                    { x: 240 + index * 320, y: 850, width: 160, height: 220 },
                ],
                spritePath: "",
            })
        ),
        defaultElements: emptyDefaults,
    }
}

export const HLL_VIETNAM_PLACEHOLDER_MAPS = [
    placeholderMap(
        "hllv-placeholder",
        "Hell Let Loose: Vietnam — placeholder map",
        "/maps/hllv-placeholder.svg"
    ),
]

export const WARDOGS_PLACEHOLDER_MAPS = [
    wardogsMap(
        "bakurani",
        "Bakurani",
        { minX: 23.35, maxX: 133.6, minY: 19.34, maxY: 129.65 },
        [
            ["tower", "Tower 4", 8361, 7284],
            ["tower", "Tower 3", 7716, 7343],
            ["tower", "Tower 2", 7717, 6999],
            ["tower", "Tower 1", 8049, 6984],
            ["tower", "Tower 5", 8220, 6841],
            ["valkyra", "Valkyra", 11875, 7093],
            ["weapons_vendor", "Weapons Vendor", 11830, 7073],
            ["garage_vendor", "Garage Vendor", 11814, 7045],
            ["spawn_board", "Spawn Board", 11837, 7049],
            ["manticore", "Manticore", 4009, 7752],
            ["weapons_vendor", "Weapons Vendor", 3977, 7765],
            ["garage_vendor", "Garage Vendor", 4010, 7731],
            ["spawn_board", "Spawn Board", 3968, 7748],
            ["lonestar", "Lonestar", 8746, 3250],
            ["weapons_vendor", "Weapons Vendor", 8720, 3268],
            ["garage_vendor", "Garage Vendor", 8684, 3264],
            ["spawn_board", "Spawn Board", 8706, 3272],
        ],
        [
            {
                label: "VALKYRA Spawn",
                color: "#d86666",
                points: [
                    [11750, 7376],
                    [12122, 7071],
                    [11818, 6699],
                    [11445, 7004],
                ],
            },
            {
                label: "MANTICORE Spawn",
                color: "#82c596",
                points: [
                    [3868, 7988],
                    [4339, 7885],
                    [4235, 7415],
                    [3765, 7518],
                ],
            },
            {
                label: "LONESTAR Spawn",
                color: "#5fa8d3",
                points: [
                    [8308, 3527],
                    [8772, 3651],
                    [8897, 3186],
                    [8432, 3062],
                ],
            },
        ]
    ),
    wardogsMap(
        "ozeti",
        "Ozeti",
        { minX: 57.58, maxX: 143.07, minY: 21.81, maxY: 99.56 },
        [
            ["tower", "Tower 4", 10062, 6764],
            ["tower", "Tower 3", 10449, 6371],
            ["tower", "Tower 2", 10037, 5923],
            ["tower", "Tower 1", 9580, 6282],
            ["valkyra", "Valkyra", 11875, 7093],
            ["weapons_vendor", "Weapons Vendor", 13803, 6733],
            ["garage_vendor", "Garage Vendor", 13790, 6707],
            ["spawn_board", "Spawn Board", 13788, 6726],
            ["manticore", "Manticore", 6828, 8803],
            ["weapons_vendor", "Weapons Vendor", 6854, 8816],
            ["garage_vendor", "Garage Vendor", 6866, 8792],
            ["spawn_board", "Spawn Board", 6842, 8786],
            ["lonestar", "Lonestar", 8373, 3069],
            ["weapons_vendor", "Weapons Vendor", 8385, 3088],
            ["garage_vendor", "Garage Vendor", 8373, 3117],
            ["spawn_board", "Spawn Board", 8368, 3104],
        ],
        [
            {
                label: "VALKYRA Spawn",
                color: "#d86666",
                points: [
                    [13398, 6851],
                    [13858, 6992],
                    [13999, 6532],
                    [13539, 6391],
                ],
            },
            {
                label: "MANTICORE Spawn",
                color: "#82c596",
                points: [
                    [6922, 9085],
                    [7309, 8798],
                    [7022, 8412],
                    [6636, 8699],
                ],
            },
            {
                label: "LONESTAR Spawn",
                color: "#5fa8d3",
                points: [
                    [8152, 3403],
                    [8633, 3403],
                    [8633, 2921],
                    [8153, 2922],
                ],
            },
        ]
    ),
    wardogsMap(
        "zestafona",
        "Zestafona",
        { minX: 19.9, maxX: 124.89, minY: 50.7, maxY: 141.9 },
        [
            ["tower", "Tower 3", 7017.2672, 10017.17],
            ["tower", "Tower 1", 6859.9808, 10415.3],
            ["tower", "Tower 2", 7289.2416, 10507.0592],
            ["valkyra", "VALKYRA Spawn", 3943.6288, 12494.4384],
            ["manticore", "MANTICORE Spawn", 10466.0992, 11508.1216],
            ["lonestar", "LONESTAR", 6800.9984, 6660.096],
            ["spawn_board", "Spawn Board", 3889.5616, 12486.2464],
            ["garage_vendor", "Garage Vendor", 10466.0992, 11454.0544],
            ["spawn_board", "Spawn Board", 10505.4208, 11529.4208],
            ["spawn_board", "Spawn Board", 6823.936, 6632.2432],
            ["garage_vendor", "Garage Vendor", 6782.976, 6650.2656],
            ["garage_vendor", "Garage Vendor", 3940.352, 12479.6928],
        ],
        [
            {
                label: "MANTICORE Spawn",
                color: "#82c596",
                points: [
                    [10330.11, 11170.61],
                    [10190.84, 11631],
                    [10651.23, 11768.62],
                    [10788.86, 11309.87],
                ],
            },
            {
                label: "VALKYRA Spawn",
                color: "#d86666",
                points: [
                    [4027.18, 12188.05],
                    [3570.07, 12335.51],
                    [3717.5296, 12792.62],
                    [4174.64, 12645.17],
                ],
            },
            {
                label: "LONESTAR Spawn",
                color: "#5fa8d3",
                points: [
                    [6512.64, 6481.51],
                    [6630.6, 6946.81],
                    [7095.91, 6827.21],
                    [6977.94, 6361.9],
                ],
            },
        ]
    ),
    placeholderMap("sabatulo", "Sabatulo", "/maps/wardogs-placeholder.svg"),
]

// Retain saved pre-catalog stratmaps without offering the generic ID for new maps.
const legacyWardogsMap = placeholderMap(
    "wardogs-placeholder",
    "Wardogs — placeholder map",
    "/maps/wardogs-placeholder.svg"
)

export function getStratmapMaps(gameId?: GameId) {
    if (gameId === "hell_let_loose_vietnam") return HLL_VIETNAM_PLACEHOLDER_MAPS
    if (gameId === "wardogs") return WARDOGS_PLACEHOLDER_MAPS
    return getHllStratmapMaps()
}

export function getStratmapMapById(mapId: string, gameId?: GameId) {
    // Wardogs drafts created before its named maps were added used this single
    // placeholder ID. Resolve it to a real selectable base map so the editor
    // does not render an empty canvas for those legacy records.
    if (gameId === "wardogs" && mapId === "wardogs-placeholder") {
        return WARDOGS_PLACEHOLDER_MAPS[0]
    }

    return (
        getStratmapMaps(gameId).find((map) => map.id === mapId) ??
        (mapId === legacyWardogsMap.id ? legacyWardogsMap : undefined) ??
        getHllStratmapMapById(mapId) ??
        HLL_VIETNAM_PLACEHOLDER_MAPS.find((map) => map.id === mapId) ??
        WARDOGS_PLACEHOLDER_MAPS.find((map) => map.id === mapId)
    )
}
