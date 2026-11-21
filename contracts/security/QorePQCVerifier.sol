// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IQorePQCVerify, IQorePQCKeyStatus} from "./IQorePQC.sol";

/**
 * @title QorePQCVerifier
 * @notice Contract-level post-quantum authorization gate for QoreFlow.
 *
 * Security model (read docs/QORECHAIN_INTEGRATION.md before changing):
 *
 *  1. The caller supplies an ML-DSA-87 public key, a signature and a message.
 *  2. We read the signer account's *registered* key from `pqcKeyStatus`.
 *  3. We require the supplied key to be byte-identical to the registered key.
 *     This is the account->key binding: a signature from an arbitrary
 *     unregistered key is worthless, because the verified key is the one the
 *     account actually registered on chain.
 *  4. We require `possessionProven`. Proof of possession is OPTIONAL at
 *     registration, so `registered == true` alone does not prove the account
 *     controls the key. Requiring it closes that gap.
 *  5. Only then do we call `pqcVerify`, and we inspect both the call success
 *     flag and the returned data length (an inactive precompile returns
 *     success with empty data).
 *
 * The precompile does NOT enforce nonces, deadlines or account ownership.
 * Those are implemented by the consumer (QoreFlow.cancelStream).
 *
 * The two precompile addresses are immutable constructor arguments so that the
 * local Hardhat suite can point the contract at clearly-labelled test doubles.
 * The canonical addresses are exported as constants and asserted by
 * scripts/deploy.ts and scripts/verify-deployment.ts. There is no setter and no
 * owner: the wiring cannot be changed after deployment.
 */
contract QorePQCVerifier {
    /// @notice Canonical QoreChain PQC verify precompile (0x…0a01).
    address public constant CANONICAL_PQC_VERIFY =
        0x0000000000000000000000000000000000000a01;
    /// @notice Canonical QoreChain PQC key-status precompile (0x…0a02).
    address public constant CANONICAL_PQC_KEY_STATUS =
        0x0000000000000000000000000000000000000a02;

    uint8 public constant ML_DSA_87 = 1;
    uint256 public constant ML_DSA_87_PUBKEY_LENGTH = 2592;
    uint256 public constant ML_DSA_87_SIGNATURE_LENGTH = 4627;

    address public immutable pqcVerifyPrecompile;
    address public immutable pqcKeyStatusPrecompile;

    error PrecompileCallFailed(address precompile);
    error PrecompileReturnedNoData(address precompile);
    error KeyNotRegistered(address account);
    error KeyPossessionNotProven(address account);
    error UnsupportedAlgorithm(uint8 algorithmId);
    error RegisteredKeyMalformed(uint256 length);
    error SuppliedKeyMalformed(uint256 length);
    error SignatureMalformed(uint256 length);
    error SuppliedKeyDoesNotMatchRegistration();
    error InvalidPostQuantumSignature();

    constructor(address verifyPrecompile, address keyStatusPrecompile) {
        // Reject the zero address so a mis-wired deployment fails loudly
        // instead of silently treating every call as "precompile unavailable".
        if (verifyPrecompile == address(0) || keyStatusPrecompile == address(0)) {
            revert PrecompileReturnedNoData(address(0));
        }
        pqcVerifyPrecompile = verifyPrecompile;
        pqcKeyStatusPrecompile = keyStatusPrecompile;
    }

    /// @notice True when this verifier is wired to the canonical testnet precompiles.
    function isCanonicalWiring() external view returns (bool) {
        return
            pqcVerifyPrecompile == CANONICAL_PQC_VERIFY &&
            pqcKeyStatusPrecompile == CANONICAL_PQC_KEY_STATUS;
    }

    /**
     * @notice Read an account's registered post-quantum key from QoreChain.
     * @dev Reverts if the precompile is inactive or returns malformed data,
     *      because an empty return means "no such precompile", not "no key".
     */
    function getKeyStatus(address account)
        public
        view
        returns (
            bool registered,
            uint8 algorithmId,
            bytes memory pubkey,
            bool possessionProven
        )
    {
        (bool ok, bytes memory ret) = pqcKeyStatusPrecompile.staticcall(
            abi.encodeWithSelector(
                IQorePQCKeyStatus.pqcKeyStatus.selector,
                account
            )
        );
        if (!ok) revert PrecompileCallFailed(pqcKeyStatusPrecompile);
        // 4 static head words: bool, uint8, offset, bool => 128 bytes minimum.
        if (ret.length < 128) revert PrecompileReturnedNoData(pqcKeyStatusPrecompile);
        return abi.decode(ret, (bool, uint8, bytes, bool));
    }

    /**
     * @notice Verify that `signature` over `message` was produced by the
     *         ML-DSA-87 key registered to `account`.
     * @dev Reverts on every failure mode. Returns true only after the
     *      precompile has positively confirmed the signature.
     */
    function verifySignature(
        address account,
        bytes calldata pubkey,
        bytes calldata signature,
        bytes calldata message
    ) public view returns (bool) {
        (
            bool registered,
            uint8 algorithmId,
            bytes memory registeredPubkey,
            bool possessionProven
        ) = getKeyStatus(account);

        if (!registered) revert KeyNotRegistered(account);
        if (algorithmId != ML_DSA_87) revert UnsupportedAlgorithm(algorithmId);
        if (!possessionProven) revert KeyPossessionNotProven(account);
        if (registeredPubkey.length != ML_DSA_87_PUBKEY_LENGTH) {
            revert RegisteredKeyMalformed(registeredPubkey.length);
        }
        if (pubkey.length != ML_DSA_87_PUBKEY_LENGTH) {
            revert SuppliedKeyMalformed(pubkey.length);
        }
        if (signature.length != ML_DSA_87_SIGNATURE_LENGTH) {
            revert SignatureMalformed(signature.length);
        }
        // Account -> key binding. Compare hashes to avoid a large memory copy.
        if (keccak256(pubkey) != keccak256(registeredPubkey)) {
            revert SuppliedKeyDoesNotMatchRegistration();
        }

        (bool ok, bytes memory ret) = pqcVerifyPrecompile.staticcall(
            abi.encodeWithSelector(
                IQorePQCVerify.pqcVerify.selector,
                pubkey,
                signature,
                message
            )
        );
        if (!ok) revert PrecompileCallFailed(pqcVerifyPrecompile);
        if (ret.length < 32) revert PrecompileReturnedNoData(pqcVerifyPrecompile);

        bool valid = abi.decode(ret, (bool));
        if (!valid) revert InvalidPostQuantumSignature();
        return true;
    }
}
