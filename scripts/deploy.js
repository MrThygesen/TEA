const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  // Deploy TEAToken
  const TEAToken = await ethers.getContractFactory("TEAToken");
  const token = await TEAToken.deploy(ethers.parseEther("100000000"));
  await token.waitForDeployment();
  console.log("TEAToken deployed to:", token.target);

  // Deploy TokenVesting
  const TokenVesting = await ethers.getContractFactory("TokenVesting");
  const vesting = await TokenVesting.deploy(token.target, deployer.address);
  await vesting.waitForDeployment();
  console.log("TokenVesting deployed to:", vesting.target);

  // Deploy TokenAllocation (optional, if using)
  const TokenAllocation = await ethers.getContractFactory("TokenAllocation");
  const allocation = await TokenAllocation.deploy(deployer.address, vesting.target);
  await allocation.waitForDeployment();
  console.log("TokenAllocation deployed to:", allocation.target);
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

