import { renderToStaticMarkup } from "react-dom/server"
import assert from "node:assert/strict"
import { createElement } from "react"
import test from "node:test"

import { panelMapTiles } from "@/domain/discord-publications/panel-graphics-settings"
import type { PanelGraphicsPageData } from "@/lib/panel-graphics-view"
import { getDictionary } from "@/i18n/dictionaries"
import { enMessages } from "@/i18n/messages/en"
import { deMessages } from "@/i18n/messages/de"
import { csMessages } from "@/i18n/messages/cs"

import {
    bannerCard,
    cropPosition,
    fill,
    formatKilobytes,
    isBarColorDraft,
    knownFiles,
} from "./panel-graphics-state"
import { PanelGraphicsSettingsView } from "./panel-graphics-settings"

const file = (name: string, bytes: number) => ({
    assetId: `imageAssets:${name}`,
    url: `https://logi.test/api/image-assets/${name}.webp`,
    width: 1200,
    height: 400,
    bytes,
})
/** The P8 board's three servers. */
const data: PanelGraphicsPageData = {
    revision: 3,
    settings: {
        defaultStyle: "a",
        servers: [
            {
                connectionId: "c1",
                bannerAssetId: "imageAssets:public",
                crop: "center",
                useMapImage: true,
                barColor: "#2bb3a3",
            },
            {
                connectionId: "c3",
                bannerAssetId: "imageAssets:wd",
                crop: "top",
                useMapImage: true,
                barColor: "#7c8cf0",
            },
        ],
        maps: [
            {
                game: "hell_let_loose",
                mapKey: "carentan",
                assetId: "imageAssets:carentan",
            },
        ],
    },
    clanAccent: "#e8a33d",
    clanName: "Vlci",
    clanTag: "VLC",
    servers: [
        {
            id: "c1",
            gameId: "hell_let_loose",
            name: "Vlci #1 · Public",
            currentMap: { key: "foy", name: "Foy" },
            banner: file("public", 389_120),
        },
        {
            id: "c2",
            gameId: "hell_let_loose",
            name: "Vlci #2 · Trénink a zápasy",
            currentMap: { key: "kursk", name: "Kursk" },
            banner: null,
        },
        {
            id: "c3",
            gameId: "wardogs",
            name: "Vlci WD",
            currentMap: null,
            banner: file("wd", 245_760),
        },
    ],
    maps: [
        {
            game: "hell_let_loose",
            mapKey: "carentan",
            image: { ...file("carentan", 36_000), width: 800, height: 800 },
        },
    ],
    emoji: {
        faction: { ready: 12, total: 12, complete: true },
        status: { ready: 5, total: 7, complete: false },
        checkedAt: 1,
    },
    mapTiles: panelMapTiles([
        {
            game: "hell_let_loose",
            mapKey: "carentan",
            url: "https://logi.test/api/image-assets/carentan.webp",
        },
    ]),
}

