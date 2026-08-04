// Draws the PWA icon set beside itself. `npm run icons`, and only when the mark
// or the brand colour changes — the PNGs are committed.
//
// No dependencies, and that's deliberate: the icon is six capsules and a
// rounded square, which is less code than a rasteriser is a dependency. Node's
// own zlib is the only hard part of a PNG.
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

const OUT = fileURLToPath(new URL('.', import.meta.url))

const BRAND = [0xff, 0xd8, 0x4d] // the yellow favicon.svg strokes
const MARK = [0x17, 0x17, 0x17] // --brand-foreground

// lucide `audio-lines` — favicon.svg's own paths, as capsules in its 24-unit
// box. Symmetric about (12, 12), so centring is just the box.
const STROKES = [
  [2, 12, 4, 12],
  [6, 8, 6, 16],
  [10, 4, 10, 20],
  [14, 7, 14, 17],
  [18, 10, 18, 14],
  [22, 12, 20, 12],
]
const HALF = 1.25 // stroke-width 2.5, round caps

const SAMPLES = 4 // per axis; the only antialiasing there is

const distanceToSegment = (px, py, x1, y1, x2, y2) => {
  const dx = x2 - x1
  const dy = y2 - y1
  const length = dx * dx + dy * dy
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / length))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

// A rounded rect is the distance to the box inset by its own radius.
const insideTile = (px, py, size, radius) => {
  if (radius === 0) return true
  const cx = Math.min(Math.max(px, radius), size - radius)
  const cy = Math.min(Math.max(py, radius), size - radius)
  return Math.hypot(px - cx, py - cy) <= radius
}

function draw(size, radiusRatio, markRatio) {
  const radius = size * radiusRatio
  const scale = (size * markRatio) / 24
  const offset = (size - 24 * scale) / 2
  const pixels = new Uint8Array(size * size * 4)

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let tile = 0
      let mark = 0
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const fx = x + (sx + 0.5) / SAMPLES
          const fy = y + (sy + 0.5) / SAMPLES
          if (!insideTile(fx, fy, size, radius)) continue
          tile++
          const mx = (fx - offset) / scale
          const my = (fy - offset) / scale
          if (STROKES.some((s) => distanceToSegment(mx, my, ...s) <= HALF)) mark++
        }
      }

      const i = (y * size + x) * 4
      // Mark over brand, divided back out by the tile's own coverage: PNG wants
      // straight alpha, and the rounded corners are the only place tile < 1.
      if (tile > 0) {
        for (let c = 0; c < 3; c++) {
          pixels[i + c] = Math.round((MARK[c] * mark + BRAND[c] * (tile - mark)) / tile)
        }
      }
      pixels[i + 3] = Math.round((255 * tile) / (SAMPLES * SAMPLES))
    }
  }
  return pixels
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

const crc32 = (buffer) => {
  let c = 0xffffffff
  for (const b of buffer) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

const chunk = (type, data) => {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

function png(pixels, size) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8 // bit depth
  header[9] = 6 // truecolour with alpha

  // Every scanline is prefixed with its filter type, and 0 is "none".
  const stride = size * 4 + 1
  const raw = Buffer.alloc(size * stride)
  for (let y = 0; y < size; y++) {
    Buffer.from(pixels.buffer, y * size * 4, size * 4).copy(raw, y * stride + 1)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const write = (name, size, radiusRatio, markRatio) => {
  writeFileSync(`${OUT}/${name}`, png(draw(size, radiusRatio, markRatio), size))
  console.log(`${name} ${size}×${size}`)
}

// `any` rounds its own corners, since nothing else will. Maskable and Apple's
// are full bleed with a smaller mark: Android crops to the inner 80% and iOS
// puts its squircle over the top.
write('icon-192.png', 192, 0.22, 0.6)
write('icon-512.png', 512, 0.22, 0.6)
write('icon-maskable-512.png', 512, 0, 0.5)
write('apple-touch-icon.png', 180, 0, 0.58)
