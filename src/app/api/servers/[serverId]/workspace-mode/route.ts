import { clanCompetitionRoutes } from "@/lib/gateways/clan-competitions"
export const runtime = "nodejs"
export async function POST(
    request: Request,
    context: { params: Promise<{ serverId: string }> }
) {
    return clanCompetitionRoutes.mode(request, (await context.params).serverId)
}
