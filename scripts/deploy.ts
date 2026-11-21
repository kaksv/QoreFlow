import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Deploys QoreFlow to QoreChain Diana Testnet (EVM chain ID 9800).
 *
 * Preconditions (see docs/QORECHAIN_INTEGRATION.md and docs/TESTNET_EVIDENCE.md):
 *   - DEPLOYER_PRIVATE_KEY set to a throwaway testnet key.
 *   - The deployer has QOR from https://dashboard.qorechain.io/faucet.
 *   - The deployer has a registered ML-DSA-87 key with proof of possession.
 *   - An EVM authorization window is open. Deployment counts as one EVM
 *     transaction and a target-scoped window refuses contract creation, so the
 *     deployment window must be unscoped. Open the window BEFORE reading the
 *     nonce: opening it advances the account sequence, which is the EVM nonce.
 */

const EXPECTED_CHAIN_ID = 9800n;
const PQC_VERIFY = "0x0000000000000000000000000000000000000a01";
const PQC_KEY_STATUS = "0x0000000000000000000000000000000000000a02";

async function main() {
  const network = await ethers.provider.getNetwork();
  if (network.chainId !== EXPECTED_CHAIN_ID) {
    if (process.env.ALLOW_NON_TESTNET !== "true") {
      throw new Error(
        `Refusing to deploy: chain id ${network.chainId} is not QoreChain Diana testnet (9800). ` +
          `Set ALLOW_NON_TESTNET=true only if you are intentionally targeting another network.`,
      );
    }
    console.warn(`WARNING: deploying to non-testnet chain id ${network.chainId}`);
  }

  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error("No deployer account configured. Set DEPLOYER_PRIVATE_KEY.");
  }
  const deployerAddress = await deployer.getAddress();
  const balance = await ethers.provider.getBalance(deployerAddress);

  console.log("Network       :", network.name, `(chainId ${network.chainId})`);
  console.log("Deployer      :", deployerAddress);
  console.log("Balance       :", ethers.formatEther(balance), "QOR");
  if (balance === 0n) {
    throw new Error(
      "Deployer has zero QOR. Fund it at https://dashboard.qorechain.io/faucet",
    );
  }

  console.log("\nDeploying QorePQCVerifier (canonical precompile wiring)...");
  const Verifier = await ethers.getContractFactory("QorePQCVerifier");
  const verifier = await Verifier.deploy(PQC_VERIFY, PQC_KEY_STATUS);
  const verifierReceipt = await verifier.deploymentTransaction()!.wait();
  const verifierAddress = await verifier.getAddress();
  console.log("  QorePQCVerifier:", verifierAddress);
  console.log("  tx            :", verifierReceipt!.hash);

  if (!(await verifier.isCanonicalWiring())) {
    throw new Error("Verifier is not wired to the canonical precompiles.");
  }

  console.log("\nDeploying QoreFlow...");
  const Flow = await ethers.getContractFactory("QoreFlow");
  const flow = await Flow.deploy(await verifier.getAddress());
  const flowReceipt = await flow.deploymentTransaction()!.wait();
  const flowAddress = await flow.getAddress();
  console.log("  QoreFlow      :", flowAddress);
  console.log("  tx            :", flowReceipt!.hash);
  console.log("  block         :", flowReceipt!.blockNumber);

  const deployment = {
    network: network.name,
    chainId: Number(network.chainId),
    deployer: deployerAddress,
    qoreFlow: flowAddress,
    qoreFlowTx: flowReceipt!.hash,
    qoreFlowBlock: flowReceipt!.blockNumber,
    pqcVerifier: verifierAddress,
    pqcVerifierTx: verifierReceipt!.hash,
    pqcVerifyPrecompile: PQC_VERIFY,
    pqcKeyStatusPrecompile: PQC_KEY_STATUS,
    deployedAt: new Date().toISOString(),
  };

  const outDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${network.chainId}.json`);
  fs.writeFileSync(outFile, JSON.stringify(deployment, null, 2));
  console.log(`\nDeployment written to ${outFile}`);
  console.log(
    `\nSet NEXT_PUBLIC_CONTRACT_ADDRESS=${flowAddress} in .env.local and Vercel.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
