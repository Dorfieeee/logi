import {
    HLL_NATION_SIDE,
    type HllNation,
    type HllSide,
    type PanelServerState,
    type PlayerGaugePiece,
} from "./panel-emblems"

/**
 * Panel graphics (P7/P8): styles, map art, banners, the player gauge and the
 * rules that decide when the generated score image is redrawn. Pure: callers
 * pass the live facts, the clan settings and the clock.
 */

// ---- Styles -------------------------------------------------------------

/** A: generated score image · B: banner + map thumbnail · C: compact text. */
export const PANEL_STYLES = ["a", "b", "c"] as const
export type PanelStyle = (typeof PANEL_STYLES)[number]
// `panelStyleSchema`, `panelMapGameSchema` and `panelMapKeySchema` live in
// `panel-graphics.schema.ts`, so this projection module stays free of Zod.
/** The owner chose the generated image for Hell Let Loose and Wardogs. */
export const DEFAULT_PANEL_STYLE: PanelStyle = "a"
/** The panel's own style wins; otherwise the clan default; otherwise style A. */
export function resolvePanelStyle(
    panel: { presentation?: { style?: PanelStyle | null } | null } | null,
    clanDefault?: PanelStyle | null
): PanelStyle {
    return panel?.presentation?.style ?? clanDefault ?? DEFAULT_PANEL_STYLE
}

// ---- Map catalogue ------------------------------------------------------

export const PANEL_MAP_GAMES = ["hell_let_loose", "wardogs"] as const
export type PanelMapGame = (typeof PANEL_MAP_GAMES)[number]
export type PanelMapDefinition = {
    game: PanelMapGame
    key: string
    name: string
    /** Built-in art relative to `public/`, or null when Logi has none. */
    builtIn: string | null
    /** Hell Let Loose nations on this map, Allies first. */
    nations: readonly [HllNation, HllNation] | null
    aliases: readonly string[]
}
const hll = (
    key: string,
    name: string,
    nations: readonly [HllNation, HllNation],
    aliases: readonly string[]
): PanelMapDefinition => ({
    game: "hell_let_loose",
    key,
    name,
    builtIn: `/maps/${key}.webp`,
    nations,
    aliases,
})
const wardogs = (key: string, name: string): PanelMapDefinition => ({
    game: "wardogs",
    key,
    name,
    builtIn: `/maps/wardogs/${key}.webp`,
    nations: null,
    aliases: [key],
})
const US: readonly [HllNation, HllNation] = ["us", "ger"]
/**
 * Every map with Logi art. Aliases are compact (lowercase, no separators) and
 * match CRCON names and layer IDs by prefix, longest first.
 */
