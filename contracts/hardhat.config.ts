import '@nomicfoundation/hardhat-toolbox';
import type { HardhatUserConfig } from 'hardhat/config';

const PORTALDOT_EVM_RPC = process.env.PORTALDOT_EVM_RPC ?? 'https://test-evm-rpc-v3.portaldot.dev';
const DEPLOYER_KEY = process.env.DEPLOYER_PRIVATE_KEY;

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.28',
    settings: {
      optimizer: { enabled: true, runs: 1_000 },
      evmVersion: 'cancun',
    },
  },
  paths: {
    sources: './src',
    tests: './test',
  },
  networks: {
    portaldotV3Testnet: {
      url: PORTALDOT_EVM_RPC,
      chainId: 420420777,
      accounts: DEPLOYER_KEY ? [DEPLOYER_KEY] : [],
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === 'true',
  },
};

export default config;
