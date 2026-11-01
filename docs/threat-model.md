# Threat model

Witness answers one question: **is this image the one that device D captured between blocks B1 and B2?** This document lists who might try to make that answer wrong, and what stops them.

## Assets

- The integrity of verdicts: an image must never verify as authentic unless it is the sealed original, or a visually unchanged copy of it.
- The binding between a capture, its signer and its time window.
- The privacy of images users chose not to publish.
- Sponsor funds held by the notary.

## Actors

| Actor               | Capabilities assumed                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------ |
| Fraudulent claimant | Full control of their own device and files; access to strong image-editing and generation tools. |
| Counterparty        | Wants a genuine photo to fail verification.                                                      |
| Malicious notary    | Controls the relayer and its sponsor key.                                                        |
| Network observer    | Reads all public chain data.                                                                     |
| Spammer             | Sends many requests to the notary.                                                               |

## Threats and mitigations

| #   | Threat                                                       | Mitigation                                                                                                                                                                  | Residual risk                                                                                                                                                                                  |
| --- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1  | Edit a sealed photo and present it as authentic.             | SHA-256 exact match, or fingerprint comparison that locates edits; altered images return `altered`.                                                                         | Edits under about one grid cell (0.1% of the frame) can pass the visual check. The exact hash check still fails, and the verdict says "visual" rather than "exact".                            |
| T2  | Seal an edited or generated image to begin with.             | Camera captures go from camera frame to signature in the app. Imports are labelled `import` in the signed manifest and in every verdict.                                    | A modified client or an emulated camera can feed arbitrary frames. Mitigation on the roadmap: hardware-backed device attestation (Play Integrity, App Attest) and registered business devices. |
| T3  | Photograph a screen or a staged scene.                       | Out of scope for pixel provenance.                                                                                                                                          | Witness proves when and by which device, not that the scene is real. Stated on the landing page.                                                                                               |
| T4  | Backdate a capture.                                          | The manifest references a finalized block hash; the capture cannot predate it. The notary rejects references older than 30 blocks; verifiers reject windows over 50 blocks. | A window of up to 5 minutes.                                                                                                                                                                   |
| T5  | Postdate or pre-register a photo before an event.            | The anchor block bounds the capture from above; contracts such as ClaimGate require `anchor.blockNumber >= claim.openedAt`.                                                 | None beyond T4.                                                                                                                                                                                |
| T6  | Re-use one genuine photo for several claims.                 | Content hashes are unique in the registry. ClaimGate marks evidence as used.                                                                                                | Integrators must track usage, as ClaimGate does.                                                                                                                                               |
| T7  | Front-run: anchor someone else's photo first under your key. | First write wins, and the capture window binds an anchor to the referenced block, so a late copier's anchor is visibly later. Integrators can require a trusted submitter.  | A copier who obtains the file before it is anchored, in the seconds between capture and submission. Same-device submission removes this.                                                       |
| T8  | Malicious notary alters a capture.                           | The notary cannot produce device signatures; the manifest digest and signer are anchored and checked by verifiers.                                                          | None.                                                                                                                                                                                          |
| T9  | Malicious notary censors or delays.                          | The registry is permissionless; captures can be self-submitted with any funded account.                                                                                     | Availability only.                                                                                                                                                                             |
| T10 | Malicious RPC node returns fake data.                        | Envelopes are verified against signatures and the anchored digest. A lying node can hide data (availability), not forge it. Verifiers can switch nodes.                     | Availability only.                                                                                                                                                                             |
| T11 | Replay a capture on another network.                         | Manifests include the network name and genesis hash; the notary rejects mismatches.                                                                                         | None.                                                                                                                                                                                          |
| T12 | Spam the notary to drain the sponsor.                        | Per-address and per-device token buckets, a 160 KB body limit, full validation before any chain call, duplicate check before paying.                                        | A distributed attacker with many device keys. Production deployments add account-level quotas tied to business API keys.                                                                       |
| T13 | Learn private image content from public data.                | Only hashes and a 32 by 32 colour grid are published by default. Previews are opt-in.                                                                                       | The grid reveals the rough colour layout of a scene at 32 by 32 resolution.                                                                                                                    |
| T14 | Steal the device key.                                        | Stored in browser storage only; never transmitted.                                                                                                                          | A compromised browser can sign as the device. Business devices should use registered, revocable keys.                                                                                          |
| T15 | Exploit the registry contract.                               | No owner, no upgradeability, no external calls, custom errors, one slot per anchor, every revert path covered by tests.                                                     | Compiler or runtime bugs in pallet-revive.                                                                                                                                                     |

## Assumptions

- Ed25519, SHA-256 and Keccak-256 are secure.
- Portaldot finality is honest: finalized blocks are not reverted.
- The verifier runs unmodified open-source code. Anyone can check this by building it.

## Reviewing this document

Update this threat model in the same pull request as any change to the manifest, the verification rules, the notary's checks or the contracts.
