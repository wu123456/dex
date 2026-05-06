import { expect } from "chai";
import { ethers } from "hardhat";
import { LimitOrderVault, MockERC20 } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("LimitOrderVault", () => {
  let vault: LimitOrderVault;
  let tokenIn: MockERC20;
  let tokenOut: MockERC20;
  let maker: HardhatEthersSigner;
  let filler: HardhatEthersSigner;
  let other: HardhatEthersSigner;

  const DEADLINE_OFFSET = 3600;

  beforeEach(async () => {
    [maker, filler, other] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("MockERC20");
    tokenIn = await Token.deploy("Token In", "TIN");
    tokenOut = await Token.deploy("Token Out", "TOUT");

    const Vault = await ethers.getContractFactory("LimitOrderVault");
    vault = await Vault.deploy();

    await tokenIn.mint(maker.address, ethers.parseEther("100000"));
    await tokenOut.mint(filler.address, ethers.parseEther("100000"));
    await tokenIn.mint(other.address, ethers.parseEther("100000"));
    await tokenOut.mint(other.address, ethers.parseEther("100000"));
  });

  async function getDeadline() {
    const block = await ethers.provider.getBlock("latest");
    return BigInt(block!.timestamp + DEADLINE_OFFSET);
  }

  describe("createOrder", () => {
    it("should create an order and emit OrderCreated", async () => {
      const amountIn = ethers.parseEther("100");
      const amountOut = ethers.parseEther("200");
      const deadline = await getDeadline();

      await tokenIn.connect(maker).approve(vault.target, amountIn);

      await expect(vault.connect(maker).createOrder(tokenIn.target, tokenOut.target, amountIn, amountOut, deadline))
        .to.emit(vault, "OrderCreated")
        .withArgs(0, maker.address, tokenIn.target, tokenOut.target, amountIn, amountOut);
    });

    it("should increment nextOrderId", async () => {
      const amountIn = ethers.parseEther("100");
      const amountOut = ethers.parseEther("200");
      const deadline = await getDeadline();

      await tokenIn.connect(maker).approve(vault.target, amountIn * 2n);

      await vault.connect(maker).createOrder(tokenIn.target, tokenOut.target, amountIn, amountOut, deadline);
      expect(await vault.nextOrderId()).to.equal(1);

      await vault.connect(maker).createOrder(tokenIn.target, tokenOut.target, amountIn, amountOut, deadline);
      expect(await vault.nextOrderId()).to.equal(2);
    });

    it("should store order details correctly", async () => {
      const amountIn = ethers.parseEther("100");
      const amountOut = ethers.parseEther("200");
      const deadline = await getDeadline();

      await tokenIn.connect(maker).approve(vault.target, amountIn);
      await vault.connect(maker).createOrder(tokenIn.target, tokenOut.target, amountIn, amountOut, deadline);

      const order = await vault.getOrder(0);
      expect(order.maker).to.equal(maker.address);
      expect(order.tokenIn).to.equal(tokenIn.target);
      expect(order.tokenOut).to.equal(tokenOut.target);
      expect(order.amountIn).to.equal(amountIn);
      expect(order.amountOut).to.equal(amountOut);
      expect(order.filled).to.be.false;
      expect(order.cancelled).to.be.false;
    });

    it("should transfer tokenIn from maker to vault", async () => {
      const amountIn = ethers.parseEther("100");
      const amountOut = ethers.parseEther("200");
      const deadline = await getDeadline();

      await tokenIn.connect(maker).approve(vault.target, amountIn);
      await vault.connect(maker).createOrder(tokenIn.target, tokenOut.target, amountIn, amountOut, deadline);

      expect(await tokenIn.balanceOf(vault.target)).to.equal(amountIn);
    });

    it("should revert with EXPIRED if deadline has passed", async () => {
      const amountIn = ethers.parseEther("100");
      const amountOut = ethers.parseEther("200");
      const pastDeadline = 1n;

      await tokenIn.connect(maker).approve(vault.target, amountIn);

      await expect(vault.connect(maker).createOrder(tokenIn.target, tokenOut.target, amountIn, amountOut, pastDeadline))
        .to.be.revertedWith("LimitOrderVault: EXPIRED");
    });

    it("should revert with ZERO_AMOUNT if amountIn is 0", async () => {
      const deadline = await getDeadline();

      await expect(vault.connect(maker).createOrder(tokenIn.target, tokenOut.target, 0n, ethers.parseEther("200"), deadline))
        .to.be.revertedWith("LimitOrderVault: ZERO_AMOUNT");
    });

    it("should revert with ZERO_AMOUNT if amountOut is 0", async () => {
      const deadline = await getDeadline();

      await tokenIn.connect(maker).approve(vault.target, ethers.parseEther("100"));
      await expect(vault.connect(maker).createOrder(tokenIn.target, tokenOut.target, ethers.parseEther("100"), 0n, deadline))
        .to.be.revertedWith("LimitOrderVault: ZERO_AMOUNT");
    });
  });

  describe("fillOrderDirect", () => {
    beforeEach(async () => {
      const deadline = await getDeadline();
      await tokenIn.connect(maker).approve(vault.target, ethers.parseEther("1000"));

      await vault.connect(maker).createOrder(
        tokenIn.target, tokenOut.target,
        ethers.parseEther("100"), ethers.parseEther("200"),
        deadline
      );
    });

    it("should fill an order and emit OrderFilled", async () => {
      await tokenOut.connect(filler).approve(vault.target, ethers.parseEther("200"));

      await expect(vault.connect(filler).fillOrderDirect(0))
        .to.emit(vault, "OrderFilled")
        .withArgs(0, filler.address, ethers.parseEther("200"));
    });

    it("should transfer tokenOut from filler to maker", async () => {
      await tokenOut.connect(filler).approve(vault.target, ethers.parseEther("200"));
      await vault.connect(filler).fillOrderDirect(0);

      expect(await tokenOut.balanceOf(maker.address)).to.be.gte(ethers.parseEther("200"));
    });

    it("should transfer tokenIn from vault to filler", async () => {
      await tokenOut.connect(filler).approve(vault.target, ethers.parseEther("200"));
      await vault.connect(filler).fillOrderDirect(0);

      expect(await tokenIn.balanceOf(filler.address)).to.equal(ethers.parseEther("100"));
    });

    it("should mark order as filled", async () => {
      await tokenOut.connect(filler).approve(vault.target, ethers.parseEther("200"));
      await vault.connect(filler).fillOrderDirect(0);

      const order = await vault.getOrder(0);
      expect(order.filled).to.be.true;
    });

    it("should revert with ALREADY_FILLED if order is already filled", async () => {
      await tokenOut.connect(filler).approve(vault.target, ethers.parseEther("400"));
      await vault.connect(filler).fillOrderDirect(0);

      await expect(vault.connect(filler).fillOrderDirect(0))
        .to.be.revertedWith("LimitOrderVault: ALREADY_FILLED");
    });

    it("should revert with CANCELLED if order is cancelled", async () => {
      await vault.connect(maker).cancelOrder(0);

      await tokenOut.connect(filler).approve(vault.target, ethers.parseEther("200"));
      await expect(vault.connect(filler).fillOrderDirect(0))
        .to.be.revertedWith("LimitOrderVault: CANCELLED");
    });

    it("should revert with EXPIRED if deadline has passed", async () => {
      await time.increase(DEADLINE_OFFSET + 1);

      await tokenOut.connect(filler).approve(vault.target, ethers.parseEther("200"));
      await expect(vault.connect(filler).fillOrderDirect(0))
        .to.be.revertedWith("LimitOrderVault: EXPIRED");
    });
  });

  describe("cancelOrder", () => {
    beforeEach(async () => {
      const deadline = await getDeadline();
      await tokenIn.connect(maker).approve(vault.target, ethers.parseEther("1000"));

      await vault.connect(maker).createOrder(
        tokenIn.target, tokenOut.target,
        ethers.parseEther("100"), ethers.parseEther("200"),
        deadline
      );
    });

    it("should cancel an order and emit OrderCancelled", async () => {
      await expect(vault.connect(maker).cancelOrder(0))
        .to.emit(vault, "OrderCancelled")
        .withArgs(0);
    });

    it("should return tokenIn to maker", async () => {
      const balanceBefore = await tokenIn.balanceOf(maker.address);
      await vault.connect(maker).cancelOrder(0);
      const balanceAfter = await tokenIn.balanceOf(maker.address);

      expect(balanceAfter - balanceBefore).to.equal(ethers.parseEther("100"));
    });

    it("should mark order as cancelled", async () => {
      await vault.connect(maker).cancelOrder(0);

      const order = await vault.getOrder(0);
      expect(order.cancelled).to.be.true;
    });

    it("should revert if not maker", async () => {
      await expect(vault.connect(other).cancelOrder(0))
        .to.be.revertedWith("LimitOrderVault: NOT_MAKER");
    });

    it("should revert if order is already filled", async () => {
      await tokenOut.connect(filler).approve(vault.target, ethers.parseEther("200"));
      await vault.connect(filler).fillOrderDirect(0);

      await expect(vault.connect(maker).cancelOrder(0))
        .to.be.revertedWith("LimitOrderVault: ALREADY_FILLED");
    });

    it("should revert if order is already cancelled", async () => {
      await vault.connect(maker).cancelOrder(0);

      await expect(vault.connect(maker).cancelOrder(0))
        .to.be.revertedWith("LimitOrderVault: ALREADY_CANCELLED");
    });
  });

  describe("multiple orders", () => {
    it("should handle multiple independent orders", async () => {
      const deadline = await getDeadline();
      await tokenIn.connect(maker).approve(vault.target, ethers.parseEther("1000"));
      await tokenIn.connect(other).approve(vault.target, ethers.parseEther("1000"));

      await vault.connect(maker).createOrder(tokenIn.target, tokenOut.target, ethers.parseEther("100"), ethers.parseEther("200"), deadline);
      await vault.connect(other).createOrder(tokenIn.target, tokenOut.target, ethers.parseEther("50"), ethers.parseEther("100"), deadline);

      expect(await vault.nextOrderId()).to.equal(2);

      const order0 = await vault.getOrder(0);
      const order1 = await vault.getOrder(1);
      expect(order0.maker).to.equal(maker.address);
      expect(order1.maker).to.equal(other.address);

      await tokenOut.connect(filler).approve(vault.target, ethers.parseEther("400"));
      await vault.connect(filler).fillOrderDirect(0);

      await vault.connect(other).cancelOrder(1);

      const order0After = await vault.getOrder(0);
      const order1After = await vault.getOrder(1);
      expect(order0After.filled).to.be.true;
      expect(order1After.cancelled).to.be.true;
    });
  });
});
