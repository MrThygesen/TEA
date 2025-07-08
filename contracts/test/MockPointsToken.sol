// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockPointsToken
 * @dev Test-only version of PointsToken with mutable purchaseTracker.
 */
contract MockPointsToken is ERC20 {
    error NonTransferable();
    error NotPurchaseTracker();

    address public purchaseTracker;

    constructor() ERC20("TEA Loyalty Points", "TEAP") {}

    function setPurchaseTracker(address _tracker) external {
        require(_tracker != address(0), "Zero address");
        purchaseTracker = _tracker;
    }

    function mint(address to, uint256 amount) external {
        if (msg.sender != purchaseTracker) revert NotPurchaseTracker();
        _mint(to, amount);
    }

    function transfer(address, uint256) public pure override returns (bool) {
        revert NonTransferable();
    }

    function transferFrom(address, address, uint256) public pure override returns (bool) {
        revert NonTransferable();
    }

    function approve(address, uint256) public pure override returns (bool) {
        revert NonTransferable();
    }

    function _beforeTokenTransfer(address from, address to, uint256 amount)
        internal
        override
    {
        if (from != address(0) && to != address(0)) revert NonTransferable();
        super._beforeTokenTransfer(from, to, amount);
    }
}

