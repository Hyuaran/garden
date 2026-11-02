"use client";
import { useCallback, useLayoutEffect, useRef, useState, type SetStateAction } from "react";

/** SSR と hydration は同じ既定値。保存値が読めるまで対象領域を visibility:hidden にする。 */
export function useStoredView<T>(key: string, fallback: T, decode: (raw: string) => T = JSON.parse, encode: (value: T) => string = JSON.stringify, storage: "localStorage" | "sessionStorage" = "localStorage", changeEvent?: string) {
  const codecs = useRef({ decode, encode, fallback });
  codecs.current = { decode, encode, fallback };
  const [state, setState] = useState<{ key: string; value: T; ready: boolean }>({ key, value: fallback, ready: false });
  useLayoutEffect(() => {
    const read = () => {
      let value = codecs.current.fallback;
      try { const raw = window[storage].getItem(key); if (raw !== null) value = codecs.current.decode(raw); } catch { /* 保存不可・破損時は既定値 */ }
      setState({ key, value, ready: true });
    };
    const changed = (event: StorageEvent) => { if (event.key === key || event.key === null) read(); };
    read();
    window.addEventListener("storage", changed);
    if (changeEvent) window.addEventListener(changeEvent, read);
    return () => { window.removeEventListener("storage", changed); if (changeEvent) window.removeEventListener(changeEvent, read); };
  }, [key, storage, changeEvent]);
  const current = useRef(state.value);
  current.current = state.key === key ? state.value : fallback;
  const setValue = useCallback((update: SetStateAction<T>) => {
    const value = typeof update === "function" ? (update as (previous: T) => T)(current.current) : update;
    current.current = value;
    try { window[storage].setItem(key, codecs.current.encode(value)); } catch { /* メモリ内の操作は継続 */ }
    setState({ key, value, ready: true });
  }, [key, storage]);
  const ready = state.key === key && state.ready;
  return [state.key === key ? state.value : fallback, setValue, ready] as const;
}
