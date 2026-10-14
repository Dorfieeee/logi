import assert from "node:assert/strict"
import test from "node:test"

test("League match preview documents stale snapshots, explicit grants and nullable results", async () => {
    const document = await (await GET()).json()
    const operation = document.paths["/clan/league-matches"].get
    assert.equal(operation["x-logi-read-access"].resource, "league-matches")
    assert.match(operation.description, /stale=true/)
    assert.equal(
        operation.parameters.find((p: { name: string }) => p.name === "game")
            .schema.enum[0],
        "wardogs"
    )
    assert.ok(document.components.schemas.LeagueMatchRead)
    for (const code of ["200", "400", "401", "403", "429", "503"])
        assert.ok(operation.responses[code])
})

test("the WD League overview documents the table, nearest fixtures, recent results and its grant", async () => {
    const document = await (await GET()).json()
    const operation = document.paths["/clan/league-fixtures/overview"].get
    assert.equal(operation["x-logi-read-access"].resource, "league-fixtures")
    assert.match(operation.description, /waiting_for_results/)
    assert.match(operation.description, /1st 3 · 2nd 2 · 3rd 1/)
    const limit = operation.parameters.find(
        (p: { name: string }) => p.name === "limit"
    )
    assert.deepEqual(
        [limit.schema.minimum, limit.schema.maximum, limit.schema.default],
        [1, 10, 6]
    )
    const schema = document.components.schemas.LeagueOverview
    assert.deepEqual(Object.keys(schema.properties), ["standings", "fixtures"])
    assert.ok(schema.properties.fixtures.properties.recentResults)
    assert.match(operation.description, /recentResults\.state/)
    assert.deepEqual(
        schema.properties.fixtures.properties.recentResults.anyOf[0].properties
            .state.enum,
        ["waiting_for_results", "ready"]
    )
    assert.ok(
        document.components.schemas.LeagueFixture.properties.snapshot.properties
            .results
    )
    for (const code of ["200", "400", "401", "403", "429", "503"])
        assert.ok(operation.responses[code])
})

test("Warcon reads document every view, an explicit grant and typed player data", async () => {
    const document = await (await GET()).json()
    const endpoint = document.paths["/clan/warcon-data/{connectionId}"]
    assert.ok(endpoint?.get)
    assert.deepEqual(Object.keys(endpoint), ["get"])
    assert.match(endpoint.get.description, /Legacy keys are denied/)
    assert.ok(
        endpoint.get.parameters
            .find((p: { name: string }) => p.name === "view")
            .schema.enum.includes("live")
    )
    assert.equal(
        document.components.schemas.WarconEnvelope.properties.result.oneOf
            ?.length ??
            document.components.schemas.WarconEnvelope.properties.result.anyOf
                ?.length,
        15
    )
})

import { GET } from "./route"

test("actor event commands document two simultaneous credentials and durable revision-safe writes", async () => {
    const document = await (await GET()).json()
    const command = document.paths["/clan/event-commands"].post
    assert.deepEqual(command.security, [{ clanApiKey: [], ssoActorToken: [] }])
    assert.match(command.description, /at most 60 seconds/)
    assert.match(command.description, /without a time expiry/)
    assert.match(command.description, /unknown outcome/)
    for (const code of [
        "200",
        "201",
        "400",
        "401",
        "403",
        "404",
        "409",
        "429",
        "503",
    ])
        assert.ok(command.responses[code])
    assert.equal(
        document.components.securitySchemes.ssoActorToken.name,
        "X-Logi-Actor-Token"
    )
    assert.equal(
        document.components.schemas.WebsiteEventReceipt.additionalProperties,
        false
    )
    assert.equal(
        document.components.schemas.WebsiteEventEditor.additionalProperties,
        false
    )
    assert.ok(document.paths["/clan/event-commands/{eventId}"].get)
})

test("generic event schemas exclude internal reviewed result storage", async () => {
    const document = await (await GET()).json()
    const schema = document.components.schemas.ClanEventsDocument
    for (const field of ["reviewedResult", "reviewedResultGameId"]) {
        assert.equal(field in schema.properties, false)
        assert.equal(field in schema.example, false)
        assert.equal(schema.required.includes(field), false)
    }
})

