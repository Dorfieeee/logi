import { processAttendanceReminders } from "../sync/attendance-reminders"
import type { DurableDelivery } from "./durable-delivery"
import { TaskOwner } from "./task-owner"
import type { Client } from "discord.js"

import {
    buildEventSignatureMap,
    buildGuildPayload as buildGuildPayloadShared,
    getChangedEventIds,
} from "../../../src/application/discord-sync/payload-builder"
import type { EventSyncContext, EventSyncIndex, SyncPayload } from "../types"
import { processSignupReminders } from "../sync/signup-reminders"
import { isHistoricalConcludedEvent } from "../sync/relevance"
import { processMatchRecaps } from "../sync/match-recaps"
import { makeFunctionReference } from "convex/server"
import { getCalendarSyncVersion } from "../sync/work"
import type { CalendarSyncPayload } from "../types"
import { logError, logInfo, logWarn } from "../log"
import { syncCalendarPanel } from "../sync/panels"
import { convex, references } from "../convex"
import { mapConcurrent } from "./work-queue"
import { syncGuildPayload } from "../sync"
import { env } from "../environment"

import {
    GuildCache,
    hasConfiguredClanDiscordTarget,
    type GuildRuntimeData,
} from "./guild-cache"

type EventIndexRecord = EventSyncIndex["events"][number]
type RosterIndexRecord = EventSyncIndex["rosters"][number]

// A player expects their own interaction to be reflected straight away. Once
// a flush is already pending or writing to Discord, a short window still lets
// concurrent clicks share that work instead of creating a message edit per
// click.
export function interactiveFlushDelay(input: {
    isFlushing: boolean
    hasScheduledFlush: boolean
}) {
    return input.isFlushing || input.hasScheduledFlush ? 250 : 0
}

type ScheduledWork = {
    kind: string
    dueAt: string
    delivery: DurableDelivery
    resolve(): void
    reject(error: unknown): void
}
export class DiscordSyncService {
    private readonly scheduledWork = new Map<string, ScheduledWork[]>()
    private readonly tasks = new TaskOwner()
    private readonly queuedEventIds = new Set<string>()
    private readonly queuedAttendanceReminderEventIds = new Set<string>()
    private readonly queuedSignupReminderEventIds = new Set<string>()
    private readonly queuedGuildIds = new Set<string>()
    private readonly guildCache = new GuildCache()
    private readonly eventIndexById = new Map<string, EventIndexRecord>()
    private readonly eventIdsByGuild = new Map<string, string[]>()
    private readonly rosterIndexByEventId = new Map<string, RosterIndexRecord>()
    private readonly eventSignatureById = new Map<string, string>()

    private eventIndexUnsubscribe?: () => void
    private flushTimer?: ReturnType<typeof setTimeout>
    private flushDueAt?: number
    private isFlushing = false
    private fullResyncRequested = false

    constructor(private readonly client: Client) {}

    start() {
        return this.tasks.run(() => this.initialize())
    }

    private async initialize() {
        if (this.tasks.stopped) return
        logInfo("sync-service", "Starting sync service")
        await this.guildCache.start((guildIds) => {
            for (const guildId of guildIds) {
                const runtime = this.guildCache.get(guildId)
                if (runtime && hasConfiguredClanDiscordTarget(runtime)) {
                    this.queueGuildSync(guildId)
                }
            }
            this.scheduleFlush(250)
        })

        if (this.tasks.stopped) return
        const initialIndex = (await convex.query(
            references.listEventSyncIndex,
            {
                secret: env.internalSecret,
                compact: true,
            }
        )) as EventSyncIndex
        if (this.tasks.stopped) return
        this.applyEventIndex(initialIndex, true)
        logInfo("sync-service", "Loaded initial event index", {
            eventCount: initialIndex.events.length,
            rosterCount: initialIndex.rosters.length,
        })

        const watch = convex.watchQuery(references.listEventSyncIndex, {
            secret: env.internalSecret,
            compact: true,
        })
        this.eventIndexUnsubscribe = watch.onUpdate(() => {
            try {
                const index = watch.localQueryResult() as
                    EventSyncIndex | undefined
                if (!index) {
                    return
                }

                this.applyEventIndex(index, false)
                logInfo("sync-service", "Convex event index updated", {
                    eventCount: index.events.length,
                    rosterCount: index.rosters.length,
                })
                this.scheduleFlush(250)
            } catch (error) {
                logError(
                    "sync-service",
                    "Failed to process event sync index update",
                    { error }
                )
            }
        })

        this.requestFullResync()
    }

