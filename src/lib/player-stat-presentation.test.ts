import { playerMetricLabels } from "./player-stat-presentation"
import { getDictionary } from "@/i18n/dictionaries"
import assert from "node:assert/strict"
import test from "node:test"

test("money labels and explanations exist in every supported language", () => {
    for (const [locale, label] of [
        ["en", "Money"],
        ["cs", "Peníze"],
        ["de", "Geld"],
    ] as const) {
        const dictionary = getDictionary(locale)
        assert.equal(playerMetricLabels(dictionary).cashDelta, label)
        assert.ok(dictionary.gameHistory.cashHelp.length)
        assert.ok(dictionary.publicProfiles.kdChartHint.length)
    }
})
