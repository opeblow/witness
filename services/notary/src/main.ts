import { serve } from '@hono/node-server';
import { PORTALDOT_V3_TESTNET } from '@witness/sdk';
import { createApp } from './app.js';
import { PortaldotChain } from './chain.js';
import { loadConfig } from './config.js';
import { NotaryService } from './service.js';

const VERSION = '0.1.0';

async function main(): Promise<void> {
  const config = loadConfig();
  const network = {
    ...PORTALDOT_V3_TESTNET,
    substrateRpc: config.substrateRpc,
    evmRpc: config.evmRpc,
    registry: config.registry,
    registryDeploymentBlock: config.registryDeploymentBlock,
  };
  const chain = await PortaldotChain.connect(network, config.seed);
  const service = new NotaryService(chain, {
    maxCaptureWindowBlocks: config.maxCaptureWindowBlocks,
    version: VERSION,
  });
  const app = createApp(service, config);

  const balance = await chain.sponsorBalance();
  console.info(
    JSON.stringify({
      event: 'notary.started',
      port: config.port,
      sponsor: chain.sponsorAddress,
      sponsorEvm: chain.sponsorEvmAddress,
      registry: config.registry,
      sponsorBalancePlanck: balance.toString(),
    }),
  );
  if (!config.registry)
    console.warn('Registry address missing: captures will be rejected until it is deployed.');

  const server = serve({ fetch: app.fetch, port: config.port, hostname: config.host });
  const shutdown = (signal: string) => {
    console.info(JSON.stringify({ event: 'notary.stopping', signal }));
    server.close(() => {
      void chain.disconnect().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
