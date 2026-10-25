import { redirect } from "next/navigation"
import { SearchX } from "lucide-react"
import Link from "next/link"

import {
    eventEditability,
    eventSeriesRole,
    signupCounts,
} from "@/domain/events/event-edit"
import {
    NEW_MATCH_STEPS,
    type NewMatchStep,
} from "@/domain/events/new-match-flow"
import { ManagersOnlyState } from "@/components/app/managers-only-state"
import { getLinkedClanTeams } from "@/lib/read-models/clan-teams"
import { EmptyState } from "@/components/app/empty-state"
import { getServerContext } from "@/lib/server-context"
import { makeFunctionReference } from "convex/server"
import { getDictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import { fetchQuery } from "convex/nextjs"
import { isLocale } from "@/i18n/config"

import { clanFlowProps } from "./new-match-page"
import { NewMatchFlow } from "./new-match-flow"

export type EditSection = "matches" | "events" | "trainings"

function isStep(value: unknown): value is NewMatchStep {
    return NEW_MATCH_STEPS.some((step) => step === value)
}

/**
 * Server half of editing a published match or training: the new-match flow
 * (design D2) in edit mode, prefilled from the stored event. Clan managers
 * only. A draft opens in the create flow, a concluded event shows why it can
 * no longer change, and a training opened under matches (or the other way
 * round) moves to its own route.
 */
export async function EditMatchPage({
    locale,
    serverId,
    eventId,
    section,
    step,
}: {
    locale: string
    serverId: string
    eventId: string
    section: EditSection
    step?: string
}) {
    const dictionary = getDictionary(isLocale(locale) ? locale : "en")
    const t = dictionary.newMatch.edit
    const base = `/${locale}/dashboard/servers/${serverId}`
    const context = await getServerContext(serverId, "all")
    if (!context?.canAdmin)
        return <ManagersOnlyState dictionary={dictionary} overviewHref={base} />
    const event = context.events.find((item) => item.id === eventId)
    const listHref = `${base}/${section === "trainings" ? "trainings" : section}`
    if (!event)
        return (
            <div className="px-4 lg:px-6">
                <EmptyState
                    icon={SearchX}
                    title={t.notFoundTitle}
                    description={t.notFoundDescription}
                    actions={
                        <Button
                            asChild
                            variant="outline"
                            className="rounded-xl"
                        >
                            <Link href={listHref}>
                                {section === "trainings"
                                    ? t.breadcrumbTrainings
                                    : dictionary.matchDetail.backToMatches}
                            </Link>
                        </Button>
                    }
                />
            </div>
        )
    const isTraining = event.kind === "training"
    const query = isStep(step) ? `?step=${step}` : ""
    const editability = eventEditability(event, new Date())
    if (editability === "draft")
        redirect(
            `${base}/${isTraining ? "trainings" : "matches"}/create?draftId=${encodeURIComponent(event.id)}`
        )
    if (section === "matches" && isTraining)
        redirect(`${base}/trainings/${event.id}/edit${query}`)
    if (section === "trainings" && !isTraining)
        redirect(`${base}/matches/${event.id}/edit${query}`)
    const detailHref = `${base}/${section}/${event.id}`
    const [linkedTeams, gameCatalogue] = await Promise.all([
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
    const role = eventSeriesRole(event)
    const source =
        role?.kind === "occurrence"
            ? context.events.find((item) => item.id === role.sourceId)
            : undefined
    const series =
        role?.kind === "occurrence"
            ? {
                  kind: "occurrence" as const,
                  sourceEditHref:
                      source &&
                      eventEditability(source, new Date()) === "editable"
                          ? `${base}/matches/${source.id}/edit?step=time`
                          : null,
              }
            : role

    return (
        <NewMatchFlow
            key={event.id}
            {...shared}
            initialKind={event.kind}
            initialGameId={event.gameId ?? "hell_let_loose"}
            draft={null}
            gameCatalogue={
                gameCatalogue as Parameters<
                    typeof NewMatchFlow
                >[0]["gameCatalogue"]
            }
            edit={{
                event,
                detailHref,
                listHref:
                    section === "events"
                        ? `${base}/${isTraining ? "trainings" : "matches"}`
                        : listHref,
                initialStep: isStep(step) ? step : "match",
                series,
                rosterExists: context.rosters.some(
                    (roster) => roster.eventId === event.id
                ),
                signups: signupCounts(event.participants),
            }}
        />
    )
}
