import { SIGNUP_REMINDER_INTERVAL_MS } from "../../domain/events/scheduled-job-policy"
import type { QueryCtx } from "../../../convex/_generated/server"
import type { Doc } from "../../../convex/_generated/dataModel"

/** Recent legacy deliveries seed the cooldown when upgrading existing events. */
export async function lastSignupReminderAt(
    ctx: Pick<QueryCtx, "db">,
    event: Doc<"events">,
    now: number
): Promise<string | undefined> {
    const recent = await ctx.db
        .query("automaticReminderOutcomes")
        .withIndex("eventId_sentAt", (q) =>
            q
                .eq("eventId", event._id)
                .gt(
                    "sentAt",
                    new Date(now - SIGNUP_REMINDER_INTERVAL_MS).toISOString()
                )
        )
        .collect()
    const timestamps = [
        event.signupReminderClaimedAt,
        ...recent
            .filter((run) => run.kind === "signup")
            .map((run) => run.sentAt),
    ].filter(
        (at): at is string =>
            at !== undefined && Number.isFinite(Date.parse(at))
    )
    return timestamps.sort((a, b) => Date.parse(b) - Date.parse(a))[0]
}