test("OpenAPI exposes read-only summary routes with closed minimal response schemas", async () => {
    const document = await (await GET()).json()
    for (const [resource, schemaName, field] of [
        ["server-snapshots", "ClanServerSnapshotsDocument", "freshness"],
        [
            "integration-health",
            "ClanIntegrationHealthDocument",
            "lastSuccessAt",
        ],
        ["event-summaries", "ClanEventSummariesDocument", "startsAt"],
        ["match-summaries", "ClanMatchSummariesDocument", "resultState"],
        ["result-summaries", "ClanResultSummariesDocument", "resultState"],
    ]) {
        const operations = document.paths[`/clan/${resource}`]
        assert.ok(operations?.get, `${resource} list is documented`)
        assert.deepEqual(Object.keys(operations), ["get"])
        assert.ok(
            operations.get.parameters.some(
                (parameter: { name: string }) => parameter.name === "game"
            )
        )
        assert.equal(
            operations.get.responses["200"].content["application/json"].schema
                .properties.data.items.$ref,
            `#/components/schemas/${schemaName}`
        )
        const schema = document.components.schemas[schemaName]
        assert.ok(schema.properties[field])
        assert.equal(schema.additionalProperties, false)
        for (const excluded of [
            "notes",
            "serverPassword",
            "participants",
            "signUps",
            "raw",
            "sourceUrl",
        ])
            assert.equal(excluded in schema.properties, false)
    }
    assert.ok(document.paths["/clan/match-summaries/{eventId}"]?.get)
    assert.ok(document.paths["/clan/event-summaries/{id}"]?.get)
})

test("every clan operation documents runtime scope denial and its read-access resource", async () => {
    const document = await (await GET()).json()
    for (const [path, operations] of Object.entries(document.paths)) {
        if (!path.startsWith("/clan/")) continue
        for (const [method, operation] of Object.entries(
            operations as Record<
                string,
                {
                    responses: Record<string, unknown>
                    "x-logi-read-access"?: unknown
                }
            >
        )) {
            assert.ok(
                operation.responses["403"],
                `${method} ${path} must document insufficient_scope`
            )
            const resource = path.split("/")[2]
            if (
                [
                    "league-matches",
                    "league-fixtures",
                    "server-game-history",
                    "hll-live",
                ].includes(resource)
            ) {
                assert.deepEqual(operation["x-logi-read-access"], {
                    resource,
                    games: [
                        resource === "hll-live" ? "hell_let_loose" : "wardogs",
                    ],
                    explicitGrantRequired: true,
                })
                continue
            }
            if (resource === "membership-summaries") {
                assert.deepEqual(operation["x-logi-read-access"], {
                    resource,
                    gameSelection: "one-explicit-game",
                    policy: "enabled-per-key-role-allowlist",
                    subject: "exact-discord-user-id",
                })
                continue
            }
            if (["changes", "sync-records"].includes(resource)) {
                assert.deepEqual(operation["x-logi-read-access"], {
                    resources: "underlying-explicit-grants",
                    gameSelection: "one-explicit-game",
                })
                continue
            }
            if (resource === "teams") {
                assert.deepEqual(operation["x-logi-read-access"], {
                    resource,
                    games: ["hell_let_loose", "wardogs"],
                    explicitGrantRequired: true,
                })
                continue
            }
            const allowed =
                method === "get" &&
                [
                    "member-summaries",
                    "roster-summaries",
                    "player-stat-summaries",
                    "warcon-data",
                    "server-snapshots",
                    "integration-health",
                    "events",
                    "groups",
                    "rosters",
                    "assignments",
                    "stratmaps",
                    "matches",
                    "event-summaries",
                    "match-summaries",
                    "result-summaries",
                ].includes(resource)
            if (allowed)
                assert.deepEqual(
                    operation["x-logi-read-access"],
                    {
                        resource,
                        gameSelection: path.includes("{")
                            ? "persisted-record"
                            : "explicit-permitted-games",
                    },
                    `${method} ${path}`
                )
            else
                assert.ok(
                    operation["x-logi-read-access"] === null ||
                        operation["x-logi-read-access"] === undefined,
                    `${method} ${path}`
                )
        }
    }
})
test("membership OpenAPI exposes only exact-subject reads and required policy/freshness rules", async () => {
    const document = await (await GET()).json()
    assert.equal(document.paths["/clan/membership-summaries"], undefined)
    const operation =
        document.paths["/clan/membership-summaries/{discordUserId}"]?.get
    assert.ok(operation)
    assert.ok(
        operation.parameters.some(
            (value: { name: string; required?: boolean }) =>
                value.name === "game" && value.required
        )
    )
    assert.ok(
        operation.parameters.some(
            (value: { name: string; schema: { maximum?: number } }) =>
                value.name === "maxAgeMs" && value.schema.maximum === 300000
        )
    )
    assert.ok(document.components.schemas.MembershipObservation)
    assert.ok(
        document.paths["/clan/changes"].get.parameters.some(
            (value: { name: string }) => value.name === "subject"
        )
    )
})

