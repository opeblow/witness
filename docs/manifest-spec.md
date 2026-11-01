# Capture manifest specification, version 1

Status: stable for the testnet. The key words MUST, MUST NOT, SHOULD and MAY are used as in RFC 2119.

## Overview

A capture is a **manifest** signed by a **device key**, wrapped in an **envelope** that is stored on chain. The reference implementation is `packages/core/src/manifest.ts`; where this document and the code disagree, the tests in `packages/core/test` decide and this document is a bug.

## Canonical encoding

Manifests are encoded as canonical JSON:

- Object keys MUST be sorted by UTF-16 code unit order.
- There MUST be no insignificant whitespace.
- Numbers MUST be safe integers (between -(2^53 - 1) and 2^53 - 1). Floating-point values MUST NOT appear.
- Strings are escaped as by `JSON.stringify`.
- Objects with `undefined` members, and non-plain objects, MUST be rejected.

This is a strict subset of RFC 8785 (JCS).

## Fields

| Path                              | Type             | Rule                                                                                           |
| --------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------- |
| `v`                               | integer          | MUST be `1`.                                                                                   |
| `type`                            | string           | MUST be `witness.capture`.                                                                     |
| `network.name`                    | string           | 1 to 64 characters, for example `portaldot-v3-testnet`.                                        |
| `network.genesis`                 | hex32            | Genesis hash of the chain.                                                                     |
| `content.sha256`                  | hex32            | SHA-256 of the exact image file. This is the capture id.                                       |
| `content.mime`                    | string           | `image/jpeg`, `image/png` or `image/webp`.                                                     |
| `content.bytes`                   | integer          | File size, 1 to 26,214,400.                                                                    |
| `content.width`, `content.height` | integer          | Decoded pixel dimensions, 1 to 16,384.                                                         |
| `fingerprint.alg`                 | string           | MUST be `witness-fp-1`.                                                                        |
| `fingerprint.dhash`               | string           | 16 lowercase hex characters.                                                                   |
| `fingerprint.grid`                | base64           | Exactly 3,072 bytes: 1,024 Y, then 1,024 Cb, then 1,024 Cr, each row-major 32 by 32.           |
| `capture.source`                  | string           | `camera` if the frame came straight from a camera inside a Witness client; otherwise `import`. |
| `capture.at`                      | integer          | Device clock, Unix milliseconds. Informational only.                                           |
| `capture.block.number`            | integer          | Latest finalized block the device saw before signing.                                          |
| `capture.block.hash`              | hex32            | Hash of that block.                                                                            |
| `signer.alg`                      | string           | MUST be `ed25519`.                                                                             |
| `signer.key`                      | hex32            | Ed25519 public key.                                                                            |
| `preview`                         | object, optional | `{ "mime": "image/jpeg", "data": base64 }`, at most 49,152 bytes decoded.                      |
| `note`                            | string, optional | At most 280 characters.                                                                        |

`hex32` means `0x` followed by 64 lowercase hexadecimal characters. Unknown fields MUST be rejected.

## Fingerprint algorithm `witness-fp-1`

Given decoded 8-bit sRGB pixels:

1. Convert each pixel to full-range BT.601: `Y = 0.299R + 0.587G + 0.114B`, `Cb = 128 - 0.168736R - 0.331264G + 0.5B`, `Cr = 128 + 0.5R - 0.418688G - 0.081312B`, in float64.
2. Resample each plane to 32 by 32 with exact area weighting: each output cell is the coverage-weighted mean of the input cells it overlaps, computed separably, horizontal pass first.
3. Round each value to the nearest integer and clamp to 0 to 255.
4. For the dHash, resample Y to 9 by 8 the same way. For each row, top to bottom, and each of the first 8 columns, left to right, emit bit 1 if the cell is greater than its right neighbour. Read the 64 bits most significant first as a hex string.

Implementations MUST NOT use platform image scaling for steps 2 and 4.

## Signature

```text
payload   = UTF8("witness/capture/v1\n") || SHA-256(canonical(manifest))
signature = Ed25519.sign(payload, deviceSecretKey)
```

The signature is 64 bytes, hex encoded in `signature`.

## Envelope

```text
envelope = UTF8("witness:v1\n") || UTF8(canonical({ "manifest": manifest, "signature": signature }))
```

Envelopes MUST NOT exceed 98,304 bytes. The envelope is stored as the data of a `transactionStorage.store` call.

## Anchor

The registry anchor for a capture is `anchor(contentHash, manifestDigest, signer, dhash)` where `manifestDigest = SHA-256(canonical(manifest))`, `signer = signer.key` and `dhash` is the fingerprint dHash as a `uint64`.

## Validity

A capture is intact when all of the following hold:

1. The signature verifies.
2. `content.sha256` equals the anchored content hash.
3. The manifest digest and signer equal those in the `Anchored` event, when the event is available.
4. `0 <= anchorBlock - capture.block.number <= 50`.

A verifier MUST NOT report an image as authentic if its matching capture is not intact.

## Versioning

Any change to the fields, the encoding, the fingerprint or the signature payload requires a new `v`, a new `fingerprint.alg` or a new envelope marker, and an ADR. Verifiers MUST keep accepting all earlier versions.
