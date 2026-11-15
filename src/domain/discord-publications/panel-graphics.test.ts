import {
    combinedPanelJoinRows,
    contentHash64,
    decideScoreImageRender,
    DEFAULT_CLAN_ACCENT,
    factionBars,
    hllLayerLighting,
    hllModeOf,
    hllNationForSide,
    hllNationsFor,
    hllScoreKind,
    isNewMap,
    minutesLeft,
    nextMapChange,
    NEW_MAP_BADGE_MS,
    PANEL_MAPS,
    panelImageFileName,
    panelImageInputHash,
    panelImageSlug,
    panelMapKey,
    panelServerState,
    planPanelAttachments,
    playerGauge,
    playerGaugeEmoji,
    resolvePanelAccent,
    resolvePanelBanner,
    resolvePanelMapImage,
    resolvePanelStyle,
    resolveScoreImageBackground,
    topPlayers,
} from "./panel-graphics"
import {
    HLL_NATIONS,
    PANEL_EMOJI,
    PANEL_EMOJI_GROUP_SIZE,
    panelEmojiName,
} from "./panel-emblems"
import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import test from "node:test"
import path from "node:path"

test("style A is the default; the clan default and the panel's own style override it in order", () => {
    assert.equal(resolvePanelStyle(null), "a")
    assert.equal(resolvePanelStyle({ presentation: null }, null), "a")
    assert.equal(resolvePanelStyle({}, "b"), "b")
    assert.equal(resolvePanelStyle({ presentation: { style: null } }, "c"), "c")
    assert.equal(resolvePanelStyle({ presentation: { style: "c" } }, "b"), "c")
})

test("provider map names and layer IDs resolve to catalogue keys", () => {
    assert.equal(panelMapKey("hell_let_loose", "Foy"), "foy")
    assert.equal(panelMapKey("hell_let_loose", "foy_warfare"), "foy")
    assert.equal(
        panelMapKey("hell_let_loose", "PHL_L_1944_Warfare"),
        "purple-heart-lane"
    )
    assert.equal(panelMapKey("hell_let_loose", "Hürtgenwald"), "hurtgen-forest")
    assert.equal(
        panelMapKey("hell_let_loose", "Sainte-Mère-Église"),
        "st-mere-eglise"
    )
    assert.equal(
        panelMapKey("hell_let_loose", "SMDM_S_1944_Day_P_Skirmish"),
        "st-marie-du-mont"
    )
    assert.equal(
        panelMapKey("hell_let_loose", "elsenbornridge_warfare_morning"),
        "elsenborn-ridge"
    )
    assert.equal(panelMapKey("hell_let_loose", "Smolensk"), "smolensk")
    assert.equal(panelMapKey("wardogs", "Zestafona"), "zestafona")
    assert.equal(panelMapKey("wardogs", "sabatulo_koth_day"), "sabatulo")
    // Unknown, foreign-game and path-like values never resolve.
    assert.equal(panelMapKey("wardogs", "Foy"), null)
    assert.equal(panelMapKey("hell_let_loose", "Nowhere"), null)
    assert.equal(panelMapKey("hell_let_loose", "../foy"), null)
    assert.equal(panelMapKey("hell_let_loose", ""), null)
    assert.equal(panelMapKey("hell_let_loose", null), null)
})

test("catalogue maps resolve packaged art or explicitly await it; HLL maps name their nations", () => {
    const root = path.resolve(import.meta.dirname, "../../../public")
    for (const map of PANEL_MAPS) {
        if (map.key === "sabatulo") {
            assert.equal(map.builtIn, null)
            continue
        }
        assert.ok(map.builtIn, map.key)
        assert.ok(existsSync(path.join(root, map.builtIn)), map.builtIn)
        assert.equal(Boolean(map.nations), map.game === "hell_let_loose")
    }
    assert.deepEqual(hllNationsFor("kursk"), { allies: "sov", axis: "ger" })
    assert.deepEqual(hllNationsFor("el-alamein"), { allies: "gb", axis: "dak" })
    assert.deepEqual(hllNationsFor("juno-beach"), { allies: "cw", axis: "ger" })
    assert.deepEqual(hllNationsFor("foy"), { allies: "us", axis: "ger" })
    // Unknown map: generic side signs.
    assert.deepEqual(hllNationsFor(null), { allies: "allies", axis: "axis" })
    assert.equal(hllNationForSide("allies", { allies: "ger" }), "allies")
    assert.equal(hllNationForSide("axis", { axis: "dak" }), "dak")
})

