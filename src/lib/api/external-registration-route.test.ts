import { externalRegistrationPaths } from "./external-registration-openapi"
import { handleExternalRegistration } from "./external-registration-route"
import { ConvexError } from "convex/values"
import assert from "node:assert/strict"
import test from "node:test"

const body = {
    discordId: "111111111111111111",
    guildId: "222222222222222222",
    name: "Name",
    steamId: "76561198199051397",
    steamName: "Steam name",
}
const auth = { key: "key", guildId: body.guildId, headers: {} }
function request(value: unknown = body, key: string | null = "register-1") {
    return new Request("https://logi.test/api/v1/clan/users/register", {
        method: "POST",
        headers: key ? { "Idempotency-Key": key } : {},
        body: typeof value === "string" ? value : JSON.stringify(value),
    })
}

test("HTTP registration validates before writing and forwards defaults and a body hash", async () => {
    let calls = 0
    const dependencies = {
        authenticate: async () => auth,
        register: async (
            args: Parameters<
                Parameters<typeof handleExternalRegistration>[1]["register"]
            >[0]
        ) => {
            calls++
            assert.equal(args.input.gameId, "hell_let_loose")
            assert.equal(args.input.avatar, "")
            assert.equal(args.input.status, "active")
            assert.equal(args.bodyHash.length, 64)
            return { status: 201, body: '{"data":{}}' }
        },
    }
    for (const req of [
        request("{"),
        request(body, null),
        request({ ...body, discordId: 123 }),
        request({ ...body, steamId: "76561197960265728" }),
        request({ ...body, admin: true }),
    ])
        assert.equal(
            (await handleExternalRegistration(req, dependencies)).status,
            400
        )
    assert.equal(
        (
            await handleExternalRegistration(
                request({ ...body, guildId: "333333333333333333" }),
                dependencies
            )
        ).status,
        403
    )
    assert.equal(calls, 0)
    const response = await handleExternalRegistration(request(), dependencies)
    assert.equal(response.status, 201)
    assert.equal(response.headers.get("cache-control"), "no-store")
    assert.equal(calls, 1)
})

test("HTTP registration preserves auth denial and returns conflict or sanitized failure", async () => {
    const denied = await handleExternalRegistration(request(), {
        authenticate: async () => new Response(null, { status: 401 }),
        register: async () => {
            throw new Error("Must not write")
        },
    })
    assert.equal(denied.status, 401)
    for (const [cause, status] of [
        [
            new ConvexError({
                code: "registration_conflict",
                message: "Already linked",
            }),
            409,
        ],
        [new Error("private diagnostic"), 500],
    ] as const) {
        const response = await handleExternalRegistration(request(), {
            authenticate: async () => auth,
            register: async () => {
                throw cause
            },
        })
        assert.equal(response.status, status)
        assert.equal(
            (await response.text()).includes("private diagnostic"),
            false
        )
    }
})

test("OpenAPI documents the registration request, authorization and creation response", () => {
    const operation = externalRegistrationPaths["/clan/users/register"].post
    assert.deepEqual(operation.security, [{ clanApiKey: [] }])
    const schema = operation.requestBody.content["application/json"].schema
    assert.ok(schema.required?.includes("steamName"))
    assert.ok(operation.responses["201"])
    assert.ok(operation.responses["409"])
})
