import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  const Token = await ethers.getContractFactory("MockERC20");

  const tokenA = await Token.deploy("Token A", "TKA");
  await tokenA.waitForDeployment();
  console.log("Token A deployed to:", await tokenA.getAddress());

  const tokenB = await Token.deploy("Token B", "TKB");
  await tokenB.waitForDeployment();
  console.log("Token B deployed to:", await tokenB.getAddress());

  const tokenC = await Token.deploy("Token C", "TKC");
  await tokenC.waitForDeployment();
  console.log("Token C deployed to:", await tokenC.getAddress());

  const mintAmount = ethers.parseEther("1000000");
  for (const token of [tokenA, tokenB, tokenC]) {
    await token.mint(deployer.address, mintAmount);
  }
  console.log("Minted 1,000,000 of each token to deployer");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