test("lighting and mode are read only when the server says so", () => {
    assert.equal(hllLayerLighting("carentan_warfare_night"), "night")
    assert.equal(hllLayerLighting("SME_S_1944_Day_P_Skirmish"), "day")
    assert.equal(hllLayerLighting("foy_warfare"), null)
    assert.equal(hllLayerLighting(null), null)
    assert.equal(hllModeOf("PHL_L_1944_Warfare"), "warfare")
    assert.equal(hllModeOf("Offensive"), "offensive")
    assert.equal(hllModeOf(null), null)
})

test("map art prefers the clan override, then Logi's image, then none", () => {
    const overrides = [
        {
            game: "hell_let_loose" as const,
            mapKey: "carentan",
            publicId: "a".repeat(32),
            url: "https://logi.test/api/image-assets/a.webp",
        },
    ]
    assert.deepEqual(
        resolvePanelMapImage({
            game: "hell_let_loose",
            mapKey: "carentan",
            overrides,
        }),
        {
            kind: "override",
            game: "hell_let_loose",
            mapKey: "carentan",
            publicId: "a".repeat(32),
            url: overrides[0].url,
        }
    )
    assert.deepEqual(
        resolvePanelMapImage({
            game: "hell_let_loose",
            mapKey: "foy",
            overrides,
        }),
        {
            kind: "builtin",
            game: "hell_let_loose",
            mapKey: "foy",
            path: "/maps/foy.webp",
        }
    )
    assert.equal(
        resolvePanelMapImage({
            game: "hell_let_loose",
            mapKey: null,
            overrides,
        }),
        null
    )
    // An override for another game's map is ignored.
    assert.equal(
        resolvePanelMapImage({
            game: "wardogs",
            mapKey: "carentan",
            overrides,
        }),
        null
    )
})

test("banners fall back from the panel to the server to the current map image", () => {
    const map = {
        kind: "builtin" as const,
        game: "hell_let_loose" as const,
        mapKey: "kursk",
        path: "/maps/kursk.webp",
    }
    const server = {
        publicId: "b".repeat(32),
        url: "https://logi.test/banner.webp",
        crop: "top" as const,
        useMapImage: true,
    }
    assert.equal(
        resolvePanelBanner({
            panelBannerUrl: "https://p",
            server,
            mapImage: map,
        })?.kind,
        "banner"
    )
    assert.deepEqual(
        resolvePanelBanner({ panelBannerUrl: null, server, mapImage: map }),
        {
            kind: "banner",
            origin: "server",
            url: server.url,
            publicId: server.publicId,
            crop: "top",
        }
    )
    const noBanner = { ...server, publicId: null, url: null }
    assert.deepEqual(
        resolvePanelBanner({
            panelBannerUrl: null,
            server: noBanner,
            mapImage: map,
        }),
        { kind: "map", image: map }
    )
    assert.equal(
        resolvePanelBanner({
            panelBannerUrl: null,
            server: { ...noBanner, useMapImage: false },
            mapImage: map,
        }),
        null
    )
    // No settings at all: the switch defaults to on.
    assert.equal(
        resolvePanelBanner({
            panelBannerUrl: null,
            server: null,
            mapImage: map,
        })?.kind,
        "map"
    )
    assert.deepEqual(resolveScoreImageBackground({ server, mapImage: map }), {
        kind: "asset",
        publicId: server.publicId,
        crop: "top",
    })
    assert.deepEqual(
        resolveScoreImageBackground({ server: noBanner, mapImage: map }),
        { kind: "builtin", game: "hell_let_loose", mapKey: "kursk" }
    )
    assert.equal(
        resolveScoreImageBackground({ server: null, mapImage: null }),
        null
    )
})

test("the bar colour is the panel colour, then the server colour in style B, then the clan colour", () => {
    const base = {
        panelAccent: null,
        serverBarColor: "#2BB3A3",
        clanAccent: null,
    }
    assert.equal(resolvePanelAccent({ ...base, style: "b" }), "#2bb3a3")
    assert.equal(
        resolvePanelAccent({ ...base, style: "a" }),
        DEFAULT_CLAN_ACCENT
    )
    assert.equal(
        resolvePanelAccent({ ...base, style: "a", clanAccent: "#112233" }),
        "#112233"
    )
    assert.equal(
        resolvePanelAccent({ ...base, style: "b", panelAccent: "#7C8CF0" }),
        "#7c8cf0"
    )
    assert.equal(
        resolvePanelAccent({ ...base, style: "c", panelAccent: "red" }),
        DEFAULT_CLAN_ACCENT
    )
})

