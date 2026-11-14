import { startOwnedInterval } from "./task-owner"

export type ScheduledClaim = {
    id: string
    eventId: string
    claimVersion: number
    kind:
        | "close-registration"
        | "registration-start"
        | "start-event"
        | "create-squad-voice-channels"
        | "conclude-event"
        | "attendance-reminder"
        | "signup-reminder"
        | "refresh-announcement"
}

/** The worker keeps ownership of every admitted claim, including queued batch items. */
export async function runScheduledBatch(
    jobs: ScheduledClaim[],
    ports: {
        renew(jobs: ScheduledClaim[]): Promise<string[]>
        reconcile(
            job: ScheduledClaim
        ): Promise<{ changedEventIds: string[]; scoreEventIds: string[] }>
        complete(
            job: ScheduledClaim,
            result: { changedEventIds: string[]; scoreEventIds: string[] }
        ): Promise<boolean>
        release(job: ScheduledClaim): Promise<unknown>
        failed(error: unknown): void
    }
) {
    const outstanding = new Map(jobs.map((job) => [job.id, job]))
    const changed = new Set<string>(),
        scores = new Set<string>()
    const attendance = new Set<string>(),
        signup = new Set<string>()
    const stop = startOwnedInterval(
        async () => {
            await ports.renew([...outstanding.values()])
        },
        30_000,
        ports.failed,
        false
    )
    try {
        for (const job of jobs) {
            try {
                if (!(await ports.renew([job])).includes(job.id)) continue
                const result = await ports.reconcile(job)
                if (
                    !(await ports.complete(job, {
                        changedEventIds: result.changedEventIds,
                        scoreEventIds: result.scoreEventIds,
                    }))
                )
                    continue
                changed.add(job.eventId)
                for (const id of result.changedEventIds) changed.add(id)
                for (const id of result.scoreEventIds) scores.add(id)
                if (job.kind === "attendance-reminder")
                    attendance.add(job.eventId)
                if (job.kind === "signup-reminder") signup.add(job.eventId)
            } catch (error) {
                ports.failed(error)
                try {
                    await ports.release(job)
                } catch (failure) {
                    ports.failed(failure)
                }
            } finally {
                outstanding.delete(job.id)
            }
        }
    } finally {
        await stop()
    }
    return {
        changedEventIds: [...changed],
        scoreEventIds: [...scores],
        attendanceReminderEventIds: [...attendance],
        signupReminderEventIds: [...signup],
    }
}
