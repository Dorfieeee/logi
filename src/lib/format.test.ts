import assert from "node:assert/strict"
import { formatKd } from "./format"
import test from "node:test"

test("K/D always displays two decimals without changing the underlying ratio", () => {
    assert.equal(formatKd(2 / 28), "0.07")
    assert.equal(formatKd(0), "0.00")
    assert.equal(formatKd(1), "1.00")
    assert.equal(formatKd(1.2), "1.20")
    assert.equal(formatKd(10 / 3), "3.33")
    assert.equal(formatKd(1.2, "cs"), "1,20")
})
