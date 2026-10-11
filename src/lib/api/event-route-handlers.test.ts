import assert from "node:assert/strict"
import test from "node:test"

import {
    eventSchema,
    eventUpdateSchema,
    type EventParsedInput,
} from "@/lib/validation/event"

import {
    createServerEventDeleteHandler,
    createServerEventPatchHandler,
    createServerEventPostHandler,
    createServerEventsPostHandler,
} from "./event-route-handlers"

test("match deletion enforces origin and admin access before mutation and invalidates list/detail caches", async () => {
    const { deps, calls } = createDeps()
    const deleted: unknown[] = []
    const handler = createServerEventDeleteHandler({
        ...deps,
        appCacheTags: {
            ...deps.appCacheTags,
            roster: (id: string) => `roster:${id}`,
            stratmap: (id: string) => `stratmap:${id}`,
            competition: (slug: string) => `competition:${slug}`,
        },
        deleteServerEvent: async (input) => {
            deleted.push(input)
            return {
                eventId: input.eventId,
                discordCleanupQueued: true,
                rosterIds: ["roster-1"],
                stratmapIds: ["map-1"],
                competitionSlugs: ["league"],
            }
        },
    })
    const context = {
        params: Promise.resolve({ serverId: "server-1", eventId: "event-1" }),
    }
    const request = (origin = "https://logi.test") =>
        new Request("https://logi.test/api/servers/server-1/events/event-1", {
            method: "DELETE",
            headers: { origin },
        })
    assert.equal(
        (await handler(request("https://attacker.test"), context)).status,
        403
    )
    calls.admin = false
    assert.equal((await handler(request(), context)).status, 403)
    assert.equal(deleted.length, 0)
    calls.admin = true
    const response = await handler(request(), context)
    assert.equal(response.status, 200)
    assert.deepEqual(deleted, [{ serverId: "server-1", eventId: "event-1" }])
    assert.ok(
        calls.revalidated[0].includes(deps.appCacheTags.events("server-1"))
    )
    assert.ok(
        calls.revalidated[0].includes(deps.appCacheTags.publicMatch("event-1"))
    )
    for (const tag of [
        "roster:roster-1",
        "stratmap:map-1",
        "competition:league",
    ])
        assert.ok(calls.revalidated[0].includes(tag), tag)
})

/** What the handlers save: the validated body plus the route's scope. */
type SavedEvent = EventParsedInput & { serverId: string; eventId?: string }