test("OpenAPI advertises every implemented clan write endpoint", async () => {
    const response = await GET()
    const document = (await response.json()) as {
        paths: Record<string, Record<string, unknown>>
    }

    assert.ok(document.paths["/clan/articles"]?.post)
    assert.ok(document.paths["/clan/articles/{id}"]?.patch)
    assert.ok(document.paths["/clan/articles/{id}"]?.delete)
    assert.ok(document.paths["/clan/events/{eventId}/signup"]?.post)
    assert.ok(document.paths["/clan/events"]?.post)
    assert.ok(document.paths["/clan/events/{id}"]?.patch)
    assert.ok(document.paths["/clan/events/{eventId}/actions/conclude"]?.post)
    assert.ok(document.paths["/clan/groups"]?.post)
    assert.ok(document.paths["/clan/groups/{id}"]?.patch)
    assert.ok(document.paths["/clan/groups/{id}"]?.delete)
    assert.ok(document.paths["/clan/calendar-items"]?.post)
    assert.ok(document.paths["/clan/calendar-items/{id}"]?.patch)
    assert.ok(document.paths["/clan/calendar-items/{id}"]?.delete)
    assert.ok(document.paths["/clan/settings"]?.patch)
    assert.ok(document.paths["/clan/assignments"]?.post)
    assert.ok(document.paths["/clan/assignments/{id}"]?.patch)
    assert.ok(document.paths["/clan/assignments/{id}"]?.delete)
    assert.ok(document.paths["/clan/rosters/{id}"]?.patch)
    assert.ok(document.paths["/clan/rosters/{id}"]?.delete)
    assert.ok(document.paths["/clan/stratmaps"]?.post)
    assert.ok(document.paths["/clan/stratmaps/{id}"]?.patch)
    assert.ok(document.paths["/clan/topic-presets"]?.post)
    assert.ok(document.paths["/clan/topic-presets/{id}"]?.patch)
    assert.ok(document.paths["/clan/squad-presets"]?.post)
    assert.ok(document.paths["/clan/squad-presets/{id}"]?.patch)
})

test("OpenAPI requires idempotency for clan writes", async () => {
    const document = (await (await GET()).json()) as {
        paths: Record<
            string,
            Record<string, { parameters?: Array<{ name?: string }> }>
        >
    }
    const paths = [
        ["/clan/articles", "post"],
        ["/clan/articles/{id}", "patch"],
        ["/clan/articles/{id}", "delete"],
        ["/clan/events/{eventId}/signup", "post"],
        ["/clan/events", "post"],
        ["/clan/events/{id}", "patch"],
        ["/clan/events/{eventId}/actions/conclude", "post"],
        ["/clan/groups", "post"],
        ["/clan/groups/{id}", "patch"],
        ["/clan/groups/{id}", "delete"],
        ["/clan/calendar-items", "post"],
        ["/clan/calendar-items/{id}", "patch"],
        ["/clan/calendar-items/{id}", "delete"],
        ["/clan/settings", "patch"],
        ["/clan/assignments", "post"],
        ["/clan/assignments/{id}", "patch"],
        ["/clan/assignments/{id}", "delete"],
        ["/clan/rosters/{id}", "patch"],
        ["/clan/rosters/{id}", "delete"],
        ["/clan/stratmaps", "post"],
        ["/clan/stratmaps/{id}", "patch"],
        ["/clan/topic-presets", "post"],
        ["/clan/topic-presets/{id}", "patch"],
        ["/clan/squad-presets", "post"],
        ["/clan/squad-presets/{id}", "patch"],
    ] as const
    for (const [path, method] of paths)
        assert.ok(
            document.paths[path]?.[method]?.parameters?.some(
                (parameter) => parameter.name === "Idempotency-Key"
            )
        )
})

