import { renderToStaticMarkup } from "react-dom/server"
import assert from "node:assert/strict"
import { createElement } from "react"
import test from "node:test"

import { getDictionary } from "@/i18n/dictionaries"
import { ApiKeyManager } from "./api-key-manager"

for (const [locale, readOnly, createLabel] of [
    ["en", "Read-only", "Create read-only key"],
    ["cs", "Pouze pro čtení", "Vytvořit klíč pro čtení"],
    ["de", "Nur lesen", "Leseschlüssel erstellen"],
] as const) {
    test(`API key form starts with localized read-only access by area in ${locale}`, () => {
        const props = {
            serverId: "fixture-server",
            dictionary: getDictionary(locale),
        }
        const markup = renderToStaticMarkup(createElement(ApiKeyManager, props))
        assert.ok(markup.includes(readOnly))
        assert.ok(markup.includes(createLabel))
        assert.match(markup, /<button[^>]*disabled=""/)
        const checked =
            markup.match(/<button[^>]*aria-checked="true"[^>]*>/g) ?? []
        assert.equal(
            checked.length,
            1,
            "only the matches area is selected; games require an explicit choice"
        )
        assert.ok(checked[0]?.includes("-matches"))
        // Areas replace one box per resource (design G5).
        assert.equal(
            (markup.match(/role="checkbox"/g) ?? []).length,
            7 + 3,
            "seven areas and three games"
        )
        assert.doesNotMatch(markup, /A key can read your clan’s website data/)
    })
}