function createDeps() {
    const calls = {
        revalidated: [] as string[][],
        savedEvents: [] as SavedEvent[],
        concluded: [] as Array<{ eventId: string }>,
        completedTrainings: [] as Array<{
            eventId: string
            participants: Array<{
                userId: string
                completed: "passed" | "failed"
            }>
        }>,
        importedEventLinks: [] as Array<{
            serverId: string
            linksInput: string
            importPlayers?: boolean
            clanTag?: string
        }>,
        importedMatchResults: [] as Array<{
            serverId: string
            eventId: string
            eventSide?: string
            matchLink: string
        }>,
        requestedMetadata: [] as string[],
        logged: [] as Array<{ scope: string; error: unknown }>,
        accessChecks: [] as string[],
        admin: true,
    }

    return {
        calls,
        deps: {
            origin: "https://logi.test",
            eventSchema,
            canAdminServer: async (serverId: string) => {
                calls.accessChecks.push(serverId)
                return calls.admin
            },
            saveServerEvent: async (input: SavedEvent) => {
                calls.savedEvents.push(input)
                return input.eventId ?? "event-1"
            },
            concludeServerEvent: async (input: { eventId: string }) => {
                calls.concluded.push(input)
            },
            completeServerTraining: async (input: {
                eventId: string
                participants: Array<{
                    userId: string
                    completed: "passed" | "failed"
                }>
            }) => {
                calls.completedTrainings.push(input)
            },
            importServerEventsFromLinks: async (input: {
                serverId: string
                linksInput: string
                importPlayers?: boolean
                clanTag?: string
            }) => {
                calls.importedEventLinks.push(input)
                return {
                    importedUserIds: ["user-1"],
                    linkReports: [
                        { eventId: "event-1" },
                        { eventId: undefined },
                    ],
                    importedEvents: 1,
                }
            },
            importEventMatchResults: async (input: {
                serverId: string
                eventId: string
                eventSide?: string
                matchLink: string
            }) => {
                calls.importedMatchResults.push(input)
                return {
                    importedUserIds: ["user-1", "user-2"],
                    importedPlayers: 2,
                }
            },
            getEventMetadata: async (
                eventId: string
            ): Promise<{ side?: string } | null> => {
                calls.requestedMetadata.push(eventId)
                return { side: "allies" }
            },
            finalizeTrainingCompletion: async ({
                participants,
            }: {
                participants: Array<{
                    userId: string
                    completed: "passed" | "failed"
                }>
            }) => ({
                rewardedUserIds: participants
                    .filter((participant) => participant.completed === "passed")
                    .map((participant) => participant.userId),
                dmSentUserIds: participants.map(
                    (participant) => participant.userId
                ),
            }),
            revalidateCacheEntries: (
                tags: Array<string | null | undefined | false>
            ) => {
                calls.revalidated.push(
                    tags.filter((tag): tag is string => Boolean(tag))
                )
            },
            appCacheTags: {
                serverContext: (serverId: string) =>
                    `server-context:${serverId}`,
                events: (serverId: string) => `events:${serverId}`,
                event: (eventId: string) => `event:${eventId}`,
                rosterImageEvent: (eventId: string) =>
                    `roster-image:${eventId}`,
                matches: (serverId: string) => `matches:${serverId}`,
                match: (eventId: string) => `match:${eventId}`,
                rosters: (serverId: string) => `rosters:${serverId}`,
                assignments: (serverId: string) => `assignments:${serverId}`,
                player: (userId: string) => `player:${userId}`,
                playerStats: (userId: string) => `player-stats:${userId}`,
                publicProfile: (userId: string) => `public-profile:${userId}`,
                publicMatch: (eventId: string) => `public-match:${eventId}`,
                publicDiscovery: () => "public-discovery",
                users: () => "users",
            },
            logRouteError: (scope: string, error: unknown) => {
                calls.logged.push({ scope, error })
            },
            getUserSafeErrorMessage: (error: unknown, fallback: string) =>
                error instanceof Error ? error.message : fallback,
        },
    }
}

const origin = "https://logi.test"
/** A same-origin dashboard request; other origins are denied before parsing. */
function jsonRequest(
    body: unknown,
    headers: Record<string, string> = { origin },
    requestOrigin = origin
) {
    return new Request(`${requestOrigin}/api/servers/guild-1/events`, {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify(body),
    })
}

function createEventBody(overrides: Record<string, unknown> = {}) {
    return {
        kind: "match",
        name: "Test Event",
        registrationEnd: "2026-07-23T10:00:00.000Z",
        meetingStart: "2026-07-23T11:00:00.000Z",
        gameStart: "2026-07-23T12:00:00.000Z",
        gameEnd: "2026-07-23T14:00:00.000Z",
        pingClan: false,
        ...overrides,
    }
}

test("server events POST saves validated events and revalidates cache tags", async () => {
    const { deps, calls } = createDeps()
    const handler = createServerEventsPostHandler(deps)

    const response = await handler(
        jsonRequest(
            createEventBody({
                topicPresetId: "",
                serverId: "guild-2",
                eventId: "event-from-body",
            })
        ),
        { params: Promise.resolve({ serverId: "guild-1" }) }
    )

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { eventId: "event-1" })
    assert.equal(calls.savedEvents.length, 1)
    assert.deepEqual(calls.savedEvents[0]?.topicPresetId, undefined)
    // The save is scoped by the route; body scope fields are never forwarded.
    assert.equal(calls.savedEvents[0]?.serverId, "guild-1")
    assert.equal(calls.savedEvents[0]?.eventId, undefined)
    assert.deepEqual(calls.revalidated[0], [
        "server-context:guild-1",
        "events:guild-1",
        "event:event-1",
        "roster-image:event-1",
    ])
})

test("server events POST preserves an optional registration announcement start", async () => {
    const { deps, calls } = createDeps()
    const handler = createServerEventsPostHandler(deps)

    const response = await handler(
        jsonRequest(
            createEventBody({
                registrationStart: "2026-07-22T10:00:00.000Z",
            })
        ),
        { params: Promise.resolve({ serverId: "guild-1" }) }
    )

    assert.equal(response.status, 200)
    assert.equal(
        calls.savedEvents[0]?.registrationStart,
        "2026-07-22T10:00:00.000Z"
    )
})