test("OpenAPI documents beginner-safe API workflows", async () => {
    const document = (await (await GET()).json()) as {
        info: { description: string }
        components: {
            securitySchemes: Record<string, { description?: string }>
        }
        paths: Record<
            string,
            Record<
                string,
                {
                    parameters?: Array<{
                        name?: string
                        description?: string
                    }>
                }
            >
        >
    }

    assert.match(
        document.info.description,
        /Authorization: Bearer YOUR_API_KEY/
    )
    assert.match(document.info.description, /page\.nextCursor/)
    assert.match(document.info.description, /updatedSince/)
    assert.match(document.info.description, /409 idempotency_conflict/)
    assert.match(document.info.description, /X-Logi-Signature/)
    assert.match(
        document.info.description,
        /deletion is intentionally unsupported/
    )
    assert.match(
        document.components.securitySchemes.clanApiKey?.description ?? "",
        /scoped to one clan/
    )

    const eventList = document.paths["/clan/events"]?.get
    assert.match(
        eventList?.parameters?.find((parameter) => parameter.name === "cursor")
            ?.description ?? "",
        /Opaque/
    )
    assert.match(
        eventList?.parameters?.find((parameter) => parameter.name === "game")
            ?.description ?? "",
        /Game scope/
    )
})

test("global team catalogue reads document explicit per-game grants, no change log, archived/merged exclusion and snapshot delivery", async () => {
    const document = await (await GET()).json()
    const collection = document.paths["/clan/teams"].get,
        detail = document.paths["/clan/teams/{id}"].get
    assert.deepEqual(Object.keys(document.paths["/clan/teams"]), ["get"])
    assert.deepEqual(Object.keys(document.paths["/clan/teams/{id}"]), ["get"])
    for (const operation of [collection, detail]) {
        assert.deepEqual(operation.tags, ["Clan API — Teams"])
        assert.deepEqual(operation.security, [{ clanApiKey: [] }])
        assert.deepEqual(operation["x-logi-read-access"], {
            resource: "teams",
            games: ["hell_let_loose", "wardogs"],
            explicitGrantRequired: true,
        })
        const game = operation.parameters.find(
            (p: { name: string }) => p.name === "game"
        )
        assert.equal(game.required, true)
        assert.deepEqual(game.schema.enum, ["hell_let_loose", "wardogs"])
        for (const code of ["200", "400", "401", "403", "429", "503"])
            assert.ok(operation.responses[code], code)
        assert.match(operation.description, /no-store/)
    }
    assert.ok(detail.responses["404"])
    assert.equal(collection.responses["404"], undefined)
    for (const phrase of [
        /team catalogue is global/i,
        /global administrators own one catalogue per game/i,
        /no workspace owns or keeps a private team list/i,
        /key supplies the workspace and must still belong to the workspace that authenticated the request/i,
        /exactly one supported game/i,
        /archived and merged teams are excluded/i,
        /use the collection as the baseline and sync-records with resource teams/i,
        /does not retain a per-workspace change log/i,
        /legacy broad keys do not acquire/i,
        /catalogue writes .*, logo uploads and team requests .* no bearer-key API \(documented API-parity exception\)/i,
        /matchTeams snapshots \(ClanMatchTeam\)/,
        /archived or merged/,
    ])
        assert.match(collection.description, phrase)
    assert.doesNotMatch(collection.description, /workspace-owned/i)
    for (const phrase of [
        /global catalogue team ID/,
        /public competition/,
        /Unknown, archived, merged and other-game IDs return a generic 404 without labels/,
        /merge target is not disclosed/,
    ])
        assert.match(detail.description, phrase)
    assert.doesNotMatch(detail.description, /other-workspace/)
    assert.match(detail.responses["404"].description, /merged/)
    assert.match(
        document.tags.find(
            (tag: { name: string }) => tag.name === "Clan API — Teams"
        ).description,
        /^Global team catalogue reads/
    )
    const limit = collection.parameters.find(
        (p: { name: string }) => p.name === "limit"
    )
    assert.deepEqual(limit.schema, {
        type: "integer",
        minimum: 1,
        maximum: 100,
        default: 50,
    })
    assert.equal(
        collection.parameters.find((p: { name: string }) => p.name === "cursor")
            .schema.maxLength,
        4096
    )
    const id = detail.parameters.find((p: { name: string }) => p.name === "id")
    assert.equal(id.in, "path")
    assert.equal(id.schema.maxLength, 64)
    assert.equal(
        collection.responses["200"].content["application/json"].schema
            .properties.data.$ref,
        "#/components/schemas/ClanTeamPage"
    )
    assert.equal(
        detail.responses["200"].content["application/json"].schema.properties
            .data.$ref,
        "#/components/schemas/ClanTeam"
    )
    const { ClanTeam, ClanTeamPage, ClanMatchTeam } =
        document.components.schemas
    assert.equal(ClanTeam.additionalProperties, false)
    assert.deepEqual(Object.keys(ClanTeam.properties).sort(), [
        "description",
        "gameId",
        "id",
        "links",
        "logoUrl",
        "name",
        "revision",
        "shortCode",
        "updatedAt",
    ])
    assert.deepEqual([...ClanTeam.required].sort(), [
        "description",
        "gameId",
        "id",
        "links",
        "logoUrl",
        "name",
        "revision",
        "shortCode",
        "updatedAt",
    ])
    assert.equal(ClanTeam.properties.links.type, "array")
    assert.equal(ClanTeam.properties.links.maxItems, 3)
    assert.match(ClanTeam.properties.links.description, /https/)
    assert.deepEqual(
        ClanTeam.properties.description.anyOf.map(
            (option: { type: string }) => option.type
        ),
        ["string", "null"]
    )
    assert.match(ClanTeam.properties.description.description, /500/)
    for (const field of [
        "guildId",
        "linkedGuildId",
        "mergedIntoTeamId",
        "logoAssetId",
        "archivedAt",
    ])
        assert.equal(field in ClanTeam.properties, false, field)
    assert.deepEqual(ClanTeam.properties.gameId.enum, [
        "hell_let_loose",
        "wardogs",
    ])
    assert.equal(ClanTeamPage.additionalProperties, false)
    assert.equal(ClanTeamPage.properties.items.maxItems, 100)
    assert.equal(
        ClanTeamPage.properties.items.items.$ref,
        "#/components/schemas/ClanTeam"
    )
    assert.equal(ClanMatchTeam.additionalProperties, false)
    assert.equal("logoAssetId" in ClanMatchTeam.properties, false)
    assert.deepEqual(ClanMatchTeam.properties.slot.enum, ["a", "b", "c"])
    for (const field of ["teamId", "side", "teamRevision", "capturedAt"])
        assert.ok(ClanMatchTeam.properties[field], field)
    // The synchronization surface enumerates teams wherever SYNC_RESOURCES is used.
    assert.ok(
        document.paths["/clan/sync-records/{resource}/{id}"].get.parameters
            .find((p: { name: string }) => p.name === "resource")
            .schema.enum.includes("teams")
    )
    assert.match(
        document.paths["/clan/changes"].get.parameters.find(
            (p: { name: string }) => p.name === "resources"
        ).description,
        /\bteams\b/
    )
    assert.ok(
        document.components.schemas.IntegrationChange.properties.resource.enum.includes(
            "teams"
        )
    )
})

