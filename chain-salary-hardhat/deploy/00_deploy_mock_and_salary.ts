import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy, log } = hre.deployments;

  // ETH 模式无需代币，直接部署 SalaryManager（无构造参数）
  const sm = await deploy("SalaryManager", { from: deployer, log: true, args: [] });
  log(`SalaryManager deployed at ${sm.address}`);
};

export default func;
func.tags = ["MockToken", "SalaryManager", "all"];


