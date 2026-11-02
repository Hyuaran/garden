"use client";
import { useInitialSearch } from "@/lib/ui/InitialUrlView";
import { useCallback, useEffect, useState, useRef } from "react";
/** Keep panel selection in the URL, including browser back/forward. */
export function useUrlTab<T extends string>(fallback: T, allowed: (key: string) => boolean = () => true) {
  const initialSearch = useInitialSearch();
  const allowedRef = useRef(allowed);
  allowedRef.current = allowed;
  const [selection, setTab] = useState<T | null>(null);
  const initial = new URLSearchParams(initialSearch).get("tab");
  const tab = selection ?? (initial && allowed(initial) ? initial as T : fallback);
  useEffect(() => {
    const read = () => {
      const key = new URLSearchParams(window.location.search).get("tab");
      setTab(key && allowedRef.current(key) ? key as T : fallback);
    };
    window.addEventListener("popstate", read);
    window.addEventListener("garden-tab-change", read);
    return () => { window.removeEventListener("popstate", read); window.removeEventListener("garden-tab-change", read); };
  }, [fallback]);
  const select = useCallback((key: T) => {
    if (!allowedRef.current(key)) return;
    const url = new URL(window.location.href);
    url.searchParams.set("tab", key);
    window.history.pushState(null, "", url);
    setTab(key);
    window.dispatchEvent(new Event("garden-tab-change"));
  }, []);
  return [tab, select] as const;
}
