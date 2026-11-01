/**
 * End-to-end check against the live testnet, using the same code paths as the app:
 * create a capture of a generated image, anchor it atomically (TransactionStorage
 * + WitnessRegistry in one batch), then verify the original, a re-encoded copy and
 * an edited copy straight from the chain.
 *
 *   npm run smoke -w @witness/tools
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Keyring } from '@polkadot/keyring';
import { cryptoWaitReady } from '@polkadot/util-crypto';
import {
  type Raster,
  createCapture,
  encodeEnvelope,
  generateKeyPair,
  manifestDigest,
} from '@witness/core';
import {
  RegistryClient,
  buildCaptureExtrinsic,
  connectPortaldot,
  encodeAnchorCall,
  genesisHash,
  latestFinalizedBlock,
  submitAndWatch,
  verifyImage,
} from '@witness/sdk';
import { REPO_ROOT, formatTokens, network, sponsorSeed } from './env.js';
import { encodePng, testScene } from './png.js';

await cryptoWaitReady();
const net = network();
if (!net.registry) throw new Error('Deploy the registry first: npm run deploy:registry');
const api = await connectPortaldot(net.substrateRpc);
const sponsor = new Keyring({ type: 'sr25519', ss58Format: 42 }).addFromUri(sponsorSeed());
const registry = new RegistryClient(net);
const balanceOf = async () =>
  (
    (await api.query['system']?.['account']?.(sponsor.address)) as unknown as {
      data: { free: { toBigInt(): bigint } };
    }
  ).data.free.toBigInt();

const raster = testScene(640, 480, Date.now() % 100_000);
const file = encodePng(raster);
const block = await latestFinalizedBlock(api);
const signed = createCapture({
  file,
  mime: 'image/png',
  raster,
  keys: generateKeyPair(),
  source: 'import',
  block,
  network: { name: net.name, genesis: genesisHash(api) },
  note: 'Witness smoke test',
});
const envelope = encodeEnvelope(signed);
console.log(`Capture ${signed.manifest.content.sha256}`);
console.log(`Envelope ${envelope.length} bytes, references block ${block.number}`);

const before = await balanceOf();
const receipt = await submitAndWatch(
  api,
  buildCaptureExtrinsic(api, {
    envelope,
    registry: net.registry,
    anchorCalldata: encodeAnchorCall({
      contentHash: signed.manifest.content.sha256,
      manifestDigest: manifestDigest(signed.manifest),
      signer: signed.manifest.signer.key,
      dhash: signed.manifest.fingerprint.dhash,
    }),
  }),
  sponsor,
);
const cost = before - (await balanceOf());
console.log(
  `Anchored in block ${receipt.blockNumber} (${receipt.blockHash}), extrinsic ${receipt.extrinsicHash}`,
);
console.log(`Cost per capture including storage deposit: ${formatTokens(cost)}`);

// The EVM RPC indexes blocks shortly after inclusion.
await new Promise((r) => setTimeout(r, 8000));

const deps = { registry, api: async () => api };
const edited: Raster = (() => {
  const data = Uint8ClampedArray.from(raster.data);
  for (let y = 150; y < 260; y++)
    for (let x = 300; x < 420; x++) data.set([245, 240, 230], (y * 640 + x) * 4);
  return { width: 640, height: 480, data };
})();
const reencoded: Raster = {
  width: 640,
  height: 480,
  data: Uint8ClampedArray.from(raster.data, (v, i) => (i % 4 === 3 ? v : Math.round(v / 5) * 5)),
};

const results = [
  ['original file', await verifyImage({ file, raster }, deps)],
  ['re-encoded copy', await verifyImage({ file: encodePng(reencoded), raster: reencoded }, deps)],
  ['edited copy', await verifyImage({ file: encodePng(edited), raster: edited }, deps)],
] as const;

let ok = true;
const expected = ['authentic', 'authentic', 'altered'];
results.forEach(([label, result], i) => {
  const pass = result.verdict.status === expected[i];
  ok &&= pass;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label.padEnd(16)} -> ${result.verdict.status}`);
});

const outDir = resolve(REPO_ROOT, 'tools/out');
mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, 'smoke-original.png'), file);
writeFileSync(resolve(outDir, 'smoke-edited.png'), encodePng(edited));
writeFileSync(
  resolve(outDir, 'smoke-receipt.json'),
  `${JSON.stringify({ contentHash: signed.manifest.content.sha256, ...receipt, events: undefined, cost: cost.toString() }, null, 2)}\n`,
);
await api.disconnect();
process.exit(ok ? 0 : 1);