export const PANEL_MAPS: readonly PanelMapDefinition[] = [
    hll("carentan", "Carentan", US, ["carentan", "car"]),
    hll("driel", "Driel", ["gb", "ger"], ["driel", "drl"]),
    hll("el-alamein", "El Alamein", ["gb", "dak"], ["elalamein", "ela"]),
    hll("elsenborn-ridge", "Elsenborn Ridge", US, [
        "elsenbornridge",
        "elsenborn",
    ]),
    hll("foy", "Foy", US, ["foy"]),
    hll("hill-400", "Hill 400", US, ["hill400", "hil"]),
    hll("hurtgen-forest", "Hürtgenwald", US, [
        "hurtgenforest",
        "hurtgenwald",
        "hurtgen",
        "hur",
    ]),
    hll("juno-beach", "Juno Beach", ["cw", "ger"], ["junobeach", "juno"]),
    hll("kharkov", "Kharkov", ["sov", "ger"], ["kharkov", "kha"]),
    hll("kursk", "Kursk", ["sov", "ger"], ["kursk", "kur"]),
    hll("mortain", "Mortain", US, ["mortain", "mor"]),
    hll("omaha-beach", "Omaha Beach", US, ["omahabeach", "omaha"]),
    hll("purple-heart-lane", "Purple Heart Lane", US, [
        "purpleheartlane",
        "phl",
    ]),
    hll("remagen", "Remagen", US, ["remagen", "rem"]),
    hll("smolensk", "Smolensk", ["sov", "ger"], ["smolensk", "smo"]),
    hll("st-marie-du-mont", "Sainte-Marie-du-Mont", US, [
        "stmariedumont",
        "saintemariedumont",
        "smdm",
    ]),
    hll("st-mere-eglise", "Sainte-Mère-Église", US, [
        "stmereeglise",
        "saintemereeglise",
        "sme",
    ]),
    hll("stalingrad", "Stalingrad", ["sov", "ger"], ["stalingrad", "sta"]),
    hll("tobruk", "Tobruk", ["gb", "dak"], ["tobruk", "tob"]),
    hll("utah-beach", "Utah Beach", US, ["utahbeach", "utah"]),
    wardogs("bakurani", "Bakurani"),
    wardogs("ozeti", "Ozeti"),
    wardogs("zestafona", "Zestafona"),
    { ...wardogs("sabatulo", "Sabatulo"), builtIn: null },
]
export function panelMapDefinition(
    game: string,
    key: string | null | undefined
): PanelMapDefinition | null {
    return (
        PANEL_MAPS.find((map) => map.game === game && map.key === key) ?? null
    )
}
function compact(value: string) {
    return value
        .normalize("NFKD")
        .replace(/\p{M}/gu, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
}
/**
 * Catalogue key for a provider map name or layer ID ("Foy", "foy_warfare",
 * "PHL_L_1944_Warfare", "Hürtgenwald"), or null for an unknown map.
 */
export function panelMapKey(
    game: string,
    raw: string | null | undefined
): string | null {
    if (!raw || raw.length > 200 || /[\\/]/.test(raw)) return null
    const value = compact(raw)
    if (!value) return null
    let best: { key: string; length: number } | null = null
    for (const map of PANEL_MAPS) {
        if (map.game !== game) continue
        for (const alias of map.aliases)
            if (
                value.startsWith(alias) &&
                (!best || alias.length > best.length)
            )
                best = { key: map.key, length: alias.length }
    }
    return best?.key ?? null
}
/** Hell Let Loose nations for a map; the generic side signs when the map is unknown. */
export function hllNationsFor(
    mapKey: string | null | undefined
): Record<HllSide, HllNation> {
    const nations = panelMapDefinition("hell_let_loose", mapKey)?.nations
    return nations
        ? { allies: nations[0], axis: nations[1] }
        : { allies: "allies", axis: "axis" }
}
/** The nation sign shown for a side; a nation of the other side never leaks in. */
export function hllNationForSide(
    side: HllSide,
    nations: Partial<Record<HllSide, HllNation>>
): HllNation {
    const nation = nations[side]
    return nation && HLL_NATION_SIDE[nation] === side ? nation : side
}

export const HLL_LIGHTINGS = [
    "day",
    "night",
    "dawn",
    "dusk",
    "morning",
    "evening",
    "rain",
    "overcast",
] as const
export type HllLighting = (typeof HLL_LIGHTINGS)[number]
/** Lighting written in a layer ID ("carentan_warfare_night"); null when the layer does not say. */
export function hllLayerLighting(
    layer: string | null | undefined
): HllLighting | null {
    if (!layer || layer.length > 200) return null
    const tokens = layer.toLowerCase().split(/[^a-z]+/)
    return HLL_LIGHTINGS.find((lighting) => tokens.includes(lighting)) ?? null
}
export const HLL_MODES = ["warfare", "offensive", "skirmish"] as const
export type HllMode = (typeof HLL_MODES)[number]
export function hllModeOf(value: string | null | undefined): HllMode | null {
    const text = value?.toLowerCase() ?? ""
    return HLL_MODES.find((mode) => text.includes(mode)) ?? null
}

// ---- Map art, banners and accent ----------------------------------------

export const BANNER_CROPS = ["top", "center", "bottom"] as const
export type BannerCrop = (typeof BANNER_CROPS)[number]
export type PanelImageSource =
    | {
          kind: "override"
          game: PanelMapGame
          mapKey: string
          publicId: string
          url: string
      }
    | { kind: "builtin"; game: PanelMapGame; mapKey: string; path: string }
export type MapImageOverride = {
    game: PanelMapGame
    mapKey: string
    publicId: string
    url: string
}
/** Map art: the clan's override, then Logi's built-in image, then none (P7-B04). */
export function resolvePanelMapImage(input: {
    game: string
    mapKey: string | null
    overrides: readonly MapImageOverride[]
}): PanelImageSource | null {
    if (!input.mapKey) return null
    const map = panelMapDefinition(input.game, input.mapKey)
    if (!map) return null
    const override = input.overrides.find(
        (entry) => entry.game === map.game && entry.mapKey === map.key
    )
    if (override)
        return {
            kind: "override",
            game: map.game,
            mapKey: map.key,
            publicId: override.publicId,
            url: override.url,
        }
    return map.builtIn
        ? {
              kind: "builtin",
              game: map.game,
              mapKey: map.key,
              path: map.builtIn,
          }
        : null
}
export type ServerBannerSettings = {
    publicId: string | null
    url: string | null
    crop: BannerCrop
    useMapImage: boolean
}
export type PanelBannerSource =
    | {
          kind: "banner"
          origin: "panel" | "server"
          url: string
          publicId: string | null
          crop: BannerCrop
      }
    | { kind: "map"; image: PanelImageSource }
/**
 * The image on top of a style B panel: the panel's own banner, then the
 * server banner, then — when the switch is on — the current map image (P7-25).
 */
export function resolvePanelBanner(input: {
    panelBannerUrl: string | null
    server: ServerBannerSettings | null
    mapImage: PanelImageSource | null
}): PanelBannerSource | null {
    if (input.panelBannerUrl)
        return {
            kind: "banner",
            origin: "panel",
            url: input.panelBannerUrl,
            publicId: null,
            crop: input.server?.crop ?? "center",
        }
    if (input.server?.url)
        return {
            kind: "banner",
            origin: "server",
            url: input.server.url,
            publicId: input.server.publicId,
            crop: input.server.crop,
        }
    return (input.server?.useMapImage ?? true) && input.mapImage
        ? { kind: "map", image: input.mapImage }
        : null
}
export type ScoreImageBackground =
    | { kind: "asset"; publicId: string; crop: BannerCrop }
    | { kind: "builtin"; game: PanelMapGame; mapKey: string }
/** The background the style B banner is drawn on: the server banner or the map (P7-25). */
export function panelBannerBackground(
    source: PanelBannerSource
): ScoreImageBackground | null {
    if (source.kind === "banner")
        return source.publicId
            ? { kind: "asset", publicId: source.publicId, crop: source.crop }
            : null
    if (source.image.kind === "override")
        return {
            kind: "asset",
            publicId: source.image.publicId,
            crop: "center",
        }
    return source.image.kind === "builtin"
        ? {
              kind: "builtin",
              game: source.image.game,
              mapKey: source.image.mapKey,
          }
        : null
}
/** Score image background: the server banner, else the map image, else plain dark (P8-06, P8-14). */
export function resolveScoreImageBackground(input: {
    server: ServerBannerSettings | null
    mapImage: PanelImageSource | null
}): ScoreImageBackground | null {
    if (input.server?.publicId)
        return {
            kind: "asset",
            publicId: input.server.publicId,
            crop: input.server.crop,
        }
    if (input.mapImage?.kind === "override")
        return {
            kind: "asset",
            publicId: input.mapImage.publicId,
            crop: "center",
        }
    if (input.mapImage?.kind === "builtin")
        return {
            kind: "builtin",
            game: input.mapImage.game,
            mapKey: input.mapImage.mapKey,
        }
    return null
}

export const PANEL_HEX_COLOR = /^#[0-9a-fA-F]{6}$/
export const DEFAULT_CLAN_ACCENT = "#e8a33d"
/**
 * Bar colour: the panel's own colour, then — in style B only — the server's
 * colour from the graphics settings, then the clan accent (P7-B08, P8-11).
 */
export function resolvePanelAccent(input: {
    style: PanelStyle
    panelAccent: string | null
    serverBarColor: string | null
    clanAccent: string | null
}): string {
    const valid = (value: string | null) =>
        value && PANEL_HEX_COLOR.test(value) ? value.toLowerCase() : null
    return (
        valid(input.panelAccent) ??
        (input.style === "b" ? valid(input.serverBarColor) : null) ??
        valid(input.clanAccent) ??
        DEFAULT_CLAN_ACCENT
    )
}

// ---- Live facts ---------------------------------------------------------

/**
 * Server state for the status icon: unreachable → offline; a running seed →
 * seeding; nobody playing → empty; else live. The seed decision itself
 * belongs to the seed workflow.
 */
export function panelServerState(input: {
    reachable: boolean
    players: number | null
    seedActive?: boolean
}): PanelServerState {
    if (!input.reachable) return "offline"
    if (input.seedActive) return "seeding"
    return (input.players ?? 0) <= 0 ? "empty" : "live"
}

export const PLAYER_GAUGE_SEGMENTS = 10
export type PlayerGauge = {
    /** Ten capacity pieces, players first. */
    segments: Exclude<PlayerGaugePiece, "queue">[]
    /** Queue pieces drawn after a gap; zero without a queue. */
    queue: number
    players: number
    capacity: number
    queueCount: number | null
}
/**
 * Ten pieces are the server capacity; a piece is a tenth of it. A non-empty
 * server shows at least one piece and a server that is not full never shows
 * ten. The queue stands after a gap (P7-27).
 */
export function playerGauge(input: {
    players: number
    capacity: number
    queue?: number | null
}): PlayerGauge | null {
    const { players, capacity } = input
    if (
        !Number.isFinite(players) ||
        !Number.isFinite(capacity) ||
        capacity <= 0 ||
        players < 0
    )
        return null
    let filled = Math.round((players / capacity) * PLAYER_GAUGE_SEGMENTS)
    if (players > 0) filled = Math.max(1, filled)
    if (players < capacity) filled = Math.min(PLAYER_GAUGE_SEGMENTS - 1, filled)
    filled = Math.min(PLAYER_GAUGE_SEGMENTS, filled)
    const queueCount =
        input.queue != null && Number.isFinite(input.queue) && input.queue >= 0
            ? Math.floor(input.queue)
            : null
    const queue = queueCount
        ? Math.min(
              PLAYER_GAUGE_SEGMENTS,
              Math.max(
                  1,
                  Math.ceil((queueCount / capacity) * PLAYER_GAUGE_SEGMENTS)
              )
          )
        : 0
    return {
        segments: Array.from({ length: PLAYER_GAUGE_SEGMENTS }, (_, i) =>
            i < filled ? "players" : "free"
        ),
        queue,
        players,
        capacity,
        queueCount,
    }
}
/** Gauge as application emoji, queue after a space; missing emoji fall back to coloured squares. */
export function playerGaugeEmoji(
    gauge: PlayerGauge,
    emoji: Partial<Record<PlayerGaugePiece, string>>
): string {
    const fallback: Record<PlayerGaugePiece, string> = {
        players: "🟩",
        queue: "🟨",
        free: "⬛",
    }
    const piece = (key: PlayerGaugePiece) => emoji[key] ?? fallback[key]
    const bar = gauge.segments.map(piece).join("")
    return gauge.queue
        ? `${bar} ${Array.from({ length: gauge.queue }, () => piece("queue")).join("")}`
        : bar
}
/** Whole minutes left, rounded up so a running round never reads 0. */
export function minutesLeft(seconds: number | null | undefined): number | null {
    if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return null
    return Math.ceil(seconds / 60)
}
/** Top three by value, then name; ties never reorder between refreshes. */
export function topPlayers<T extends { name: string; value: number | null }>(
    players: readonly T[],
    count = 3
): T[] {
    return players
        .filter((p) => p.value != null && Number.isFinite(p.value))
        .slice()
        .sort((a, b) => b.value! - a.value! || a.name.localeCompare(b.name))
        .slice(0, count)
}
/** Warfare reports captured sectors that always add up to five; anything else is a plain score. */
export function hllScoreKind(input: {
    mode: HllMode | null
    allies: number | null
    axis: number | null
}): "sectors" | "score" {
    return input.mode !== "offensive" &&
        input.mode !== "skirmish" &&
        input.allies != null &&
        input.axis != null &&
        input.allies + input.axis === 5
        ? "sectors"
        : "score"
}
export type FactionBar<F extends string> = {
    faction: F
    points: number
    /** Share of the leading faction's points, 0–100. */
    percent: number
    leading: boolean
}
/** Wardogs faction bars scaled to the leader; every faction tied for the lead is leading (P7-B07). */
export function factionBars<F extends string>(
    factions: readonly { faction: F; points: number }[]
): FactionBar<F>[] {
    const max = Math.max(0, ...factions.map((f) => f.points))
    return factions.map((f) => ({
        faction: f.faction,
        points: f.points,
        percent: max > 0 ? Math.round((Math.max(0, f.points) / max) * 100) : 0,
        leading: max > 0 && f.points === max,
    }))
}

// ---- New map ------------------------------------------------------------

export const NEW_MAP_BADGE_MS = 5 * 60_000
export type MapChangeState = { mapKey: string | null; changedAt: number | null }
/**
 * Tracks the current map; a change from one known map to another stamps
 * the time. The first observation is not a change.
 */
export function nextMapChange(
    previous: MapChangeState | null,
    mapKey: string | null,
    now: number
): MapChangeState {
    if (!previous) return { mapKey, changedAt: null }
    if (previous.mapKey === mapKey) return previous
    return {
        mapKey,
        changedAt: previous.mapKey && mapKey ? now : previous.changedAt,
    }
}
/** "Nová mapa" is shown for five minutes after a change (P7-31). */
export function isNewMap(state: MapChangeState | null, now: number): boolean {
    return (
        state?.changedAt != null &&
        now >= state.changedAt &&
        now - state.changedAt < NEW_MAP_BADGE_MS
    )
}

// ---- Image versions and attachments --------------------------------------

export const SCORE_IMAGE_MIN_INTERVAL_MS = 60_000
export const SCORE_IMAGE_WIDTH = 1200
export const SCORE_IMAGE_HEIGHT = 400

function stable(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(stable)
    if (value && typeof value === "object")
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>)
                .filter(([, v]) => v !== undefined)
                .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
                .map(([k, v]) => [k, stable(v)])
        )
    return value
}
/** Content hash of an image model; keys listed in `ignore` (such as the time stamp) do not count. */
export function panelImageInputHash(
    model: Record<string, unknown>,
    ignore: readonly string[] = ["renderedAt"]
): string {
    const rest = Object.fromEntries(
        Object.entries(model).filter(([key]) => !ignore.includes(key))
    )
    return contentHash64(JSON.stringify(stable(rest)))
}
/**
 * 64-bit content hash (cyrb53 mixing over two 32-bit lanes): deterministic,
 * dependency-free and usable in the browser. It only tells versions apart; it
 * is not a security primitive.
 */
