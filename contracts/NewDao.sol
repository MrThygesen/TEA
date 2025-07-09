// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract SimpleDAO is ReentrancyGuard {
    struct Proposal {
        address payable recipient;
        uint256 amount;
        string description;
        uint256 yesVotes;
        uint256 noVotes;
        uint256 deadline;
        bool executed;
        mapping(address => bool) voted;
    }

    mapping(uint256 => Proposal) public proposals;
    uint256 public proposalCount;

    mapping(address => bool) public members;
    uint256 public votingPeriod = 3 days;
    uint256 public quorum; // e.g. 2 means 2 votes required

    event ProposalCreated(uint256 indexed proposalId, address recipient, uint256 amount, string description);
    event Voted(uint256 indexed proposalId, address voter, bool support);
    event Executed(uint256 indexed proposalId);

    modifier onlyMember() {
        require(members[msg.sender], "Not a DAO member");
        _;
    }

    constructor(address[] memory initialMembers, uint256 _quorum) payable {
        for (uint i = 0; i < initialMembers.length; i++) {
            members[initialMembers[i]] = true;
        }
        quorum = _quorum;
    }

    function propose(address payable _recipient, uint256 _amount, string memory _desc)
        external
        onlyMember
        returns (uint256)
    {
        proposalCount++;
        Proposal storage p = proposals[proposalCount];
        p.recipient = _recipient;
        p.amount = _amount;
        p.description = _desc;
        p.deadline = block.timestamp + votingPeriod;

        emit ProposalCreated(proposalCount, _recipient, _amount, _desc);
        return proposalCount;
    }

    function vote(uint256 proposalId, bool support) external onlyMember {
        Proposal storage p = proposals[proposalId];
        require(block.timestamp < p.deadline, "Voting ended");
        require(!p.voted[msg.sender], "Already voted");

        p.voted[msg.sender] = true;
        if (support) {
            p.yesVotes++;
        } else {
            p.noVotes++;
        }

        emit Voted(proposalId, msg.sender, support);
    }



    function execute(uint256 proposalId) external onlyMember {
        Proposal storage p = proposals[proposalId];
        require(block.timestamp >= p.deadline, "Voting still ongoing");
        require(!p.executed, "Already executed");
        require(p.yesVotes >= quorum, "Quorum not reached");
        require(p.yesVotes > p.noVotes, "Proposal not approved");
        require(address(this).balance >= p.amount, "Insufficient funds");

        p.executed = true;
        p.recipient.transfer(p.amount);

        emit Executed(proposalId);
    }

    // Allow contract to receive ETH
    receive() external payable {}
}

