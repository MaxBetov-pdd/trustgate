import { ethers } from "ethers";
import { BASE_SEPOLIA_RPC, TRUSTGATE_PRIVATE_KEY, ESCROW_CONTRACT_ADDRESS } from "./config";
import fs from "fs";
import path from "path";

const provider = new ethers.JsonRpcProvider(BASE_SEPOLIA_RPC);
const wallet = new ethers.Wallet(TRUSTGATE_PRIVATE_KEY, provider);

// Load ABI dynamically
let abi: any[] = [];
try {
    const artifactPath = path.join(__dirname, "../../contracts/artifacts/contracts/TrustGateEscrow.sol/TrustGateEscrow.json");
    abi = JSON.parse(fs.readFileSync(artifactPath, "utf-8")).abi;
} catch (e) {
    console.error("Could not load ABI yet");
}

export const escrowContract = new ethers.Contract(ESCROW_CONTRACT_ADDRESS || ethers.ZeroAddress, abi, wallet);

export async function createEscrowOnChain(sellerAddress: string, amount: string | number, taskHash: string, arbiterAddress: string) {
    if (!ESCROW_CONTRACT_ADDRESS) return 0;

    const usdcAddress = await escrowContract.usdcToken();
    const tokenAbi = [
        "function approve(address spender, uint256 amount) public returns (bool)",
        "function allowance(address owner, address spender) public view returns (uint256)"
    ];
    const tokenContract = new ethers.Contract(usdcAddress, tokenAbi, wallet);

    // Check current allowance — Circle USDC requires reset to 0 before changing non-zero allowance
    const currentAllowance = await tokenContract.allowance(wallet.address, ESCROW_CONTRACT_ADDRESS);
    if (currentAllowance < BigInt(amount)) {
        if (currentAllowance > 0n) {
            console.log("[CHAIN] Resetting USDC allowance to 0 first");
            const resetTx = await tokenContract.approve(ESCROW_CONTRACT_ADDRESS, 0);
            await resetTx.wait();
        }
        console.log("[CHAIN] Approving USDC MaxUint256 for escrow contract");
        const approveTx = await tokenContract.approve(ESCROW_CONTRACT_ADDRESS, ethers.MaxUint256);
        await approveTx.wait();
    }

    try {
        const tx = await escrowContract.createEscrow(sellerAddress, arbiterAddress, amount, ethers.id(taskHash));
        const receipt = await tx.wait();

        let escrowId = 0n;
        for (const log of receipt.logs) {
            try {
                const parsed = escrowContract.interface.parseLog(log);
                if (parsed && parsed.name === 'EscrowCreated') {
                    escrowId = parsed.args[0];
                    break;
                }
            } catch (e) { }
        }
        return Number(escrowId);
    } catch (error: any) {
        console.error("Contract Error in createEscrowOnChain:", error.message || error);
        throw error;
    }
}

export async function resolveEscrowApprove(escrowId: number, score: number) {
    if (ESCROW_CONTRACT_ADDRESS) {
        const tx = await escrowContract.resolveApprove(escrowId, score);
        await tx.wait();
        return tx.hash;
    }
    return `0xmock${Date.now()}`;
}

export async function resolveEscrowRefund(escrowId: number, score: number) {
    if (ESCROW_CONTRACT_ADDRESS) {
        const tx = await escrowContract.resolveRefund(escrowId, score);
        await tx.wait();
        return tx.hash;
    }
    return `0xmock${Date.now()}`;
}

export async function resolveEscrowPartial(escrowId: number, percentToSeller: number, score: number) {
    if (ESCROW_CONTRACT_ADDRESS) {
        const tx = await escrowContract.resolvePartial(escrowId, percentToSeller, score);
        await tx.wait();
        return tx.hash;
    }
    return `0xmock${Date.now()}`;
}
