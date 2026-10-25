import { matchImageSchema } from "../events/match-image.schema"
import { z } from "zod"

import {
    BANNER_CROPS,
    HLL_LIGHTINGS,
    HLL_MODES,
    PANEL_HEX_COLOR,
    hllScoreKind,
    isValidTimeZone,
    minutesLeft,
    panelImageInputHash,
} from "./panel-graphics"
import {
    HLL_NATION_SIDE,
    HLL_NATIONS,
    PANEL_SERVER_STATES,
    WARDOGS_FACTIONS,
    type HllNation,
} from "./panel-emblems"
import { panelMapGameSchema, panelMapKeySchema } from "./panel-graphics.schema"
import { PANEL_IMAGE_LANGUAGES, panelImageCopy } from "./panel-image-copy"

/**
 * The generated panel images (style A score image, style B banner) as a
 * validated, provider-independent model. The panel worker fills it from live
 * data; the renderer draws exactly this and nothing else. It never carries a
 * server password, a token or a provider URL.
 */

const CONTROL = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/
/** Visible text: no control characters, trimmed, bounded. */
const text = (max: number) =>
    z
        .string()
        .min(1)
        .max(max)
        .refine((value) => !CONTROL.test(value) && value.trim() === value)
const count = z.number().int().min(0).max(1_000_000)
/** Cleans provider text for the model: control characters become spaces, then trimmed and cut. */
export function panelImageText(value: string | null | undefined, max = 48) {
    const clean = (value ?? "")
        .replace(new RegExp(CONTROL.source, "g"), " ")
        .replace(/\s+/g, " ")
        .trim()
    return clean ? Array.from(clean).slice(0, max).join("") : null
}

const background = z
    .discriminatedUnion("kind", [
        z.strictObject({
            kind: z.literal("builtin"),
            game: panelMapGameSchema,
            mapKey: panelMapKeySchema,
        }),
        z.strictObject({
            kind: z.literal("asset"),
            publicId: z.string().regex(/^[a-f0-9]{32}$/),
            crop: z.enum(BANNER_CROPS),
        }),
    ])
    .nullable()
const base = {
    version: z.literal(1),
    language: z.enum(PANEL_IMAGE_LANGUAGES),
    timeZone: z.string().min(1).max(64).refine(isValidTimeZone),
    /** When the data was read; drawn in the corner, ignored by the content hash. */
    renderedAt: z.iso.datetime(),
    accentColor: z.string().regex(PANEL_HEX_COLOR),
    serverName: text(64),
    state: z.enum(PANEL_SERVER_STATES),
    newMap: z.boolean(),
    map: z
        .strictObject({ name: text(48), key: z.string().max(40).nullable() })
        .nullable(),
    background,
    players: z
        .strictObject({
            count,
            capacity: count.min(1),
            queue: count.nullable(),
        })
        .nullable(),
    /**
     * The panel's "Skóre" switch. Off is the server-status look (L3-33,
     * L3-43): no score, no leaders, the player count in their place. A
     * request without it (an older bot) draws the score as before.
     */
    scoreboard: z.boolean().default(true),
    /** A running seed's live threshold: the image shows the progress toward it (P4-18). */
    seedTarget: count.min(1).max(1000).nullable().default(null),
}
const leader = <S extends z.ZodTypeAny>(side: S) =>
    z.strictObject({ name: text(32), value: count, side })
export const hllScoreImageSchema = z.strictObject({
    ...base,
    game: z.literal("hell_let_loose"),
    leaders: z.array(leader(z.enum(["allies", "axis"]).nullable())).max(3),
    mode: z.enum(HLL_MODES).nullable(),
    /** Only when the server reports it; never guessed. */
    lighting: z.enum(HLL_LIGHTINGS).nullable(),
    timeLeftSeconds: z.number().min(0).max(86_400).nullable(),
    nextMap: z
        .strictObject({
            name: text(48),
            lighting: z.enum(HLL_LIGHTINGS).nullable(),
        })
        .nullable(),
    allies: z.strictObject({
        nation: z.enum(HLL_NATIONS),
        score: count.max(1000).nullable(),
    }),
    axis: z.strictObject({
        nation: z.enum(HLL_NATIONS),
        score: count.max(1000).nullable(),
    }),
})
export const wardogsScoreImageSchema = z.strictObject({
    ...base,
    game: z.literal("wardogs"),
    leaders: z.array(leader(z.enum(WARDOGS_FACTIONS).nullable())).max(3),
    joinCode: z
        .string()
        .regex(/^[A-Za-z0-9-]{1,24}$/)
        .nullable(),
    factions: z
        .array(
            z.strictObject({
                faction: z.enum(WARDOGS_FACTIONS),
                points: z.number().int().min(-1_000_000).max(1_000_000),
            })
        )
        .max(3)
        .refine(
            (rows) =>
                new Set(rows.map((row) => row.faction)).size === rows.length
        ),
    topCash: z
        .strictObject({
            name: text(32),
            value: z.number().int().min(-1_000_000_000).max(1_000_000_000),
        })
        .nullable(),
})
export const panelScoreImageSchema = z
    .discriminatedUnion("game", [hllScoreImageSchema, wardogsScoreImageSchema])
    .refine(
        (model) =>
            model.game !== "hell_let_loose" ||
            (HLL_NATION_SIDE[model.allies.nation] === "allies" &&
                HLL_NATION_SIDE[model.axis.nation] === "axis"),
        "Nations must belong to their side."
    )
