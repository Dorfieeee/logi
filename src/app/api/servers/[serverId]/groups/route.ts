import { NextRequest, NextResponse } from "next/server"

import {
    getUserSafeErrorMessage,
    logRouteError,
} from "@/lib/server-route-errors"
import { getServerContextUncached } from "@/lib/read-models/server-context"
import { isDashboardWriteOrigin } from "@/lib/api/dashboard-write-origin"
import { appCacheTags, revalidateCacheEntries } from "@/lib/cache-tags"
import { getServerGroups, saveServerGroup } from "@/lib/server-groups"
import { getServerContext } from "@/lib/server-context"
import { groupSchema } from "@/lib/validation/group"

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ serverId: string }> }
) {
    const headers = { "Cache-Control": "no-store" }
    try {
        const { serverId } = await params
        const context = await getServerContextUncached(serverId)
        if (!context?.canAdmin)
            return NextResponse.json(
                { error: "Forbidden." },
                { status: 403, headers }
            )
        return NextResponse.json(
            { groups: await getServerGroups(serverId, "all") },
            { headers }
        )
    } catch (error) {
        logRouteError("groups.list", error)
        return NextResponse.json(
            { error: "Unable to load groups." },
            { status: 503, headers }
        )
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ serverId: string }> }
) {
    if (!isDashboardWriteOrigin(request)) {
        return NextResponse.json({ error: "Forbidden." }, { status: 403 })
    }
    try {
        const body = groupSchema.parse(await request.json())
        const { serverId } = await params
        const serverContext = await getServerContext(serverId)
        if (!serverContext?.canAdmin) {
            return NextResponse.json({ error: "Forbidden." }, { status: 403 })
        }
        const groupId = await saveServerGroup({
            serverId,
            ...body,
        })

        revalidateCacheEntries([
            appCacheTags.serverContext(serverId),
            appCacheTags.groups(serverId),
            appCacheTags.group(groupId),
            appCacheTags.rosterImage(),
        ])

        return NextResponse.json({ groupId })
    } catch (error) {
        logRouteError("groups.create", error)
        return NextResponse.json(
            {
                error: getUserSafeErrorMessage(
                    error,
                    "Unable to save the group."
                ),
            },
            { status: 400 }
        )
    }
}
