// SPDX‑License‑Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./PointsToken.sol";

/**
 * @title PaymentWithPoints
 * @dev Users pay restaurants in TEA and automatically earn 1 point per TEA.
 *      ‑ The contract must be authorised to mint PointsToken (set as
 *        `purchaseTracker` when you deploy PointsToken, or give it MINTER role
 *        in a V2 of PointsToken).
 *      ‑ Users must first approve() this contract to spend their TEA.
 */
contract PaymentWithPoints is Ownable {
    IERC20     public immutable tea;
    PointsToken public immutable points;

    event Paid(
        address indexed payer,
        address indexed restaurant,
        uint256 teaAmount,
        uint256 pointsMinted
    );

    constructor(IERC20 _tea, PointsToken _points) {
        tea    = _tea;
        points = _points;
    }

    /**
     * @notice Pay a restaurant and earn points.
     * @param restaurant  Wallet address of the café / bar / shop
     * @param amount      Amount of TEA (18‑decimals) to pay
     */
    function payAndEarn(address restaurant, uint256 amount) external {
        require(restaurant != address(0), "Invalid restaurant");

        // Pull TEA from user (requires prior allowance)
        require(
            tea.transferFrom(msg.sender, restaurant, amount),
            "TEA transfer failed"
        );

        // Mint equal amount of points to payer
        points.mint(msg.sender, amount);

        emit Paid(msg.sender, restaurant, amount, amount);
    }

    /* ----------------‑ Admin helpers (optional) ‑---------------- */

    /// @dev Emergency rescue of tokens sent by accident
    function sweep(address token, uint256 amt, address to) external onlyOwner {
        IERC20(token).transfer(to, amt);
    }
}

