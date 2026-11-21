import { ethers } from "hardhat";
import type { Signer } from "ethers";
import type {
  MockPQCKeyStatus,
  MockPQCVerify,
  QoreFlow,
  QorePQCVerifier,
} from "../../typechain-types";

export const ML_DSA_87 = 1;
export const MAX_DURATION = 315_360_000;

export interface Fixture {
  flow: QoreFlow;
  verifier: QorePQCVerifier;
  keyStatus: MockPQCKeyStatus;
  mockVerify: MockPQCVerify;
  sender: Signer;
  recipient: Signer;
  other: Signer;
  senderAddress: string;
  recipientAddress: string;
  otherAddress: string;
}

/**
 * Deploys the real QorePQCVerifier and QoreFlow, wired to the clearly-labelled
 * test doubles in contracts/test/MockQorePrecompiles.sol. The verifier itself
 * (encoding, length checks, key binding, empty-return guard) is the production
 * contract; only the two precompile endpoints are substituted.
 */
export async function deployFixture(): Promise<Fixture> {
  const [sender, recipient, other] = await ethers.getSigners();

  const KeyStatus = await ethers.getContractFactory("MockPQCKeyStatus");
  const keyStatus = await KeyStatus.deploy();
  await keyStatus.waitForDeployment();

  const MockVerify = await ethers.getContractFactory("MockPQCVerify");
  const mockVerify = await MockVerify.deploy();
  await mockVerify.waitForDeployment();

  const Verifier = await ethers.getContractFactory("QorePQCVerifier");
  const verifier = await Verifier.deploy(
    await mockVerify.getAddress(),
    await keyStatus.getAddress(),
  );
  await verifier.waitForDeployment();

  const Flow = await ethers.getContractFactory("QoreFlow");
  const flow = await Flow.deploy(await verifier.getAddress());
  await flow.waitForDeployment();

  return {
    flow,
    verifier,
    keyStatus,
    mockVerify,
    sender,
    recipient,
    other,
    senderAddress: await sender.getAddress(),
    recipientAddress: await recipient.getAddress(),
    otherAddress: await other.getAddress(),
  };
}

export function toBytes32(value: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(value));
}

/**
 * Builds the exact authorization hash the contract will recompute, signs it
 * off-chain with a genuine ML-DSA-87 key, proves the signature verifies with
 * @qorechain/pqc, then registers the key and the signature in the test doubles.
 *
 * Overrides let individual tests tamper with one bound field.
 */
export async function authorizeCancel(
  fixture: Fixture,
  signerAccount: string,
  streamId: bigint | number,
  deadline: bigint | number,
  keypair: { publicKey: Uint8Array; secretKey: Uint8Array },
  mldsa: {
    sign: (sk: Uint8Array, msg: Uint8Array) => Uint8Array;
    verify: (pk: Uint8Array, msg: Uint8Array, sig: Uint8Array) => boolean;
  },
  overrides: {
    chainId?: bigint;
    verifyingContract?: string;
    action?: string;
    nonce?: bigint;
    registeredAccount?: string;
    possessionProven?: boolean;
    markValid?: boolean;
  } = {},
): Promise<{ signature: string; pubkey: string; message: string; nonce: bigint }> {
  const nonce =
    overrides.nonce ?? (await fixture.flow.cancelNonce(signerAccount));

  let hash: string;
  if (
    overrides.chainId === undefined &&
    overrides.verifyingContract === undefined &&
    overrides.action === undefined
  ) {
    hash = await fixture.flow.cancelAuthorizationHash(
      signerAccount,
      streamId,
      nonce,
      deadline,
    );
  } else {
    hash = buildAuthorizationHash({
      chainId: overrides.chainId ?? 31337n,
      verifyingContract:
        overrides.verifyingContract ?? (await fixture.flow.getAddress()),
      sender: signerAccount,
      streamId: BigInt(streamId),
      action:
        overrides.action ??
        (await fixture.flow.CANCEL_ACTION()),
      nonce,
      deadline: BigInt(deadline),
    });
  }

  const message = ethers.getBytes(hash);
  const signature = mldsa.sign(keypair.secretKey, message);
  if (!mldsa.verify(keypair.publicKey, message, signature)) {
    throw new Error("test setup: local ML-DSA-87 signature did not verify");
  }

  const pubkey = ethers.hexlify(keypair.publicKey);
  const signatureHex = ethers.hexlify(signature);

  await fixture.keyStatus.setKey(
    overrides.registeredAccount ?? signerAccount,
    ML_DSA_87,
    pubkey,
    overrides.possessionProven ?? true,
  );
  if (overrides.markValid !== false) {
    await fixture.mockVerify.setValid(pubkey, signatureHex, hash, true);
  }

  return { signature: signatureHex, pubkey, message: hash, nonce };
}

/** Mirrors QoreFlow's domain separator + type hash encoding. */
export function buildAuthorizationHash(args: {
  chainId: bigint;
  verifyingContract: string;
  sender: string;
  streamId: bigint;
  action: string;
  nonce: bigint;
  deadline: bigint;
}): string {
  const coder = ethers.AbiCoder.defaultAbiCoder();
  const domainTypehash = ethers.keccak256(
    ethers.toUtf8Bytes(
      "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)",
    ),
  );
  const cancelTypehash = ethers.keccak256(
    ethers.toUtf8Bytes(
      "CancelStream(address sender,uint256 streamId,bytes32 action,uint256 nonce,uint256 deadline)",
    ),
  );
  const domain = ethers.keccak256(
    coder.encode(
      ["bytes32", "bytes32", "bytes32", "uint256", "address"],
      [
        domainTypehash,
        ethers.keccak256(ethers.toUtf8Bytes("QoreFlow")),
        ethers.keccak256(ethers.toUtf8Bytes("1")),
        args.chainId,
        args.verifyingContract,
      ],
    ),
  );
  return ethers.keccak256(
    coder.encode(
      ["bytes32", "bytes32", "address", "uint256", "bytes32", "uint256", "uint256"],
      [
        domain,
        cancelTypehash,
        args.sender,
        args.streamId,
        args.action,
        args.nonce,
        args.deadline,
      ],
    ),
  );
}
