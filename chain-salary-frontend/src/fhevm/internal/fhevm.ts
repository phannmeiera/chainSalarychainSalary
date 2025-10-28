import { Eip1193Provider, JsonRpcProvider } from "ethers";

export type FhevmInstance = any;

function isBrowser(): boolean { return typeof window !== "undefined"; }

export async function createFhevmInstance(params: {
  provider: Eip1193Provider | string;
  mockChains?: Record<number, string>;
}): Promise<FhevmInstance> {
  const chainId = await getChainId(params.provider);
  const rpcUrl = typeof params.provider === "string" ? params.provider : undefined;
  const mockChains: Record<number, string> = { 31337: "http://127.0.0.1:8545", ...(params.mockChains ?? {}) } as Record<number, string>;

  if (chainId in mockChains) {
    const url = rpcUrl ?? mockChains[Number(chainId)];
    const client = new JsonRpcProvider(url);
    // 若为本地 Hardhat FHEVM 节点，动态导入 mock
    const { MockFhevmInstance } = await import("@fhevm/mock-utils");
    // 优先尝试 FHEVM Hardhat 节点元数据；失败则使用内置占位地址创建本地 mock
    let instance: any;
    try {
      const version = await (client as any).send("web3_clientVersion", []);
      if (typeof version === "string" && version.toLowerCase().includes("hardhat")) {
        try {
          const meta = await (client as any).send("fhevm_relayer_metadata", []);
          if (meta && meta.ACLAddress && meta.InputVerifierAddress && meta.KMSVerifierAddress) {
            instance = await MockFhevmInstance.create(client, client, {
              aclContractAddress: meta.ACLAddress,
              chainId,
              gatewayChainId: 55815,
              inputVerifierContractAddress: meta.InputVerifierAddress,
              kmsContractAddress: meta.KMSVerifierAddress,
              verifyingContractAddressDecryption: "0x5ffdaAB0373E62E2ea2944776209aEf29E631A64",
              verifyingContractAddressInputVerification: "0x812b06e1CDCE800494b79fFE4f925A504a9A9810",
            });
          }
        } catch {}
      }
    } catch {}

    if (!instance) {
      instance = await MockFhevmInstance.create(client, client, {
        aclContractAddress: "0x0000000000000000000000000000000000000001",
        chainId,
        gatewayChainId: 55815,
        inputVerifierContractAddress: "0x0000000000000000000000000000000000000002",
        kmsContractAddress: "0x1364cBBf2cDF5032C47d8226a6f6FBD2AFCDacAC",
        verifyingContractAddressDecryption: "0x0000000000000000000000000000000000000003",
        verifyingContractAddressInputVerification: "0x0000000000000000000000000000000000000004",
      });
    }
    return instance;
  }

  if (!isBrowser()) throw new Error("Browser required for Relayer SDK");
  // 动态加载 SDK，优先使用 web 入口，回退 bundle
  const sdkNS = await (async () => {
    try {
      return await import("@zama-fhe/relayer-sdk/web");
    } catch {
      return await import("@zama-fhe/relayer-sdk/bundle");
    }
  })();

  // Handle both ESM namespace and default export shapes
  const sdk: any = (sdkNS as any).initSDK ? sdkNS : (sdkNS as any).default ?? sdkNS;

  const ok = await sdk.initSDK();
  if (!ok) throw new Error("initSDK failed");
  const sepoliaCfg = sdk.SepoliaConfig ?? sdk.default?.SepoliaConfig ?? {};
  const config = { ...sepoliaCfg, network: params.provider };
  const create = sdk.createInstance ?? sdk.default?.createInstance;
  const instance = await create(config);
  return instance;
}

async function getChainId(provider: Eip1193Provider | string): Promise<number> {
  if (typeof provider === "string") {
    const p = new JsonRpcProvider(provider);
    const n = await p.getNetwork();
    return Number(n.chainId);
  }
  const cid = (await provider.request({ method: "eth_chainId" })) as string;
  return parseInt(cid, 16);
}


