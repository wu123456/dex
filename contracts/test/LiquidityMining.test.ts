import { expect } from "chai";
import { ethers } from "hardhat";
import { LiquidityMining, MockERC20, DEXFactory, DEXRouter, MockWETH, DEXPair } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("LiquidityMining", () => {
  let mining: LiquidityMining;
  let rewardToken: MockERC20;
  let tokenA: MockERC20;
  let tokenB: MockERC20;
  let lpToken: MockERC20;
  let factory: DEXFactory;
  let router: DEXRouter;
  let weth: MockWETH;
  let owner: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;

  const REWARD_PER_BLOCK = ethers.parseEther("10");
  const DEADLINE = Math.floor(Date.now() / 1000) + 36000;

  beforeEach(async () => {
    [owner, user1, user2] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("MockERC20");
    rewardToken = await Token.deploy("Reward Token", "RWD");
    tokenA = await Token.deploy("Token A", "TKA");
    tokenB = await Token.deploy("Token B", "TKB");
    lpToken = await Token.deploy("LP Token", "LP");

    const Factory = await ethers.getContractFactory("DEXFactory");
    factory = await Factory.deploy();

    const WETH = await ethers.getContractFactory("MockWETH");
    weth = await WETH.deploy();

    const Router = await ethers.getContractFactory("DEXRouter");
    router = await Router.deploy(factory.target, weth.target);

    const block = await ethers.provider.getBlock("latest");
    const startBlock = block!.number + 1;

    const Mining = await ethers.getContractFactory("LiquidityMining");
    mining = await Mining.deploy(rewardToken.target, REWARD_PER_BLOCK, startBlock);

    await rewardToken.mint(mining.target, ethers.parseEther("1000000"));
    await rewardToken.mint(owner.address, ethers.parseEther("100000"));

    await lpToken.mint(owner.address, ethers.parseEther("100000"));
    await lpToken.mint(user1.address, ethers.parseEther("100000"));
    await lpToken.mint(user2.address, ethers.parseEther("100000"));
  });

  describe("constructor", () => {
    it("should set reward token, reward per block and start block", async () => {
      expect(await mining.rewardToken()).to.equal(rewardToken.target);
      expect(await mining.rewardPerBlock()).to.equal(REWARD_PER_BLOCK);
    });
  });

  describe("addPool", () => {
    it("should add a pool and emit Deposit", async () => {
      await mining.addPool(lpToken.target, 100);

      expect(await mining.poolLength()).to.equal(1);

      const pool = await mining.poolInfo(0);
      expect(pool.pair).to.equal(lpToken.target);
      expect(pool.allocPoint).to.equal(100);
    });

    it("should update totalAllocPoint", async () => {
      await mining.addPool(lpToken.target, 100);
      expect(await mining.totalAllocPoint()).to.equal(100);

      await mining.addPool(tokenA.target, 50);
      expect(await mining.totalAllocPoint()).to.equal(150);
    });

    it("should add multiple pools", async () => {
      await mining.addPool(lpToken.target, 100);
      await mining.addPool(tokenA.target, 200);
      await mining.addPool(tokenB.target, 50);

      expect(await mining.poolLength()).to.equal(3);
    });
  });

  describe("deposit", () => {
    beforeEach(async () => {
      await mining.addPool(lpToken.target, 100);
    });

    it("should deposit LP tokens and emit Deposit", async () => {
      const amount = ethers.parseEther("1000");
      await lpToken.connect(user1).approve(mining.target, amount);

      await expect(mining.connect(user1).deposit(0, amount))
        .to.emit(mining, "Deposit")
        .withArgs(user1.address, 0, amount);
    });

    it("should transfer LP tokens from user to mining contract", async () => {
      const amount = ethers.parseEther("1000");
      await lpToken.connect(user1).approve(mining.target, amount);
      await mining.connect(user1).deposit(0, amount);

      expect(await lpToken.balanceOf(mining.target)).to.equal(amount);
    });

    it("should update user amount", async () => {
      const amount = ethers.parseEther("1000");
      await lpToken.connect(user1).approve(mining.target, amount);
      await mining.connect(user1).deposit(0, amount);

      const userInfo = await mining.userInfo(0, user1.address);
      expect(userInfo.amount).to.equal(amount);
    });

    it("should allow multiple deposits", async () => {
      const amount1 = ethers.parseEther("1000");
      const amount2 = ethers.parseEther("500");
      await lpToken.connect(user1).approve(mining.target, amount1 + amount2);

      await mining.connect(user1).deposit(0, amount1);
      await mining.connect(user1).deposit(0, amount2);

      const userInfo = await mining.userInfo(0, user1.address);
      expect(userInfo.amount).to.equal(amount1 + amount2);
    });

    it("should revert with INVALID_PID for non-existent pool", async () => {
      await lpToken.connect(user1).approve(mining.target, ethers.parseEther("100"));

      await expect(mining.connect(user1).deposit(5, ethers.parseEther("100")))
        .to.be.revertedWith("LiquidityMining: INVALID_PID");
    });
  });

  describe("withdraw", () => {
    const depositAmount = ethers.parseEther("1000");

    beforeEach(async () => {
      await mining.addPool(lpToken.target, 100);
      await lpToken.connect(user1).approve(mining.target, depositAmount);
      await mining.connect(user1).deposit(0, depositAmount);
    });

    it("should withdraw LP tokens and emit Withdraw", async () => {
      const withdrawAmount = ethers.parseEther("500");

      await expect(mining.connect(user1).withdraw(0, withdrawAmount))
        .to.emit(mining, "Withdraw")
        .withArgs(user1.address, 0, withdrawAmount);
    });

    it("should transfer LP tokens back to user", async () => {
      const withdrawAmount = ethers.parseEther("500");
      const balanceBefore = await lpToken.balanceOf(user1.address);

      await mining.connect(user1).withdraw(0, withdrawAmount);

      expect(await lpToken.balanceOf(user1.address)).to.equal(balanceBefore + withdrawAmount);
    });

    it("should update user amount after withdrawal", async () => {
      const withdrawAmount = ethers.parseEther("500");
      await mining.connect(user1).withdraw(0, withdrawAmount);

      const userInfo = await mining.userInfo(0, user1.address);
      expect(userInfo.amount).to.equal(depositAmount - withdrawAmount);
    });

    it("should allow full withdrawal", async () => {
      await mining.connect(user1).withdraw(0, depositAmount);

      const userInfo = await mining.userInfo(0, user1.address);
      expect(userInfo.amount).to.equal(0);
    });

    it("should revert with INSUFFICIENT_BALANCE if withdrawing more than deposited", async () => {
      await expect(mining.connect(user1).withdraw(0, depositAmount + 1n))
        .to.be.revertedWith("LiquidityMining: INSUFFICIENT_BALANCE");
    });
  });

  describe("harvest", () => {
    const depositAmount = ethers.parseEther("1000");

    beforeEach(async () => {
      await mining.addPool(lpToken.target, 100);
      await lpToken.connect(user1).approve(mining.target, depositAmount);
      await mining.connect(user1).deposit(0, depositAmount);
    });

    it("should emit Harvest with reward amount", async () => {
      await ethers.provider.send("evm_mine", []);
      await ethers.provider.send("evm_mine", []);

      const tx = await mining.connect(user1).harvest(0);
      await expect(tx).to.emit(mining, "Harvest");
    });

    it("should transfer reward tokens to user", async () => {
      await ethers.provider.send("evm_mine", []);
      await ethers.provider.send("evm_mine", []);

      const balanceBefore = await rewardToken.balanceOf(user1.address);
      await mining.connect(user1).harvest(0);
      const balanceAfter = await rewardToken.balanceOf(user1.address);

      expect(balanceAfter).to.be.gt(balanceBefore);
    });

    it("should reset pendingRewards after harvest", async () => {
      await ethers.provider.send("evm_mine", []);
      await mining.connect(user1).harvest(0);

      const userInfo = await mining.userInfo(0, user1.address);
      expect(userInfo.pendingRewards).to.equal(0);
    });
  });

  describe("pendingReward", () => {
    it("should return 0 before any blocks are mined", async () => {
      await mining.addPool(lpToken.target, 100);
      await lpToken.connect(user1).approve(mining.target, ethers.parseEther("1000"));
      await mining.connect(user1).deposit(0, ethers.parseEther("1000"));

      const pending = await mining.pendingReward(0, user1.address);
      expect(pending).to.equal(0);
    });

    it("should accumulate rewards over blocks", async () => {
      await mining.addPool(lpToken.target, 100);
      await lpToken.connect(user1).approve(mining.target, ethers.parseEther("1000"));
      await mining.connect(user1).deposit(0, ethers.parseEther("1000"));

      await ethers.provider.send("evm_mine", []);
      await ethers.provider.send("evm_mine", []);

      const pending = await mining.pendingReward(0, user1.address);
      expect(pending).to.be.gt(0);
    });
  });

  describe("multi-user scenario", () => {
    it("should distribute rewards proportionally among multiple stakers", async () => {
      await mining.addPool(lpToken.target, 100);

      const amount1 = ethers.parseEther("3000");
      const amount2 = ethers.parseEther("1000");

      await lpToken.connect(user1).approve(mining.target, amount1);
      await lpToken.connect(user2).approve(mining.target, amount2);

      await mining.connect(user1).deposit(0, amount1);
      await mining.connect(user2).deposit(0, amount2);

      await ethers.provider.send("evm_mine", []);
      await ethers.provider.send("evm_mine", []);
      await ethers.provider.send("evm_mine", []);

      const pending1 = await mining.pendingReward(0, user1.address);
      const pending2 = await mining.pendingReward(0, user2.address);

      expect(pending1).to.be.gt(pending2);
    });
  });

  describe("full lifecycle", () => {
    it("should complete deposit → harvest → withdraw lifecycle", async () => {
      await mining.addPool(lpToken.target, 100);

      const amount = ethers.parseEther("1000");
      await lpToken.connect(user1).approve(mining.target, amount);
      await mining.connect(user1).deposit(0, amount);

      await ethers.provider.send("evm_mine", []);
      await ethers.provider.send("evm_mine", []);
      await ethers.provider.send("evm_mine", []);

      const balanceBefore = await rewardToken.balanceOf(user1.address);
      await mining.connect(user1).harvest(0);
      const balanceAfterHarvest = await rewardToken.balanceOf(user1.address);
      expect(balanceAfterHarvest).to.be.gt(balanceBefore);

      await mining.connect(user1).withdraw(0, amount);

      const userInfo = await mining.userInfo(0, user1.address);
      expect(userInfo.amount).to.equal(0);

      expect(await lpToken.balanceOf(user1.address)).to.be.gte(amount);
    });
  });
});
