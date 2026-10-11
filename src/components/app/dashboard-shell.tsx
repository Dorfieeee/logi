import type { ReactNode } from "react"

import {
    SidebarInset,
    SidebarProvider,
    SidebarTrigger,
} from "@/components/ui/sidebar"
import {
    getVisibleGuildsForLoggedInUser,
    isCurrentUserSuperadmin,
} from "@/lib/auth"
import { MissingBotWorkspaceWarning } from "@/components/app/missing-bot-workspace-warning"
import { SettingsAttentionProvider } from "@/components/app/settings-attention"
import { DashboardOnboarding } from "@/components/app/dashboard-onboarding"
import { LocaleSwitcher } from "@/components/app/locale-switcher"
import { ThemeSwitcher } from "@/components/app/theme-switcher"
import { AppBreadcrumbs } from "@/components/app/breadcrumbs"
import { SiteHeader } from "@/components/app/site-header"
import { SiteFooter } from "@/components/app/site-footer"
import { AppSidebar } from "@/components/app/app-sidebar"
import { canAdminWorkspace } from "@/lib/workspace-admin"
import { buildDiscordBotInviteUrl } from "@/lib/discord"
import type { Dictionary } from "@/i18n/dictionaries"
import { getLogiStatus } from "@/lib/logi-status"
import type { AppUser } from "@/types/domain"
import type { Locale } from "@/i18n/config"

export async function DashboardShell({
    children,
    dictionary,
    locale,
    user,
}: {
    children: ReactNode
    dictionary: Dictionary
    locale: Locale
    user: AppUser
}) {
    const [visibleServers, isSuperadmin, status] = await Promise.all([
        getVisibleGuildsForLoggedInUser(),
        isCurrentUserSuperadmin(),
        getLogiStatus(),
    ])
    const inviteUrlByGuildId = Object.fromEntries(
        visibleServers
            .filter((server) => canAdminWorkspace(server, user.discordId))
            .map((server) => [
                server.id,
                buildDiscordBotInviteUrl(server.discordId),
            ])
    )

    return (
        <DashboardOnboarding
            dictionary={dictionary}
            servers={visibleServers}
            onboarding={user.onboarding}
            userId={user.discordId}
        >
            <SettingsAttentionProvider>
                {/*
                 * --header-height is what full-height pages (the stratmap
                 * editor) subtract above their content beyond the frame's own
                 * padding: the phone title bar, or the page trail.
                 */}
                <SidebarProvider className="min-h-dvh [--footer-height:2.5rem] [--header-height:4.5rem] [--sidebar-width-icon:3rem] [--sidebar-width:16rem] sm:[--header-height:4rem] 2xl:[--footer-height:3rem] 2xl:[--header-height:3rem]">
                    <AppSidebar
                        locale={locale}
                        dictionary={dictionary}
                        servers={visibleServers}
                        user={user}
                        activeServerId={undefined}
                        canAdmin={false}
                        isSuperadmin={isSuperadmin}
                    />
                    <SidebarInset className="min-h-dvh overflow-x-clip">
                        <SiteHeader
                            locale={locale}
                            dictionary={dictionary}
                            servers={visibleServers}
                            user={user}
                        />
                        <header className="bg-background hidden h-16 shrink-0 items-center gap-3 border-b px-4 md:flex">
                            <SidebarTrigger />
                            <div
                                aria-hidden="true"
                                className="bg-border h-5 w-px"
                            />
                            <AppBreadcrumbs
                                locale={locale}
                                dictionary={dictionary}
                                servers={visibleServers}
                                className="min-w-0 flex-1 px-0"
                            />
                            <div className="ml-auto flex shrink-0 items-center gap-2">
                                <ThemeSwitcher dictionary={dictionary} />
                                <LocaleSwitcher
                                    locale={locale}
                                    dictionary={dictionary}
                                    compact
                                />
                            </div>
                        </header>
                        <div className="relative flex flex-1 flex-col gap-4 pt-4 pb-6 max-sm:has-[[data-mobile-action-bar]]:pb-28 md:gap-5 md:pt-6 md:pb-8">
                            <MissingBotWorkspaceWarning
                                dictionary={dictionary}
                                inviteUrlByGuildId={inviteUrlByGuildId}
                                servers={visibleServers}
                                userDiscordId={user.discordId}
                            />
                            {children}
                        </div>
                        <SiteFooter
                            dictionary={dictionary}
                            status={status}
                            locale={locale}
                        />
                    </SidebarInset>
                </SidebarProvider>
            </SettingsAttentionProvider>
        </DashboardOnboarding>
    )
}
