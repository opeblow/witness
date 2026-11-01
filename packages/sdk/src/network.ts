import type { Hex } from '@witness/core';

export interface NetworkConfig {
  /** Name written into every manifest. */
  readonly name: string;
  readonly substrateRpc: string;
  readonly evmRpc: string;
  readonly evmChainId: number;
  readonly explorerUrl: string;
  readonly tokenSymbol: string;
  readonly tokenDecimals: number;
  readonly blockTimeMs: number;
  /** WitnessRegistry address, once deployed. */
  readonly registry: Hex | null;
  /** First block worth scanning for registry events. */
  readonly registryDeploymentBlock: number;
}

export const PORTALDOT_V3_TESTNET: NetworkConfig = {
  name: 'portaldot-v3-testnet',
  substrateRpc: 'wss://test-node-v3.portaldot.dev',
  evmRpc: 'https://test-evm-rpc-v3.portaldot.dev',
  evmChainId: 420420777,
  explorerUrl: 'https://node-console.portaldot.dev',
  tokenSymbol: 'tPOT',
  tokenDecimals: 14,
  blockTimeMs: 6000,
  registry: null,
  registryDeploymentBlock: 0,
};

/** Shape of deployments/<network>.json, written by `npm run deploy:registry`. */
export interface DeploymentRecord {
  readonly network: string;
  readonly registry: Hex;
  readonly deploymentBlock: number;
  readonly deploymentExtrinsic: Hex;
  readonly deployer: string;
  readonly deployedAt: string;
  readonly codeHash?: Hex;
}

export function withDeployment(
  base: NetworkConfig,
  deployment: DeploymentRecord | null,
): NetworkConfig {
  if (!deployment) return base;
  return {
    ...base,
    registry: deployment.registry,
    registryDeploymentBlock: deployment.deploymentBlock,
  };
}

/** Link to a block in the Portaldot node console (a Polkadot.js Apps deployment). */
export function blockUrl(network: NetworkConfig, blockHashOrNumber: string | number): string {
  return `${network.explorerUrl}/?rpc=${encodeURIComponent(network.substrateRpc)}#/explorer/query/${blockHashOrNumber}`;
}
