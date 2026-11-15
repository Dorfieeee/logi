import {
    ArrowLeftRight,
    CheckCircle2,
    ClipboardList,
    UserMinus,
    UserPlus,
} from "lucide-react"

import Link from "next/link"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { SignupActivity } from "@/lib/signup-activity"
import { EmptyState } from "@/components/app/empty-state"
import type { Dictionary } from "@/i18n/dictionaries"

type Props = {
    eventHref?: (entry: SignupActivity) => string
    activity: SignupActivity[]
    userNameById: Map<string, string>
    dictionary: Dictionary
    /** The clan time zone; times are shown there, not in the server's. */
    timezone?: string
    /** `Intl` locale of the page, such as `cs-CZ`. */
    intlLocale: string
    /** True when the list may be cut off at the query limit. */
    limited?: { count: number }
}

const activityMeta = {
    signed_up: {
        Icon: UserPlus,
        tone: "text-emerald-600 dark:text-emerald-400",
    },
    changed_role: {
        Icon: ArrowLeftRight,
        tone: "text-sky-600 dark:text-sky-400",
    },
    unsigned: { Icon: UserMinus, tone: "text-amber-600 dark:text-amber-400" },
    declined: { Icon: CheckCircle2, tone: "text-muted-foreground" },
} as const

export function SignupActivityFeed({
    activity,
    userNameById,
    dictionary,
    timezone,
    intlLocale,
    limited,
    eventHref,
}: Props) {
    if (!activity.length)
        return (
            <EmptyState
                icon={ClipboardList}
                title={dictionary.signupActivity.emptyTitle}
                description={dictionary.signupActivity.emptyDescription}
            />
        )

    const dateFormatter = new Intl.DateTimeFormat(intlLocale, {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: timezone,
    })

    return (
        <Card className="border-border/60 overflow-hidden rounded-2xl">
            <CardHeader>
                <CardTitle>{dictionary.signupActivity.title}</CardTitle>
                <p className="text-muted-foreground text-sm">
                    {dictionary.signupActivity.description}
                </p>
            </CardHeader>
            <CardContent className="space-y-3">
                {limited ? (
                    <p
                        role="status"
                        className="border-border/60 bg-muted/40 text-muted-foreground rounded-xl border px-3 py-2 text-sm"
                    >
                        {dictionary.signupActivity.limitNotice.replace(
                            "{count}",
                            String(limited.count)
                        )}
                    </p>
                ) : null}
                <ol className="divide-border border-border/60 divide-y overflow-hidden rounded-xl border">
                    {activity.map((entry) => {
                        const { Icon, tone } = activityMeta[entry.action]
                        const userName =
                            userNameById.get(entry.userId) ?? entry.userId
                        const action =
                            dictionary.signupActivity.actions[entry.action]
                        const roleDetail =
                            entry.action === "changed_role"
                                ? `${entry.previousRole ?? dictionary.signupActivity.noRole} → ${entry.role ?? dictionary.signupActivity.noRole}`
                                : entry.role
                        return (
                            <li
                                key={entry.id}
                                className="flex flex-wrap gap-x-3 gap-y-1 p-4 sm:flex-nowrap"
                            >
                                <Icon
                                    className={`mt-0.5 size-5 shrink-0 ${tone}`}
                                    aria-hidden="true"
                                />
                                <div className="min-w-0 flex-1">
                                    <p className="font-medium break-words">
                                        {userName}{" "}
                                        <span className="text-muted-foreground font-normal">
                                            {action}
                                        </span>
                                    </p>
                                    <p className="text-muted-foreground mt-1 text-sm break-words">
                                        {eventHref ? (
                                            <Link
                                                href={eventHref(entry)}
                                                className="underline underline-offset-4"
                                            >
                                                {entry.eventName}
                                            </Link>
                                        ) : (
                                            entry.eventName
                                        )}{" "}
                                        ·{" "}
                                        {entry.eventKind === "match"
                                            ? dictionary.sidebar.matches
                                            : dictionary.sidebar.trainings}
                                        {roleDetail
                                            ? ` · ${dictionary.signupActivity.role}: ${roleDetail}`
                                            : ""}
                                    </p>
                                </div>
                                <time
                                    className="text-muted-foreground w-full shrink-0 pl-8 text-xs sm:w-auto sm:pl-0 sm:text-right"
                                    dateTime={entry.occurredAt}
                                >
                                    {dateFormatter.format(
                                        new Date(entry.occurredAt)
                                    )}
                                </time>
                            </li>
                        )
                    })}
                </ol>
            </CardContent>
        </Card>
    )
}
