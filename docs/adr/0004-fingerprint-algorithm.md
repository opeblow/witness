# 0004. A deterministic 32 by 32 Y/Cb/Cr grid plus dHash

Status: Accepted, 2026-11-01

## Context

Most real copies of a photo are not bit-for-bit identical: messaging apps re-compress and resize, and phones auto-enhance. A SHA-256 match alone would call every such copy unverified. We need a fingerprint that:

1. survives re-encoding, resizing and global tone changes;
2. locates local edits rather than just flagging "different";
3. catches colour-only edits, such as recolouring a car;
4. is small enough to publish on chain cheaply;
5. produces identical bytes in every browser and in Node.

## Decision

- Convert pixels to BT.601 Y, Cb and Cr in float64.
- Resample each plane to 32 by 32 with exact area weighting, implemented in `@witness/core`. Browser canvas scaling is never used, because its filters differ between engines.
- Store the three grids as 3,072 bytes, plus a 64-bit dHash of Y for candidate search.
- Compare by normalising each channel per image (zero mean, unit spread with a floor), taking the per-cell maximum difference across channels (chroma weighted 0.75), and thresholding against the image's own noise floor.

## Alternatives

- **Perceptual hashes only (pHash, dHash).** Robust and tiny, but they cannot locate an edit.
- **Learned embeddings.** Robust, but large, model-dependent and not reproducible bit for bit across platforms.
- **Luma-only grid.** Misses edits that change colour without changing brightness; the recolour test case fails.
- **Larger grids (64 by 64).** Finer localisation at four times the size, with more sensitivity to re-encoding noise.

## Consequences

- Edits smaller than about one cell (0.1% of the frame) may not be localised. The SHA-256 check still distinguishes exact originals from copies, and verdicts say which kind of match they are.
- Crops change the aspect ratio; the comparator searches for the crop window and reports `reframed`.
- The tuning constants are part of the algorithm. Any change requires a new `fingerprint.alg` identifier so existing captures keep verifying the same way.
