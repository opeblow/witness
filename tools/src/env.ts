import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type DeploymentRecord, PORTALDOT_V3_TESTNET, withDeployment } from '@witness/sdk';

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const SECRETS_FILE = resolve(REPO_ROOT, '.secrets/notary.env');
export const DEPLOYMENT_FILE = resolve(REPO_ROOT, 'deployments/portaldot-v3-testnet.json');

/** Reads NOTARY_SEED from the environment, falling back to .secrets/notary.env. */
export function sponsorSeed(): string {
  if (process.env.NOTARY_SEED) return process.env.NOTARY_SEED;
  if (existsSync(SECRETS_FILE)) {
    const line = readFileSync(SECRETS_FILE, 'utf8')
      .split(/\r?\n/)
      .find((l) => l.startsWith('NOTARY_SEED='));
    if (line) return line.slice('NOTARY_SEED='.length).replace(/^"|"$/g, '');
  }
  throw new Error('No sponsor key. Run `npm run keys -w @witness/tools` or set NOTARY_SEED.');
}

export function readDeployment(): DeploymentRecord | null {
  return existsSync(DEPLOYMENT_FILE)
    ? (JSON.parse(readFileSync(DEPLOYMENT_FILE, 'utf8')) as DeploymentRecord)
    : null;
}

export function network() {
  return withDeployment(PORTALDOT_V3_TESTNET, readDeployment());
}

export function formatTokens(
  planck: bigint,
  decimals = PORTALDOT_V3_TESTNET.tokenDecimals,
): string {
  const unit = 10n ** BigInt(decimals);
  const whole = planck / unit;
  const fraction = ((planck % unit) * 10_000n) / unit;
  return `${whole}.${fraction.toString().padStart(4, '0')} ${PORTALDOT_V3_TESTNET.tokenSymbol}`;
}
