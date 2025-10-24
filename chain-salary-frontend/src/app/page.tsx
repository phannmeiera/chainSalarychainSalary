"use client";

import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import { SalaryManagerABI } from "../../abi/SalaryManagerABI";
import { SalaryManagerAddresses } from "../../abi/SalaryManagerAddresses";
import { useFhevm } from "../fhevm/useFhevm";
import { useSalaryManager } from "../hooks/useSalaryManager";

declare global {
  interface Window {
    ethereum?: ethers.Eip1193Provider;
  }
}

export default function Home() {
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [daoFunds, setDaoFunds] = useState<string>("0");
  const [view, setView] = useState<"admin" | "employee">("admin");
  // deposit form (ETH)
  const [depositEth, setDepositEth] = useState<string>("");

  // Form states
  const [empAddress, setEmpAddress] = useState("");
  const [salary, setSalary] = useState("");
  const [salaryUnit, setSalaryUnit] = useState<"ETH" | "wei">("wei");
  const [cycle, setCycle] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined" && window.ethereum) {
      const p = new ethers.BrowserProvider(window.ethereum);
      setProvider(p);
      p.send("eth_chainId", []).then((cid) => setChainId(parseInt(cid, 16)));
    }
  }, []);

  const target = useMemo(() => {
    if (!chainId) return undefined;
    const entry = (SalaryManagerAddresses as any)[String(chainId)];
    if (!entry || !entry.address || entry.address === "0x0000000000000000000000000000000000000000") return undefined;
    return { address: entry.address as `0x${string}`, chainId: entry.chainId as number };
  }, [chainId]);

  // SSR 安全的 EIP-1193 Provider 解析
  const eip1193Provider = typeof globalThis !== "undefined" && (globalThis as any).window && (globalThis as any).window.ethereum
    ? (globalThis as any).window.ethereum
    : undefined;

  const { instance: fhevmInstance, status: fhevmStatus } = useFhevm({
    provider: provider ? eip1193Provider : undefined,
    chainId,
    initialMockChains: { 31337: "http://127.0.0.1:8545" },
    enabled: true,
  });

  const salaryManager = useSalaryManager({
    provider: eip1193Provider,
    chainId,
    signer: signer ?? undefined,
    fhevmInstance,
  });

  async function connect() {
    if (!provider) return;
    const accounts = await provider.send("eth_requestAccounts", []);
    setAddress(accounts?.[0] ?? null);
    const s = await provider.getSigner();
    setSigner(s);
  }

  async function refreshFunds() {
    if (!provider || !target?.address) return;
    try {
      const c = new ethers.Contract(target.address, SalaryManagerABI.abi, provider);
      const funds = await c.getDAOFunds();
      setDaoFunds(ethers.formatUnits(funds, 18));
    } catch (e: any) {
      console.error("读取资金池失败:", e);
    }
  }

  async function deposit() {
    if (!signer || !target?.address || !depositEth) return;
    try {
      const cWrite = new ethers.Contract(target.address, SalaryManagerABI.abi, signer);
      const value = ethers.parseEther(depositEth);
      // 某些本地节点在 UI 钱包估算 gas 偶尔返回较小值导致 -32603，手动给出充足 gasLimit
      const tx = await cWrite.fundContract({ value, gasLimit: 100000n });
      await tx.wait();
      setDepositEth("");
      await refreshFunds();
    } catch (e) {
      console.error("充值失败", e);
    }
  }

  function parseSalaryToWei(input: string, unit: "ETH" | "wei"): bigint {
    // 仅保留数字与小数点，去掉单位/空格等
    const cleaned = (input ?? "").toString().trim().replace(/[^0-9.]/g, "");
    if (cleaned.length === 0) throw new Error("请输入有效的工资数字");
    if (unit === "ETH") {
      return ethers.parseEther(cleaned);
    }
    if (!/^\d+$/.test(cleaned)) throw new Error("wei 单位下请只输入整数");
    return BigInt(cleaned);
  }

  useEffect(() => {
    if (target?.address && provider) {
      refreshFunds();
      const interval = setInterval(refreshFunds, 10000);
      return () => clearInterval(interval);
    }
  }, [target?.address, provider]);

  async function handleAddEmployee() {
    if (!empAddress || !salary || !cycle) {
      alert("请填写完整信息");
      return;
    }
    let salaryWei: bigint;
    try {
      salaryWei = parseSalaryToWei(salary, salaryUnit);
    } catch (e: any) {
      alert(e?.message ?? "工资格式不正确");
      return;
    }
    await salaryManager.addEmployee(empAddress, salaryWei, parseInt(cycle));
    setEmpAddress("");
    setSalary("");
    setCycle("");
  }

  if (!address) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-600 via-blue-600 to-purple-700">
        <div className="card max-w-md w-full text-center space-y-6">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              ChainSalary
            </h1>
            <p className="text-gray-600">DAO Payroll Platform</p>
          </div>
          <button onClick={connect} className="btn-primary w-full text-lg py-4">
            🔐 连接钱包
          </button>
          <div className="text-sm text-gray-500">
            <p>Supported Network: Sepolia Testnet</p>
            <p>Requires MetaMask or compatible wallet</p>
          </div>
        </div>
      </div>
    );
  }

  if (!target?.address) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card max-w-md w-full text-center space-y-4">
          <h2 className="text-2xl font-bold text-red-600">⚠️ Contract Not Deployed</h2>
          <p className="text-gray-600">
            SalaryManager not found on chain {chainId}
          </p>
          <p className="text-sm text-gray-500">Please switch to Sepolia or a deployed network.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-gradient-primary shadow-2xl">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              <div>
                <h1 className="text-3xl font-bold text-white">ChainSalary</h1>
                <p className="text-purple-200 text-sm mt-1">DAO Payroll Platform</p>
              </div>
              <nav className="flex gap-4">
                <a href="/" className="text-white/90 hover:text-white px-4 py-2 rounded-lg hover:bg-white/10 transition-colors">
                  Dashboard
                </a>
                <a href="/my-salary" className="text-white/90 hover:text-white px-4 py-2 rounded-lg hover:bg-white/10 transition-colors">
                  My Salary
                </a>
              </nav>
            </div>
            <div className="flex items-center gap-4">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2 text-white text-sm">
                <span className="opacity-80">Account: </span>
                <span className="font-mono">{address.slice(0, 6)}...{address.slice(-4)}</span>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2 text-white text-sm">
                <span className="opacity-80">Network: </span>
                <span className="font-semibold">{chainId === 11155111 ? "Sepolia" : chainId}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        {/* Dashboard Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm mb-1">DAO Treasury</p>
                <p className="text-3xl font-bold text-primary-600">{parseFloat(daoFunds).toFixed(2)}</p>
                <p className="text-gray-400 text-xs mt-1">ETH</p>
              </div>
              <div className="bg-primary-100 rounded-full p-4">
                <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            {/* Deposit ETH */}
            <div className="mt-4 flex gap-2">
              <input
                type="number"
                value={depositEth}
                onChange={(e) => setDepositEth(e.target.value)}
                placeholder="Deposit amount (ETH)"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:outline-none transition-colors"
              />
              <button onClick={deposit} disabled={!signer || !depositEth} className="btn-primary">
                Deposit (ETH)
              </button>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm mb-1">合约地址</p>
                <p className="text-sm font-mono text-gray-700">{target.address.slice(0, 10)}...</p>
                <p className="text-xs text-gray-400 mt-1">SalaryManager</p>
              </div>
              <div className="bg-blue-100 rounded-full p-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm mb-1">FHEVM 状态</p>
                <p className="text-lg font-semibold text-green-600">
                  {fhevmStatus === "ready" ? "✅ 已就绪" : fhevmStatus === "loading" ? "⏳ 加载中" : "⚠️ 未就绪"}
                </p>
                <p className="text-xs text-gray-400 mt-1">加密计算引擎</p>
              </div>
              <div className="bg-green-100 rounded-full p-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* View Tabs */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setView("admin")}
            className={`px-6 py-3 rounded-xl font-semibold transition-all ${
              view === "admin"
                ? "bg-gradient-primary text-white shadow-lg"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            👨‍💼 Admin Panel
          </button>
          <button
            onClick={() => setView("employee")}
            className={`px-6 py-3 rounded-xl font-semibold transition-all ${
              view === "employee"
                ? "bg-gradient-primary text-white shadow-lg"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            👤 Employee Panel
          </button>
        </div>

        {/* Admin Panel */}
        {view === "admin" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card">
              <h3 className="text-xl font-bold mb-4 text-gray-800">➕ Add Employee</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Employee Address</label>
                  <input
                    type="text"
                    value={empAddress}
                    onChange={(e) => setEmpAddress(e.target.value)}
                    placeholder="0x..."
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Salary Per Period</label>
                  <input
                    type="number"
                    value={salary}
                    onChange={(e) => setSalary(e.target.value)}
                    placeholder={salaryUnit === "ETH" ? "1.0 (ETH)" : "1000000000000000000 (wei)"}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:outline-none transition-colors"
                  />
                  <div className="mt-2 flex items-center gap-3 text-sm text-gray-600">
                    <span>Unit:</span>
                    <button
                      className={`px-3 py-1 rounded-lg border ${salaryUnit === "wei" ? "bg-primary-600 text-white border-primary-600" : "bg-white"}`}
                      onClick={() => setSalaryUnit("wei")}
                    >wei</button>
                    <button
                      className={`px-3 py-1 rounded-lg border ${salaryUnit === "ETH" ? "bg-primary-600 text-white border-primary-600" : "bg-white"}`}
                      onClick={() => setSalaryUnit("ETH")}
                    >ETH</button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Pay Cycle (seconds)</label>
                  <input
                    type="number"
                    value={cycle}
                    onChange={(e) => setCycle(e.target.value)}
                    placeholder="2592000 (30天)"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:outline-none transition-colors"
                  />
                </div>
                <button
                  onClick={handleAddEmployee}
                  disabled={salaryManager.busy || !fhevmInstance}
                  className="btn-primary w-full"
                >
                  {salaryManager.busy ? "⏳ Processing..." : "✅ Add Employee"}
                </button>
              </div>
            </div>

            <div className="card">
              <h3 className="text-xl font-bold mb-4 text-gray-800">📊 Activity Log</h3>
              <div className="bg-gray-50 rounded-xl p-4 h-64 overflow-y-auto">
                <p className="text-sm text-gray-600 whitespace-pre-wrap font-mono">
                  {salaryManager.message || "No activity yet"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Employee Panel */}
        {view === "employee" && (
          <div className="card max-w-2xl mx-auto">
            <h3 className="text-xl font-bold mb-6 text-gray-800">💰 Claim Salary</h3>
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-6 text-center">
                <p className="text-gray-600 text-sm mb-2">My Address</p>
                <p className="text-lg font-mono font-semibold text-gray-800">{address}</p>
              </div>
              <button
                onClick={salaryManager.claim}
                disabled={salaryManager.busy}
                className="btn-primary w-full text-lg py-4"
              >
                {salaryManager.busy ? "⏳ Claiming..." : "💸 Claim"}
              </button>
              {salaryManager.message && (
                <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                  <p className="text-sm text-gray-700 font-mono">{salaryManager.message}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12 py-6">
        <div className="container mx-auto px-6 text-center text-gray-500 text-sm">
          <p>ChainSalary - FHEVM based payroll platform</p>
          <p className="mt-2">Privacy · Transparency · Self-service</p>
        </div>
      </footer>
    </div>
  );
}
