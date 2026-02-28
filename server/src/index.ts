import express, { Request, Response } from "express";
import cors from "cors";
import http from "http";
import path from "path";
import fs from "fs";
import { WebSocketServer, WebSocket } from "ws";
import { PORT, WS_PORT, X402_FACILITATOR_URL, TRUSTGATE_PRIVATE_KEY, SELLER_WALLET_ADDRESS } from "./config";
import { evaluateResult } from "./arbiter";
import { mockSellerExecute } from "./mockSeller";
import { resolveEscrowApprove, resolveEscrowRefund, createEscrowOnChain } from "./contract";

// x402 Real Integration
// @ts-ignore
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
// @ts-ignore
import { ExactEvmScheme } from "@x402/evm/exact/server";
// @ts-ignore
import { HTTPFacilitatorClient } from "@x402/core/server";
import { privateKeyToAccount } from "viem/accounts";

import { USDC_ADDRESS } from "./config";

const app = express();
app.use(cors({
    origin: '*',
    allowedHeaders: ['Content-Type', 'Authorization', 'x-target-url', 'x-escrow-amount', 'x-quality-criteria', 'x-payment', 'payment-signature', 'x-seller-address'],
    exposedHeaders: ['WWW-Authenticate', 'PAYMENT-REQUIRED']
}));
app.use(express.json());

// Setup WebSockets — will be attached to HTTP server below
const wsClients = new Set<WebSocket>();

function setupWs(wss: WebSocketServer) {
    wss.on("connection", (ws: WebSocket) => {
        wsClients.add(ws);
        ws.on("close", () => wsClients.delete(ws));
    });
}

function broadcast(event: string, data: any) {
    const message = JSON.stringify({ event, data, timestamp: Date.now() });
    wsClients.forEach((c: WebSocket) => {
        if (c.readyState === WebSocket.OPEN) {
            c.send(message);
        }
    });
}

// x402 Server Setup
const signer = privateKeyToAccount(TRUSTGATE_PRIVATE_KEY as `0x${string}`);
const facilitatorClient = new HTTPFacilitatorClient({ url: X402_FACILITATOR_URL });
const x402Server = new x402ResourceServer(facilitatorClient)
    .register("eip155:84532", new ExactEvmScheme());

// In-memory Database for Escrows
let nextEscrowId = 1;
const escrows = new Map<number, any>();

// Protect the escrow creation endpoint with x402 payment
app.use(
    paymentMiddleware(
        {
            "POST /api/escrow/create": {
                accepts: [
                    {
                        scheme: "exact",
                        price: "$0.01", // $0.01 fee for escrow creation
                        network: "eip155:84532", // Base Sepolia
                        payTo: signer.address,
                    },
                ],
                description: "Create an escrow for a task with AI arbitration",
                mimeType: "application/json",
            },
        },
        x402Server,
    ),
);

app.post("/api/escrow/create", async (req: Request, res: Response) => {
    const { seller_url, task, quality_criteria, amount } = req.body;
    const id = nextEscrowId++;

    const escrowData = {
        id, seller_url, task, quality_criteria, amount, status: 'Created',
        createdAt: Date.now(), result: null, aiVerdict: null, txHash: null
    };
    escrows.set(id, escrowData);
    broadcast("escrow:created", escrowData);

    res.json({ success: true, escrowId: id });
});

app.get("/api/escrow/:id", (req: Request, res: Response): any => {
    const id = Number(req.params.id);
    const data = escrows.get(id);
    if (!data) return res.status(404).json({ error: "Not found" });
    res.json(data);
});

app.get("/api/escrows", (req: Request, res: Response) => {
    res.json(Array.from(escrows.values()));
});

app.get("/api/stats", (req: Request, res: Response) => {
    const all = Array.from(escrows.values());
    const totalVolume = all.reduce((sum, e) => sum + Number(e.amount), 0);
    const resolved = all.filter(e => e.status !== 'Created' && e.status !== 'ResultSubmitted' && e.status !== 'Judging');
    const success = resolved.filter(e => e.status === 'Approved').length;
    const rate = resolved.length > 0 ? (success / resolved.length) * 100 : 0;

    let totalScore = 0;
    resolved.forEach(e => { if (e.aiVerdict) totalScore += e.aiVerdict.score; });

    res.json({
        totalEscrows: all.length,
        totalVolume,
        successRate: rate,
        avgScore: resolved.length > 0 ? totalScore / resolved.length : 0,
        activePending: all.length - resolved.length
    });
});

