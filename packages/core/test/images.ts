import type { Raster } from '../src/index.js';

/** Deterministic pseudo-random numbers (mulberry32) so tests never flake. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A synthetic "photograph": smooth lighting, a few objects and sensor noise.
 * Different seeds give unrelated scenes.
 */
export function scene(width: number, height: number, seed = 1): Raster {
  const rand = rng(seed);
  const data = new Uint8ClampedArray(width * height * 4);
  const blobs = Array.from({ length: 7 }, () => ({
    x: rand() * width,
    y: rand() * height,
    r: (0.08 + rand() * 0.22) * Math.min(width, height),
    color: [rand() * 255, rand() * 255, rand() * 255] as const,
  }));
  const tilt = rand() * Math.PI;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const light = 0.5 + 0.5 * Math.sin((x * Math.cos(tilt) + y * Math.sin(tilt)) / (width / 3));
      let r = 40 + 120 * light;
      let g = 50 + 100 * light;
      let b = 60 + 90 * light;
      for (const blob of blobs) {
        const d = Math.hypot(x - blob.x, y - blob.y);
        if (d < blob.r) {
          const k = 1 - d / blob.r;
          r = r * (1 - k) + blob.color[0] * k;
          g = g * (1 - k) + blob.color[1] * k;
          b = b * (1 - k) + blob.color[2] * k;
        }
      }
      const noise = (rand() - 0.5) * 6;
      const p = (y * width + x) * 4;
      data[p] = r + noise;
      data[p + 1] = g + noise;
      data[p + 2] = b + noise;
      data[p + 3] = 255;
    }
  }
  return { width, height, data };
}

function clone(src: Raster): { width: number; height: number; data: Uint8ClampedArray } {
  return { width: src.width, height: src.height, data: Uint8ClampedArray.from(src.data) };
}

/** Approximates lossy re-encoding: fresh noise plus coarse quantisation. */
export function reencode(src: Raster, seed = 9): Raster {
  const out = clone(src);
  const rand = rng(seed);
  for (let i = 0; i < out.data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const v = (out.data[i + c] ?? 0) + (rand() - 0.5) * 8;
      out.data[i + c] = Math.round(v / 6) * 6;
    }
  }
  return out;
}

/** Global brightness and contrast change, like an auto-enhance filter. */
export function enhance(src: Raster, gain = 1.12, lift = 10): Raster {
  const out = clone(src);
  for (let i = 0; i < out.data.length; i += 4) {
    for (let c = 0; c < 3; c++) out.data[i + c] = (out.data[i + c] ?? 0) * gain + lift;
  }
  return out;
}

/** Downscales by an integer factor with box averaging, like a messaging app resize. */
export function shrink(src: Raster, factor: number): Raster {
  const width = Math.floor(src.width / factor);
  const height = Math.floor(src.height / factor);
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      for (let c = 0; c < 4; c++) {
        let sum = 0;
        for (let dy = 0; dy < factor; dy++) {
          for (let dx = 0; dx < factor; dx++) {
            sum += src.data[((y * factor + dy) * src.width + x * factor + dx) * 4 + c] ?? 0;
          }
        }
        data[(y * width + x) * 4 + c] = sum / (factor * factor);
      }
    }
  }
  return { width, height, data };
}

/** Pastes a flat-coloured rectangle, standing in for an added or removed object. */
export function paint(
  src: Raster,
  box: { x: number; y: number; w: number; h: number },
  color: readonly [number, number, number],
): Raster {
  const out = clone(src);
  const x0 = Math.round(box.x * src.width);
  const y0 = Math.round(box.y * src.height);
  const x1 = Math.round((box.x + box.w) * src.width);
  const y1 = Math.round((box.y + box.h) * src.height);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const p = (y * src.width + x) * 4;
      out.data[p] = color[0];
      out.data[p + 1] = color[1];
      out.data[p + 2] = color[2];
    }
  }
  return out;
}

/** Swaps red and blue inside a box: same brightness structure, different colour. */
export function recolor(src: Raster, box: { x: number; y: number; w: number; h: number }): Raster {
  const out = clone(src);
  for (let y = Math.round(box.y * src.height); y < Math.round((box.y + box.h) * src.height); y++) {
    for (let x = Math.round(box.x * src.width); x < Math.round((box.x + box.w) * src.width); x++) {
      const p = (y * src.width + x) * 4;
      const r = out.data[p] ?? 0;
      out.data[p] = out.data[p + 2] ?? 0;
      out.data[p + 2] = r;
    }
  }
  return out;
}

/** Crops to a sub-rectangle. */
export function crop(src: Raster, box: { x: number; y: number; w: number; h: number }): Raster {
  const x0 = Math.round(box.x * src.width);
  const y0 = Math.round(box.y * src.height);
  const width = Math.round(box.w * src.width);
  const height = Math.round(box.h * src.height);
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      for (let c = 0; c < 4; c++) {
        data[(y * width + x) * 4 + c] = src.data[((y0 + y) * src.width + x0 + x) * 4 + c] ?? 0;
      }
    }
  }
  return { width, height, data };
}
