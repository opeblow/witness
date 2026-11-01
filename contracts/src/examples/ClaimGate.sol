// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.28;

import {WitnessRegistry} from "../WitnessRegistry.sol";

/// @title ClaimGate
/// @notice Example integration: an insurer or marketplace escrows a payout that is released only
///         when the claimant presents a photo anchored in WitnessRegistry by a trusted capture
///         service, after the claim was opened. Old photos, re-used photos and photos from
///         unknown sources are rejected on chain.
/// @dev This is a reference integration, not audited production code.
contract ClaimGate {
    struct Claim {
        address payable claimant;
        uint96 payout;
        uint32 openedAt;
        bool settled;
        bytes32 evidence;
    }

    WitnessRegistry public immutable registry;
    address public immutable operator;

    mapping(address submitter => bool trusted) public trustedSubmitters;
    mapping(bytes32 contentHash => bool used) public usedEvidence;
    Claim[] private _claims;

    event SubmitterTrusted(address indexed submitter, bool trusted);
    event ClaimOpened(uint256 indexed claimId, address indexed claimant, uint256 payout);
    event ClaimSettled(uint256 indexed claimId, bytes32 indexed evidence, uint256 payout);

    error NotOperator();
    error UnknownClaim(uint256 claimId);
    error NotClaimant();
    error AlreadySettled();
    error EvidenceNotAnchored(bytes32 contentHash);
    error EvidenceTooOld(uint32 anchoredAt, uint32 openedAt);
    error UntrustedSubmitter(address submitter);
    error EvidenceAlreadyUsed(bytes32 contentHash);
    error PayoutFailed();
    error PayoutTooLarge();

    constructor(WitnessRegistry registry_) {
        registry = registry_;
        operator = msg.sender;
    }

    modifier onlyOperator() {
        if (msg.sender != operator) revert NotOperator();
        _;
    }

    function setTrustedSubmitter(address submitter, bool trusted) external onlyOperator {
        trustedSubmitters[submitter] = trusted;
        emit SubmitterTrusted(submitter, trusted);
    }

    /// @notice Opens a claim and escrows its payout, sent as the call value.
    function openClaim(address payable claimant) external payable onlyOperator returns (uint256 claimId) {
        if (msg.value > type(uint96).max) revert PayoutTooLarge();
        claimId = _claims.length;
        _claims.push(
            Claim({
                claimant: claimant,
                payout: uint96(msg.value),
                openedAt: uint32(block.number),
                settled: false,
                evidence: bytes32(0)
            })
        );
        emit ClaimOpened(claimId, claimant, msg.value);
    }

    /// @notice Settles a claim with witnessed evidence and pays the claimant.
    function settle(uint256 claimId, bytes32 contentHash) external {
        if (claimId >= _claims.length) revert UnknownClaim(claimId);
        Claim storage claim = _claims[claimId];
        if (msg.sender != claim.claimant) revert NotClaimant();
        if (claim.settled) revert AlreadySettled();
        if (usedEvidence[contentHash]) revert EvidenceAlreadyUsed(contentHash);

        WitnessRegistry.Anchor memory anchored = registry.anchorOf(contentHash);
        if (anchored.blockNumber == 0) revert EvidenceNotAnchored(contentHash);
        if (anchored.blockNumber < claim.openedAt) revert EvidenceTooOld(anchored.blockNumber, claim.openedAt);
        if (!trustedSubmitters[anchored.submitter]) revert UntrustedSubmitter(anchored.submitter);

        claim.settled = true;
        claim.evidence = contentHash;
        usedEvidence[contentHash] = true;
        uint256 payout = claim.payout;
        emit ClaimSettled(claimId, contentHash, payout);

        (bool ok, ) = claim.claimant.call{value: payout}("");
        if (!ok) revert PayoutFailed();
    }

    function claimOf(uint256 claimId) external view returns (Claim memory) {
        if (claimId >= _claims.length) revert UnknownClaim(claimId);
        return _claims[claimId];
    }

    function claimCount() external view returns (uint256) {
        return _claims.length;
    }
}
