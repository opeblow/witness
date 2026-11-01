# Notary HTTP API

Base URL: wherever the notary runs (`http://localhost:8787` in development). All responses are JSON. Errors have the shape `{ "error": { "code": string, "message": string } }`.

## `GET /healthz`

Liveness probe.

```json
{ "status": "ok" }
```

## `GET /v1/info`

```json
{
  "network": "portaldot-v3-testnet",
  "registry": "0x...",
  "sponsor": "5EfBp5ihb1Cd...",
  "sponsorEvm": "0x1c0cf5dd...",
  "maxCaptureWindowBlocks": 30,
  "version": "0.1.0"
}
```

`sponsorEvm` is the address that appears as `submitter` in the registry. Contracts that trust this notary, such as ClaimGate, whitelist it.

## `POST /v1/captures`

Anchors one signed capture.

Request:

```json
{ "envelope": "<base64 of the witness:v1 envelope>" }
```

The body must be at most 160 KB and contain no other fields.

Success, `201 Created`:

```json
{
  "contentHash": "0x...",
  "blockNumber": 276104,
  "blockHash": "0x...",
  "extrinsicHash": "0x...",
  "extrinsicIndex": 2,
  "submitter": "5EfBp5ihb1Cd..."
}
```

The response is returned once the extrinsic is included in a block. Finality follows within a few blocks.

### Errors

| Status | Code                | Meaning                                                           |
| ------ | ------------------- | ----------------------------------------------------------------- |
| 400    | `invalid_request`   | Malformed JSON, extra fields, bad base64 or body too large.       |
| 422    | `invalid_envelope`  | Not a Witness envelope, or the manifest fails validation.         |
| 422    | `bad_signature`     | The signature does not verify.                                    |
| 422    | `wrong_network`     | The manifest names another network or genesis hash.               |
| 422    | `unknown_block`     | The referenced block does not exist with that hash.               |
| 422    | `stale_block`       | The referenced block is more than `maxCaptureWindowBlocks` old.   |
| 409    | `already_anchored`  | This file is already in the registry.                             |
| 429    | `rate_limited`      | Too many requests from this address or device. See `retry-after`. |
| 502    | `submission_failed` | The chain rejected the extrinsic.                                 |
| 503    | `not_configured`    | No registry is configured.                                        |

### Limits

| Limit                       | Default       | Setting                     |
| --------------------------- | ------------- | --------------------------- |
| Requests per client address | 12 per minute | `RATE_LIMIT_PER_MINUTE`     |
| Captures per device key     | 120 per hour  | `SIGNER_LIMIT_PER_HOUR`     |
| Capture window              | 30 blocks     | `MAX_CAPTURE_WINDOW_BLOCKS` |

All checks run before any chain write, so rejected requests cost the sponsor nothing.
