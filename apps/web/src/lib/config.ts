import {
  type DeploymentRecord,
  type NetworkConfig,
  PORTALDOT_V3_TESTNET,
  withDeployment,
} from '@witness/sdk';

/**
 * The deployment record is produced by `npm run deploy:registry`. It is read at build time
 * if present; before the first deployment the app runs in read-only "not deployed" mode.
 */
const records = import.meta.glob<DeploymentRecord>('../../../../deployments/*.json', {
  eager: true,
  import: 'default',
});
const deployment =
  Object.values(records).find((r) => r.network === PORTALDOT_V3_TESTNET.name) ?? null;

const registryOverride = import.meta.env.VITE_REGISTRY_ADDRESS as `0x${string}` | undefined;

export const NETWORK: NetworkConfig = registryOverride
  ? { ...withDeployment(PORTALDOT_V3_TESTNET, deployment), registry: registryOverride }
  : withDeployment(PORTALDOT_V3_TESTNET, deployment);

export const DEPLOYMENT = deployment;

/** Notary base URL. Empty when no notary is configured for this build. */
export const NOTARY_URL: string =
  (import.meta.env.VITE_NOTARY_URL as string | undefined) ??
  (import.meta.env.DEV ? 'http://localhost:8787' : '');

export const REPOSITORY_URL =
  (import.meta.env.VITE_REPOSITORY_URL as string | undefined) ??
  'https://github.com/witness-protocol/witness';

/** Link to a block in the Portaldot node console. Mirrors `blockUrl` in @witness/sdk without loading it. */
export function blockLink(blockHashOrNumber: string | number): string {
  return `${NETWORK.explorerUrl}/?rpc=${encodeURIComponent(NETWORK.substrateRpc)}#/explorer/query/${blockHashOrNumber}`;
}
