"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type CeoStatusKey = "available" | "busy" | "focused" | "away";
export type CeoStatus = {
  status: CeoStatusKey;
  summary: string | null;
  updated_at: string | null;
  updated_by_name: string | null;
};

const POLL_INTERVAL_MS = 30_000;

type ContextValue = {
  status: CeoStatus | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export const ShojiStatusContext = createContext<ContextValue>({
  status: null,
  loading: false,
  error: null,
  refresh: async () => {},
});

export function ShojiStatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<CeoStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/ceo-status", { cache: "no-store" });
      if (!res.ok) {
        // 401 (login 前) や 5xx は silent retry
        if (res.status !== 401) setError(`HTTP ${res.status}`);
        return;
      }
      const data = (await res.json()) as CeoStatus;
      setStatus(data);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      if (cancelled) return;
      await fetchStatus();
    };
    tick();
    const id = setInterval(tick, POLL_INTERVAL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <ShojiStatusContext.Provider value={{ status, loading, error, refresh: fetchStatus }}>
      {children}
    </ShojiStatusContext.Provider>
  );
}

export function useShojiStatus(): ContextValue {
  return useContext(ShojiStatusContext);
}
