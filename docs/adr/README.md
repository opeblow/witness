# Architecture decision records

Each record captures one decision: its context, the options considered and why we chose what we did. Records are immutable once accepted; a later decision supersedes an earlier one by number.

| #                                           | Decision                                                           | Status   |
| ------------------------------------------- | ------------------------------------------------------------------ | -------- |
| [0001](0001-provenance-over-detection.md)   | Prove originals at capture instead of detecting fakes              | Accepted |
| [0002](0002-atomic-dual-runtime-capture.md) | One atomic batch across TransactionStorage and a Solidity registry | Accepted |
| [0003](0003-registry-storage-layout.md)     | One packed storage slot per anchor; everything else in events      | Accepted |
| [0004](0004-fingerprint-algorithm.md)       | A deterministic 32 by 32 Y/Cb/Cr grid plus dHash                   | Accepted |
| [0005](0005-sponsored-notary.md)            | A sponsoring notary that can relay but not forge                   | Accepted |