test("OpenAPI groups operations by their clan resource", async () => {
    const document = (await (await GET()).json()) as {
        tags: Array<{ name: string }>
        paths: Record<string, Record<string, { tags?: string[] }>>
    }

    assert.deepEqual(
        document.tags.map((tag) => tag.name),
        [
            "Clan API — People",
            "Public API — no key required",
            "Clan API — Overview",
            "Clan API — Settings",
            "Clan API — Articles",
            "Clan API — Events",
            "Clan API — Groups",
            "Clan API — Calendar",
            "Clan API — Rosters",
            "Clan API — Assignments",
            "Clan API — Stratmaps",
            "Clan API — Topic presets",
            "Clan API — Squad presets",
            "Clan API — Matches",
            "Clan API — Teams",
            "Clan API — Users",
        ]
    )
    assert.deepEqual(document.paths["/public/matches"]?.get?.tags, [
        "Public API — no key required",
    ])
    assert.deepEqual(document.paths["/clan/articles"]?.post?.tags, [
        "Clan API — Articles",
    ])
    assert.deepEqual(document.paths["/clan/events/{id}"]?.patch?.tags, [
        "Clan API — Events",
    ])
    assert.deepEqual(document.paths["/clan/rosters/{id}"]?.delete?.tags, [
        "Clan API — Rosters",
    ])
    assert.deepEqual(document.paths["/clan/settings"]?.patch?.tags, [
        "Clan API — Settings",
    ])
})

