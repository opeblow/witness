# 0005. A sponsoring notary that can relay but not forge

Status: Accepted, 2026-11-01

## Context

The people who take evidence photos (couriers, renters, claimants) will not hold tokens or run wallets. Someone has to pay transaction fees and storage deposits. That party must not become a trusted authority over the evidence.

## Decision

A notary service receives signed envelopes over HTTP and submits them with its own funded account.

- The device signs; the notary cannot produce or alter signatures.
- The manifest digest and signer are anchored on chain and checked by every verifier, so the notary cannot swap in a different manifest.
- The notary validates everything that would make a capture invalid (signature, network, block freshness, duplicates) before spending anything, and serialises submissions to avoid nonce races.
- The registry stays permissionless: anyone can anchor with any funded account, so a censoring notary can be bypassed.

## Alternatives

- **Users pay fees.** Excludes the users who need Witness most.
- **pallet-meta-tx.** The runtime exposes `metaTx.dispatch`, which would let devices sign the extrinsic itself and the notary pay. It removes even the relay's ability to choose what to submit, but its extension encoding is undocumented on Portaldot today. It is the planned upgrade path; the envelope format does not change.
- **Proxy accounts per business.** Useful for enterprises that want their own fee account; compatible with this design.

## Consequences

- The notary is the business model's metering point: businesses buy sealed captures, and the notary's submitter address is what integrators such as ClaimGate whitelist.
- Availability depends on the notary or a fallback submitter. Integrity does not.
- Sponsor funds are at risk from spam; per-address and per-device rate limits and pre-submission validation bound the loss.
