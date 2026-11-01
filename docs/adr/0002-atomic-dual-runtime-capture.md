# 0002. One atomic batch across TransactionStorage and a Solidity registry

Status: Accepted, 2026-11-01

## Context

A capture needs two things on chain:

1. the signed evidence itself (about 4.6 KB, more with a preview), so anyone can verify without trusting a server;
2. a lookup from content hash to capture that Solidity contracts can read, so money can move on witnessed evidence.

Portaldot V3 offers native pallets and two contract runtimes (pallet-contracts for ink!, pallet-revive for Solidity). Its storage deposit on pallet-revive is 0.06 tPOT per byte, which makes storing evidence in contract storage expensive.

Options considered:

| Option                                                             | Evidence cost          | Contract-readable | Atomic                               |
| ------------------------------------------------------------------ | ---------------------- | ----------------- | ------------------------------------ |
| Everything in contract storage                                     | Very high              | Yes               | Yes                                  |
| Evidence on IPFS, hash in contract                                 | Low, but needs pinning | Yes               | No, and depends on a pinning service |
| `system.remarkWithEvent` plus an indexer                           | Low                    | No                | n/a                                  |
| TransactionStorage plus a Solidity registry, in `utility.batchAll` | Low                    | Yes               | Yes                                  |

## Decision

Each capture is one native extrinsic:

```text
utility.batchAll([transactionStorage.store(envelope), revive.call(WitnessRegistry, anchor(...))])
```

TransactionStorage is Portaldot's native pallet for storing data with validator-provable availability. The registry on pallet-revive holds a compact anchor that any Solidity contract can query. `batchAll` makes the pair atomic: if the anchor reverts, the evidence is not stored.

## Consequences

- One user action exercises Portaldot's native pallets and its EVM runtime in the same extrinsic, which is something a single-runtime chain cannot offer.
- Retrieving evidence needs a Substrate RPC (block bodies) as well as the EVM RPC. The SDK hides this.
- TransactionStorage retains data for its retention period (100,800 blocks on testnet) unless renewed. Anchors are permanent, and certificates cover the gap; renewal is an operator service (see [0005](0005-sponsored-notary.md)).
