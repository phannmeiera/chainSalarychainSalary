"use client";

import { useEffect, useMemo, useState } from "react";
import { BrowserProvider, Contract, Signer, ethers } from "ethers";
import { useFhevm } from "../../fhevm/useFhevm";
import { SalaryManagerAddresses } from "../../../abi/SalaryManagerAddresses";
import { FhevmDecryptionSignature } from "../../fhevm/FhevmDecryptionSignature";
import { GenericStringInMemoryStorage } from "../../fhevm/GenericStringStorage";

export default function MySalaryPage() {
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [signer, setSigner] = useState<Signer | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [handle, setHandle] = useState<string | null>(null);
  const [clear, setClear] = useState<string | null>(null);
  const [cycleSeconds, setCycleSeconds] = useState<number | null>(null);
  const [lastClaimAt, setLastClaimAt] = useState<number | null>(null);
  const [active, setActive] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).ethereum) {
      const p = new BrowserProvider((window as any).ethereum);
      setProvider(p);
      p.send("eth_chainId", []).then((cid) => setChainId(parseInt(cid, 16)));
    }
  }, []);

  const target = useMemo(() => {
    if (!chainId) return undefined;
    const entry = (SalaryManagerAddresses as any)[String(chainId)];
    if (!entry || !entry.address) return undefined;
    return entry.address as `0x${string}`;
  }, [chainId]);

  const { instance, status } = useFhevm({
    provider: provider ? (window as any).ethereum : undefined,
    chainId: chainId ?? undefined,
    initialMockChains: { 31337: "http://127.0.0.1:8545" },
    enabled: true,
  });

  async function connect() {
    if (!provider) return;
    const accounts = await provider.send("eth_requestAccounts", []);
    setAddress(accounts?.[0] ?? null);
    const s = await provider.getSigner();
    setSigner(s);
  }

  async function loadSalaryHandle() {
    if (!provider || !target) return;
    setMessage("Loading employee info...");
    try {
      const abi = ["function getEmployeeInfo(address) view returns (bytes32,uint64,uint64,bool)"];
      const c = new Contract(target, abi, provider) as unknown as {
        getEmployeeInfo(emp: string | null): Promise<[string, bigint, bigint, boolean]>;
      };
      const info = await c.getEmployeeInfo(address);
      const salaryHandle = info[0] as string;
      const cycle = Number(info[1]);
      const lastClaim = Number(info[2]);
      const isActive = info[3] as boolean;
      
      setHandle(salaryHandle);
      setCycleSeconds(cycle);
      setLastClaimAt(lastClaim);
      setActive(isActive);
      setMessage("Info loaded.");
    } catch (e: any) {
      setMessage(`Failed to load: ${e?.message ?? e}`);
    }
  }

  async function decryptSalary() {
    if (!instance || !signer || !handle || !target) return;
    setMessage("Decrypting...");
    try {
      const storage = new GenericStringInMemoryStorage();
      const sig = await FhevmDecryptionSignature.loadOrSign(
        instance,
        [target],
        signer,
        storage
      );
      if (!sig) {
        setMessage("Failed to build decryption signature.");
        return;
      }
      const res = await instance.userDecrypt(
        [{ handle, contractAddress: target }],
        sig.privateKey,
        sig.publicKey,
        sig.signature,
        sig.contractAddresses,
        sig.userAddress,
        sig.startTimestamp,
        sig.durationDays
      );
      setClear(String(res[handle]));
      setMessage("Decryption completed.");
    } catch (e: any) {
      setMessage(`Decrypt failed: ${e?.message ?? e}`);
    }
  }

  useEffect(() => {
    if (cycleSeconds && lastClaimAt) {
      const timer = setInterval(() => {
        const now = Math.floor(Date.now() / 1000);
        const next = lastClaimAt + cycleSeconds;
        setTimeLeft(Math.max(0, next - now));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [cycleSeconds, lastClaimAt]);

  const nextPayday = useMemo(() => {
    if (!lastClaimAt || !cycleSeconds) return null;
    return new Date((lastClaimAt + cycleSeconds) * 1000);
  }, [lastClaimAt, cycleSeconds]);

  const periodsElapsed = useMemo(() => {
    if (!cycleSeconds || !lastClaimAt) return 0;
    const now = Math.floor(Date.now() / 1000);
    return Math.floor((now - lastClaimAt) / cycleSeconds);
  }, [cycleSeconds, lastClaimAt, timeLeft]);

  const claimableAmount = useMemo(() => {
    if (!clear || periodsElapsed === 0) return null;
    return BigInt(clear) * BigInt(periodsElapsed);
  }, [clear, periodsElapsed]);

  return (
    <div className="min-h-screen container mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">💼 My Salary</h1>
        {!address ? (
          <button className="btn-primary" onClick={connect}>Connect</button>
        ) : (
          <span className="text-sm text-gray-600 font-mono">{address}</span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-xl font-bold mb-4">📋 Employee Info</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">FHEVM Status:</span>
              <span className={`font-semibold ${status === "ready" ? "text-green-600" : "text-yellow-600"}`}>
                {status === "ready" ? "✅ Ready" : status === "loading" ? "⏳ Loading" : "⚠️ Not Ready"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Active:</span>
              <span className={`font-semibold ${active ? "text-green-600" : "text-red-600"}`}>
                {active ? "✅ Yes" : "❌ No"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Pay Cycle:</span>
              <span className="font-semibold">{cycleSeconds ? `${cycleSeconds}s` : "-"}</span>
            </div>
          </div>
          <div className="mt-6 flex gap-3">
            <button className="btn-primary flex-1" onClick={loadSalaryHandle} disabled={!address || !target}>
              Load Info
            </button>
            <button className="btn-primary flex-1" onClick={decryptSalary} disabled={!handle || !instance || !signer}>
              Decrypt
            </button>
          </div>
        </div>

        <div className="card">
          <h3 className="text-xl font-bold mb-4">⏰ Next Payday</h3>
          {nextPayday ? (
            <div className="space-y-3">
              <div className="text-center bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-4">
                <p className="text-sm text-gray-600 mb-1">Time Until Next Pay</p>
                <p className="text-3xl font-bold text-primary-600">
                  {timeLeft !== null && timeLeft > 0
                    ? `${Math.floor(timeLeft / 60)}m ${timeLeft % 60}s`
                    : timeLeft === 0
                    ? "Ready to claim!"
                    : "-"}
                </p>
              </div>
              <div className="text-sm text-gray-600">
                <p>Next Payday: <span className="font-semibold">{nextPayday.toLocaleString()}</span></p>
                <p>Periods Elapsed: <span className="font-semibold">{periodsElapsed}</span></p>
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No payday info. Load info first.</p>
          )}
        </div>

        <div className="card lg:col-span-2">
          <h3 className="text-xl font-bold mb-4">🔐 Encrypted Salary</h3>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-1">Handle (euint64):</p>
              <p className="font-mono text-xs bg-gray-50 p-3 rounded-lg break-all">{handle ?? "-"}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Decrypted Salary Per Period:</p>
              <div className="bg-gradient-to-r from-green-50 to-blue-50 p-4 rounded-xl">
                <p className="text-3xl font-bold text-primary-600">
                  {clear ? `${ethers.formatEther(clear)} ETH` : "-"}
                </p>
                <p className="text-xs text-gray-500 mt-1">{clear ? `${clear} wei` : ""}</p>
              </div>
            </div>
            {claimableAmount && (
              <div>
                <p className="text-sm text-gray-600 mb-1">Claimable Amount ({periodsElapsed} periods):</p>
                <div className="bg-gradient-to-r from-yellow-50 to-orange-50 p-4 rounded-xl">
                  <p className="text-2xl font-bold text-orange-600">
                    {ethers.formatEther(claimableAmount)} ETH
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{claimableAmount.toString()} wei</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {message && (
          <div className="card lg:col-span-2">
            <p className="text-sm text-gray-700 font-mono">{message}</p>
          </div>
        )}
      </div>
    </div>
  );
}


