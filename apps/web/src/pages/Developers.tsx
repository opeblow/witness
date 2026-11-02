import { DEPLOYMENT, NETWORK, REPOSITORY_URL } from '../lib/config';
import './app.css';

const blocks = {
  install: `git clone ${REPOSITORY_URL}
cd witness && npm install
npm test                 # 69 TypeScript tests
npm run test:contracts   # 13 Solidity tests
npm run verify:live      # read-only audit of the live deployment`,
  verify: `import { RegistryClient, connectPortaldot, verifyImage, PORTALDOT_V3_TESTNET, withDeployment } from '@witness/sdk';

const network = withDeployment(PORTALDOT_V3_TESTNET, deployment);
const { verdict } = await verifyImage(
  { file, raster },          // file bytes and decoded RGBA pixels
  { registry: new RegistryClient(network), api: () => connectPortaldot(network.substrateRpc) },
);

switch (verdict.status) {
  case 'authentic':  /* verdict.match is 'exact' or 'visual' */ break;
  case 'altered':    /* verdict.comparison.regions locates the edit */ break;
  case 'reframed':   /* cropped copy of a sealed photo */ break;
  case 'invalid':    /* a record exists but fails integrity checks */ break;
  case 'unverified': /* never sealed */ break;
}`,
  capture: `import { createCapture, generateKeyPair } from '@witness/core';
import { NotaryClient, connectPortaldot, latestFinalizedBlock, genesisHash } from '@witness/sdk';

const api = await connectPortaldot(network.substrateRpc);
const signed = createCapture({
  file, mime: 'image/jpeg', raster, keys, source: 'camera',
  block: await latestFinalizedBlock(api),
  network: { name: network.name, genesis: genesisHash(api) },
});
const receipt = await new NotaryClient(NOTARY_URL).submit(signed);`,
  extrinsic: `utility.batchAll([
  transactionStorage.store(envelope),            // signed evidence, native pallet
  revive.call(WitnessRegistry, 0, weight, deposit,
    anchor(contentHash, manifestDigest, signer, dhash)),  // Solidity anchor
])`,
  http: `POST /v1/captures
content-type: application/json

{ "envelope": "<base64 of witness:v1 envelope>" }

201 { "contentHash", "blockNumber", "blockHash", "extrinsicHash", "extrinsicIndex", "submitter" }
409 { "error": { "code": "already_anchored" } }
422 { "error": { "code": "bad_signature" | "stale_block" | "unknown_block" | "wrong_network" } }
429 { "error": { "code": "rate_limited" } }   retry-after: <seconds>`,
  solidity: `interface IWitnessRegistry {
  struct Anchor { address submitter; uint32 blockNumber; uint64 dhash; }
  function anchorOf(bytes32 contentHash) external view returns (Anchor memory);
  function isAnchored(bytes32 contentHash) external view returns (bool);
  event Anchored(bytes32 indexed contentHash, bytes32 indexed signer, address indexed submitter,
                 bytes32 manifestDigest, uint64 dhash, uint32 blockNumber);
}`,
};

export function Developers() {
  return (
    <div className="app-page page">
      <header className="app-head">
        <div>
          <p className="label">Developers</p>
          <h1 className="h1">Build on witnessed evidence.</h1>
          <p className="lede">
            Two TypeScript packages, one Solidity registry and an HTTP notary. Everything is open
            source and every claim on this page is covered by a test.
          </p>
        </div>
      </header>

      <div className="docs">
        <nav className="docs-nav" aria-label="On this page">
          <span className="label">On this page</span>
          <a href="#network">Network</a>
          <a href="#quickstart">Quickstart</a>
          <a href="#verify">Verify an image</a>
          <a href="#capture">Create a capture</a>
          <a href="#extrinsic">The capture extrinsic</a>
          <a href="#contract">Read from Solidity</a>
          <a href="#notary">Notary API</a>
        </nav>
        <div className="docs-body">
          <section id="network">
            <h2 className="h2">Network</h2>
            <dl className="facts">
              <dt>Substrate RPC</dt>
              <dd className="mono">{NETWORK.substrateRpc}</dd>
              <dt>EVM RPC</dt>
              <dd className="mono">{NETWORK.evmRpc}</dd>
              <dt>Chain id</dt>
              <dd className="mono">{NETWORK.evmChainId}</dd>
              <dt>Registry</dt>
              <dd className="mono">{NETWORK.registry ?? 'not deployed in this build'}</dd>
              <dt>Deployed in</dt>
              <dd className="mono">{DEPLOYMENT ? `block ${DEPLOYMENT.deploymentBlock}` : '-'}</dd>
              <dt>Token</dt>
              <dd className="mono">
                {NETWORK.tokenSymbol}, {NETWORK.tokenDecimals} decimals natively (18 on the EVM
                side)
              </dd>
            </dl>
          </section>
          <section id="quickstart">
            <h2 className="h2">Quickstart</h2>
            <pre className="code">
              <code>{blocks.install}</code>
            </pre>
          </section>
          <section id="verify">
            <h2 className="h2">Verify an image</h2>
            <p className="muted">
              <code>verifyImage</code> fingerprints the image, looks up its exact hash, falls back
              to visually similar recent captures, retrieves each signed envelope from the anchoring
              block and decides.
            </p>
            <pre className="code">
              <code>{blocks.verify}</code>
            </pre>
          </section>
          <section id="capture">
            <h2 className="h2">Create a capture</h2>
            <pre className="code">
              <code>{blocks.capture}</code>
            </pre>
          </section>
          <section id="extrinsic">
            <h2 className="h2">The capture extrinsic</h2>
            <p className="muted">
              One native extrinsic writes both halves of a capture. If the registry call reverts,
              the stored evidence is rolled back too.
            </p>
            <pre className="code">
              <code>{blocks.extrinsic}</code>
            </pre>
          </section>
          <section id="contract">
            <h2 className="h2">Read from Solidity</h2>
            <p className="muted">
              See <code>contracts/src/examples/ClaimGate.sol</code> for a complete escrow that
              releases a payout only for fresh evidence from a trusted submitter.
            </p>
            <pre className="code">
              <code>{blocks.solidity}</code>
            </pre>
          </section>
          <section id="notary">
            <h2 className="h2">Notary API</h2>
            <pre className="code">
              <code>{blocks.http}</code>
            </pre>
          </section>
        </div>
      </div>
    </div>
  );
}
