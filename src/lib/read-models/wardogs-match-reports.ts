import type { WardogsMatchReport } from "@/domain/match-reports/wardogs"
import { makeFunctionReference } from "convex/server"
import { getInternalAuthSecret } from "@/lib/env"
import { hashApiKey } from "@/lib/public-api"
import { fetchQuery } from "convex/nextjs"
const get = makeFunctionReference<"query">("wardogsMatchReports:get")
const forKey = makeFunctionReference<"query">("wardogsMatchReports:getForKey")
export async function getWardogsMatchReport(
    eventId: string,
    guildId?: string
): Promise<WardogsMatchReport | null> {
    if (eventId.startsWith("sample-")) return null
    return fetchQuery(get, {
        secret: getInternalAuthSecret(),
        eventId,
        ...(guildId ? { guildId } : {}),
    })
}
export async function getWardogsMatchReportForKey(
    eventId: string,
    key: string
): Promise<WardogsMatchReport | null> {
    return fetchQuery(forKey, {
        secret: getInternalAuthSecret(),
        eventId,
        keyHash: hashApiKey(key),
    })
}
