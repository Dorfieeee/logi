import { LeagueAutoImportSettings } from "@/components/app/league-auto-import-settings"
import { SelfGroupsSettings } from "@/components/app/settings/self-groups-settings"
import { notFound, redirect } from "next/navigation"
import type { ReactNode } from "react"
import type { Metadata } from "next"
import { Plus } from "lucide-react"
import Link from "next/link"

import {
    isSettingsSectionId,
    mergedSettingsSection,
    visibleSettingsSections,
} from "@/domain/workspaces/settings-sections"
import {
    ChannelScopeLegend,
    DiscordChannelSettingsForm,
} from "@/components/app/settings/discord-channel-settings-form"
import { PanelGraphicsSettingsForm } from "@/components/app/settings/panel-graphics/panel-graphics-settings"
import {
    discordCommandsWebAccess,
    readCommandRegistration,
} from "@/lib/gateways/discord-commands"
import { CommandsSettingsForm } from "@/components/app/settings/commands/commands-settings-form"
import { DiscordRoleSettingsForm } from "@/components/app/settings/discord-role-settings-form"
import { DiscordMessagesSettings } from "@/components/app/settings/discord-messages-settings"
import { MatchTemplatesSettings } from "@/components/app/settings/match-templates-settings"
import { ServerFrontendSettingsForm } from "@/components/app/server-frontend-settings-form"
import { DiscordPanelsPage } from "@/components/app/discord-panels/discord-panels-page"
import { SettingsSectionFrame } from "@/components/app/settings/settings-section-frame"
import { PublicInviteSettings } from "@/components/app/settings/public-invite-settings"
import { SeedSettingsPage } from "@/components/app/discord-seed/seed-settings-page"
import { MaintenanceImports } from "@/components/app/settings/maintenance-imports"
import { MembershipSettingsForm } from "@/components/app/membership-settings-form"
import { settingsHref } from "@/components/app/settings/settings-section-meta"
import { settingsSnapshot } from "@/components/app/settings/settings-snapshot"
import { CalendarFeedSettings } from "@/components/app/calendar-feed-settings"
import { WebsiteSettings } from "@/components/app/settings/website-settings"
import { PresetsOverview } from "@/components/app/settings/presets-overview"
import { GameDataConnections } from "@/components/app/game-data-connections"
import { getPanelGraphicsPageData } from "@/lib/read-models/panel-graphics"
import { TicketSettingsForm } from "@/components/app/ticket-settings-form"
import { panelCompetitions } from "@/lib/read-models/panel-competitions"
import { HelperDataActions } from "@/components/app/helper-data-actions"
import { getDiscordConfigByGuild } from "@/lib/server-discord-settings"
import { GameSettingsForm } from "@/components/app/game-settings-form"
import { getRoleAccessOverview } from "@/lib/read-models/role-access"
import { WebhookManager } from "@/components/app/webhook-manager"
import { DEFAULT_GAME_ID, isGameId } from "@/domain/games/game"
import { getServerContext } from "@/lib/server-context"
import { makeFunctionReference } from "convex/server"
import { getDictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import { fetchQuery } from "convex/nextjs"
import { isLocale } from "@/i18n/config"
import { getSiteUrl } from "@/lib/env"

type Params = Promise<{ locale: string; serverId: string; section: string }>

export async function generateMetadata({
    params,
}: {
    params: Params
}): Promise<Metadata> {
    const { locale, section } = await params
    const dictionary = getDictionary(isLocale(locale) ? locale : "en")
    return {
        title: isSettingsSectionId(section)
            ? dictionary.settingsHub.sections[section].title
            : dictionary.settingsHub.title,
    }
}

export default async function ServerSettingsSectionPage({
    params,
    searchParams,
}: {
    params: Params
    searchParams: Promise<{ game?: string; server?: string }>
}) {
    const { locale, serverId, section } = await params
    const { game, server: serverTab } = await searchParams
    const gameId = isGameId(game) ? game : undefined
    const merged = mergedSettingsSection(section)
    if (merged) redirect(settingsHref(locale, serverId, merged, gameId))
    if (!isSettingsSectionId(section)) notFound()
    const dictionary = getDictionary(isLocale(locale) ? locale : "en")
    const context = await getServerContext(serverId, gameId ?? "all")
    if (!context?.canAdmin) return null
    const { server, discordConfig } = context
    const catalogueGames = await fetchQuery(
        makeFunctionReference<"query">("gameCatalog:list"),
        {}
    )
    const snapshot = settingsSnapshot(server.enabledGames, discordConfig)
    if (
        !visibleSettingsSections(snapshot.enabledGames).some(
            (visible) => visible.id === section
        )
    )
        notFound()
    const guildLoginUrl = `${getSiteUrl()}/${locale}/guild-login/${server.discordId}`

    let content: ReactNode
    let legend: ReactNode
    let headerActions: ReactNode
    // "Panely v Discordu" and its pages are clan-wide, not per game.
    const panelsHref = settingsHref(locale, serverId, "discord-panels")
    switch (section) {
        case "profile":
            content = (
                <div className="space-y-6">
                    <ServerFrontendSettingsForm
                        server={server}
                        dictionary={dictionary}
                        guildLoginUrl={guildLoginUrl}
                        showLoginLink={false}
                        part="profile"
                    />
                    <PublicInviteSettings
                        serverId={serverId}
                        publicPageHref={`/${locale}/clans/${server.discordId}`}
                        inviteUrl={server.publicInviteUrl ?? null}
                        dictionary={dictionary}
                    />
                </div>
            )
            break
        case "event-categories":
            content = (
                <ServerFrontendSettingsForm
                    server={server}
                    dictionary={dictionary}
                    guildLoginUrl={guildLoginUrl}
                    showLoginLink={false}
                    part="categories"
                />
            )
            break
        case "match-templates":
            content = (
                <MatchTemplatesSettings
                    serverId={serverId}
                    templates={server.matchTemplates ?? []}
                    categories={server.eventCategories ?? []}
                    groups={context.groups}
                    topicPresets={context.topicPresets}
                    squadPresets={context.squadPresets}
                    enabledGames={snapshot.enabledGames}
                    announcementChannelId={
                        discordConfig?.announcementsChannelId
                    }
                    channelsHref={settingsHref(locale, serverId, "channels")}
                    locale={locale}
                    dictionary={dictionary}
                />
            )
            break
        case "presets":
            content = (
                <PresetsOverview
                    locale={locale}
                    serverId={serverId}
                    squadPresetCount={context.squadPresets.length}
                    topicPresetCount={context.topicPresets.length}
                    dictionary={dictionary}
                />
            )
            break
        case "games":
            content = (
                <GameSettingsForm
                    serverId={serverId}
                    enabledGames={server.enabledGames}
                    games={catalogueGames.map(
                        (game: { id: string; name: string }) => ({
                            id: game.id,
                            name: game.name,
                        })
                    )}
                    dictionary={dictionary}
                />
            )
            break
        case "messages":
            content = (
                <DiscordMessagesSettings
                    serverId={serverId}
                    config={discordConfig}
                    enabledGames={snapshot.enabledGames}
                    siteUrl={getSiteUrl()}
                    clanName={server.name}
                    hrefs={{
                        channels: settingsHref(
                            locale,
                            serverId,
                            "channels",
                            gameId
                        ),
                        league: settingsHref(
                            locale,
                            serverId,
                            "league",
                            gameId
                        ),
                        matchTemplates: settingsHref(
                            locale,
                            serverId,
                            "match-templates",
                            gameId
                        ),
                        panels: panelsHref,
                        seed: settingsHref(locale, serverId, "discord-seed"),
                        commands: settingsHref(
                            locale,
                            serverId,
                            "commands",
                            gameId
                        ),
                        membership: settingsHref(
                            locale,
                            serverId,
                            "membership",
                            gameId
                        ),
                        tickets: settingsHref(
                            locale,
                            serverId,
                            "tickets",
                            gameId
                        ),
                        // "Změnit znaky" opens the fixed signs on "Grafika panelů" (P8).
                        factionSigns: `${settingsHref(
                            locale,
                            serverId,
                            "panel-graphics",
                            gameId
                        )}#panel-graphics-factions`,
                        accountMessages: `/${locale}/dashboard/settings/user#zpravy-od-bota`,
                    }}
                    // The calendar row names its categories (N1-36).
                    categories={(server.eventCategories ?? []).map(
                        (category) => ({
                            id: category.id,
                            label: category.label,
                        })
                    )}
                    competitions={await panelCompetitions(
                        snapshot.enabledGames
                    )}
                    dictionary={dictionary}
                />
            )
            break
        case "channels":
            legend =
                snapshot.enabledGames.length > 1 ? (
                    <ChannelScopeLegend
                        dictionary={dictionary}
                        exampleGame={snapshot.enabledGames[1]!}
                    />
                ) : undefined
            content = (
                <DiscordChannelSettingsForm
                    serverId={serverId}
                    dictionary={dictionary}
                    config={discordConfig}
                    enabledGames={snapshot.enabledGames}
                />
            )
            break
        case "discord-panels":
            headerActions = (
                <Button asChild className="w-full rounded-lg sm:w-auto">
                    <Link href={`${panelsHref}/new`}>
                        <Plus className="size-4" aria-hidden="true" />
                        {dictionary.discordPanelsPage.newPanel}
                    </Link>
                </Button>
            )
            content = (
                <DiscordPanelsPage
                    serverId={serverId}
                    guildId={server.discordId}
                    hrefs={{
                        panels: panelsHref,
                        gameServers: settingsHref(
                            locale,
                            serverId,
                            "game-servers"
                        ),
                        seed: settingsHref(locale, serverId, "discord-seed"),
                    }}
                    categories={(server.eventCategories ?? []).map(
                        (category) => ({
                            id: category.id,
                            label: category.label,
                        })
                    )}
                    competitions={await panelCompetitions(
                        snapshot.enabledGames
                    )}
                    calendarSetting={
                        discordConfig?.calendarChannelId
                            ? {
                                  channelId: discordConfig.calendarChannelId,
                                  message: discordConfig.calendarMessageId
                                      ? {
                                            channelId:
                                                discordConfig.calendarMessageChannelId ??
                                                discordConfig.calendarChannelId,
                                            messageId:
                                                discordConfig.calendarMessageId,
                                        }
                                      : null,
                              }
                            : null
                    }
                    dictionary={dictionary}
                />
            )
            break
        case "panel-graphics": {
            const graphics = await getPanelGraphicsPageData(server.discordId)
            content = graphics ? (
                <PanelGraphicsSettingsForm
                    serverId={serverId}
                    locale={locale}
                    data={graphics}
                    // "Panely v Discordu": each panel's editor sets its own style.
                    editorHref={panelsHref}
                    gameServersHref={settingsHref(
                        locale,
                        serverId,
                        "game-servers"
                    )}
                    dictionary={dictionary}
                />
            ) : (
                <p role="alert" className="text-muted-foreground text-sm">
                    {dictionary.panelGraphicsPage.errors.unavailable}
                </p>
            )
            break
        }
        case "discord-seed":
            content = (
                <SeedSettingsPage
                    serverId={serverId}
                    locale={locale}
                    server={serverTab}
                    context={context}
                    dictionary={dictionary}
                />
            )
            break
        case "roles":
            content = (
                <DiscordRoleSettingsForm
                    serverId={serverId}
                    dictionary={dictionary}
                    config={discordConfig}
                    access={await getRoleAccessOverview(serverId)}
                    now={new Date()}
                />
            )
            break
        case "commands": {
            const access = await discordCommandsWebAccess(serverId)
            content = (
                <CommandsSettingsForm
                    serverId={serverId}
                    serverName={server.name}
                    dictionary={dictionary}
                    config={discordConfig}
                    enabledGames={snapshot.enabledGames}
                    registration={
                        access
                            ? await readCommandRegistration(access).catch(
                                  () => null
                              )
                            : null
                    }
                    now={new Date().getTime()}
                    hrefs={{
                        gameServers: settingsHref(
                            locale,
                            serverId,
                            "game-servers",
                            gameId
                        ),
                        channels: settingsHref(
                            locale,
                            serverId,
                            "channels",
                            gameId
                        ),
                        tickets: settingsHref(
                            locale,
                            serverId,
                            "tickets",
                            gameId
                        ),
                        membership: settingsHref(
                            locale,
                            serverId,
                            "membership",
                            gameId
                        ),
                    }}
                />
            )
            break
        }
        case "membership":
            content = (
                <div className="space-y-6">
                    <SelfGroupsSettings
                        serverId={serverId}
                        groups={context.groups}
                        selected={discordConfig?.selfAssignableGroupIds ?? []}
                        locale={locale}
                    />
                    <MembershipSettingsForm
                        serverId={serverId}
                        guildId={server.discordId}
                        config={discordConfig}
                        dictionary={dictionary}
                        rolesHref={settingsHref(
                            locale,
                            serverId,
                            "roles",
                            gameId
                        )}
                        clanName={server.name}
                        siteUrl={getSiteUrl()}
                        now={new Date().getTime()}
                        locale={locale}
                    />
                </div>
            )
            break
        case "tickets":
            content = (
                <TicketSettingsForm
                    serverId={serverId}
                    dictionary={dictionary}
                    config={await getDiscordConfigByGuild(serverId)}
                />
            )
            break
        case "game-servers":
            content = (
                <GameDataConnections
                    serverId={serverId}
                    dictionary={dictionary}
                />
            )
            break
        case "league":
            content = <LeagueAutoImportSettings serverId={serverId} />
            break
        case "website":
            content = (
                <WebsiteSettings
                    serverId={serverId}
                    dictionary={dictionary}
                    guildLoginUrl={guildLoginUrl}
                />
            )
            break
        case "calendar":
            content = (
                <CalendarFeedSettings
                    server={server}
                    dictionary={dictionary}
                    guildLoginUrl={guildLoginUrl}
                    calendarFeedToken={discordConfig?.calendarFeedToken}
                />
            )
            break
        case "webhooks":
            content = (
                <div className="space-y-4">
                    <p className="text-muted-foreground text-sm">
                        {dictionary.clan.webhooksBody}{" "}
                        <Link
                            href="/wiki/configuration/settings#webhooks"
                            className="text-primary font-medium underline-offset-4 hover:underline"
                        >
                            {dictionary.clan.webhookDocumentation}
                        </Link>
                    </p>
                    <WebhookManager
                        serverId={serverId}
                        dictionary={dictionary}
                    />
                </div>
            )
            break
        case "imports":
            content = (
                <MaintenanceImports
                    serverId={serverId}
                    gameId={gameId ?? DEFAULT_GAME_ID}
                    enabledGames={server.enabledGames}
                    defaultRoleId={discordConfig?.clanRoleId}
                    dictionary={dictionary}
                />
            )
            break
        case "helper-data":
            content = (
                <div className="space-y-4">
                    <p className="text-muted-foreground text-sm">
                        {dictionary.clan.helperDataBody}
                    </p>
                    <HelperDataActions
                        serverId={serverId}
                        dictionary={dictionary}
                    />
                </div>
            )
            break
    }

    return (
        <SettingsSectionFrame
            locale={locale}
            serverId={serverId}
            gameId={gameId}
            section={section}
            snapshot={snapshot}
            enabledGames={server.enabledGames}
            dictionary={dictionary}
            legend={legend}
            headerActions={headerActions}
            ownHeader={
                section === "tickets" ||
                section === "game-servers" ||
                section === "commands" ||
                section === "discord-seed" ||
                section === "messages" ||
                section === "membership"
            }
            mobileBreadcrumb={
                section === "discord-panels" ||
                section === "panel-graphics" ||
                section === "discord-seed"
            }
            breadcrumbParent={
                section === "membership"
                    ? dictionary.membershipApplication.breadcrumbParent
                    : undefined
            }
            breadcrumbCurrent={
                section === "membership"
                    ? dictionary.membershipApplication.title
                    : undefined
            }
        >
            {content}
        </SettingsSectionFrame>
    )
}
