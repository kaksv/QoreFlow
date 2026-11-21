import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import type { Contract } from "ethers";
import { deployFixture, MAX_DURATION, type Fixture } from "./helpers/setup";

const ONE_QOR = ethers.parseEther("1");
const DURATION = 1000n;

async function createStream(
  fixture: Fixture,
  recipient: string,
  deposit: bigint,
  duration: bigint,
): Promise<bigint> {
  const tx = await fixture.flow
    .connect(fixture.sender)
    .createStream(recipient, duration, { value: deposit });
  await tx.wait();
  return (await fixture.flow.nextStreamId()) - 1n;
}

describe("QoreFlow — stream creation", () => {
  let fixture: Fixture;

  beforeEach(async () => {
    fixture = await deployFixture();
  });

  it("creates a funded stream and emits StreamCreated", async () => {
    const deposit = ethers.parseEther("12.5");
    const before = BigInt(await time.latest());

    const tx = await fixture.flow
      .connect(fixture.sender)
      .createStream(fixture.recipientAddress, DURATION, { value: deposit });

    const stream = await fixture.flow.getStream(1);
    // Event args are asserted against the stored record, then the event itself.
    await expect(tx)
      .to.emit(fixture.flow, "StreamCreated")
      .withArgs(
        1n,
        fixture.senderAddress,
        fixture.recipientAddress,
        deposit,
        stream.startTime,
        stream.endTime,
      );

    expect(stream.sender).to.equal(fixture.senderAddress);
    expect(stream.recipient).to.equal(fixture.recipientAddress);
    expect(stream.deposit).to.equal(deposit);
    expect(stream.withdrawn).to.equal(0n);
    expect(stream.cancelled).to.equal(false);
    expect(BigInt(stream.startTime) >= before).to.equal(true);
    expect(stream.endTime - stream.startTime).to.equal(DURATION);
    expect(await fixture.flow.getStreamCount()).to.equal(1n);
    expect(await ethers.provider.getBalance(await fixture.flow.getAddress())).to.equal(
      deposit,
    );
  });

  it("increments stream ids monotonically", async () => {
    await createStream(fixture, fixture.recipientAddress, ONE_QOR, DURATION);
    await createStream(fixture, fixture.otherAddress, ONE_QOR, DURATION);
    expect(await fixture.flow.nextStreamId()).to.equal(3n);
    expect((await fixture.flow.getStream(1)).recipient).to.equal(
      fixture.recipientAddress,
    );
    expect((await fixture.flow.getStream(2)).recipient).to.equal(
      fixture.otherAddress,
    );
  });

  it("rejects a zero deposit", async () => {
    await expect(
      fixture.flow
        .connect(fixture.sender)
        .createStream(fixture.recipientAddress, DURATION, { value: 0 }),
    ).to.be.revertedWithCustomError(fixture.flow, "ZeroDeposit");
  });

  it("rejects the zero recipient", async () => {
    await expect(
      fixture.flow
        .connect(fixture.sender)
        .createStream(ethers.ZeroAddress, DURATION, { value: ONE_QOR }),
    ).to.be.revertedWithCustomError(fixture.flow, "ZeroRecipient");
  });

  it("rejects a zero duration", async () => {
    await expect(
      fixture.flow
        .connect(fixture.sender)
        .createStream(fixture.recipientAddress, 0, { value: ONE_QOR }),
    ).to.be.revertedWithCustomError(fixture.flow, "ZeroDuration");
  });

  it("rejects a duration above the maximum", async () => {
    await expect(
      fixture.flow
        .connect(fixture.sender)
        .createStream(fixture.recipientAddress, MAX_DURATION + 1, {
          value: ONE_QOR,
        }),
    ).to.be.revertedWithCustomError(fixture.flow, "DurationTooLong");
  });

  it("accepts exactly the maximum duration", async () => {
    const id = await createStream(
      fixture,
      fixture.recipientAddress,
      ONE_QOR,
      BigInt(MAX_DURATION),
    );
    const stream = await fixture.flow.getStream(id);
    expect(stream.endTime - stream.startTime).to.equal(BigInt(MAX_DURATION));
  });

  it("reverts for an unknown stream id", async () => {
    await expect(fixture.flow.getStream(999)).to.be.revertedWithCustomError(
      fixture.flow,
      "StreamNotFound",
    );
  });
});

