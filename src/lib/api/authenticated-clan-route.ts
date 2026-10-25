import {
    allowsApiKeyRead,
    type ApiKeyReadAccess,
} from "@/domain/api/key-access"
import { parseApiGameScope, isApiGameScopeError } from "./game-scope"
import { PEOPLE_RESOURCES } from "@/domain/api/people-summaries"
import { isApiKeyReadAccess } from "@/domain/api/key-access"
import { parseIntegrationQuery } from "./integration-query"
import { parseMembershipQuery } from "./membership-query"
import { parsePeopleQuery } from "./people-query"
import { NextResponse } from "next/server"

import {
    authenticateClanApiKey,
    checkPublicApiRateLimit,
    hashApiKey,
    rateLimitHeaders,
    readBearerToken,
} from "@/lib/public-api"

export type AuthenticatedClanRequest = {
    key: string
    guildId: string
    headers: Record<string, string>
}

/** Performs the same authentication and rate-limit response handling for every clan route. */
export async function authenticateClanRequest(
    request: Request
): Promise<AuthenticatedClanRequest | NextResponse> {
    return await authenticateClanRequestWith(request, {
        readBearerToken,
        hashApiKey,
        checkRateLimit: checkPublicApiRateLimit,
        authenticateKey: authenticateClanApiKey,
        rateLimitHeaders,
    })
}

