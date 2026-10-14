import { getWardogsMatchReport } from "@/lib/read-models/wardogs-match-reports"
import { WardogsMatchDetails } from "@/components/app/wardogs-match-details"
import { getServerMatchByEventId } from "@/lib/server-matches"
import { MatchDetails } from "@/components/app/match-details"
import { PageHeader } from "@/components/app/page-header"
import { getServerContext } from "@/lib/server-context"
import { getDictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import { isGameId } from "@/domain/games/game"
import { notFound } from "next/navigation"
import { isLocale } from "@/i18n/config"
import Link from "next/link"

export async function MatchReportPage({
    params,
    searchParams,
    section,
}: {
    params: Promise<{ locale: string; serverId: string; eventId: string }>
    searchParams: Promise<{ game?: string }>
    section: "matches" | "events"
}) {
    const { locale, serverId, eventId } = await params
    const { game } = await searchParams
    const safeLocale = isLocale(locale) ? locale : "en"
    const dictionary = getDictionary(safeLocale)
    const context = await getServerContext(
        serverId,
        isGameId(game) ? game : "all"
    )
    const event = context?.events.find(
        (item) => item.id === eventId && (item.kind ?? "match") === "match"
    )
    if (!context || !event) notFound()
    const [match, report] = await Promise.all([
        getServerMatchByEventId(eventId),
        event.gameId === "wardogs"
            ? getWardogsMatchReport(eventId, context.server.discordId)
            : Promise.resolve(null),
    ])
    const reviewHref = `/${safeLocale}/dashboard/servers/${serverId}/${section}/${eventId}?tab=result&game=${encodeURIComponent(event.gameId ?? "hell_let_loose")}`
    return (
        <>
            <PageHeader
                title={event.name}
                description={dictionary.event.matchDetailDescription}
                actions={
                    <div className="flex flex-wrap gap-2">
                        <Button asChild variant="outline">
                            <Link href={reviewHref}>
                                {dictionary.wardogsMatchDetails.reviewResult}
                            </Link>
                        </Button>
                        {match ? (
                            <Button asChild variant="outline">
                                <a
                                    href={match.sourceUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    {dictionary.event.rawSource}
                                </a>
                            </Button>
                        ) : null}
                    </div>
                }
            />
            <div className="space-y-6 px-4 pb-6 lg:px-6">
                {report ? (
                    <WardogsMatchDetails
                        report={report}
                        dictionary={dictionary}
                        locale={safeLocale}
                        timezone={context.discordConfig?.timezone ?? "UTC"}
                    />
                ) : match ? (
                    <MatchDetails
                        match={match}
                        dictionary={dictionary}
                        timezone={context.discordConfig?.timezone ?? "UTC"}
                    />
                ) : (
                    <div className="space-y-3 rounded-2xl border border-dashed p-6">
                        <h2 className="font-semibold">
                            {dictionary.wardogsMatchDetails.missingTitle}
                        </h2>
                        <p className="text-muted-foreground text-sm">
                            {dictionary.wardogsMatchDetails.missingBody}
                        </p>
                        <Button asChild>
                            <Link href={reviewHref}>
                                {dictionary.wardogsMatchDetails.reviewResult}
                            </Link>
                        </Button>
                    </div>
                )}
            </div>
        </>
    )
}