describe("QoreFlow — accrual", () => {
  let fixture: Fixture;
  let streamId: bigint;
  let startTime: bigint;
  const deposit = 10_000n;

  beforeEach(async () => {
    fixture = await deployFixture();
    streamId = await createStream(
      fixture,
      fixture.recipientAddress,
      deposit,
      1000n,
    );
    startTime = BigInt((await fixture.flow.getStream(streamId)).startTime);
  });

  it("is zero at stream start", async () => {
    expect(await fixture.flow.getAccrued(streamId)).to.equal(0n);
  });

  it("accrues proportionally after one second", async () => {
    await time.increaseTo(startTime + 1n);
    expect(await fixture.flow.getAccrued(streamId)).to.equal(10n);
  });

  it("accrues half the deposit at the halfway point", async () => {
    await time.increaseTo(startTime + 500n);
    expect(await fixture.flow.getAccrued(streamId)).to.equal(5000n);
  });

  it("is fully vested at completion", async () => {
    await time.increaseTo(startTime + 1000n);
    expect(await fixture.flow.getAccrued(streamId)).to.equal(deposit);
  });

  it("stays fully vested after completion", async () => {
    await time.increaseTo(startTime + 1000n + 50_000n);
    expect(await fixture.flow.getAccrued(streamId)).to.equal(deposit);
  });

  it("rounds down deterministically for non-divisible deposits", async () => {
    const id = await createStream(fixture, fixture.recipientAddress, 10n, 3n);
    const start = BigInt((await fixture.flow.getStream(id)).startTime);

    await time.increaseTo(start + 1n);
    expect(await fixture.flow.getAccrued(id)).to.equal(3n);
    await time.increaseTo(start + 2n);
    expect(await fixture.flow.getAccrued(id)).to.equal(6n);
    await time.increaseTo(start + 3n);
    // The full deposit vests exactly at the end, with no lost wei.
    expect(await fixture.flow.getAccrued(id)).to.equal(10n);
  });

  it("handles a one-second stream", async () => {
    const id = await createStream(fixture, fixture.recipientAddress, 777n, 1n);
    const start = BigInt((await fixture.flow.getStream(id)).startTime);
    expect(await fixture.flow.getAccrued(id)).to.equal(0n);
    await time.increaseTo(start + 1n);
    expect(await fixture.flow.getAccrued(id)).to.equal(777n);
  });

  it("returns zero withdrawable before any accrual", async () => {
    expect(await fixture.flow.getWithdrawable(streamId)).to.equal(0n);
  });

  it("returns accrued-minus-withdrawn as withdrawable", async () => {
    await time.setNextBlockTimestamp(startTime + 500n);
    await fixture.flow.connect(fixture.recipient).withdraw(streamId);
    expect(await fixture.flow.getWithdrawable(streamId)).to.equal(0n);
    await time.increaseTo(startTime + 600n);
    expect(await fixture.flow.getWithdrawable(streamId)).to.equal(1000n);
  });
});

