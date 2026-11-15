import { EventDeliveryStatus } from "@/components/app/event-delivery-status"
import { EventSignupHistory } from "@/components/app/event-signup-history"
import { notFound } from "next/navigation"
import Link from "next/link"

import { CompleteTrainingButton } from "@/components/app/complete-training-button"
import { EventOverview } from "@/components/app/match-detail/event-overview"
import { eventEditability } from "@/domain/events/event-edit"
import { getUsersByIds } from "@/lib/server-user-management"
import { PageHeader } from "@/components/app/page-header"
import { GameBadge } from "@/components/app/game-badge"
import { getServerContext } from "@/lib/server-context"
import { getEventStatusMeta } from "@/lib/event-status"
import { getDictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import { isGameId } from "@/domain/games/game"
import { isLocale } from "@/i18n/config"

export default async function TrainingDetailPage({
    params,
    searchParams,
}: {
    params: Promise<{ locale: string; serverId: string; eventId: string }>
    searchParams: Promise<{ game?: string; tab?: string }>
}) {
    const { locale, serverId, eventId } = await params
    const { game, tab } = await searchParams
    const activeTab = tab === "history" ? "history" : "overview"
    const safeLocale = isLocale(locale) ? locale : "en"
    const dictionary = getDictionary(safeLocale)
    const context = await getServerContext(
        serverId,
        isGameId(game) ? game : "all"
    )
    if (!context) notFound()
    const { events, canAdmin } = context
    const event = events.find(
        (item) => item.id === eventId && item.kind === "training"
    )
    if (!event) notFound()
    const attendingParticipants = event.participants.filter(
        (participant) => participant.status === "attending"
    )
    const users = await getUsersByIds(
        attendingParticipants.map((participant) => participant.userId),
        context.server.discordId
    )
    const userByDiscordId = new Map(users.map((user) => [user.discordId, user]))
    const attendees = attendingParticipants.map((participant) => ({
        userId: participant.userId,
        label:
            userByDiscordId.get(participant.userId)?.name ?? participant.userId,
        completed: participant.completed,
    }))

    const statusMeta = getEventStatusMeta(event.status, dictionary)
    // Managers edit in the new-match flow until the training concludes.
    const editHref =
        canAdmin && eventEditability(event, new Date()) === "editable"
            ? `/${locale}/dashboard/servers/${serverId}/trainings/${event.id}/edit`
            : null

    return (
        <>
            <PageHeader
                title={event.name}
                description={event.description}
                badges={
                    !isGameId(game) ? (
                        <GameBadge
                            gameId={event.gameId}
                            dictionary={dictionary}
                        />
                    ) : undefined
                }
                badge={statusMeta?.label}
                actions={
                    <div className="flex flex-wrap gap-2">
                        {editHref ? (
                            <Button
                                asChild
                                variant="outline"
                                className="rounded-xl"
                            >
                                <Link href={editHref}>
                                    {dictionary.newMatch.edit.titleTraining}
                                </Link>
                            </Button>
                        ) : null}
                        {canAdmin && event.status !== "concluded" ? (
                            <CompleteTrainingButton
                                serverId={serverId}
                                eventId={event.id}
                                disabled={false}
                                dictionary={dictionary}
                                attendees={attendees}
                            />
                        ) : null}
                    </div>
                }
            />
            <div className="space-y-4 px-4 lg:px-6">
                <nav
                    aria-label={dictionary.matchDetail.tabsLabel}
                    className="flex gap-4 border-b"
                >
                    {(["overview", "history"] as const).map((target) => {
                        const query = new URLSearchParams()
                        if (isGameId(game)) query.set("game", game)
                        if (target === "history") query.set("tab", "history")
                        return (
                            <Link
                                key={target}
                                href={`/${locale}/dashboard/servers/${serverId}/trainings/${event.id}${query.size ? `?${query}` : ""}`}
                                scroll={false}
                                aria-current={
                                    activeTab === target ? "page" : undefined
                                }
                                className={`border-b-2 px-3 py-3 text-sm ${activeTab === target ? "border-foreground font-semibold" : "text-muted-foreground border-transparent"}`}
                            >
                                {target === "overview"
                                    ? dictionary.matchDetail.tabs.overview
                                    : dictionary.signupActivity.title}
                            </Link>
                        )
                    })}
                </nav>
                {activeTab === "history" ? (
                    <EventSignupHistory
                        serverId={serverId}
                        eventId={event.id}
                        guildDiscordId={context.server.discordId}
                        dictionary={dictionary}
                        locale={safeLocale}
                        timezone={context.discordConfig?.timezone}
                    />
                ) : (
                    <>
                        {canAdmin && !event.isDraft ? (
                            <EventDeliveryStatus
                                key={event.id}
                                serverId={serverId}
                                eventId={event.id}
                                dictionary={dictionary}
                            />
                        ) : null}
                        <EventOverview
                            event={event}
                            context={context}
                            dictionary={dictionary}
                            locale={locale}
                            serverId={serverId}
                            editHref={editHref}
                            seriesEditHref={null}
                            canResyncTopics={false}
                        />
                    </>
                )}
            </div>
        </>
    )
}
