import hre from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
    const usdcAddress = process.env.USDC_ADDRESS || "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

    const signers = await hre.ethers.getSigners();
    if (signers.length === 0) {
        throw new Error("No deployer account configured. Set DEPLOYER_PRIVATE_KEY in .env.");
    }
    const deployer = signers[0];
    console.log("Deploying TrustGateEscrow with USDC address:", usdcAddress);
    console.log("Deploying with account:", deployer.address);

    const ContractFactory = await hre.ethers.getContractFactory("TrustGateEscrow");
    const contract = await ContractFactory.connect(deployer).deploy(usdcAddress);
    await contract.waitForDeployment();

    const deployedAddress = await contract.getAddress();
    console.log("TrustGateEscrow deployed to:", deployedAddress);

    // Save to config file for backend/frontend
    const config = {
        ESCROW_CONTRACT_ADDRESS: deployedAddress,
        USDC_ADDRESS: usdcAddress,
        NETWORK: await hre.ethers.provider.getNetwork().then(n => n.chainId.toString())
    };

    fs.writeFileSync(
        path.join(__dirname, "../../address.json"),
        JSON.stringify(config, null, 2)
    );

    console.log("Saved address.json config");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