export function contentHash64(value: string): string {
    let h1 = 0xdeadbeef,
        h2 = 0x41c6ce57
    for (let i = 0; i < value.length; i++) {
        const code = value.charCodeAt(i)
        h1 = Math.imul(h1 ^ code, 2654435761)
        h2 = Math.imul(h2 ^ code, 1597334677)
    }
    h1 =
        Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
        Math.imul(h2 ^ (h2 >>> 13), 3266489909)
    h2 =
        Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
        Math.imul(h1 ^ (h1 >>> 13), 3266489909)
    return `${(h2 >>> 0).toString(16).padStart(8, "0")}${(h1 >>> 0).toString(16).padStart(8, "0")}`
}
export type RenderedImageState = { hash: string; renderedAt: number }
export type ScoreImageDecision =
    | { action: "render" }
    | { action: "reuse"; reason: "unchanged" | "throttled" }
/**
 * Redraw only when the content changed and the previous image is at least
 * 60 s old (P7-B02, P7-22). Otherwise the previous upload stays.
 */
export function decideScoreImageRender(input: {
    previous: RenderedImageState | null
    hash: string
    now: number
    minIntervalMs?: number
}): ScoreImageDecision {
    const { previous } = input
    if (!previous) return { action: "render" }
    if (previous.hash === input.hash)
        return { action: "reuse", reason: "unchanged" }
    return input.now - previous.renderedAt <
        (input.minIntervalMs ?? SCORE_IMAGE_MIN_INTERVAL_MS)
        ? { action: "reuse", reason: "throttled" }
        : { action: "render" }
}
/** Short ASCII slug of a server name: "Vlci #1 · Public" → "vlci1". */
export function panelImageSlug(serverName: string): string {
    const head = serverName.split(/\s+[·|–-]\s+/)[0] ?? serverName
    return compact(head).slice(0, 24) || "server"
}
/**
 * Versioned attachment name, e.g. `skore-vlci1-2041-3fa9c2.png`. Discord
 * caches attachments by name, so every version gets a new one (P7-23).
 */
