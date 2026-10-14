import { makeFunctionReference } from "convex/server"
import { ConvexHttpClient } from "convex/browser"
import { loadEnvConfig } from "@next/env"

// Use configured runtime credentials without printing or copying their values.
loadEnvConfig(process.cwd())
const url =
    process.env.CONVEX_SELF_HOSTED_URL ??
    process.env.NEXT_PUBLIC_CONVEX_URL ??
    process.env.CONVEX_URL
const secret = process.env.INTERNAL_AUTH_SECRET
if (!url || !secret)
    throw new Error(
        "Configured Convex URL and internal authentication are required."
    )
const client = new ConvexHttpClient(url)
const ref = makeFunctionReference<
    "mutation",
    { secret: string; cursor: string | null },
    {
        cursor: string
        done: boolean
        players: number
        matchedPlayers: number
        changed: number
        unavailable: number
    }
>("collectedPlayerStats:backfillPage")
async function main(runtimeSecret: string) {
    let cursor: string | null = null
    const totals = {
        pages: 0,
        players: 0,
        matchedPlayers: 0,
        changed: 0,
        unavailable: 0,
    }
    for (;;) {
        const page: {
            cursor: string
            done: boolean
            players: number
            matchedPlayers: number
            changed: number
            unavailable: number
        } = await client.mutation(ref, { secret: runtimeSecret, cursor })
        totals.pages++
        totals.players += page.players
        totals.matchedPlayers += page.matchedPlayers
        totals.changed += page.changed
        totals.unavailable += page.unavailable
        if (page.done) break
        if (page.cursor === cursor)
            throw new Error("Recovery cursor did not advance.")
        cursor = page.cursor
    }
    console.log(JSON.stringify(totals))
}
void main(secret).catch(() => {
    console.error(
        "Recovery failed; no completion claim can be made. Check the configured deployment and authentication."
    )
    process.exitCode = 1
})
