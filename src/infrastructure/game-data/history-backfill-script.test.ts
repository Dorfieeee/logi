import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import assert from "node:assert/strict"
import test from "node:test"

test("backfill CLI requires an explicit target and a bounded page budget before contacting Convex", () => {
    const path = fileURLToPath(
        new URL("../../../scripts/backfill-hll-history.mjs", import.meta.url)
    )
    for (const args of [
        [],
        ["--apply"],
        [
            "--deployment-name",
            "synthetic",
            "--guild",
            "123",
            "--max-pages",
            "0",
        ],
        [
            "--deployment-name",
            "synthetic",
            "--guild",
            "123",
            "--max-pages",
            "10001",
        ],
        ["--deployment-name", "synthetic", "--guild", "123", "--push"],
        [
            "--deployment-name",
            "synthetic",
            "--self-hosted-url",
            "https://convex.example.test",
            "--target-env",
            "/secure/target.env",
            "--guild",
            "123",
        ],
        ["--self-hosted-url", "https://convex.example.test", "--guild", "123"],
    ]) {
        const run = spawnSync(process.execPath, [path, ...args], {
            encoding: "utf8",
            timeout: 5000,
        })
        assert.equal(run.status, 1)
        assert.match(run.stderr, /Usage:|Unknown or repeated argument/)
        assert.doesNotMatch(
            run.stderr,
            /authentication|Unable to fetch|ENOTFOUND/
        )
    }
})
