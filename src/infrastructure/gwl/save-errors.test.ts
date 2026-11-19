import { gwlSaveErrorMessage } from "../../components/app/gwl-save-feedback"
import { invoke, testContext } from "../convex/testing/database"
import { gwlEventsSchema } from "../../domain/gwl/contracts"
import { save } from "../../../convex/leagueAutoImportJobs"
import { GwlError } from "../../domain/gwl/errors"
import fixtures from "./fixtures/fixtures.json"
import { gwlSaveFailure } from "./save-errors"
import { ConvexError } from "convex/values"
import assert from "node:assert/strict"
import { gwlGet } from "./client"
import test from "node:test"

test("permission failures identify the exact scope without echoing provider text or the key", async () => {
    const key = "gwl_live_private_example_never_return"
    let failure
    try {
        await gwlGet(key, "/team/events?limit=1", gwlEventsSchema, {
            fetcher: async () =>
                Response.json(
                    { error: { code: "missing_scope", message: key } },
                    { status: 403 }
                ),
        })
    } catch (error) {
        failure = gwlSaveFailure(error)
    }
    assert.deepEqual(failure, {
        ok: false,
        error: "missing_scope",
        scope: "events.read",
    })
    assert.ok(!JSON.stringify(failure).includes(key))
    for (const locale of ["en", "cs", "de", "fr", "pl"])
        assert.ok(gwlSaveErrorMessage(locale, failure!).includes("events.read"))
})
test("storage and unknown failures expose fixed actionable codes only", () => {
    assert.equal(
        gwlSaveFailure(new Error("Credential encryption is not configured."))
            .error,
        "encryption_unavailable"
    )
    assert.equal(
        gwlSaveFailure(new GwlError("wrong_key_type")).error,
        "wrong_key_type"
    )
    const secret = "sensitive-private-value"
    assert.deepEqual(gwlSaveFailure(new Error(secret)), {
        ok: false,
        error: "save_failed",
    })
    assert.ok(
        !gwlSaveErrorMessage("en", gwlSaveFailure(new Error(secret))).includes(
            secret
        )
    )
})
test("saving a live connection checks a real match number and returns no key material", async () => {
    const originalKeyring = process.env.LOGI_CREDENTIAL_KEYRING
    const originalFetch = globalThis.fetch
    process.env.LOGI_CREDENTIAL_KEYRING = JSON.stringify({
        current: "test",
        keys: { test: Buffer.alloc(32, 7).toString("base64") },
    })
    const key = "gwl_live_private_example_never_return"
    const paths: string[] = []
    const ctx = Object.assign(testContext(), {
        runQuery: async () => ({
            records: [],
            provider: "legacy",
            settings: null,
            testMode: false,
        }),
        runMutation: async (
            _ref: unknown,
            args: { credentialJson: string }
        ) => {
            assert.ok(!args.credentialJson.includes(key))
            return { ok: true }
        },
    })
    globalThis.fetch = async (input) => {
        const path = new URL(String(input)).pathname
        paths.push(path)
        if (path.endsWith("/team"))
            return Response.json({
                slug: "test-team",
                name: "Test Team",
                tag: "TEST",
            })
        if (path.endsWith("/fixtures")) return Response.json(fixtures)
        if (path.endsWith("/events"))
            return Response.json({ events: [], next: 0, hasMore: false })
        if (path.endsWith("/file"))
            return Response.json(
                { error: { code: "not_found" } },
                { status: 404 }
            )
        throw new Error("Unexpected route")
    }
    try {
        const result = await invoke(save, ctx, {
            secret: "test-secret",
            guildId: "guild",
            actor: {},
            apiKey: key,
            settingsJson: JSON.stringify({
                enabled: false,
                autoCreate: false,
                teamCode: "detected-from-key",
                templateId: "__defaults",
                registrationHoursBeforeStart: 168,
                announcementChannelId: "",
                eventInfoChannelId: "",
            }),
        })
        assert.deepEqual(result, { ok: true })
        assert.ok(
            paths.includes(
                `/api/v1/team/matches/${fixtures.recent[0].number}/file`
            )
        )
        assert.ok(!paths.some((path) => path.includes("/matches/0/")))
        assert.ok(!JSON.stringify(result).includes(key))
    } finally {
        globalThis.fetch = originalFetch
        if (originalKeyring === undefined)
            delete process.env.LOGI_CREDENTIAL_KEYRING
        else process.env.LOGI_CREDENTIAL_KEYRING = originalKeyring
    }
})

test("failed saves remain failures for older website deployments and expose only safe error data", async () => {
    const key = "gwl_live_private_example_never_return"
    const ctx = Object.assign(testContext(), {
        runQuery: async () => ({
            records: [],
            provider: "legacy",
            settings: null,
            testMode: false,
        }),
    })
    await assert.rejects(
        invoke(save, ctx, {
            secret: "test-secret",
            guildId: "guild",
            actor: {},
            apiKey: key,
            settingsJson: "{}",
        }),
        (error) =>
            error instanceof ConvexError &&
            error.data.error === "invalid_settings" &&
            !JSON.stringify(error.data).includes(key)
    )
})
