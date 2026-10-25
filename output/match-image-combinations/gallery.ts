/** Local synthetic gallery; uses the production renderer, without network services. */
import {
    buildMatchImage,
    type MatchImageInput,
} from "../../src/domain/events/match-image"
import { createMatchImageRenderer } from "../../src/lib/panel-image/match-render"
import { mkdir, writeFile, readFile } from "node:fs/promises"
import { createServer } from "node:http"
import path from "node:path"
import sharp from "sharp"

const out = path.resolve("output/match-image-combinations")
const colors: Record<string, string> = {
    clan: "#97d8c2",
    wolf: "#b7c9f2",
    raven: "#e5bc8d",
}
const render = createMatchImageRenderer({
    publicDir: path.resolve("public"),
    loadLogo: async (url) => {
        const color = colors[url]
        return color
            ? Buffer.from(
                  `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="140"><path d="M70 10L120 35L110 100L70 130L30 100L20 35Z" fill="none" stroke="${color}" stroke-width="7"/><path d="M45 55L70 80L95 45M70 80V105" fill="none" stroke="${color}" stroke-width="6"/></svg>`
              )
            : null
    },
})
type Options = {
    game?: string
    teams?: string
    background?: string
    league?: string
    category?: string
    logos?: string
    codes?: string
    language?: string
    state?: string
    timezone?: string
    timing?: string
    names?: string
    home?: string
}
const choices: Record<keyof Options, readonly string[]> = {
    game: [
        "hell_let_loose",
        "wardogs",
        "hell_let_loose_vietnam",
        "world_of_warcraft_forever",
    ],
    teams: ["0", "1", "2", "3", "opponent-only"],
    background: ["map", "none", "unknown"],
    league: ["off", "on"],
    category: ["friendly", "league", "none"],
    logos: ["all", "none", "mixed"],
    codes: ["on", "off"],
    language: ["en", "cs", "de"],
    state: [
        "scheduled",
        "victory",
        "defeat",
        "draw",
        "unknown",
        "missing-score",
    ],
    timezone: [
        "Europe/Prague",
        "Europe/London",
        "America/New_York",
        "Australia/Sydney",
        "UTC",
    ],
    timing: ["winter", "summer", "midnight"],
    names: ["normal", "long"],
    home: ["first", "last"],
}
function options(raw: Options): Required<Options> {
    return Object.fromEntries(
        Object.entries(choices).map(([key, values]) => [
            key,
            values.includes(raw[key as keyof Options] ?? "")
                ? raw[key as keyof Options]
                : values[0],
        ])
    ) as Required<Options>
}
function model(raw: Options) {
    const o = options(raw),
        wardogs = o.game === "wardogs"
    const sides = wardogs
        ? ["Valkyra", "Manticore", "Lonestar"]
        : ["Allies", "Axis"]
    const wanted = o.teams === "opponent-only" ? 2 : Number(o.teams)
    const count = Math.max(1, Math.min(wardogs ? 3 : 2, wanted))
    const names =
        o.names === "long"
            ? [
                  "Central European Community Expeditionary Regiment",
                  "International Combined Arms Operations Battalion",
                  "Northern Alliance Competitive Gaming Community",
              ]
            : ["Your Clan", "Wolfpack", "Ravens"]
    const codes = ["CLN", "WLF", "RAV"],
        logos = ["clan", "wolf", "raven"]
    const assigned: NonNullable<MatchImageInput["event"]["matchTeams"]> =
        Array.from({ length: count }, (_, i) => ({
            teamId: String(i),
            slot: (["a", "b", "c"] as const)[i]!,
            side: sides[i]!,
            snapshot: {
                name: names[i]!,
                shortCode: o.codes === "on" ? codes[i]! : null,
                logoUrl:
                    o.logos === "none" || (o.logos === "mixed" && i > 0)
                        ? null
                        : logos[i]!,
            },
        }))
    const ownIndex = o.home === "last" ? count - 1 : 0
    const own = assigned[ownIndex]!
    const timing =
        o.timing === "summer"
            ? ["2026-07-25T18:30:00Z", "2026-07-25T19:00:00Z"]
            : o.timing === "midnight"
              ? ["2026-10-25T22:45:00Z", "2026-10-25T23:15:00Z"]
              : ["2026-10-25T18:30:00Z", "2026-10-25T19:00:00Z"]
    const resultSides =
        wanted === 0 || count === 1 ? sides : sides.slice(0, count)
    const result =
        o.state === "scheduled"
            ? null
            : {
                  participants: resultSides.map((side, i) => ({
                      id: side.toLowerCase(),
                      label: side,
                      score:
                          o.state === "missing-score" && i === 0
                              ? null
                              : o.state === "draw"
                                ? 200
                                : o.state === "victory"
                                  ? i === ownIndex
                                      ? 300
                                      : 100
                                  : i === ownIndex
                                    ? 100
                                    : 300,
                  })),
              }
    return buildMatchImage({
        clan: { name: o.home === "last" ? names[ownIndex]! : "Your Clan" },
        ownTeam: {
            id: own.teamId,
            name: own.snapshot.name,
            shortCode: own.snapshot.shortCode,
            logoUrl: own.snapshot.logoUrl,
        },
        language: o.language as "en" | "cs" | "de",
        timeZone: o.timezone,
        categories: [
            {
                id: "friendly",
                label:
                    o.language === "cs"
                        ? "Přátelský zápas"
                        : o.language === "de"
                          ? "Freundschaftsspiel"
                          : "Friendly match",
            },
            {
                id: "league",
                label:
                    o.language === "cs"
                        ? "Ligový zápas"
                        : o.language === "de"
                          ? "Ligaspiel"
                          : "League match",
            },
        ],
        league:
            o.league === "on"
                ? `${wardogs ? "Wardogs" : "Community"} League · Round 04`
                : null,
        event: {
            name:
                wanted === 0 || count === 1
                    ? "Sunday Match"
                    : assigned
                          .map((t) => t.snapshot.shortCode || t.snapshot.name)
                          .join(" vs "),
            gameId: o.game,
            cap: wardogs ? `${count} teams` : "50 vs 50",
            map:
                o.background === "none"
                    ? undefined
                    : o.background === "unknown"
                      ? "Unlisted map"
                      : wardogs
                        ? "Ozeti"
                        : o.game === "hell_let_loose"
                          ? "Carentan_warfare_day"
                          : "Unlisted map",
            matchType: o.category === "none" ? undefined : o.category,
            meetingStart: timing[0]!,
            gameStart: timing[1]!,
            side: o.state === "unknown" ? undefined : sides[ownIndex],
            matchTeams:
                wanted === 0
                    ? []
                    : (o.teams === "opponent-only"
                          ? assigned.slice(1)
                          : assigned
                      ).map((t) =>
                          o.state === "unknown" ? { ...t, side: null } : t
                      ),
        },
        result,
    })
}
type Sample = { title: string; group: string; options: Options; file?: string }
const samples: Sample[] = []
for (const [game, counts] of [
    ["hell_let_loose", [0, 1, 2]],
    ["wardogs", [0, 1, 2, 3]],
] as const)
    for (const teams of counts)
        for (const background of ["map", "none"])
            samples.push({
                title: `${game === "wardogs" ? "Wardogs" : "HLL"} · ${teams === 0 ? "No assigned teams" : `${teams} assigned team${teams === 1 ? "" : "s"}`} · ${background === "map" ? "Map" : "Gray"}`,
                group: "Layouts",
                options: { game, teams: String(teams), background },
            })
