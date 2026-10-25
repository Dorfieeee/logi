/** Score-only results are match results even without collected player data. */
export function hasRecentMatchResult(event: {
    kind?: string
    isDraft?: boolean
    eventResult?: object
    reviewedResult?: { status: string }
}) {
    if (event.kind === "training" || event.isDraft) return false
    if (event.reviewedResult)
        return (
            event.reviewedResult.status === "confirmed" ||
            event.reviewedResult.status === "corrected"
        )
    return Boolean(event.eventResult)
}
