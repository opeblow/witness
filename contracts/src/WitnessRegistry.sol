// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.28;

/// @title WitnessRegistry
/// @notice Permanent, first-write-wins anchors for Witness captures on Portaldot V3.
/// @dev A capture is anchored in the same native extrinsic that stores its signed envelope in
///      Portaldot's TransactionStorage pallet (`utility.batchAll[transactionStorage.store, revive.call]`).
///      This contract keeps only what other contracts need to make decisions: who anchored a file
///      and in which block. Everything else is in the `Anchored` event and the envelope itself.
///
///      Storage is one slot per capture (20 + 4 + 8 bytes) because pallet-revive charges a storage
///      deposit per byte. See docs/adr/0003-registry-storage-layout.md.
contract WitnessRegistry {
    /// @notice One packed storage slot per anchored file.
    struct Anchor {
        /// Account that submitted the anchor (the notary or the capturer's own wallet).
        address submitter;
        /// Portaldot block number in which the capture was anchored.
        uint32 blockNumber;
        /// 64-bit perceptual difference hash, for finding re-encoded copies.
        uint64 dhash;
    }

    mapping(bytes32 contentHash => Anchor) private _anchors;

    /// @notice Number of captures anchored through this registry.
    uint256 public anchorCount;

    /// @notice Emitted once per capture.
    /// @param contentHash SHA-256 of the exact image file.
    /// @param signer Ed25519 public key of the capturer, from the signed manifest.
    /// @param submitter Account that submitted the anchor.
    /// @param manifestDigest SHA-256 of the canonical signed manifest.
    /// @param dhash Perceptual hash of the image.
    /// @param blockNumber Block in which the capture was anchored.
    event Anchored(
        bytes32 indexed contentHash,
        bytes32 indexed signer,
        address indexed submitter,
        bytes32 manifestDigest,
        uint64 dhash,
        uint32 blockNumber
    );

    error ZeroValue();
    error AlreadyAnchored(bytes32 contentHash, uint32 blockNumber, address submitter);
    error BlockNumberOverflow();

    /// @notice Anchors a capture. The first anchor of a file wins and can never be replaced.
    /// @dev Signature and manifest validity are checked off-chain by every verifier, so a dishonest
    ///      submitter cannot make an invalid capture look valid; it can only spend its own fees.
    /// @return blockNumber The block the capture was anchored in.
    function anchor(
        bytes32 contentHash,
        bytes32 manifestDigest,
        bytes32 signer,
        uint64 dhash
    ) external returns (uint32 blockNumber) {
        if (contentHash == bytes32(0) || manifestDigest == bytes32(0) || signer == bytes32(0)) {
            revert ZeroValue();
        }
        Anchor storage existing = _anchors[contentHash];
        if (existing.blockNumber != 0) {
            revert AlreadyAnchored(contentHash, existing.blockNumber, existing.submitter);
        }
        if (block.number > type(uint32).max) revert BlockNumberOverflow();

        blockNumber = uint32(block.number);
        _anchors[contentHash] = Anchor({submitter: msg.sender, blockNumber: blockNumber, dhash: dhash});
        unchecked {
            anchorCount += 1;
        }
        emit Anchored(contentHash, signer, msg.sender, manifestDigest, dhash, blockNumber);
    }

    /// @notice Returns the anchor of a file, or an all-zero struct if it was never anchored.
    function anchorOf(bytes32 contentHash) external view returns (Anchor memory) {
        return _anchors[contentHash];
    }

    /// @notice True if the file has been anchored.
    function isAnchored(bytes32 contentHash) external view returns (bool) {
        return _anchors[contentHash].blockNumber != 0;
    }
}