export function panelImageFileName(input: {
    kind: "skore" | "banner" | "mapa"
    serverName: string
    at: number
    timeZone: string
    hash: string
    extension: "png" | "webp" | "jpg"
}): string {
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: input.timeZone,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    }).formatToParts(new Date(input.at))
    const hhmm = `${parts.find((p) => p.type === "hour")?.value ?? "00"}${parts.find((p) => p.type === "minute")?.value ?? "00"}`
    const hash = input.hash
        .toLowerCase()
        .replace(/[^a-f0-9]/g, "")
        .slice(0, 6)
    return `${input.kind}-${panelImageSlug(input.serverName)}-${hhmm}-${hash || "0"}.${input.extension}`
}
export function isValidTimeZone(value: string): boolean {
    try {
        new Intl.DateTimeFormat("en", { timeZone: value })
        return true
    } catch {
        return false
    }
}

/** Discord accepts at most 10 attachments per message (P7-21, P7-B06). */
export const DISCORD_MESSAGE_ATTACHMENTS_MAX = 10
export type PlannedAttachment = {
    name: string
    role: "score" | "banner" | "thumbnail"
}
/**
 * Keeps the most important images within Discord's limit: the score image,
 * then the banner, then map thumbnails in panel order; duplicates (the same
 * file used twice) are attached once.
 */
