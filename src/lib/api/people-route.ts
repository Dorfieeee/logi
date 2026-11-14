import {
    clanMemberSummarySchema,
    clanRosterSummarySchema,
    clanPlayerStatSummarySchema,
} from "@/domain/api/people-summaries"
import type { AuthenticatedClanRequest } from "./authenticated-clan-route"
import { createHash, createHmac, timingSafeEqual } from "node:crypto"
import { readCachedProjection } from "./projection-read-cache"
import { makeFunctionReference } from "convex/server"
import { observeApiRead } from "./read-diagnostics"
import { parsePeopleQuery } from "./people-query"
import { getInternalAuthSecret } from "@/lib/env"
import { fetchQuery } from "convex/nextjs"
import { NextResponse } from "next/server"

export async function handlePeopleRead(
    request: Request,
    auth: AuthenticatedClanRequest
) {
    const input = parsePeopleQuery(request)
    return input
        ? readCachedProjection(request, auth, input.resource, () =>
              buildPeopleRead(request, auth)
          )
        : buildPeopleRead(request, auth)
}

async function buildPeopleRead(
    request: Request,
    auth: AuthenticatedClanRequest
) {
    const headers = { ...auth.headers, "Cache-Control": "no-store" }
    const error = (code: string, status: number) =>
        NextResponse.json(
            {
                error: {
                    code,
                    message:
                        code === "reset_required"
                            ? "Capture start=now and rebuild this scope."
                            : "People projection unavailable or invalid.",
                },
            },
            { status, headers }
        )
    const input = parsePeopleQuery(request)
    if (!input) return error("invalid_query", 400)
    const secret = getInternalAuthSecret(),
        keyHash = createHash("sha256").update(auth.key).digest("hex")
    const args = {
        secret,
        keyHash,
        gameId: input.gameId,
        resource: input.resource,
    }
    const schema =
        input.resource === "member-summaries"
            ? clanMemberSummarySchema
            : input.resource === "roster-summaries"
              ? clanRosterSummarySchema
              : clanPlayerStatSummarySchema
    const validate = (value: unknown) => {
        const row = schema.parse(value)
        if (
            row.guildId !== auth.guildId ||
            row.gameId !== input.gameId ||
            (input.id !== undefined && row.id !== input.id)
        )
            throw new Error("Invalid people response scope.")
        return row
    }
    if (input.id !== undefined) {
        const value = await observeApiRead(
            {
                operation: "people-detail",
                resource: input.resource,
                gameId: input.gameId,
                keyHash,
            },
            () =>
                fetchQuery(
                    makeFunctionReference<"query">("peopleSummaries:get"),
                    { ...args, id: input.id }
                )
        )
        return value
            ? NextResponse.json({ data: validate(value) }, { headers })
            : error("not_found", 404)
    }
    const binding = JSON.stringify([
        keyHash,
        auth.guildId,
        input.gameId,
        input.resource,
    ])
    const sign = (body: string) =>
        createHmac("sha256", secret)
            .update(`logi-people-page-v1:${binding}:${body}`)
            .digest()
    let position: string | null = null,
        peopleScopeVersion: string | undefined
    if (input.cursor) {
        try {
            const parts = input.cursor.split(".")
            if (parts.length !== 2) throw new Error()
            const signature = Buffer.from(parts[1], "base64url"),
                expected = sign(parts[0])
            if (
                signature.length !== expected.length ||
                !timingSafeEqual(signature, expected)
            )
                throw new Error()
            const cursor = JSON.parse(
                Buffer.from(parts[0], "base64url").toString("utf8")
            )
            if (
                typeof cursor.position !== "string" ||
                !cursor.position ||
                cursor.position.length > 2048 ||
                typeof cursor.generation !== "string" ||
                !/^(0|[1-9][0-9]{0,127})$/.test(cursor.generation) ||
                !Number.isSafeInteger(cursor.issuedAt) ||
                cursor.issuedAt > Date.now() ||
                Date.now() - cursor.issuedAt >= 7 * 24 * 3600000
            )
                throw new Error()
            position = cursor.position
            peopleScopeVersion = cursor.generation
        } catch {
            return error("invalid_cursor", 400)
        }
    }
    const value = await observeApiRead(
        {
            operation: "people-list",
            resource: input.resource,
            gameId: input.gameId,
            keyHash,
        },
        () =>
            fetchQuery(makeFunctionReference<"query">("peopleSummaries:list"), {
                ...args,
                cursor: position,
                limit: input.limit,
                ...(peopleScopeVersion !== undefined
                    ? { peopleScopeVersion }
                    : {}),
            })
    )
    if (!value) return error("insufficient_scope", 403)
    if (value.resetRequired) return error("reset_required", 410)
    let nextCursor: string | null = null
    if (value.nextCursor !== null) {
        const body = Buffer.from(
            JSON.stringify({
                position: value.nextCursor,
                generation: value.peopleScopeVersion,
                issuedAt: Date.now(),
            })
        ).toString("base64url")
        nextCursor = `${body}.${sign(body).toString("base64url")}`
    }
    return NextResponse.json(
        {
            data: value.items.map(validate),
            page: { nextCursor, limit: value.limit },
        },
        { headers }
    )
}
