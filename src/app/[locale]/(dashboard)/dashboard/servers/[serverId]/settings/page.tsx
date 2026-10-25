import { WorkspaceMode } from "@/components/app/workspace-mode"
import type { Metadata } from "next"

import { settingsSnapshot } from "@/components/app/settings/settings-snapshot"
import { SettingsOverview } from "@/components/app/settings/settings-overview"
import { getSettingsOverviewFacts } from "@/lib/read-models/settings-overview"
import { getServerContext } from "@/lib/server-context"
import { getDictionary } from "@/i18n/dictionaries"
import { isGameId } from "@/domain/games/game"
import { isLocale } from "@/i18n/config"

export const metadata: Metadata = {
    title: "Clan settings",
    description: "Manage your clan, Discord and integration settings.",
}

export default async function ServerSettingsPage({
    params,
    searchParams,
}: {
    params: Promise<{ locale: string; serverId: string }>
    searchParams: Promise<{ game?: string }>
}) {
    const { locale, serverId } = await params
    const { game } = await searchParams
    const gameId = isGameId(game) ? game : undefined
    const dictionary = getDictionary(isLocale(locale) ? locale : "en")
    const context = await getServerContext(serverId, gameId ?? "all")
    if (!context?.canAdmin) return null
    const snapshot = settingsSnapshot(
        context.server.enabledGames,
        context.discordConfig
    )
    return (
        <>
            <div className="px-4 lg:px-6">
                <WorkspaceMode
                    serverId={serverId}
                    mode={context.server.workspaceMode}
                    dictionary={dictionary}
                />
            </div>
            <SettingsOverview
                locale={locale}
                serverId={serverId}
                gameId={gameId}
                snapshot={snapshot}
                facts={await getSettingsOverviewFacts(
                    context.server,
                    snapshot.enabledGames
                )}
                dictionary={dictionary}
            />
        </>
    )
}
