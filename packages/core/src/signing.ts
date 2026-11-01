import { ed25519 } from '@noble/curves/ed25519.js';
import { type Hex, fromHex, toHex } from './bytes.js';
import { type CaptureManifest, type SignedCapture, signingPayload } from './manifest.js';
import { encodeAddress } from './ss58.js';

export interface KeyPair {
  readonly secretKey: Uint8Array;
  readonly publicKey: Uint8Array;
}

export function generateKeyPair(): KeyPair {
  const secretKey = ed25519.utils.randomSecretKey();
  return { secretKey, publicKey: ed25519.getPublicKey(secretKey) };
}

export function keyPairFromSecret(secretKey: Uint8Array): KeyPair {
  if (secretKey.length !== 32) throw new RangeError('Ed25519 secret keys are 32 bytes');
  return { secretKey, publicKey: ed25519.getPublicKey(secretKey) };
}

export function signCapture(manifest: CaptureManifest, keys: KeyPair): SignedCapture {
  if (manifest.signer.key !== toHex(keys.publicKey)) {
    throw new Error('Manifest signer key does not match the signing key');
  }
  const signature = toHex(ed25519.sign(signingPayload(manifest), keys.secretKey));
  return { manifest, signature };
}

/** True when the signature is a valid Ed25519 signature by `manifest.signer.key`. */
export function verifyCaptureSignature(signed: SignedCapture): boolean {
  try {
    return ed25519.verify(
      fromHex(signed.signature),
      signingPayload(signed.manifest),
      fromHex(signed.manifest.signer.key),
    );
  } catch {
    return false;
  }
}

/** The SS58 address of a signer key. Ed25519 keys are valid Substrate account ids. */
export function signerAddress(key: Hex): string {
  return encodeAddress(fromHex(key));
}
