# Privacy

Witness is built so that proving a photo is real does not require publishing the photo. This document says exactly what goes where.

## What stays on your device

- **Your photos.** Capture and verification decode, fingerprint and hash images in your browser. The image file itself is never uploaded, neither to the notary nor to the chain.
- **Your device key.** It is generated in your browser and stored in its local storage. It never leaves the device unless you download a backup.
- **Images you verify.** Verification is read-only. Nothing about the image you check is sent anywhere; your browser queries the chain for the hash and recent fingerprints.

## What is published on Portaldot

When you seal a capture, a signed manifest is stored on the Portaldot V3 testnet. It is public and cannot be deleted from the chain's history. It contains:

| Field                  | Example                                   | Why                                                                                                                       |
| ---------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Content hash (SHA-256) | `0x3f9a...`                               | Identifies the exact file. Cannot be reversed into the image.                                                             |
| Fingerprint            | 64-bit hash and a 32 by 32 colour summary | Lets copies be matched and edits located. A 32 by 32 summary is far too coarse to show faces, text or identifying detail. |
| Image size and type    | `1920 x 1080`, `image/jpeg`               | Needed to compare copies.                                                                                                 |
| Capture time and block | block `276,102`                           | Proof of when.                                                                                                            |
| Source                 | `camera` or `import`                      | Tells verifiers how strong the evidence is.                                                                               |
| Device public key      | `0x...`                                   | Proof of who. It is a pseudonymous key, not your name.                                                                    |
| Reference (optional)   | `Order 4471`                              | Only if you type one.                                                                                                     |
| Preview (optional)     | A JPEG of at most 48 KB                   | **Only if you tick "Publish a low-resolution preview".** Off by default.                                                  |

**Location data is never included.** Witness does not read EXIF, GPS or device identifiers.

## What the notary sees

The notary receives the signed envelope above, the same data that becomes public, plus the network address of your request, which it uses for rate limiting in memory only. It does not store request logs beyond operational logs of anchored content hashes and block numbers.

## Identity

A device key is pseudonymous. It becomes linked to a name only if its owner registers an on-chain identity for it, which businesses may do for their capture devices.

## Things to know before you publish

- Anything on a public blockchain is permanent. Do not publish a preview of a photo you would not want public forever.
- A reference note is public. Do not put personal data in it.
- If you lose your device key, past captures stay valid, but new captures will come from a new key.

## Third parties

The web app connects to the public Portaldot testnet endpoints `test-node-v3.portaldot.dev` and `test-evm-rpc-v3.portaldot.dev`, operated by the Portaldot team, to read and write chain data. Fonts are bundled with the app; there are no analytics, trackers or third-party scripts.

## Questions

Open an issue, or for anything sensitive contact the maintainers privately as described in [SUPPORT.md](SUPPORT.md).
