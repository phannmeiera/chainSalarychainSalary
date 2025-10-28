"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createFhevmInstance } from "./internal/fhevm";
import type { Eip1193Provider } from "ethers";

export type FhevmGoState = "idle" | "loading" | "ready" | "error";

export function useFhevm(params: {
  provider: Eip1193Provider | string | undefined;
  chainId: number | undefined;
  enabled?: boolean;
  initialMockChains?: Readonly<Record<number, string>>;
}) {
  const { provider, chainId, enabled = true, initialMockChains } = params;
  const [instance, setInstance] = useState<any | undefined>(undefined);
  const [status, setStatus] = useState<FhevmGoState>("idle");
  const [error, setError] = useState<Error | undefined>(undefined);

  const abortRef = useRef<AbortController | null>(null);
  const providerRef = useRef<typeof provider>(provider);

  const refresh = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = null;
    providerRef.current = provider;
    setInstance(undefined);
    setError(undefined);
    setStatus("idle");
  }, [provider]);

  useEffect(() => { refresh(); }, [refresh, chainId]);

  useEffect(() => {
    if (!enabled) { setStatus("idle"); return; }
    if (!providerRef.current) { setStatus("idle"); return; }
    if (!abortRef.current) abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    setStatus("loading");
    setError(undefined);

    createFhevmInstance({ provider: providerRef.current!, mockChains: initialMockChains as any })
      .then((inst) => {
        if (signal.aborted) return;
        setInstance(inst);
        setStatus("ready");
      })
      .catch((e) => {
        if (signal.aborted) return;
        setInstance(undefined);
        setError(e as Error);
        setStatus("error");
      });
  }, [enabled, providerRef.current, chainId]);

  return { instance, refresh, error, status } as const;
}






