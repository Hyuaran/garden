"use client";
import { createContext, useContext, type ReactNode } from "react";
import { leafForestPageKey } from "./leaf-forest-view-scopes";
const Navigation = createContext<Record<string, boolean> | null>(null);
export function LeafForestNavigation({ allowed, children }: { allowed: Record<string, boolean>; children: ReactNode }) {
  return <Navigation.Provider value={allowed}>{children}</Navigation.Provider>;
}
export function useLeafForestNavigation() {
  const allowed = useContext(Navigation);
  return (href: string) => { const key = leafForestPageKey(href); return !key || !allowed || allowed[key] === true; };
}
