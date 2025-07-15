// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TEAToken is ERC20Votes, ERC20Pausable, ERC20Capped, Ownable {
    constructor(uint256 cap) 
        ERC20("TEAToken", "TEA")
        ERC20Permit("TEAToken")
        ERC20Capped(cap)
    {}

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // Add a revert check here for zero address delegation
    function delegate(address delegatee) public override {
        require(delegatee != address(0), "ERC20Votes: cannot delegate to zero address");
        super.delegate(delegatee);
    }

    // Override _mint to include cap and votes logic
    function _mint(address to, uint256 amount) internal override(ERC20, ERC20Capped, ERC20Votes) {
        super._mint(to, amount);
    }

    // Override _burn to include votes logic
    function _burn(address account, uint256 amount) internal override(ERC20, ERC20Votes) {
        super._burn(account, amount);
    }

    // _beforeTokenTransfer includes pause logic, override with ERC20 and ERC20Pausable
    function _beforeTokenTransfer(address from, address to, uint256 amount) internal override(ERC20, ERC20Pausable) {
        super._beforeTokenTransfer(from, to, amount);
    }

    // _afterTokenTransfer includes votes logic, override with ERC20 and ERC20Votes only
    function _afterTokenTransfer(address from, address to, uint256 amount) internal override(ERC20, ERC20Votes) {
        super._afterTokenTransfer(from, to, amount);
    }
}

