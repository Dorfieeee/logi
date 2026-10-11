import { DEFAULT_GAME_ID, isGameId, type GameId } from "@/domain/games/game"
import { NextResponse } from "next/server"
import type { ZodType } from "zod"
import { z } from "zod"

type JsonRequest = Pick<Request, "json" | "headers" | "url">

/** The validated body fields the create and update handlers read themselves. */
type EventBody = { topicPresetId?: string }
/** The validated body plus the route's server scope and, for updates, the event ID. */
type EventSaveInput<TEventInput extends EventBody> = TEventInput & {
    serverId: string
    eventId?: string
}

type EventRouteDeps<TEventInput extends EventBody> = {
    /** Public origin from trusted server configuration, never request/proxy headers. */
    origin: string
    eventSchema: ZodType<TEventInput>
    /** Whether the current dashboard user administers this server; never derived from the request body. */
    canAdminServer: (serverId: string) => Promise<boolean>
    saveServerEvent: (input: EventSaveInput<TEventInput>) => Promise<string>
    concludeServerEvent: (input: { eventId: string }) => Promise<void>
    completeServerTraining: (input: {
        eventId: string
        participants: Array<{
            userId: string
            completed: "passed" | "failed"
        }>
    }) => Promise<void>
    importServerEventsFromLinks: (input: {
        serverId: string
        gameId: GameId
        linksInput: string
        importPlayers?: boolean
        clanTag?: string
        onProgress?: (progress: Record<string, unknown>) => void
    }) => Promise<{
        importedUserIds: string[]
        linkReports: Array<{ eventId?: string }>
        [key: string]: unknown
    }>
    importEventMatchResults: (input: {
        serverId: string
        eventId: string
        eventSide?: string
        matchLink: string
    }) => Promise<{
        importedUserIds: string[]
        [key: string]: unknown
    }>
    getEventMetadata: (eventId: string) => Promise<{
        side?: string
        rewardRoleIds?: string[]
        name?: string
    } | null>
    finalizeTrainingCompletion?: (input: {
        serverId: string
        eventId: string
        participants: Array<{
            userId: string
            completed: "passed" | "failed"
        }>
    }) => Promise<{
        rewardedUserIds?: string[]
        dmSentUserIds?: string[]
    } | void>
    revalidateCacheEntries: (
        tags: Array<string | null | undefined | false>
    ) => void
    appCacheTags: {
        serverContext(serverId: string): string
        events(serverId: string): string
        event(eventId: string): string
        rosterImageEvent(eventId: string): string
        roster?(rosterId: string): string
        stratmap?(stratmapId: string): string
        stratmaps?(serverId: string): string
        competition?(slug: string): string
        matches(serverId: string): string
        match(eventId: string): string
        rosters(serverId: string): string
        assignments(serverId: string): string
        player(userId: string): string
        playerStats(userId: string): string
        publicProfile(userId: string): string
        publicMatch(eventId: string): string
        publicDiscovery(): string
        users(): string
    }
    logRouteError: (scope: string, error: unknown) => void
    getUserSafeErrorMessage: (error: unknown, fallback: string) => string
}

type EventCreateParams = { serverId: string }
type EventActionParams = { serverId: string; eventId: string }

/**
 * Convex rejects an invalid team selection with `match_teams:<code>`. The
 * dashboard receives that bare code so it can localize it, instead of the
 * generic fallback message. The wrapped Convex error text is searched, not
 * matched exactly.
 */
const MATCH_TEAM_ERROR = new RegExp(
    `match_teams:(${[
        "invalid_match_teams",
        "team_not_found",
        "team_archived",
        "team_game_mismatch",
        "match_concluded",
        "training_event",
    ].join("|")})`
)
export function matchTeamErrorCode(error: unknown): string | null {
    // A malformed selection (unknown slot, too many entries, an overlong side
    // or a client snapshot) fails the request schema before Convex sees it;
    // it is the same team-selection rule violation.
    if (error instanceof z.ZodError)
        return error.issues.length > 0 &&
            error.issues.every((issue) => issue.path[0] === "matchTeams")
            ? "invalid_match_teams"
            : null
    return error instanceof Error
        ? (MATCH_TEAM_ERROR.exec(error.message)?.[1] ?? null)
        : null
}

/**
 * Every dashboard event write (save, import, conclude, training completion,
 * result import) needs a same-origin request from a current server admin,
 * the boundary the match-team refresh route also uses. Denial happens before
 * the body is read.
 */