app.post("/api/demo", async (req: Request, res: Response) => {
    const { expectedQuality = 'good', amount = 1000000 } = req.body;
    const taskDetails = `Demo task requiring ${expectedQuality} quality`;

    let escrowIdStr = "0";
    try {
        const rawId = await createEscrowOnChain(SELLER_WALLET_ADDRESS, amount.toString(), taskDetails, signer.address);
        escrowIdStr = rawId.toString();
    } catch (e) {
        console.error("Failed to create on-chain contract (demo)", e);
    }
    const id = Number(escrowIdStr) || nextEscrowId++;

    const escrowData: any = {
        id, seller_url: 'mock', task: taskDetails,
        quality_criteria: "Must be excellent", amount, status: 'Created',
        createdAt: Date.now()
    };
    escrows.set(id, escrowData);
    broadcast("escrow:created", escrowData);

    res.json({ success: true, escrowId: id, current_step: "created" });

    setTimeout(async () => {
        const resultText = await mockSellerExecute(escrowData.task, expectedQuality);
        escrowData.status = 'ResultSubmitted';
        escrowData.result = resultText;
        broadcast("escrow:result_submitted", escrowData);

        setTimeout(async () => {
            escrowData.status = 'Judging';
            broadcast("escrow:judging", escrowData);

            const verdict = await evaluateResult(escrowData.task, escrowData.quality_criteria, resultText);
            escrowData.aiVerdict = verdict;

            try {
                let realTxHash = `0xmock${Date.now()}`;
                if (verdict.verdict === 'approve') {
                    escrowData.status = 'Approved';
                    realTxHash = await resolveEscrowApprove(id, verdict.score);
                } else {
                    escrowData.status = 'Refunded';
                    realTxHash = await resolveEscrowRefund(id, verdict.score);
                }
                escrowData.txHash = realTxHash;
            } catch (e) {
                console.error("On-chain resolution failed, using mock status for UI consistency", e);
                if (verdict.verdict === 'approve') escrowData.status = 'Approved';
                else escrowData.status = 'Refunded';
                escrowData.txHash = `0xmock${Date.now()}`;
            }

            escrowData.resolvedAt = Date.now();
            broadcast("escrow:resolved", escrowData);
        }, 1500);

    }, 1000);
});