    enqueueScheduled(
        eventId: string,
        kind: string,
        delivery: DurableDelivery,
        dueAt: string
    ): Promise<void> {
        if (this.tasks.stopped)
            return Promise.reject(new Error("Sync is stopping"))
        return new Promise((resolve, reject) => {
            const work = this.scheduledWork.get(eventId) ?? []
            work.push({ kind, delivery, dueAt, resolve, reject })
            this.scheduledWork.set(eventId, work)
            this.queueEventSync(eventId)
            this.triggerInteractiveFlush()
        })
    }

    stop() {
        for (const work of this.scheduledWork.values())
            for (const item of work)
                item.reject(new Error("Sync stopped before dispatch started"))
        this.scheduledWork.clear()
        this.eventIndexUnsubscribe?.()
        this.guildCache.stop()
        if (this.flushTimer) {
            clearTimeout(this.flushTimer)
            this.flushTimer = undefined
            this.flushDueAt = undefined
        }
        return this.tasks.stop()
    }

    queueEventSync(eventId: string) {
        if (this.tasks.stopped) return
        this.queuedEventIds.add(eventId)
        logInfo("sync-service", "Queued event sync", {
            eventId,
            queuedEvents: this.queuedEventIds.size,
        })
    }

    queueGuildSync(guildId: string) {
        if (this.tasks.stopped) return
        this.queuedGuildIds.add(guildId)
        logInfo("sync-service", "Queued guild sync", {
            guildId,
            queuedGuilds: this.queuedGuildIds.size,
        })
    }

    queueAttendanceReminder(eventId: string) {
        this.queuedAttendanceReminderEventIds.add(eventId)
        this.queueEventSync(eventId)
    }

    queueSignupReminder(eventId: string) {
        this.queuedSignupReminderEventIds.add(eventId)
        this.queueEventSync(eventId)
    }

    /** Redraws one workspace's calendar panel now (a panel request). */
    async refreshCalendar(guildId: string) {
        if (!this.guildCache.get(guildId)?.config)
            throw new Error("Workspace configuration not loaded yet.")
        await this.syncGuildCalendar(guildId, true)
    }

    getGuildConfig(guildId: string) {
        return this.guildCache.get(guildId)?.config
    }

    /** The current payload of one event, for DMs sent outside the sync loop. */
    async loadEventPayload(eventId: string): Promise<SyncPayload | null> {
        const context = await this.loadEventSyncContext(eventId)
        if (!context) return null
        const runtime = this.guildCache.get(context.event.guildId)
        if (!runtime?.config) return null
        return buildGuildPayload(runtime, [context])
    }

    triggerSoon(delayMs = 2000) {
        logInfo("sync-service", "Triggering scheduled flush", {
            delayMs,
            queuedGuilds: this.queuedGuildIds.size,
            queuedEvents: this.queuedEventIds.size,
        })
        this.scheduleFlush(delayMs)
    }

    /**
     * Flush a player-driven event update immediately when idle. During an
     * existing sync, retain a small coalescing window for simultaneous clicks.
     */
    triggerInteractiveFlush() {
        const delayMs = interactiveFlushDelay({
            isFlushing: this.isFlushing,
            hasScheduledFlush: Boolean(this.flushTimer),
        })
        logInfo("sync-service", "Triggering interactive flush", {
            delayMs,
            queuedGuilds: this.queuedGuildIds.size,
            queuedEvents: this.queuedEventIds.size,
        })
        this.scheduleFlush(delayMs)
    }

    requestFullResync() {
        this.fullResyncRequested = true
        logInfo("sync-service", "Full resync requested")
        this.scheduleFlush(250)
    }

