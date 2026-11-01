<div align="center">
  <img src="docs/brand/logo-mark.svg" alt="Witness logo" width="88" />
  <h1>Witness</h1>
  <p><strong>Photographs that can testify.</strong><br />Capture-time evidence for photos, anchored on Portaldot V3.</p>

[![CI](https://github.com/opeblow/witness/actions/workflows/ci.yml/badge.svg)](https://github.com/opeblow/witness/actions/workflows/ci.yml)
[![Contracts](https://github.com/opeblow/witness/actions/workflows/contracts.yml/badge.svg)](https://github.com/opeblow/witness/actions/workflows/contracts.yml)
[![CodeQL](https://github.com/opeblow/witness/actions/workflows/codeql.yml/badge.svg)](https://github.com/opeblow/witness/actions/workflows/codeql.yml)
[![License: Apache 2.0](https://img.shields.io/badge/license-Apache%202.0-15130F)](LICENSE)
[![Network: Portaldot V3 testnet](https://img.shields.io/badge/network-Portaldot%20V3%20testnet-1D6B4A)](https://node-console.portaldot.dev)
[![Tests](https://img.shields.io/badge/tests-67%20TS%20%2B%2013%20Solidity-1D6B4A)](#testing)
[![Node](https://img.shields.io/badge/node-%3E%3D22-15130F)](.nvmrc)

</div>

Witness seals a photo the moment it is taken: who took it, when, and every pixel. The record lives on Portaldot, so neither side of a dispute controls it. Edit one region and verification says exactly where.

Built for **Portaldot Hacker House 2026**, Ecosystem DApps track.

![Witness landing page](docs/screenshots/landing.png)

## The problem

Refund desks, couriers, rental companies and insurers settle disputes with photos, and photos are now trivial to fake. In Verisk's March 2026 survey, 99% of insurers had encountered manipulated or AI-altered claim documentation, and 36% of consumers said they would consider editing a claim photo. Detection tools are an arms race that every new model resets.

Witness flips the question from "is this fake?" to **"is this the photo that was taken?"**

## How it works

| Proof    | How                                                                                                               |
| -------- | ----------------------------------------------------------------------------------------------------------------- |
| **When** | The device embeds the latest finalized block before signing; anchoring bounds it from above. A window of seconds. |
| **Who**  | Every capture is signed with an Ed25519 device key, nameable through Portaldot Identity.                          |
| **What** | The exact SHA-256, plus a 3,072-byte colour fingerprint that survives re-compression and locates edits.           |

Each capture is **one atomic Portaldot extrinsic** that uses both runtimes:

```text
utility.batchAll([
  transactionStorage.store(signedEnvelope),            // native pallet: the evidence
  revive.call(WitnessRegistry, anchor(contentHash, …)) // Solidity: permanent, first-write-wins anchor
])
```

Any Solidity contract can then gate money on witnessed evidence. See [`ClaimGate.sol`](contracts/src/examples/ClaimGate.sol).

## Screenshots

| Verification locates the edit                                                                                                                         | Capture                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| ![Edited copy flagged](docs/screenshots/landing-edited.png) The hero toggles between a sealed original and an edited copy, showing the changed cells. | ![Capture page](docs/screenshots/capture.png) Camera-first capture with a live chain clock. Imports are labelled as weaker evidence. |
| ![Verify page](docs/screenshots/verify.png) Verification runs in the browser; the image never leaves the device.                                      | ![Mobile](docs/screenshots/mobile.png) Responsive down to phone width.                                                               |

## Repository

| Path                                 | Contents                                                                                                                                                 |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`packages/core`](packages/core)     | Pure primitives: canonical manifests, fingerprints, signatures, comparison, verdicts                                                                     |
| [`packages/sdk`](packages/sdk)       | Portaldot access: registry, envelope retrieval, capture extrinsic, `verifyImage`                                                                         |
| [`services/notary`](services/notary) | Sponsoring relayer: validates, rate-limits, pays fees; cannot forge                                                                                      |
| [`contracts`](contracts)             | `WitnessRegistry.sol`, `ClaimGate.sol`, Hardhat tests                                                                                                    |
| [`apps/web`](apps/web)               | Landing, capture, verify, record, ledger and developer pages                                                                                             |
| [`tools`](tools)                     | Keys, deployment, live smoke test, `verify:live` audit                                                                                                   |
| [`docs`](docs)                       | [Architecture](docs/architecture.md), [threat model](docs/threat-model.md), [manifest spec](docs/manifest-spec.md), [API](docs/api.md), [ADRs](docs/adr) |

## Quickstart

```bash
npm install
npm test                  # 67 TypeScript tests
npm run test:contracts    # 13 Solidity tests
npm run dev               # web app on http://localhost:5173
```

Deploying to the testnet: see [docs/deployment.md](docs/deployment.md).

## Testing

- **Core:** synthetic scenes cover re-encoding, resizing, auto-enhance, pasted objects, edits of about 2% of the frame, colour-only edits, crops and unrelated pictures.
- **Notary:** every rejection path (bad signature, wrong network, stale or unknown block, duplicates, rate limits, chain failure) against a fake chain.
- **Contracts:** first-write-wins, single-slot storage layout, and every ClaimGate revert path.

## Limits

Witness proves provenance of pixels, not truth of the scene: a photographed screen is still a genuine photo of a screen. Imports are weaker than camera captures and are labelled so. Details are in the [threat model](docs/threat-model.md).

## Contributing and policies

[Contributing](CONTRIBUTING.md) · [Code of conduct](CODE_OF_CONDUCT.md) · [Security](SECURITY.md) · [Privacy](PRIVACY.md) · [Support](SUPPORT.md) · [Changelog](CHANGELOG.md)

## License

[Apache License 2.0](LICENSE)
