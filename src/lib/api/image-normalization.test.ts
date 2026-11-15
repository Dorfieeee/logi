import {
    IMAGE_OUTPUT,
    sniffImageType,
    validateImageSource,
} from "@/domain/assets/image-asset"
import { inspectImage, normalizeImage } from "./image-normalization"
import { crc32, deflateSync } from "node:zlib"
import assert from "node:assert/strict"
import test from "node:test"
import sharp from "sharp"

const solid = (width: number, height: number) =>
    sharp({
        create: {
            width,
            height,
            channels: 4,
            background: { r: 200, g: 40, b: 40, alpha: 1 },
        },
    })

const pngChunk = (type: string, data: Buffer) => {
    const length = Buffer.alloc(4)
    length.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type, "latin1"), data])
    const checksum = Buffer.alloc(4)
    checksum.writeUInt32BE(crc32(body))
    return Buffer.concat([length, body, checksum])
}
/** A valid two-frame 4x4 APNG; sharp cannot encode one, so it is built by chunk. */
function animatedPng() {
    const header = Buffer.alloc(13)
    header.writeUInt32BE(4, 0)
    header.writeUInt32BE(4, 4)
    header[8] = 8
    header[9] = 2
    const pixels = deflateSync(Buffer.alloc(4 * (1 + 4 * 3)))
    const control = Buffer.alloc(8)
    control.writeUInt32BE(2, 0)
    const frame = (sequence: number) => {
        const data = Buffer.alloc(26)
        data.writeUInt32BE(sequence, 0)
        data.writeUInt32BE(4, 4)
        data.writeUInt32BE(4, 8)
        data.writeUInt16BE(1, 20)
        data.writeUInt16BE(10, 22)
        return data
    }
    const sequence = Buffer.alloc(4)
    sequence.writeUInt32BE(2)
    return new Uint8Array(
        Buffer.concat([
            Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
            pngChunk("IHDR", header),
            pngChunk("acTL", control),
            pngChunk("fcTL", frame(0)),
            pngChunk("IDAT", pixels),
            pngChunk("fcTL", frame(1)),
            pngChunk("fdAT", Buffer.concat([sequence, pixels])),
            pngChunk("IEND", Buffer.alloc(0)),
        ])
    )
}

test("inspection reports decoder facts and rejects undecodable bytes", async () => {
    const png = new Uint8Array(await solid(1000, 600).png().toBuffer())
    const decoded = await inspectImage(png)
    assert.ok(decoded)
    assert.equal(decoded.width, 1000)
    assert.equal(decoded.height, 600)
    assert.equal(decoded.format, "png")
    assert.ok(decoded.pages === undefined || decoded.pages === 1)
    const webp = new Uint8Array(await solid(30, 20).webp().toBuffer())
    assert.equal((await inspectImage(webp))?.format, "webp")
    const jpeg = new Uint8Array(await solid(30, 20).jpeg().toBuffer())
    assert.equal((await inspectImage(jpeg))?.format, "jpeg")
    assert.equal(await inspectImage(Buffer.from("<svg/>")), null)
    assert.equal(
        validateImageSource({
            declaredType: "image/png",
            bytes: png.length,
            sniffed: sniffImageType(png),
            decoded,
        }),
        null
    )
    assert.equal(
        validateImageSource({
            declaredType: "image/jpeg",
            bytes: png.length,
            sniffed: sniffImageType(png),
            decoded,
        }),
        "type_mismatch"
    )
})

test("logos fit inside 512 squared as PNG without enlarging small sources", async () => {
    const png = new Uint8Array(await solid(1000, 600).png().toBuffer())
    const logo = await normalizeImage(png, "team-logo")
    assert.equal(logo.contentType, "image/png")
    assert.equal(sniffImageType(logo.bytes), "image/png")
    assert.ok(logo.width <= IMAGE_OUTPUT["team-logo"].width)
    assert.ok(logo.height <= IMAGE_OUTPUT["team-logo"].height)
    assert.equal(logo.width, 512)
    assert.match(logo.sha256, /^[a-f0-9]{64}$/)
    const output = await sharp(logo.bytes).metadata()
    assert.equal(output.width, logo.width)
    assert.equal(output.height, logo.height)
    const small = await normalizeImage(
        new Uint8Array(await solid(100, 80).jpeg().toBuffer()),
        "team-logo"
    )
    assert.equal(small.width, 100)
    assert.equal(small.height, 80)
    assert.equal(small.contentType, "image/png")
})

