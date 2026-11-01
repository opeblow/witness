# Security policy

Witness produces evidence that people may use to settle disputes and release money. We treat any flaw that could make a forged, edited or replayed capture verify as authentic as critical.

## Supported versions

| Component                                 | Version                       | Supported |
| ----------------------------------------- | ----------------------------- | --------- |
| `@witness/core`, `@witness/sdk`           | 0.1.x                         | Yes       |
| `WitnessRegistry` on Portaldot V3 testnet | as recorded in `deployments/` | Yes       |
| Notary service                            | 0.1.x                         | Yes       |

Witness currently runs on the Portaldot V3 **testnet**. Do not rely on it as sole evidence of record yet.

## Reporting a vulnerability

Please **do not open a public issue**. Use GitHub's private vulnerability reporting: open the repository's **Security** tab and choose **Report a vulnerability**.

Include:

- what an attacker can achieve (for example, "an edited image verifies as authentic");
- steps to reproduce, ideally a failing test against `packages/core` or a script against the testnet;
- the commit or deployment you tested.

We will acknowledge your report within 3 working days, give an initial assessment within 7, and keep you informed until it is fixed. We credit reporters in the release notes unless you ask us not to.

## Scope

In scope:

- verification returning `authentic` for an image that is not the sealed original, or that was sealed by someone else;
- forging, replaying or front-running a capture so it appears earlier or from another signer;
- the notary anchoring something other than what the device signed, or spending more than one capture's fees per request;
- `WitnessRegistry` or `ClaimGate` allowing an anchor to be overwritten, or a payout without valid evidence;
- leaks of the device key or of photos the user chose not to publish.

Out of scope:

- limits documented in [docs/threat-model.md](docs/threat-model.md), such as photographing a screen;
- denial of service against the public testnet RPC endpoints, which Witness does not operate;
- issues in third-party dependencies with no demonstrated impact on Witness.

## Handling secrets

- The notary's sponsor key is read from the `NOTARY_SEED` environment variable or the git-ignored `.secrets/notary.env`. It is never logged.
- Device keys never leave the browser. Only public keys appear in signed manifests.
- If you find a secret committed to this repository, report it privately as above.
