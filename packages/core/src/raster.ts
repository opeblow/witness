/**
 * Deterministic raster maths.
 *
 * Browsers resample images differently, so Witness never relies on canvas scaling
 * for anything that is compared later. All resizing happens here, with exact
 * area-weighted box filtering in float64, so every platform gets the same numbers
 * from the same decoded pixels.
 */

/** 8-bit RGBA pixels, row-major, like the browser ImageData type. */
export interface Raster {
  readonly width: number;
  readonly height: number;
  readonly data: ArrayLike<number>;
}

/** A single-channel float plane. */
export interface Plane {
  readonly width: number;
  readonly height: number;
  readonly data: Float64Array;
}

export function assertRaster(raster: Raster): void {
  const { width, height, data } = raster;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new RangeError('Raster dimensions must be positive integers');
  }
  if (data.length !== width * height * 4) {
    throw new RangeError(
      `Raster data length ${data.length} does not match ${width}x${height} RGBA`,
    );
  }
}

/**
 * Splits RGBA pixels into Y, Cb and Cr planes (ITU-R BT.601, full range).
 * Using chroma as well as luma lets Witness see edits that keep brightness but
 * change colour, such as recolouring an object.
 */
export function toYCbCr(raster: Raster): [Plane, Plane, Plane] {
  assertRaster(raster);
  const { width, height, data } = raster;
  const n = width * height;
  const y = new Float64Array(n);
  const cb = new Float64Array(n);
  const cr = new Float64Array(n);
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const r = data[p] ?? 0;
    const g = data[p + 1] ?? 0;
    const b = data[p + 2] ?? 0;
    y[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    cb[i] = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
    cr[i] = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  }
  return [
    { width, height, data: y },
    { width, height, data: cb },
    { width, height, data: cr },
  ];
}

/** Area-weighted downscale (or upscale) of a plane to `targetWidth` x `targetHeight`. */
export function resizeArea(plane: Plane, targetWidth: number, targetHeight: number): Plane {
  const horizontal = resample1d(plane.data, plane.width, plane.height, targetWidth, true);
  const vertical = resample1d(horizontal, targetWidth, plane.height, targetHeight, false);
  return { width: targetWidth, height: targetHeight, data: vertical };
}

/**
 * Resamples along one axis. For each target cell the covered source interval is
 * integrated exactly, including the fractional coverage of the first and last
 * source cells.
 */
function resample1d(
  src: Float64Array,
  width: number,
  height: number,
  target: number,
  alongX: boolean,
): Float64Array {
  const srcLen = alongX ? width : height;
  const lines = alongX ? height : width;
  const out = new Float64Array(alongX ? target * height : width * target);
  const scale = srcLen / target;
  for (let t = 0; t < target; t++) {
    const start = t * scale;
    const end = start + scale;
    const first = Math.floor(start);
    const last = Math.min(Math.ceil(end), srcLen);
    for (let line = 0; line < lines; line++) {
      let sum = 0;
      for (let s = first; s < last; s++) {
        const coverage = Math.min(end, s + 1) - Math.max(start, s);
        if (coverage <= 0) continue;
        const index = alongX ? line * width + s : s * width + line;
        sum += (src[index] ?? 0) * coverage;
      }
      const outIndex = alongX ? line * target + t : t * width + line;
      out[outIndex] = sum / scale;
    }
  }
  return out;
}
