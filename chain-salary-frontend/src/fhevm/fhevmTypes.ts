export type FhevmInstance = any;

export type EIP712Type = {
  domain: any;
  types: any;
  message: any;
  primaryType: string;
};

export type FhevmDecryptionSignatureType = {
  publicKey: string;
  privateKey: string;
  signature: string;
  startTimestamp: number;
  durationDays: number;
  userAddress: `0x${string}`;
  contractAddresses: `0x${string}`[];
  eip712: EIP712Type;
};