export function planPanelAttachments<T extends PlannedAttachment>(
    items: readonly T[]
): { attached: T[]; dropped: T[] } {
    const rank = { score: 0, banner: 1, thumbnail: 2 } as const
    const unique: T[] = []
    for (const item of items)
        if (!unique.some((other) => other.name === item.name)) unique.push(item)
    const ordered = unique
        .map((item, index) => ({ item, index }))
        .sort(
            (a, b) => rank[a.item.role] - rank[b.item.role] || a.index - b.index
        )
        .map(({ item }) => item)
    return {
        attached: ordered.slice(0, DISCORD_MESSAGE_ATTACHMENTS_MAX),
        dropped: ordered.slice(DISCORD_MESSAGE_ATTACHMENTS_MAX),
    }
}

/** Discord allows five buttons in one action row. */
export const DISCORD_ROW_BUTTONS_MAX = 5
/**
 * "Naše servery": a section holds one accessory (the map thumbnail), so the
 * join buttons go in rows at the bottom, five per row, in panel order (P7-20,
 * P7-B09).
 */
export function combinedPanelJoinRows<T>(buttons: readonly T[]): T[][] {
    const rows: T[][] = []
    for (let i = 0; i < buttons.length; i += DISCORD_ROW_BUTTONS_MAX)
        rows.push(buttons.slice(i, i + DISCORD_ROW_BUTTONS_MAX))
    return rows
}