async function eventWriteDenied(
    deps: Pick<EventRouteDeps<EventBody>, "canAdminServer" | "origin">,
    request: JsonRequest,
    serverId: string
) {
    const allowed =
        request.headers.get("origin") === deps.origin &&
        (await deps.canAdminServer(serverId).catch(() => false))
    return allowed
        ? null
        : NextResponse.json({ error: "forbidden" }, { status: 403 })
}

export function createServerEventDeleteHandler(
    deps: Pick<
        EventRouteDeps<EventBody>,
        | "origin"
        | "canAdminServer"
        | "revalidateCacheEntries"
        | "appCacheTags"
        | "logRouteError"
        | "getUserSafeErrorMessage"
    > & {
        deleteServerEvent: (input: EventActionParams) => Promise<{
            eventId: string
            discordCleanupQueued: boolean
            rosterIds?: string[]
            stratmapIds?: string[]
            competitionSlugs?: string[]
        }>
    }
) {
    return async (
        request: Request,
        context: { params: Promise<EventActionParams> }
    ) => {
        const { serverId, eventId } = await context.params
        const denied = await eventWriteDenied(deps, request, serverId)
        if (denied) return denied
        try {
            const result = await deps.deleteServerEvent({ serverId, eventId })
            const tags = deps.appCacheTags
            deps.revalidateCacheEntries([
                tags.serverContext(serverId),
                tags.events(serverId),
                tags.event(eventId),
                tags.matches(serverId),
                tags.match(eventId),
                tags.rosters(serverId),
                tags.rosterImageEvent(eventId),
                tags.publicMatch(eventId),
                tags.publicDiscovery(),
                tags.stratmaps?.(serverId),
                ...(result.rosterIds ?? []).map((id) => tags.roster?.(id)),
                ...(result.stratmapIds ?? []).map((id) => tags.stratmap?.(id)),
                ...(result.competitionSlugs ?? []).map((slug) =>
                    tags.competition?.(slug)
                ),
            ])
            return NextResponse.json({ success: true, ...result })
        } catch (error) {
            deps.logRouteError("events.delete", error)
            return NextResponse.json(
                {
                    error: deps.getUserSafeErrorMessage(
                        error,
                        "Unable to delete the event."
                    ),
                },
                { status: 400 }
            )
        }
    }
}
function saveErrorResponse(
    deps: Pick<EventRouteDeps<EventBody>, "getUserSafeErrorMessage">,
    error: unknown
) {
    return NextResponse.json(
        {
            error:
                matchTeamErrorCode(error) ??
                deps.getUserSafeErrorMessage(
                    error,
                    "Unable to save the event."
                ),
        },
        { status: 400 }
    )
}

const trainingCompletionSchema = z.object({
    action: z.literal("completeTraining"),
    participants: z
        .array(
            z.object({
                userId: z.string().trim().min(1),
                completed: z.union([z.literal("passed"), z.literal("failed")]),
            })
        )
        .min(1),
})

function buildImportedUserTags(
    importedUserIds: string[],
    appCacheTags: EventRouteDeps<EventBody>["appCacheTags"]
) {
    return importedUserIds.flatMap((userId) => [
        appCacheTags.player(userId),
        appCacheTags.playerStats(userId),
        appCacheTags.publicProfile(userId),
        appCacheTags.users(),
    ])
}

function createImportEventsStream(
    deps: Pick<
        EventRouteDeps<EventBody>,
        | "appCacheTags"
        | "getUserSafeErrorMessage"
        | "importServerEventsFromLinks"
        | "logRouteError"
        | "revalidateCacheEntries"
    >,
    input: {
        serverId: string
        gameId: GameId
        linksInput: string
        importPlayers?: boolean
        clanTag?: string
    }
) {
    const encoder = new TextEncoder()

    return new Response(
        new ReadableStream({
            async start(controller) {
                const emit = (payload: Record<string, unknown>) => {
                    controller.enqueue(
                        encoder.encode(`${JSON.stringify(payload)}\n`)
                    )
                }

                try {
                    const result = await deps.importServerEventsFromLinks({
                        ...input,
                        onProgress: (progress) =>
                            emit({ type: "progress", progress }),
                    })

                    const importedEventIds = result.linkReports
                        .map((report) => report.eventId)
                        .filter((eventId): eventId is string =>
                            Boolean(eventId)
                        )

                    deps.revalidateCacheEntries([
                        deps.appCacheTags.serverContext(input.serverId),
                        deps.appCacheTags.events(input.serverId),
                        deps.appCacheTags.matches(input.serverId),
                        deps.appCacheTags.publicDiscovery(),
                        deps.appCacheTags.rosters(input.serverId),
                        deps.appCacheTags.assignments(input.serverId),
                        ...importedEventIds.flatMap((eventId) => [
                            deps.appCacheTags.event(eventId),
                            deps.appCacheTags.match(eventId),
                            deps.appCacheTags.publicMatch(eventId),
                            deps.appCacheTags.rosterImageEvent(eventId),
                        ]),
                        ...buildImportedUserTags(
                            result.importedUserIds,
                            deps.appCacheTags
                        ),
                    ])

                    emit({ type: "result", result })
                } catch (error) {
                    deps.logRouteError("events.create", error)
                    emit({
                        type: "error",
                        error: deps.getUserSafeErrorMessage(
                            error,
                            "Unable to save the event."
                        ),
                    })
                } finally {
                    controller.close()
                }
            },
        }),
        {
            headers: {
                "content-type": "application/x-ndjson; charset=utf-8",
                "cache-control": "no-store",
            },
        }
    )
}

