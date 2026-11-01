import { fromBase64, toBase64 } from './bytes.js';
import { type Plane, type Raster, resizeArea, toYCbCr } from './raster.js';

/** Identifier of the fingerprint algorithm. Bumped whenever outputs could change. */
export const FINGERPRINT_ALG = 'witness-fp-1';

/** The fingerprint grid is GRID x GRID cells for each of the Y, Cb and Cr channels. */
export const GRID = 32;
export const GRID_CELLS = GRID * GRID;
export const GRID_BYTES = GRID_CELLS * 3;

/**
 * A compact visual summary of an image.
 *
 * - `dhash` is a 64-bit difference hash used to find candidate originals quickly.
 * - `grid` is a 32x32 Y/Cb/Cr thumbnail (3,072 bytes) used to locate edits.
 */
export interface Fingerprint {
  readonly dhash: string;
  readonly grid: Uint8Array;
  readonly width: number;
  readonly height: number;
}

export function fingerprint(raster: Raster): Fingerprint {
  const [y, cb, cr] = toYCbCr(raster);
  const grid = new Uint8Array(GRID_BYTES);
  [y, cb, cr].forEach((plane, channel) => {
    const small = resizeArea(plane, GRID, GRID);
    for (let i = 0; i < GRID_CELLS; i++) {
      grid[channel * GRID_CELLS + i] = clampByte(Math.round(small.data[i] ?? 0));
    }
  });
  return { dhash: differenceHash(y), grid, width: raster.width, height: raster.height };
}

/**
 * dHash: shrink luma to 9x8 and record whether each cell is brighter than its
 * right-hand neighbour. Robust to scaling, re-compression and mild colour shifts.
 */
export function differenceHash(luma: Plane): string {
  const small = resizeArea(luma, 9, 8);
  let bits = 0n;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const left = small.data[row * 9 + col] ?? 0;
      const right = small.data[row * 9 + col + 1] ?? 0;
      bits = (bits << 1n) | (left > right ? 1n : 0n);
    }
  }
  return bits.toString(16).padStart(16, '0');
}

/** Number of differing bits between two 64-bit hex hashes. */
export function hammingDistance(a: string, b: string): number {
  let x = BigInt(`0x${a}`) ^ BigInt(`0x${b}`);
  let count = 0;
  while (x > 0n) {
    count += Number(x & 1n);
    x >>= 1n;
  }
  return count;
}

export function encodeGrid(grid: Uint8Array): string {
  if (grid.length !== GRID_BYTES) throw new RangeError(`Grid must be ${GRID_BYTES} bytes`);
  return toBase64(grid);
}

export function decodeGrid(encoded: string): Uint8Array {
  const grid = fromBase64(encoded);
  if (grid.length !== GRID_BYTES) throw new RangeError(`Grid must be ${GRID_BYTES} bytes`);
  return grid;
}

/** The dHash as the uint64 the on-chain registry stores. */
export function dhashToBigInt(dhash: string): bigint {
  if (!/^[0-9a-f]{16}$/.test(dhash))
    throw new TypeError('dhash must be 16 lowercase hex characters');
  return BigInt(`0x${dhash}`);
}

export function dhashFromBigInt(value: bigint): string {
  return value.toString(16).padStart(16, '0');
}

function clampByte(value: number): number {
  return value < 0 ? 0 : value > 255 ? 255 : value;
}
