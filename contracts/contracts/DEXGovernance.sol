// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract DEXGovernance is ReentrancyGuard {
    struct Proposal {
        address proposer;
        string title;
        string description;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 startTime;
        uint256 endTime;
        bool executed;
    }

    IERC20 public governanceToken;
    uint256 public proposalCount;
    uint256 public votingPeriod;
    uint256 public proposalThreshold;

    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    event ProposalCreated(uint256 indexed proposalId, address indexed proposer, string title);
    event Voted(uint256 indexed proposalId, address indexed voter, bool support, uint256 weight);
    event ProposalExecuted(uint256 indexed proposalId);

    constructor(
        address _governanceToken,
        uint256 _votingPeriod,
        uint256 _proposalThreshold
    ) {
        governanceToken = IERC20(_governanceToken);
        votingPeriod = _votingPeriod;
        proposalThreshold = _proposalThreshold;
    }

    function createProposal(
        string calldata title,
        string calldata description
    ) external returns (uint256 proposalId) {
        require(
            governanceToken.balanceOf(msg.sender) >= proposalThreshold,
            "DEXGovernance: BELOW_THRESHOLD"
        );

        proposalId = proposalCount++;
        proposals[proposalId] = Proposal({
            proposer: msg.sender,
            title: title,
            description: description,
            forVotes: 0,
            againstVotes: 0,
            startTime: block.timestamp,
            endTime: block.timestamp + votingPeriod,
            executed: false
        });

        emit ProposalCreated(proposalId, msg.sender, title);
    }

    function vote(uint256 proposalId, bool support) external nonReentrant {
        Proposal storage proposal = proposals[proposalId];
        require(block.timestamp >= proposal.startTime, "DEXGovernance: NOT_STARTED");
        require(block.timestamp <= proposal.endTime, "DEXGovernance: ENDED");
        require(!hasVoted[proposalId][msg.sender], "DEXGovernance: ALREADY_VOTED");

        uint256 weight = governanceToken.balanceOf(msg.sender);
        require(weight > 0, "DEXGovernance: NO_WEIGHT");

        hasVoted[proposalId][msg.sender] = true;

        if (support) {
            proposal.forVotes += weight;
        } else {
            proposal.againstVotes += weight;
        }

        emit Voted(proposalId, msg.sender, support, weight);
    }

    function executeProposal(uint256 proposalId) external nonReentrant {
        Proposal storage proposal = proposals[proposalId];
        require(block.timestamp > proposal.endTime, "DEXGovernance: NOT_ENDED");
        require(!proposal.executed, "DEXGovernance: ALREADY_EXECUTED");
        require(proposal.forVotes > proposal.againstVotes, "DEXGovernance: PROPOSAL_REJECTED");

        proposal.executed = true;

        emit ProposalExecuted(proposalId);
    }

    function getProposal(uint256 proposalId) external view returns (Proposal memory) {
        return proposals[proposalId];
    }

    function getProposalState(uint256 proposalId) external view returns (string memory) {
        Proposal memory proposal = proposals[proposalId];
        if (proposal.executed) return "executed";
        if (block.timestamp < proposal.startTime) return "pending";
        if (block.timestamp <= proposal.endTime) return "active";
        if (proposal.forVotes > proposal.againstVotes) return "succeeded";
        return "defeated";
    }
}
