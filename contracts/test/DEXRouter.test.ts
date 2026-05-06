import { expect } from "chai";
import { ethers } from "hardhat";
import { DEXFactory, DEXRouter, MockERC20, MockWETH } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("DEX Router", () => {
  let factory: DEXFactory;
  let router: DEXRouter;
  let tokenA: MockERC20;
  let tokenB: MockERC20;
  let weth: MockWETH;
  let owner: HardhatEthersSigner;
  let other: HardhatEthersSigner;

  async function getDeadline() {
    const block = await ethers.provider.getBlock("latest");
    return BigInt(block!.timestamp + 3600);
  }

  beforeEach(async () => {
    [owner, other] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory("DEXFactory");
    factory = await Factory.deploy();

    const WETH = await ethers.getContractFactory("MockWETH");
    weth = await WETH.deploy();

    const Router = await ethers.getContractFactory("DEXRouter");
    router = await Router.deploy(factory.target, weth.target);

    const Token = await ethers.getContractFactory("MockERC20");
    tokenA = await Token.deploy("Token A", "TKA");
    tokenB = await Token.deploy("Token B", "TKB");

    await tokenA.mint(owner.address, ethers.parseEther("100000"));
    await tokenB.mint(owner.address, ethers.parseEther("100000"));
    await tokenA.mint(other.address, ethers.parseEther("100000"));
    await tokenB.mint(other.address, ethers.parseEther("100000"));
  });

  async function addLiquidity(
    token0: MockERC20,
    token1: MockERC20,
    amount0: bigint,
    amount1: bigint
  ) {
    await token0.approve(router.target, amount0);
    await token1.approve(router.target, amount1);
    await router.addLiquidity(
      token0.target,
      token1.target,
      amount0,
      amount1,
      0,
      0,
      owner.address,
      await getDeadline()
    );
  }

  describe("addLiquidity", () => {
    it("should add liquidity and mint LP tokens", async () => {
      const amountA = ethers.parseEther("100");
      const amountB = ethers.parseEther("200");

      await addLiquidity(tokenA, tokenB, amountA, amountB);

      const pairAddress = await factory.getPair(tokenA.target, tokenB.target);
      const pair = await ethers.getContractAt("DEXPair", pairAddress);
      const liquidity = await pair.balanceOf(owner.address);
      expect(liquidity).to.be.gt(0);
    });

    it("should create pair if not exists", async () => {
      expect(await factory.getPair(tokenA.target, tokenB.target)).to.equal(ethers.ZeroAddress);
      await addLiquidity(tokenA, tokenB, ethers.parseEther("100"), ethers.parseEther("200"));
      expect(await factory.getPair(tokenA.target, tokenB.target)).to.not.equal(ethers.ZeroAddress);
    });

    it("should refund excess tokens when optimal amount < desired", async () => {
      await addLiquidity(tokenA, tokenB, ethers.parseEther("100"), ethers.parseEther("200"));

      const balanceABefore = await tokenA.balanceOf(owner.address);
      const balanceBBefore = await tokenB.balanceOf(owner.address);

      await addLiquidity(tokenA, tokenB, ethers.parseEther("10"), ethers.parseEther("50"));

      const balanceAAfter = await tokenA.balanceOf(owner.address);
      const balanceBAfter = await tokenB.balanceOf(owner.address);

      const usedA = balanceABefore - balanceAAfter;
      const usedB = balanceBBefore - balanceBAfter;

      expect(usedA).to.be.lte(ethers.parseEther("10"));
      expect(usedB).to.be.lte(ethers.parseEther("50"));
    });

    it("should revert on expired deadline", async () => {
      const expiredDeadline = Math.floor(Date.now() / 1000) - 3600;
      await tokenA.approve(router.target, ethers.parseEther("100"));
      await tokenB.approve(router.target, ethers.parseEther("200"));
      await expect(
        router.addLiquidity(
          tokenA.target, tokenB.target,
          ethers.parseEther("100"), ethers.parseEther("200"),
          0, 0, owner.address, expiredDeadline
        )
      ).to.be.revertedWith("DEXRouter: EXPIRED");
    });
  });

  describe("removeLiquidity", () => {
    beforeEach(async () => {
      await addLiquidity(tokenA, tokenB, ethers.parseEther("100"), ethers.parseEther("200"));
    });

    it("should remove liquidity and return tokens", async () => {
      const pairAddress = await factory.getPair(tokenA.target, tokenB.target);
      const pair = await ethers.getContractAt("DEXPair", pairAddress);
      const liquidity = await pair.balanceOf(owner.address);

      await pair.approve(router.target, liquidity);

      const balanceABefore = await tokenA.balanceOf(owner.address);
      const balanceBBefore = await tokenB.balanceOf(owner.address);

      await expect(
        router.removeLiquidity(
          tokenA.target, tokenB.target, liquidity, 0, 0, owner.address, await getDeadline()
        )
      ).to.emit(router, "LiquidityRemoved");

      expect(await tokenA.balanceOf(owner.address)).to.be.gt(balanceABefore);
      expect(await tokenB.balanceOf(owner.address)).to.be.gt(balanceBBefore);
    });

    it("should revert if amount less than min", async () => {
      const pairAddress = await factory.getPair(tokenA.target, tokenB.target);
      const pair = await ethers.getContractAt("DEXPair", pairAddress);
      const liquidity = await pair.balanceOf(owner.address);

      await pair.approve(router.target, liquidity);

      await expect(
        router.removeLiquidity(
          tokenA.target, tokenB.target, liquidity,
          ethers.parseEther("999999"), 0, owner.address, await getDeadline()
        )
      ).to.be.revertedWith("DEXRouter: INSUFFICIENT_A_AMOUNT");
    });
  });

  describe("swap", () => {
    beforeEach(async () => {
      await addLiquidity(tokenA, tokenB, ethers.parseEther("100"), ethers.parseEther("200"));
    });

    it("should swap exact tokens for tokens", async () => {
      const amountIn = ethers.parseEther("1");
      await tokenA.approve(router.target, amountIn);

      const balanceBBefore = await tokenB.balanceOf(owner.address);

      await expect(
        router.swapExactTokensForTokens(
          amountIn, 0, [tokenA.target, tokenB.target], owner.address, await getDeadline()
        )
      ).to.emit(router, "SwapExactTokensForTokens");

      expect(await tokenB.balanceOf(owner.address)).to.be.gt(balanceBBefore);
    });

    it("should swap tokens for exact tokens", async () => {
      const amountOut = ethers.parseEther("1");
      await tokenA.approve(router.target, ethers.parseEther("100"));

      const balanceBBefore = await tokenB.balanceOf(owner.address);

      await router.swapTokensForExactTokens(
        amountOut, ethers.parseEther("100"), [tokenA.target, tokenB.target], owner.address, await getDeadline()
      );

      expect(await tokenB.balanceOf(owner.address) - balanceBBefore).to.equal(amountOut);
    });

    it("should revert on insufficient output", async () => {
      const amountIn = ethers.parseEther("1");
      await tokenA.approve(router.target, amountIn);

      await expect(
        router.swapExactTokensForTokens(
          amountIn, ethers.parseEther("999"), [tokenA.target, tokenB.target], owner.address, await getDeadline()
        )
      ).to.be.revertedWith("DEXRouter: INSUFFICIENT_OUTPUT_AMOUNT");
    });

    it("should revert on excessive input", async () => {
      const amountOut = ethers.parseEther("1");
      await tokenA.approve(router.target, ethers.parseEther("0.001"));

      await expect(
        router.swapTokensForExactTokens(
          amountOut, ethers.parseEther("0.001"), [tokenA.target, tokenB.target], owner.address, await getDeadline()
        )
      ).to.be.revertedWith("DEXRouter: EXCESSIVE_INPUT_AMOUNT");
    });

    it("should support multi-hop swaps via 3 tokens", async () => {
      const Token = await ethers.getContractFactory("MockERC20");
      const tokenC = await Token.deploy("Token C", "TKC");
      await tokenC.mint(owner.address, ethers.parseEther("100000"));

      await addLiquidity(tokenB, tokenC, ethers.parseEther("200"), ethers.parseEther("200"));

      const amountIn = ethers.parseEther("1");
      await tokenA.approve(router.target, amountIn);

      const balanceCBefore = await tokenC.balanceOf(owner.address);

      await router.swapExactTokensForTokens(
        amountIn, 0, [tokenA.target, tokenB.target, tokenC.target], owner.address, await getDeadline()
      );

      expect(await tokenC.balanceOf(owner.address)).to.be.gt(balanceCBefore);
    });
  });

  describe("ETH pairs", () => {
    beforeEach(async () => {
      await tokenA.approve(router.target, ethers.parseEther("100"));
      await router.addLiquidityETH(
        tokenA.target, ethers.parseEther("100"), 0, 0, owner.address, await getDeadline(),
        { value: ethers.parseEther("10") }
      );
    });

    it("should swap exact ETH for tokens", async () => {
      const ethAmount = ethers.parseEther("1");
      const balanceBefore = await tokenA.balanceOf(owner.address);

      await expect(
        router.swapExactETHForTokens(
          0, [weth.target, tokenA.target], owner.address, await getDeadline(),
          { value: ethAmount }
        )
      ).to.emit(router, "SwapExactTokensForTokens");

      expect(await tokenA.balanceOf(owner.address)).to.be.gt(balanceBefore);
    });

    it("should swap exact tokens for ETH", async () => {
      const amountIn = ethers.parseEther("5");
      await tokenA.approve(router.target, amountIn);

      const ethBefore = await ethers.provider.getBalance(owner.address);

      await router.swapExactTokensForETH(
        amountIn, 0, [tokenA.target, weth.target], owner.address, await getDeadline()
      );

      expect(await ethers.provider.getBalance(owner.address)).to.be.gt(ethBefore);
    });

    it("should remove liquidity ETH", async () => {
      const pairAddress = await factory.getPair(tokenA.target, weth.target);
      const pair = await ethers.getContractAt("DEXPair", pairAddress);
      const liquidity = await pair.balanceOf(owner.address);

      await pair.approve(router.target, liquidity);

      const ethBefore = await ethers.provider.getBalance(owner.address);

      await router.removeLiquidityETH(
        tokenA.target, liquidity, 0, 0, owner.address, await getDeadline()
      );

      expect(await ethers.provider.getBalance(owner.address)).to.be.gt(ethBefore);
    });
  });

  describe("quote and amounts", () => {
    it("should return correct quote", async () => {
      const quote = await router.quote(
        ethers.parseEther("1"),
        ethers.parseEther("100"),
        ethers.parseEther("200")
      );
      expect(quote).to.equal(ethers.parseEther("2"));
    });

    it("should return correct getAmountOut with fee", async () => {
      const amountOut = await router.getAmountOut(
        ethers.parseEther("1"),
        ethers.parseEther("100"),
        ethers.parseEther("200")
      );
      const expected = (ethers.parseEther("1") * 997n * ethers.parseEther("200")) /
        (ethers.parseEther("100") * 1000n + ethers.parseEther("1") * 997n);
      expect(amountOut).to.equal(expected);
    });

    it("should return correct getAmountIn with fee", async () => {
      const amountIn = await router.getAmountIn(
        ethers.parseEther("1"),
        ethers.parseEther("100"),
        ethers.parseEther("200")
      );
      expect(amountIn).to.be.gt(0);
    });

    it("should revert quote with zero reserves", async () => {
      await expect(
        router.quote(ethers.parseEther("1"), 0, ethers.parseEther("200"))
      ).to.be.revertedWith("DEXLibrary: INSUFFICIENT_LIQUIDITY");
    });
  });
});
