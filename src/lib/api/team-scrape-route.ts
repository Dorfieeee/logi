import { teamGameSchema, type TeamGame } from "@/domain/teams/team"
import { isSameOrigin, noStore } from "./superadmin-route"
import { readBoundedJson } from "./request-json"
import { z } from "zod"

export function teamScrapeHandler<Access>(ports: {
    origin: string
    access(): Promise<Access | null>
    scrape(access: Access, game: TeamGame): Promise<unknown>
}) {
    return async (request: Request) => {
        if (!isSameOrigin(request, ports.origin))
            return noStore({ error: "forbidden" }, 403)
        const access = await ports.access()
        if (!access) return noStore({ error: "forbidden" }, 403)
        const input = z
            .strictObject({ gameId: teamGameSchema })
            .safeParse(await readBoundedJson(request, 1024))
        if (!input.success) return noStore({ error: "invalid_game" }, 400)
        try {
            return noStore(await ports.scrape(access, input.data.gameId))
        } catch {
            return noStore({ error: "unavailable" }, 503)
        }
    }
}
