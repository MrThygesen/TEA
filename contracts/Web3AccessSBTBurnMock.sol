// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./WebAccessSBTUpgrade.sol";

contract Web3AccessSBTBurnMock is WebAccessSBTV2 {
    // Override to always disallow burning
    function _isBurnable(uint256) internal pure override returns (bool) {
        return false;
    }
}

