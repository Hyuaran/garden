"use client";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ForestStateProvider } from "../_state/ForestStateContext";
import { leafForestPageKey } from "@/lib/auth/leaf-forest-view-scopes";
export function ForestViewState({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const page = leafForestPageKey(pathname);
  return <ForestStateProvider key={page} readPage={page}>{children}</ForestStateProvider>;
}