export async function authenticateClanRequestWith(
    request: Request,
    dependencies: {
        readBearerToken: (request: Request) => string | null
        hashApiKey: (key: string) => string
        checkRateLimit: (
            bucket: string,
            limit: number
        ) => Promise<{ allowed: boolean; remaining: number; resetAt: number }>
        authenticateKey: (
            key: string
        ) => Promise<{ guildId: string; readAccess?: ApiKeyReadAccess } | null>
        rateLimitHeaders: (result: {
            remaining: number
            resetAt: number
        }) => Record<string, string>
    }
): Promise<AuthenticatedClanRequest | NextResponse> {
    const key = dependencies.readBearerToken(request)
    if (!key)
        return NextResponse.json(
            {
                error: {
                    code: "missing_api_key",
                    message: "Use Authorization: Bearer <API key>.",
                },
            },
            { status: 401 }
        )
    const rateLimit = await dependencies.checkRateLimit(
        `key:${dependencies.hashApiKey(key)}`,
        300
    )
    const headers = dependencies.rateLimitHeaders(rateLimit)
    if (!rateLimit.allowed)
        return NextResponse.json(
            { error: { code: "rate_limited", message: "Too many requests." } },
            {
                status: 429,
                headers: {
                    ...headers,
                    "Retry-After": String(
                        Math.max(
                            1,
                            Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
                        )
                    ),
                },
            }
        )
    const authenticated = await dependencies.authenticateKey(key)
    if (!authenticated)
        return NextResponse.json(
            {
                error: {
                    code: "invalid_api_key",
                    message: "The API key is invalid or revoked.",
                },
            },
            { status: 401, headers }
        )
    const providerGrant =
        /^\/api\/v1\/clan\/(warcon-data|server-game-history|league-matches|league-fixtures|hll-live)(\/|$)/.exec(
            new URL(request.url).pathname
        )?.[1]
    const peopleResource = new URL(request.url).pathname.split("/")[4]
    if ((PEOPLE_RESOURCES as readonly string[]).includes(peopleResource)) {
        headers["Cache-Control"] = "no-store"
        const input = parsePeopleQuery(request)
        if (!input)
            return NextResponse.json(
                {
                    error: {
                        code: "invalid_query",
                        message:
                            "One game and a bounded people projection are required.",
                    },
                },
                { status: 400, headers }
            )
        if (
            request.method !== "GET" ||
            !isApiKeyReadAccess(authenticated.readAccess) ||
            !allowsApiKeyRead(
                authenticated.readAccess,
                input.resource,
                input.gameId
            )
        )
            return NextResponse.json(
                {
                    error: {
                        code: "insufficient_scope",
                        message:
                            "An explicit read grant for this people resource and game is required.",
                    },
                },
                { status: 403, headers }
            )
        return { key, guildId: authenticated.guildId, headers }
    }
    if (providerGrant) {
        headers["Cache-Control"] = "no-store"
        const params = new URL(request.url).searchParams
        const historyGame = params.get("game")
        if (
            providerGrant === "server-game-history" &&
            (params.getAll("game").length !== 1 ||
                (historyGame !== "wardogs" && historyGame !== "hell_let_loose"))
        )
            return NextResponse.json(
                {
                    error: {
                        code: "invalid_query",
                        message: "One exact history game is required.",
                    },
                },
                { status: 400, headers }
            )
        if (
            request.method !== "GET" ||
            !isApiKeyReadAccess(authenticated.readAccess) ||
            !allowsApiKeyRead(
                authenticated.readAccess,
                providerGrant,
                providerGrant === "server-game-history" &&
                    historyGame === "hell_let_loose"
                    ? "hell_let_loose"
                    : providerGrant === "hll-live"
                      ? "hell_let_loose"
                      : "wardogs"
            )
        )
            return NextResponse.json(
                {
                    error: {
                        code: "insufficient_scope",
                        message:
                            "An explicit read grant for this provider resource and game is required.",
                    },
                },
                { status: 403, headers }
            )
    }
    if (
        /^\/api\/v1\/clan\/membership-summaries(\/|$)/.test(
            new URL(request.url).pathname
        )
    ) {
        headers["Cache-Control"] = "no-store"
        const input = parseMembershipQuery(request)
        if (!input)
            return NextResponse.json(
                {
                    error: {
                        code: "invalid_query",
                        message:
                            "An exact member, one game and a bounded observation age are required.",
                    },
                },
                { status: 400, headers }
            )
        if (
            request.method !== "GET" ||
            !isApiKeyReadAccess(authenticated.readAccess) ||
            !allowsApiKeyRead(
                authenticated.readAccess,
                "membership-summaries",
                input.gameId
            )
        )
            return NextResponse.json(
                {
                    error: {
                        code: "insufficient_scope",
                        message: "This API key does not allow this operation.",
                    },
                },
                { status: 403, headers }
            )
    }
    if (
        /^\/api\/v1\/clan\/(changes|sync-records)(\/|$)/.test(
            new URL(request.url).pathname
        )
    ) {
        headers["Cache-Control"] = "no-store"
        const input = parseIntegrationQuery(request)
        if (!input)
            return NextResponse.json(
                {
                    error: {
                        code: "invalid_query",
                        message:
                            "An explicit single game and registered resources are required.",
                    },
                },
                { status: 400, headers }
            )
        if (
            request.method !== "GET" ||
            !isApiKeyReadAccess(authenticated.readAccess) ||
            !input.resources.every((resource) =>
                allowsApiKeyRead(
                    authenticated.readAccess,
                    resource,
                    input.gameId
                )
            )
        )
            return NextResponse.json(
                {
                    error: {
                        code: "insufficient_scope",
                        message:
                            "Explicit underlying read grants are required.",
                    },
                },
                { status: 403, headers }
            )
        return { key, guildId: authenticated.guildId, headers }
    }
    if (
        /^\/api\/v1\/clan\/(competitions|workspace-mode)\/?$/.test(
            new URL(request.url).pathname
        )
    ) {
        headers["Cache-Control"] = "no-store"
        const game = parseApiGameScope(request)
        if (
            authenticated.readAccess !== undefined &&
            (request.method !== "GET" ||
                isApiGameScopeError(game) ||
                !allowsApiKeyRead(authenticated.readAccess, "teams", game))
        )
            return NextResponse.json(
                {
                    error: {
                        code: "insufficient_scope",
                        message:
                            "A teams read grant is required; restricted keys cannot write.",
                    },
                },
                { status: 403, headers }
            )
        // The feature rechecks the exact game, current key and SSO clan admin.
        return { key, guildId: authenticated.guildId, headers }
    }
    if (authenticated.readAccess !== undefined) {
        headers["Cache-Control"] = "no-store"
        const url = new URL(request.url)
        const path =
            url.pathname.match(/^\/api\/v1\/clan\/([^/]+)(?:\/([^/]+))?\/?$/) ??
            url.pathname.match(/^\/api\/v1\/clan\/(events)\/([^/]+)\/image\/?$/)
        const game = path?.[2] ? undefined : parseApiGameScope(request)
        const hasExplicitGame = url.searchParams
            .getAll("game")
            .some((value) => value.split(",").some(Boolean))
        if (
            (request.method !== "GET" && request.method !== "HEAD") ||
            !path ||
            (!path[2] && !hasExplicitGame) ||
            (game !== undefined && isApiGameScopeError(game)) ||
            !allowsApiKeyRead(authenticated.readAccess, path[1], game)
        )
            return NextResponse.json(
                {
                    error: {
                        code: "insufficient_scope",
                        message: "This API key does not allow this operation.",
                    },
                },
                { status: 403, headers }
            )
    }
    return { key, guildId: authenticated.guildId, headers }
}

export function isAuthError(
    value: AuthenticatedClanRequest | NextResponse
): value is NextResponse {
    return value instanceof NextResponse
}