test("server events POST rejects a registration announcement start after registration end", async () => {
    const { deps } = createDeps()
    const handler = createServerEventsPostHandler(deps)

    const response = await handler(
        jsonRequest(
            createEventBody({
                registrationStart: "2026-07-24T10:00:00.000Z",
            })
        ),
        { params: Promise.resolve({ serverId: "guild-1" }) }
    )

    assert.equal(response.status, 400)
})

test("server events POST imports events and revalidates imported entity tags", async () => {
    const { deps, calls } = createDeps()
    const handler = createServerEventsPostHandler(deps)

    const response = await handler(
        jsonRequest({
            action: "importEvents",
            links: "https://example.com/games/123",
        }),
        { params: Promise.resolve({ serverId: "guild-1" }) }
    )

    assert.equal(response.status, 200)
    assert.equal(calls.importedEventLinks.length, 1)
    assert.deepEqual(calls.importedEventLinks[0], {
        serverId: "guild-1",
        gameId: "hell_let_loose",
        linksInput: "https://example.com/games/123",
        importPlayers: false,
        clanTag: undefined,
    })
    assert.deepEqual(calls.revalidated[0], [
        "server-context:guild-1",
        "events:guild-1",
        "matches:guild-1",
        "public-discovery",
        "rosters:guild-1",
        "assignments:guild-1",
        "event:event-1",
        "match:event-1",
        "public-match:event-1",
        "roster-image:event-1",
        "player:user-1",
        "player-stats:user-1",
        "public-profile:user-1",
        "users",
    ])
})

test("server events POST rejects imports for games other than Hell Let Loose", async () => {
    const { deps, calls } = createDeps()
    const handler = createServerEventsPostHandler(deps)

    const response = await handler(
        jsonRequest({
            action: "importEvents",
            gameId: "wardogs",
            links: "https://example.com/games/123",
        }),
        { params: Promise.resolve({ serverId: "guild-1" }) }
    )

    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), {
        error: "Event import is only available for Hell Let Loose.",
    })
    assert.equal(calls.importedEventLinks.length, 0)
})

test("server events POST returns a safe validation error response", async () => {
    const { deps, calls } = createDeps()
    const handler = createServerEventsPostHandler(deps)

    const response = await handler(
        jsonRequest(createEventBody({ meetingStart: "bad-date" })),
        { params: Promise.resolve({ serverId: "guild-1" }) }
    )

    assert.equal(response.status, 400)
    assert.equal(calls.logged[0]?.scope, "events.create")
    assert.match(
        String((await response.json()).error),
        /Unable to save the event|Meeting start/
    )
})

test("server event PATCH updates an event and revalidates the updated tags", async () => {
    const { deps, calls } = createDeps()
    const handler = createServerEventPatchHandler(deps)

    const response = await handler(
        jsonRequest(
            createEventBody({
                name: "Updated Event",
                serverId: "guild-2",
                eventId: "event-from-body",
            })
        ),
        { params: Promise.resolve({ serverId: "guild-1", eventId: "event-9" }) }
    )

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { eventId: "event-9" })
    assert.equal(calls.savedEvents[0]?.eventId, "event-9")
    assert.equal(calls.savedEvents[0]?.serverId, "guild-1")
    assert.equal(calls.savedEvents[0]?.name, "Updated Event")
    assert.deepEqual(calls.revalidated[0], [
        "server-context:guild-1",
        "events:guild-1",
        "event:event-9",
        "roster-image:event-9",
    ])
})

