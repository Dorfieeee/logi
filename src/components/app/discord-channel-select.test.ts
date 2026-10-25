import { DiscordChannelSelect, channelOptions } from "./discord-channel-select"
import { renderToStaticMarkup } from "react-dom/server"
import { NextIntlClientProvider } from "next-intl"
import { enMessages } from "@/i18n/messages/en"
import assert from "node:assert/strict"
import { createElement } from "react"
import test from "node:test"

const channels = [
    { id: "100", name: "announcements", type: 5 },
    { id: "101", name: "general", type: 0 },
    { id: "102", name: "voice", type: 2 },
    { id: "103", name: "category", type: 4 },
]

function render(props: Parameters<typeof DiscordChannelSelect>[0]) {
    return renderToStaticMarkup(
        createElement(NextIntlClientProvider, {
            locale: "en",
            messages: enMessages,
            timeZone: "UTC",
            children: createElement(DiscordChannelSelect, props),
        })
    )
}

test("single selection retains a missing saved channel by ID", () => {
    const html = render({
        channels,
        value: "999",
        placeholder: "Destination",
        onChange: () => {},
    })
    assert.match(html, /999 · check access/)
    assert.match(html, /role="combobox"/)
    assert.match(html, /aria-label="Destination"/)
})

test("multiple selection shows both named channels and missing saved IDs", () => {
    const html = render({
        multiple: true,
        channels,
        value: ["101", "999"],
        placeholder: "Allowed channels",
        onChange: () => {},
    })
    assert.match(html, /# general, 999 · check access/)
})

test("loading disables the shared select", () => {
    assert.match(
        render({
            channels,
            loading: true,
            placeholder: "Destination",
            onChange: () => {},
        }),
        /disabled=""/
    )
})

test("channel choices preserve each field's purpose and channel kind", () => {
    assert.deepEqual(
        channelOptions(channels, "category").map((channel) => channel.id),
        ["103"]
    )
    assert.deepEqual(
        channelOptions(channels, "voice").map((channel) => channel.id),
        ["102"]
    )
    assert.deepEqual(
        channelOptions(channels, "text", "private-thread").map(
            (channel) => channel.id
        ),
        ["101"]
    )
})
