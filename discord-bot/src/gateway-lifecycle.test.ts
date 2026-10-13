import { spawnSync } from "node:child_process"
import assert from "node:assert/strict"
import test from "node:test"
import path from "node:path"

// Exercises the installed SDK through its public API against a loopback gateway.
// A child process makes an unhandled socket error an observable test failure.
for (const loader of ["require", "import"]) {
    for (const scenario of ["cancel", "recover", "open"]) {
        test(
            `gateway ${loader}: ${scenario} closes owned sockets without a crash or duplicate reconnect`,
            {
                skip:
                    scenario !== "open" &&
                    Number(process.versions.node.split(".")[0]) >= 25
                        ? "ws/@discordjs/ws abort handling is incompatible with Node 25's socket error delivery"
                        : false,
            },
            () => {
                const result = spawnSync(
                    process.execPath,
                    [
                        path.resolve(
                            "discord-bot/test-fixtures/gateway-lifecycle.mjs"
                        ),
                        loader,
                        scenario,
                    ],
                    { encoding: "utf8", timeout: 12000, windowsHide: true }
                )
                assert.equal(result.error, undefined)
                assert.equal(result.status, 0, result.stderr || result.stdout)
                const proof = JSON.parse(result.stdout.trim())
                assert.equal(proof.connections, scenario === "recover" ? 2 : 1)
                assert.equal(proof.ready, scenario !== "cancel")
                assert.equal(proof.openSockets, 0)
            }
        )
    }
}