test("the strict PATCH schema forwards template settings and refuses unknown keys", async () => {
    const { deps, calls } = createDeps()
    const handler = createServerEventPatchHandler({
        ...deps,
        eventSchema: eventUpdateSchema,
    })
    const params = {
        params: Promise.resolve({ serverId: "guild-1", eventId: "event-9" }),
    }

    const saved = await handler(
        jsonRequest(
            createEventBody({
                signupGroupIds: ["g1"],
                signupGroupLimits: [{ groupId: "g1", max: 4 }],
                attendanceReminderHours: [24, 6],
                createParticipantRoles: false,
                squadPresetId: "",
            })
        ),
        params
    )
    assert.equal(saved.status, 200)
    assert.deepEqual(calls.savedEvents[0]?.signupGroupLimits, [
        { groupId: "g1", max: 4 },
    ])
    assert.deepEqual(calls.savedEvents[0]?.attendanceReminderHours, [24, 6])
    assert.equal(calls.savedEvents[0]?.createParticipantRoles, false)
    assert.equal(calls.savedEvents[0]?.squadPresetId, "")

    for (const body of [
        createEventBody({ serverId: "guild-2" }),
        createEventBody({ attendanceReminderHours: [5] }),
        createEventBody({ signupGroupLimits: [{ groupId: "g1", max: 0 }] }),
        createEventBody({
            registrationEnd: "2026-07-23T11:30:00.000Z",
        }),
    ]) {
        const refused = await handler(jsonRequest(body), params)
        assert.equal(refused.status, 400)
    }
    assert.equal(calls.savedEvents.length, 1)
})

test("server event POST concludes an event", async () => {
    const { deps, calls } = createDeps()
    const handler = createServerEventPostHandler(deps)

    const response = await handler(jsonRequest({ action: "conclude" }), {
        params: Promise.resolve({ serverId: "guild-1", eventId: "event-1" }),
    })

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { ok: true })
    assert.deepEqual(calls.concluded, [{ eventId: "event-1" }])
})

test("server event POST completes a training and revalidates related caches", async () => {
    const { deps, calls } = createDeps()
    const handler = createServerEventPostHandler(deps)

    const response = await handler(
        jsonRequest({
            action: "completeTraining",
            participants: [
                { userId: "user-1", completed: "passed" },
                { userId: "user-2", completed: "failed" },
            ],
        }),
        { params: Promise.resolve({ serverId: "guild-1", eventId: "event-1" }) }
    )

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
        ok: true,
        rewardedUsers: 1,
        dmSentUsers: 2,
    })
    assert.deepEqual(calls.completedTrainings, [
        {
            eventId: "event-1",
            participants: [
                { userId: "user-1", completed: "passed" },
                { userId: "user-2", completed: "failed" },
            ],
        },
    ])
    assert.deepEqual(calls.revalidated[0], [
        "server-context:guild-1",
        "events:guild-1",
        "event:event-1",
        "roster-image:event-1",
        "player:user-1",
        "player-stats:user-1",
        "public-profile:user-1",
        "users",
        "player:user-2",
        "player-stats:user-2",
        "public-profile:user-2",
        "users",
    ])
})

test("server event POST submits match results and revalidates related caches", async () => {
    const { deps, calls } = createDeps()
    const handler = createServerEventPostHandler(deps)

    const response = await handler(
        jsonRequest({
            action: "submitMatchResults",
            matchLink: "https://example.com/games/123",
        }),
        { params: Promise.resolve({ serverId: "guild-1", eventId: "event-1" }) }
    )

    assert.equal(response.status, 200)
    assert.equal(calls.requestedMetadata[0], "event-1")
    assert.deepEqual(calls.importedMatchResults[0], {
        serverId: "guild-1",
        eventId: "event-1",
        eventSide: "allies",
        matchLink: "https://example.com/games/123",
    })
    assert.deepEqual(calls.revalidated[0], [
        "server-context:guild-1",
        "events:guild-1",
        "event:event-1",
        "matches:guild-1",
        "match:event-1",
        "public-match:event-1",
        "public-discovery",
        "rosters:guild-1",
        "assignments:guild-1",
        "roster-image:event-1",
        "player:user-1",
        "player-stats:user-1",
        "public-profile:user-1",
        "users",
        "player:user-2",
        "player-stats:user-2",
        "public-profile:user-2",
        "users",
    ])
})

test("server event POST returns 404 for missing metadata and 400 for unsupported actions", async () => {
    const { deps } = createDeps()
    deps.getEventMetadata = async () => null
    const handler = createServerEventPostHandler(deps)

    const notFound = await handler(
        jsonRequest({
            action: "submitMatchResults",
            matchLink: "https://example.com/games/123",
        }),
        { params: Promise.resolve({ serverId: "guild-1", eventId: "event-1" }) }
    )
    assert.equal(notFound.status, 404)
    assert.deepEqual(await notFound.json(), { error: "Event not found." })

    const unsupported = await handler(
        jsonRequest({ action: "somethingElse" }),
        { params: Promise.resolve({ serverId: "guild-1", eventId: "event-1" }) }
    )
    assert.equal(unsupported.status, 400)
    assert.deepEqual(await unsupported.json(), { error: "Unsupported action." })
})

