// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract TEAFundraising is Ownable, ReentrancyGuard {
    IERC20 public immutable token;        // TEAToken
    IERC20 public immutable paymentToken; // USDC or USDT

    struct Round {
        uint256 pricePerToken; // 18-dec fixed-point
        uint256 hardCap;       // total tokens that can be sold
        uint256 tokensSold;    // tokens sold so far
        bool    isActive;
    }

    mapping(uint256 => Round) public rounds;
    uint256 public currentRound;

    mapping(address => bool) public whitelist;

    event TokensPurchased(address indexed buyer,
                          uint256 amount,
                          uint256 cost,
                          uint256 round);
    event RoundStarted(uint256 roundId,
                       uint256 pricePerToken,
                       uint256 hardCap);
    event RoundClosed(uint256 roundId);
    event Whitelisted(address indexed account, bool status);

    constructor(
        address initialOwner,
        address tokenAddress,
        address paymentTokenAddress
    ) {
        token        = IERC20(tokenAddress);
        paymentToken = IERC20(paymentTokenAddress);
        _transferOwnership(initialOwner);
    }

    /* ─────────── round management ─────────── */

    function startRound(uint256 pricePerToken,
                        uint256 hardCap)
        external
        onlyOwner
    {
        currentRound++;
        rounds[currentRound] = Round({
            pricePerToken: pricePerToken,
            hardCap:       hardCap,
            tokensSold:    0,
            isActive:      true
        });
        emit RoundStarted(currentRound, pricePerToken, hardCap);
    }

    function closeRound(uint256 roundId) external onlyOwner {
        require(rounds[roundId].isActive, "ROUND_NOT_ACTIVE");
        rounds[roundId].isActive = false;
        emit RoundClosed(roundId);
    }

    /* ─────────── whitelist ─────────── */

    function setWhitelist(address[] calldata accounts, bool status)
        external
        onlyOwner
    {
        for (uint256 i; i < accounts.length; ++i) {
            whitelist[accounts[i]] = status;
            emit Whitelisted(accounts[i], status);
        }
    }

    /* ─────────── token purchase ─────────── */

    /**
     * @notice Buy `tokenAmount` TEA tokens with paymentToken.
     * @dev    Uses ReentrancyGuard + Checks-Effects-Interactions.
     */
    function buyTokens(uint256 tokenAmount)
        external
        nonReentrant
    {
        Round storage round = rounds[currentRound];

        require(round.isActive,      "ROUND_NOT_ACTIVE");
        require(whitelist[msg.sender], "NOT_WHITELISTED");
        require(
            round.tokensSold + tokenAmount <= round.hardCap,
            "HARD_CAP_REACHED"
        );

        uint256 cost = (tokenAmount * round.pricePerToken) / 1e18;

        /* -------- effects (state changes) first -------- */
        round.tokensSold += tokenAmount;

        /* -------- interactions (external calls) -------- */
        // 1. pull stablecoin/USDC-like payment
        require(
            paymentToken.transferFrom(msg.sender, owner(), cost),
            "PAYMENT_FAILED"
        );

        // 2. send purchased TEA tokens
        require(
            token.transfer(msg.sender, tokenAmount),
            "TOKEN_TRANSFER_FAILED"
        );

        emit TokensPurchased(msg.sender, tokenAmount, cost, currentRound);
    }
}

