# 0003. One packed storage slot per anchor; everything else in events

Status: Accepted, 2026-11-01

## Context

pallet-revive on the Portaldot V3 testnet charges `depositPerItem = 0.15 tPOT` and `depositPerByte = 0.06 tPOT` for contract storage (values read from the runtime's constants). Every byte in the registry is paid for by the submitter.

Contracts integrating Witness need to answer three questions on chain: was this file anchored, when, and by whom? They do not need the manifest digest, the signer key or the fingerprint grid.

## Decision

```solidity
struct Anchor { address submitter; uint32 blockNumber; uint64 dhash; }   // 20 + 4 + 8 = 32 bytes
mapping(bytes32 contentHash => Anchor) private _anchors;
```

One slot per capture. The manifest digest and signer go into the indexed `Anchored` event, which costs no storage deposit and is permanent in block history. The dHash is stored because it lets contracts and indexers group copies of the same picture without reading events.

A running `anchorCount` uses one shared slot that is created once.

## Alternatives

- **Event only, no storage.** Cheapest, but contracts cannot read events, so ClaimGate-style integrations would be impossible and first-write-wins could not be enforced.
- **Full record in storage.** Simple to read, but roughly three times the deposit per capture.
- **Merkle batching.** One root per batch of captures, with inclusion proofs in certificates. Lowest cost at scale; adds latency and proof handling to every integration. Planned for the enterprise tier as `WitnessBatchRegistry`, alongside this contract, not replacing it.

## Consequences

- The per-capture cost is dominated by one storage item. `npm run smoke -w @witness/tools` reports the measured cost.
- `blockNumber` is `uint32`, which lasts about 800 years at 6-second blocks; the contract reverts with `BlockNumberOverflow` rather than truncating.
- The registry has no owner and no upgrade path. A new layout means a new contract, and verifiers will read both.
