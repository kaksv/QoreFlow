import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { mldsa } from "@qorechain/pqc";
import type { Contract } from "ethers";
import {
  authorizeCancel,
  buildAuthorizationHash,
  deployFixture,
  type Fixture,
} from "./helpers/setup";

const DEPOSIT = ethers.parseEther("100");
const DURATION = 1000n;

interface Keypair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

describe("QoreFlow — post-quantum authorized cancellation", () => {
  let fixture: Fixture;
  let streamId: bigint;
  let startTime: bigint;
  let deadline: bigint;
  let keypair: Keypair;

  beforeEach(async () => {
    fixture = await deployFixture();
    keypair = mldsa.keygen() as Keypair;

    await fixture.flow
      .connect(fixture.sender)
      .createStream(fixture.recipientAddress, DURATION, { value: DEPOSIT });
    streamId = 1n;
    startTime = BigInt((await fixture.flow.getStream(streamId)).startTime);
    await time.increaseTo(startTime + 400n);
    deadline = BigInt(await time.latest()) + 86_400n;
  });

  it("sanity-checks the ML-DSA-87 key and signature sizes", () => {
    expect(keypair.publicKey.length).to.equal(2592);
    const signature = mldsa.sign(
      keypair.secretKey,
      ethers.getBytes(ethers.id("size-check")),
    );
    expect(signature.length).to.equal(4627);
  });

  it("accepts a valid sender authorization and pays the correct refund", async () => {
    const { signature, pubkey } = await authorizeCancel(
      fixture,
      fixture.senderAddress,
      streamId,
      deadline,
      keypair,
      mldsa,
    );

    // Pin the cancellation block so the split is exact: 500/1000 elapsed.
    await time.setNextBlockTimestamp(startTime + 500n);
    const expectedEntitlement = ethers.parseEther("50");
    const expectedRefund = ethers.parseEther("50");
    const senderBefore = await ethers.provider.getBalance(
      fixture.senderAddress,
    );

    const tx = await fixture.flow
      .connect(fixture.sender)
      .cancelStream(streamId, pubkey, signature, deadline);
    const receipt = await tx.wait();
    const gasCost = receipt!.gasUsed * receipt!.gasPrice;

    await expect(tx)
      .to.emit(fixture.flow, "StreamCancelled")
      .withArgs(
        streamId,
        fixture.senderAddress,
        expectedRefund,
        expectedEntitlement,
        anyValue,
        0n,
      );

    const senderAfter = await ethers.provider.getBalance(fixture.senderAddress);
    expect(senderAfter - senderBefore + gasCost).to.equal(expectedRefund);

    const stream = await fixture.flow.getStream(streamId);
    expect(stream.cancelled).to.equal(true);
    expect(stream.cancelledAt > 0n).to.equal(true);
    expect(await fixture.flow.cancelNonce(fixture.senderAddress)).to.equal(1n);
    expect(await ethers.provider.getBalance(await fixture.flow.getAddress())).to.equal(
      expectedEntitlement,
    );

    // The recipient's vested funds survive cancellation and remain withdrawable.
    expect(await fixture.flow.getWithdrawable(streamId)).to.equal(
      expectedEntitlement,
    );
    await fixture.flow.connect(fixture.recipient).withdraw(streamId);
    expect(
      await ethers.provider.getBalance(await fixture.flow.getAddress()),
    ).to.equal(0n);
  });

  it("freezes accrual at the cancellation timestamp", async () => {
    const { signature, pubkey } = await authorizeCancel(
      fixture,
      fixture.senderAddress,
      streamId,
      deadline,
      keypair,
      mldsa,
    );
    await fixture.flow
      .connect(fixture.sender)
      .cancelStream(streamId, pubkey, signature, deadline);

    const frozen = await fixture.flow.getAccrued(streamId);
    await time.increase(10_000n);
    expect(await fixture.flow.getAccrued(streamId)).to.equal(frozen);
  });

  it("rejects a signature the precompile does not accept", async () => {
    const { signature, pubkey } = await authorizeCancel(
      fixture,
      fixture.senderAddress,
      streamId,
      deadline,
      keypair,
      mldsa,
      { markValid: false },
    );

    await expect(
      fixture.flow
        .connect(fixture.sender)
        .cancelStream(streamId, pubkey, signature, deadline),
    ).to.be.revertedWithCustomError(
      fixture.verifier,
      "InvalidPostQuantumSignature",
    );
  });

  it("rejects a signature made by a different (unregistered) key", async () => {
    const attacker = mldsa.keygen() as Keypair;
    // The sender's genuine key is registered and bound.
    const { pubkey } = await authorizeCancel(
      fixture,
      fixture.senderAddress,
      streamId,
      deadline,
      keypair,
      mldsa,
      { markValid: false },
    );
    // The attacker signs the same hash with their own key.
    const hash = await fixture.flow.cancelAuthorizationHash(
      fixture.senderAddress,
      streamId,
      0n,
      deadline,
    );
    const attackerSignature = ethers.hexlify(
      mldsa.sign(attacker.secretKey, ethers.getBytes(hash)),
    );

    await expect(
      fixture.flow
        .connect(fixture.sender)
        .cancelStream(streamId, pubkey, attackerSignature, deadline),
    ).to.be.revertedWithCustomError(
      fixture.verifier,
      "InvalidPostQuantumSignature",
    );
  });

  it("rejects an account with no registered key", async () => {
    const signature = ethers.hexlify(
      mldsa.sign(keypair.secretKey, ethers.getBytes(ethers.id("nothing"))),
    );
    const pubkey = ethers.hexlify(keypair.publicKey);

    await expect(
      fixture.flow
        .connect(fixture.sender)
        .cancelStream(streamId, pubkey, signature, deadline),
    ).to.be.revertedWithCustomError(fixture.verifier, "KeyNotRegistered");
  });

  it("rejects a key registered without proof of possession", async () => {
    const { signature, pubkey } = await authorizeCancel(
      fixture,
      fixture.senderAddress,
      streamId,
      deadline,
      keypair,
      mldsa,
      { possessionProven: false },
    );

    await expect(
      fixture.flow
        .connect(fixture.sender)
        .cancelStream(streamId, pubkey, signature, deadline),
    ).to.be.revertedWithCustomError(
      fixture.verifier,
      "KeyPossessionNotProven",
    );
  });

  it("rejects a supplied key that differs from the registered key", async () => {
    const otherKey = mldsa.keygen() as Keypair;
    await fixture.keyStatus.setKey(
      fixture.senderAddress,
      1,
      ethers.hexlify(keypair.publicKey),
      true,
    );
    const hash = await fixture.flow.cancelAuthorizationHash(
      fixture.senderAddress,
      streamId,
      0n,
      deadline,
    );
    const foreignSignature = ethers.hexlify(
      mldsa.sign(otherKey.secretKey, ethers.getBytes(hash)),
    );
    await fixture.mockVerify.setValid(
      ethers.hexlify(otherKey.publicKey),
      foreignSignature,
      hash,
      true,
    );

    await expect(
      fixture.flow
        .connect(fixture.sender)
        .cancelStream(
          streamId,
          ethers.hexlify(otherKey.publicKey),
          foreignSignature,
          deadline,
        ),
    ).to.be.revertedWithCustomError(
      fixture.verifier,
      "SuppliedKeyDoesNotMatchRegistration",
    );
  });

  it("rejects a wrong chain id", async () => {
    const { signature, pubkey } = await authorizeCancel(
      fixture,
      fixture.senderAddress,
      streamId,
      deadline,
      keypair,
      mldsa,
      { chainId: 9800n },
    );

    await expect(
      fixture.flow
        .connect(fixture.sender)
        .cancelStream(streamId, pubkey, signature, deadline),
    ).to.be.revertedWithCustomError(
      fixture.verifier,
      "InvalidPostQuantumSignature",
    );
  });

  it("rejects a wrong contract address", async () => {
    const { signature, pubkey } = await authorizeCancel(
      fixture,
      fixture.senderAddress,
      streamId,
      deadline,
      keypair,
      mldsa,
      { verifyingContract: fixture.otherAddress },
    );

    await expect(
      fixture.flow
        .connect(fixture.sender)
        .cancelStream(streamId, pubkey, signature, deadline),
    ).to.be.revertedWithCustomError(
      fixture.verifier,
      "InvalidPostQuantumSignature",
    );
  });

  it("rejects a wrong stream id", async () => {
    const { signature, pubkey } = await authorizeCancel(
      fixture,
      fixture.senderAddress,
      streamId + 1n,
      deadline,
      keypair,
      mldsa,
    );

    await expect(
      fixture.flow
        .connect(fixture.sender)
        .cancelStream(streamId, pubkey, signature, deadline),
    ).to.be.revertedWithCustomError(
      fixture.verifier,
      "InvalidPostQuantumSignature",
    );
  });

  it("rejects a wrong action type", async () => {
    const { signature, pubkey } = await authorizeCancel(
      fixture,
      fixture.senderAddress,
      streamId,
      deadline,
      keypair,
      mldsa,
      { action: ethers.id("QOREFLOW_WITHDRAW_V1") },
    );

    await expect(
      fixture.flow
        .connect(fixture.sender)
        .cancelStream(streamId, pubkey, signature, deadline),
    ).to.be.revertedWithCustomError(
      fixture.verifier,
      "InvalidPostQuantumSignature",
    );
  });

  it("rejects an expired deadline before verifying the signature", async () => {
    const expired = BigInt(await time.latest()) - 1n;
    const { signature, pubkey } = await authorizeCancel(
      fixture,
      fixture.senderAddress,
      streamId,
      expired,
      keypair,
      mldsa,
    );

    await expect(
      fixture.flow
        .connect(fixture.sender)
        .cancelStream(streamId, pubkey, signature, expired),
    ).to.be.revertedWithCustomError(fixture.flow, "AuthorizationExpired");
  });

  it("rejects a reused nonce after a successful cancellation", async () => {
    const first = await authorizeCancel(
      fixture,
      fixture.senderAddress,
      streamId,
      deadline,
      keypair,
      mldsa,
    );
    await fixture.flow
      .connect(fixture.sender)
      .cancelStream(streamId, first.pubkey, first.signature, deadline);

    // Same signature against a second stream must fail: the nonce moved on.
    await fixture.flow
      .connect(fixture.sender)
      .createStream(fixture.recipientAddress, DURATION, { value: DEPOSIT });
    await expect(
      fixture.flow
        .connect(fixture.sender)
        .cancelStream(2n, first.pubkey, first.signature, deadline),
    ).to.be.revertedWithCustomError(
      fixture.verifier,
      "InvalidPostQuantumSignature",
    );

    // A fresh authorization for nonce 1 succeeds.
    const second = await authorizeCancel(
      fixture,
      fixture.senderAddress,
      2n,
      deadline,
      keypair,
      mldsa,
    );
    expect(second.nonce).to.equal(1n);
    await expect(
      fixture.flow
        .connect(fixture.sender)
        .cancelStream(2n, second.pubkey, second.signature, deadline),
    ).to.emit(fixture.flow, "StreamCancelled");
  });

  it("rejects cancelling an already-cancelled stream", async () => {
    const first = await authorizeCancel(
      fixture,
      fixture.senderAddress,
      streamId,
      deadline,
      keypair,
      mldsa,
    );
    await fixture.flow
      .connect(fixture.sender)
      .cancelStream(streamId, first.pubkey, first.signature, deadline);

    await expect(
      fixture.flow
        .connect(fixture.sender)
        .cancelStream(streamId, first.pubkey, first.signature, deadline),
    ).to.be.revertedWithCustomError(fixture.flow, "StreamIsCancelled");
  });

  it("rejects cancelling a completed stream", async () => {
    const end = BigInt((await fixture.flow.getStream(streamId)).endTime);
    await time.increaseTo(end + 1n);
    const extended = BigInt(await time.latest()) + 86_400n;
    const { signature, pubkey } = await authorizeCancel(
      fixture,
      fixture.senderAddress,
      streamId,
      extended,
      keypair,
      mldsa,
    );

    await expect(
      fixture.flow
        .connect(fixture.sender)
        .cancelStream(streamId, pubkey, signature, extended),
    ).to.be.revertedWithCustomError(fixture.flow, "StreamCompleted");
  });

  it("rejects a caller who is not the stream sender", async () => {
    const { signature, pubkey } = await authorizeCancel(
      fixture,
      fixture.senderAddress,
      streamId,
      deadline,
      keypair,
      mldsa,
    );
    await fixture.keyStatus.setKey(
      fixture.otherAddress,
      1,
      pubkey,
      true,
    );

    await expect(
      fixture.flow
        .connect(fixture.other)
        .cancelStream(streamId, pubkey, signature, deadline),
    ).to.be.revertedWithCustomError(fixture.flow, "NotStreamSender");
  });

  it("rejects a malformed public key and a malformed signature", async () => {
    const { signature, pubkey } = await authorizeCancel(
      fixture,
      fixture.senderAddress,
      streamId,
      deadline,
      keypair,
      mldsa,
    );

    await expect(
      fixture.flow
        .connect(fixture.sender)
        .cancelStream(streamId, "0x1234", signature, deadline),
    ).to.be.revertedWithCustomError(fixture.verifier, "SuppliedKeyMalformed");

    await expect(
      fixture.flow
        .connect(fixture.sender)
        .cancelStream(streamId, pubkey, "0x1234", deadline),
    ).to.be.revertedWithCustomError(fixture.verifier, "SignatureMalformed");
  });

  it("rejects an unsupported (non ML-DSA-87) algorithm id", async () => {
    const hash = await fixture.flow.cancelAuthorizationHash(
      fixture.senderAddress,
      streamId,
      0n,
      deadline,
    );
    const signature = ethers.hexlify(
      mldsa.sign(keypair.secretKey, ethers.getBytes(hash)),
    );
    const pubkey = ethers.hexlify(keypair.publicKey);
    await fixture.keyStatus.setKey(fixture.senderAddress, 2, pubkey, true);

    await expect(
      fixture.flow
        .connect(fixture.sender)
        .cancelStream(streamId, pubkey, signature, deadline),
    ).to.be.revertedWithCustomError(fixture.verifier, "UnsupportedAlgorithm");
  });

  it("fails loudly if the key-status precompile returns no data", async () => {
    // An address with no code returns success with empty data, which is what
    // the inactive-precompile case looks like on mainnet.
    const Verifier = await ethers.getContractFactory("QorePQCVerifier");
    const verifier = await Verifier.deploy(
      await fixture.mockVerify.getAddress(),
      await fixture.otherAddress,
    );
    await verifier.waitForDeployment();
    const Flow = await ethers.getContractFactory("QoreFlow");
    const flow = await Flow.deploy(await verifier.getAddress());
    await flow.waitForDeployment();
    await flow
      .connect(fixture.sender)
      .createStream(fixture.recipientAddress, DURATION, { value: DEPOSIT });

    await expect(
      verifier.getKeyStatus(fixture.senderAddress),
    ).to.be.revertedWithCustomError(verifier, "PrecompileReturnedNoData");
  });
});

// Keep the helper import used and document the encoding contract tests rely on.
describe("QoreFlow — authorization encoding", () => {
  it("matches the off-chain hash builder byte for byte", async () => {
    const fixture = await deployFixture();
    const sender = fixture.senderAddress;
    const onChain = await fixture.flow.cancelAuthorizationHash(
      sender,
      7n,
      3n,
      1_900_000_000n,
    );
    const offChain = buildAuthorizationHash({
      chainId: 31337n,
      verifyingContract: await fixture.flow.getAddress(),
      sender,
      streamId: 7n,
      action: await fixture.flow.CANCEL_ACTION(),
      nonce: 3n,
      deadline: 1_900_000_000n,
    });
    expect(onChain).to.equal(offChain);
  });
});
