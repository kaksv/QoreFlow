import { expect } from "chai";
import { ethers } from "hardhat";
import { mldsa } from "@qorechain/pqc";
import type { Provider, Wallet } from "ethers";

/**
 * Real QoreChain Diana testnet integration suite.
 *
 * There is NO mock fallback here. Every assertion talks to chain 9800 and the
 * live PQC precompiles. The suite is read-only: it signs an authorization
 * off-chain and asks the real `pqcVerify` precompile to validate it. It never
 * broadcasts a transaction, so it costs nothing and cannot move funds.
 *
 * Required environment (see .env.example):
 *   TESTNET_SENDER_PRIVATE_KEY   throwaway EVM key, coin-type 60
 *   TESTNET_PQC_SECRET_KEY_HEX   4896-byte ML-DSA-87 secret key (hex)
 *   TESTNET_QOREFLOW_ADDRESS     deployed QoreFlow address
 *
 * Run with:
 *   npm run test:testnet
 */

const CHAIN_ID = 9800n;
const PQC_VERIFY = "0x0000000000000000000000000000000000000a01";
const PQC_KEY_STATUS = "0x0000000000000000000000000000000000000a02";
const ML_DSA_87 = 1;
const PUBKEY_BYTES = 2592;

const privateKey = process.env.TESTNET_SENDER_PRIVATE_KEY?.trim();
const secretKeyHex = process.env.TESTNET_PQC_SECRET_KEY_HEX?.trim();
const flowAddress = (
  process.env.TESTNET_QOREFLOW_ADDRESS ||
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
  ""
).trim();

const enabled = Boolean(privateKey && secretKeyHex && flowAddress);

const keyStatusIface = new ethers.Interface([
  "function pqcKeyStatus(address account) view returns (bool registered, uint8 algorithmId, bytes pubkey, bool possessionProven)",
]);
const verifyIface = new ethers.Interface([
  "function pqcVerify(bytes pubkey, bytes signature, bytes message) view returns (bool valid)",
]);

if (!enabled) {
  // Deliberately explicit. A skipped suite is honest; a mocked "pass" is not.
  // eslint-disable-next-line no-console
  console.warn(
    "\n[testnet] SKIPPED: set TESTNET_SENDER_PRIVATE_KEY, TESTNET_PQC_SECRET_KEY_HEX and TESTNET_QOREFLOW_ADDRESS.\n" +
      "[testnet] This suite never broadcasts transactions; it only calls the real precompiles.\n",
  );
}

const suite = enabled ? describe : describe.skip;