test("server state: offline, seeding, empty, live", () => {
    assert.equal(panelServerState({ reachable: false, players: 50 }), "offline")
    assert.equal(
        panelServerState({ reachable: true, players: 9, seedActive: true }),
        "seeding"
    )
    assert.equal(panelServerState({ reachable: true, players: 0 }), "empty")
    assert.equal(panelServerState({ reachable: true, players: null }), "empty")
    assert.equal(panelServerState({ reachable: true, players: 78 }), "live")
})

test("the player gauge has ten capacity pieces and the queue after a gap", () => {
    const board = playerGauge({ players: 78, capacity: 100, queue: 3 })!
    assert.deepEqual(board.segments, [
        ...Array(8).fill("players"),
        ...Array(2).fill("free"),
    ])
    assert.equal(board.queue, 1)
    assert.equal(
        playerGauge({ players: 9, capacity: 98 })!.segments.filter(
            (s) => s === "players"
        ).length,
        1
    )
    assert.equal(
        playerGauge({ players: 17, capacity: 98 })!.segments.filter(
            (s) => s === "players"
        ).length,
        2
    )
    // One player still shows a piece; an almost full server never looks full.
    assert.equal(
        playerGauge({ players: 1, capacity: 100 })!.segments[0],
        "players"
    )
    assert.equal(
        playerGauge({ players: 99, capacity: 100 })!.segments[9],
        "free"
    )
    assert.equal(
        playerGauge({ players: 100, capacity: 100 })!.segments[9],
        "players"
    )
    assert.equal(
        playerGauge({ players: 0, capacity: 100 })!.segments[0],
        "free"
    )
    assert.equal(
        playerGauge({ players: 5, capacity: 100, queue: null })!.queue,
        0
    )
    assert.equal(playerGauge({ players: 5, capacity: 0 }), null)
    assert.equal(playerGauge({ players: -1, capacity: 100 }), null)
    assert.equal(
        playerGaugeEmoji(board, { players: "P", free: "F", queue: "Q" }),
        "PPPPPPPPFF Q"
    )
    assert.equal(
        playerGaugeEmoji(playerGauge({ players: 9, capacity: 98 })!, {}),
        "🟩⬛⬛⬛⬛⬛⬛⬛⬛⬛"
    )
})

test("time left, leaders, sector score and faction bars", () => {
    assert.equal(minutesLeft(47 * 60), 47)
    assert.equal(minutesLeft(46 * 60 + 1), 47)
    assert.equal(minutesLeft(5), 1)
    assert.equal(minutesLeft(null), null)
    assert.deepEqual(
        topPlayers([
            { name: "Bizon", value: 27 },
            { name: "Rex_CZ", value: 31 },
            { name: "Anna", value: 27 },
            { name: "None", value: null },
            { name: "Hans_88", value: 28 },
        ]).map((p) => p.name),
        ["Rex_CZ", "Hans_88", "Anna"]
    )
    assert.equal(
        hllScoreKind({ mode: "warfare", allies: 3, axis: 2 }),
        "sectors"
    )
    assert.equal(hllScoreKind({ mode: null, allies: 3, axis: 2 }), "sectors")
    assert.equal(
        hllScoreKind({ mode: "offensive", allies: 3, axis: 2 }),
        "score"
    )
    assert.equal(
        hllScoreKind({ mode: "warfare", allies: 120, axis: 80 }),
        "score"
    )
    assert.deepEqual(
        factionBars([
            { faction: "valkyra", points: 23 },
            { faction: "manticore", points: 12 },
            { faction: "lonestar", points: 7 },
        ]).map((f) => [f.faction, f.percent, f.leading]),
        [
            ["valkyra", 100, true],
            ["manticore", 52, false],
            ["lonestar", 30, false],
        ]
    )
    assert.deepEqual(
        factionBars([
            { faction: "a", points: 5 },
            { faction: "b", points: 5 },
        ]).map((f) => f.leading),
        [true, true]
    )
    assert.deepEqual(
        factionBars([{ faction: "a", points: 0 }]).map((f) => [
            f.percent,
            f.leading,
        ]),
        [[0, false]]
    )
})

test("a map change shows the new-map badge for five minutes", () => {
    let state = nextMapChange(null, "foy", 1000)
    assert.equal(isNewMap(state, 1000), false)
    state = nextMapChange(state, "foy", 2000)
    assert.equal(state.changedAt, null)
    state = nextMapChange(state, "carentan", 10_000)
    assert.equal(isNewMap(state, 10_000), true)
    assert.equal(isNewMap(state, 10_000 + NEW_MAP_BADGE_MS - 1), true)
    assert.equal(isNewMap(state, 10_000 + NEW_MAP_BADGE_MS), false)
    // An unknown map in between is not a change to celebrate.
    const unknown = nextMapChange({ mapKey: null, changedAt: null }, "kursk", 5)
    assert.equal(isNewMap(unknown, 5), false)
})

