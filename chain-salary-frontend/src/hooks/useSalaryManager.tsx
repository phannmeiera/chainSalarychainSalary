"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { ethers } from "ethers";
import { SalaryManagerABI } from "../../abi/SalaryManagerABI";
import { SalaryManagerAddresses } from "../../abi/SalaryManagerAddresses";

export function useSalaryManager(params: {
  provider: ethers.Eip1193Provider | undefined;
  chainId: number | undefined;
  signer: ethers.Signer | undefined;
  fhevmInstance: any | undefined;
}) {
  const { provider, chainId, signer, fhevmInstance } = params;

  const [message, setMessage] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);

  const infoRef = useRef<{ address?: `0x${string}`; abi: any } | undefined>(undefined);

  const contractInfo = useMemo(() => {
    const entry = chainId ? (SalaryManagerAddresses as any)[String(chainId)] : undefined;
    const address = entry?.address as `0x${string}` | undefined;
    const abi = SalaryManagerABI.abi;
    const c = { address, abi };
    infoRef.current = c;
    return c;
  }, [chainId]);

  const contractReadonly = useMemo(() => {
    if (!provider || !contractInfo.address) return undefined;
    const runner = new ethers.BrowserProvider(provider);
    return (async () => new ethers.Contract(contractInfo.address!, contractInfo.abi, await runner.getSigner()))();
  }, [provider, contractInfo.address, contractInfo.abi]);

  const addEmployee = useCallback(async (emp: string, salary: bigint, cycleSeconds: number) => {
    if (busy) return;
    if (!signer || !contractInfo.address || !fhevmInstance) return;

    try {
      setBusy(true);
      setMessage("加密工资中...");

      const user = await signer.getAddress();
      const buffer = fhevmInstance.createEncryptedInput(contractInfo.address, user);
      buffer.add64(salary);
      const enc = await buffer.encrypt();

      setMessage("提交交易...");
      const contract = new ethers.Contract(contractInfo.address, contractInfo.abi, signer);
      const tx = await contract.addEmployee(emp, enc.handles[0], enc.inputProof, cycleSeconds, salary);
      await tx.wait();
      setMessage(`✅ 添加完成 tx=${tx.hash}`);
    } catch (e: any) {
      setMessage(`❌ 添加失败: ${e?.message ?? e}`);
    } finally {
      setBusy(false);
    }
  }, [busy, signer, contractInfo.address, contractInfo.abi, fhevmInstance]);

  const claim = useCallback(async () => {
    if (busy) return;
    if (!signer || !contractInfo.address) return;
    try {
      setBusy(true);
      setMessage("⏳ 正在领取工资...");
      const contract = new ethers.Contract(contractInfo.address, contractInfo.abi, signer);
      const tx = await contract.claimSalary();
      await tx.wait();
      setMessage(`🎉 领取完成！tx=${tx.hash}`);
    } catch (e: any) {
      setMessage(`❌ 领取失败: ${e?.message ?? e}`);
    } finally {
      setBusy(false);
    }
  }, [busy, signer, contractInfo.address, contractInfo.abi]);

  return { addEmployee, claim, message, busy } as const;
}


