// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {QorePQCVerifier} from "./security/QorePQCVerifier.sol";

/**
 * @title QoreFlow
 * @notice Continuous, linearly-vesting native-QOR payment streams on QoreChain.
 *
 * A sender locks QOR at creation time. The recipient accrues a pro-rata share
 * every second and may withdraw it at any time. The sender may cancel an
 * active stream, but only with an ML-DSA-87 signature from the account's
 * registered post-quantum key, verified on chain by QoreChain's `pqcVerify`
 * precompile (through QorePQCVerifier).
 *
 * Honest security note: the EVM transaction that calls `cancelStream` is still
 * signed with classical secp256k1, like every EVM transaction on QoreChain.
 * The post-quantum authorization is an *additional* signature checked by this
 * contract. See docs/QORECHAIN_INTEGRATION.md.
 */
contract QoreFlow is ReentrancyGuard {
    /// @notice Maximum stream duration: 10 years (3650 days), in seconds.
    uint64 public constant MAX_DURATION = 315_360_000;

    bytes32 public constant DOMAIN_TYPEHASH =
        keccak256(
            "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
        );
    string public constant DOMAIN_NAME = "QoreFlow";
    string public constant DOMAIN_VERSION = "1";

    /// @notice Action tag bound into every cancellation authorization.
    bytes32 public constant CANCEL_ACTION =
        keccak256("QOREFLOW_CANCEL_STREAM_V1");

    /// @notice Type hash for the cancellation authorization message.
    bytes32 public constant CANCEL_TYPEHASH =
        keccak256(
            "CancelStream(address sender,uint256 streamId,bytes32 action,uint256 nonce,uint256 deadline)"
        );

    struct Stream {
        address sender;
        address recipient;
        uint256 deposit;
        uint64 startTime;
        uint64 endTime;
        uint64 cancelledAt;
        uint256 withdrawn;
        bool cancelled;
    }

    /// @notice Immutable EIP-712-style domain separator (chain + contract bound).
    bytes32 public immutable DOMAIN_SEPARATOR;

    /// @notice The post-quantum authorization verifier.
    QorePQCVerifier public immutable pqcVerifier;

    /// @notice Monotonically increasing stream id. The first stream is id 1.
    uint256 public nextStreamId = 1;

    /// @notice Per-sender cancellation nonce, raised on each successful cancel.
    mapping(address sender => uint256 nonce) public cancelNonce;

    mapping(uint256 streamId => Stream stream) private _streams;

    event StreamCreated(
        uint256 indexed streamId,
        address indexed sender,
        address indexed recipient,
        uint256 deposit,
        uint64 startTime,
        uint64 endTime
    );

    event StreamWithdrawn(
        uint256 indexed streamId,
        address indexed recipient,
        uint256 amount,
        uint256 totalWithdrawn
    );

    event StreamCancelled(
        uint256 indexed streamId,
        address indexed sender,
        uint256 refund,
        uint256 recipientEntitlement,
        uint64 cancelledAt,
        uint256 nonce
    );

    error ZeroRecipient();
    error ZeroDeposit();
    error ZeroDuration();
    error DurationTooLong(uint64 duration);
    error TimestampOverflow();
    error StreamNotFound(uint256 streamId);
    error NotStreamRecipient(address caller);
    error NotStreamSender(address caller);
    error StreamIsCancelled(uint256 streamId);
    error StreamCompleted(uint256 streamId);
    error NothingToWithdraw();
    error AuthorizationExpired(uint256 deadline, uint256 nowTimestamp);
    error ReentrantCallBlocked();

    constructor(address verifier) {
        if (verifier == address(0)) revert ZeroRecipient();
        pqcVerifier = QorePQCVerifier(verifier);
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                DOMAIN_TYPEHASH,
                keccak256(bytes(DOMAIN_NAME)),
                keccak256(bytes(DOMAIN_VERSION)),
                block.chainid,
                address(this)
            )
        );
    }

    // ---------------------------------------------------------------------
    // Stream lifecycle
    // ---------------------------------------------------------------------

    /**
     * @notice Create a funded stream. The whole `msg.value` is the deposit.
     * @param recipient The account that accrues and withdraws the stream.
     * @param duration Stream length in seconds (1 .. MAX_DURATION).
     * @return streamId The id of the newly created stream.
     */
    function createStream(address recipient, uint64 duration)
        external
        payable
        returns (uint256 streamId)
    {
        if (recipient == address(0)) revert ZeroRecipient();
        if (msg.value == 0) revert ZeroDeposit();
        if (duration == 0) revert ZeroDuration();
        if (duration > MAX_DURATION) revert DurationTooLong(duration);

        uint256 start = block.timestamp;
        uint256 end = start + uint256(duration);
        if (end > type(uint64).max) revert TimestampOverflow();

        streamId = nextStreamId++;
        _streams[streamId] = Stream({
            sender: msg.sender,
            recipient: recipient,
            deposit: msg.value,
            startTime: uint64(start),
            endTime: uint64(end),
            cancelledAt: 0,
            withdrawn: 0,
            cancelled: false
        });

        emit StreamCreated(
            streamId,
            msg.sender,
            recipient,
            msg.value,
            uint64(start),
            uint64(end)
        );
    }

    /**
     * @notice Withdraw the caller's vested, not-yet-withdrawn balance.
     * @dev Only the recipient may withdraw. Checks-effects-interactions plus
     *      ReentrancyGuard.
     */
    function withdraw(uint256 streamId) external nonReentrant {
        Stream storage stream = _requireStream(streamId);
        if (msg.sender != stream.recipient) revert NotStreamRecipient(msg.sender);

        uint256 amount = _withdrawable(stream);
        if (amount == 0) revert NothingToWithdraw();

        // Effects before interaction.
        stream.withdrawn += amount;

        emit StreamWithdrawn(streamId, msg.sender, amount, stream.withdrawn);

        (bool ok, ) = msg.sender.call{value: amount}("");
        if (!ok) revert ReentrantCallBlocked();
    }

    /**
     * @notice Cancel an active stream with a post-quantum authorization.
     * @dev The authorization binds chain id, this contract, the sender, the
     *      stream id, the action, the sender's current nonce and a deadline.
     *      The nonce is raised before the refund, so a signature is single-use.
     * @param streamId The stream to cancel.
     * @param pubkey The sender's registered 2592-byte ML-DSA-87 public key.
     * @param signature The 4627-byte ML-DSA-87 signature over the auth message.
     * @param deadline Unix timestamp after which the authorization is invalid.
     */
    function cancelStream(
        uint256 streamId,
        bytes calldata pubkey,
        bytes calldata signature,
        uint256 deadline
    ) external nonReentrant {
        Stream storage stream = _requireStream(streamId);
        if (msg.sender != stream.sender) revert NotStreamSender(msg.sender);
        if (stream.cancelled) revert StreamIsCancelled(streamId);
        if (block.timestamp >= stream.endTime) revert StreamCompleted(streamId);
        if (block.timestamp > deadline) {
            revert AuthorizationExpired(deadline, block.timestamp);
        }

        uint256 nonce = cancelNonce[msg.sender];
        bytes32 authorizationHash = cancelAuthorizationHash(
            msg.sender,
            streamId,
            nonce,
            deadline
        );

        // Reverts unless the supplied key matches the sender's registered key,
        // that key has a proven proof of possession, and pqcVerify accepts the
        // signature over the authorization message.
        pqcVerifier.verifySignature(
            msg.sender,
            pubkey,
            signature,
            abi.encodePacked(authorizationHash)
        );

        uint256 recipientEntitlement = _accrued(stream);
        uint256 refund = stream.deposit - recipientEntitlement;

        // Effects before interaction.
        cancelNonce[msg.sender] = nonce + 1;
        stream.cancelled = true;
        stream.cancelledAt = uint64(block.timestamp);

        emit StreamCancelled(
            streamId,
            msg.sender,
            refund,
            recipientEntitlement,
            uint64(block.timestamp),
            nonce
        );

        if (refund > 0) {
            (bool ok, ) = msg.sender.call{value: refund}("");
            if (!ok) revert ReentrantCallBlocked();
        }
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    /// @notice Number of streams ever created.
    function getStreamCount() external view returns (uint256) {
        return nextStreamId - 1;
    }

    /// @notice Full stream record. Reverts for an unknown id.
    function getStream(uint256 streamId)
        external
        view
        returns (Stream memory)
    {
        return _requireStream(streamId);
    }

    /// @notice Vested amount at the current block timestamp.
    function getAccrued(uint256 streamId) public view returns (uint256) {
        return _accrued(_requireStream(streamId));
    }

    /// @notice Vested minus already withdrawn.
    function getWithdrawable(uint256 streamId) public view returns (uint256) {
        return _withdrawable(_requireStream(streamId));
    }

    /**
     * @notice One-call snapshot for the frontend: record plus derived values.
     * @dev The client still recomputes accrual locally between polls; this is
     *      the on-chain source of truth used to reconcile it.
     */
    function getStreamView(uint256 streamId)
        external
        view
        returns (
            Stream memory stream,
            uint256 accrued,
            uint256 withdrawable
        )
    {
        Stream storage stored = _requireStream(streamId);
        accrued = _accrued(stored);
        withdrawable = accrued - stored.withdrawn;
        stream = stored;
    }

    /**
     * @notice The exact message hash the sender must sign with ML-DSA-87.
     * @dev Exposed so the frontend and tests never re-implement the encoding.
     */
    function cancelAuthorizationHash(
        address sender,
        uint256 streamId,
        uint256 nonce,
        uint256 deadline
    ) public view returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    DOMAIN_SEPARATOR,
                    CANCEL_TYPEHASH,
                    sender,
                    streamId,
                    CANCEL_ACTION,
                    nonce,
                    deadline
                )
            );
    }

    // ---------------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------------

    function _requireStream(uint256 streamId)
        private
        view
        returns (Stream storage stream)
    {
        stream = _streams[streamId];
        if (stream.sender == address(0)) revert StreamNotFound(streamId);
    }

    /// @dev `floor(deposit * elapsed / duration)`, elapsed clamped to the
    ///      stream's effective window. A cancelled stream stops accruing at
    ///      `cancelledAt`; a completed stream is fully vested.
    function _accrued(Stream storage stream) private view returns (uint256) {
        uint256 effectiveNow = stream.cancelled
            ? uint256(stream.cancelledAt)
            : block.timestamp;

        if (effectiveNow <= stream.startTime) return 0;

        uint256 duration = uint256(stream.endTime) - uint256(stream.startTime);
        uint256 elapsed = effectiveNow - uint256(stream.startTime);
        if (elapsed >= duration) return stream.deposit;

        return Math.mulDiv(stream.deposit, elapsed, duration);
    }

    function _withdrawable(Stream storage stream)
        private
        view
        returns (uint256)
    {
        return _accrued(stream) - stream.withdrawn;
    }
}
