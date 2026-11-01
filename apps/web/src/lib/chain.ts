import type { ApiPromise } from '@polkadot/api';
import type { RegistryClient } from '@witness/sdk';
import { NETWORK } from './config';

let apiPromise: Promise<ApiPromise> | null = null;
let registry: RegistryClient | null = null;

/**
 * Connects to the Portaldot node on first use. polkadot.js is large, so it is loaded
 * lazily: the landing page never pays for it.
 */
export function getApi(): Promise<ApiPromise> {
  if (!apiPromise) {
    apiPromise = import('@witness/sdk')
      .then(({ connectPortaldot }) => connectPortaldot(NETWORK.substrateRpc))
      .catch((error: unknown) => {
        apiPromise = null;
        throw error;
      });
  }
  return apiPromise;
}

export async function getRegistry(): Promise<RegistryClient | null> {
  if (!NETWORK.registry) return null;
  if (!registry) {
    const { RegistryClient } = await import('@witness/sdk');
    registry = new RegistryClient(NETWORK);
  }
  return registry;
}

export function isDeployed(): boolean {
  return NETWORK.registry !== null;
}
