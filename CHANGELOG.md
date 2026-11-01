# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-11-01

### Added

- `@witness/core`: canonical manifests, Ed25519 capture signatures, SS58 encoding, deterministic area resampling, the `witness-fp-1` fingerprint (64-bit dHash plus a 32 by 32 Y/Cb/Cr grid), edit localisation, crop detection and the verdict engine.
- `@witness/sdk`: `WitnessRegistry` client over Portaldot's EVM JSON-RPC, envelope retrieval from native blocks, the atomic capture extrinsic (`utility.batchAll[transactionStorage.store, revive.call]`), certificates and the `verifyImage` pipeline.
- `WitnessRegistry.sol`: permanent, first-write-wins anchors packed into one storage slot, with an `Anchored` event carrying the manifest digest and signer.
- `ClaimGate.sol`: reference escrow that pays out only for fresh evidence from a trusted submitter, and never twice for the same photo.
- Notary service: validation, block freshness and network checks, duplicate detection, per-address and per-device rate limits, serialised submission.
- Web app: landing page, camera capture, file import, verification with edit highlighting, public record pages, live ledger and developer reference.
- Operator tools: key generation, registry deployment, live smoke test and read-only `verify:live` audit.
- Documentation: architecture, threat model, manifest specification, notary API, deployment guide, design system and decision records.