export function createServerEventsPostHandler<TEventInput extends EventBody>(
    deps: EventRouteDeps<TEventInput>
) {
    return async function POST(
        request: JsonRequest,
        { params }: { params: Promise<EventCreateParams> }
    ) {
        const { serverId } = await params
        const denied = await eventWriteDenied(deps, request, serverId)
        if (denied) return denied
        try {
            const rawBody = await request.json()

            if (
                (rawBody as { action?: string } | null | undefined)?.action ===
                "importEvents"
            ) {
                const streamProgress = Boolean(
                    (rawBody as { streamProgress?: unknown } | null | undefined)
                        ?.streamProgress
                )
                const importInput = {
                    serverId,
                    gameId: isGameId(
                        (rawBody as { gameId?: string } | null | undefined)
                            ?.gameId
                    )
                        ? (rawBody as { gameId: GameId }).gameId
                        : DEFAULT_GAME_ID,
                    linksInput: String(
                        (rawBody as { links?: unknown } | null | undefined)
                            ?.links ?? ""
                    ),
                    importPlayers: Boolean(
                        (
                            rawBody as
                                { importPlayers?: unknown } | null | undefined
                        )?.importPlayers
                    ),
                    clanTag:
                        String(
                            (
                                rawBody as
                                    { clanTag?: unknown } | null | undefined
                            )?.clanTag ?? ""
                        ).trim() || undefined,
                }

                if (importInput.gameId !== DEFAULT_GAME_ID) {
                    return NextResponse.json(
                        {
                            error: "Event import is only available for Hell Let Loose.",
                        },
                        { status: 400 }
                    )
                }

                if (streamProgress) {
                    return createImportEventsStream(deps, importInput)
                }

                const result = await deps.importServerEventsFromLinks({
                    ...importInput,
                })

                const importedEventIds = result.linkReports
                    .map((report) => report.eventId)
                    .filter((eventId): eventId is string => Boolean(eventId))

                deps.revalidateCacheEntries([
                    deps.appCacheTags.serverContext(serverId),
                    deps.appCacheTags.events(serverId),
                    deps.appCacheTags.matches(serverId),
                    deps.appCacheTags.publicDiscovery(),
                    deps.appCacheTags.rosters(serverId),
                    deps.appCacheTags.assignments(serverId),
                    ...importedEventIds.flatMap((eventId) => [
                        deps.appCacheTags.event(eventId),
                        deps.appCacheTags.match(eventId),
                        deps.appCacheTags.publicMatch(eventId),
                        deps.appCacheTags.rosterImageEvent(eventId),
                    ]),
                    ...buildImportedUserTags(
                        result.importedUserIds,
                        deps.appCacheTags
                    ),
                ])

                return NextResponse.json(result)
            }

            const body = deps.eventSchema.parse(rawBody)
            // The route's scope is applied last so a body field can never redirect the save.
            const eventId = await deps.saveServerEvent({
                ...body,
                serverId,
                topicPresetId: body.topicPresetId || undefined,
            })

            deps.revalidateCacheEntries([
                deps.appCacheTags.serverContext(serverId),
                deps.appCacheTags.events(serverId),
                deps.appCacheTags.event(eventId),
                deps.appCacheTags.rosterImageEvent(eventId),
            ])

            return NextResponse.json({ eventId })
        } catch (error) {
            deps.logRouteError("events.create", error)
            return saveErrorResponse(deps, error)
        }
    }
}