app.post("/api/proxy", async (req: Request, res: Response): Promise<any> => {
    console.log("Headers received:", req.headers);
    const targetUrl = req.headers['x-target-url'] as string;
    const amountStr = req.headers['x-escrow-amount'] as string;
    const criteria = req.headers['x-quality-criteria'] as string;

    if (!targetUrl || !amountStr) {
        return res.status(400).json({ error: "Missing X-Target-URL or X-Escrow-Amount headers" });
    }

    // Extract numerical amount from string like "1000000" or "1.00 USDC"
    let escrowAmount = 1000000;
    try {
        const parsed = parseInt(amountStr.replace(/[^0-9]/g, ''), 10);
        if (!isNaN(parsed) && parsed > 0) escrowAmount = parsed;
    } catch (e) { }

    const fee = 10000; // $0.01 USDC fee
    const totalCharge = escrowAmount + fee;

    const requirements = {
        x402Version: 2,
        error: "Payment required",
        resource: {
            url: "http://127.0.0.1:4021/api/proxy",
            description: "TrustGate Proxy Escrow Payment",
            mimeType: "application/json"
        },
        accepts: [{
            scheme: "exact",
            amount: totalCharge.toString(),
            maxAmountRequired: totalCharge.toString(),
            network: "eip155:84532",
            asset: USDC_ADDRESS || "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
            payTo: signer.address,
            maxTimeoutSeconds: 300,
            extra: {
                name: "USDC",
                version: "2"
            }
        }]
    };

    const paymentHeader = req.headers['payment-signature'] || req.headers['x-payment'] as string;
    if (!paymentHeader) {
        const reqBase64 = Buffer.from(JSON.stringify(requirements)).toString('base64');
        res.status(402)
            .header('WWW-Authenticate', `x402 ${reqBase64}`)
            .header('PAYMENT-REQUIRED', Buffer.from(JSON.stringify({ accepts: requirements.accepts })).toString('base64'))
            .header('Access-Control-Expose-Headers', 'WWW-Authenticate, PAYMENT-REQUIRED')
            .json(requirements);
        return;
    }

    try {
        const headerStr = Array.isArray(paymentHeader) ? paymentHeader[0] : paymentHeader;
        const parsedPayload = JSON.parse(Buffer.from(headerStr as string, 'base64').toString('utf-8'));
        await (x402Server as any).verifyPayment(parsedPayload, requirements.accepts[0]);
    } catch (e: any) {
        console.error("Payment Verification Failed:", e.message);
        console.error("Payment Header Used:", paymentHeader);
        console.error("Requirements Supplied:", JSON.stringify(requirements, null, 2));
        return res.status(402).json({ error: "Invalid payment", details: e.message });
    }

    // 2. Lock escrow in contract
    const sellerAddressHeader = req.headers['x-seller-address'] as string;
    const sellerAddress = sellerAddressHeader || SELLER_WALLET_ADDRESS;
    const taskDetails = req.body ? JSON.stringify(req.body) : targetUrl;

    let escrowIdStr = "0";
    try {
        console.log(`[CHAIN] Creating escrow: seller=${sellerAddress}, amount=${escrowAmount}, arbiter=${signer.address}`);
        const rawId = await createEscrowOnChain(sellerAddress, escrowAmount.toString(), taskDetails, signer.address);
        escrowIdStr = rawId.toString();
        console.log(`[CHAIN] Escrow created on-chain, ID: ${escrowIdStr}`);
    } catch (e: any) {
        console.error("[CHAIN] Failed to create on-chain escrow:", e.message || e);
    }
    const escrowId = Number(escrowIdStr);
    console.log(`[CHAIN] Using escrowId: ${escrowId}`);

    const escrowData: any = {
        id: escrowId || nextEscrowId++, seller_url: targetUrl, task: taskDetails,
        quality_criteria: criteria || "Good quality", amount: escrowAmount, status: 'Created',
        createdAt: Date.now()
    };
    escrows.set(escrowData.id, escrowData);
    broadcast("escrow:created", escrowData);

    // 3. Forward request to real service
    let resultText = "Agent provided a correct response for the requested service.";
    let fetchSuccess = true;

    if (targetUrl === 'mock' || targetUrl.includes('mock')) {
        const quality = targetUrl.split('-')[1] || 'good';
        resultText = await mockSellerExecute(taskDetails, quality as any);
    } else {
        try {
            const resp = await fetch(targetUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(req.body || {})
            });

            const rawText = await resp.text();

            // Try to pretty-print JSON if possible
            try {
                const jsonObj = JSON.parse(rawText);
                resultText = JSON.stringify(jsonObj, null, 2);
            } catch (e) {
                resultText = rawText;
            }

            if (!resp.ok) {
                fetchSuccess = false;
                resultText = `HTTP Error ${resp.status}: ${resultText}`;
            }
        } catch (e: any) {
            fetchSuccess = false;
            resultText = `Failed to connect to target URL: ${e.message}`;
        }
    }

    escrowData.status = 'ResultSubmitted';
    escrowData.result = resultText;
    broadcast("escrow:result_submitted", escrowData);

    // 4. Arbitrate with AI
    escrowData.status = 'Judging';
    broadcast("escrow:judging", escrowData);

    const verdict = await evaluateResult(taskDetails, escrowData.quality_criteria, resultText);
    escrowData.aiVerdict = verdict;

    // 5. Finalize Escrow on-chain
    console.log(`[CHAIN] Resolving escrow ${escrowId} with verdict: ${verdict.verdict}, score: ${verdict.score}`);
    try {
        let realTxHash = `0xmock${Date.now()}`;
        if (verdict.verdict === 'approve') {
            escrowData.status = 'Approved';
            console.log(`[CHAIN] Calling resolveApprove(${escrowId}, ${Math.min(verdict.score, 255)})`);
            realTxHash = await resolveEscrowApprove(escrowId, Math.min(verdict.score, 255));
            console.log(`[CHAIN] resolveApprove SUCCESS, txHash: ${realTxHash}`);
        } else {
            escrowData.status = 'Refunded';
            console.log(`[CHAIN] Calling resolveRefund(${escrowId}, ${Math.min(verdict.score, 255)})`);
            realTxHash = await resolveEscrowRefund(escrowId, Math.min(verdict.score, 255));
            console.log(`[CHAIN] resolveRefund SUCCESS, txHash: ${realTxHash}`);
        }
        escrowData.txHash = realTxHash;
    } catch (e: any) {
        console.error(`[CHAIN] Resolution FAILED for escrowId ${escrowId}:`, e.message || e);
        if (verdict.verdict === 'approve') escrowData.status = 'Approved';
        else escrowData.status = 'Refunded';
        escrowData.txHash = `0xmock${Date.now()}`;
    }

    escrowData.resolvedAt = Date.now();
    broadcast("escrow:resolved", escrowData);

    return res.json({
        success: true,
        escrowId: escrowData.id,
        arbiterVerdict: verdict,
        result: resultText,
        txHash: escrowData.txHash
    });
});

app.get("/health", (req: Request, res: Response) => res.json({ status: "ok" }));

// Serve React frontend in production
const clientDist = path.join(__dirname, "../../client/dist");
if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get('*', (req, res) => {
        if (!req.path.startsWith('/api') && !req.path.startsWith('/health')) {
            res.sendFile(path.join(clientDist, 'index.html'));
        }
    });
    console.log(`Serving frontend from ${clientDist}`);
}

const server = http.createServer(app);

// Attach WebSocket to HTTP server on /ws path (single port for production)
const wss = new WebSocketServer({ server, path: '/ws' });
setupWs(wss);

server.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`TrustGate running on port ${PORT} (HTTP + WebSocket)`);
});