    private scheduleFlush(delayMs: number) {
        if (this.tasks.stopped) return
        if (this.flushTimer) {
            const nextDueAt = Date.now() + delayMs
            if (this.flushDueAt && this.flushDueAt <= nextDueAt) {
                logInfo("sync-service", "Flush already scheduled", { delayMs })
                return
            }

            clearTimeout(this.flushTimer)
            this.flushTimer = undefined
            this.flushDueAt = undefined
            logInfo("sync-service", "Flush already scheduled", { delayMs })
        }

        logInfo("sync-service", "Scheduling flush", {
            delayMs,
            queuedGuilds: this.queuedGuildIds.size,
            queuedEvents: this.queuedEventIds.size,
            fullResyncRequested: this.fullResyncRequested,
        })
        this.flushDueAt = Date.now() + delayMs
        this.flushTimer = setTimeout(() => {
            this.flushTimer = undefined
            this.flushDueAt = undefined
            void this.tasks
                .run(() => this.flush())
                .catch((error) => {
                    logError("sync-service", "Flush crashed unexpectedly", {
                        error,
                    })
                })
        }, delayMs)
    }

    private async flush() {
        if (this.isFlushing) {
            // The active flush drains the live queues in its loop. Scheduling another
            // timer here only creates an endless 500ms warning loop while a Discord
            // request is slow; it cannot make the queued work run sooner.
            logInfo("sync-service", "Flush request coalesced into active flush")
            return
        }

        this.isFlushing = true
        logInfo("sync-service", "Flush started", {
            queuedGuilds: this.queuedGuildIds.size,
            queuedEvents: this.queuedEventIds.size,
            fullResyncRequested: this.fullResyncRequested,
        })

        try {
            while (
                !this.tasks.stopped &&
                (this.fullResyncRequested ||
                    this.queuedGuildIds.size > 0 ||
                    this.queuedEventIds.size > 0)
            ) {
                if (this.fullResyncRequested) {
                    this.fullResyncRequested = false
                    for (const guildId of this.guildCache.getAllGuildIds()) {
                        const runtime = this.guildCache.get(guildId)
                        if (
                            runtime &&
                            hasConfiguredClanDiscordTarget(runtime)
                        ) {
                            this.queuedGuildIds.add(guildId)
                        }
                    }
                    logInfo(
                        "sync-service",
                        "Expanded full resync into guild queue",
                        {
                            queuedGuilds: this.queuedGuildIds.size,
                        }
                    )
                }

                // Take ownership of this cycle's work before awaiting any Discord calls.
                // Work enqueued while the cycle is running remains in the live set for the
                // next loop instead of being erased after the older snapshot completes.
                const scheduledForCycle = new Map(this.scheduledWork)
                this.scheduledWork.clear()
                const queuedEventIdsForCycle = new Set(this.queuedEventIds)
                this.queuedEventIds.clear()
                const queuedAttendanceReminderEventIdsForCycle = new Set(
                    this.queuedAttendanceReminderEventIds
                )
                this.queuedAttendanceReminderEventIds.clear()
                const queuedSignupReminderEventIdsForCycle = new Set(
                    this.queuedSignupReminderEventIds
                )
                this.queuedSignupReminderEventIds.clear()
                const guildIds = [...this.queuedGuildIds]
                this.queuedGuildIds.clear()
                if (guildIds.length > 0) {
                    logInfo("sync-service", "Processing queued guilds", {
                        guildIds,
                        count: guildIds.length,
                    })
                }
                for (const guildId of guildIds) {
                    try {
                        await this.syncGuild(guildId, queuedEventIdsForCycle)
                    } catch (error) {
                        logError(
                            "sync-service",
                            "Discord bot guild sync failed",
                            {
                                guildId,
                                error,
                            }
                        )
                    }
                }

                const eventIds = [...queuedEventIdsForCycle]
                if (eventIds.length > 0) {
                    logInfo("sync-service", "Processing queued events", {
                        eventIds,
                        count: eventIds.length,
                    })
                }
                const calendarGuildIds = new Set<string>()
                for (const eventId of eventIds) {
                    try {
                        const calendarGuildId = await this.syncEvent(
                            eventId,
                            queuedEventIdsForCycle,
                            queuedAttendanceReminderEventIdsForCycle.has(
                                eventId
                            ),
                            queuedSignupReminderEventIdsForCycle.has(eventId),
                            scheduledForCycle.has(eventId)
                        )
                        for (const work of scheduledForCycle.get(eventId) ??
                            []) {
                            await this.runScheduledReminders(eventId, work)
                            work.resolve()
                        }
                        if (calendarGuildId)
                            calendarGuildIds.add(calendarGuildId)
                    } catch (error) {
                        for (const work of scheduledForCycle.get(eventId) ?? [])
                            work.reject(error)
                        logError(
                            "sync-service",
                            "Discord bot queued event sync failed",
                            {
                                eventId,
                                error,
                            }
                        )
                    }
                }
                // One changed event used to reload the entire guild calendar. Batch
                // the request after event effects so its sync states remain fresh.
                for (const guildId of calendarGuildIds) {
                    try {
                        await this.syncGuildCalendar(guildId)
                    } catch (error) {
                        logError("sync-service", "Calendar sync failed", {
                            guildId,
                            error,
                        })
                    }
                }
            }
            logInfo("sync-service", "Flush finished with no remaining work")
        } finally {
            this.isFlushing = false
        }
    }