for (const game of ["hell_let_loose", "wardogs"])
    for (const state of [
        "victory",
        "defeat",
        "draw",
        "unknown",
        "missing-score",
    ])
        samples.push({
            title: `${game === "wardogs" ? "Wardogs · 3 teams" : "HLL · 2 teams"} · ${state}`,
            group: "Results",
            options: {
                game,
                teams: game === "wardogs" ? "3" : "2",
                state,
                league: "on",
                category: "league",
            },
        })
const extras: Array<[string, Options]> = [
    [
        "League · 2 teams · map",
        { teams: "2", league: "on", category: "league" },
    ],
    [
        "League · 3 teams · gray",
        {
            game: "wardogs",
            teams: "3",
            background: "none",
            league: "on",
            category: "league",
        },
    ],
    ["Category without league heading", { teams: "2", category: "league" }],
    ["No category", { teams: "2", category: "none" }],
    [
        "League heading without category",
        { teams: "2", league: "on", category: "none" },
    ],
    [
        "Missing all logos · initials",
        { game: "wardogs", teams: "3", logos: "none" },
    ],
    ["Only clan has a logo", { game: "wardogs", teams: "3", logos: "mixed" }],
    [
        "No short codes · full names",
        { game: "wardogs", teams: "3", codes: "off" },
    ],
    [
        "No logos or short codes",
        { game: "wardogs", teams: "3", logos: "none", codes: "off" },
    ],
    [
        "No catalogue identity · clan fallback",
        { teams: "0", logos: "none", codes: "off" },
    ],
    ["Opponent-only legacy record", { teams: "opponent-only" }],
    ["Unknown map · gray fallback", { teams: "2", background: "unknown" }],
    ["Czech · meeting time", { teams: "2", language: "cs" }],
    ["German · meeting time", { game: "wardogs", teams: "3", language: "de" }],
    ["Czech · victory", { teams: "2", language: "cs", state: "victory" }],
    [
        "German · defeat",
        { game: "wardogs", teams: "3", language: "de", state: "defeat" },
    ],
    ["Summer daylight saving · Prague", { teams: "2", timing: "summer" }],
    ["Winter · New York", { teams: "2", timezone: "America/New_York" }],
    [
        "Next calendar day · Sydney",
        { teams: "2", timezone: "Australia/Sydney" },
    ],
    ["Meeting and game on different days", { teams: "2", timing: "midnight" }],
    [
        "Long names and league heading",
        {
            game: "wardogs",
            teams: "3",
            names: "long",
            codes: "off",
            league: "on",
        },
    ],
    [
        "Clan is third team · victory",
        { game: "wardogs", teams: "3", home: "last", state: "victory" },
    ],
    [
        "Clan is third team · defeat",
        { game: "wardogs", teams: "3", home: "last", state: "defeat" },
    ],
    ["Clan-only result · known side", { teams: "0", state: "victory" }],
    ["Clan-only result · unknown side", { teams: "0", state: "unknown" }],
    [
        "HLL Vietnam · unavailable map art",
        { game: "hell_let_loose_vietnam", teams: "2" },
    ],
    [
        "Other supported game · gray",
        { game: "world_of_warcraft_forever", teams: "0" },
    ],
]
for (const [title, opts] of extras)
    samples.push({ title, group: "Fallbacks and details", options: opts })