function render(locale: "cs" | "en" | "de" | "pl" = "cs") {
    return renderToStaticMarkup(
        createElement(PanelGraphicsSettingsView, {
            serverId: "s1",
            locale,
            data,
            editorHref: "/cs/dashboard/servers/s1/settings/messages",
            gameServersHref: "/cs/dashboard/servers/s1/settings/game-servers",
            dictionary: getDictionary(locale),
            refresh: () => undefined,
        })
    )
}
const text = (html: string) =>
    html
        .replace(/<[^>]+>/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&#x27;/g, "'")
        .replace(/\s+/g, " ")

test("the page shows every P8 section with the board's Czech copy", () => {
    const html = render()
    const page = text(html)
    for (const copy of [
        "Styl panelu",
        "Jak vypadají panely serverů v Discordu. Platí pro všechny panely, které nemají vlastní styl.",
        "Výchozí styl",
        "Styl A · Obrázek",
        "Bot vykreslí obrázek skóre a nahraje ho znovu nejvýš jednou za 60 s.",
        "Styl B · Banner a miniatura",
        "Banner serveru nahoře, miniatura mapy vpravo, znaky a ukazatel hráčů.",
        "Styl C · Kompaktní",
        "Jen text se znaky a ukazatelem. Nejkratší zpráva.",
        "Jiný styl pro jeden panel nastavíte v editoru panelu",
        "Bannery serverů",
        "Obrázek nahoře v panelu ve stylu B a pozadí obrázku skóre ve stylu A. Jeden na server.",
        "Vlastní banner",
        "Obrázek mapy",
        "Nahrát banner",
        "Odebrat",
        "PNG, JPG nebo WebP · poměr 3 : 1, třeba 1200 × 400 · nejvýš 2 MB.",
        "Bez banneru: ukáže se obrázek aktuální mapy, teď Kursk.",
        "Výřez",
        "Nahoře",
        "Střed",
        "Dole",
        "Použít obrázek mapy, když banner chybí",
        "Barva lišty",
        "Barva klanu",
        "barva klanu",
        "Obrázky map",
        "1 vlastní",
        "Hledat mapu",
        "Vše",
        "Výchozí Logi",
        "Vlastní",
        "Nahradit vlastním",
        "Obnovit výchozí",
        "Zobrazeno 24 z 24 map · vlastní obrázek: PNG, JPG nebo WebP, čtverec aspoň 160 × 160, nejvýš 2 MB.",
        "Ikony frakcí",
        "Nahráno do Discordu ✓ · 12 emoji",
        "Hell Let Loose · národy",
        "vlastní ikony Logi",
        "Velká Británie",
        "Sovětský svaz",
        "Commonwealth",
        "Afrikakorps",
        "když server národ neuvede",
        "Wardogs · frakce",
        "ikony Wardogs, licence MIT",
        "na tmavém pozadí, jak je uvidíte v Discordu",
        "znak hry",
        "Znaky národů HLL jsou naše jednoduché ikony, ne grafika ze hry.",
        "Stavové ikony a ukazatel hráčů",
        "Také pevné; bot je nahraje spolu s ikonami frakcí. Vedle ikony je vždy slovo.",
        "Nahráno do Discordu 5 z 7 emoji",
        "pod 40 hráči, běží seed",
        "server neodpovídá",
        "jeden dílek = desetina kapacity",
        "za mezerou",
        "Volné místo",
        "Ukázka v panelu",
        "78 / 100 · fronta 3",
        "12 / 100 · seed do 40",
        "bannery a styl se projeví při dalším obnovení panelů, nejpozději do 60 s",
        "Zahodit",
        "Uložit",
    ])
        assert.ok(page.includes(copy), copy)
    // Logi's default (style A) carries the chip and is the clan's choice here.
    assert.match(
        html,
        /role="radio" aria-checked="true"[^>]*>.*?Styl A · Obrázek/
    )
    assert.ok(
        html.includes('href="/cs/dashboard/servers/s1/settings/messages"')
    )
    // The uploaded banner's size is shown; the clan's own colours are kept.
    assert.ok(page.includes("1200 × 400 · 380 kB"))
    assert.ok(html.includes('value="#2BB3A3"'))
    assert.ok(html.includes("border-left-color:#e8a33d"))
})

test("every locale renders the page", () => {
    const en = text(render("en"))
    assert.ok(en.includes("Style A · Image"))
    assert.ok(en.includes("Server banners"))
    assert.ok(en.includes("78 / 100 · queue 3"))
    const de = text(render("de"))
    assert.ok(de.includes("Kartenbilder"))
    assert.ok(de.includes("12 / 100 · Seed bis 40"))
})

test("the page copy has the same keys in cs, en and de", () => {
    const keys = (value: unknown, prefix = ""): string[] =>
        value && typeof value === "object"
            ? Object.entries(value).flatMap(([key, child]) =>
                  keys(child, `${prefix}${key}.`)
              )
            : [prefix]
    const cs = keys(csMessages.panelGraphicsPage).sort()
    assert.deepEqual(keys(enMessages.panelGraphicsPage).sort(), cs)
    assert.deepEqual(keys(deMessages.panelGraphicsPage).sort(), cs)
    for (const messages of [csMessages, enMessages, deMessages]) {
        assert.ok(messages.settingsHub.sections["panel-graphics"].title)
        assert.ok(messages.settingsHub.overview.tiles["panel-graphics"].title)
    }
    assert.equal(
        csMessages.settingsHub.sections["panel-graphics"].title,
        "Grafika panelů"
    )
})

test("banner cards follow the bot's rules: own banner, then the current map image", () => {
    const files = knownFiles(data)
    assert.deepEqual(
        bannerCard({
            connectionId: "c1",
            gameId: "hell_let_loose",
            currentMapKey: "foy",
            draft: data.settings,
            files,
        }),
        {
            chip: "custom",
            preview: {
                kind: "asset",
                url: "https://logi.test/api/image-assets/public.webp",
                crop: "center",
            },
        }
    )
    assert.deepEqual(
        bannerCard({
            connectionId: "c2",
            gameId: "hell_let_loose",
            currentMapKey: "kursk",
            draft: data.settings,
            files,
        }),
        {
            chip: "map",
            preview: {
                kind: "builtin",
                path: "/maps/kursk.webp",
                crop: "center",
            },
        }
    )
    // The clan's own Carentan image replaces Logi's.
    assert.equal(
        bannerCard({
            connectionId: "c2",
            gameId: "hell_let_loose",
            currentMapKey: "carentan",
            draft: data.settings,
            files,
        }).preview?.kind,
        "override"
    )
    const off = {
        ...data.settings,
        servers: [
            ...data.settings.servers,
            {
                connectionId: "c2",
                bannerAssetId: null,
                crop: "center" as const,
                useMapImage: false,
                barColor: null,
            },
        ],
    }
    assert.deepEqual(
        bannerCard({
            connectionId: "c2",
            gameId: "hell_let_loose",
            currentMapKey: "kursk",
            draft: off,
            files,
        }),
        { chip: "none", preview: null }
    )
})

test("small helpers", () => {
    assert.equal(cropPosition("top"), "center top")
    assert.equal(cropPosition("center"), "center")
    assert.equal(cropPosition("bottom"), "center bottom")
    assert.equal(fill("{a} / {b} {c}", { a: 1, b: "x" }), "1 / x {c}")
    assert.equal(formatKilobytes(389_120, "cs"), "380 kB")
    assert.equal(formatKilobytes(10, "en"), "1 kB")
    assert.equal(isBarColorDraft(""), true)
    assert.equal(isBarColorDraft(" #2BB3A3 "), true)
    assert.equal(isBarColorDraft("#2BB3A"), false)
    assert.equal(isBarColorDraft("teal"), false)
})
