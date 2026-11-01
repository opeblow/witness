import { loadFixture, mine } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';

const hash = (label: string) => ethers.sha256(ethers.toUtf8Bytes(label));
const PAYOUT = ethers.parseEther('1');

describe('ClaimGate', () => {
  async function deploy() {
    const [operator, notary, claimant, stranger] = await ethers.getSigners();
    const registry = await ethers.deployContract('WitnessRegistry');
    const gate = await ethers.deployContract('ClaimGate', [await registry.getAddress()]);
    await gate.setTrustedSubmitter(notary!.address, true);
    return {
      registry,
      gate,
      operator: operator!,
      notary: notary!,
      claimant: claimant!,
      stranger: stranger!,
    };
  }

  async function openClaim() {
    const ctx = await deploy();
    await ctx.gate.openClaim(ctx.claimant.address, { value: PAYOUT });
    return ctx;
  }

  it('pays out for evidence witnessed after the claim opened', async () => {
    const { registry, gate, notary, claimant } = await loadFixture(openClaim);
    await registry.connect(notary).anchor(hash('damage'), hash('m'), hash('s'), 1n);

    await expect(gate.connect(claimant).settle(0, hash('damage'))).to.changeEtherBalances(
      [gate, claimant],
      [-PAYOUT, PAYOUT],
    );
    const claim = await gate.claimOf(0);
    expect(claim.settled).to.equal(true);
    expect(claim.evidence).to.equal(hash('damage'));
  });

  it('rejects a photo taken before the claim was opened', async () => {
    const { registry, gate, notary, claimant } = await loadFixture(deploy);
    await registry.connect(notary).anchor(hash('old photo'), hash('m'), hash('s'), 1n);
    await mine(3);
    await gate.openClaim(claimant.address, { value: PAYOUT });
    await expect(gate.connect(claimant).settle(0, hash('old photo'))).to.be.revertedWithCustomError(
      gate,
      'EvidenceTooOld',
    );
  });

  it('rejects evidence that was never witnessed', async () => {
    const { gate, claimant } = await loadFixture(openClaim);
    await expect(
      gate.connect(claimant).settle(0, hash('not anchored')),
    ).to.be.revertedWithCustomError(gate, 'EvidenceNotAnchored');
  });

  it('rejects evidence anchored by an untrusted submitter', async () => {
    const { registry, gate, stranger, claimant } = await loadFixture(openClaim);
    await registry.connect(stranger).anchor(hash('self-made'), hash('m'), hash('s'), 1n);
    await expect(gate.connect(claimant).settle(0, hash('self-made')))
      .to.be.revertedWithCustomError(gate, 'UntrustedSubmitter')
      .withArgs(stranger.address);
  });

  it('rejects re-using one photo for two claims', async () => {
    const { registry, gate, notary, claimant } = await loadFixture(openClaim);
    await gate.openClaim(claimant.address, { value: PAYOUT });
    await registry.connect(notary).anchor(hash('damage'), hash('m'), hash('s'), 1n);
    await gate.connect(claimant).settle(0, hash('damage'));
    await expect(gate.connect(claimant).settle(1, hash('damage'))).to.be.revertedWithCustomError(
      gate,
      'EvidenceAlreadyUsed',
    );
  });

  it('only lets the claimant settle, and only once', async () => {
    const { registry, gate, notary, claimant, stranger } = await loadFixture(openClaim);
    await registry.connect(notary).anchor(hash('damage'), hash('m'), hash('s'), 1n);
    await expect(gate.connect(stranger).settle(0, hash('damage'))).to.be.revertedWithCustomError(
      gate,
      'NotClaimant',
    );
    await gate.connect(claimant).settle(0, hash('damage'));
    await registry.connect(notary).anchor(hash('second'), hash('m'), hash('s'), 1n);
    await expect(gate.connect(claimant).settle(0, hash('second'))).to.be.revertedWithCustomError(
      gate,
      'AlreadySettled',
    );
  });

  it('restricts claim management to the operator', async () => {
    const { gate, stranger } = await loadFixture(deploy);
    await expect(
      gate.connect(stranger).openClaim(stranger.address, { value: 1n }),
    ).to.be.revertedWithCustomError(gate, 'NotOperator');
    await expect(
      gate.connect(stranger).setTrustedSubmitter(stranger.address, true),
    ).to.be.revertedWithCustomError(gate, 'NotOperator');
  });
});
