// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TokenVesting is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;

    struct VestingSchedule {
        uint256 totalAmount;
        uint256 vestingDuration;
        uint256 startTime;
        uint256 amountClaimed;
        address claimRecipient;
    }

    mapping(address => VestingSchedule) public vestings;
    address[] public beneficiaries;
    mapping(address => bool) private isTracked;

    event VestingSet(address indexed beneficiary, uint256 totalAmount, uint256 vestingDuration, uint256 startTime);
    event ClaimRedirected(address indexed beneficiary, address indexed newRecipient);
    event TokensClaimed(address indexed beneficiary, address indexed recipient, uint256 amount);
    event OwnershipChanged(address indexed previousOwner, address indexed newOwner);

    modifier onlyBeneficiary() {
        require(vestings[msg.sender].totalAmount > 0, "No vesting schedule");
        _;
    }

    constructor(address _token, address _initialOwner) {
        require(_token != address(0), "Invalid token address");
        require(_initialOwner != address(0), "Invalid owner address");

        token = IERC20(_token);
        _transferOwnership(_initialOwner);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function setVesting(address beneficiary, uint256 totalAmount, uint256 vestingDuration) external onlyOwner {
        _setVesting(beneficiary, totalAmount, vestingDuration, block.timestamp);
    }

    function setVestingWithCustomStart(
        address beneficiary,
        uint256 totalAmount,
        uint256 vestingDuration,
        uint256 startTime
    ) external onlyOwner {
        require(startTime >= block.timestamp, "Start time must be >= now");
        _setVesting(beneficiary, totalAmount, vestingDuration, startTime);
    }

    function _setVesting(
        address beneficiary,
        uint256 totalAmount,
        uint256 vestingDuration,
        uint256 startTime
    ) internal {
        require(beneficiary != address(0), "Zero address");
        require(totalAmount > 0, "Amount zero");
        require(vestingDuration > 0, "Duration zero");
        require(vestings[beneficiary].totalAmount == 0, "Vesting already set");

        vestings[beneficiary] = VestingSchedule({
            totalAmount: totalAmount,
            vestingDuration: vestingDuration,
            startTime: startTime,
            amountClaimed: 0,
            claimRecipient: beneficiary
        });

        if (!isTracked[beneficiary]) {
            beneficiaries.push(beneficiary);
            isTracked[beneficiary] = true;
        }

        emit VestingSet(beneficiary, totalAmount, vestingDuration, startTime);
    }

 function vestedAmount(address beneficiary) public view returns (uint256) {
    VestingSchedule storage schedule = vestings[beneficiary];
    if (block.timestamp < schedule.startTime) return 0;

    uint256 elapsed = block.timestamp - schedule.startTime;
    if (elapsed >= schedule.vestingDuration) return schedule.totalAmount;

    return (schedule.totalAmount * elapsed) / schedule.vestingDuration;
}


    function claim() external onlyBeneficiary whenNotPaused {
        VestingSchedule storage schedule = vestings[msg.sender];
        uint256 vested = vestedAmount(msg.sender);
        uint256 claimable = vested - schedule.amountClaimed;

        require(claimable > 0, "Nothing to claim");
        schedule.amountClaimed += claimable;

        token.safeTransfer(schedule.claimRecipient, claimable);

        emit TokensClaimed(msg.sender, schedule.claimRecipient, claimable);
    }

    function redirectClaims(address newRecipient) external onlyBeneficiary {
        require(newRecipient != address(0), "Invalid recipient");
        vestings[msg.sender].claimRecipient = newRecipient;
        emit ClaimRedirected(msg.sender, newRecipient);
    }

    function getClaimRecipient(address beneficiary) external view returns (address) {
        return vestings[beneficiary].claimRecipient;
    }

    function totalTokensRequired() external view returns (uint256 totalRequired) {
        for (uint256 i = 0; i < beneficiaries.length; i++) {
            totalRequired += vestings[beneficiaries[i]].totalAmount;
        }




    }

    function getBeneficiaries() external view returns (address[] memory) {
        return beneficiaries;
    }

    function changeOwner(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address not allowed");
        emit OwnershipChanged(owner(), newOwner);
        transferOwnership(newOwner);
    }
}

