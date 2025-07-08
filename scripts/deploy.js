const { ethers, upgrades } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying WebAccessSBTV2 with:", deployer.address);

  const WebAccessSBTV2 = await ethers.getContractFactory("WebAccessSBTV2");
  const sbt = await upgrades.deployProxy(WebAccessSBTV2, [deployer.address], {
    initializer: "initialize",
    kind: "uups",
  });
  await sbt.waitForDeployment();

  console.log("WebAccessSBTV2 (proxy) deployed to:", await sbt.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

