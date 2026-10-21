"use client";
import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from "react";
import { useAuthUnified } from "./auth-unified";
import { applyFontSize, nextFontSize, readFontSize, type FontSize } from "./font-size";
const FontSizeContext = createContext({ size: "m" as FontSize, cycle: () => {} });
export function FontSizeProvider({ children }: { children: ReactNode }) {
  const { userId, loading } = useAuthUnified();
  const [size, setSize] = useState<FontSize>("m");
  useLayoutEffect(() => {
    if (loading) return;
    const saved = readFontSize(userId);
    setSize(saved);
    applyFontSize(saved);
  }, [userId, loading]);
  const cycle = () => {
    const next = nextFontSize[size];
    setSize(next);
    applyFontSize(next);
    try { if (userId) localStorage.setItem(`garden-font-size:${userId}`, next); } catch {}
  };
  return <FontSizeContext.Provider value={{ size, cycle }}>{children}</FontSizeContext.Provider>;
}
export const useFontSize = () => useContext(FontSizeContext);
