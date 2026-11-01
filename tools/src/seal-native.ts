/**
 * Seals one capture on the live testnet using only the native runtime:
 * `transactionStorage.store(envelope)`. No contract is involved, so it needs
 * no storage deposit, only the transaction fee (about 0.43 tPOT for a 4 KB envelope).
 *
 * It then reads the envelope back from the block and checks it, and appends the
 * result to deployments/portaldot-v3-testnet.evidence.json.
 *
 *   npm run seal:native -w @witness/tools
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Keyring } from '@polkadot/keyring';
import { cryptoWaitReady } from '@polkadot/util-crypto';
import {
  createCapture,
  encodeEnvelope,
  generateKeyPair,
  toHex,
  verifyCaptureSignature,
} from '@witness/core';
import {
  connectPortaldot,
  findEnvelope,
  genesisHash,
  latestFinalizedBlock,
  submitAndWatch,
  txOf,
} from '@witness/sdk';
import { REPO_ROOT, formatTokens, network, sponsorSeed } from './env.js';
import { encodePng, testScene } from './png.js';

const EVIDENCE_FILE = resolve(REPO_ROOT, 'deployments/portaldot-v3-testnet.evidence.json');

interface EvidenceEntry {
  readonly mode: 'native';
  readonly contentHash: string;
  readonly blockNumber: number;
  readonly blockHash: string;
  readonly extrinsicHash: string;
  readonly extrinsicIndex: number;
  readonly envelopeBytes: number;
  readonly fee: string;
  readonly sealedAt: string;
  readonly note: string;
}

await cryptoWaitReady();
const net = network();
const api = await connectPortaldot(net.substrateRpc);
const sponsor = new Keyring({ type: 'sr25519', ss58Format: 42 }).addFromUri(sponsorSeed());
const balanceOf = async () =>
  (
    (await api.query['system']?.['account']?.(sponsor.address)) as unknown as {
      data: { free: { toBigInt(): bigint } };
    }
  ).data.free.toBigInt();

const note = process.argv[2] ?? 'Witness native capture';
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
  note,
});
const envelope = encodeEnvelope(signed);
const contentHash = signed.manifest.content.sha256;
console.log(`Capture ${contentHash}`);
console.log(`Envelope ${envelope.length} bytes, references finalized block ${block.number}`);

const before = await balanceOf();
const receipt = await submitAndWatch(
  api,
  txOf(api, 'transactionStorage', 'store')(toHex(envelope)),
  sponsor,
);
const fee = before - (await balanceOf());
console.log(`Sealed in block ${receipt.blockNumber}, extrinsic ${receipt.extrinsicHash}`);
console.log(`Fee ${formatTokens(fee)}`);

const found = await findEnvelope(api, receipt.blockNumber, contentHash);
if (!found) throw new Error('Envelope not found in its block');
const check = {
  ok: verifyCaptureSignature(found.signed) && found.signed.manifest.content.sha256 === contentHash,
};
console.log(`Read back from chain: ${check.ok ? 'signature and manifest valid' : 'INVALID'}`);

const entries: EvidenceEntry[] = existsSync(EVIDENCE_FILE)
  ? (JSON.parse(readFileSync(EVIDENCE_FILE, 'utf8')) as EvidenceEntry[])
  : [];
entries.push({
  mode: 'native',
  contentHash,
  blockNumber: receipt.blockNumber,
  blockHash: found.blockHash,
  extrinsicHash: receipt.extrinsicHash,
  extrinsicIndex: found.extrinsicIndex,
  envelopeBytes: envelope.length,
  fee: fee.toString(),
  sealedAt: new Date().toISOString(),
  note,
});
writeFileSync(EVIDENCE_FILE, `${JSON.stringify(entries, null, 2)}\n`);
writeFileSync(resolve(REPO_ROOT, `tools/out/native-${contentHash.slice(2, 10)}.png`), file);

await api.disconnect();
process.exit(check.ok ? 0 : 1);
