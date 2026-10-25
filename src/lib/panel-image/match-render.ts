import {
    panelMapDefinition,
    panelMapKey,
} from "@/domain/discord-publications/panel-graphics"
import { panelImageCopy } from "@/domain/discord-publications/panel-image-copy"
import { matchImageCopy, type MatchImage } from "@/domain/events/match-image"
import sharp, { type OverlayOptions } from "sharp"
import { readFile } from "node:fs/promises"
import path from "node:path"

const W = 1200
const H = 675
const escape = (s: string) =>
    s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
const text = (
    s: string,
    x: number,
    y: number,
    size: number,
    fill = "#ffffff",
    weight = 500,
    maxWidth = 1000,
    anchor = "middle"
) =>
    `<text x="${x}" y="${y}" font-family="Arial, sans-serif" font-size="${Math.min(size, maxWidth / Math.max(1, Array.from(s).length * 0.64))}" fill="${fill}" font-weight="${weight}" text-anchor="${anchor}">${escape(s)}</text>`

/** Deterministic local composition: catalogue map art, bounded logos, escaped text. */
export function createMatchImageRenderer(ports: {
    publicDir: string
    loadLogo(url: string): Promise<Uint8Array | null>
}) {
    const cached = new Map<string, Promise<Buffer | null>>()
    const remember = (key: string, read: () => Promise<Buffer | null>) => {
        let value = cached.get(key)
        if (!value) {
            value = read().catch(() => {
                cached.delete(key)
                return null
            })
            cached.set(key, value)
            if (cached.size > 96) cached.delete(cached.keys().next().value!)
        }
        return value
    }
    const packaged = (file: string, width: number, height: number) =>
        remember(`${file}:${width}:${height}`, async () =>
            sharp(await readFile(path.join(ports.publicDir, file)), {
                limitInputPixels: 8192 * 8192,
            })
                .resize(width, height, {
                    fit: "contain",
                    background: "transparent",
                })
                .png()
                .toBuffer()
        )
    return async (model: MatchImage): Promise<Uint8Array> => {
        const layers: OverlayOptions[] = []
        const map = panelMapDefinition(
            model.game,
            panelMapKey(model.game, model.map)
        )
        const background = map?.builtIn
            ? await remember(`map:${map.builtIn}`, async () =>
                  sharp(
                      await readFile(path.join(ports.publicDir, map.builtIn!))
                  )
                      .resize(W, H, { fit: "cover" })
                      .png()
                      .toBuffer()
              )
            : null
        if (background) layers.push({ input: background })
        const copy = matchImageCopy(model.language)
        let svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#10151d" stop-opacity=".68"/><stop offset=".5" stop-color="#10151d" stop-opacity=".78"/><stop offset="1" stop-color="#10151d" stop-opacity=".98"/></linearGradient></defs><rect width="1200" height="675" fill="${background ? "url(#shade)" : "#313338"}"/>`
        svg += text(
            model.gameName.toUpperCase(),
            625,
            51,
            16,
            "#c7ced8",
            600,
            600
        )
        svg += text(model.league || model.title, 600, 94, 27, "#ffffff", 700)
        if (model.category)
            svg += text(
                model.category.toUpperCase(),
                600,
                122,
                14,
                "#b8c3d1",
                600
            )
        const positions =
            model.teams.length === 1
                ? [600]
                : model.teams.length === 2
                  ? [365, 835]
                  : [275, 600, 925]
        model.teams.forEach((team, i) => {
            const x = positions[i]!
            svg += `<circle cx="${x}" cy="220" r="75" fill="#141a23" fill-opacity=".65" stroke="#ffffff" stroke-opacity=".13"/>`
            svg += text(
                (team.code || team.name).slice(0, 3).toUpperCase(),
                x,
                237,
                37,
                "#97d8c2",
                700,
                120
            )
            svg += text(team.code || team.name, x, 337, 36, "#ffffff", 700, 275)
            if (team.code)
                svg += text(
                    team.name.length > 38
                        ? team.name.slice(0, 37) + "…"
                        : team.name,
                    x,
                    365,
                    14,
                    "#c0c8d2",
                    500,
                    275
                )
            if (model.result && team.score !== null)
                svg += text(String(team.score), x, 410, 35, "#ffffff", 700, 250)
            if (i < positions.length - 1)
                svg += text(
                    "VS",
                    (x + positions[i + 1]!) / 2,
                    236,
                    19,
                    "#adb7c4",
                    700
                )
        })
        const locale =
            model.language === "cs"
                ? "cs-CZ"
                : model.language === "de"
                  ? "de-DE"
                  : "en-GB"
        const date = new Intl.DateTimeFormat(locale, {
            timeZone: model.timeZone,
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric",
        }).format(new Date(model.meetingStart))
        const time = (value: string) =>
            new Intl.DateTimeFormat(locale, {
                timeZone: model.timeZone,
                hour: "2-digit",
                minute: "2-digit",
                hourCycle: "h23",
            }).format(new Date(value))
        const gameDate = new Intl.DateTimeFormat(locale, {
            timeZone: model.timeZone,
            day: "numeric",
            month: "short",
        }).format(new Date(model.gameStart))
        const crossesDay =
            new Intl.DateTimeFormat("en-CA", {
                timeZone: model.timeZone,
            }).format(new Date(model.meetingStart)) !==
            new Intl.DateTimeFormat("en-CA", {
                timeZone: model.timeZone,
            }).format(new Date(model.gameStart))
        if (model.result) {
            const color =
                model.result.outcome === "win"
                    ? "#97d8c2"
                    : model.result.outcome === "loss"
                      ? "#f2a3a3"
                      : "#d4dbe4"
            svg += text(
                model.result.outcome ? copy[model.result.outcome] : copy.result,
                600,
                489,
                43,
                color,
                700
            )
            svg += text(model.clanName, 600, 518, 16, color, 600)
            svg += text(model.result.scores, 600, 550, 18, "#d4dbe4", 500, 1080)
            svg += text(date, 600, 582, 16, "#b8c3d1")
        } else {
            svg += `<line x1="390" x2="810" y1="402" y2="402" stroke="#ffffff" stroke-opacity=".15"/>`
            svg += text(date.toUpperCase(), 600, 442, 18, "#d4dbe4", 600)
            svg += text(copy.meeting, 600, 475, 14, "#97d8c2", 700)
            svg += text(time(model.meetingStart), 600, 534, 59, "#ffffff", 700)
            svg += text(
                `${copy.start}  ${crossesDay ? gameDate + " " : ""}${time(model.gameStart)}  ·  ${model.timeZone}`,
                600,
                570,
                18,
                "#d4dbe4"
            )
        }
        const mode = /(?:^|_)(warfare|offensive|skirmish)(?:_|$)/i
            .exec(model.map ?? "")?.[1]
            ?.toLowerCase()
        const modes = panelImageCopy(model.language).mode
        const modeLabel =
            mode === "warfare" || mode === "offensive" || mode === "skirmish"
                ? modes[mode]
                : null
        svg += text(
            [
                map?.name ?? model.map,
                model.cap,
                modeLabel,
                model.league ? model.title : null,
            ]
                .filter(Boolean)
                .join(" · "),
            600,
            613,
            15,
            "#adb7c4"
        )
        svg += text(
            "Powered by Logi",
            1134,
            651,
            12,
            "#adb7c4",
            400,
            200,
            "end"
        )
        svg +=
            '<rect x="1142" y="633" width="26" height="26" rx="5" fill="#c9a84e"/></svg>'
        layers.push({ input: Buffer.from(svg) })
        await Promise.all(
            model.teams.map(async (team, i) => {
                if (!team.logoUrl) return
                const logo = await remember(
                    `logo:${team.logoUrl}`,
                    async () => {
                        const bytes = await ports.loadLogo(team.logoUrl!)
                        return bytes
                            ? sharp(bytes, {
                                  limitInputPixels: 8192 * 8192,
                                  animated: false,
                              })
                                  .rotate()
                                  .resize(126, 126, {
                                      fit: "contain",
                                      background: "transparent",
                                  })
                                  .png()
                                  .toBuffer()
                            : null
                    }
                )
                if (logo) {
                    // Cover the initials only after successfully decoding a real logo.
                    layers.push({
                        input: Buffer.from(
                            `<svg width="140" height="140"><circle cx="70" cy="70" r="70" fill="#202630"/></svg>`
                        ),
                        left: positions[i]! - 70,
                        top: 150,
                    })
                    layers.push({
                        input: logo,
                        left: positions[i]! - 63,
                        top: 157,
                    })
                }
            })
        )
        const icons: Record<string, string> = {
            hell_let_loose: "img/games/hll.jpg",
            hell_let_loose_vietnam: "img/games/hllv.png",
            wardogs: "stratmap/icons/wardogs/wardogs.webp",
            world_of_warcraft_forever: "img/games/wowf.png",
        }
        const icon = icons[model.game]
            ? await packaged(icons[model.game]!, 36, 36)
            : null
        if (icon)
            layers.push({
                input: icon,
                left: 600 - Math.min(300, model.gameName.length * 5) - 38,
                top: 26,
            })
        const logi = await packaged("favicon.svg", 22, 22)
        if (logi) layers.push({ input: logi, left: 1144, top: 635 })
        return new Uint8Array(
            await sharp({
                create: {
                    width: W,
                    height: H,
                    channels: 4,
                    background: "#313338",
                },
            })
                .composite(layers)
                .png()
                .toBuffer()
        )
    }
}
