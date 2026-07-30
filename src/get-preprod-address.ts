import { createKeystore, HDWallet, Roles } from '@midnight-ntwrk/wallet-sdk';
import { Buffer } from 'buffer';
import fs from 'fs';
import path from 'path';

async function main() {
  const statePath = path.join(import.meta.dirname, '..', '.midnight-state.json');
  if (!fs.existsSync(statePath)) {
    console.error('No .midnight-state.json found!');
    return;
  }

  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  const seed = state.wallets?.preprod?.seed;
  if (!seed) {
    console.error('No preprod seed found in .midnight-state.json!');
    return;
  }

  console.log('Deriving Preprod keys from seed...');
  const hdWallet = HDWallet.fromSeed(Buffer.from(seed, 'hex'));
  if (hdWallet.type !== 'seedOk') throw new Error('Invalid seed');
  const result = hdWallet.hdWallet
    .selectAccount(0)
    .selectRoles([Roles.NightExternal])
    .deriveKeysAt(0);
  if (result.type !== 'keysDerived') throw new Error('Key derivation failed');
  const keys = result.keys;

  const keystore = createKeystore(keys[Roles.NightExternal], 'preprod');
  const address = keystore.getBech32Address().asString();

  console.log('\n─── Preprod Wallet Address ──────────────────────────────────────');
  console.log(`  Address: ${address}`);
  console.log('─────────────────────────────────────────────────────────────────\n');
}

main().catch(console.error);