test("server event saves forward team selections unchanged and surface team selection codes as 400 errors", async () => {
    const { deps, calls } = createDeps()
    const matchTeams = [
        { teamId: "teamDirectory:alpha", slot: "a", side: "Allies" },
        { teamId: "teamDirectory:bravo", slot: "b", side: null },
    ]
    const created = await createServerEventsPostHandler(deps)(
        jsonRequest(createEventBody({ matchTeams })),
        { params: Promise.resolve({ serverId: "guild-1" }) }
    )
    assert.equal(created.status, 200)
    assert.deepEqual(calls.savedEvents[0]?.matchTeams, matchTeams)
    const cleared = await createServerEventPatchHandler(deps)(
        jsonRequest(createEventBody({ matchTeams: [] })),
        { params: Promise.resolve({ serverId: "guild-1", eventId: "event-1" }) }
    )
    assert.equal(cleared.status, 200)
    assert.deepEqual(calls.savedEvents[1]?.matchTeams, [])
    const omitted = await createServerEventPatchHandler(deps)(
        jsonRequest(createEventBody()),
        { params: Promise.resolve({ serverId: "guild-1", eventId: "event-1" }) }
    )
    assert.equal(omitted.status, 200)
    assert.equal("matchTeams" in (calls.savedEvents[2] ?? {}), false)
    // Selections that fail the request schema get the same team code.
    const entry = { teamId: "teamDirectory:x", slot: "a", side: null }
    for (const selection of [
        [{ ...entry, slot: "d" }],
        ["a", "b", "c", "a"].map((slot, index) => ({
            ...entry,
            teamId: `teamDirectory:${index}`,
            slot,
        })),
        [{ ...entry, side: "x".repeat(33) }],
        [{ ...entry, snapshot: { name: "Forged" } }],
    ]) {
        const invalid = await createServerEventsPostHandler(deps)(
            jsonRequest(createEventBody({ matchTeams: selection })),
            { params: Promise.resolve({ serverId: "guild-1" }) }
        )
        assert.equal(invalid.status, 400)
        assert.deepEqual(await invalid.json(), {
            error: "invalid_match_teams",
        })
    }
    // Other invalid fields keep their existing message.
    const mixed = await createServerEventsPostHandler(deps)(
        jsonRequest(
            createEventBody({
                name: "",
                matchTeams: [{ ...entry, slot: "d" }],
            })
        ),
        { params: Promise.resolve({ serverId: "guild-1" }) }
    )
    assert.equal(mixed.status, 400)
    assert.notEqual((await mixed.json()).error, "invalid_match_teams")
    assert.equal(calls.savedEvents.length, 3)

    deps.saveServerEvent = async () => {
        throw new Error(
            "[Request ID: abc] Server Error\nUncaught Error: match_teams:team_archived\n    at handler (../convex/events.ts:1:1)"
        )
    }
    for (const response of [
        await createServerEventsPostHandler(deps)(
            jsonRequest(createEventBody({ matchTeams })),
            { params: Promise.resolve({ serverId: "guild-1" }) }
        ),
        await createServerEventPatchHandler(deps)(
            jsonRequest(createEventBody({ matchTeams })),
            {
                params: Promise.resolve({
                    serverId: "guild-1",
                    eventId: "event-1",
                }),
            }
        ),
    ]) {
        assert.equal(response.status, 400)
        assert.deepEqual(await response.json(), { error: "team_archived" })
    }
    deps.saveServerEvent = async () => {
        throw new Error("match_teams:not_a_known_code")
    }
    const unknown = await createServerEventsPostHandler(deps)(
        jsonRequest(createEventBody()),
        { params: Promise.resolve({ serverId: "guild-1" }) }
    )
    assert.deepEqual(await unknown.json(), {
        error: "match_teams:not_a_known_code",
    })
})