suite("QoreChain Diana — real PQC precompiles", function () {
  this.timeout(180_000);

  let provider: Provider;
  let wallet: Wallet;
  let registeredPubkey: string;

  before(async () => {
    provider = ethers.provider;
    wallet = new ethers.Wallet(privateKey as string, provider);
  });

  it("is connected to QoreChain Diana testnet (chain 9800)", async () => {
    const network = await provider.getNetwork();
    expect(network.chainId).to.equal(CHAIN_ID);
  });

  it("reads a live key from the pqcKeyStatus precompile (not a mock)", async () => {
    const data = keyStatusIface.encodeFunctionData("pqcKeyStatus", [
      wallet.address,
    ]);
    const ret = await provider.call({ to: PQC_KEY_STATUS, data });

    // An inactive precompile returns empty data. This is the single most
    // important check: it proves we are talking to a real endpoint.
    expect(ret).to.not.equal("0x");
    expect((ret.length - 2) / 2).to.be.greaterThanOrEqual(128);

    const [registered, algorithmId, pubkey, possessionProven] =
      keyStatusIface.decodeFunctionResult("pqcKeyStatus", ret);

    expect(registered).to.equal(true);
    expect(Number(algorithmId)).to.equal(ML_DSA_87);
    expect(possessionProven).to.equal(true);
    expect(pubkey as string).to.match(/^0x[0-9a-fA-F]+$/);
    expect((pubkey as string).length).to.equal(PUBKEY_BYTES * 2 + 2);

    registeredPubkey = pubkey as string;
  });

  it("has canonical precompile wiring in the deployed contracts", async () => {
    const flow = await ethers.getContractAt("QoreFlow", flowAddress);
    const verifierAddress = await flow.pqcVerifier();
    const verifier = await ethers.getContractAt(
      "QorePQCVerifier",
      verifierAddress,
    );

    expect(await verifier.isCanonicalWiring()).to.equal(true);
    expect(await verifier.pqcVerifyPrecompile()).to.equal(PQC_VERIFY);
    expect(await verifier.pqcKeyStatusPrecompile()).to.equal(PQC_KEY_STATUS);
  });

  it("builds the on-chain cancellation hash and accepts a real ML-DSA-87 signature", async () => {
    const flow = await ethers.getContractAt("QoreFlow", flowAddress);
    const nonce = (await flow.cancelNonce(wallet.address)) as bigint;
    const block = await provider.getBlock("latest");
    const deadline = BigInt(block?.timestamp ?? Math.floor(Date.now() / 1000)) + 600n;

    // The contract is the source of truth for the message. We never rebuild it
    // here, so the test cannot drift from the Solidity encoding.
    const hash = (await flow.cancelAuthorizationHash(
      wallet.address,
      1n,
      nonce,
      deadline,
    )) as string;

    const secretKey = ethers.getBytes(secretKeyHex as string);
    expect(secretKey.length).to.equal(4896);

    const signature = ethers.hexlify(
      mldsa.sign(secretKey, ethers.getBytes(hash)),
    );
    expect((signature.length - 2) / 2).to.equal(4627);

    // Local check, then the real chain-side check.
    expect(
      mldsa.verify(
        ethers.getBytes(registeredPubkey),
        ethers.getBytes(hash),
        ethers.getBytes(signature),
      ),
    ).to.equal(true);

    const data = verifyIface.encodeFunctionData("pqcVerify", [
      registeredPubkey,
      signature,
      hash,
    ]);
    const ret = await provider.call({ to: PQC_VERIFY, data });
    expect(ret).to.not.equal("0x");

    const [valid] = verifyIface.decodeFunctionResult("pqcVerify", ret);
    expect(valid).to.equal(true);
  });

  it("rejects a tampered message with the real precompile", async () => {
    const flow = await ethers.getContractAt("QoreFlow", flowAddress);
    const nonce = (await flow.cancelNonce(wallet.address)) as bigint;
    const block = await provider.getBlock("latest");
    const deadline = BigInt(block?.timestamp ?? Math.floor(Date.now() / 1000)) + 600n;

    const hash = (await flow.cancelAuthorizationHash(
      wallet.address,
      2n,
      nonce,
      deadline,
    )) as string;

    const signature = ethers.hexlify(
      mldsa.sign(
        ethers.getBytes(secretKeyHex as string),
        ethers.getBytes(hash),
      ),
    );

    const tampered = ethers.getBytes(hash);
    tampered[0] ^= 0xff;

    const data = verifyIface.encodeFunctionData("pqcVerify", [
      registeredPubkey,
      signature,
      ethers.hexlify(tampered),
    ]);
    const ret = await provider.call({ to: PQC_VERIFY, data });
    const [valid] = verifyIface.decodeFunctionResult("pqcVerify", ret);
    expect(valid).to.equal(false);
  });

  it("rejects a signature from a different key with the real precompile", async () => {
    const flow = await ethers.getContractAt("QoreFlow", flowAddress);
    const nonce = (await flow.cancelNonce(wallet.address)) as bigint;
    const block = await provider.getBlock("latest");
    const deadline = BigInt(block?.timestamp ?? Math.floor(Date.now() / 1000)) + 600n;

    const hash = (await flow.cancelAuthorizationHash(
      wallet.address,
      3n,
      nonce,
      deadline,
    )) as string;

    const attacker = mldsa.keygen();
    const attackerSignature = ethers.hexlify(
      mldsa.sign(attacker.secretKey, ethers.getBytes(hash)),
    );

    const data = verifyIface.encodeFunctionData("pqcVerify", [
      ethers.hexlify(attacker.publicKey),
      attackerSignature,
      hash,
    ]);
    const ret = await provider.call({ to: PQC_VERIFY, data });
    const [valid] = verifyIface.decodeFunctionResult("pqcVerify", ret);
    expect(valid).to.equal(false);
  });
});
