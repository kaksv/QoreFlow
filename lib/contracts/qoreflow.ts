import { Contract, type Provider, type Signer } from "ethers";
import { CONTRACT_ADDRESS, PQC } from "@/lib/config";

/**
 * Human-readable ABI for QoreFlow. Kept in sync with contracts/QoreFlow.sol.
 * The `getStreamView` tuple order matches the Solidity struct exactly.
 */
export const QOREFLOW_ABI = [
  "function createStream(address recipient, uint64 duration) payable returns (uint256)",
  "function withdraw(uint256 streamId)",
  "function cancelStream(uint256 streamId, bytes pubkey, bytes signature, uint256 deadline)",
  "function getStream(uint256 streamId) view returns (tuple(address sender, address recipient, uint256 deposit, uint64 startTime, uint64 endTime, uint64 cancelledAt, uint256 withdrawn, bool cancelled))",
  "function getStreamView(uint256 streamId) view returns (tuple(address sender, address recipient, uint256 deposit, uint64 startTime, uint64 endTime, uint64 cancelledAt, uint256 withdrawn, bool cancelled) stream, uint256 accrued, uint256 withdrawable)",
  "function getAccrued(uint256 streamId) view returns (uint256)",
  "function getWithdrawable(uint256 streamId) view returns (uint256)",
  "function getStreamCount() view returns (uint256)",
  "function cancelNonce(address sender) view returns (uint256)",
  "function cancelAuthorizationHash(address sender, uint256 streamId, uint256 nonce, uint256 deadline) view returns (bytes32)",
  "function nextStreamId() view returns (uint256)",
  "function MAX_DURATION() view returns (uint64)",
  "function CANCEL_ACTION() view returns (bytes32)",
  "function DOMAIN_SEPARATOR() view returns (bytes32)",
  "function pqcVerifier() view returns (address)",
  "event StreamCreated(uint256 indexed streamId, address indexed sender, address indexed recipient, uint256 deposit, uint64 startTime, uint64 endTime)",
  "event StreamWithdrawn(uint256 indexed streamId, address indexed recipient, uint256 amount, uint256 totalWithdrawn)",
  "event StreamCancelled(uint256 indexed streamId, address indexed sender, uint256 refund, uint256 recipientEntitlement, uint64 cancelledAt, uint256 nonce)",
  "error ZeroRecipient()",
  "error ZeroDeposit()",
  "error ZeroDuration()",
  "error DurationTooLong(uint64 duration)",
  "error StreamNotFound(uint256 streamId)",
  "error NotStreamRecipient(address caller)",
  "error NotStreamSender(address caller)",
  "error StreamIsCancelled(uint256 streamId)",
  "error StreamCompleted(uint256 streamId)",
  "error NothingToWithdraw()",
  "error AuthorizationExpired(uint256 deadline, uint256 nowTimestamp)",
  "error InvalidPostQuantumSignature()",
  "error KeyNotRegistered(address account)",
  "error KeyPossessionNotProven(address account)",
  "error SuppliedKeyDoesNotMatchRegistration()",
  "error UnsupportedAlgorithm(uint8 algorithmId)",
  "error SuppliedKeyMalformed(uint256 length)",
  "error SignatureMalformed(uint256 length)",
  "error PrecompileReturnedNoData(address precompile)",
] as const;

export const PQC_KEY_STATUS_ABI = [
  "function pqcKeyStatus(address account) view returns (bool registered, uint8 algorithmId, bytes pubkey, bool possessionProven)",
] as const;

export function getReadContract(provider: Provider): Contract | null {
  if (!CONTRACT_ADDRESS) return null;
  return new Contract(CONTRACT_ADDRESS, QOREFLOW_ABI, provider);
}

export function getWriteContract(signer: Signer): Contract {
  return new Contract(CONTRACT_ADDRESS, QOREFLOW_ABI, signer);
}

export function getKeyStatusContract(provider: Provider): Contract {
  return new Contract(PQC.keyStatusPrecompile, PQC_KEY_STATUS_ABI, provider);
}
