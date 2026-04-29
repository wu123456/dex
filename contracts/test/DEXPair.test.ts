import { expect } from "chai";
import { ethers } from "hardhat";
import { DEXFactory, DEXPair, MockERC20 } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("DEX Pair", () => {
  let factory: DEXFactory;
  let pair: DEXPair;
  let token0: MockERC20;
  let token1: MockERC20;
  let owner: HardhatEthersSigner;
  let other: HardhatEthersSigner;

  const MINIMUM_LIQUIDITY = 1000n;

  beforeEach(async () => {
    [owner, other] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("DEXFactory");
    factory = await Factory.deploy();
    const Token = await ethers.getContractFactory("MockERC20");
    const tokenA = await Token.deploy("Token A", "TKA");
    const tokenB = await Token.deploy("Token B", "TKB");

    await factory.createPair(tokenA.target, tokenB.target);
    const pairAddress = await factory.getPair(tokenA.target, tokenB.target);
    pair = await ethers.getContractAt("DEXPair", pairAddress);

    const token0Addr = await pair.token0();
    token0 = tokenA.target === token0Addr ? tokenA : tokenB;
    token1 = tokenA.target === token0Addr ? tokenB : tokenA;
  });

  async function addLiquidity(amount0: bigint, amount1: bigint) {
    await token0.transfer(pair.target, amount0);
    await token1.transfer(pair.target, amount1);
    await pair.mint(owner.address);
  }

  it("should have correct token0 and token1", async () => {
    expect(await pair.token0()).to.equal(token0.target);
    expect(await pair.token1()).to.equal(token1.target);
    expect(await pair.factory()).to.equal(factory.target);
  });

  it("should mint LP tokens on first liquidity", async () => {
    const amount0 = ethers.parseEther("10");
    const amount1 = ethers.parseEther("20");
    await token0.mint(owner.address, amount0);
    await token1.mint(owner.address, amount1);
    await token0.transfer(pair.target, amount0);
    await token1.transfer(pair.target, amount1);

    await expect(pair.mint(owner.address)).to.emit(pair, "Mint");

    const liquidity = await pair.balanceOf(owner.address);
    expect(liquidity).to.be.gt(0);
    expect(await pair.totalSupply()).to.equal(liquidity + MINIMUM_LIQUIDITY);
  });

  it("should lock minimum liquidity to pair contract", async () => {
    const amount0 = ethers.parseEther("10");
    const amount1 = ethers.parseEther("10");
    await token0.mint(owner.address, amount0);
    await token1.mint(owner.address, amount1);
    await addLiquidity(amount0, amount1);

    expect(await pair.balanceOf(pair.target)).to.equal(MINIMUM_LIQUIDITY);
  });

  it("should update reserves after mint", async () => {
    const amount0 = ethers.parseEther("10");
    const amount1 = ethers.parseEther("20");
    await token0.mint(owner.address, amount0);
    await token1.mint(owner.address, amount1);
    await addLiquidity(amount0, amount1);

    const [r0, r1] = await pair.getReserves();
    expect(r0).to.equal(amount0);
    expect(r1).to.equal(amount1);
  });

  it("should burn LP tokens and return assets", async () => {
    const amount0 = ethers.parseEther("10");
    const amount1 = ethers.parseEther("20");
    await token0.mint(owner.address, amount0);
    await token1.mint(owner.address, amount1);
    await addLiquidity(amount0, amount1);

    const liquidity = await pair.balanceOf(owner.address);
    await pair.transfer(pair.target, liquidity);

    const balance0Before = await token0.balanceOf(owner.address);
    const balance1Before = await token1.balanceOf(owner.address);

    await expect(pair.burn(owner.address)).to.emit(pair, "Burn");

    const balance0After = await token0.balanceOf(owner.address);
    const balance1After = await token1.balanceOf(owner.address);
    expect(balance0After).to.be.gt(balance0Before);
    expect(balance1After).to.be.gt(balance1Before);
  });

  it("should swap tokens with 0.3% fee", async () => {
    const amount0 = ethers.parseEther("10");
    const amount1 = ethers.parseEther("20");
    await token0.mint(owner.address, amount0);
    await token1.mint(owner.address, amount1);
    await addLiquidity(amount0, amount1);

    const swapAmount = ethers.parseEther("1");
    await token0.mint(owner.address, swapAmount);
    await token0.transfer(pair.target, swapAmount);

    const balance1Before = await token1.balanceOf(owner.address);

    const expectedOut = (swapAmount * 997n * amount1) / (amount0 * 1000n + swapAmount * 997n);

    await pair.swap(0, expectedOut, owner.address);

    const balance1After = await token1.balanceOf(owner.address);
    expect(balance1After - balance1Before).to.equal(expectedOut);
  });

  it("should enforce constant product invariant (K)", async () => {
    const amount0 = ethers.parseEther("10");
    const amount1 = ethers.parseEther("20");
    await token0.mint(owner.address, amount0);
    await token1.mint(owner.address, amount1);
    await addLiquidity(amount0, amount1);

    const swapAmount = ethers.parseEther("1");
    await token0.mint(owner.address, swapAmount);
    await token0.transfer(pair.target, swapAmount);

    const tooMuchOut = amount1 / 2n;
    await expect(pair.swap(0, tooMuchOut, owner.address))
      .to.be.revertedWith("DEXPair: K");
  });

  it("should revert on insufficient output amount", async () => {
    await expect(pair.swap(0, 0, owner.address))
      .to.be.revertedWith("DEXPair: INSUFFICIENT_OUTPUT_AMOUNT");
  });

  it("should revert swap to token address", async () => {
    const amount0 = ethers.parseEther("10");
    const amount1 = ethers.parseEther("20");
    await token0.mint(owner.address, amount0);
    await token1.mint(owner.address, amount1);
    await addLiquidity(amount0, amount1);

    await expect(pair.swap(0, 1, token0.target))
      .to.be.revertedWith("DEXPair: INVALID_TO");
  });

  it("should sync reserves correctly", async () => {
    const amount0 = ethers.parseEther("10");
    const amount1 = ethers.parseEther("20");
    await token0.mint(owner.address, amount0 + ethers.parseEther("1"));
    await token1.mint(owner.address, amount1);
    await addLiquidity(amount0, amount1);

    await token0.transfer(pair.target, ethers.parseEther("1"));
    await pair.sync();

    const [r0, r1] = await pair.getReserves();
    expect(r0).to.equal(amount0 + ethers.parseEther("1"));
    expect(r1).to.equal(amount1);
  });

  it("should skim excess tokens", async () => {
    const amount0 = ethers.parseEther("10");
    const amount1 = ethers.parseEther("20");
    await token0.mint(owner.address, amount0);
    await token1.mint(owner.address, amount1);
    await addLiquidity(amount0, amount1);

    const excess = ethers.parseEther("5");
    await token0.mint(owner.address, excess);
    await token0.transfer(pair.target, excess);

    const balanceBefore = await token0.balanceOf(owner.address);
    await pair.skim(owner.address);
    const balanceAfter = await token0.balanceOf(owner.address);

    expect(balanceAfter - balanceBefore).to.equal(excess);
  });
});
