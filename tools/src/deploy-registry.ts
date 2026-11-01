/**
 * Deploys WitnessRegistry to Portaldot V3 through pallet-revive's native
 * `instantiateWithCode`, signed by the sponsor key, and records the result in
 * deployments/portaldot-v3-testnet.json.
 *
 * Prerequisite: `npm run build -w @witness/contracts` (Hardhat compile).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Keyring } from '@polkadot/keyring';
import { cryptoWaitReady } from '@polkadot/util-crypto';
import type { Hex } from '@witness/core';
import { type DeploymentRecord, connectPortaldot, submitAndWatch, txOf } from '@witness/sdk';
import {
  DEPLOYMENT_FILE,
  REPO_ROOT,
  formatTokens,
  network,
  readDeployment,
  sponsorSeed,
} from './env.js';

const ARTIFACT = resolve(
  REPO_ROOT,
  'contracts/artifacts/src/WitnessRegistry.sol/WitnessRegistry.json',
);

await cryptoWaitReady();
const existing = readDeployment();
if (existing && !process.argv.includes('--force')) {
  console.log(
    `WitnessRegistry is already deployed at ${existing.registry} (block ${existing.deploymentBlock}).`,
  );
  console.log('Pass --force to deploy a new instance.');
  process.exit(0);
}

const { bytecode } = JSON.parse(readFileSync(ARTIFACT, 'utf8')) as { bytecode: Hex };
const net = network();
const api = await connectPortaldot(net.substrateRpc);
const sponsor = new Keyring({ type: 'sr25519', ss58Format: 42 }).addFromUri(sponsorSeed());

const account = (await api.query['system']?.['account']?.(sponsor.address)) as unknown as {
  data: { free: { toBigInt(): bigint } };
};
console.log(`Deployer ${sponsor.address}, balance ${formatTokens(account.data.free.toBigInt())}`);
console.log(`Bytecode ${(bytecode.length - 2) / 2} bytes`);

const extrinsic = txOf(api, 'revive', 'instantiateWithCode')(
  0,
  { refTime: 500_000_000_000n, proofSize: 2_000_000n },
  2_000n * 10n ** 14n,
  bytecode,
  '0x',
  null,
);
const receipt = await submitAndWatch(api, extrinsic, sponsor);

const instantiated = receipt.events.find(
  (e) => e.event.section === 'revive' && e.event.method === 'Instantiated',
);
if (!instantiated) {
  console.error('Included, but no revive.Instantiated event was emitted:');
  for (const e of receipt.events) console.error(`  ${e.event.section}.${e.event.method}`);
  process.exit(1);
}
const data = instantiated.event.data.toJSON() as unknown[] | Record<string, unknown>;
const contract = (
  Array.isArray(data) ? data[1] : (data['contract'] ?? Object.values(data)[1])
) as string;

const record: DeploymentRecord = {
  network: net.name,
  registry: contract.toLowerCase() as Hex,
  deploymentBlock: receipt.blockNumber,
  deploymentExtrinsic: receipt.extrinsicHash,
  deployer: sponsor.address,
  deployedAt: new Date().toISOString(),
};
writeFileSync(DEPLOYMENT_FILE, `${JSON.stringify(record, null, 2)}\n`);

const after = (await api.query['system']?.['account']?.(sponsor.address)) as unknown as {
  data: { free: { toBigInt(): bigint } };
};
console.log(`WitnessRegistry deployed at ${record.registry}`);
console.log(`Block ${record.deploymentBlock}, extrinsic ${record.deploymentExtrinsic}`);
console.log(
  `Cost including deposits: ${formatTokens(account.data.free.toBigInt() - after.data.free.toBigInt())}`,
);
console.log(`Wrote ${DEPLOYMENT_FILE}`);
await api.disconnect();
