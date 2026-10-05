// Draws the ink-drop mascot as PNG/ICO icons without any image dependencies.
// Output: assets/tray.png (32 px), build/icon.png (256 px), build/icon.ico (16–256 px).
// Run with `npm run icon` after changing the shape; the outputs are committed.
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// Shape in unit coordinates (0..1).
const TIP = { x: 0.5, y: 0.04 };
const BODY = { x: 0.5, y: 0.63, r: 0.34 };
const d = BODY.y - TIP.y;
const tangentDrop = (d * d - BODY.r * BODY.r) / d; // vertical distance tip → tangent points
const tanHalf = BODY.r / Math.sqrt(d * d - BODY.r * BODY.r);

function inDrop(x, y) {
  if ((x - BODY.x) ** 2 + (y - BODY.y) ** 2 <= BODY.r ** 2) return true;
  if (y < TIP.y || y > TIP.y + tangentDrop) return false;
  return Math.abs(x - TIP.x) <= (y - TIP.y) * tanHalf;
}

const inCircle = (x, y, cx, cy, r) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
const inEllipse = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;

function colourAt(x, y, detailed) {
  if (!inDrop(x, y)) return null;
  if (detailed) {
    for (const ex of [0.39, 0.61]) {
      if (inEllipse(x, y, ex + 0.015, 0.63, 0.03, 0.035) && y > 0.6) return [15, 23, 42];
      if (inEllipse(x, y, ex, 0.61, 0.075, 0.085)) return [255, 255, 255];
    }
    if (inEllipse(x, y, 0.27, 0.73, 0.05, 0.028) || inEllipse(x, y, 0.73, 0.73, 0.05, 0.028)) return [249, 168, 212];
    const dots = [
      [0.41, 0.88, [6, 182, 212]],
      [0.5, 0.9, [236, 72, 153]],
      [0.59, 0.88, [250, 204, 21]],
    ];
    for (const [cx, cy, c] of dots) if (inCircle(x, y, cx, cy, 0.03)) return c;
  }
  // Vertical gradient #60a5fa → #1d4ed8.
  const t = Math.min(1, Math.max(0, (y - 0.05) / 0.92));
  return [96 + (29 - 96) * t, 165 + (78 - 165) * t, 250 + (216 - 250) * t].map(Math.round);
}

function render(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const ss = 4; // supersampling for smooth edges
  const detailed = size >= 32;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const c = colourAt((px + (sx + 0.5) / ss) / size, (py + (sy + 0.5) / ss) / size, detailed);
          if (c) {
            r += c[0];
            g += c[1];
            b += c[2];
            a++;
          }
        }
      }
      const i = (py * size + px) * 4;
      if (a) {
        rgba[i] = Math.round(r / a);
        rgba[i + 1] = Math.round(g / a);
        rgba[i + 2] = Math.round(b / a);
        rgba[i + 3] = Math.round((a / (ss * ss)) * 255);
      }
    }
  }
  return encodePng(size, rgba);
}

function encodeIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  const entries = [];
  let offset = 6 + 16 * pngs.length;
  for (const { size, png } of pngs) {
    const e = Buffer.alloc(16);
    e[0] = size >= 256 ? 0 : size;
    e[1] = size >= 256 ? 0 : size;
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += png.length;
    entries.push(e);
  }
  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.png)]);
}

const root = new URL("../", import.meta.url);
mkdirSync(new URL("assets/", root), { recursive: true });
mkdirSync(new URL("build/", root), { recursive: true });

writeFileSync(new URL("assets/tray.png", root), render(32));
writeFileSync(new URL("build/icon.png", root), render(256));
writeFileSync(
  new URL("build/icon.ico", root),
  encodeIco([16, 24, 32, 48, 64, 128, 256].map((size) => ({ size, png: render(size) }))),
);
console.log("Icons written: assets/tray.png, build/icon.png, build/icon.ico");
