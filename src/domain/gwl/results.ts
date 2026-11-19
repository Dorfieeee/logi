import {
    resultRevisionSchema,
    type ResultDraft,
    type ResultRevision,
} from "../match-results/result-revision"
/** Only the authenticated GWL worker calls this explicit provider confirmation policy. */
export function gwlResultRevision(
    draft: ResultDraft,
    previous: ResultRevision | null,
    disputed: boolean,
    now: string
): ResultRevision {
    return resultRevisionSchema.parse({
        ...draft,
        version: (previous?.version ?? 0) + 1,
        status: disputed ? "provisional" : previous ? "corrected" : "confirmed",
        createdAt: now,
        createdBy: null,
        reviewerId: null,
        reviewedAt: disputed ? null : now,
        supersedesVersion: previous?.version ?? null,
        reason: disputed
            ? "GWL result disputed; retracted until reconfirmed."
            : "Confirmed by Global Wardogs League.",
    })
}
