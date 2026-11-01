/**
 * Creates the notary's sponsor key in .secrets/notary.env (git-ignored) and prints
 * the addresses to fund. Running it again prints the existing key's addresses.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { Keyring } from '@polkadot/keyring';
import { cryptoWaitReady, mnemonicGenerate } from '@polkadot/util-crypto';
import { reviveAddressOf } from '@witness/sdk';
import { SECRETS_FILE, sponsorSeed } from './env.js';

await cryptoWaitReady();

let created = false;
if (!process.env.NOTARY_SEED && !existsSync(SECRETS_FILE)) {
  mkdirSync(dirname(SECRETS_FILE), { recursive: true });
  writeFileSync(SECRETS_FILE, `NOTARY_SEED="${mnemonicGenerate(24)}"\n`, { mode: 0o600 });
  created = true;
}

const pair = new Keyring({ type: 'sr25519', ss58Format: 42 }).addFromUri(sponsorSeed());
console.log(
  created ? 'Created a new sponsor key in .secrets/notary.env' : 'Using the existing sponsor key',
);
console.log(`Sponsor (fund this, native SS58): ${pair.address}`);
console.log(`Sponsor as seen by contracts:      ${reviveAddressOf(pair.publicKey)}`);
console.log('Never commit .secrets/. Back up the mnemonic somewhere safe.');
