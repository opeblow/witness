import { describe, expect, it } from 'vitest';
import { compareFingerprints, fingerprint, hammingDistance } from '../src/index.js';
import { crop, enhance, paint, recolor, reencode, scene, shrink } from './images.js';

const original = scene(480, 360, 7);
const fpOriginal = fingerprint(original);

function overlaps(
  region: { x: number; y: number; width: number; height: number },
  box: { x: number; y: number; w: number; h: number },
) {
  return (
    region.x < box.x + box.w &&
    region.x + region.width > box.x &&
    region.y < box.y + box.h &&
    region.y + region.height > box.y
  );
}

describe('fingerprint', () => {
  it('is deterministic', () => {
    const again = fingerprint(original);
    expect(again.dhash).toBe(fpOriginal.dhash);
    expect(Buffer.from(again.grid).equals(Buffer.from(fpOriginal.grid))).toBe(true);
  });

  it('produces a 64-bit dhash and a 3,072-byte grid', () => {
    expect(fpOriginal.dhash).toMatch(/^[0-9a-f]{16}$/);
    expect(fpOriginal.grid.length).toBe(3072);
  });

  it('keeps the dhash close under re-encoding and far for a different scene', () => {
    const reencoded = fingerprint(reencode(original));
    const other = fingerprint(scene(480, 360, 99));
    expect(hammingDistance(fpOriginal.dhash, reencoded.dhash)).toBeLessThanOrEqual(6);
    expect(hammingDistance(fpOriginal.dhash, other.dhash)).toBeGreaterThan(16);
  });
});

describe('compareFingerprints', () => {
  it('treats an identical image as consistent', () => {
    const result = compareFingerprints(fpOriginal, fingerprint(original));
    expect(result.classification).toBe('consistent');
    expect(result.regions).toHaveLength(0);
  });

  it.each([
    ['lossy re-encoding', reencode(original)],
    ['auto-enhance', enhance(original)],
    ['resize to half size', shrink(original, 2)],
    ['resize, re-encode and enhance together', enhance(reencode(shrink(original, 2)), 0.92, -6)],
  ])('treats %s as consistent', (_label, variant) => {
    const result = compareFingerprints(fpOriginal, fingerprint(variant));
    expect(result.classification).toBe('consistent');
  });

  it('flags an object pasted into the scene and locates it', () => {
    const box = { x: 0.55, y: 0.2, w: 0.18, h: 0.22 };
    const result = compareFingerprints(
      fpOriginal,
      fingerprint(reencode(paint(original, box, [235, 230, 220]))),
    );
    expect(result.classification).toBe('altered');
    expect(result.regions.length).toBeGreaterThan(0);
    expect(overlaps(result.regions[0]!, box)).toBe(true);
    expect(result.changedRatio).toBeLessThan(0.1);
  });

  it('flags a small edit covering about 2% of the frame', () => {
    const box = { x: 0.1, y: 0.62, w: 0.14, h: 0.14 };
    const result = compareFingerprints(fpOriginal, fingerprint(paint(original, box, [20, 20, 20])));
    expect(result.classification).toBe('altered');
    expect(result.regions.some((r) => overlaps(r, box))).toBe(true);
  });

  it('flags a colour change that keeps the brightness structure', () => {
    const box = { x: 0.3, y: 0.3, w: 0.3, h: 0.3 };
    const result = compareFingerprints(fpOriginal, fingerprint(recolor(original, box)));
    expect(result.classification).toBe('altered');
    expect(result.regions.some((r) => overlaps(r, box))).toBe(true);
  });

  it.each([
    ['left side', { x: 0, y: 0, w: 0.7, h: 1 }],
    ['right side', { x: 0.35, y: 0, w: 0.65, h: 1 }],
    ['horizontal band', { x: 0, y: 0.2, w: 1, h: 0.6 }],
  ])('reports a crop of the %s as reframed and finds the window', (_label, box) => {
    const result = compareFingerprints(fpOriginal, fingerprint(reencode(crop(original, box))));
    expect(result.classification).toBe('reframed');
    const window = result.regions[0]!;
    expect(Math.abs(window.x - box.x)).toBeLessThan(0.05);
    expect(Math.abs(window.y - box.y)).toBeLessThan(0.05);
  });

  it('reports a different scene as unrelated', () => {
    const result = compareFingerprints(fpOriginal, fingerprint(scene(480, 360, 1234)));
    expect(result.classification).toBe('unrelated');
  });

  it('returns heat values between 0 and 1 for every cell', () => {
    const result = compareFingerprints(fpOriginal, fingerprint(reencode(original)));
    expect(result.heat).toHaveLength(1024);
    for (const value of result.heat) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });
});
