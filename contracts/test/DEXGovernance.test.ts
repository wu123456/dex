import { expect } from "chai";
import { ethers } from "hardhat";
import { DEXGovernance, MockERC20 } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("DEXGovernance", () => {
  let governance: DEXGovernance;
  let govToken: MockERC20;
  let proposer: HardhatEthersSigner;
  let voter1: HardhatEthersSigner;
  let voter2: HardhatEthersSigner;
  let voter3: HardhatEthersSigner;
  let noTokenUser: HardhatEthersSigner;

  const VOTING_PERIOD = 3600;
  const PROPOSAL_THRESHOLD = ethers.parseEther("100");

  beforeEach(async () => {
    [proposer, voter1, voter2, voter3, noTokenUser] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("MockERC20");
    govToken = await Token.deploy("Governance Token", "GOV");

    const Governance = await ethers.getContractFactory("DEXGovernance");
    governance = await Governance.deploy(govToken.target, VOTING_PERIOD, PROPOSAL_THRESHOLD);

    await govToken.mint(proposer.address, ethers.parseEther("10000"));
    await govToken.mint(voter1.address, ethers.parseEther("5000"));
    await govToken.mint(voter2.address, ethers.parseEther("3000"));
    await govToken.mint(voter3.address, ethers.parseEther("1000"));
  });

  describe("constructor", () => {
    it("should set governance token, voting period and threshold", async () => {
      expect(await governance.governanceToken()).to.equal(govToken.target);
      expect(await governance.votingPeriod()).to.equal(VOTING_PERIOD);
      expect(await governance.proposalThreshold()).to.equal(PROPOSAL_THRESHOLD);
    });
  });

  describe("createProposal", () => {
    it("should create a proposal and emit ProposalCreated", async () => {
      await expect(governance.connect(proposer).createProposal("Test Proposal", "A test description"))
        .to.emit(governance, "ProposalCreated")
        .withArgs(0, proposer.address, "Test Proposal");
    });

    it("should increment proposalCount", async () => {
      await governance.connect(proposer).createProposal("P1", "D1");
      expect(await governance.proposalCount()).to.equal(1);

      await governance.connect(proposer).createProposal("P2", "D2");
      expect(await governance.proposalCount()).to.equal(2);
    });

    it("should store proposal details correctly", async () => {
      await governance.connect(proposer).createProposal("Test", "Description");

      const proposal = await governance.getProposal(0);
      expect(proposal.proposer).to.equal(proposer.address);
      expect(proposal.title).to.equal("Test");
      expect(proposal.description).to.equal("Description");
      expect(proposal.forVotes).to.equal(0);
      expect(proposal.againstVotes).to.equal(0);
      expect(proposal.executed).to.be.false;
    });

    it("should set startTime and endTime correctly", async () => {
      const blockBefore = await ethers.provider.getBlock("latest");
      const tx = await governance.connect(proposer).createProposal("Test", "Desc");
      const receipt = await tx.getBlock();

      const proposal = await governance.getProposal(0);
      expect(proposal.startTime).to.equal(receipt!.timestamp);
      expect(proposal.endTime).to.equal(Number(receipt!.timestamp) + VOTING_PERIOD);
    });

    it("should revert if proposer balance is below threshold", async () => {
      await expect(governance.connect(noTokenUser).createProposal("Fail", "Should fail"))
        .to.be.revertedWith("DEXGovernance: BELOW_THRESHOLD");
    });
  });

  describe("vote", () => {
    beforeEach(async () => {
      await governance.connect(proposer).createProposal("Test Proposal", "Description");
    });

    it("should cast a FOR vote and emit Voted", async () => {
      await expect(governance.connect(voter1).vote(0, true))
        .to.emit(governance, "Voted")
        .withArgs(0, voter1.address, true, ethers.parseEther("5000"));
    });

    it("should cast an AGAINST vote and emit Voted", async () => {
      await expect(governance.connect(voter1).vote(0, false))
        .to.emit(governance, "Voted")
        .withArgs(0, voter1.address, false, ethers.parseEther("5000"));
    });

    it("should increase forVotes when voting FOR", async () => {
      await governance.connect(voter1).vote(0, true);

      const proposal = await governance.getProposal(0);
      expect(proposal.forVotes).to.equal(ethers.parseEther("5000"));
    });

    it("should increase againstVotes when voting AGAINST", async () => {
      await governance.connect(voter1).vote(0, false);

      const proposal = await governance.getProposal(0);
      expect(proposal.againstVotes).to.equal(ethers.parseEther("5000"));
    });

    it("should record that user has voted", async () => {
      await governance.connect(voter1).vote(0, true);
      expect(await governance.hasVoted(0, voter1.address)).to.be.true;
    });

    it("should revert if user votes twice", async () => {
      await governance.connect(voter1).vote(0, true);

      await expect(governance.connect(voter1).vote(0, false))
        .to.be.revertedWith("DEXGovernance: ALREADY_VOTED");
    });

    it("should revert if voting period has ended", async () => {
      await time.increase(VOTING_PERIOD + 1);

      await expect(governance.connect(voter1).vote(0, true))
        .to.be.revertedWith("DEXGovernance: ENDED");
    });

    it("should revert if voter has no governance tokens", async () => {
      await expect(governance.connect(noTokenUser).vote(0, true))
        .to.be.revertedWith("DEXGovernance: NO_WEIGHT");
    });

    it("should accumulate votes from multiple voters", async () => {
      await governance.connect(voter1).vote(0, true);
      await governance.connect(voter2).vote(0, true);
      await governance.connect(voter3).vote(0, false);

      const proposal = await governance.getProposal(0);
      expect(proposal.forVotes).to.equal(ethers.parseEther("8000"));
      expect(proposal.againstVotes).to.equal(ethers.parseEther("1000"));
    });
  });

  describe("executeProposal", () => {
    beforeEach(async () => {
      await governance.connect(proposer).createProposal("Test", "Desc");
    });

    it("should execute a succeeded proposal and emit ProposalExecuted", async () => {
      await governance.connect(voter1).vote(0, true);
      await time.increase(VOTING_PERIOD + 1);

      await expect(governance.executeProposal(0))
        .to.emit(governance, "ProposalExecuted")
        .withArgs(0);
    });

    it("should mark proposal as executed", async () => {
      await governance.connect(voter1).vote(0, true);
      await time.increase(VOTING_PERIOD + 1);

      await governance.executeProposal(0);

      const proposal = await governance.getProposal(0);
      expect(proposal.executed).to.be.true;
    });

    it("should revert if voting period has not ended", async () => {
      await governance.connect(voter1).vote(0, true);

      await expect(governance.executeProposal(0))
        .to.be.revertedWith("DEXGovernance: NOT_ENDED");
    });

    it("should revert if proposal is already executed", async () => {
      await governance.connect(voter1).vote(0, true);
      await time.increase(VOTING_PERIOD + 1);

      await governance.executeProposal(0);

      await expect(governance.executeProposal(0))
        .to.be.revertedWith("DEXGovernance: ALREADY_EXECUTED");
    });

    it("should revert if proposal was defeated", async () => {
      await governance.connect(voter1).vote(0, false);
      await time.increase(VOTING_PERIOD + 1);

      await expect(governance.executeProposal(0))
        .to.be.revertedWith("DEXGovernance: PROPOSAL_REJECTED");
    });
  });

  describe("getProposalState", () => {
    it("should return 'active' during voting period", async () => {
      await governance.connect(proposer).createProposal("Test", "Desc");

      expect(await governance.getProposalState(0)).to.equal("active");
    });

    it("should return 'succeeded' if forVotes > againstVotes after voting ends", async () => {
      await governance.connect(proposer).createProposal("Test", "Desc");
      await governance.connect(voter1).vote(0, true);
      await time.increase(VOTING_PERIOD + 1);

      expect(await governance.getProposalState(0)).to.equal("succeeded");
    });

    it("should return 'defeated' if againstVotes >= forVotes after voting ends", async () => {
      await governance.connect(proposer).createProposal("Test", "Desc");
      await governance.connect(voter1).vote(0, false);
      await time.increase(VOTING_PERIOD + 1);

      expect(await governance.getProposalState(0)).to.equal("defeated");
    });

    it("should return 'executed' after proposal is executed", async () => {
      await governance.connect(proposer).createProposal("Test", "Desc");
      await governance.connect(voter1).vote(0, true);
      await time.increase(VOTING_PERIOD + 1);

      await governance.executeProposal(0);

      expect(await governance.getProposalState(0)).to.equal("executed");
    });
  });

  describe("full governance lifecycle", () => {
    it("should complete create → vote → execute lifecycle", async () => {
      await governance.connect(proposer).createProposal("Add new trading pair", "Enable USDC/USDT pair");

      const proposal = await governance.getProposal(0);
      expect(proposal.proposer).to.equal(proposer.address);

      await governance.connect(voter1).vote(0, true);
      await governance.connect(voter2).vote(0, true);
      await governance.connect(voter3).vote(0, false);

      const votedProposal = await governance.getProposal(0);
      expect(votedProposal.forVotes).to.equal(ethers.parseEther("8000"));
      expect(votedProposal.againstVotes).to.equal(ethers.parseEther("1000"));

      await time.increase(VOTING_PERIOD + 1);

      expect(await governance.getProposalState(0)).to.equal("succeeded");

      await governance.executeProposal(0);

      const executedProposal = await governance.getProposal(0);
      expect(executedProposal.executed).to.be.true;
      expect(await governance.getProposalState(0)).to.equal("executed");
    });
  });
});
