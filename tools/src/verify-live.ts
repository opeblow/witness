/**
 * Read-only audit of the live deployment. Anyone can run it; it needs no keys.
 *
 *   npm run verify:live
 *
 * Checks that the registry has code, that recent anchors resolve to signed envelopes
 * stored in the same block, and that every envelope passes all integrity checks.
 */
import { checkIntegrity, integrityProblems } from '@witness/core';
import { RegistryClient, connectPortaldot, resolveEvidence } from '@witness/sdk';
import { network } from './env.js';

const net = network();
let failures = 0;
const check = (label: string, pass: boolean, detail = '') => {
  if (!pass) failures++;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
};

if (!net.registry) {
  console.log('No deployment recorded in deployments/portaldot-v3-testnet.json.');
  process.exit(1);
}

const code = (await fetch(net.evmRpc, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'eth_getCode',
    params: [net.registry, 'latest'],
  }),
}).then((r) => r.json())) as { result?: string };
check(
  'WitnessRegistry has code on chain',
  (code.result?.length ?? 0) > 2,
  `${((code.result?.length ?? 2) - 2) / 2} bytes`,
);

const api = await connectPortaldot(net.substrateRpc);
const registry = new RegistryClient(net, undefined, async () => api);
const count = await registry.anchorCount();
check('Registry reports its anchor count', count >= 0, `${count} anchors`);

const recent = await registry.recent({ limit: 10 });
console.log(`Checking the ${recent.length} most recent anchors`);
for (const anchor of recent) {
  const evidence = await resolveEvidence(anchor, async () => api);
  const id = `${anchor.contentHash.slice(0, 18)}... block ${anchor.blockNumber}`;
  if (!evidence) {
    check(`${id} envelope retrievable`, false, 'not found in its block');
    continue;
  }
  const problems = integrityProblems(checkIntegrity(evidence));
  check(
    `${id} intact`,
    problems.length === 0,
    problems.join(' ') || evidence.signed.manifest.capture.source,
  );
}

await api.disconnect();
console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
