/**
 * generate-icons.js
 *
 * Generates valid PNG icon files for the Kaal PWA using ONLY built-in
 * Node.js modules (fs, zlib). No external dependencies required.
 *
 * Produces a dark background (#1a1a2e) with accent color (#e94560)
 * circle and a "K" letter in the center.
 *
 * Output:
 *   public/icons/icon-192.png  (192x192)
 *   public/icons/icon-512.png  (512x512)
 *
 * Usage:
 *   node scripts/generate-icons.js
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ---------- colour palette ----------
const BG     = { r: 0x1a, g: 0x1a, b: 0x2e };
const ACCENT = { r: 0xe9, g: 0x45, b: 0x60 };

// ---------- helpers ----------

/** CRC-32 lookup table (used by PNG) */
const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Build a single PNG chunk */
function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const dataBytes = data instanceof Buffer ? data : Buffer.from(data);
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(dataBytes.length, 0);

  const crcInput = Buffer.concat([typeBytes, dataBytes]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);

  return Buffer.concat([lenBuf, typeBytes, dataBytes, crcBuf]);
}

/** Linear interpolation between two colours */
function lerpColor(a, b, t) {
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  };
}

/**
 * Bitmap font for "K" on a 7x9 grid.
 */
const LETTER_K = [
  '1000011',
  '1000110',
  '1001100',
  '1011000',
  '1110000',
  '1011000',
  '1001100',
  '1000110',
  '1000011',
];

function isInsideLetter(x, y, cx, cy, size) {
  const cols = LETTER_K[0].length;
  const rows = LETTER_K.length;
  const cellW = size / cols;
  const cellH = size / rows;
  const startX = cx - size / 2;
  const startY = cy - size / 2;

  const col = Math.floor((x - startX) / cellW);
  const row = Math.floor((y - startY) / cellH);

  if (col < 0 || col >= cols || row < 0 || row >= rows) return false;
  return LETTER_K[row][col] === '1';
}

// ---------- pixel rendering ----------

function renderIcon(dim) {
  const rawRows = [];
  const cx = dim / 2;
  const cy = dim / 2;
  const outerR = dim * 0.44;
  const innerR = dim * 0.38;
  const letterSize = dim * 0.36;
  const edgeSmooth = dim * 0.02;

  for (let y = 0; y < dim; y++) {
    const row = Buffer.alloc(1 + dim * 3);
    row[0] = 0; // filter: None
    for (let x = 0; x < dim; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      let color;

      if (dist > outerR + edgeSmooth) {
        color = BG;
      } else {
        const gradT = Math.min(dist / outerR, 1);
        const baseCircle = lerpColor(
          { r: 0x2a, g: 0x1a, b: 0x3e },
          BG,
          gradT
        );

        let circleAlpha = 1;
        if (dist > innerR) {
          circleAlpha = 1 - Math.min((dist - innerR) / (outerR - innerR + edgeSmooth), 1);
        }

        if (isInsideLetter(x, y, cx, cy, letterSize)) {
          color = lerpColor(BG, ACCENT, circleAlpha);
        } else {
          color = lerpColor(BG, baseCircle, circleAlpha);
        }

        // Subtle ring on circle edge
        const ringDist = Math.abs(dist - outerR * 0.92);
        if (ringDist < edgeSmooth * 1.5) {
          const ringT = 1 - ringDist / (edgeSmooth * 1.5);
          color = lerpColor(color, ACCENT, ringT * 0.45);
        }
      }

      const off = 1 + x * 3;
      row[off]     = color.r;
      row[off + 1] = color.g;
      row[off + 2] = color.b;
    }
    rawRows.push(row);
  }

  return Buffer.concat(rawRows);
}

function buildPNG(dim) {
  const raw = renderIcon(dim);
  const compressed = zlib.deflateSync(raw, { level: 9 });

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(dim, 0);
  ihdr.writeUInt32BE(dim, 4);
  ihdr[8]  = 8;   // bit depth
  ihdr[9]  = 2;   // color type: RGB
  ihdr[10] = 0;   // compression
  ihdr[11] = 0;   // filter
  ihdr[12] = 0;   // interlace

  const ihdrChunk = pngChunk('IHDR', ihdr);
  const idatChunk = pngChunk('IDAT', compressed);
  const iendChunk = pngChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// ---------- main ----------

const outDir = path.resolve(__dirname, '..', 'public', 'icons');
fs.mkdirSync(outDir, { recursive: true });

const sizes = [192, 512];

for (const dim of sizes) {
  const pngBuf = buildPNG(dim);
  const outPath = path.join(outDir, `icon-${dim}.png`);
  fs.writeFileSync(outPath, pngBuf);
  const kb = (pngBuf.length / 1024).toFixed(1);
  console.log(`  Created ${outPath}  (${dim}x${dim}, ${kb} KB)`);
}

console.log('\nDone! Icons generated successfully.');
