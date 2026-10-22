"use client"

import {
    CalendarDays,
    ClipboardList,
    LayoutDashboard,
    Settings,
    Shield,
    Swords,
    UserCog,
    CalendarIcon,
    Bot,
    Globe,
    Ticket,
} from "lucide-react"
import { usePathname, useSearchParams } from "next/navigation"
import { useEffect } from "react"

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    useSidebar,
} from "@/components/ui/sidebar"
import { useSettingsAttentionCount } from "@/components/app/settings-attention"
import { globalAdminHref, isGlobalAdminPath } from "@/lib/global-admin-routes"
import { NavMain, NavMenuItems, type NavItem } from "@/components/nav-main"
import { globalAdminSection } from "@/lib/navigation/global-admin-routes"
import { ServerSwitcher } from "@/components/app/server-switcher"
import { AdminSidebar } from "@/components/app/admin-sidebar"
import { canAdminWorkspace } from "@/lib/workspace-admin"
import type { Dictionary } from "@/i18n/dictionaries"
import { NavUser } from "@/components/nav-user"
import type { AppUser } from "@/types/domain"
import type { Guild } from "@/types/domain"
import type { Locale } from "@/i18n/config"

/**
 * The clan sidebar (design AppSidebar): the clan switcher, then the clan's
 * pages in three groups, then global administration for Logi's admins and the
 * person's account at the bottom.
 */