test("Wardogs and HLL registrations accept the configured public origin behind a proxy", async () => {
    for (const gameId of ["wardogs", "hell_let_loose"]) {
        const { deps, calls } = createDeps()
        const response = await createServerEventsPostHandler(deps)(
            jsonRequest(
                createEventBody({ gameId }),
                { origin },
                "http://127.0.0.1:3000"
            ),
            { params: Promise.resolve({ serverId: "guild-1" }) }
        )
        assert.equal(response.status, 200)
        assert.deepEqual(calls.accessChecks, ["guild-1"])
        assert.equal(calls.savedEvents[0]?.gameId, gameId)
        assert.equal(calls.savedEvents[0]?.serverId, "guild-1")
    }
})

test("event writes require a same-origin request from a current server admin", async () => {
    const { deps, calls } = createDeps()
    const params = { params: Promise.resolve({ serverId: "guild-1" }) }
    const eventParams = {
        params: Promise.resolve({ serverId: "guild-1", eventId: "event-1" }),
    }
    const writes = [
        (request: Request) =>
            createServerEventsPostHandler(deps)(request, params),
        (request: Request) =>
            createServerEventPatchHandler(deps)(request, eventParams),
        (request: Request) =>
            createServerEventPostHandler(deps)(request, eventParams),
    ]
    const bodies = [
        createEventBody({ matchTeams: [] }),
        createEventBody({ matchTeams: [] }),
        { action: "conclude" },
    ]
    for (const [index, write] of writes.entries()) {
        for (const headers of [
            { origin: "https://attacker.test" },
            { origin: "http://127.0.0.1:3000" },
            { origin: "null" },
            { origin: "https://logi.test.attacker.test" },
            { origin: "https://logi.test:444" },
            { origin: "https://logi.test/" },
            {
                origin: "https://attacker.test",
                host: "attacker.test",
                "x-forwarded-host": "attacker.test",
                "x-forwarded-proto": "https",
                forwarded: "host=attacker.test;proto=https",
            },
            {} as Record<string, string>,
        ]) {
            const response = await write(
                jsonRequest(bodies[index], headers, "http://127.0.0.1:3000")
            )
            assert.equal(response.status, 403)
            assert.deepEqual(await response.json(), { error: "forbidden" })
        }
        // Even matching request/Origin values cannot replace configured trust.
        assert.equal(
            (
                await write(
                    jsonRequest(
                        bodies[index],
                        { origin: "https://attacker.test" },
                        "https://attacker.test"
                    )
                )
            ).status,
            403
        )
    }
    assert.equal(calls.accessChecks.length, 0, "origin is checked first")

    calls.admin = false
    for (const [index, write] of writes.entries()) {
        const response = await write(
            jsonRequest(bodies[index], { origin }, "http://127.0.0.1:3000")
        )
        assert.equal(response.status, 403)
    }
    assert.deepEqual(calls.accessChecks, ["guild-1", "guild-1", "guild-1"])

    deps.canAdminServer = async () => {
        throw new Error("Convex unavailable")
    }
    assert.equal((await writes[0]!(jsonRequest(bodies[0]))).status, 403)
    assert.equal(calls.savedEvents.length, 0)
    assert.equal(calls.concluded.length, 0)
    assert.equal(calls.revalidated.length, 0)
})

test("event updates and actions use the configured public origin behind a proxy", async () => {
    const { deps, calls } = createDeps()
    const context = {
        params: Promise.resolve({ serverId: "guild-1", eventId: "event-1" }),
    }
    const headers = {
        origin,
        host: "internal:3000",
        "x-forwarded-host": "untrusted.test",
    }
    assert.equal(
        (
            await createServerEventPatchHandler(deps)(
                jsonRequest(
                    createEventBody({ gameId: "wardogs" }),
                    headers,
                    "http://internal:3000"
                ),
                context
            )
        ).status,
        200
    )
    assert.equal(
        (
            await createServerEventPostHandler(deps)(
                jsonRequest(
                    { action: "conclude" },
                    headers,
                    "http://internal:3000"
                ),
                context
            )
        ).status,
        200
    )
    assert.equal(calls.savedEvents.length, 1)
    assert.equal(calls.concluded.length, 1)

    deps.origin = "https://another-deployment.test"
    assert.equal(
        (
            await createServerEventPatchHandler(deps)(
                jsonRequest(createEventBody(), { origin }),
                context
            )
        ).status,
        403
    )
    assert.equal(calls.savedEvents.length, 1)
})
