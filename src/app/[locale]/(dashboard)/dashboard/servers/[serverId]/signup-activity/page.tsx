import { notFound } from "next/navigation"
import Link from "next/link"

import { getSignupActivity, SIGNUP_ACTIVITY_LIMIT } from "@/lib/signup-activity"
import { SignupActivityFeed } from "@/components/app/signup-activity-feed"
import { getUsersByIds } from "@/lib/server-user-management"
import { PageHeader } from "@/components/app/page-header"
import { getServerContext } from "@/lib/server-context"
import { getDictionary } from "@/i18n/dictionaries"
import { toIntlLocale } from "@/lib/intl-locale"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { isLocale } from "@/i18n/config"

export default async function SignupActivityPage({
    params,
    searchParams,
}: {
    params: Promise<{ locale: string; serverId: string }>
    searchParams: Promise<{ eventId?: string | string[] }>
}) {
    const { locale, serverId } = await params
    const { eventId: rawEventId } = await searchParams
    const eventId = Array.isArray(rawEventId) ? rawEventId[0] : rawEventId
    const safeLocale = isLocale(locale) ? locale : "en"
    const dictionary = getDictionary(safeLocale)
    const context = await getServerContext(serverId)
    if (!context) notFound()

    const event = eventId
        ? context.events.find((item) => item.id === eventId)
        : undefined
    // An event filter must name one of this clan's events; Convex rejects a
    // malformed ID, which also ends here.
    if (eventId && !event) notFound()
    const activity = await getSignupActivity(serverId, eventId).catch(() => {
        notFound()
    })
    const users = await getUsersByIds(
        [...new Set(activity.map((entry) => entry.userId))],
        context.server.discordId
    )
    const userNameById = new Map(
        users.map((user) => [user.discordId, user.name])
    )
    const allHref = `/${safeLocale}/dashboard/servers/${serverId}/signup-activity`

    return (
        <>
            <PageHeader
                title={dictionary.signupActivity.title}
                description={dictionary.signupActivity.description}
                badges={
                    event ? (
                        <Badge variant="outline" className="rounded-full">
                            {dictionary.signupActivity.filteredBy.replace(
                                "{event}",
                                event.name
                            )}
                        </Badge>
                    ) : undefined
                }
                actions={
                    event ? (
                        <Button
                            asChild
                            variant="outline"
                            className="rounded-xl"
                        >
                            <Link href={allHref}>
                                {dictionary.signupActivity.showAll}
                            </Link>
                        </Button>
                    ) : undefined
                }
            />
            <div className="mt-6 px-4 lg:px-6">
                <SignupActivityFeed
                    activity={activity}
                    eventHref={(entry) =>
                        `/${safeLocale}/dashboard/servers/${serverId}/${entry.eventKind === "training" ? "trainings" : "matches"}/${entry.eventId}?tab=history`
                    }
                    userNameById={userNameById}
                    dictionary={dictionary}
                    timezone={context.discordConfig?.timezone}
                    intlLocale={toIntlLocale(safeLocale)}
                    limited={
                        activity.length >= SIGNUP_ACTIVITY_LIMIT
                            ? { count: SIGNUP_ACTIVITY_LIMIT }
                            : undefined
                    }
                />
            </div>
        </>
    )
}
