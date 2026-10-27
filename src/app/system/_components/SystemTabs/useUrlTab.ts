"use client";
import { useCallback, useEffect, useState, useRef } from "react";
/** Keep panel selection in the URL, including browser back/forward. */
export function useUrlTab<T extends string>(fallback: T, allowed: (key: string) => boolean) {
  const allowedRef = useRef(allowed);
  allowedRef.current = allowed;
  const [tab, setTab] = useState<T>(fallback);
  useEffect(() => {
    const read = () => {
      const key = new URLSearchParams(window.location.search).get("tab");
      setTab(key && allowedRef.current(key) ? key as T : fallback);
    };
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, [fallback]);
  const select = useCallback((key: T) => {
    if (!allowedRef.current(key)) return;
    const url = new URL(window.location.href);
    url.searchParams.set("tab", key);
    window.history.pushState(null, "", url);
    setTab(key);
  }, []);
  return [tab, select] as const;
}
