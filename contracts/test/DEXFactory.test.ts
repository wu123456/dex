import { expect } from "chai";
import { ethers } from "hardhat";
import { DEXFactory, DEXPair, DEXRouter, MockERC20, MockWETH } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("DEX Factory", () => {
  let factory: DEXFactory;
  let tokenA: MockERC20;
  let tokenB: MockERC20;
  let owner: HardhatEthersSigner;

  beforeEach(async () => {
    [owner] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("DEXFactory");
    factory = await Factory.deploy();
    const Token = await ethers.getContractFactory("MockERC20");
    tokenA = await Token.deploy("Token A", "TKA");
    tokenB = await Token.deploy("Token B", "TKB");
  });

  it("should set feeToSetter on deploy", async () => {
    expect(await factory.feeToSetter()).to.equal(owner.address);
  });

  it("should create pair and emit event", async () => {
    await expect(factory.createPair(tokenA.target, tokenB.target))
      .to.emit(factory, "PairCreated");
  });

  it("should revert on identical addresses", async () => {
    await expect(factory.createPair(tokenA.target, tokenA.target))
      .to.be.revertedWith("DEXFactory: IDENTICAL_ADDRESSES");
  });

  it("should revert on zero address", async () => {
    const Token = await ethers.getContractFactory("MockERC20");
    const tokenZ = await Token.deploy("Zero", "ZERO");
    await expect(factory.createPair(ethers.ZeroAddress, tokenZ.target))
      .to.be.revertedWith("DEXFactory: ZERO_ADDRESS");
  });

  it("should revert if pair already exists", async () => {
    await factory.createPair(tokenA.target, tokenB.target);
    await expect(factory.createPair(tokenA.target, tokenB.target))
      .to.be.revertedWith("DEXFactory: PAIR_EXISTS");
  });

  it("should store pair in both directions", async () => {
    await factory.createPair(tokenA.target, tokenB.target);
    const pair = await factory.getPair(tokenA.target, tokenB.target);
    expect(pair).to.not.equal(ethers.ZeroAddress);
    expect(await factory.getPair(tokenB.target, tokenA.target)).to.equal(pair);
  });

  it("should increment allPairsLength", async () => {
    expect(await factory.allPairsLength()).to.equal(0);
    await factory.createPair(tokenA.target, tokenB.target);
    expect(await factory.allPairsLength()).to.equal(1);
  });

  it("should set feeTo", async () => {
    const [, other] = await ethers.getSigners();
    await factory.setFeeTo(other.address);
    expect(await factory.feeTo()).to.equal(other.address);
  });

  it("should revert setFeeTo from non-setter", async () => {
    const [, other] = await ethers.getSigners();
    await expect(factory.connect(other).setFeeTo(other.address))
      .to.be.revertedWith("DEXFactory: FORBIDDEN");
  });

  it("should set feeToSetter", async () => {
    const [, other] = await ethers.getSigners();
    await factory.setFeeToSetter(other.address);
    expect(await factory.feeToSetter()).to.equal(other.address);
  });
});
