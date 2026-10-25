import assert from "node:assert/strict"
import test from "node:test"

import { z } from "zod"

import { defineClanSettingsSlice } from "@/domain/api/settings-slices"

import {
    clanSettingsOpenApiPath,
    clanSettingsOpenApiSchemas,
} from "./settings-openapi"

const seedSlice = defineClanSettingsSlice({
    key: "seed",
    description: "Seed plan.",
    schema: z.object({ liveFrom: z.number().int() }),
    patchSchema: z.object({ liveFrom: z.number().int().min(1) }).partial(),
    read: () => ({ liveFrom: 40 }),
    toPatch: (patch) => ({ seedLiveFrom: patch.liveFrom }),
})

test("a registered slice is documented in the PATCH body and the GET data", () => {
    const schemas = clanSettingsOpenApiSchemas([seedSlice]) as Record<
        string,
        {
            properties?: Record<string, unknown>
            required?: string[]
            description?: string
        }
    >
    assert.ok(schemas.ClanSettingsSeedSlice)
    assert.ok(schemas.ClanSettingsSeedPatch)
    assert.equal(schemas.ClanSettingsSeedSlice!.description, "Seed plan.")
    assert.deepEqual(schemas.ClanSettingsPatch!.properties!.seed, {
        $ref: "#/components/schemas/ClanSettingsSeedPatch",
    })
    const slices = schemas.ClanSettings!.properties!.slices as {
        properties: Record<string, unknown>
        required: string[]
    }
    assert.deepEqual(slices.properties.seed, {
        $ref: "#/components/schemas/ClanSettingsSeedSlice",
    })
    assert.deepEqual(slices.required, ["seed"])
})

test("the plain settings fields stay documented without any slice", () => {
    const schemas = clanSettingsOpenApiSchemas([]) as Record<
        string,
        { properties: Record<string, unknown> }
    >
    assert.deepEqual(Object.keys(schemas.ClanSettingsPatch!.properties), [
        "name",
        "avatar",
        "description",
        "timezone",
        "defaultLanguage",
        "announcementsChannelId",
        "eventInfoChannelId",
        "eventResultsChannelId",
        "errorsChannelId",
        "calendarChannelId",
        "forumCategoryId",
        "meetingChannelId",
        "clanRoleId",
        "dashboardAdminRoleId",
    ])
})

test("GET and PATCH share the settings response and PATCH requires a body", () => {
    const path = clanSettingsOpenApiPath({
        responses: { "200": { description: "ok", headers: { a: 1 } } },
        idempotencyParameter: { name: "Idempotency-Key" },
    })
    assert.deepEqual(path.patch.requestBody.content["application/json"], {
        schema: { $ref: "#/components/schemas/ClanSettingsPatch" },
    })
    assert.equal(path.get.responses["200"], path.patch.responses["200"])
    assert.deepEqual(
        JSON.parse(JSON.stringify(path.get.responses["200"])).headers,
        { a: 1 },
        "rate-limit headers are kept"
    )
    assert.deepEqual(path.patch.parameters, [{ name: "Idempotency-Key" }])
})
