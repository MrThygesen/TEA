// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./TokenVesting.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract TokenAllocation is Ownable {
    TokenVesting public vesting;
    IERC20 public immutable token;

    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 ether;

    // Allocation breakdown
    address public founder;
    address public team;
    address public treasury;
    address public grantsAndCommunity;
    address public strategicPartners;
    address public investors;
    address public advisors;
    address public communityDAO;

    bool public allocationsSet;

    constructor(address initialOwner, address vestingContract) {
        require(initialOwner != address(0), "Invalid owner");
        require(vestingContract != address(0), "Invalid vesting contract");

        _transferOwnership(initialOwner);
        vesting = TokenVesting(vestingContract);
        token = vesting.token(); // Assumes vesting.token() returns IERC20
    }

    function setAllocations(
        address _founder,
        address _treasury,
        address _grantsAndCommunity,
        address _strategicPartners,
        address _investors,
        address _advisors,
        address _team,
        address _communityDAO
    ) external onlyOwner {
        require(!allocationsSet, "Allocations already set");

        // Validate input
        require(_founder != address(0), "Invalid founder");
        require(_treasury != address(0), "Invalid treasury");
        require(_grantsAndCommunity != address(0), "Invalid grants");
        require(_strategicPartners != address(0), "Invalid partners");
        require(_investors != address(0), "Invalid investors");
        require(_advisors != address(0), "Invalid advisors");
        require(_team != address(0), "Invalid team");
        require(_communityDAO != address(0), "Invalid DAO");

        // Store addresses
        founder = _founder;
        treasury = _treasury;
        grantsAndCommunity = _grantsAndCommunity;
        strategicPartners = _strategicPartners;
        investors = _investors;
        advisors = _advisors;
        team = _team;
        communityDAO = _communityDAO;

        allocationsSet = true;

        uint256 oneYear = 365 days;
        uint256 twoYears = 2 * oneYear;
        uint256 fourYears = 4 * oneYear;
        uint256 start = block.timestamp + 1 days; // Optional: delay vesting by 1 day

        // Vesting allocations
        vesting.setVestingWithCustomStart(_founder, 150_000_000 ether, fourYears, start);
        vesting.setVestingWithCustomStart(_team, 100_000_000 ether, fourYears, start);
        vesting.setVestingWithCustomStart(_advisors, 50_000_000 ether, oneYear, start);
        vesting.setVestingWithCustomStart(_investors, 150_000_000 ether, oneYear, start);
        vesting.setVestingWithCustomStart(_strategicPartners, 100_000_000 ether, twoYears, start);

        // Immediate transfers
        require(token.transfer(_treasury, 250_000_000 ether), "Treasury transfer failed");
        require(token.transfer(_grantsAndCommunity, 100_000_000 ether), "Grants transfer failed");
        require(token.transfer(_communityDAO, 100_000_000 ether), "DAO transfer failed");
    }
}