export type PanelScoreImage = z.infer<typeof panelScoreImageSchema>
export type HllScoreImage = z.infer<typeof hllScoreImageSchema>
export type WardogsScoreImage = z.infer<typeof wardogsScoreImageSchema>

/** Style B banner: the server banner (or map image) with the clan badge and name. */
export const panelBannerImageSchema = z.strictObject({
    version: z.literal(1),
    language: z.enum(PANEL_IMAGE_LANGUAGES),
    accentColor: z.string().regex(PANEL_HEX_COLOR),
    clanTag: text(5),
    clanName: text(40),
    subtitle: text(80),
    background,
})
export type PanelBannerImage = z.infer<typeof panelBannerImageSchema>

export const panelImageRequestSchema = z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("match"), model: matchImageSchema }),
    z.strictObject({ kind: z.literal("score"), model: panelScoreImageSchema }),
    z.strictObject({
        kind: z.literal("banner"),
        model: panelBannerImageSchema,
    }),
])
export type PanelImageRequest = z.infer<typeof panelImageRequestSchema>
/** Content hash of a request; the corner time stamp alone never forces a new image. */
export function panelImageRequestHash(request: PanelImageRequest): string {
    return panelImageInputHash({
        kind: request.kind,
        ...(request.model as Record<string, unknown>),
    })
}

/** The nation sign a leader carries: their side's nation on this map. */
export function hllLeaderNation(
    model: Pick<HllScoreImage, "allies" | "axis">,
    side: "allies" | "axis" | null
): HllNation | null {
    return side ? model[side].nation : null
}
export function hllScoreLayout(model: HllScoreImage) {
    return hllScoreKind({
        mode: model.mode,
        allies: model.allies.score,
        axis: model.axis.score,
    })
}
/** The seed threshold the image draws progress toward, only while seeding. */
export function panelImageSeedTarget(
    model: Pick<PanelScoreImage, "state" | "seedTarget">
): number | null {
    return model.state === "seeding" ? (model.seedTarget ?? null) : null
}

/**
 * What the right half of the score image shows (P4-16, P4-18, L3-33): the
 * seed progress while a seed runs, the empty sentence on an empty server,
 * the player count in server-status mode, else the score.
 */
export type PanelImageFocus = "score" | "status" | "seed" | "empty"
export function panelImageFocus(
    model: Pick<PanelScoreImage, "state" | "seedTarget" | "scoreboard">
): PanelImageFocus {
    if (panelImageSeedTarget(model) !== null) return "seed"
    if (model.state === "empty") return "empty"
    return model.scoreboard ? "score" : "status"
}

/** The state chip's word: "Online" for a server-status panel that is up (L3-43). */
export function panelImageStateWord(
    model: Pick<PanelScoreImage, "state" | "scoreboard" | "language">
): string {
    const copy = panelImageCopy(model.language)
    return model.state === "live" && !model.scoreboard
        ? copy.online
        : copy.state[model.state]
}

/** Grouped digits in the clan language ("3 655"). */
export function formatPanelNumber(value: number, language: string) {
    return new Intl.NumberFormat(panelImageCopy(language).locale, {
        maximumFractionDigits: 0,
    }).format(value)
}

/**
 * Alt text for the score image attachment, so the panel stays readable for
 * screen readers (P7-10, P7-30). Discord allows up to 1024 characters.
 */
export function panelScoreImageAlt(model: PanelScoreImage): string {
    const copy = panelImageCopy(model.language)
    const parts: string[] = [model.serverName]
    if (model.map) parts.push(model.map.name)
    if (model.game === "hell_let_loose") {
        if (model.mode) parts.push(copy.mode[model.mode])
        if (model.lighting) parts.push(copy.lighting[model.lighting])
    }
    parts.push(panelImageStateWord(model).toLowerCase())
    if (model.game === "hell_let_loose") {
        const minutes = minutesLeft(model.timeLeftSeconds)
        if (minutes != null) parts.push(copy.alt.minutes(minutes))
    }
    if (model.players) {
        const players = copy.alt.playersOf(
            model.players.count,
            model.players.capacity
        )
        parts.push(
            model.players.queue
                ? `${players} ${model.language === "cs" ? "a" : model.language === "de" ? "und" : "and"} ${copy.alt.queue(model.players.queue)}`
                : players
        )
    }
    const target = panelImageSeedTarget(model)
    if (target !== null) parts.push(copy.seedTo(target))
    if (model.state === "empty")
        parts.push(copy.emptyTitle.replace(/[.!]$/, ""))
    const scored = panelImageFocus(model) === "score"
    if (model.game === "hell_let_loose") {
        if (scored && model.allies.score != null && model.axis.score != null)
            parts.push(
                `${copy.allies} ${model.allies.score} : ${model.axis.score} ${copy.axis}`
            )
    } else if (scored && model.factions.length) {
        const factions = model.factions.map(
            (f) =>
                `${copy.wardogs[f.faction]} ${formatPanelNumber(f.points, model.language)}`
        )
        const last = factions.pop()!
        parts.push(...factions, copy.alt.points(last))
    }
    // The Wardogs image text names factions; its leaders stay in the message text.
    if (scored && model.game === "hell_let_loose" && model.leaders.length)
        parts.push(
            copy.alt.topKills(
                model.leaders.map((p) => `${p.name} ${p.value}`).join(", ")
            )
        )
    return Array.from(copy.alt.score(parts)).slice(0, 1024).join("")
}
export function panelBannerImageAlt(model: PanelBannerImage): string {
    return panelImageCopy(model.language).alt.banner(
        `${model.clanName} · ${model.subtitle}`
    )
}
