import dotenv from "dotenv";
import path from "path";
import fs from "fs";

dotenv.config({ path: path.join(__dirname, "../../.env") });

export const PORT = process.env.PORT || 4021;
export const WS_PORT = process.env.WS_PORT || 4022;

export const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "mock-key";
export const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "mock-openrouter-key";
export const X402_FACILITATOR_URL = process.env.X402_FACILITATOR_URL || "https://www.x402.org/facilitator";

// Load address.json
let addressConfig = { ESCROW_CONTRACT_ADDRESS: "", USDC_ADDRESS: "" };
try {
    const file = fs.readFileSync(path.join(__dirname, "../../address.json"), "utf8");
    addressConfig = JSON.parse(file);
} catch (e) {
    console.warn("Could not read address.json yet");
}

export const ESCROW_CONTRACT_ADDRESS = process.env.ESCROW_CONTRACT_ADDRESS || addressConfig.ESCROW_CONTRACT_ADDRESS;
export const USDC_ADDRESS = process.env.USDC_ADDRESS || addressConfig.USDC_ADDRESS;

export const TRUSTGATE_PRIVATE_KEY = process.env.TRUSTGATE_PRIVATE_KEY || "0x1234567890123456789012345678901234567890123456789012345678901234";

export const SELLER_WALLET_ADDRESS = process.env.SELLER_WALLET_ADDRESS || "0x8888888888888888888888888888888888888888";

export const BASE_SEPOLIA_RPC = process.env.BASE_SEPOLIA_RPC || "https://sepolia.base.org";
