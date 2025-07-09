// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title PointsToken
 * @dev Non-transferable ERC-20 used for loyalty points.
 *      Only the PurchaseTracker contract may mint.
 */
contract PointsToken is ERC20 {
    error NonTransferable();
    error NotPurchaseTracker();

    address public immutable purchaseTracker;

    constructor(address _purchaseTracker)
        ERC20("TEA Loyalty Points", "TEAP")
    {
        require(_purchaseTracker != address(0), "Zero purchaseTracker");
        purchaseTracker = _purchaseTracker;
    }

    /* ---------------------- Minting ---------------------- */
    function mint(address to, uint256 amount) external {
        if (msg.sender != purchaseTracker) revert NotPurchaseTracker();
        _mint(to, amount);
    }

    /* ------------------ Block transfers ------------------ */
    function transfer(address, uint256) public pure override returns (bool) {
        revert NonTransferable();
    }

    function transferFrom(address, address, uint256) public pure override returns (bool) {
        revert NonTransferable();
    }

    function approve(address, uint256) public pure override returns (bool) {
        revert NonTransferable();
    }

    /* --- Optional: enforce non-transferability at low level --- */
    function _beforeTokenTransfer(address from, address to, uint256 amount)
        internal
        override
    {
        // Allow minting and burning
        if (from != address(0) && to != address(0)) revert NonTransferable();
        super._beforeTokenTransfer(from, to, amount);
    }
}

