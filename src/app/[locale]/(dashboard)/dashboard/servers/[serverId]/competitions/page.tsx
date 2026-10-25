import type { ClanCompetitionView } from "@/domain/competitions/enrollment"
import { currentDashboardActor } from "@/lib/gateways/dashboard-actor"
import { ClanCompetitions } from "@/components/app/clan-competitions"
import { PageHeader } from "@/components/app/page-header"
import { getServerContext } from "@/lib/server-context"
import { makeFunctionReference } from "convex/server"
import { getDictionary } from "@/i18n/dictionaries"
import { getInternalAuthSecret } from "@/lib/env"
import { fetchQuery } from "convex/nextjs"
import { isLocale } from "@/i18n/config"
export default async function CompetitionsPage({
    params,
}: {
    params: Promise<{ locale: string; serverId: string }>
}) {
    const { locale, serverId } = await params
    const context = await getServerContext(serverId, "all")
    const actor = await currentDashboardActor()
    if (!context?.canAdmin || !actor) return null
    const dictionary = getDictionary(isLocale(locale) ? locale : "en")
    const view = await fetchQuery(
        makeFunctionReference<
            "query",
            { secret: string; actor: typeof actor; guildId: string },
            ClanCompetitionView
        >("competitionEnrollment:list"),
        {
            secret: getInternalAuthSecret(),
            actor,
            guildId: context.server.discordId,
        }
    )
    return (
        <>
            <PageHeader
                title={dictionary.competitionEnrollment.title}
                description={dictionary.competitionEnrollment.description}
            />
            <div className="px-4 pb-6 lg:px-6">
                <ClanCompetitions
                    view={view}
                    serverId={serverId}
                    locale={locale}
                    dictionary={dictionary}
                />
            </div>
        </>
    )
}
