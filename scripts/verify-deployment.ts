import { ethers } from "hardhat";

/**
 * Post-deployment verification. Read-only: sends no transactions.
 * Checks chain id, bytecode presence, canonical PQC wiring and the stream
 * counter. Run after scripts/deploy.ts.
 */
const EXPECTED_CHAIN_ID = 9800n;

async function main() {
  const address =
    process.env.QOREFLOW_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
  if (!address) {
    throw new Error(
      "Set QOREFLOW_ADDRESS or NEXT_PUBLIC_CONTRACT_ADDRESS to the deployed QoreFlow address.",
    );
  }

  const network = await ethers.provider.getNetwork();
  console.log("chainId          :", network.chainId.toString());
  if (network.chainId !== EXPECTED_CHAIN_ID) {
    throw new Error("Not connected to QoreChain Diana testnet (9800).");
  }

  const code = await ethers.provider.getCode(address);
  if (code === "0x") throw new Error(`No bytecode at ${address}`);
  console.log("bytecode bytes   :", (code.length - 2) / 2);

  const flow = await ethers.getContractAt("QoreFlow", address);
  const verifierAddress = await flow.pqcVerifier();
  console.log("pqcVerifier      :", verifierAddress);

  const verifier = await ethers.getContractAt(
    "QorePQCVerifier",
    verifierAddress,
  );
  const canonical = await verifier.isCanonicalWiring();
  const verifyAddr = await verifier.pqcVerifyPrecompile();
  const keyStatusAddr = await verifier.pqcKeyStatusPrecompile();
  console.log("pqcVerify        :", verifyAddr);
  console.log("pqcKeyStatus     :", keyStatusAddr);
  console.log("canonical wiring :", canonical);
  if (!canonical) throw new Error("Verifier is not canonically wired.");

  console.log("stream count     :", (await flow.getStreamCount()).toString());
  console.log("domain separator :", await flow.DOMAIN_SEPARATOR());
  console.log("cancel action    :", await flow.CANCEL_ACTION());

  console.log("\nVerification OK.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
