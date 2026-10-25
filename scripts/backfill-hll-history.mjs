// Administrative, bounded backfill of already collected data. Never pushes code,
// reads provider credentials, invokes upstream services or selects an implicit target.
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { parse } from "dotenv"

const args = process.argv.slice(2)
const allowed = new Set([
    "--deployment-name",
    "--self-hosted-url",
    "--target-env",
    "--guild",
    "--max-pages",
    "--cursor",
    "--apply",
])
const values = new Map()
for (let index = 0; index < args.length; index++) {
    const key = args[index]
    if (!allowed.has(key) || values.has(key))
        throw new Error("Unknown or repeated argument.")
    if (key === "--apply") values.set(key, true)
    else {
        const value = args[++index]
        if (!value || value.startsWith("--")) throw new Error(`Missing ${key}.`)
        values.set(key, value)
    }
}
const deployment = values.get("--deployment-name"),
    guildId = values.get("--guild")
const selfHostedUrl = values.get("--self-hosted-url"),
    envFile = values.get("--target-env")
const maxPages = Number(values.get("--max-pages") ?? "100")
if (
    (typeof deployment === "string"
        ? !/^[a-z0-9-]{1,100}$/.test(deployment) ||
          selfHostedUrl !== undefined ||
          envFile !== undefined
        : typeof selfHostedUrl !== "string" || typeof envFile !== "string") ||
    typeof guildId !== "string" ||
    !/^\d{1,30}$/.test(guildId) ||
    !Number.isSafeInteger(maxPages) ||
    maxPages < 1 ||
    maxPages > 10000
) {
    throw new Error(
        "Usage: node scripts/backfill-hll-history.mjs (--deployment-name NAME | --self-hosted-url ORIGIN --target-env ABSOLUTE_PATH) --guild DISCORD_ID [--max-pages 100] [--cursor CURSOR] [--apply]. Dry-run is the default; no deployment is inferred."
    )
}
let targetArgs
if (typeof deployment === "string") {
    // --deployment with a bare name resolves this named project/deployment
    // directly; deprecated --deployment-name can inherit ambient project selection.
    targetArgs = ["--deployment", deployment]
} else {
    let target
    try {
        target = new URL(selfHostedUrl)
    } catch {
        throw new Error("Invalid explicit self-hosted URL.")
    }
    if (
        !["http:", "https:"].includes(target.protocol) ||
        target.username ||
        target.password ||
        target.pathname !== "/" ||
        target.search ||
        target.hash ||
        target.origin !== selfHostedUrl ||
        resolve(envFile) !== envFile
    )
        throw new Error(
            "Self-hosted mode requires an exact origin and absolute env-file path."
        )
    let config
    try {
        config = parse(readFileSync(envFile, "utf8"))
    } catch {
        throw new Error("Unable to read explicit target env-file.")
    }
    if (
        config.CONVEX_SELF_HOSTED_URL !== selfHostedUrl ||
        !config.CONVEX_SELF_HOSTED_ADMIN_KEY ||
        config.CONVEX_DEPLOY_KEY ||
        config.CONVEX_DEPLOYMENT ||
        config.CONVEX_DEPLOYMENT_TOKEN
    )
        throw new Error(
            "Explicit env-file must contain only the matching self-hosted target selectors, with an admin key; conflicting selectors are refused."
        )
    targetArgs = ["--env-file", envFile]
}
let cursor = values.get("--cursor") ?? null
if (cursor !== null && (typeof cursor !== "string" || cursor.length > 4096))
    throw new Error("Invalid cursor.")
const cli = fileURLToPath(
    new URL("../node_modules/convex/bin/main.js", import.meta.url)
)
const totals = { scanned: 0, eligible: 0, archived: 0, skipped: 0 }
for (let page = 0; page < maxPages; page++) {
    const run = spawnSync(
        process.execPath,
        [
            cli,
            "run",
            ...targetArgs,
            "gameHistoryBackfill:hllPage",
            JSON.stringify({
                guildId,
                cursor,
                apply: values.get("--apply") === true,
            }),
        ],
        { encoding: "utf8", maxBuffer: 1024 * 1024, timeout: 60_000 }
    )
    if (run.error || run.status !== 0) {
        // CLI stderr can contain deployment configuration; do not echo it.
        console.error(
            JSON.stringify({
                error: "Backfill page failed; previous checkpoint retained.",
                totals,
                nextCursor: cursor,
            })
        )
        process.exit(1)
    }
    let result
    try {
        result = JSON.parse(run.stdout)
    } catch {
        throw new Error(
            "Unexpected Convex output; no next checkpoint accepted."
        )
    }
    if (
        !result ||
        !["scanned", "eligible", "archived", "skipped"].every(
            (key) =>
                Number.isSafeInteger(result[key]) &&
                result[key] >= 0 &&
                result[key] <= 10
        ) ||
        result.scanned !== result.eligible + result.skipped ||
        !(
            result.nextCursor === null ||
            (typeof result.nextCursor === "string" &&
                result.nextCursor.length <= 4096 &&
                result.nextCursor !== cursor)
        )
    )
        throw new Error("Invalid backfill page; no next checkpoint accepted.")
    for (const key of Object.keys(totals)) totals[key] += result[key]
    cursor = result.nextCursor
    console.log(
        JSON.stringify({
            page: page + 1,
            apply: values.get("--apply") === true,
            totals,
            nextCursor: cursor,
            complete: cursor === null,
        })
    )
    if (cursor === null) process.exit(0)
}
console.error(
    "Page budget reached. Resume explicitly with the last cursor; this was not a complete scan."
)
process.exitCode = 2