    private applyEventIndex(index: EventSyncIndex, initialLoad: boolean) {
        const nextEventIndexById = new Map(
            index.events.map((event) => [event.id, event])
        )
        const {
            rosterIndexByEventId: nextRosterIndexByEventId,
            signatures: nextEventSignatureById,
        } = buildEventSignatureMap(index)
        const queuedDueToIndexChanges = getChangedEventIds(
            nextEventSignatureById,
            this.eventSignatureById,
            initialLoad
        ).filter(
            (eventId) =>
                !isHistoricalConcludedEvent(nextEventIndexById.get(eventId)!)
        )
        for (const eventId of queuedDueToIndexChanges) {
            this.queuedEventIds.add(eventId)
        }

        for (const [id, event] of this.eventIndexById)
            if (!nextEventIndexById.has(id))
                this.queuedGuildIds.add(event.guildId)
        this.eventIdsByGuild.clear()
        this.eventIndexById.clear()
        this.rosterIndexByEventId.clear()
        this.eventSignatureById.clear()

        for (const [eventId, event] of nextEventIndexById) {
            this.eventIndexById.set(eventId, event)
            if (!isHistoricalConcludedEvent(event)) {
                const ids = this.eventIdsByGuild.get(event.guildId) ?? []
                ids.push(eventId)
                this.eventIdsByGuild.set(event.guildId, ids)
            }
        }
        for (const [eventId, roster] of nextRosterIndexByEventId) {
            this.rosterIndexByEventId.set(eventId, roster)
        }
        for (const [eventId, signature] of nextEventSignatureById) {
            this.eventSignatureById.set(eventId, signature)
        }

        if (queuedDueToIndexChanges.length > 0) {
            logInfo(
                "sync-service",
                initialLoad
                    ? "Queued events from initial index load"
                    : "Queued events from Convex index changes",
                {
                    eventIds: queuedDueToIndexChanges,
                    count: queuedDueToIndexChanges.length,
                }
            )
        }
    }

    private async syncGuild(guildId: string, queuedEventIds: Set<string>) {
        const runtime = this.guildCache.get(guildId)
        if (!runtime?.config) {
            logWarn(
                "sync-service",
                "Skipping guild sync because config is missing",
                { guildId }
            )
            return
        }
        if (!hasConfiguredClanDiscordTarget(runtime)) {
            logInfo(
                "sync-service",
                "Skipping guild sync because clan Discord settings are empty",
                { guildId }
            )
            return
        }

        const eventIds = this.eventIdsByGuild.get(guildId) ?? []
        const contexts = await mapConcurrent(eventIds, 4, (eventId) =>
            this.loadEventSyncContext(eventId)
        )
        const payload = buildGuildPayload(runtime, contexts)
        logInfo("sync-service", "Syncing guild payload", {
            guildId,
            eventCount: payload.events.length,
            rosterCount: payload.rosters.length,
            syncStateCount: payload.syncStates.length,
        })
        await syncGuildPayload(this.client, queuedEventIds, payload, "full")
    }