const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;")
function html() {
    return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Logi image combinations</title><style>body{margin:0;background:#17191e;color:#edf0f5;font:15px system-ui}header,section{padding:24px;max-width:1600px;margin:auto}p,figcaption{color:#bbc4d1}nav{position:sticky;top:0;background:#22252bee;padding:16px;z-index:1}a{color:#a9dacc}nav a{margin-right:24px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,440px),1fr));gap:24px}figure{margin:0}img{display:block;width:100%;border-radius:12px}figcaption{padding:8px 0}form{display:flex;flex-wrap:wrap;gap:14px}label{display:grid;gap:6px}select,button{background:#313338;color:white;padding:9px;border:1px solid #667;border-radius:6px}#custom{max-width:1000px;margin-top:24px}</style><header><h1>Logi image combinations</h1><p>${samples.length} synthetic samples from the production renderer. Click any image for the full 1200 × 675 PNG. Custom uploaded pictures bypass automatic announcement generation; statistics links appear as Discord buttons below result images.</p></header><nav><a href="#Layouts">Layouts</a><a href="#Results">Results</a><a href="#Fallbacks-and-details">Fallbacks and details</a><a href="#combine">Combine options</a></nav>${[
        "Layouts",
        "Results",
        "Fallbacks and details",
    ]
        .map(
            (group) =>
                `<section id="${group.replace(/ /g, "-")}"><h2>${group}</h2><main>${samples
                    .filter((s) => s.group === group)
                    .map(
                        (s) =>
                            `<figure><a href="${s.file}"><img loading="lazy" src="${s.file}" alt="${escape(s.title)}"></a><figcaption>${escape(s.title)}</figcaption></figure>`
                    )
                    .join("")}</main></section>`
        )
        .join(
            ""
        )}<section id="combine"><h2>Combine options</h2><p>To use these controls, start the local preview server with <code>node --import tsx output/match-image-combinations/gallery.ts --serve</code> and open <a href="http://127.0.0.1:4318">127.0.0.1:4318</a>. Three teams apply to Wardogs; other games use at most two. Text/date/score values are synthetic examples.</p><form id="options">${Object.entries(
        choices
    )
        .map(
            ([key, values]) =>
                `<label>${key}<select name="${key}">${values.map((v) => `<option>${v}</option>`).join("")}</select></label>`
        )
        .join(
            ""
        )}<button>Render combination</button></form><img id="custom" alt="Selected combination" hidden></section><script>document.querySelector('form').addEventListener('submit',e=>{e.preventDefault();if(location.protocol==='file:'){alert('Start the local preview server using the command above.');return}const img=document.querySelector('#custom');img.hidden=false;img.src='/render?'+new URLSearchParams(new FormData(e.target))})</script></html>`
}
async function generate() {
    await mkdir(out, { recursive: true })
    const start = performance.now()
    for (const [i, s] of samples.entries()) {
        s.file = `${String(i + 1).padStart(2, "0")}.png`
        await writeFile(path.join(out, s.file), await render(model(s.options)))
    }
    for (const [group, name] of [
        ["Layouts", "layouts"],
        ["Results", "results"],
        ["Fallbacks and details", "details"],
    ]) {
        const list = samples.filter((s) => s.group === group)
        for (let offset = 0; offset < list.length; offset += 8) {
            const part = list.slice(offset, offset + 8)
            const cells = []
            for (const [i, s] of part.entries()) {
                const label = Buffer.from(
                    `<svg width="600" height="36"><rect width="600" height="36" fill="#20242b"/><text x="14" y="23" font-family="Arial" font-size="15" fill="white">${escape(s.title)}</text></svg>`
                )
                cells.push(
                    {
                        input: await sharp(path.join(out, s.file!))
                            .resize(600, 337)
                            .toBuffer(),
                        left: (i % 2) * 600,
                        top: Math.floor(i / 2) * 377,
                    },
                    {
                        input: label,
                        left: (i % 2) * 600,
                        top: Math.floor(i / 2) * 377 + 337,
                    }
                )
            }
            await sharp({
                create: {
                    width: 1200,
                    height: Math.ceil(part.length / 2) * 377,
                    channels: 4,
                    background: "#17191e",
                },
            })
                .composite(cells)
                .png()
                .toFile(
                    path.join(out, `${name}-${Math.floor(offset / 8) + 1}.png`)
                )
        }
    }
    await writeFile(path.join(out, "index.html"), html())
    await writeFile(
        path.join(out, "manifest.json"),
        JSON.stringify(samples, null, 2)
    )
    console.log(
        `Generated ${samples.length} samples in ${Math.round(performance.now() - start)} ms`
    )
}
if (process.argv.includes("--serve")) {
    samples.forEach(
        (s, i) => (s.file = `${String(i + 1).padStart(2, "0")}.png`)
    )
    createServer(async (req, res) => {
        try {
            const url = new URL(req.url ?? "/", "http://127.0.0.1:4318")
            if (req.method !== "GET") {
                res.writeHead(405).end()
                return
            }
            if (url.pathname === "/render") {
                const bytes = await render(
                    model(Object.fromEntries(url.searchParams))
                )
                res.writeHead(200, {
                    "Content-Type": "image/png",
                    "Cache-Control": "no-store",
                }).end(bytes)
            } else if (url.pathname === "/") {
                res.writeHead(200, {
                    "Content-Type": "text/html; charset=utf-8",
                }).end(html())
            } else if (/^\/[a-z0-9-]+\.png$/.test(url.pathname)) {
                res.writeHead(200, { "Content-Type": "image/png" }).end(
                    await readFile(path.join(out, url.pathname.slice(1)))
                )
            } else res.writeHead(404).end()
        } catch {
            res.writeHead(500).end("Preview unavailable")
        }
    }).listen(4318, "127.0.0.1", () =>
        console.log("Sample gallery: http://127.0.0.1:4318")
    )
} else void generate()
