// SPDX‑License‑Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./PointsToken.sol";

/**
 * @title PurchaseTracker
 * @dev Mints points 1:1 with `amountSpent` (18 decimals) to the caller.
 *      In production you might restrict `recordPurchase` to partner PoS
 *      devices; for the demo it's open to any user.
 */
contract PurchaseTracker is Ownable {
    PointsToken public immutable points;

    event PointsEarned(address indexed user, uint256 amount);

    constructor(PointsToken _points) {
        points = _points;
    }

    /**
     * @notice Record a purchase and mint points to `msg.sender`.
     * @param amountSpent Purchase amount in 18‑decimals (e.g. parseEther("25")).
     */
    function recordPurchase(uint256 amountSpent) external {
        // Mint points equal to amount spent
        points.mint(msg.sender, amountSpent);
        emit PointsEarned(msg.sender, amountSpent);
    }
} 
