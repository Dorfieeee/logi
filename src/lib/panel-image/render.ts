import { createMatchImageRenderer } from "./match-render"
import { readFile } from "node:fs/promises"
import { ImageResponse } from "next/og"
import path from "node:path"
import sharp from "sharp"

import {
    HLL_NATION_SVG,
    wardogsSignPath,
    WARDOGS_FACTIONS,
    type HllNation,
    type WardogsFaction,
} from "@/domain/discord-publications/panel-emblems"
import {
    panelMapDefinition,
    SCORE_IMAGE_HEIGHT,
    SCORE_IMAGE_WIDTH,
    type BannerCrop,
} from "@/domain/discord-publications/panel-graphics"
import type {
    PanelImageRequest,
    PanelScoreImage,
} from "@/domain/discord-publications/panel-image-model"
import {
    bannerImageElement,
    scoreImageElement,
    type PanelImageArt,
} from "./layout"
import { IMAGE_MAX_INPUT_BYTES } from "@/domain/assets/image-asset"

// Server-only: reads packaged art and fonts and decodes images with sharp.

export type PanelImageRenderPorts = {
    /** Directory holding `maps/`, `stratmap/` and `fonts/` (the app's `public/`). */
    publicDir: string
    /**
     * Bytes of a workspace image asset (banner or map override) by public
     * ID, or null when it is unknown or not live. Never a caller URL.
     */
    loadAsset(publicId: string): Promise<Uint8Array | null>
    loadLogo?(url: string): Promise<Uint8Array | null>
}
type Background = Exclude<
    Extract<PanelImageRequest, { kind: "score" }>["model"]["background"],
    null
>

const FONT_WEIGHTS = [400, 600, 700, 800] as const
const SHARP_LIMITS = { limitInputPixels: 8192 * 8192, animated: false } as const
const position: Record<BannerCrop, string> = {
    top: "top",
    center: "centre",
    bottom: "bottom",
}
function dataUrl(type: string, bytes: Uint8Array | Buffer) {
    return `data:${type};base64,${Buffer.from(bytes).toString("base64")}`
}

/**
 * Renders the generated panel images. Prepared art (fonts, emblems and
 * backgrounds cropped to 1200 × 400) is cached per process; the packaged map
 * art is several megabytes, so it is decoded once per map and look.
 */
export function createPanelImageRenderer(ports: PanelImageRenderPorts) {
    const match = createMatchImageRenderer({
        publicDir: ports.publicDir,
        loadLogo: ports.loadLogo ?? (async () => null),
    })
    let fonts: Promise<
        {
            name: string
            data: ArrayBuffer
            weight: (typeof FONT_WEIGHTS)[number]
            style: "normal"
        }[]
    > | null = null
    const art = new Map<string, Promise<string | null>>()
    const remember = (key: string, load: () => Promise<string | null>) => {
        let pending = art.get(key)
        if (!pending) {
            pending = load().catch(() => null)
            art.set(key, pending)
            // A small bound: maps × looks; drop the oldest beyond it.
            if (art.size > 96) art.delete(art.keys().next().value!)
        }
        return pending
    }
    const loadFonts = () =>
        (fonts ??= Promise.all(
            FONT_WEIGHTS.map(async (weight) => {
                const bytes = await readFile(
                    path.join(
                        ports.publicDir,
                        "fonts",
                        "inter",
                        `Inter-${weight}.ttf`
                    )
                )
                return {
                    name: "Inter",
                    data: bytes.buffer.slice(
                        bytes.byteOffset,
                        bytes.byteOffset + bytes.byteLength
                    ) as ArrayBuffer,
                    weight,
                    style: "normal" as const,
                }
            })
        ).catch((error) => {
            fonts = null
            throw error
        }))
    const backgroundBytes = async (background: Background) => {
        if (background.kind === "asset") {
            const bytes = await ports.loadAsset(background.publicId)
            return bytes && bytes.byteLength <= IMAGE_MAX_INPUT_BYTES
                ? bytes
                : null
        }
        // Only catalogue paths are read; the model cannot name a file.
        const map = panelMapDefinition(background.game, background.mapKey)
        return map?.builtIn
            ? await readFile(path.join(ports.publicDir, map.builtIn))
            : null
    }
    const prepare = (
        background: Background | null,
        look: "score" | "banner"
    ) =>
        background
            ? remember(
                  `${look}:${background.kind}:${background.kind === "asset" ? `${background.publicId}:${background.crop}` : `${background.game}:${background.mapKey}`}`,
                  async () => {
                      const bytes = await backgroundBytes(background)
                      if (!bytes) return null
                      let image = sharp(bytes, SHARP_LIMITS)
                          .rotate()
                          .resize({
                              width: SCORE_IMAGE_WIDTH,
                              height: SCORE_IMAGE_HEIGHT,
                              fit: "cover",
                              position:
                                  background.kind === "asset"
                                      ? position[background.crop]
                                      : "centre",
                          })
                      // The board darkens the map behind the scoreboard.
                      if (look === "score")
                          image = image.modulate({
                              brightness: 0.55,
                              saturation: 0.9,
                          })
                      return dataUrl(
                          "image/jpeg",
                          await image.jpeg({ quality: 82 }).toBuffer()
                      )
                  }
              )
            : Promise.resolve(null)
    const nation = (key: HllNation) =>
        remember(`nation:${key}`, async () =>
            dataUrl("image/svg+xml", Buffer.from(HLL_NATION_SVG[key]))
        )
    const faction = (key: WardogsFaction) =>
        remember(`faction:${key}`, async () =>
            dataUrl(
                "image/png",
                await sharp(
                    await readFile(
                        path.join(ports.publicDir, wardogsSignPath(key))
                    )
                )
                    .resize(108, 108, {
                        fit: "contain",
                        background: { r: 0, g: 0, b: 0, alpha: 0 },
                    })
                    .png()
                    .toBuffer()
            )
        )
    async function scoreArt(model: PanelScoreImage): Promise<PanelImageArt> {
        const nations: PanelImageArt["nations"] = {}
        const factions: PanelImageArt["factions"] = {}
        if (model.game === "hell_let_loose")
            for (const key of new Set([
                model.allies.nation,
                model.axis.nation,
            ])) {
                const src = await nation(key)
                if (src) nations[key] = src
            }
        else
            for (const key of WARDOGS_FACTIONS) {
                const src = await faction(key)
                if (src) factions[key] = src
            }
        return {
            background: await prepare(model.background, "score"),
            nations,
            factions,
        }
    }
    return {
        /** PNG bytes of one validated request; at most 1200 × 400. */
        async render(request: PanelImageRequest): Promise<Uint8Array> {
            if (request.kind === "match") return match(request.model)
            const element =
                request.kind === "score"
                    ? scoreImageElement(
                          request.model,
                          await scoreArt(request.model)
                      )
                    : bannerImageElement(request.model, {
                          background: await prepare(
                              request.model.background,
                              "banner"
                          ),
                      })
            const response = new ImageResponse(element, {
                width: SCORE_IMAGE_WIDTH,
                height: SCORE_IMAGE_HEIGHT,
                fonts: await loadFonts(),
            })
            // Re-encode as a palette PNG: visually the same, about a third of
            // the size, so a re-upload every minute stays cheap.
            return new Uint8Array(
                await sharp(new Uint8Array(await response.arrayBuffer()))
                    .png({
                        palette: true,
                        quality: 95,
                        effort: 7,
                        dither: 0.6,
                        compressionLevel: 9,
                    })
                    .toBuffer()
            )
        },
    }
}
