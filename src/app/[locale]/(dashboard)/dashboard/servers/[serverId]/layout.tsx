import { WorkspaceMode } from "@/components/app/workspace-mode"
import { getDictionary } from "@/i18n/dictionaries"
import { isLocale } from "@/i18n/config"
import { Suspense } from "react"

import { settingsAttentionCount } from "@/domain/workspaces/settings-attention"
import { settingsSnapshot } from "@/components/app/settings/settings-snapshot"
import { SettingsAttentionReport } from "@/components/app/settings-attention"
import { getServerContext } from "@/lib/server-context"

export function generateStaticParams() {
    return [{ serverId: "sample-server" }]
}

/** Feeds the sidebar's settings badge without delaying the page below. */
async function ClanSettingsAttention({
    params,
}: {
    params: Promise<{ serverId: string; locale: string }>
}) {
    const { serverId, locale } = await params
    // Cached per clan and person; the pages below read the same context.
    const context = await getServerContext(serverId, "all")
    if (!context?.canAdmin) return null
    return (
        <>
            {!context.server.workspaceMode &&
            !context.events.length &&
            !context.rosters.length &&
            !context.discordConfig?.announcementsChannelId &&
            !context.discordConfig?.eventInfoChannelId ? (
                <WorkspaceMode
                    serverId={serverId}
                    dictionary={getDictionary(isLocale(locale) ? locale : "en")}
                    onboarding
                />
            ) : null}
            <SettingsAttentionReport
                serverId={serverId}
                count={settingsAttentionCount(
                    settingsSnapshot(
                        context.server.enabledGames,
                        context.discordConfig
                    )
                )}
            />
        </>
    )
}

export default function ServerLayout({
    children,
    params,
}: {
    children: React.ReactNode
    params: Promise<{ serverId: string; locale: string }>
}) {
    return (
        <>
            <Suspense fallback={null}>
                <ClanSettingsAttention params={params} />
            </Suspense>
            {children}
        </>
    )
}
