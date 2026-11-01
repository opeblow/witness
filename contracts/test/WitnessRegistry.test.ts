import { loadFixture, mine } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';

const hash = (label: string) => ethers.sha256(ethers.toUtf8Bytes(label));
const DHASH = 0x8f3a_11c0_77e2_9b45n;

describe('WitnessRegistry', () => {
  async function deploy() {
    const [notary, other] = await ethers.getSigners();
    const registry = await ethers.deployContract('WitnessRegistry');
    return { registry, notary: notary!, other: other! };
  }

  it('anchors a capture and exposes it to other contracts', async () => {
    const { registry, notary } = await loadFixture(deploy);
    const content = hash('photo');
    const tx = await registry.anchor(content, hash('manifest'), hash('signer'), DHASH);
    const receipt = await tx.wait();

    const anchor = await registry.anchorOf(content);
    expect(anchor.submitter).to.equal(notary.address);
    expect(anchor.blockNumber).to.equal(receipt!.blockNumber);
    expect(anchor.dhash).to.equal(DHASH);
    expect(await registry.isAnchored(content)).to.equal(true);
    expect(await registry.anchorCount()).to.equal(1n);
  });

  it('emits every field verifiers need', async () => {
    const { registry, notary } = await loadFixture(deploy);
    await expect(registry.anchor(hash('photo'), hash('manifest'), hash('signer'), DHASH))
      .to.emit(registry, 'Anchored')
      .withArgs(
        hash('photo'),
        hash('signer'),
        notary.address,
        hash('manifest'),
        DHASH,
        (n: bigint) => n > 0n,
      );
  });

  it('keeps the first anchor of a file forever', async () => {
    const { registry, notary, other } = await loadFixture(deploy);
    const content = hash('photo');
    await registry.anchor(content, hash('manifest'), hash('signer'), DHASH);
    const first = await registry.anchorOf(content);

    await mine(5);
    await expect(registry.connect(other).anchor(content, hash('other manifest'), hash('thief'), 1n))
      .to.be.revertedWithCustomError(registry, 'AlreadyAnchored')
      .withArgs(content, first.blockNumber, notary.address);

    const after = await registry.anchorOf(content);
    expect(after.submitter).to.equal(notary.address);
    expect(after.dhash).to.equal(DHASH);
  });

  it('rejects zero hashes', async () => {
    const { registry } = await loadFixture(deploy);
    const zero = ethers.ZeroHash;
    await expect(registry.anchor(zero, hash('m'), hash('s'), DHASH)).to.be.revertedWithCustomError(
      registry,
      'ZeroValue',
    );
    await expect(registry.anchor(hash('c'), zero, hash('s'), DHASH)).to.be.revertedWithCustomError(
      registry,
      'ZeroValue',
    );
    await expect(registry.anchor(hash('c'), hash('m'), zero, DHASH)).to.be.revertedWithCustomError(
      registry,
      'ZeroValue',
    );
  });

  it('returns an empty anchor for unknown files', async () => {
    const { registry } = await loadFixture(deploy);
    const anchor = await registry.anchorOf(hash('never seen'));
    expect(anchor.blockNumber).to.equal(0n);
    expect(anchor.submitter).to.equal(ethers.ZeroAddress);
    expect(await registry.isAnchored(hash('never seen'))).to.equal(false);
  });

  it('stores each anchor in a single storage slot', async () => {
    const { registry, notary } = await loadFixture(deploy);
    const content = hash('photo');
    await registry.anchor(content, hash('manifest'), hash('signer'), DHASH);
    // Mapping slot 0: keccak256(key . slot). One slot holds submitter, blockNumber and dhash.
    const slot = ethers.keccak256(ethers.concat([content, ethers.zeroPadValue('0x00', 32)]));
    const raw = await ethers.provider.getStorage(await registry.getAddress(), slot);
    const next = await ethers.provider.getStorage(await registry.getAddress(), BigInt(slot) + 1n);
    expect(raw.toLowerCase()).to.contain(notary.address.slice(2).toLowerCase());
    expect(BigInt(next)).to.equal(0n);
  });
});
