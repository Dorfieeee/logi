import { getSignupActivity, SIGNUP_ACTIVITY_LIMIT } from "@/lib/signup-activity"
import { SignupActivityFeed } from "@/components/app/signup-activity-feed"
import { getUsersByIds } from "@/lib/server-user-management"
import type { Dictionary } from "@/i18n/dictionaries"

/** Always query this event through the existing authenticated, clan-scoped reader. */
export async function EventSignupHistory({
    serverId,
    eventId,
    guildDiscordId,
    dictionary,
    locale,
    timezone,
}: {
    serverId: string
    eventId: string
    guildDiscordId: string
    dictionary: Dictionary
    locale: string
    timezone?: string
}) {
    const activity = await getSignupActivity(serverId, eventId)
    const users = await getUsersByIds(
        [...new Set(activity.map((entry) => entry.userId))],
        guildDiscordId
    )
    return (
        <SignupActivityFeed
            activity={activity}
            userNameById={
                new Map(users.map((user) => [user.discordId, user.name]))
            }
            dictionary={dictionary}
            intlLocale={locale}
            timezone={timezone}
            limited={
                activity.length >= SIGNUP_ACTIVITY_LIMIT
                    ? { count: SIGNUP_ACTIVITY_LIMIT }
                    : undefined
            }
        />
    )
}
