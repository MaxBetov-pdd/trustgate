import { ethers } from "ethers";
import { BASE_SEPOLIA_RPC, TRUSTGATE_PRIVATE_KEY, ESCROW_CONTRACT_ADDRESS } from "./config";

const provider = new ethers.JsonRpcProvider(BASE_SEPOLIA_RPC);
const wallet = new ethers.Wallet(TRUSTGATE_PRIVATE_KEY, provider);

// Embedded ABI for TrustGateEscrow contract
const abi = [{ "inputs": [{ "internalType": "address", "name": "_usdcToken", "type": "address" }], "stateMutability": "nonpayable", "type": "constructor" }, { "inputs": [], "name": "ReentrancyGuardReentrantCall", "type": "error" }, { "inputs": [{ "internalType": "address", "name": "token", "type": "address" }], "name": "SafeERC20FailedOperation", "type": "error" }, { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "uint256", "name": "escrowId", "type": "uint256" }, { "indexed": false, "internalType": "uint8", "name": "score", "type": "uint8" }], "name": "EscrowApproved", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "uint256", "name": "escrowId", "type": "uint256" }, { "indexed": true, "internalType": "address", "name": "buyer", "type": "address" }, { "indexed": true, "internalType": "address", "name": "seller", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" }], "name": "EscrowCreated", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "uint256", "name": "escrowId", "type": "uint256" }, { "indexed": false, "internalType": "uint8", "name": "score", "type": "uint8" }, { "indexed": false, "internalType": "uint256", "name": "percentToSeller", "type": "uint256" }], "name": "EscrowPartial", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "uint256", "name": "escrowId", "type": "uint256" }, { "indexed": false, "internalType": "uint8", "name": "score", "type": "uint8" }], "name": "EscrowRefunded", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "uint256", "name": "escrowId", "type": "uint256" }, { "indexed": false, "internalType": "bytes32", "name": "resultHash", "type": "bytes32" }], "name": "ResultSubmitted", "type": "event" }, { "inputs": [{ "internalType": "address", "name": "seller", "type": "address" }, { "internalType": "address", "name": "arbiter", "type": "address" }, { "internalType": "uint256", "name": "amount", "type": "uint256" }, { "internalType": "bytes32", "name": "taskHash", "type": "bytes32" }], "name": "createEscrow", "outputs": [{ "internalType": "uint256", "name": "escrowId", "type": "uint256" }], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [], "name": "escrowCount", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "name": "escrows", "outputs": [{ "internalType": "address", "name": "buyer", "type": "address" }, { "internalType": "address", "name": "seller", "type": "address" }, { "internalType": "address", "name": "arbiter", "type": "address" }, { "internalType": "uint256", "name": "amount", "type": "uint256" }, { "internalType": "bytes32", "name": "taskHash", "type": "bytes32" }, { "internalType": "bytes32", "name": "resultHash", "type": "bytes32" }, { "internalType": "enum TrustGateEscrow.EscrowStatus", "name": "status", "type": "uint8" }, { "internalType": "uint256", "name": "createdAt", "type": "uint256" }, { "internalType": "uint256", "name": "resolvedAt", "type": "uint256" }, { "internalType": "uint8", "name": "score", "type": "uint8" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "uint256", "name": "escrowId", "type": "uint256" }], "name": "getEscrow", "outputs": [{ "components": [{ "internalType": "address", "name": "buyer", "type": "address" }, { "internalType": "address", "name": "seller", "type": "address" }, { "internalType": "address", "name": "arbiter", "type": "address" }, { "internalType": "uint256", "name": "amount", "type": "uint256" }, { "internalType": "bytes32", "name": "taskHash", "type": "bytes32" }, { "internalType": "bytes32", "name": "resultHash", "type": "bytes32" }, { "internalType": "enum TrustGateEscrow.EscrowStatus", "name": "status", "type": "uint8" }, { "internalType": "uint256", "name": "createdAt", "type": "uint256" }, { "internalType": "uint256", "name": "resolvedAt", "type": "uint256" }, { "internalType": "uint8", "name": "score", "type": "uint8" }], "internalType": "struct TrustGateEscrow.Escrow", "name": "", "type": "tuple" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "uint256", "name": "escrowId", "type": "uint256" }, { "internalType": "uint8", "name": "score", "type": "uint8" }], "name": "resolveApprove", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "uint256", "name": "escrowId", "type": "uint256" }, { "internalType": "uint8", "name": "percentToSeller", "type": "uint8" }, { "internalType": "uint8", "name": "score", "type": "uint8" }], "name": "resolvePartial", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "uint256", "name": "escrowId", "type": "uint256" }, { "internalType": "uint8", "name": "score", "type": "uint8" }], "name": "resolveRefund", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "uint256", "name": "escrowId", "type": "uint256" }, { "internalType": "bytes32", "name": "resultHash", "type": "bytes32" }], "name": "submitResult", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [], "name": "usdcToken", "outputs": [{ "internalType": "contract IERC20", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" }];

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
