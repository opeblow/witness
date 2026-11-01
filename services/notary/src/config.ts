import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { type DeploymentRecord, PORTALDOT_V3_TESTNET } from '@witness/sdk';

const EnvSchema = z.object({
  NOTARY_PORT: z.coerce.number().int().min(1).max(65535).default(8787),
  NOTARY_HOST: z.string().default('0.0.0.0'),
  /** Secret URI of the sponsor account (mnemonic, raw seed, or //Dev path). Never logged. */
  NOTARY_SEED: z.string().min(1, 'NOTARY_SEED is required'),
  SUBSTRATE_RPC: z.string().url().default(PORTALDOT_V3_TESTNET.substrateRpc),
  EVM_RPC: z.string().url().default(PORTALDOT_V3_TESTNET.evmRpc),
  REGISTRY_ADDRESS: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/)
    .optional(),
  DEPLOYMENT_FILE: z.string().default('deployments/portaldot-v3-testnet.json'),
  ALLOWED_ORIGINS: z.string().default('*'),
  MAX_CAPTURE_WINDOW_BLOCKS: z.coerce.number().int().min(1).max(50).default(30),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).default(12),
  SIGNER_LIMIT_PER_HOUR: z.coerce.number().int().min(1).default(120),
});

export interface NotaryConfig {
  readonly port: number;
  readonly host: string;
  readonly seed: string;
  readonly substrateRpc: string;
  readonly evmRpc: string;
  readonly registry: `0x${string}` | null;
  readonly registryDeploymentBlock: number;
  readonly allowedOrigins: readonly string[];
  readonly maxCaptureWindowBlocks: number;
  readonly rateLimitPerMinute: number;
  readonly signerLimitPerHour: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): NotaryConfig {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid notary configuration: ${issues}`);
  }
  const e = parsed.data;
  const deployment = readDeployment(e.DEPLOYMENT_FILE);
  return {
    port: e.NOTARY_PORT,
    host: e.NOTARY_HOST,
    seed: e.NOTARY_SEED,
    substrateRpc: e.SUBSTRATE_RPC,
    evmRpc: e.EVM_RPC,
    registry: (e.REGISTRY_ADDRESS as `0x${string}` | undefined) ?? deployment?.registry ?? null,
    registryDeploymentBlock: deployment?.deploymentBlock ?? 0,
    allowedOrigins: e.ALLOWED_ORIGINS.split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    maxCaptureWindowBlocks: e.MAX_CAPTURE_WINDOW_BLOCKS,
    rateLimitPerMinute: e.RATE_LIMIT_PER_MINUTE,
    signerLimitPerHour: e.SIGNER_LIMIT_PER_HOUR,
  };
}

function readDeployment(file: string): DeploymentRecord | null {
  for (const candidate of [resolve(file), resolve('../..', file)]) {
    try {
      return JSON.parse(readFileSync(candidate, 'utf8')) as DeploymentRecord;
    } catch {
      // Try the next location.
    }
  }
  return null;
}
