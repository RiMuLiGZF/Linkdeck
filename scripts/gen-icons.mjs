/**
 * gen-icons.mjs — 生成 Tauri 打包所需的应用/托盘图标。
 *
 * 设计：墨蓝圆角方底（accent #3B5BDB，与 design-tokens 一致）+ 白色实心书签字形。
 * 纯 Node 内置模块实现 PNG / ICO 编码，不引入任何三方依赖。
 * 输出：src-tauri/icons/{32x32,128x128,128x128@2x,icon}.png 与 icon.ico
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src-tauri', 'icons');

// design-tokens: --accent 墨蓝
const ACCENT = [0x3b, 0x5b, 0xdb];
const GLYPH = [0xff, 0xff, 0xff];

/** 圆角矩形覆盖测试（归一化坐标 0..1）。 */
function inRoundedRect(x, y, left, top, right, bottom, r) {
  if (x < left || x > right || y < top || y > bottom) return false;
  const dx = Math.max(left + r - x, x - (right - r), 0);
  const dy = Math.max(top + r - y, y - (bottom - r), 0);
  return dx * dx + dy * dy <= r * r;
}

/** 书签字形：圆角矩形底部挖去一个 V 形缺口。 */
function inBookmark(x, y) {
  const left = 0.325, right = 0.675, top = 0.205, bottom = 0.795;
  if (!inRoundedRect(x, y, left, top, right, bottom, 0.055)) return false;
  const apexY = 0.585;
  if (y >= apexY) {
    const t = (y - apexY) / (bottom - apexY);
    const halfW = ((right - left) / 2) * t;
    if (Math.abs(x - 0.5) <= halfW) return false; // 缺口
  }
  return true;
}

/** 渲染为 RGBA 像素缓冲，4x4 超采样抗锯齿。 */
function render(size) {
  const SS = 4;
  const buf = Buffer.alloc(size * size * 4);
  const radius = 0.215;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let bgHits = 0;
      let glyphHits = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (px + (sx + 0.5) / SS) / size;
          const y = (py + (sy + 0.5) / SS) / size;
          if (inRoundedRect(x, y, 0, 0, 1, 1, radius)) {
            bgHits++;
            if (inBookmark(x, y)) glyphHits++;
          }
        }
      }
      const total = SS * SS;
      const alpha = bgHits / total;
      const i = (py * size + px) * 4;
      if (alpha === 0) continue;
      // 在不透明底上混合字形，再整体乘以底的覆盖率作为 alpha
      const g = glyphHits / Math.max(bgHits, 1);
      buf[i] = Math.round(ACCENT[0] * (1 - g) + GLYPH[0] * g);
      buf[i + 1] = Math.round(ACCENT[1] * (1 - g) + GLYPH[1] * g);
      buf[i + 2] = Math.round(ACCENT[2] * (1 - g) + GLYPH[2] * g);
      buf[i + 3] = Math.round(alpha * 255);
    }
  }
  return buf;
}

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** RGBA 缓冲编码为 PNG。 */
function encodePng(rgba, size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** 多尺寸 PNG 打包为 ICO（Vista+ 支持 PNG 内嵌）。 */
function encodeIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);
  const dir = Buffer.alloc(16 * entries.length);
  let offset = 6 + dir.length;
  entries.forEach((e, idx) => {
    const o = idx * 16;
    dir[o] = e.size >= 256 ? 0 : e.size;
    dir[o + 1] = e.size >= 256 ? 0 : e.size;
    dir.writeUInt16LE(1, o + 4); // planes
    dir.writeUInt16LE(32, o + 6); // bpp
    dir.writeUInt32BE(0, o + 8);
    dir.writeUInt32LE(e.png.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += e.png.length;
  });
  return Buffer.concat([header, dir, ...entries.map((e) => e.png)]);
}

mkdirSync(OUT_DIR, { recursive: true });

const png = (size) => encodePng(render(size), size);

const outputs = {
  '32x32.png': png(32),
  '128x128.png': png(128),
  '128x128@2x.png': png(256),
  'icon.png': png(512),
};
for (const [name, data] of Object.entries(outputs)) {
  writeFileSync(join(OUT_DIR, name), data);
  console.log(`wrote ${name} (${data.length} bytes)`);
}

const ico = encodeIco([16, 32, 48, 64, 128, 256].map((size) => ({ size, png: png(size) })));
writeFileSync(join(OUT_DIR, 'icon.ico'), ico);
console.log(`wrote icon.ico (${ico.length} bytes)`);
