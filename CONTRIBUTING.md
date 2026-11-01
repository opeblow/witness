# Contributing to Witness

Thank you for helping. Witness handles evidence people may rely on in disputes, so we hold changes to a high bar: every behaviour is tested, every claim in the product is true, and every limit is stated.

## Ground rules

- Be kind. This project follows the [Code of Conduct](CODE_OF_CONDUCT.md).
- Report security issues privately. See [SECURITY.md](SECURITY.md). Never open a public issue for a vulnerability.
- Discuss large changes in an issue before writing code, especially anything that touches the manifest format, the fingerprint algorithm or the registry contract. Those are protocol changes. See [docs/adr](docs/adr) for how we record them.

## Repository layout

| Path              | What lives there                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------- |
| `packages/core`   | Pure, deterministic primitives: manifests, fingerprints, signatures, verdicts. No network access. |
| `packages/sdk`    | Portaldot access: registry reads, envelope retrieval, the capture extrinsic, the verify pipeline. |
| `services/notary` | HTTP relayer that validates captures and pays their fees.                                         |
| `contracts`       | `WitnessRegistry.sol` and the `ClaimGate.sol` example, with Hardhat tests.                        |
| `apps/web`        | The web app: landing, capture, verify, record, ledger and developer pages.                        |
| `tools`           | Operator scripts: keys, deployment, smoke test, live verification.                                |
| `docs`            | Architecture, threat model, specifications and decision records.                                  |

## Getting set up

Requirements: Node.js 22 or newer and npm 10 or newer.

```bash
npm install
npm test                 # builds packages, runs all TypeScript tests
npm run test:contracts   # compiles and tests the Solidity contracts
npm run lint
npm run typecheck
npm run dev              # web app on http://localhost:5173
```

To run the notary locally you need a funded testnet key. See [docs/deployment.md](docs/deployment.md).

## Making a change

1. Fork the repository and create a branch from `main`: `feat/short-description` or `fix/short-description`.
2. Write the test first when fixing a bug. A fix without a test that fails before it will be asked for one.
3. Keep `packages/core` free of I/O. If it needs the network, it belongs in `packages/sdk`.
4. Run `npm run lint`, `npm run typecheck`, `npm test` and, if you touched Solidity, `npm run test:contracts`.
5. Update documentation in the same pull request. If a user-visible behaviour changed, add a line to [CHANGELOG.md](CHANGELOG.md) under "Unreleased".
6. Open a pull request using the template. Describe what changed, why, and how you verified it.

### Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org/): `feat(core): ...`, `fix(notary): ...`, `docs: ...`, `test(contracts): ...`, `chore: ...`. Keep the subject under 72 characters and explain the reasoning in the body.

### Protocol changes

Changes to any of the following need an architecture decision record in `docs/adr` and a version bump:

- the manifest schema or its canonical encoding (`MANIFEST_VERSION`);
- the fingerprint algorithm or its tuning (`FINGERPRINT_ALG`);
- the envelope format (`ENVELOPE_MAGIC`);
- the registry's storage layout or events.

Old captures must stay verifiable. A change that would make an existing capture verify differently is a breaking change and needs a migration plan.

## Style

- TypeScript in strict mode, including `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`.
- Prettier formats, ESLint lints; CI enforces both.
- Solidity: 0.8.28, custom errors instead of revert strings, NatSpec on every external function.
- User-facing copy is plain, short and accurate. No exaggeration, no emojis.

## Review

A maintainer reviews every pull request. We look for correctness first, then tests, then clarity. Expect questions; they are about the code, not about you.

## Licence

By contributing you agree that your contributions are licensed under the [Apache License 2.0](LICENSE).
