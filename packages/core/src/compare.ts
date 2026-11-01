import { type Fingerprint, GRID, GRID_CELLS, hammingDistance } from './fingerprint.js';
import { type Plane, resizeArea } from './raster.js';

/** A changed area, in coordinates normalised to the image (0 to 1). */
export interface Region {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** Strongest cell difference inside the region, in noise-normalised units. */
  readonly peak: number;
  readonly cells: number;
}

export type ComparisonClass =
  /** No change visible at fingerprint resolution: the same picture, possibly re-encoded. */
  | 'consistent'
  /** Same picture with local changes. `regions` says where. */
  | 'altered'
  /** Cropped, rotated or otherwise re-framed, so cells no longer line up. */
  | 'reframed'
  /** A different picture. */
  | 'unrelated';

export interface Comparison {
  readonly classification: ComparisonClass;
  readonly dhashDistance: number;
  readonly aspectDelta: number;
  /** Share of grid cells flagged as changed, 0 to 1. */
  readonly changedRatio: number;
  readonly regions: readonly Region[];
  /** Per-cell change intensity, 0 to 1, row-major GRID x GRID. */
  readonly heat: Float64Array;
  readonly threshold: number;
}

/** Tuning constants. Covered by the synthetic image tests in packages/core/test. */
export const COMPARE_TUNING = {
  /** Aspect-ratio difference (log scale) above which the frames are not comparable. */
  maxAspectDelta: 0.03,
  /** Minimum cell difference that can count as a change. */
  minThreshold: 0.45,
  /** A change must also exceed this multiple of the image-wide noise floor. */
  noiseMultiple: 3,
  noiseOffset: 0.15,
  /** A region must peak at least this high to count; weaker ones are filter or clipping noise. */
  minRegionPeak: 1,
  /** Single-cell regions are kept only when this strong. */
  isolatedCellPeak: 1.5,
  /** A median cell difference above this means the pictures do not line up at all. */
  maxNoiseFloor: 0.6,
  /** Median difference below which a crop window is accepted as the source of a reframed copy. */
  maxCropNoise: 0.35,
  /** Above this changed share with a distant dHash, the images are treated as different. */
  unrelatedChangedRatio: 0.45,
  unrelatedDhashDistance: 16,
  /** Weight of colour channels relative to brightness. */
  chromaWeight: 0.75,
  lumaStdFloor: 8,
  chromaStdFloor: 12,
} as const;

/** Compares a suspect image to an original and locates what changed. */
export function compareFingerprints(original: Fingerprint, suspect: Fingerprint): Comparison {
  const t = COMPARE_TUNING;
  const dhashDistance = hammingDistance(original.dhash, suspect.dhash);
  const aspectDelta = Math.abs(
    Math.log(original.width / original.height) - Math.log(suspect.width / suspect.height),
  );
  const empty = new Float64Array(GRID_CELLS);

  if (aspectDelta > t.maxAspectDelta) {
    const crop = findCrop(original, suspect);
    return {
      classification: crop ? 'reframed' : 'unrelated',
      dhashDistance,
      aspectDelta,
      changedRatio: 1,
      regions: crop ? [crop] : [],
      heat: empty,
      threshold: 0,
    };
  }

  const diff = cellDifferences(original.grid, suspect.grid);
  const noise = median(diff);
  if (noise > t.maxNoiseFloor) {
    return {
      classification: 'unrelated',
      dhashDistance,
      aspectDelta,
      changedRatio: 1,
      regions: [],
      heat: empty,
      threshold: noise,
    };
  }
  const threshold = Math.max(t.minThreshold, noise * t.noiseMultiple + t.noiseOffset);
  const changed = diff.map((d) => (d > threshold ? 1 : 0));
  const regions = connectedRegions(changed, diff).filter(
    (r) => r.peak >= t.minRegionPeak && (r.cells >= 2 || r.peak >= t.isolatedCellPeak),
  );
  const changedCells = regions.reduce((sum, r) => sum + r.cells, 0);
  const changedRatio = changedCells / GRID_CELLS;
  const heat = diff.map((d) => Math.min(1, d / (threshold * 2)));

  let classification: ComparisonClass;
  if (changedRatio > t.unrelatedChangedRatio && dhashDistance > t.unrelatedDhashDistance) {
    classification = 'unrelated';
  } else if (regions.length === 0) {
    classification = 'consistent';
  } else {
    classification = 'altered';
  }

  return { classification, dhashDistance, aspectDelta, changedRatio, regions, heat, threshold };
}

/**
 * When the aspect ratios differ, checks whether the suspect is a crop of the
 * original along one axis. Slides a window of the suspect's proportions across
 * the original grid and accepts the best position if it lines up closely.
 * Returns the crop window as a region, or null.
 */