test("the score image is redrawn only when content changed and at most once per 60 s", () => {
    const a = panelImageInputHash({ map: "foy", renderedAt: "x" })
    assert.equal(a, panelImageInputHash({ renderedAt: "y", map: "foy" }))
    assert.notEqual(a, panelImageInputHash({ map: "kursk", renderedAt: "x" }))
    assert.equal(
        panelImageInputHash({ a: { y: 1, x: 2 } }),
        panelImageInputHash({ a: { x: 2, y: 1 } })
    )
    assert.match(contentHash64("x"), /^[0-9a-f]{16}$/)
    assert.deepEqual(
        decideScoreImageRender({ previous: null, hash: a, now: 0 }),
        { action: "render" }
    )
    const previous = { hash: a, renderedAt: 100_000 }
    assert.deepEqual(
        decideScoreImageRender({ previous, hash: a, now: 999_999 }),
        { action: "reuse", reason: "unchanged" }
    )
    assert.deepEqual(
        decideScoreImageRender({ previous, hash: "other", now: 159_999 }),
        { action: "reuse", reason: "throttled" }
    )
    assert.deepEqual(
        decideScoreImageRender({ previous, hash: "other", now: 160_000 }),
        { action: "render" }
    )
})

test("every image version has its own file name", () => {
    assert.equal(panelImageSlug("Vlci #1 · Public"), "vlci1")
    assert.equal(panelImageSlug("Vlci WD"), "vlciwd")
    assert.equal(panelImageSlug("· ·"), "server")
    const at = Date.parse("2026-10-05T18:41:12Z")
    assert.equal(
        panelImageFileName({
            kind: "skore",
            serverName: "Vlci #1 · Public",
            at,
            timeZone: "Europe/Prague",
            hash: "3FA9C2D1",
            extension: "png",
        }),
        "skore-vlci1-2041-3fa9c2.png"
    )
    assert.notEqual(
        panelImageFileName({
            kind: "skore",
            serverName: "Vlci #1",
            at,
            timeZone: "UTC",
            hash: "aaaaaa",
            extension: "png",
        }),
        panelImageFileName({
            kind: "skore",
            serverName: "Vlci #1",
            at,
            timeZone: "UTC",
            hash: "bbbbbb",
            extension: "png",
        })
    )
})

test("at most ten attachments, score image first and duplicates once", () => {
    const thumbs = Array.from({ length: 11 }, (_, i) => ({
        name: `mapa-${i}.webp`,
        role: "thumbnail" as const,
    }))
    const plan = planPanelAttachments([
        ...thumbs,
        { name: "banner.webp", role: "banner" },
        { name: "skore.png", role: "score" },
        { name: "mapa-0.webp", role: "thumbnail" },
    ])
    assert.equal(plan.attached.length, 10)
    assert.deepEqual(
        plan.attached.slice(0, 3).map((a) => a.name),
        ["skore.png", "banner.webp", "mapa-0.webp"]
    )
    assert.deepEqual(
        plan.dropped.map((a) => a.name),
        ["mapa-8.webp", "mapa-9.webp", "mapa-10.webp"]
    )
})

test("the fixed set is 12 faction signs and 7 status and gauge pieces with valid names", () => {
    assert.deepEqual(PANEL_EMOJI_GROUP_SIZE, { faction: 12, status: 7 })
    assert.equal(new Set(PANEL_EMOJI.map((e) => e.key)).size, 19)
    assert.equal(HLL_NATIONS.length, 8)
    for (const emoji of PANEL_EMOJI) {
        const name = panelEmojiName(emoji.key, "0123456789abcdef")
        assert.match(name, /^logi_[a-z_]+_01234567$/)
        assert.ok(name.length <= 32)
        if (emoji.source.kind === "svg")
            assert.match(emoji.source.svg, /^<svg [^>]*viewBox="0 0 24 24"/)
    }
    // Existing Wardogs emoji keep their names, so nothing is uploaded twice.
    assert.equal(
        panelEmojiName("valkyra", "abcdef12ffff"),
        "logi_valkyra_abcdef12"
    )
})

test("combined panel join buttons go five to a row at the bottom", () => {
    assert.deepEqual(combinedPanelJoinRows(["a", "b", "c"]), [["a", "b", "c"]])
    assert.deepEqual(
        combinedPanelJoinRows(["1", "2", "3", "4", "5", "6"]).map(
            (r) => r.length
        ),
        [5, 1]
    )
    assert.deepEqual(combinedPanelJoinRows([]), [])
})