test("OpenAPI derives concrete Convex-backed success bodies", async () => {
    const document = (await (await GET()).json()) as {
        components: {
            schemas: Record<
                string,
                {
                    properties?: Record<string, unknown>
                    example?: Record<string, unknown>
                }
            >
        }
        paths: Record<
            string,
            Record<
                string,
                {
                    responses?: Record<
                        string,
                        {
                            content?: {
                                "application/json"?: {
                                    schema?: Record<string, unknown>
                                }
                            }
                        }
                    >
                }
            >
        >
    }

    const event = document.components.schemas.ClanEventsDocument
    assert.ok(event?.properties?.participants)
    assert.ok(event?.properties?.signUps)
    assert.equal(event?.example?.id, "string")

    const listSchema =
        document.paths["/clan/events"]?.get?.responses?.["200"]?.content?.[
            "application/json"
        ]?.schema
    assert.deepEqual(
        (
            listSchema?.properties as Record<
                string,
                { items?: { $ref?: string } }
            >
        ).data?.items?.$ref,
        "#/components/schemas/ClanEventsDocument"
    )
    const createSchema =
        document.paths["/clan/events"]?.post?.responses?.["201"]?.content?.[
            "application/json"
        ]?.schema
    assert.deepEqual(
        (createSchema?.properties as Record<string, { $ref?: string }>).data
            ?.$ref,
        "#/components/schemas/ClanEventsDocument"
    )
})

test("bearer event writes document read-only match teams and complete records their internal snapshot fields", async () => {
    const document = await (await GET()).json()
    assert.equal(document.info.version, "1.11.0")
    for (const operation of [
        document.paths["/clan/events"].post,
        document.paths["/clan/events/{id}"].patch,
    ]) {
        assert.match(operation.description, /matchTeams is read-only/)
        assert.match(operation.description, /match_teams:team_game_mismatch/)
        assert.match(operation.description, /\/clan\/event-commands/)
        const property =
            operation.requestBody.content["application/json"].schema.properties
                .matchTeams
        assert.equal(property.readOnly, true)
    }
    for (const operation of [
        document.paths["/clan/events"].get,
        document.paths["/clan/events/{id}"].get,
    ]) {
        assert.match(operation.description, /logoAssetId is an internal/)
        assert.match(operation.description, /ClanMatchTeam, logoUrl only/)
    }
})

test("OpenAPI documents the template settings of event writes", async () => {
    const document = await (await GET()).json()
    for (const operation of [
        document.paths["/clan/events"].post,
        document.paths["/clan/events/{id}"].patch,
    ]) {
        const properties =
            operation.requestBody.content["application/json"].schema.properties
        assert.deepEqual(
            properties.attendanceReminderHours.items.enum,
            [24, 18, 12, 6]
        )
        assert.equal(
            properties.signupGroupLimits.items.properties.max.maximum,
            100
        )
        assert.equal(properties.createParticipantRoles.type, "boolean")
        assert.match(
            properties.squadPresetId.description,
            /empty string removes/
        )
        assert.match(properties.signupGroupLimits.description, /removes nobody/)
    }
})

test("player and clan history contracts define game-specific Wardogs money without HLL scores", async () => {
    const document = await (await GET()).json()
    const player = document.paths["/public/players/{playerId}"].get
    assert.ok(
        player.parameters.some(
            (parameter: { name: string }) => parameter.name === "game"
        )
    )
    assert.match(player.description, /cashDelta/)
    assert.match(player.description, /never combine games/)
    assert.match(
        document.paths["/clan/performance-history"].get.description,
        /Unknown cash is null/
    )
})

test("Wardogs reviewed reports document the same public and scoped match shape", async () => {
    const document = await (await GET()).json()
    const schema = document.components.schemas.WardogsMatchReport
    assert.equal(schema.properties.gameId.const, "wardogs")
    assert.ok(schema.properties.players.items.properties.money)
    assert.equal(
        schema.properties.players.items.properties.platformId,
        undefined
    )
    assert.match(
        document.paths["/public/matches/{eventId}"].get.description,
        /WardogsMatchReport/
    )
    const detail = document.paths["/clan/matches/{eventId}"].get
    assert.match(detail.description, /matching workspace/)
    assert.ok(
        detail.responses["200"].content[
            "application/json"
        ].schema.properties.data.oneOf.some(
            (entry: { $ref: string }) =>
                entry.$ref === "#/components/schemas/WardogsMatchReport"
        )
    )
})
