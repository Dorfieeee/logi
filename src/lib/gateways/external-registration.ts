import type { ExternalRegistration } from "@/domain/users/external-registration.schema"
import { makeFunctionReference } from "convex/server"
import { getInternalAuthSecret } from "@/lib/env"
import { hashApiKey } from "@/lib/public-api"
import { fetchMutation } from "convex/nextjs"

const registerReference = makeFunctionReference<
    "mutation",
    {
        secret: string
        keyHash: string
        idempotencyKey: string
        bodyHash: string
        input: ExternalRegistration
    },
    { status: number; body: string } | null
>("externalRegistration:register")

export async function registerExternalClanUser(args: {
    key: string
    idempotencyKey: string
    bodyHash: string
    input: ExternalRegistration
}) {
    const { key, ...input } = args
    return fetchMutation(registerReference, {
        ...input,
        keyHash: hashApiKey(key),
        secret: getInternalAuthSecret(),
    })
}
