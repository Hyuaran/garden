"use client";
import { createContext, useContext, type ReactNode } from "react";
const Context = createContext<Record<string, boolean> | null>(null);
export function SproutNavigation({ value, children }: { value: Record<string, boolean>; children: ReactNode }) { return <Context.Provider value={value}>{children}</Context.Provider>; }
export const useSproutNavigation = () => useContext(Context);
