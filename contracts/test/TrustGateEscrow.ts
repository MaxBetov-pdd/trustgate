import { expect } from "chai";
import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("TrustGateEscrow", function () {
    async function deployEscrowFixture() {
        const [buyer, seller, arbiter, otherAccount] = await hre.ethers.getSigners();

        // Deploy a mock ERC20 for USDC
        const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
        const mockUsdc = await MockUSDC.deploy();

        const TrustGateEscrow = await hre.ethers.getContractFactory("TrustGateEscrow");
        const escrow = await TrustGateEscrow.deploy(await mockUsdc.getAddress());

        // Mint USDC to buyer
        const amount = hre.ethers.parseUnits("100", 6);
        await mockUsdc.mint(buyer.address, amount);
        await mockUsdc.connect(buyer).approve(await escrow.getAddress(), amount);

        return { escrow, mockUsdc, buyer, seller, arbiter, otherAccount, amount };
    }

    describe("Deployment", function () {
        it("Should set the right USDC token", async function () {
            const { escrow, mockUsdc } = await loadFixture(deployEscrowFixture);
            expect(await escrow.usdcToken()).to.equal(await mockUsdc.getAddress());
        });
    });

    describe("Escrow Flow", function () {
        it("Should create an escrow and transfer USDC to contract", async function () {
            const { escrow, mockUsdc, buyer, seller, arbiter, amount } = await loadFixture(deployEscrowFixture);
            const contractAddr = await escrow.getAddress();

            const taskHash = hre.ethers.id("task details");

            await expect(escrow.createEscrow(seller.address, arbiter.address, amount, taskHash))
                .to.emit(escrow, "EscrowCreated")
                .withArgs(1, buyer.address, seller.address, amount);

            expect(await mockUsdc.balanceOf(contractAddr)).to.equal(amount);
            const e = await escrow.getEscrow(1);
            expect(e.amount).to.equal(amount);
            expect(e.status).to.equal(0); // Created
        });

        it("Should submit a result (only seller)", async function () {
            const { escrow, seller, arbiter, amount, otherAccount } = await loadFixture(deployEscrowFixture);
            const taskHash = hre.ethers.id("task details");
            await escrow.createEscrow(seller.address, arbiter.address, amount, taskHash);

            const resultHash = hre.ethers.id("result info");

            // Other account shouldn't be able to submit
            await expect(escrow.connect(otherAccount).submitResult(1, resultHash))
                .to.be.revertedWith("Only seller can submit");

            await expect(escrow.connect(seller).submitResult(1, resultHash))
                .to.emit(escrow, "ResultSubmitted")
                .withArgs(1, resultHash);

            const e = await escrow.getEscrow(1);
            expect(e.status).to.equal(1); // ResultSubmitted
        });

        it("Should resolve with full approval", async function () {
            const { escrow, mockUsdc, buyer, seller, arbiter, amount } = await loadFixture(deployEscrowFixture);
            const taskHash = hre.ethers.id("task details");
            await escrow.createEscrow(seller.address, arbiter.address, amount, taskHash);

            const resultHash = hre.ethers.id("result info");
            await escrow.connect(seller).submitResult(1, resultHash);

            await expect(escrow.connect(arbiter).resolveApprove(1, 95))
                .to.emit(escrow, "EscrowApproved")
                .withArgs(1, 95);

            expect(await mockUsdc.balanceOf(seller.address)).to.equal(amount);

            const e = await escrow.getEscrow(1);
            expect(e.status).to.equal(2); // Approved
            expect(e.score).to.equal(95);
        });

        it("Should resolve with refund", async function () {
            const { escrow, mockUsdc, buyer, seller, arbiter, amount } = await loadFixture(deployEscrowFixture);
            const taskHash = hre.ethers.id("task details");
            await escrow.createEscrow(seller.address, arbiter.address, amount, taskHash);

            await expect(escrow.connect(arbiter).resolveRefund(1, 10))
                .to.emit(escrow, "EscrowRefunded")
                .withArgs(1, 10);

            // Sent back to buyer
            expect(await mockUsdc.balanceOf(buyer.address)).to.equal(amount);
            const e = await escrow.getEscrow(1);
            expect(e.status).to.equal(3); // Refunded
        });

        it("Should resolve with partial split", async function () {
            const { escrow, mockUsdc, buyer, seller, arbiter, amount } = await loadFixture(deployEscrowFixture);
            const taskHash = hre.ethers.id("task details");
            await escrow.createEscrow(seller.address, arbiter.address, amount, taskHash);

            await escrow.connect(arbiter).resolvePartial(1, 40, 50);

            const sellerBal = await mockUsdc.balanceOf(seller.address);
            const buyerBal = await mockUsdc.balanceOf(buyer.address);

            // 40% to seller, 60% to buyer
            expect(sellerBal).to.equal((amount * 40n) / 100n);
            expect(buyerBal).to.equal((amount * 60n) / 100n);

            const e = await escrow.getEscrow(1);
            expect(e.status).to.equal(4); // Partial
        });
    });
});
