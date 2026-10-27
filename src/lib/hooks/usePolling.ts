"use client";
import { useEffect, useRef } from "react";

export function usePolling(callback: () => unknown | Promise<unknown>, intervalMs: number, { enabled = true, immediate = true, pauseWhenHidden = true }: { enabled?: boolean; immediate?: boolean; pauseWhenHidden?: boolean } = {}) {
  const latest = useRef(callback);
  latest.current = callback;
  const options = useRef({ immediate, pauseWhenHidden });
  options.current = { immediate, pauseWhenHidden };
  const running = useRef(false);
  useEffect(() => {
    if (!enabled || !Number.isFinite(intervalMs) || intervalMs <= 0) return;
    let stopped = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    const hidden = () => options.current.pauseWhenHidden && document.visibilityState === "hidden";
    const schedule = () => { if (!stopped && !hidden()) timer = setInterval(() => void tick(), intervalMs); };
    const tick = async () => {
      if (stopped || hidden()) return;
      if (running.current) return;
      running.current = true;
      try { await latest.current(); } catch { /* Consumers own their error UI; keep polling after failures. */ }
      finally { running.current = false; }
    };
    const visibility = () => {
      if (!options.current.pauseWhenHidden) return;
      clearInterval(timer);
      if (!hidden()) { void tick(); schedule(); }
    };
    if (options.current.immediate) void tick();
    schedule();
    document.addEventListener("visibilitychange", visibility);
    return () => { stopped = true; clearInterval(timer); document.removeEventListener("visibilitychange", visibility); };
  }, [enabled, intervalMs]);
}
