import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

// Deprecated: kept for compatibility, do nothing in ETH mode
const func: DeployFunction = async function (_hre: HardhatRuntimeEnvironment) {
  return;
};

export default func;
func.id = "deploy_salary_manager_disabled";
func.tags = ["disabled"];