export function createServerEventPatchHandler<TEventInput extends EventBody>(
    deps: EventRouteDeps<TEventInput>
) {
    return async function PATCH(
        request: JsonRequest,
        { params }: { params: Promise<EventActionParams> }
    ) {
        const { serverId, eventId } = await params
        const denied = await eventWriteDenied(deps, request, serverId)
        if (denied) return denied
        try {
            const body = deps.eventSchema.parse(await request.json())
            const updatedEventId = await deps.saveServerEvent({
                ...body,
                eventId,
                serverId,
                topicPresetId: body.topicPresetId || undefined,
            })

            deps.revalidateCacheEntries([
                deps.appCacheTags.serverContext(serverId),
                deps.appCacheTags.events(serverId),
                deps.appCacheTags.event(updatedEventId),
                deps.appCacheTags.rosterImageEvent(updatedEventId),
            ])

            return NextResponse.json({ eventId: updatedEventId })
        } catch (error) {
            deps.logRouteError("events.update", error)
            return saveErrorResponse(deps, error)
        }
    }
}

export function createServerEventPostHandler<TEventInput extends EventBody>(
    deps: EventRouteDeps<TEventInput>
) {
    return async function POST(
        request: JsonRequest,
        { params }: { params: Promise<EventActionParams> }
    ) {
        const { serverId, eventId } = await params
        const denied = await eventWriteDenied(deps, request, serverId)
        if (denied) return denied
        try {
            const body = (await request.json()) as {
                action?: string
                matchLink?: unknown
            }

            if (body?.action === "conclude") {
                await deps.concludeServerEvent({ eventId })
                deps.revalidateCacheEntries([
                    deps.appCacheTags.serverContext(serverId),
                    deps.appCacheTags.events(serverId),
                    deps.appCacheTags.event(eventId),
                    deps.appCacheTags.rosterImageEvent(eventId),
                ])
                return NextResponse.json({ ok: true })
            }

            if (body?.action === "completeTraining") {
                const parsed = trainingCompletionSchema.parse(body)
                await deps.completeServerTraining({
                    eventId,
                    participants: parsed.participants,
                })

                const sideEffects = await deps.finalizeTrainingCompletion?.({
                    serverId,
                    eventId,
                    participants: parsed.participants,
                })

                deps.revalidateCacheEntries([
                    deps.appCacheTags.serverContext(serverId),
                    deps.appCacheTags.events(serverId),
                    deps.appCacheTags.event(eventId),
                    deps.appCacheTags.rosterImageEvent(eventId),
                    ...buildImportedUserTags(
                        parsed.participants.map(
                            (participant) => participant.userId
                        ),
                        deps.appCacheTags
                    ),
                ])

                return NextResponse.json({
                    ok: true,
                    rewardedUsers: sideEffects?.rewardedUserIds?.length ?? 0,
                    dmSentUsers: sideEffects?.dmSentUserIds?.length ?? 0,
                })
            }

            if (body?.action === "submitMatchResults") {
                const event = await deps.getEventMetadata(eventId)
                if (!event) {
                    return NextResponse.json(
                        { error: "Event not found." },
                        { status: 404 }
                    )
                }

                const result = await deps.importEventMatchResults({
                    serverId,
                    eventId,
                    eventSide: event.side,
                    matchLink: String(body.matchLink ?? ""),
                })

                deps.revalidateCacheEntries([
                    deps.appCacheTags.serverContext(serverId),
                    deps.appCacheTags.events(serverId),
                    deps.appCacheTags.event(eventId),
                    deps.appCacheTags.matches(serverId),
                    deps.appCacheTags.match(eventId),
                    deps.appCacheTags.publicMatch(eventId),
                    deps.appCacheTags.publicDiscovery(),
                    deps.appCacheTags.rosters(serverId),
                    deps.appCacheTags.assignments(serverId),
                    deps.appCacheTags.rosterImageEvent(eventId),
                    ...buildImportedUserTags(
                        result.importedUserIds,
                        deps.appCacheTags
                    ),
                ])
                return NextResponse.json(result)
            }

            return NextResponse.json(
                { error: "Unsupported action." },
                { status: 400 }
            )
        } catch (error) {
            deps.logRouteError("events.conclude", error)
            return NextResponse.json(
                {
                    error: deps.getUserSafeErrorMessage(
                        error,
                        "Unable to process the event action."
                    ),
                },
                { status: 400 }
            )
        }
    }
}
