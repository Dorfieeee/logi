import { competitionAdminAccess } from "@/lib/gateways/competition-admin"
import { scrapeTeamCatalogue } from "@/lib/gateways/team-scrape"
import { teamScrapeHandler } from "@/lib/api/team-scrape-route"
import { getSiteUrl } from "@/lib/env"

export const runtime = "nodejs"
export const maxDuration = 300
export const POST = teamScrapeHandler({
    origin: new URL(getSiteUrl()).origin,
    access: competitionAdminAccess,
    scrape: scrapeTeamCatalogue,
})
