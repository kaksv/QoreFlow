import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { mldsa } from "@qorechain/pqc";
import { authorizeCancel, deployFixture } from "../helpers/setup";

/** Deterministic PRNG so failures are reproducible. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("QoreFlow — accounting invariants", () => {
  it("keeps contract balance equal to outstanding liabilities under random use", async () => {
    const fixture = await deployFixture();
    const flowAddress = await fixture.flow.getAddress();
    const keypair = mldsa.keygen() as {
      publicKey: Uint8Array;
      secretKey: Uint8Array;
    };

    interface Ledger {
      deposit: bigint;
      withdrawn: bigint;
      refunded: bigint;
      cancelled: boolean;
    }
    const ledger = new Map<bigint, Ledger>();

    const reconcile = async () => {
      let expected = 0n;
      for (const entry of ledger.values()) {
        expected += entry.deposit - entry.withdrawn - entry.refunded;
      }
      expect(await ethers.provider.getBalance(flowAddress)).to.equal(expected);
    };

    const rand = mulberry32(0xc0ffee);
    for (let i = 0; i < 25; i++) {
      const deposit = BigInt(1 + Math.floor(rand() * 5_000_000_000_000));
      const duration = BigInt(1 + Math.floor(rand() * 100_000));
      await fixture.flow
        .connect(fixture.sender)
        .createStream(fixture.recipientAddress, duration, { value: deposit });
      const id = (await fixture.flow.nextStreamId()) - 1n;
      ledger.set(id, { deposit, withdrawn: 0n, refunded: 0n, cancelled: false });

      // Advance to a random point inside (or past) the stream.
      const stream = await flowStream(fixture, id);
      const elapsed = BigInt(Math.floor(rand() * Number(duration + 10n)));
      await time.increaseTo(BigInt(stream.startTime) + elapsed);
      await reconcile();
    }

    // Random withdrawals and cancellations.
    for (let step = 0; step < 40; step++) {
      const ids = [...ledger.keys()];
      const id = ids[Math.floor(rand() * ids.length)];
      const entry = ledger.get(id)!;
      const stream = await flowStream(fixture, id);

      if (rand() < 0.65 && !entry.cancelled) {
        const accrued = await fixture.flow.getAccrued(id);
        const withdrawable = (accrued as bigint) - entry.withdrawn;
        if (withdrawable > 0n) {
          await fixture.flow.connect(fixture.recipient).withdraw(id);
          // Read the settled value: the tx mines one block after the estimate.
          entry.withdrawn = (await flowStream(fixture, id)).withdrawn;
        }
      } else if (rand() < 0.5 && !entry.cancelled && BigInt(await time.latest()) < BigInt(stream.endTime)) {
        const deadline = BigInt(await time.latest()) + 3_600n;
        const auth = await authorizeCancel(
          fixture,
          fixture.senderAddress,
          id,
          deadline,
          keypair,
          mldsa,
        );
        await fixture.flow
          .connect(fixture.sender)
          .cancelStream(id, auth.pubkey, auth.signature, deadline);
        entry.cancelled = true;
        const accrued = await fixture.flow.getAccrued(id);
        entry.refunded = entry.deposit - (accrued as bigint);
      } else {
        await time.increase(1 + Math.floor(rand() * 2_000));
      }

      await reconcile();

      const current = await flowStream(fixture, id);
      expect(current.withdrawn <= current.deposit).to.equal(true);
      const accrued = await fixture.flow.getAccrued(id);
      expect(accrued <= current.deposit).to.equal(true);
      expect(current.withdrawn <= accrued).to.equal(true);
    }

    // After completion every stream is fully vested; draining all of them
    // leaves the contract with exactly zero.
    for (const [id, entry] of ledger) {
      const stream = await flowStream(fixture, id);
      const target = BigInt(stream.endTime) + 1n;
      if (target > BigInt(await time.latest())) {
        await time.increaseTo(target);
      }
      const accrued = await fixture.flow.getAccrued(id);
      const withdrawable = (accrued as bigint) - entry.withdrawn;
      if (withdrawable > 0n) {
        await fixture.flow.connect(fixture.recipient).withdraw(id);
        entry.withdrawn = (await flowStream(fixture, id)).withdrawn;
      }
    }
    await reconcile();
    expect(await ethers.provider.getBalance(flowAddress)).to.equal(0n);
  });

  it("never refunds more than the unvested amount, at any cancellation time", async () => {
    const fixture = await deployFixture();
    const keypair = mldsa.keygen() as {
      publicKey: Uint8Array;
      secretKey: Uint8Array;
    };
    const deposit = ethers.parseEther("10");
    const duration = 1000n;

    // Values start at 5 because the key-registration setup transactions mine a
    // couple of blocks before the cancellation.
    for (const elapsed of [5n, 250n, 499n, 500n, 750n, 900n, 995n]) {
      await fixture.flow
        .connect(fixture.sender)
        .createStream(fixture.recipientAddress, duration, { value: deposit });
      const id = (await fixture.flow.nextStreamId()) - 1n;
      const stream = await flowStream(fixture, id);

      const startTime = BigInt(stream.startTime);
      const balanceBefore = await ethers.provider.getBalance(
        await fixture.flow.getAddress(),
      );
      const deadline = BigInt(await time.latest()) + 3_600n;
      const auth = await authorizeCancel(
        fixture,
        fixture.senderAddress,
        id,
        deadline,
        keypair,
        mldsa,
      );
      // Pin the cancellation to the intended elapsed second.
      await time.setNextBlockTimestamp(startTime + elapsed);
      const tx = await fixture.flow
        .connect(fixture.sender)
        .cancelStream(id, auth.pubkey, auth.signature, deadline);
      const receipt = await tx.wait();
      const cancelBlock = await ethers.provider.getBlock(receipt!.blockNumber);
      const cancelTimestamp = BigInt(cancelBlock!.timestamp);
      const expectedEntitlement =
        (deposit * (cancelTimestamp - startTime)) / duration;

      const cancellation = receipt!.logs
        .filter((log) => {
          try {
            return fixture.flow.interface.parseLog(log)?.name === "StreamCancelled";
          } catch {
            return false;
          }
        })
        .map((log) => fixture.flow.interface.parseLog(log)!)[0];

      const refund: bigint = cancellation.args.refund;
      const recipientEntitlement: bigint = cancellation.args.recipientEntitlement;

      // The contract's own numbers, the event and the deposit agree exactly.
      expect(recipientEntitlement).to.equal(expectedEntitlement);
      expect(refund + recipientEntitlement).to.equal(deposit);
      expect(await fixture.flow.getAccrued(id)).to.equal(expectedEntitlement);
      expect(await fixture.flow.getWithdrawable(id)).to.equal(
        expectedEntitlement,
      );

      const after = await flowStream(fixture, id);
      expect(after.deposit - after.withdrawn - refund).to.equal(
        recipientEntitlement,
      );

      // Only the unvested part left the contract.
      expect(
        await ethers.provider.getBalance(await fixture.flow.getAddress()),
      ).to.equal(balanceBefore - refund);

      // The recipient can still take every vested wei.
      await fixture.flow.connect(fixture.recipient).withdraw(id);
      expect(await fixture.flow.getWithdrawable(id)).to.equal(0n);
    }
  });
});

async function flowStream(fixture: Awaited<ReturnType<typeof deployFixture>>, id: bigint) {
  return fixture.flow.getStream(id) as Promise<{
    sender: string;
    recipient: string;
    deposit: bigint;
    startTime: bigint;
    endTime: bigint;
    cancelledAt: bigint;
    withdrawn: bigint;
    cancelled: boolean;
  }>;
}
