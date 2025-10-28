import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import path from "path";

const root = path.resolve("../../action/chain-salary-hardhat");
const deploymentsDir = path.join(root, "deployments");
const outDir = path.resolve("./abi");
const contractName = "SalaryManager";

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

function readDeployment(chain) {
  const file = path.join(deploymentsDir, chain, `${contractName}.json`);
  if (!existsSync(file)) return undefined;
  const json = JSON.parse(readFileSync(file, "utf-8"));
  return json;
}

const localhost = readDeployment("localhost");
const sepolia = readDeployment("sepolia");

const abi = (localhost ?? sepolia)?.abi;
if (!abi) {
  console.error("Unable to locate deployments for SalaryManager. Please deploy first.");
  process.exit(1);
}

const addresses = {
  "11155111": { address: sepolia?.address ?? "0x0000000000000000000000000000000000000000", chainId: 11155111, chainName: "sepolia" },
  "31337": { address: localhost?.address ?? "0x0000000000000000000000000000000000000000", chainId: 31337, chainName: "hardhat" },
};

const abiTs = `export const ${contractName}ABI = ${JSON.stringify({ abi }, null, 2)} as const;\n`;
const addrTs = `export const ${contractName}Addresses = ${JSON.stringify(addresses, null, 2)} as const;\n`;

writeFileSync(path.join(outDir, `${contractName}ABI.ts`), abiTs, "utf-8");
writeFileSync(path.join(outDir, `${contractName}Addresses.ts`), addrTs, "utf-8");

console.log("Generated ABI & Addresses for", contractName);






