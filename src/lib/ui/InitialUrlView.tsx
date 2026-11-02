"use client";
import { createContext, useContext, type ReactNode } from "react";
const InitialSearch = createContext("");
export function InitialUrlView({ search, children }: { search: string; children: ReactNode }) {
  return <InitialSearch.Provider value={search}>{children}</InitialSearch.Provider>;
}
export function useInitialSearch() { return useContext(InitialSearch); }
