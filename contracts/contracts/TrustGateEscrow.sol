// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract TrustGateEscrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public usdcToken;

    enum EscrowStatus {
        Created,
        ResultSubmitted,
        Approved,
        Refunded,
        Partial
    }

    struct Escrow {
        address buyer;
        address seller;
        address arbiter;
        uint256 amount;
        bytes32 taskHash;
        bytes32 resultHash;
        EscrowStatus status;
        uint256 createdAt;
        uint256 resolvedAt;
        uint8 score;
    }

    uint256 public escrowCount;
    mapping(uint256 => Escrow) public escrows;

    event EscrowCreated(uint256 indexed escrowId, address indexed buyer, address indexed seller, uint256 amount);
    event ResultSubmitted(uint256 indexed escrowId, bytes32 resultHash);
    event EscrowApproved(uint256 indexed escrowId, uint8 score);
    event EscrowRefunded(uint256 indexed escrowId, uint8 score);
    event EscrowPartial(uint256 indexed escrowId, uint8 score, uint256 percentToSeller);

    constructor(address _usdcToken) {
        require(_usdcToken != address(0), "Invalid token address");
        usdcToken = IERC20(_usdcToken);
    }

    function createEscrow(
        address seller,
        address arbiter,
        uint256 amount,
        bytes32 taskHash
    ) external nonReentrant returns (uint256 escrowId) {
        require(seller != address(0), "Invalid seller");
        require(arbiter != address(0), "Invalid arbiter");
        require(amount > 0, "Amount must be > 0");

        // Transfer USDC from buyer to this contract
        usdcToken.safeTransferFrom(msg.sender, address(this), amount);

        escrowId = ++escrowCount;
        escrows[escrowId] = Escrow({
            buyer: msg.sender,
            seller: seller,
            arbiter: arbiter,
            amount: amount,
            taskHash: taskHash,
            resultHash: bytes32(0),
            status: EscrowStatus.Created,
            createdAt: block.timestamp,
            resolvedAt: 0,
            score: 0
        });

        emit EscrowCreated(escrowId, msg.sender, seller, amount);
    }

    function submitResult(uint256 escrowId, bytes32 resultHash) external {
        Escrow storage escrow = escrows[escrowId];
        require(escrow.createdAt != 0, "Escrow does not exist");
        require(msg.sender == escrow.seller, "Only seller can submit");
        require(escrow.status == EscrowStatus.Created, "Invalid status");

        escrow.resultHash = resultHash;
        escrow.status = EscrowStatus.ResultSubmitted;

        emit ResultSubmitted(escrowId, resultHash);
    }

    function resolveApprove(uint256 escrowId, uint8 score) external nonReentrant {
        Escrow storage escrow = escrows[escrowId];
        require(escrow.createdAt != 0, "Escrow does not exist");
        require(msg.sender == escrow.arbiter, "Only arbiter can resolve");
        require(escrow.status == EscrowStatus.ResultSubmitted || escrow.status == EscrowStatus.Created, "Invalid status");

        escrow.status = EscrowStatus.Approved;
        escrow.score = score;
        escrow.resolvedAt = block.timestamp;

        // Transfer full amount to seller
        usdcToken.safeTransfer(escrow.seller, escrow.amount);

        emit EscrowApproved(escrowId, score);
    }

    function resolveRefund(uint256 escrowId, uint8 score) external nonReentrant {
        Escrow storage escrow = escrows[escrowId];
        require(escrow.createdAt != 0, "Escrow does not exist");
        require(msg.sender == escrow.arbiter, "Only arbiter can resolve");
        require(escrow.status == EscrowStatus.ResultSubmitted || escrow.status == EscrowStatus.Created, "Invalid status");

        escrow.status = EscrowStatus.Refunded;
        escrow.score = score;
        escrow.resolvedAt = block.timestamp;

        // Transfer full amount to buyer
        usdcToken.safeTransfer(escrow.buyer, escrow.amount);

        emit EscrowRefunded(escrowId, score);
    }

    function resolvePartial(uint256 escrowId, uint8 percentToSeller, uint8 score) external nonReentrant {
        require(percentToSeller > 0 && percentToSeller < 100, "Invalid percentage");
        Escrow storage escrow = escrows[escrowId];
        require(escrow.createdAt != 0, "Escrow does not exist");
        require(msg.sender == escrow.arbiter, "Only arbiter can resolve");
        require(escrow.status == EscrowStatus.ResultSubmitted || escrow.status == EscrowStatus.Created, "Invalid status");

        escrow.status = EscrowStatus.Partial;
        escrow.score = score;
        escrow.resolvedAt = block.timestamp;

        uint256 sellerAmount = (escrow.amount * percentToSeller) / 100;
        uint256 buyerAmount = escrow.amount - sellerAmount;

        // Transfer split amounts
        usdcToken.safeTransfer(escrow.seller, sellerAmount);
        usdcToken.safeTransfer(escrow.buyer, buyerAmount);

        emit EscrowPartial(escrowId, score, percentToSeller);
    }

    function getEscrow(uint256 escrowId) external view returns (Escrow memory) {
        return escrows[escrowId];
    }
}