function findCrop(original: Fingerprint, suspect: Fingerprint): Region | null {
  const t = COMPARE_TUNING;
  const ratioOriginal = original.width / original.height;
  const ratioSuspect = suspect.width / suspect.height;
  const alongX = ratioSuspect < ratioOriginal;
  const fraction = alongX ? ratioSuspect / ratioOriginal : ratioOriginal / ratioSuspect;
  if (fraction < 0.3) return null;

  const FINE = GRID * 8;
  const window = Math.round(FINE * fraction);
  const channels = [0, 1, 2].map((c) => {
    const plane = {
      width: GRID,
      height: GRID,
      data: Float64Array.from(original.grid.subarray(c * GRID_CELLS, (c + 1) * GRID_CELLS)),
    };
    return alongX ? resizeArea(plane, FINE, GRID) : resizeArea(plane, GRID, FINE);
  });

  let best: { offset: number; noise: number } | null = null;
  for (let offset = 0; offset + window <= FINE; offset += 4) {
    const candidate = new Uint8Array(GRID_CELLS * 3);
    channels.forEach((plane, c) => {
      const cropped = cropPlane(plane, alongX, offset, window);
      const resized = resizeArea(cropped, GRID, GRID);
      for (let i = 0; i < GRID_CELLS; i++)
        candidate[c * GRID_CELLS + i] = Math.round(resized.data[i] ?? 0);
    });
    const noise = median(cellDifferences(candidate, suspect.grid));
    if (!best || noise < best.noise) best = { offset, noise };
  }
  if (!best || best.noise > t.maxCropNoise) return null;
  const start = best.offset / FINE;
  return alongX
    ? { x: start, y: 0, width: fraction, height: 1, peak: best.noise, cells: 0 }
    : { x: 0, y: start, width: 1, height: fraction, peak: best.noise, cells: 0 };
}

function cropPlane(plane: Plane, alongX: boolean, offset: number, length: number): Plane {
  const width = alongX ? length : plane.width;
  const height = alongX ? plane.height : length;
  const data = new Float64Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const sx = alongX ? x + offset : x;
      const sy = alongX ? y : y + offset;
      data[y * width + x] = plane.data[sy * plane.width + sx] ?? 0;
    }
  }
  return { width, height, data };
}

/**
 * Per-cell difference after normalising each image's channels to zero mean and
 * unit spread. Global brightness, contrast and white-balance changes cancel out;
 * local edits do not.
 */
function cellDifferences(a: Uint8Array, b: Uint8Array): Float64Array {
  const t = COMPARE_TUNING;
  const out = new Float64Array(GRID_CELLS);
  for (let channel = 0; channel < 3; channel++) {
    const floor = channel === 0 ? t.lumaStdFloor : t.chromaStdFloor;
    const weight = channel === 0 ? 1 : t.chromaWeight;
    const za = normalise(a.subarray(channel * GRID_CELLS, (channel + 1) * GRID_CELLS), floor);
    const zb = normalise(b.subarray(channel * GRID_CELLS, (channel + 1) * GRID_CELLS), floor);
    for (let i = 0; i < GRID_CELLS; i++) {
      const d = Math.abs((za[i] ?? 0) - (zb[i] ?? 0)) * weight;
      if (d > (out[i] ?? 0)) out[i] = d;
    }
  }
  return out;
}

function normalise(values: Uint8Array, stdFloor: number): Float64Array {
  let mean = 0;
  for (const v of values) mean += v;
  mean /= values.length;
  let variance = 0;
  for (const v of values) variance += (v - mean) ** 2;
  const std = Math.max(Math.sqrt(variance / values.length), stdFloor);
  return Float64Array.from(values, (v) => (v - mean) / std);
}

function median(values: Float64Array): number {
  const sorted = Float64Array.from(values).sort();
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? (sorted[mid] ?? 0) : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

/** Groups changed cells into 8-connected regions with normalised bounding boxes. */
function connectedRegions(changed: Float64Array, diff: Float64Array): Region[] {
  const seen = new Uint8Array(GRID_CELLS);
  const regions: Region[] = [];
  for (let start = 0; start < GRID_CELLS; start++) {
    if (!changed[start] || seen[start]) continue;
    const stack = [start];
    seen[start] = 1;
    let minX = GRID;
    let minY = GRID;
    let maxX = -1;
    let maxY = -1;
    let peak = 0;
    let cells = 0;
    while (stack.length > 0) {
      const index = stack.pop() as number;
      const x = index % GRID;
      const y = (index - x) / GRID;
      cells++;
      peak = Math.max(peak, diff[index] ?? 0);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) continue;
          const next = ny * GRID + nx;
          if (changed[next] && !seen[next]) {
            seen[next] = 1;
            stack.push(next);
          }
        }
      }
    }
    regions.push({
      x: minX / GRID,
      y: minY / GRID,
      width: (maxX - minX + 1) / GRID,
      height: (maxY - minY + 1) / GRID,
      peak,
      cells,
    });
  }
  return regions.sort((a, b) => b.cells - a.cells);
}
