declare module "ethers" {
  export type Eip1193Provider = any;
  export class JsonRpcProvider {
    constructor(url: string);
    getNetwork(): Promise<{ chainId: number | bigint }>;
  }
  export class BrowserProvider {
    constructor(provider: any);
    send(method: string, params: any[]): Promise<any>;
    getSigner(): Promise<any>;
  }
  export class Contract {
    constructor(address: string, abi: any, runner: any);
  }
  export type Signer = any;
  export const ethers: any;
}

declare module "@fhevm/mock-utils" {
  export class MockFhevmInstance {
    static create(readonlyProvider: any, signerProvider: any, config: any): Promise<any>;
  }
}

declare module "@zama-fhe/relayer-sdk/bundle" {
  export function initSDK(options?: any): Promise<boolean>;
  export function createInstance(config: any): Promise<any>;
  export const SepoliaConfig: any;
}

// Local path shims for simplified imports used by My Salary page
declare module "../../abi/SalaryManagerAddresses" {
  export const SalaryManagerAddresses: Record<string, { address: string; chainId: number; chainName: string }>;
}

declare module "../../fhevm/FhevmDecryptionSignature" {
  export const FhevmDecryptionSignature: any;
}

declare module "../../fhevm/GenericStringStorage" {
  export class GenericStringInMemoryStorage {
    getItem(key: string): string | Promise<string | null> | null;
    setItem(key: string, value: string): void | Promise<void>;
    removeItem(key: string): void | Promise<void>;
  }
}


