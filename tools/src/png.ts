import { deflateSync } from 'node:zlib';
import type { Raster } from '@witness/core';

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = (CRC_TABLE[(c ^ b) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

/** Encodes RGBA pixels as a PNG, so tools can produce real image files without dependencies. */
export function encodePng(raster: Raster): Uint8Array {
  const { width, height, data } = raster;
  const rows = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    rows[y * (width * 4 + 1)] = 0;
    for (let i = 0; i < width * 4; i++)
      rows[y * (width * 4 + 1) + 1 + i] = data[y * width * 4 + i] ?? 0;
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', new Uint8Array()),
  ]);
}

/** A deterministic test scene: lighting gradient, a few objects and grain. */
export function testScene(width: number, height: number, seed: number): Raster {
  let state = seed >>> 0;
  const rand = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const blobs = Array.from({ length: 6 }, () => ({
    x: rand() * width,
    y: rand() * height,
    r: (0.1 + rand() * 0.2) * Math.min(width, height),
    c: [rand() * 255, rand() * 255, rand() * 255],
  }));
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const light = 0.5 + 0.5 * Math.sin((x + y) / (width / 3));
      const px = [40 + 120 * light, 50 + 100 * light, 60 + 90 * light];
      for (const b of blobs) {
        const k = Math.max(0, 1 - Math.hypot(x - b.x, y - b.y) / b.r);
        for (let c = 0; c < 3; c++) px[c] = (px[c] ?? 0) * (1 - k) + (b.c[c] ?? 0) * k;
      }
      const grain = (rand() - 0.5) * 6;
      const p = (y * width + x) * 4;
      data[p] = (px[0] ?? 0) + grain;
      data[p + 1] = (px[1] ?? 0) + grain;
      data[p + 2] = (px[2] ?? 0) + grain;
      data[p + 3] = 255;
    }
  }
  return { width, height, data };
}
