import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

  const WETH = await ethers.getContractFactory("MockWETH");
  const weth = await WETH.deploy();
  await weth.waitForDeployment();
  const wethAddress = await weth.getAddress();
  console.log("MockWETH deployed to:", wethAddress);

  const Factory = await ethers.getContractFactory("DEXFactory");
  const factory = await Factory.deploy();
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("DEXFactory deployed to:", factoryAddress);

  const Router = await ethers.getContractFactory("DEXRouter");
  const router = await Router.deploy(factoryAddress, wethAddress);
  await router.waitForDeployment();
  const routerAddress = await router.getAddress();
  console.log("DEXRouter deployed to:", routerAddress);

  console.log("\n--- Deployment Summary ---");
  console.log("FACTORY_ADDRESS=", factoryAddress);
  console.log("ROUTER_ADDRESS=", routerAddress);
  console.log("WETH_ADDRESS=", wethAddress);
  console.log("\nUpdate frontend/.env.local with:");
  console.log(`NEXT_PUBLIC_FACTORY_ADDRESS=${factoryAddress}`);
  console.log(`NEXT_PUBLIC_ROUTER_ADDRESS=${routerAddress}`);
  console.log(`NEXT_PUBLIC_WETH_ADDRESS=${wethAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