export function AppSidebar({
    locale,
    dictionary,
    user,
    servers,
    activeServerId,
    canAdmin,
    isSuperadmin,
    ...props
}: React.ComponentProps<typeof Sidebar> & {
    locale: Locale
    dictionary: Dictionary
    user: AppUser
    servers: Guild[]
    activeServerId?: string
    canAdmin: boolean
    isSuperadmin: boolean
}) {
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const { isMobile, setOpenMobile } = useSidebar()
    const pathServerId = pathname?.match(/\/servers\/([^/]+)/)?.[1]
    const selectedWorkspaceId = searchParams.get("workspace") ?? undefined
    // Global administration has its own navigation (see AdminSidebar). It is
    // swapped in at the end, after every hook of this component has run.
    const adminSection = isSuperadmin ? globalAdminSection(pathname) : null
    const resolvedServerId =
        pathServerId ?? selectedWorkspaceId ?? activeServerId
    const resolvedServer = resolvedServerId
        ? servers.find((server) => server.id === resolvedServerId)
        : undefined
    const resolvedCanAdmin = Boolean(
        resolvedServerId &&
        (resolvedServer
            ? canAdminWorkspace(resolvedServer, user.discordId) ||
              (canAdmin &&
                  resolvedServer.adminAccessOverrides?.[user.discordId] ===
                      undefined)
            : canAdmin)
    )
    const workspaceEnabled = Boolean(
        resolvedServer &&
        (resolvedServer.botInside || pathServerId || isSuperadmin)
    )
    const settingsAttention = useSettingsAttentionCount(resolvedServerId)
    const selectedGame = searchParams.get("game")
    // Tactical maps are currently a specialised HLL/Wardogs capability. New
    // catalogue games default to map-free until the platform enables it.
    const hasTacticalMaps = ["hell_let_loose", "wardogs"].includes(
        selectedGame ?? "hell_let_loose"
    )

    // On phones the menu is a sheet over the page; close it after navigating.
    useEffect(() => {
        if (isMobile) setOpenMobile(false)
    }, [pathname, isMobile, setOpenMobile])

    const base = resolvedServerId
        ? `/${locale}/dashboard/servers/${resolvedServerId}`
        : `/${locale}/dashboard`
    const superadminWorkspaceQuery = resolvedServerId
        ? `?workspace=${encodeURIComponent(resolvedServerId)}`
        : ""
    const t = dictionary.sidebar
    const within = (segment: string) =>
        Boolean(pathname?.startsWith(`${base}/${segment}`))

    const navGroups: Array<{ label: string; id?: string; items: NavItem[] }> =
        resolvedServerId && workspaceEnabled
            ? [
                  {
                      label: t.workspace,
                      items: [
                          {
                              title: t.dashboard,
                              url: base,
                              icon: LayoutDashboard,
                          },
                          {
                              title: t.calendar,
                              url: `${base}/calendar`,
                              icon: CalendarDays,
                              isActive: within("calendar"),
                          },
                          {
                              title: t.articles,
                              url: `${base}/articles`,
                              icon: ClipboardList,
                              isActive: within("articles"),
                          },
                      ],
                  },
                  {
                      label: t.operations,
                      id: "onboarding-sidebar-operations",
                      items: [
                          {
                              title: t.matches,
                              url: `${base}/matches`,
                              icon: CalendarIcon,
                              isActive: within("matches"),
                              items: [
                                  {
                                      title: t.matches,
                                      url: `${base}/matches`,
                                      isActive: within("matches"),
                                  },
                                  {
                                      title: t.signupActivity,
                                      url: `${base}/signup-activity`,
                                      isActive: within("signup-activity"),
                                  },
                                  {
                                      title: t.topicPresets,
                                      url: `${base}/topic-presets`,
                                      isActive: within("topic-presets"),
                                  },
                                  ...(hasTacticalMaps
                                      ? [
                                            {
                                                title: t.stratmaps,
                                                url: `${base}/stratmaps`,
                                                isActive: within("stratmaps"),
                                            },
                                        ]
                                      : []),
                                  {
                                      title: t.rosters,
                                      url: `${base}/rosters`,
                                      isActive: within("rosters"),
                                      items: [
                                          {
                                              title: t.rosters,
                                              url: `${base}/rosters`,
                                              isActive: within("rosters"),
                                          },
                                          {
                                              title: t.squadPresets,
                                              url: `${base}/squad-presets`,
                                              isActive: within("squad-presets"),
                                          },
                                      ],
                                  },
                              ],
                          },
                          {
                              title: t.trainings,
                              url: `${base}/trainings`,
                              icon: Shield,
                              isActive: within("trainings"),
                          },
                      ],
                  },
                  ...(resolvedCanAdmin
                      ? [
                            {
                                label: t.configuration,
                                id: "onboarding-sidebar-configuration",
                                items: [
                                    {
                                        title: t.users,
                                        url: `${base}/users`,
                                        icon: UserCog,
                                        isActive:
                                            within("users") || within("groups"),
                                        items: [
                                            {
                                                title: t.users,
                                                url: `${base}/users`,
                                                isActive: within("users"),
                                            },
                                            {
                                                title: t.groups,
                                                url: `${base}/groups`,
                                                isActive: within("groups"),
                                            },
                                            {
                                                title: t.memberships,
                                                // Membership settings now live in
                                                // the clan settings hub. Link to
                                                // that section directly instead
                                                // of making people pass through
                                                // the legacy redirect page.
                                                url: `${base}/settings/membership`,
                                                isActive:
                                                    pathname?.startsWith(
                                                        `${base}/memberships`
                                                    ) ||
                                                    within(
                                                        "settings/membership"
                                                    ),
                                            },
                                        ],
                                    },
                                    {
                                        title: t.tickets,
                                        // Ticket configuration also moved into
                                        // clan settings, so keep this shortcut
                                        // on its live destination.
                                        url: `${base}/settings/tickets`,
                                        icon: Ticket,
                                        isActive:
                                            within("tickets") ||
                                            within("settings/tickets"),
                                    },
                                    {
                                        title: t.serverSettings,
                                        url: `${base}/settings`,
                                        icon: Settings,
                                        isActive:
                                            within("settings") ||
                                            within("system") ||
                                            within("topic-presets") ||
                                            within("squad-presets"),
                                        badge: {
                                            count: settingsAttention,
                                            label: t.settingsAttention.replace(
                                                "{count}",
                                                String(settingsAttention)
                                            ),
                                        },
                                    },
                                ],
                            },
                            {
                                label: t.bot,
                                items: [
                                    ...(isSuperadmin
                                        ? [
                                              {
                                                  title: t.competitions,
                                                  url: `/${locale}/dashboard/competitions${superadminWorkspaceQuery}`,
                                                  icon: Swords,
                                                  isActive:
                                                      pathname?.startsWith(
                                                          `/${locale}/dashboard/competitions`
                                                      ),
                                              },
                                          ]
                                        : []),
                                    {
                                        title: t.bot,
                                        url: `${base}/settings/discord-panels`,
                                        icon: Bot,
                                        isActive: within(
                                            "settings/discord-panels"
                                        ),
                                    },
                                ],
                            },
                        ]
                      : []),
              ]
            : []

    // Global administration has its own sidebar (AdminSidebar); this entry
    // leads there and is shown to Logi's administrators only.
    const footerItems: NavItem[] = isSuperadmin
        ? [
              {
                  title: t.globalAdmin,
                  url: globalAdminHref(
                      locale,
                      "teams",
                      superadminWorkspaceQuery
                  ),
                  icon: Globe,
                  isActive: isGlobalAdminPath(pathname),
                  note: t.adminNav.adminsOnly,
              },
          ]
        : []

    if (adminSection)
        return (
            <AdminSidebar
                locale={locale}
                dictionary={dictionary}
                user={user}
                servers={servers}
                activeSection={adminSection}
                workspaceId={selectedWorkspaceId ?? activeServerId}
                {...props}
            />
        )

    return (
        <Sidebar id="onboarding-sidebar" {...props}>
            <SidebarHeader className="p-2 pb-0">
                <ServerSwitcher
                    locale={locale}
                    servers={servers}
                    activeServerId={resolvedServerId}
                    enabledGames={resolvedServer?.enabledGames}
                    labels={{
                        selectWorkspace: dictionary.workspace.selectWorkspace,
                        noWorkspaceSelected:
                            dictionary.workspace.noWorkspaceSelected,
                        searchWorkspace: dictionary.workspace.searchWorkspace,
                        noMatchingResults: dictionary.shared.noMatchingResults,
                        missingWorkspaceHelp:
                            dictionary.workspace.missingWorkspaceHelp,
                        showAllResults: dictionary.workspace.showAllResults,
                        allClans: dictionary.workspace.allClans,
                        allGames: dictionary.workspace.allGames,
                        gameHeading: dictionary.workspace.gameHeading,
                        clanHeading: dictionary.workspace.clanHeading,
                    }}
                />
            </SidebarHeader>
            <SidebarContent
                role="navigation"
                aria-label={dictionary.appStates.mainNavigation}
                // Let the navigation scroll independently so the account stays
                // flush with the bottom border, even when nested sections are open.
                className="gap-0"
            >
                {navGroups.map((group) => (
                    <div key={group.label} id={group.id}>
                        <NavMain label={group.label} items={group.items} />
                    </div>
                ))}
            </SidebarContent>
            <SidebarFooter id="onboarding-account-menu" className="p-2 pt-0">
                <div className="border-sidebar-border flex flex-col gap-0.5 border-t pt-2">
                    {footerItems.length ? (
                        <SidebarMenu className="gap-0.5">
                            <NavMenuItems items={footerItems} />
                        </SidebarMenu>
                    ) : null}
                    <NavUser
                        user={{ name: user.name, avatar: user.avatar }}
                        locale={locale}
                        dictionary={dictionary}
                    />
                </div>
            </SidebarFooter>
        </Sidebar>
    )
}