    private async syncEvent(
        eventId: string,
        queuedEventIds: Set<string>,
        attendanceReminderDue: boolean,
        signupReminderDue: boolean,
        strict = false
    ) {
        const context = await this.loadEventSyncContext(eventId)
        if (!context) {
            logWarn(
                "sync-service",
                "Skipping event sync because context was not found",
                { eventId }
            )
            return
        }

        const runtime = this.guildCache.get(context.event.guildId)
        if (!runtime?.config) {
            if (strict) throw new Error("Guild configuration is not loaded")
            logWarn(
                "sync-service",
                "Skipping event sync because guild config is missing",
                {
                    eventId,
                    guildId: context.event.guildId,
                }
            )
            return
        }
        if (!hasConfiguredClanDiscordTarget(runtime)) {
            logInfo(
                "sync-service",
                "Skipping event sync because clan Discord settings are empty",
                {
                    eventId,
                    guildId: context.event.guildId,
                }
            )
            return
        }

        const payload = buildGuildPayload(runtime, [context])
        logInfo("sync-service", "Syncing single event payload", {
            eventId,
            guildId: context.event.guildId,
            rosterCount: payload.rosters.length,
            hasSyncState: payload.syncStates.length > 0,
        })
        await syncGuildPayload(
            this.client,
            queuedEventIds,
            payload,
            "events_only",
            attendanceReminderDue ? new Set([eventId]) : new Set(),
            strict
        )
        if (signupReminderDue) {
            // The recipients come from the clan's assignments, read once per
            // due reminder rather than kept in the guild cache subscription.
            const assignments = await this.loadGuildAssignments(
                context.event.guildId
            )
            await processSignupReminders(
                this.client,
                { ...payload, assignments },
                new Set([eventId])
            )
        }
        await processMatchRecaps(this.client, eventId)
        if (
            context.syncState?.lastCalendarSyncVersion !==
            getCalendarSyncVersion(context.event)
        ) {
            return context.event.guildId
        }
    }

    private async runScheduledReminders(eventId: string, work: ScheduledWork) {
        const context = await this.loadEventSyncContext(eventId)
        if (!context) return
        const runtime = this.guildCache.get(context.event.guildId)
        if (!runtime?.config)
            throw new Error("Guild configuration is not loaded")
        if (!hasConfiguredClanDiscordTarget(runtime)) return
        const payload = buildGuildPayload(runtime, [context])
        if (work.kind === "signup-reminder") {
            const assignments = await this.loadGuildAssignments(
                context.event.guildId
            )
            await processSignupReminders(
                this.client,
                { ...payload, assignments },
                new Set([eventId]),
                { delivery: work.delivery, dueAt: work.dueAt }
            )
        }
        if (work.kind === "attendance-reminder") {
            await processAttendanceReminders(
                this.client,
                this.queuedEventIds,
                payload,
                new Set([eventId]),
                undefined,
                work.delivery
            )
        }
    }

    private async loadEventSyncContext(eventId: string) {
        return (await convex.query(references.getEventSyncContext, {
            secret: env.internalSecret,
            eventId: eventId as never,
        })) as EventSyncContext | null
    }

    private async loadGuildAssignments(guildId: string) {
        return (await convex.query(references.listGuildAssignments, {
            secret: env.internalSecret,
            guildId,
        })) as SyncPayload["assignments"]
    }

    private async syncGuildCalendar(guildId: string, requested = false) {
        const runtime = this.guildCache.get(guildId)
        if (
            !runtime?.config ||
            (!requested && !hasConfiguredClanDiscordTarget(runtime))
        ) {
            return
        }

        const eventIds = this.eventIdsByGuild.get(guildId) ?? []
        const contexts = await mapConcurrent(eventIds, 4, (eventId) =>
            this.loadCalendarEventContext(guildId, eventId)
        )
        const payload: CalendarSyncPayload = {
            guild: runtime.guild,
            config: runtime.config,
            calendarItems: runtime.calendarItems,
            events: contexts.flatMap((context) =>
                context ? [context.event] : []
            ),
            syncStates: contexts.flatMap((context) =>
                context?.syncState ? [context.syncState] : []
            ),
        }
        await syncCalendarPanel(this.client, payload)
    }

    private async loadCalendarEventContext(
        guildId: string,
        eventId: string
    ): Promise<{
        event: CalendarSyncPayload["events"][number]
        syncState: CalendarSyncPayload["syncStates"][number] | null
    } | null> {
        return convex.query(
            makeFunctionReference<"query">(
                "discordSync:getCalendarEventContext"
            ),
            {
                secret: env.internalSecret,
                guildId,
                eventId,
            }
        )
    }
}

function buildGuildPayload(
    runtime: GuildRuntimeData,
    contexts: Array<EventSyncContext | null>
): SyncPayload {
    return buildGuildPayloadShared(
        runtime as GuildRuntimeData & {
            config: NonNullable<GuildRuntimeData["config"]>
        },
        contexts
    ) as SyncPayload
}
