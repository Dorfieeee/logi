import {
    integrationChangeSchema,
    syncRecordSchema,
} from "@/domain/integrations/change.schema"
import type { AuthenticatedClanRequest } from "./authenticated-clan-route"
import { createHash, createHmac, timingSafeEqual } from "node:crypto"
import { readCachedProjection } from "./projection-read-cache"
import { revisionOrder } from "@/domain/integrations/change"
import { parseIntegrationQuery } from "./integration-query"
import { makeFunctionReference } from "convex/server"
import { observeApiRead } from "./read-diagnostics"
import { getInternalAuthSecret } from "@/lib/env"
import { fetchQuery } from "convex/nextjs"
import { NextResponse } from "next/server"

export async function handleIntegrationRead(
    request: Request,
    auth: AuthenticatedClanRequest
) {
    const input = parseIntegrationQuery(request)
    return input?.kind === "record"
        ? readCachedProjection(request, auth, input.resources[0], () =>
              buildIntegrationRead(request, auth)
          )
        : buildIntegrationRead(request, auth)
}

async function buildIntegrationRead(
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
                            ? "Capture start=now and rebuild this scope before replaying changes."
                            : "Integration request unavailable or invalid.",
                },
            },
            { status, headers }
        )
    const input = parseIntegrationQuery(request)
    if (!input) return error("invalid_query", 400)
    const secret = getInternalAuthSecret(),
        keyHash = createHash("sha256").update(auth.key).digest("hex")
    const subject = { secret, keyHash, gameId: input.gameId }
    if (input.kind === "record") {
        const value = await observeApiRead(
            {
                operation: "sync-record",
                resource: input.resources[0],
                gameId: input.gameId,
                keyHash,
            },
            () =>
                fetchQuery(
                    makeFunctionReference<"query">(
                        "integrationChanges:readSyncRecord"
                    ),
                    { ...subject, resource: input.resources[0], id: input.id }
                )
        )
        if (!value) return error("not_found", 404)
        const data = syncRecordSchema.parse(value)
        if (
            data.guildId !== auth.guildId ||
            data.gameId !== input.gameId ||
            data.resource !== input.resources[0] ||
            data.id !== input.id
        )
            throw new Error("Invalid integration response scope.")
        return NextResponse.json({ data }, { headers })
    }
    const binding = JSON.stringify([
        keyHash,
        auth.guildId,
        input.gameId,
        input.resources,
        ...(input.discordUserId ? [input.discordUserId] : []),
    ])
    const sign = (body: string) =>
        createHmac("sha256", secret)
            .update(`logi-changes-v1:${binding}:${body}`)
            .digest()
    let afterRevision: string | undefined, issuedAt: number | undefined
    let membershipScopeVersion: string | undefined
    let peopleScopeVersion: string | undefined
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
            revisionOrder(cursor.revision)
            if (!Number.isSafeInteger(cursor.issuedAt)) throw new Error()
            afterRevision = cursor.revision
            issuedAt = cursor.issuedAt
            if (typeof cursor.membershipScopeVersion === "string")
                membershipScopeVersion = cursor.membershipScopeVersion
            if (typeof cursor.peopleScopeVersion === "string")
                peopleScopeVersion = cursor.peopleScopeVersion
        } catch {
            return error("invalid_cursor", 400)
        }
    }
    const value = await fetchQuery(
        makeFunctionReference<"query">("integrationChanges:readChanges"),
        {
            ...subject,
            resources: input.resources,
            limit: input.limit,
            startNow: input.startNow,
            ...(input.discordUserId
                ? { discordUserId: input.discordUserId }
                : {}),
            ...(membershipScopeVersion ? { membershipScopeVersion } : {}),
            ...(peopleScopeVersion !== undefined ? { peopleScopeVersion } : {}),
            ...(afterRevision !== undefined ? { afterRevision, issuedAt } : {}),
        }
    )
    if (!value) return error("insufficient_scope", 403)
    if (value.resetRequired) return error("reset_required", 410)
    revisionOrder(value.revision)
    const items = integrationChangeSchema.array().parse(value.items)
    if (
        items.some(
            (item) =>
                item.guildId !== auth.guildId ||
                item.gameId !== input.gameId ||
                !input.resources.includes(item.resource) ||
                (item.resource === "membership-summaries" &&
                    item.id !== input.discordUserId)
        )
    )
        throw new Error("Invalid integration response scope.")
    const body = Buffer.from(
        JSON.stringify({
            revision: value.revision,
            issuedAt: Date.now(),
            ...(value.membershipScopeVersion
                ? { membershipScopeVersion: value.membershipScopeVersion }
                : {}),
            ...(value.peopleScopeVersion !== undefined
                ? { peopleScopeVersion: value.peopleScopeVersion }
                : {}),
        })
    ).toString("base64url")
    return NextResponse.json(
        {
            data: items,
            page: {
                nextCursor: `${body}.${sign(body).toString("base64url")}`,
                hasMore: value.hasMore === true,
                limit: input.limit,
            },
        },
        { headers }
    )
}
