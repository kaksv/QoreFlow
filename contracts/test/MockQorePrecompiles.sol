// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title Test doubles for the QoreChain PQC precompiles
 * @notice TEST-ONLY. These contracts exist so the local Hardhat suite can
 *         exercise QorePQCVerifier's real encoding, key-binding, length checks
 *         and failure behaviour without a QoreChain node.
 *
 *         They are NOT a cryptographic implementation and must never be wired
 *         into a deployment. The deploy script refuses to deploy them, and
 *         scripts/verify-deployment.ts asserts that the deployed verifier points
 *         at the canonical precompile addresses (0x…0a01 / 0x…0a02).
 *
 *         Real ML-DSA-87 verification is exercised by:
 *           - test/PQCAuthorization.test.ts (off-chain keygen/sign/verify via
 *             the qorechain-pqc package, then the same bytes are fed to the
 *             contract)
 *           - test/testnet/PQC.testnet.ts (real precompile, real testnet)
 */
contract MockPQCKeyStatus {
    struct KeyRecord {
        bool registered;
        uint8 algorithmId;
        bytes pubkey;
        bool possessionProven;
    }

    mapping(address account => KeyRecord record) private _keys;

    function setKey(
        address account,
        uint8 algorithmId,
        bytes calldata pubkey,
        bool possessionProven
    ) external {
        _keys[account] = KeyRecord({
            registered: true,
            algorithmId: algorithmId,
            pubkey: pubkey,
            possessionProven: possessionProven
        });
    }

    function clearKey(address account) external {
        delete _keys[account];
    }

    function pqcKeyStatus(address account)
        external
        view
        returns (
            bool registered,
            uint8 algorithmId,
            bytes memory pubkey,
            bool possessionProven
        )
    {
        KeyRecord storage record = _keys[account];
        return (
            record.registered,
            record.algorithmId,
            record.pubkey,
            record.possessionProven
        );
    }
}

contract MockPQCVerify {
    mapping(bytes32 digest => bool valid) private _valid;

    function setValid(
        bytes calldata pubkey,
        bytes calldata signature,
        bytes calldata message,
        bool valid
    ) external {
        _valid[_digest(pubkey, signature, message)] = valid;
    }

    function pqcVerify(
        bytes calldata pubkey,
        bytes calldata signature,
        bytes calldata message
    ) external view returns (bool) {
        return _valid[_digest(pubkey, signature, message)];
    }

    function _digest(
        bytes calldata pubkey,
        bytes calldata signature,
        bytes calldata message
    ) private pure returns (bytes32) {
        return keccak256(abi.encode(pubkey, signature, message));
    }
}
