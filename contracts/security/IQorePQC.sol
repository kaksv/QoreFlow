// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title IQorePQC
 * @notice Interfaces for the QoreChain post-quantum precompiles.
 *
 * Source: https://docs.qorechain.io/developer-guide/evm-precompiles
 *
 * Both precompiles are ACTIVE on the qorechain-diana testnet (EVM chain ID
 * 9800) since testnet governance proposal 21 (27 Oct 2026) and NOT active on
 * mainnet. An inactive precompile address succeeds and returns EMPTY data, so
 * every consumer must check `ret.length` before decoding. See
 * QorePQCVerifier.sol for that guarding logic.
 */
interface IQorePQCVerify {
    /// @notice Verify an ML-DSA-87 (Dilithium-5, FIPS-204) signature.
    /// @param pubkey The 2592-byte ML-DSA-87 public key.
    /// @param signature The 4627-byte ML-DSA-87 signature.
    /// @param message The original message bytes that were signed.
    /// @return valid True if the signature is valid for the message.
    function pqcVerify(
        bytes calldata pubkey,
        bytes calldata signature,
        bytes calldata message
    ) external view returns (bool valid);
}

interface IQorePQCKeyStatus {
    /// @notice Read the post-quantum key registered to an account.
    /// @param account The Ethereum-style (20-byte) account address.
    /// @return registered True if a PQC key is registered.
    /// @return algorithmId 1 = ML-DSA-87.
    /// @return pubkey The registered public key (empty when unregistered).
    /// @return possessionProven True only if registration carried a verified
    ///         proof of possession. `registered` alone must never be trusted.
    function pqcKeyStatus(address account)
        external
        view
        returns (
            bool registered,
            uint8 algorithmId,
            bytes memory pubkey,
            bool possessionProven
        );
}
