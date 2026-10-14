import type { resultReviewSchema } from "@/domain/match-results/result-revision"
import { suggestResultSession } from "@/domain/match-results/session-pick"
import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import { formatDateTime } from "@/lib/format"
import Link from "next/link"
import type { z } from "zod"

export function MissingResultNotice({
    review,
    start,
    end,
    href,
    dictionary,
    locale,
    timezone,
}: {
    review: z.infer<typeof resultReviewSchema> | null
    start: string
    end: string
    href: string
    dictionary: Dictionary
    locale: string
    timezone: string
}) {
    if (review?.current) return null
    const t = dictionary.wardogsMatchDetails
    const candidate = suggestResultSession(review?.sessions ?? [], start, end)
    return (
        <section
            className="bg-card space-y-3 rounded-2xl border p-5"
            role="region"
            aria-label={t.missingTitle}
        >
            <h2 className="font-semibold">{t.missingTitle}</h2>
            <p className="text-muted-foreground text-sm">{t.missingBody}</p>
            {candidate ? (
                <div className="bg-muted/50 space-y-1 rounded-xl p-3">
                    <p className="font-medium">{t.suggestion}</p>
                    <p className="text-sm">
                        {candidate.map ?? dictionary.shared.notSet}
                        {candidate.endedAt
                            ? ` · ${formatDateTime(candidate.endedAt, timezone, locale)}`
                            : ""}{" "}
                        ·{" "}
                        {candidate.participants
                            .map((side) => side.score ?? "—")
                            .join(" : ")}
                    </p>
                </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-3">
                <Button asChild>
                    <Link href={href}>{t.reviewResult}</Link>
                </Button>
                <span className="text-muted-foreground text-sm">
                    {t.otherSource}
                </span>
            </div>
        </section>
    )
}