test("banners fit inside 1920x1080 as WebP and EXIF orientation is applied then dropped", async () => {
    const webp = new Uint8Array(await solid(2500, 1200).webp().toBuffer())
    const banner = await normalizeImage(webp, "panel-banner")
    assert.equal(banner.contentType, "image/webp")
    assert.equal(sniffImageType(banner.bytes), "image/webp")
    assert.ok(banner.width <= IMAGE_OUTPUT["panel-banner"].width)
    assert.ok(banner.height <= IMAGE_OUTPUT["panel-banner"].height)
    assert.equal(banner.width, 1920)
    const rotated = new Uint8Array(
        await solid(300, 100).jpeg().withMetadata({ orientation: 6 }).toBuffer()
    )
    assert.equal((await sharp(rotated).metadata()).orientation, 6)
    const upright = await normalizeImage(rotated, "team-logo")
    assert.equal(upright.width, 100)
    assert.equal(upright.height, 300)
    const metadata = await sharp(upright.bytes).metadata()
    assert.equal(metadata.orientation, undefined)
    assert.equal(metadata.exif, undefined)
})

test("animated sources report their frames and oversized sources never decode", async () => {
    const frames = await Promise.all(
        [10, 200].map((r) =>
            sharp({
                create: {
                    width: 20,
                    height: 20,
                    channels: 4,
                    background: { r, g: 0, b: 0, alpha: 1 },
                },
            })
                .png()
                .toBuffer()
        )
    )
    const animated = new Uint8Array(
        await sharp(frames, { join: { animated: true } })
            .webp()
            .toBuffer()
    )
    const decoded = await inspectImage(animated)
    assert.equal(decoded?.pages, 2)
    assert.equal(
        validateImageSource({
            declaredType: "image/webp",
            bytes: animated.length,
            sniffed: sniffImageType(animated),
            decoded,
        }),
        "animated"
    )
    const apng = animatedPng()
    const apngDecoded = await inspectImage(apng)
    assert.equal(apngDecoded?.format, "png")
    assert.equal(apngDecoded?.pages, 2)
    assert.equal(
        validateImageSource({
            declaredType: "image/png",
            bytes: apng.length,
            sniffed: sniffImageType(apng),
            decoded: apngDecoded,
        }),
        "animated"
    )
    // The header is read without the pixel cap so the reason stays specific;
    // decoding the pixels is still refused.
    const bomb = new Uint8Array(await solid(4097, 4097).png().toBuffer())
    const bombDecoded = await inspectImage(bomb)
    assert.equal(bombDecoded?.width, 4097)
    assert.equal(bombDecoded?.height, 4097)
    assert.equal(
        validateImageSource({
            declaredType: "image/png",
            bytes: bomb.length,
            sniffed: sniffImageType(bomb),
            decoded: bombDecoded,
        }),
        "bad_dimensions"
    )
    await assert.rejects(normalizeImage(bomb, "panel-banner"))
})

test("provider animated GIF logos become a single-frame PNG", async () => {
    const frame = {
        create: {
            width: 8,
            height: 8,
            channels: 4 as const,
            background: "red",
        },
    }
    const bytes = await sharp(
        [
            await sharp(frame).png().toBuffer(),
            await sharp({ create: { ...frame.create, background: "blue" } })
                .png()
                .toBuffer(),
        ],
        { join: { animated: true } }
    )
        .gif()
        .toBuffer()
    assert.equal((await inspectImage(bytes))?.pages, 2)
    const result = await normalizeImage(bytes, "team-logo")
    assert.equal(result.contentType, "image/png")
    const metadata = await sharp(result.bytes).metadata()
    assert.equal(metadata.format, "png")
    assert.ok(!metadata.pages || metadata.pages === 1)
    assert.equal(metadata.width, 8)
})
