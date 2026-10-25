import { isGameId, withGameOverrides, type GameId } from "@/domain/games/game"
import { ManagersOnlyState } from "@/components/app/managers-only-state"
import { getDictionary, type Dictionary } from "@/i18n/dictionaries"
import { getLinkedClanTeams } from "@/lib/read-models/clan-teams"
import { getEventDraft } from "@/lib/gateways/event-drafts"
import { getServerContext } from "@/lib/server-context"
import { makeFunctionReference } from "convex/server"
import type { TeamDto } from "@/domain/teams/team"
import { fetchQuery } from "convex/nextjs"
import { isLocale } from "@/i18n/config"

import { NewMatchFlow, type NewMatchFlowProps } from "./new-match-flow"

type ServerContext = NonNullable<Awaited<ReturnType<typeof getServerContext>>>

/**
 * The flow props that come from the clan alone, shared by creating and
 * editing: games, templates, groups, presets, channels and the bot's
 * language and message style.
 */
export function clanFlowProps(input: {
    context: ServerContext
    dictionary: Dictionary
    locale: string
    serverId: string
    linkedTeams: TeamDto[]
}): Omit<
    NewMatchFlowProps,
    "initialKind" | "initialGameId" | "draft" | "edit" | "gameCatalogue"
> & { enabledGames: GameId[] } {
    const { context } = input
    const enabledGames: GameId[] = context.server.enabledGames?.length
        ? context.server.enabledGames
        : ["hell_let_loose"]
    const config = context.discordConfig
    const channelDefaults: NewMatchFlowProps["channelDefaults"] =
        Object.fromEntries(
            enabledGames.map((gameId) => {
                const scoped = config
                    ? withGameOverrides(config, config.gameOverrides, gameId)
                    : null
                return [
                    gameId,
                    {
                        announcementChannelId:
                            scoped?.announcementsChannelId || undefined,
                        eventInfoChannelId:
                            scoped?.eventInfoChannelId || undefined,
                    },
                ]
            })
        )
    const botLanguage = config?.defaultLanguage ?? "en"
    return {
        serverId: input.serverId,
        locale: input.locale,
        dictionary: input.dictionary,
        previewCopy: getDictionary(botLanguage).newMatch.preview,
        botLanguage,
        enabledGames,
        templates: context.server.matchTemplates ?? [],
        groups: context.groups,
        squadPresets: context.squadPresets,
        eventCategories: context.server.eventCategories ?? [],
        topicPresets: context.topicPresets.map((preset) => ({
            id: preset.id,
            name: preset.name,
        })),
        stratmaps: context.stratmaps.map((stratmap) => ({
            id: stratmap.id,
            title: stratmap.title,
            gameId: stratmap.gameId,
        })),
        timezone: config?.timezone ?? "UTC",
        clan: { name: context.server.name, avatar: context.server.avatar },
        linkedTeams: input.linkedTeams,
        channelDefaults,
        clanRoleId: config?.clanRoleId,
        forumCategoryConfigured: Boolean(config?.forumCategoryId),
        messageStyle: config?.messageStyle,
    }
}

/**
 * Server half of the new-match flow (design D2), shared by the match, event
 * and training create routes. `?draftId=` resumes a draft of this clan; any
 * other ID starts a fresh match.
 */
export async function NewMatchPage({
    locale,
    serverId,
    kind,
    game,
    draftId,
}: {
    locale: string
    serverId: string
    kind: "match" | "training"
    game?: string
    draftId?: string
}) {
    const dictionary = getDictionary(isLocale(locale) ? locale : "en")
    const context = await getServerContext(serverId, "all")
    if (!context?.canAdmin)
        return (
            <ManagersOnlyState
                dictionary={dictionary}
                overviewHref={`/${locale}/dashboard/servers/${serverId}`}
            />
        )
    const [draft, linkedTeams, gameCatalogue] = await Promise.all([
        draftId ? getEventDraft(serverId, draftId) : Promise.resolve(null),
        getLinkedClanTeams(context.server.discordId),
        fetchQuery(makeFunctionReference<"query">("gameCatalog:list"), {}),
    ])
    const shared = clanFlowProps({
        context,
        dictionary,
        locale,
        serverId,
        linkedTeams,
    })
    const requested =
        isGameId(game) && shared.enabledGames.includes(game) ? game : null
    const initialGameId = draft?.gameId ?? requested ?? shared.enabledGames[0]

    return (
        <NewMatchFlow
            key={draft?.id ?? "new"}
            {...shared}
            initialKind={draft?.kind ?? kind}
            initialGameId={initialGameId}
            draft={draft}
            gameCatalogue={gameCatalogue as NewMatchFlowProps["gameCatalogue"]}
        />
    )
}
