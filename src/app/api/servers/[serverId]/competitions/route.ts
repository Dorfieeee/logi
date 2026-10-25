import { clanCompetitionRoutes } from "@/lib/gateways/clan-competitions"
export const runtime = "nodejs"
type Context = { params: Promise<{ serverId: string }> }
export async function GET(request: Request, context: Context) {
    return clanCompetitionRoutes.GET(request, (await context.params).serverId)
}
export async function POST(request: Request, context: Context) {
    return clanCompetitionRoutes.POST(request, (await context.params).serverId)
}
