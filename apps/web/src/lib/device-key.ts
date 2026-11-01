import {
  type KeyPair,
  fromHex,
  generateKeyPair,
  keyPairFromSecret,
  signerAddress,
  toHex,
} from '@witness/core';

const STORAGE_KEY = 'witness.device-key.v1';

/**
 * The device's capture key. It signs every manifest, so a capture can be traced to the
 * device that made it. Stored in this browser only; nothing about it leaves the device
 * except the public key inside signed manifests.
 */
export interface DeviceKey extends KeyPair {
  readonly address: string;
  /** False when storage is unavailable and the key lives only for this session. */
  readonly persistent: boolean;
}

let sessionKey: DeviceKey | null = null;

export function loadDeviceKey(): DeviceKey {
  if (sessionKey) return sessionKey;
  let persistent = true;
  let keys: KeyPair | null = null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) keys = keyPairFromSecret(fromHex(stored));
  } catch {
    keys = null;
  }
  if (!keys) {
    keys = generateKeyPair();
    try {
      localStorage.setItem(STORAGE_KEY, toHex(keys.secretKey));
    } catch {
      persistent = false;
    }
  }
  sessionKey = { ...keys, address: signerAddress(toHex(keys.publicKey)), persistent };
  return sessionKey;
}

/** A JSON backup of the device key, for moving captures' identity to another browser. */
export function exportDeviceKey(key: DeviceKey): string {
  return `${JSON.stringify(
    {
      format: 'witness.device-key',
      version: 1,
      address: key.address,
      secretKey: toHex(key.secretKey),
    },
    null,
    2,
  )}\n`;
}
