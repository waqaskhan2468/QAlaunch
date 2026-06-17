// Generates a static public/favicon.ico from the QAlaunch brand mark.
// Mirrors the design in app/icon.tsx: blue ring (#1847A8), navy inner
// (#09111F), green upward arrow + accent square (#22C55E). Google reads a
// root-level favicon.ico for search-result icons, separate from icon.tsx.
//
// Run once with: node scripts/gen-favicon.mjs
import sharp from "sharp"
import { writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))

// Exact brand mark from app/icon.tsx, viewBox 0 0 48 48, transparent bg.
const svg = `<svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
  <circle cx="24" cy="24" r="22" fill="#1847A8" />
  <circle cx="24" cy="24" r="15.5" fill="#09111F" />
  <rect x="28.5" y="30" width="6" height="4" fill="#22C55E" />
  <polygon points="24,10 32,20 28,20 28,28 20,28 20,20 16,20" fill="#22C55E" />
</svg>`

// Sizes packed into the .ico. 48 is Google's minimum; 16/32 cover browser tabs.
const sizes = [16, 32, 48]

const pngs = await Promise.all(
  sizes.map((s) =>
    sharp(Buffer.from(svg)).resize(s, s).png().toBuffer(),
  ),
)

// Assemble ICO: 6-byte ICONDIR header + 16-byte entry per image + PNG blobs.
const header = Buffer.alloc(6)
header.writeUInt16LE(0, 0) // reserved
header.writeUInt16LE(1, 2) // type: 1 = icon
header.writeUInt16LE(sizes.length, 4)

const entries = []
let offset = 6 + 16 * sizes.length
pngs.forEach((png, i) => {
  const e = Buffer.alloc(16)
  const dim = sizes[i] >= 256 ? 0 : sizes[i]
  e.writeUInt8(dim, 0) // width  (0 = 256)
  e.writeUInt8(dim, 1) // height (0 = 256)
  e.writeUInt8(0, 2) // palette count
  e.writeUInt8(0, 3) // reserved
  e.writeUInt16LE(1, 4) // color planes
  e.writeUInt16LE(32, 6) // bits per pixel
  e.writeUInt32LE(png.length, 8) // size of PNG data
  e.writeUInt32LE(offset, 12) // offset of PNG data
  offset += png.length
  entries.push(e)
})

const ico = Buffer.concat([header, ...entries, ...pngs])
const out = join(__dirname, "..", "public", "favicon.ico")
writeFileSync(out, ico)
console.log(`Wrote ${out} (${ico.length} bytes, sizes: ${sizes.join("/")})`)
