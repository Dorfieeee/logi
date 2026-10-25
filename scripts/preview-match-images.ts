/** Local-only synthetic previews. Does not read secrets or contact Discord/Convex. */
import {
    buildMatchImage,
    type MatchImageInput,
} from "../src/domain/events/match-image"
import { createMatchImageRenderer } from "../src/lib/panel-image/match-render"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"

const out = path.resolve("output/match-image-previews")
const badges = new Map([
    ["sample:clan", "#97d8c2"],
    ["sample:wolf", "#b7c9f2"],
    ["sample:raven", "#e5bc8d"],
])
const render = createMatchImageRenderer({
    publicDir: path.resolve("public"),
    loadLogo: async (url) => {
        const color = badges.get(url)
        if (!color) return null
        return Buffer.from(
            `<svg width="140" height="140" xmlns="http://www.w3.org/2000/svg"><path d="M70 10L120 35L110 100L70 130L30 100L20 35Z" fill="none" stroke="${color}" stroke-width="7"/><path d="M45 55L70 80L95 45M70 80V105" fill="none" stroke="${color}" stroke-width="6"/></svg>`
        )
    },
})
const teams: NonNullable<MatchImageInput["event"]["matchTeams"]> = [
    {
        teamId: "clan",
        slot: "a",
        side: "Valkyra",
        snapshot: {
            name: "Your Clan",
            shortCode: "CLN",
            logoUrl: "sample:clan",
        },
    },
    {
        teamId: "wolves",
        slot: "b",
        side: "Manticore",
        snapshot: {
            name: "Wolfpack",
            shortCode: "WLF",
            logoUrl: "sample:wolf",
        },
    },
    {
        teamId: "ravens",
        slot: "c",
        side: "Lonestar",
        snapshot: { name: "Ravens", shortCode: "RAV", logoUrl: "sample:raven" },
    },
]
const base: MatchImageInput = {
    event: {
        name: "Sunday Match",
        gameId: "hell_let_loose",
        map: "Carentan_warfare_day",
        cap: "50 vs 50",
        matchType: "friendly",
        meetingStart: "2026-10-25T18:30:00.000Z",
        gameStart: "2026-10-25T19:00:00.000Z",
    },
    clan: { name: "Your Clan" },
    ownTeam: {
        id: "clan",
        name: "Your Clan",
        shortCode: "CLN",
        logoUrl: "sample:clan",
    },
    categories: [
        { id: "friendly", label: "Friendly match" },
        { id: "league", label: "League match" },
    ],
    language: "en",
    timeZone: "Europe/Prague",
}
async function main() {
    await mkdir(out, { recursive: true })
    const league: MatchImageInput = {
        ...base,
        league: "Wardogs League · Round 04",
        event: {
            ...base.event,
            gameId: "wardogs",
            cap: "3 teams",
            name: "CLN vs WLF vs RAV",
            map: "Ozeti",
            matchType: "league",
            matchTeams: teams,
        },
    }
    const variants: Array<[string, MatchImageInput]> = [
        ["01-clan-only.png", base],
        [
            "02-two-teams-hll.png",
            {
                ...base,
                event: {
                    ...base.event,
                    name: "CLN vs WLF",
                    map: "Foy",
                    matchTeams: teams.slice(0, 2),
                },
            },
        ],
        ["03-three-teams-wardogs-league.png", league],
        [
            "04-no-map-gray.png",
            {
                ...base,
                event: {
                    ...base.event,
                    name: "CLN vs WLF",
                    map: undefined,
                    matchTeams: teams.slice(0, 2),
                },
            },
        ],
        [
            "05-victory.png",
            {
                ...league,
                result: {
                    participants: [
                        { label: "Valkyra", score: 300 },
                        { label: "Manticore", score: 200 },
                        { label: "Lonestar", score: 100 },
                    ],
                },
            },
        ],
        [
            "06-defeat.png",
            {
                ...base,
                event: {
                    ...base.event,
                    name: "CLN vs WLF",
                    matchTeams: teams.slice(0, 2).map((t, i) => ({
                        ...t,
                        side: i === 0 ? "Allies" : "Axis",
                    })),
                },
                result: {
                    participants: [
                        { label: "Allies", score: 1 },
                        { label: "Axis", score: 4 },
                    ],
                },
            },
        ],
    ]
    const start = performance.now()
    for (const [name, input] of variants)
        await writeFile(
            path.join(out, name),
            await render(buildMatchImage(input))
        )
    await sharp({
        create: {
            width: 1200,
            height: 1014,
            channels: 4,
            background: "#17191e",
        },
    })
        .composite(
            await Promise.all(
                variants.map(async ([name], i) => ({
                    input: await sharp(path.join(out, name))
                        .resize(600, 337)
                        .toBuffer(),
                    left: (i % 2) * 600,
                    top: Math.floor(i / 2) * 338,
                }))
            )
        )
        .png()
        .toFile(path.join(out, "all-variants.png"))
    await writeFile(
        path.join(out, "index.html"),
        `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Logi match image previews</title><style>body{background:#17191e;color:#fff;font:16px system-ui;margin:24px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(420px,1fr));gap:24px}figure{margin:0}img{width:100%;height:auto;border-radius:12px}figcaption{margin:8px;color:#bcc4cd}</style><h1>Logi match images</h1><p>Synthetic teams · real packaged map and game artwork · production renderer</p><main>${variants.map(([name]) => `<figure><img src="${name}" alt="${name}"><figcaption>${name}</figcaption></figure>`).join("")}</main></html>`
    )
    console.log(
        `Rendered ${variants.length} previews in ${Math.round(performance.now() - start)} ms: ${out}`
    )
}
void main()
