import { notFound, redirect } from "next/navigation"
import type { Metadata } from "next"

import { storedProfileCollections } from "@/components/app/settings/save-frontend-settings"
import { GuidedSetup } from "@/components/app/settings/guided-setup/guided-setup"
import { guidedSetupHref } from "@/components/app/settings/settings-section-meta"
import { settingsSnapshot } from "@/components/app/settings/settings-snapshot"
import { getSettingsOverviewFacts } from "@/lib/read-models/settings-overview"
import { settingsSetupSteps } from "@/domain/workspaces/settings-overview"
import { openingGuidedSetupStep } from "@/domain/workspaces/guided-setup"
import { buildDiscordBotInviteUrl } from "@/lib/discord"
import { getServerContext } from "@/lib/server-context"
import { DEFAULT_GAME_ID } from "@/domain/games/game"
import { getDictionary } from "@/i18n/dictionaries"
import { getCurrentPlayer } from "@/lib/auth"
import { isLocale } from "@/i18n/config"

type Params = Promise<{ locale: string; serverId: string }>

export async function generateMetadata(props: {
    params?: Params
}): Promise<Metadata> {
    // The build also evaluates this while collecting page data, without params.
    const locale = (await props?.params)?.locale
    const dictionary = getDictionary(locale && isLocale(locale) ? locale : "en")
    return {
        title: dictionary.settingsHub.guidedSetup.metaTitle,
        robots: { index: false, follow: false },
    }
}

/**
 * The setup guide (design B), full screen outside the dashboard frame. Like
 * every settings page it is for clan admins only; it reads the same settings
 * and step rule as the settings overview.
 */
export default async function GuidedSetupPage({
    params,
    searchParams,
}: {
    params: Params
    searchParams: Promise<{ step?: string | string[] }>
}) {
    const { locale, serverId } = await params
    const { step } = await searchParams
    const safeLocale = isLocale(locale) ? locale : "en"
    if (!(await getCurrentPlayer()))
        redirect(
            `/${safeLocale}/login?redirectTo=${encodeURIComponent(guidedSetupHref(safeLocale, serverId))}`
        )
    const context = await getServerContext(serverId, "all")
    if (!context?.canAdmin) notFound()
    const { server, discordConfig } = context
    const snapshot = settingsSnapshot(server.enabledGames, discordConfig)
    const facts = await getSettingsOverviewFacts(server, snapshot.enabledGames)
    const { steps } = settingsSetupSteps(snapshot, facts)

    return (
        <GuidedSetup
            locale={safeLocale}
            serverId={serverId}
            clanName={server.name}
            clanAvatar={server.avatar}
            stored={{
                enabledGames:
                    server.enabledGames === undefined
                        ? [DEFAULT_GAME_ID]
                        : server.enabledGames,
                profile: {
                    name: server.name,
                    avatar: server.avatar,
                    description: server.description ?? "",
                },
                channels: {
                    announcementsChannelId:
                        discordConfig?.announcementsChannelId,
                    eventInfoChannelId: discordConfig?.eventInfoChannelId,
                    eventResultsChannelId: discordConfig?.eventResultsChannelId,
                    errorsChannelId: discordConfig?.errorsChannelId,
                },
                roles: {
                    clanRoleId: discordConfig?.clanRoleId,
                    dashboardAdminRoleId: discordConfig?.dashboardAdminRoleId,
                },
            }}
            collections={storedProfileCollections(server)}
            botInside={server.botInside}
            inviteUrl={buildDiscordBotInviteUrl(server.discordId)}
            steps={steps}
            initialStep={openingGuidedSetupStep(step, steps)}
            dictionary={getDictionary(safeLocale)}
        />
    )
}