describe("QoreFlow — withdrawal", () => {
  let fixture: Fixture;
  let streamId: bigint;
  const deposit = ethers.parseEther("100");

  beforeEach(async () => {
    fixture = await deployFixture();
    streamId = await createStream(
      fixture,
      fixture.recipientAddress,
      deposit,
      DURATION,
    );
    const stream = await fixture.flow.getStream(streamId);
    // Pin the timestamp of the *next* transaction so accrual is exact.
    await time.setNextBlockTimestamp(BigInt(stream.startTime) + 500n);
  });

  it("lets the recipient withdraw vested funds", async () => {
    const expected = ethers.parseEther("50");
    const before = await ethers.provider.getBalance(fixture.recipientAddress);

    const tx = await fixture.flow
      .connect(fixture.recipient)
      .withdraw(streamId);
    const receipt = await tx.wait();
    const gasCost = receipt!.gasUsed * receipt!.gasPrice;

    const after = await ethers.provider.getBalance(fixture.recipientAddress);
    expect(after - before + gasCost).to.equal(expected);
    expect((await fixture.flow.getStream(streamId)).withdrawn).to.equal(expected);
  });

  it("emits StreamWithdrawn", async () => {
    await expect(fixture.flow.connect(fixture.recipient).withdraw(streamId))
      .to.emit(fixture.flow, "StreamWithdrawn")
      .withArgs(
        streamId,
        fixture.recipientAddress,
        ethers.parseEther("50"),
        ethers.parseEther("50"),
      );
  });

  it("reverts when nothing has accrued", async () => {
    // 1 wei over 1e8 seconds = 0 wei for the first second (floor), so a
    // withdrawal immediately after creation has nothing to pay.
    const freshId = await createStream(
      fixture,
      fixture.recipientAddress,
      1n,
      100_000_000n,
    );
    await expect(
      fixture.flow.connect(fixture.recipient).withdraw(freshId),
    ).to.be.revertedWithCustomError(fixture.flow, "NothingToWithdraw");
  });

  it("supports repeated withdrawals and never double-pays", async () => {
    const stream = await fixture.flow.getStream(streamId);
    const start = BigInt(stream.startTime);

    await fixture.flow.connect(fixture.recipient).withdraw(streamId);
    expect((await fixture.flow.getStream(streamId)).withdrawn).to.equal(
      ethers.parseEther("50"),
    );

    await time.setNextBlockTimestamp(start + 1000n);
    await fixture.flow.connect(fixture.recipient).withdraw(streamId);
    expect((await fixture.flow.getStream(streamId)).withdrawn).to.equal(
      deposit,
    );

    // Fully paid out: a further withdrawal must fail.
    await time.setNextBlockTimestamp(start + 1001n);
    await expect(
      fixture.flow.connect(fixture.recipient).withdraw(streamId),
    ).to.be.revertedWithCustomError(fixture.flow, "NothingToWithdraw");
  });

  it("rejects an unauthorized caller", async () => {
    await expect(
      fixture.flow.connect(fixture.other).withdraw(streamId),
    ).to.be.revertedWithCustomError(fixture.flow, "NotStreamRecipient");
  });

  it("rejects the sender withdrawing their own stream", async () => {
    await expect(
      fixture.flow.connect(fixture.sender).withdraw(streamId),
    ).to.be.revertedWithCustomError(fixture.flow, "NotStreamRecipient");
  });

  it("pays the full deposit after completion", async () => {
    const stream = await fixture.flow.getStream(streamId);
    await time.increaseTo(BigInt(stream.endTime) + 100n);
    await fixture.flow.connect(fixture.recipient).withdraw(streamId);
    const after = await fixture.flow.getStream(streamId);
    expect(after.withdrawn).to.equal(deposit);
    expect(await fixture.flow.getWithdrawable(streamId)).to.equal(0n);
  });

  it("blocks reentrancy and does not increase withdrawals", async () => {
    const Reentrant = await ethers.getContractFactory("ReentrantRecipient");
    const attacker = await Reentrant.deploy(await fixture.flow.getAddress());
    await attacker.waitForDeployment();

    const id = await createStream(
      fixture,
      await attacker.getAddress(),
      OneQor(),
      DURATION,
    );
    const stream = await fixture.flow.getStream(id);
    await time.increaseTo(BigInt(stream.startTime) + 500n);

    await expect(attacker.attack(id)).to.be.revertedWithCustomError(
      fixture.flow,
      "ReentrantCallBlocked",
    );
    expect((await fixture.flow.getStream(id)).withdrawn).to.equal(0n);
  });

  it("reverts cleanly when the recipient rejects the transfer", async () => {
    const Rejecting = await ethers.getContractFactory("RejectingRecipient");
    const rejecting = await Rejecting.deploy();
    await rejecting.waitForDeployment();

    const id = await createStream(
      fixture,
      await rejecting.getAddress(),
      ONE_QOR,
      DURATION,
    );
    const stream = await fixture.flow.getStream(id);
    await time.increaseTo(BigInt(stream.startTime) + 500n);

    await expect(
      rejecting.withdrawFrom(await fixture.flow.getAddress(), id),
    ).to.be.revertedWithCustomError(fixture.flow, "ReentrantCallBlocked");
  });
});

function OneQor(): bigint {
  return ethers.parseEther("1");
}
